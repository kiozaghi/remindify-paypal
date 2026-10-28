import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("scheduled sweeps run agents across workspaces and skip repeats", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remindify-cron-"));
  process.env.REMINDIFY_DATA_DIR = dir;
  process.env.REMINDIFY_DB = join(dir, "remindify.db");
  process.env.VERCEL = "1";
  process.env.COOKIE_SECURE = "false";
  process.env.CRON_SECRET = "cron-secret-for-tests";
  delete process.env.OUTBOX_SECRET;
  delete process.env.EMAIL_WEBHOOK_URL;
  delete process.env.EMAIL_WEBHOOK_SECRET;

  const { default: handle } = await import(`../server/index.mjs?test=${Date.now()}`);

  const server = createServer(handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const post = (path, payload, { cookie, auth } = {}) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...(auth ? { authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(payload || {}),
    });

  const cron = (secret) => post("/api/cron/sweep", {}, secret === undefined ? {} : { auth: secret });

  try {
    const signup = async (name, email) => {
      const response = await post("/api/auth/signup", { name, email, password: "correct-horse-battery" });
      assert.equal(response.status, 201);
      return response.headers.get("set-cookie").split(";")[0];
    };
    const alice = await signup("Alice Sweep", `sweep-a-${Date.now()}@example.com`);
    await signup("Bob Sweep", `sweep-b-${Date.now()}@example.com`);

    const state = await (await fetch(`${base}/api/state`, { headers: { cookie: alice } })).json();
    const agentId = state.state.agents[0].id;

    const created = await post("/api/obligations", {
      title: "Renew the studio licence",
      category: "work",
      agent_id: agentId,
      autonomy: "prepare",
      due_at: new Date(Date.now() + 2 * 86400000).toISOString(),
    }, { cookie: alice });
    assert.equal(created.status, 201);

    assert.equal((await cron()).status, 401);
    assert.equal((await post("/api/cron/sweep", {})).status, 401);
    assert.equal((await cron("wrong-secret")).status, 401);

    const ran = await cron("cron-secret-for-tests");
    assert.equal(ran.status, 200);
    const first = await ran.json();
    assert.equal(first.ok, true);
    assert.ok(first.workspaces >= 2, "every workspace with obligations is swept");
    assert.ok(first.drafted >= 1, "the prepared obligation gets a plan");
    assert.equal(first.executed, 0, "no seeded agent has a connector");

    const again = await (await cron("cron-secret-for-tests")).json();
    assert.equal(again.drafted, 0, "an obligation with a recent run is not swept twice");
    assert.equal(again.proposed, 0);
    assert.equal(again.executed, 0);

    // Vercel Cron invokes with GET and a Bearer header.
    const viaGet = await fetch(`${base}/api/cron/sweep`, {
      headers: { authorization: "Bearer cron-secret-for-tests" },
    });
    assert.equal(viaGet.status, 200);

    // The older outbox secret can drive the schedule when CRON_SECRET is unset.
    delete process.env.CRON_SECRET;
    process.env.OUTBOX_SECRET = "outbox-secret-for-tests";
    assert.equal((await cron("cron-secret-for-tests")).status, 401);
    assert.equal((await cron("outbox-secret-for-tests")).status, 200);

    delete process.env.OUTBOX_SECRET;
    assert.equal((await cron("outbox-secret-for-tests")).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
