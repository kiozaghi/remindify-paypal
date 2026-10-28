import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

test("account deletion purges its own workspace and nothing else", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remindify-delete-"));
  process.env.REMINDIFY_DATA_DIR = dir;
  process.env.REMINDIFY_DB = join(dir, "remindify.db");
  process.env.VERCEL = "1";
  process.env.COOKIE_SECURE = "false";
  delete process.env.EMAIL_WEBHOOK_URL;
  delete process.env.EMAIL_WEBHOOK_SECRET;

  const { default: handle } = await import(`../server/index.mjs?test=${Date.now()}`);
  const db = await import("../server/db.mjs");

  const server = createServer(handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const post = (path, payload, cookie) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(payload),
    });
  const get = (path, cookie) =>
    fetch(`${base}${path}`, { headers: cookie ? { cookie } : {} });

  const password = "correct-horse-battery";
  const signup = async (name, email) => {
    const response = await post("/api/auth/signup", { name, email, password });
    assert.equal(response.status, 201);
    const { user } = await response.json();
    return { user, cookie: response.headers.get("set-cookie").split(";")[0] };
  };

  const rows = (sql, params = []) => {
    const disk = new DatabaseSync(process.env.REMINDIFY_DB, { readOnly: true });
    try {
      return disk.prepare(sql).all(...params);
    } finally {
      disk.close();
    }
  };
  const count = (table, workspaceId) =>
    rows(`SELECT COUNT(*) AS n FROM ${table} WHERE workspace_id = ?`, [workspaceId])[0].n;

  try {
    assert.equal((await post("/api/account/delete", { confirm: "delete" })).status, 401);

    const alice = await signup("Alice Deleter", `alice-${Date.now()}@example.com`);
    const bob = await signup("Bob Keeper", `bob-${Date.now()}@example.com`);
    const aliceWs = db.getUser(alice.user.id).workspace_id;
    const bobWs = db.getUser(bob.user.id).workspace_id;
    assert.notEqual(aliceWs, bobWs);

    const before = await get("/api/state", alice.cookie);
    assert.equal(before.status, 200);
    const bobBefore = await (await get("/api/state", bob.cookie)).json();
    assert.ok(count("items", aliceWs) > 0);

    const wrongWord = await post("/api/account/delete", { confirm: "yes", password }, alice.cookie);
    assert.equal(wrongWord.status, 422);
    assert.ok(db.getUser(alice.user.id));

    const noPassword = await post("/api/account/delete", { confirm: "delete" }, alice.cookie);
    assert.equal(noPassword.status, 401);
    assert.equal((await noPassword.json()).error, "invalid_credentials");

    const wrongPassword = await post("/api/account/delete", { confirm: "delete", password: "nope" }, alice.cookie);
    assert.equal(wrongPassword.status, 401);
    assert.ok(db.getUser(alice.user.id));
    assert.ok(count("items", aliceWs) > 0);

    const deleted = await post("/api/account/delete", { confirm: "delete", password }, alice.cookie);
    assert.equal(deleted.status, 200);
    const result = await deleted.json();
    assert.equal(result.ok, true);
    assert.equal(result.purged_workspace, true);
    assert.match(deleted.headers.get("set-cookie") || "", /remindify_session=;/);

    assert.equal(db.getUser(alice.user.id), null);
    assert.equal(rows("SELECT COUNT(*) AS n FROM auth_sessions WHERE user_id = ?", [alice.user.id])[0].n, 0);
    assert.equal(rows("SELECT COUNT(*) AS n FROM auth_tokens WHERE user_id = ?", [alice.user.id])[0].n, 0);
    assert.equal(count("items", aliceWs), 0);
    assert.equal(count("meta", aliceWs), 0);

    assert.equal((await get("/api/state", alice.cookie)).status, 401);

    const bobAfter = await get("/api/state", bob.cookie);
    assert.equal(bobAfter.status, 200);
    const bobState = await bobAfter.json();
    assert.deepEqual(
      bobState.state.obligations.map((o) => o.id),
      bobBefore.state.obligations.map((o) => o.id)
    );
    assert.ok(db.getUser(bob.user.id));
    assert.ok(count("items", bobWs) > 0);

    // Accounts on the shared demo workspace keep the register for everyone else.
    const demo = await signup("Demo Guest", `demo-${Date.now()}@example.com`);
    db.updateUser(demo.user.id, { workspace_id: "ws_demo" });
    assert.equal((await get("/api/state", demo.cookie)).status, 200);
    const demoItems = count("items", "ws_demo");
    assert.ok(demoItems > 0);

    const demoDeleted = await post("/api/account/delete", { confirm: "delete", password }, demo.cookie);
    assert.equal(demoDeleted.status, 200);
    const demoResult = await demoDeleted.json();
    assert.equal(demoResult.purged_workspace, false);
    assert.match(demoResult.message, /shared demo register/);
    assert.equal(db.getUser(demo.user.id), null);
    assert.equal(count("items", "ws_demo"), demoItems);
    assert.equal((await get("/api/state", demo.cookie)).status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
