import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "remindify-handover-"));
process.env.REMINDIFY_DATA_DIR = dir;
process.env.REMINDIFY_DB = join(dir, "remindify.db");
process.env.VERCEL = "1";
process.env.COOKIE_SECURE = "false";
delete process.env.CRON_SECRET;
delete process.env.OUTBOX_SECRET;
delete process.env.EXECUTOR_ALLOW_LOCAL;

const { default: handle } = await import(`../server/index.mjs?test=${Date.now()}`);

test.after(() => rmSync(dir, { recursive: true, force: true }));

test("the built-in executor closes a run and a missed deadline escalates to the backup", async () => {
  const server = createServer(handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  // Relative executor paths resolve against the deployment origin; point it
  // at this test server so the connector round-trip is real.
  process.env.PUBLIC_ORIGIN = base;

  const call = async (method, path, payload, cookie) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };

  try {
    const email = `handover-${process.pid}-${Date.now()}@example.com`;
    const signup = await fetch(`${base}/api/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Handover Test", email, password: "correct-horse-battery" }),
    });
    assert.equal(signup.status, 201);
    const session = signup.headers.get("set-cookie").split(";")[0];

    const initial = await call("GET", "/api/state", undefined, session);
    const stack = initial.data.state.agents.find((agent) => agent.id === "ag_stack");
    assert.ok(stack, "the seeded infrastructure agent is present");
    assert.equal(stack.executor_configured, true, "the seeded agent has a sandbox executor");
    assert.equal(stack.executor_secret, undefined, "the signing secret never leaves the server");
    assert.equal(stack.executor_url, "/api/internal/agent-executor");

    const due = new Date(Date.now() + 2 * 86400000).toISOString();
    const automatic = await call("POST", "/api/obligations", {
      title: "Renew the TLS certificate",
      category: "work",
      agent_id: "ag_stack",
      autonomy: "autopilot",
      backup: "Hanna Bekele",
      due_at: due,
      amount: 12,
    }, session);
    assert.equal(automatic.status, 201);
    const autoId = automatic.data.obligation.id;
    const owner = automatic.data.obligation.owner;

    const overdue = await call("POST", "/api/obligations", {
      title: "Water filter replacement",
      category: "home",
      agent_id: "ag_trim",
      autonomy: "notify",
      backup: "Hanna Bekele",
      due_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      severity: 3,
    }, session);
    assert.equal(overdue.status, 201);
    const overdueId = overdue.data.obligation.id;

    const swept = await call("POST", "/api/demo/sweep", {}, session);
    assert.equal(swept.status, 200);
    assert.ok(swept.data.executed >= 1, "the autopilot obligation executed through its connector");
    assert.ok(swept.data.handed_over >= 1, "the missed deadline was handed over");

    const executed = swept.data.state.obligations.find((ob) => ob.id === autoId);
    assert.equal(executed.status, "done", "the executed obligation closed");
    const run = swept.data.state.runs.find(
      (item) => item.obligation_id === autoId && item.status === "done"
    );
    assert.ok(run, "the run is recorded as done");
    assert.match(run.proof, /^sandbox_executor_run_/, "proof came back from the sandbox executor");
    const receipt = swept.data.state.receipts.find((item) => item.obligation_id === autoId);
    assert.ok(receipt, "a completion receipt was filed");

    const handed = swept.data.state.obligations.find((ob) => ob.id === overdueId);
    assert.equal(handed.owner, "Hanna Bekele", "the backup now owns the missed deadline");
    assert.equal(handed.owner_kind, "human");
    assert.equal(handed.handover_from, owner);
    assert.ok(handed.handover_at);
    assert.match(handed.handover_reason, /Missed by 2 days/);
    assert.ok(swept.data.state.stats.handed_over >= 1, "the stat counts escalations");
    const event = swept.data.state.events.find(
      (item) => item.kind === "handover" && item.object === "Water filter replacement"
    );
    assert.ok(event, "the handover is written to the audit trail");
    assert.equal(event.actor, "Hanna Bekele");

    const reclaimed = await call("POST", `/api/obligations/${overdueId}/reclaim`, {}, session);
    assert.equal(reclaimed.status, 200);
    const back = reclaimed.data.state.obligations.find((ob) => ob.id === overdueId);
    assert.equal(back.owner, owner, "reclaim restores the original owner");
    assert.equal(back.handover_at, undefined);
    assert.equal(back.handover_history.length, 1, "the handover stays in history");
    assert.ok(
      new Date(back.handover_history[0].reclaimed_at) >= new Date(back.handover_history[0].at),
      "a reclaim is never timestamped before the handover it reverses"
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
