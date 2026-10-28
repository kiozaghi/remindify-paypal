import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { PGlite } from "@electric-sql/pglite";

test("Vercel-style handler keeps each account's workspace isolated in Postgres", async () => {
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

  async function signup(email, name) {
    const response = await fetch(`${base}/api/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password: "correct-horse-battery" }),
    });
    assert.equal(response.status, 201);
    return response.headers.get("set-cookie").split(";")[0];
  }

  async function state(cookie) {
    const response = await fetch(`${base}/api/state`, { headers: { cookie } });
    assert.equal(response.status, 200);
    return (await response.json()).state;
  }

  async function createObligation(cookie, title) {
    const response = await fetch(`${base}/api/obligations`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ title }),
    });
    assert.equal(response.status, 201);
  }

  async function issueKey(cookie, name) {
    const response = await fetch(`${base}/api/keys`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name }),
    });
    assert.equal(response.status, 201);
    return (await response.json()).key.secret;
  }

  async function machineTitles(secret) {
    const response = await fetch(`${base}/api/v1/obligations`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    assert.equal(response.status, 200);
    return (await response.json()).obligations.map((item) => item.title);
  }

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

    const stamp = Date.now();
    const cookieA = await signup(`pg-a-${stamp}@example.com`, "Postgres QA A");
    const cookieB = await signup(`pg-b-${stamp}@example.com`, "Postgres QA B");

    const first = await state(cookieA);
    assert.ok(first.obligations.length > 0);
    assert.ok(first.agents.length > 0);

    response = await fetch(`${base}/api/trust`, { headers: { cookie: cookieA } });
    assert.equal(response.status, 200);
    const trust = await response.json();
    assert.ok(trust.trust.receipts.length > 0);

    await createObligation(cookieA, "A-only renewal");
    await createObligation(cookieB, "B-only renewal");
    assert.ok((await state(cookieA)).obligations.some((item) => item.title === "A-only renewal"));
    assert.ok(!(await state(cookieB)).obligations.some((item) => item.title === "A-only renewal"));

    const keyA = await issueKey(cookieA, "A agent key");
    const keyB = await issueKey(cookieB, "B agent key");
    assert.ok((await machineTitles(keyA)).includes("A-only renewal"));
    assert.ok(!(await machineTitles(keyB)).includes("A-only renewal"));
    assert.ok((await machineTitles(keyB)).includes("B-only renewal"));

    response = await fetch(`${base}/api/demo/reset`, {
      method: "POST",
      headers: { cookie: cookieA },
    });
    assert.equal(response.status, 200);

    const afterReset = await state(cookieA);
    assert.ok(!afterReset.obligations.some((item) => item.title === "A-only renewal"));
    assert.ok((await state(cookieB)).obligations.some((item) => item.title === "B-only renewal"));
    assert.ok((await machineTitles(keyB)).includes("B-only renewal"));

    response = await fetch(`${base}/api/auth/session`, { headers: { cookie: cookieA } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.email, `pg-a-${stamp}@example.com`);

    const rows = await db.query("SELECT count(*)::int AS count FROM users");
    assert.equal(rows.rows[0].count, 2);
    const workspaces = await db.query(
      "SELECT count(DISTINCT workspace_id)::int AS count FROM users",
    );
    assert.equal(workspaces.rows[0].count, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  }
});
