import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

test("transient connector failures persist in an outbox and drain later", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remindify-outbox-"));
  process.env.REMINDIFY_DATA_DIR = dir;
  process.env.REMINDIFY_DB = join(dir, "remindify.db");
  process.env.VERCEL = "1";
  process.env.COOKIE_SECURE = "false";
  process.env.EXECUTOR_ALLOW_LOCAL = "1";
  process.env.EXECUTOR_ATTEMPTS = "1";
  process.env.EXECUTOR_RETRY_BASE_MS = "0";
  process.env.OUTBOX_RETRY_BASE_MS = "0";
  process.env.OUTBOX_MAX_ATTEMPTS = "2";
  process.env.OUTBOX_SECRET = "test-outbox-secret";

  let mode = "down";
  const calls = [];
  const executor = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      calls.push({
        run: req.headers["x-remindify-run"],
        attempt: req.headers["x-remindify-attempt"],
        mode,
      });
      if (mode === "down") {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "warming up" }));
        return;
      }
      if (mode === "permanent") {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "bad_request" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ proof: "proof_after_retry" }));
    });
  });
  await new Promise((resolve) => executor.listen(0, "127.0.0.1", resolve));

  const { default: handle } = await import(`../server/index.mjs?test=${Date.now()}`);
  const app = createServer(handle);
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${app.address().port}`;

  const api = (path, method, payload, cookie) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        ...(payload ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

  const outboxRows = () => {
    const disk = new DatabaseSync(process.env.REMINDIFY_DB, { readOnly: true });
    try {
      return disk
        .prepare("SELECT data FROM items WHERE kind = 'outbox'")
        .all()
        .map((row) => JSON.parse(row.data));
    } finally {
      disk.close();
    }
  };

  try {
    const signup = await api("/api/auth/signup", "POST", {
      name: "Outbox Tester",
      email: `outbox-${Date.now()}@example.com`,
      password: "correct-horse-battery",
    });
    assert.equal(signup.status, 201);
    const cookie = signup.headers.get("set-cookie").split(";")[0];

    const agentRes = await api("/api/agents", "POST", {
      name: "Outbox Runner",
      capabilities: ["execute"],
      autonomy_ceiling: "autopilot",
    }, cookie);
    assert.equal(agentRes.status, 201);
    const agent = (await agentRes.json()).agent;

    const connect = await api(`/api/agents/${agent.id}/executor`, "POST", {
      url: `http://127.0.0.1:${executor.address().port}/run`,
    }, cookie);
    assert.equal(connect.status, 200);
    assert.ok((await connect.json()).signing_secret);

    const makeObligation = async (title) => {
      const response = await api("/api/obligations", "POST", {
        title,
        agent_id: agent.id,
        autonomy: "autopilot",
        due_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      }, cookie);
      assert.equal(response.status, 201);
      return (await response.json()).obligation;
    };

    // The connector is down: the inline failure is saved as a durable job.
    const obligation = await makeObligation("Renew the outbox test licence");
    const firstRun = await api(`/api/obligations/${obligation.id}/run`, "POST", {}, cookie);
    assert.equal(firstRun.status, 400);
    const firstBody = await firstRun.json();
    assert.equal(firstBody.queued, true);
    assert.match(firstBody.message, /saved/);
    assert.ok(calls.length >= 1);
    const runId = calls[0].run;
    assert.ok(runId);

    const queued = outboxRows();
    assert.equal(queued.length, 1);
    assert.equal(queued[0].status, "pending");
    assert.equal(queued[0].run_id, runId);
    assert.equal(queued[0].attempts, 0);
    assert.equal(queued[0].obligation_id, obligation.id);

    // A permanent error is not retried and must not create another job.
    mode = "permanent";
    const permanent = await makeObligation("A permanently broken execution");
    const permanentRun = await api(`/api/obligations/${permanent.id}/run`, "POST", {}, cookie);
    assert.equal(permanentRun.status, 400);
    assert.equal((await permanentRun.json()).queued, false);
    assert.equal(outboxRows().length, 1);

    // The cron route needs the shared secret and nothing else.
    const cron = (secret) =>
      fetch(`${base}/api/cron/outbox`, {
        method: "POST",
        headers: secret ? { authorization: `Bearer ${secret}` } : {},
      });
    assert.equal((await cron()).status, 401);
    assert.equal((await cron("wrong")).status, 401);

    mode = "up";
    const drained = await cron("test-outbox-secret");
    assert.equal(drained.status, 200);
    const drainBody = await drained.json();
    assert.equal(drainBody.ok, true);
    assert.ok(drainBody.processed >= 1);

    // The retry reuses the original run id so executors can dedupe.
    assert.ok(calls.some((call) => call.run === runId && call.mode === "up"));

    const stateRes = await api("/api/state", "GET", null, cookie);
    const state = (await stateRes.json()).state;
    const done = state.obligations.find((ob) => ob.id === obligation.id);
    assert.equal(done.status, "done");
    assert.equal(done.last_proof, "proof_after_retry");
    assert.ok(state.runs.some((run) => run.outbox_id && run.status === "done"));
    assert.ok(state.events.some((event) => event.verb === "executed after a queued retry"));

    const completed = outboxRows().find((job) => job.run_id === runId);
    assert.equal(completed.status, "done");
    assert.equal(completed.attempts, 1);

    const again = await cron("test-outbox-secret");
    assert.equal((await again.json()).processed, 0);

    // Exhaustion marks the job failed after the configured number of attempts.
    mode = "down";
    const stuck = await makeObligation("An executor that never comes back");
    const stuckRun = await api(`/api/obligations/${stuck.id}/run`, "POST", {}, cookie);
    assert.equal((await stuckRun.json()).queued, true);
    mode = "down";
    await cron("test-outbox-secret");
    assert.equal(outboxRows().find((job) => job.obligation_id === stuck.id).status, "pending");
    await cron("test-outbox-secret");
    const failed = outboxRows().find((job) => job.obligation_id === stuck.id);
    assert.equal(failed.status, "failed");
    assert.equal(failed.attempts, 2);
    assert.match(failed.last_error, /503/);

    const afterFailure = (await (await api("/api/state", "GET", null, cookie)).json()).state;
    assert.equal(afterFailure.obligations.find((ob) => ob.id === stuck.id).status, "active");
    assert.ok(afterFailure.events.some((event) => /gave up after 2 queued attempts/.test(event.detail)));
  } finally {
    await new Promise((resolve) => app.close(resolve));
    await new Promise((resolve) => executor.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
