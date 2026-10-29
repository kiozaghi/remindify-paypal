import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("agent autonomy ceiling is enforced at write time, at run time, and notify agents suggest", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remindify-ceiling-"));
  process.env.REMINDIFY_DATA_DIR = dir;
  process.env.REMINDIFY_DB = join(dir, "remindify.db");
  process.env.VERCEL = "1";
  process.env.COOKIE_SECURE = "false";
  delete process.env.CRON_SECRET;
  delete process.env.OUTBOX_SECRET;

  const { default: handle } = await import(`../server/index.mjs?test=${Date.now()}`);

  const server = createServer(handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (method, path, payload, cookie) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };

  try {
    const email = `ceiling-${process.pid}-${Date.now()}@example.com`;
    const signupRes = await fetch(`${base}/api/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Ceiling Test", email, password: "correct-horse-battery" }),
    });
    assert.equal(signupRes.status, 201);
    const session = signupRes.headers.get("set-cookie").split(";")[0];

    const state = await call("GET", "/api/state", undefined, session);
    const agent = state.data.state.agents[0];
    assert.ok(agent, "workspace has a seeded agent");

    // 1. Write-time clamp: assigning an autopilot obligation to a prepare-ceiling agent.
    await call("PATCH", `/api/agents/${agent.id}`, { autonomy_ceiling: "prepare" }, session);
    const created = await call("POST", "/api/obligations", {
      title: "File the quarterly return",
      category: "finance",
      agent_id: agent.id,
      autonomy: "autopilot",
      due_at: new Date(Date.now() + 86400000).toISOString(),
    }, session);
    assert.equal(created.status, 201);
    assert.equal(created.data.obligation.autonomy, "prepare", "autonomy is clamped to the ceiling at creation");
    const obId = created.data.obligation.id;

    // 2. A lowered ceiling is respected at run time, even for a stale obligation.
    await call("PATCH", `/api/obligations/${obId}`, { autonomy: "autopilot" }, session);
    const stored = await call("GET", "/api/state", undefined, session);
    const restored = stored.data.state.obligations.find((o) => o.id === obId);
    assert.equal(restored.autonomy, "prepare", "PATCH also clamps to the ceiling");
    await call("PATCH", `/api/agents/${agent.id}`, { autonomy_ceiling: "notify" }, session);
    const ran = await call("POST", `/api/obligations/${obId}/run`, {}, session);
    assert.equal(ran.status, 200);
    assert.equal(ran.data.result?.executed ?? false, false, "nothing executes above the ceiling");

    const afterRun = await call("GET", "/api/state", undefined, session);
    const run = afterRun.data.state.runs.find((r) => r.obligation_id === obId);
    assert.equal(run.status, "drafted", "a capped run is a suggestion, not an action");
    assert.match(run.detail, /ceiling/i, "the run records the ceiling cap");

    // 3. Notify agents suggest work on sweep: never act, always surface.
    const notifyOb = await call("POST", "/api/obligations", {
      title: "Book the dentist",
      category: "health",
      agent_id: agent.id,
      autonomy: "notify",
      due_at: new Date(Date.now() + 86400000).toISOString(),
    }, session);
    assert.equal(notifyOb.data.obligation.autonomy, "notify", "notify is within the notify ceiling");

    const swept = await call("POST", "/api/demo/sweep", {}, session);
    assert.equal(swept.status, 200);
    assert.ok((swept.data.suggested || 0) >= 1, "sweep suggests rather than acts for notify obligations");
    assert.equal(swept.data.executed, 0);
    const notifyRun = swept.data.state.runs.find((r) => r.obligation_id === notifyOb.data.obligation.id);
    assert.equal(notifyRun.action, "Flagged it for you");
    const notifyEvent = swept.data.state.events.find(
      (e) => e.actor_id === agent.id && e.verb === "suggested a next step"
    );
    assert.ok(notifyEvent, "a suggestion event is logged for notify agents");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
