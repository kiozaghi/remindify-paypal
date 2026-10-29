import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("the sweep prunes activity past the retention window and leaves fresh records", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remindify-retention-"));
  process.env.REMINDIFY_DATA_DIR = dir;
  process.env.REMINDIFY_DB = join(dir, "remindify.db");
  process.env.VERCEL = "1";
  process.env.COOKIE_SECURE = "false";
  process.env.CRON_SECRET = "retention-cron-secret";
  delete process.env.OUTBOX_SECRET;
  delete process.env.EMAIL_WEBHOOK_URL;
  delete process.env.EMAIL_WEBHOOK_SECRET;
  delete process.env.RETENTION_DAYS;

  const { default: handle } = await import(`../server/index.mjs?test=${Date.now()}`);
  const db = await import("../server/db.mjs");
  const { runWithWorkspace } = await import("../server/workspace.mjs");

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

  const cron = () => post("/api/cron/sweep", {}, { auth: "retention-cron-secret" });

  try {
    const signup = await post("/api/auth/signup", {
      name: "Retention Tester",
      email: `retention-${Date.now()}@example.com`,
      password: "correct-horse-battery",
    });
    assert.equal(signup.status, 201);
    const { user } = await signup.json();
    const cookie = signup.headers.get("set-cookie").split(";")[0];

    const state = await (await fetch(`${base}/api/state`, { headers: { cookie } })).json();
    const created = await post("/api/obligations", {
      title: "Keep this workspace on the sweep",
      category: "work",
      agent_id: state.state.agents[0].id,
      autonomy: "notify",
      due_at: new Date(Date.now() + 2 * 86400000).toISOString(),
    }, { cookie });
    assert.equal(created.status, 201);

    const workspaceId = db.getUser(user.id).workspace_id;
    const old = new Date(Date.now() - 90 * 86400000).toISOString();
    const fresh = new Date().toISOString();
    runWithWorkspace(workspaceId, () => {
      db.put("events", { id: "evt_retention_old", created_at: old, actor: "Test", verb: "aged", object: "entry", kind: "system" });
      db.put("events", { id: "evt_retention_fresh", created_at: fresh, actor: "Test", verb: "fresh", object: "entry", kind: "system" });
      db.put("runs", {
        id: "run_retention_old",
        created_at: old,
        status: "done",
        agent_id: null,
        obligation_id: null,
        action: "Aged run",
        detail: "kept until retention says otherwise",
      });
    });

    // Off by default: replaying the sweep keeps every record.
    const off = await (await cron()).json();
    assert.equal(off.pruned_events, 0);
    assert.equal(off.pruned_runs, 0);
    const before = runWithWorkspace(workspaceId, () => db.loadAll());
    assert.ok(before.events.some((event) => event.id === "evt_retention_old"));

    process.env.RETENTION_DAYS = "30";
    const on = await (await cron()).json();
    assert.equal(on.ok, true);
    assert.ok(on.pruned_events >= 1, "old events are removed");
    assert.ok(on.pruned_runs >= 1, "old runs are removed");

    const after = runWithWorkspace(workspaceId, () => db.loadAll());
    assert.equal(after.events.some((event) => event.id === "evt_retention_old"), false);
    assert.ok(after.events.some((event) => event.id === "evt_retention_fresh"), "fresh events stay");
    assert.equal(after.runs.some((run) => run.id === "run_retention_old"), false);
    assert.ok(after.obligations.length >= 1, "obligations are never pruned");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    delete process.env.CRON_SECRET;
    delete process.env.RETENTION_DAYS;
    rmSync(dir, { recursive: true, force: true });
  }
});
