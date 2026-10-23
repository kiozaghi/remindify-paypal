import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { PGlite } from "@electric-sql/pglite";

test("Vercel-style handler persists auth and workspace data in Postgres", async () => {
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
  process.env.DATABASE_URL = "postgres://test";
  process.env.PG_NO_LOCK = "1";
  process.env.VERCEL = "1";
  process.env.COOKIE_SECURE = "false";

  const { default: handle } = await import(`../server/index.mjs?test=${Date.now()}`);
  const server = createServer(handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    let response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 200);

    // Vercel rewrites /api/* to api/index with the original path in __path.
    response = await fetch(`${base}/api/index?__path=auth/config`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).email, true);

    response = await fetch(`${base}/api/index?__path=auth/session`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user, null);

    response = await fetch(`${base}/api/state`);
    assert.equal(response.status, 401);

    const email = `pg-${Date.now()}@example.com`;
    response = await fetch(`${base}/api/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Postgres QA",
        email,
        password: "correct-horse-battery",
      }),
    });
    assert.equal(response.status, 201);
    const cookie = response.headers.get("set-cookie").split(";")[0];

    response = await fetch(`${base}/api/state`, { headers: { cookie } });
    assert.equal(response.status, 200);
    const first = await response.json();
    assert.ok(first.state.obligations.length > 0);

    response = await fetch(`${base}/api/trust`, { headers: { cookie } });
    assert.equal(response.status, 200);
    const trust = await response.json();
    assert.ok(trust.trust.receipts.length > 0);

    response = await fetch(`${base}/api/demo/reset`, {
      method: "POST",
      headers: { cookie },
    });
    assert.equal(response.status, 200);

    response = await fetch(`${base}/api/auth/session`, { headers: { cookie } });
    assert.equal(response.status, 200);
    const session = await response.json();
    assert.equal(session.user.email, email);

    const rows = await db.query("SELECT count(*)::int AS count FROM users");
    assert.equal(rows.rows[0].count, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  }
});
