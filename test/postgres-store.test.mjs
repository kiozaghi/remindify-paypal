import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

test("postgres store seeds, persists a request snapshot and preserves auth across resets", async () => {
  const db = new PGlite();
  const client = {
    query: (text, params = []) => db.query(text, params),
    release() {},
  };
  globalThis.__remindifyPool = {
    query: (text, params = []) => db.query(text, params),
    connect: async () => client,
    end: () => db.close(),
  };
  process.env.PG_NO_LOCK = "1";

  const store = await import(`../server/db-postgres.mjs?test=${Date.now()}`);

  async function withSnapshot(fn) {
    const snapshot = await store.beginRequest();
    return store.runWithStore(snapshot, async () => {
      try {
        const result = await fn();
        await store.endRequest(snapshot);
        return result;
      } catch (error) {
        await store.endRequest(snapshot).catch(() => {});
        throw error;
      }
    });
  }

  await withSnapshot(async () => {
    assert.equal(store.seedDatabase(), true);
    assert.equal(store.seeded(), true);
    assert.equal(store.loadAll().obligations.length, 16);
    assert.equal(store.loadAll().agents.length, 7);
    assert.equal(store.getMeta("workspace"), "Exopya Studio");
  });

  await withSnapshot(async () => {
    assert.equal(store.seedDatabase(), false);
    assert.equal(store.loadAll().obligations.length, 16);
    store.put("obligations", {
      id: "ob_test",
      title: "Persist me",
      due_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    store.put("outbox", {
      id: "obx_test",
      run_id: "run_test",
      status: "pending",
      next_at: new Date().toISOString(),
    });
    store.setMeta("workspace", "Vercel QA");
    store.createUser({
      id: "usr_test",
      email: "test@example.com",
      name: "Test User",
      password_hash: "hash",
      password_salt: "salt",
      created_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    });
    store.createAuthSession({
      tokenHash: "token_hash",
      userId: "usr_test",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
  });

  await withSnapshot(async () => {
    assert.equal(store.getMeta("workspace"), "Vercel QA");
    assert.ok(store.loadAll().obligations.some((item) => item.id === "ob_test"));
    assert.ok(store.loadAll().outbox.some((item) => item.id === "obx_test"));
    assert.deepEqual(store.workspacesWithKind("outbox"), ["ws_demo"]);
    assert.equal(store.findUserByEmail("test@example.com").name, "Test User");
    assert.equal(store.getAuthSession("token_hash").user.id, "usr_test");
    assert.equal(store.seedDatabase(true), true);
    assert.equal(store.getMeta("workspace"), "Exopya Studio");
    assert.equal(store.loadAll().outbox.length, 0);
    assert.equal(store.findUserByEmail("test@example.com").name, "Test User");
  });

  await db.close();
});
