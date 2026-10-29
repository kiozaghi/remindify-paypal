import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("local SQLite store gives every account its own workspace", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remindify-sqlite-"));
  process.env.REMINDIFY_DATA_DIR = dir;
  process.env.REMINDIFY_DB = join(dir, "remindify.db");
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

  async function titles(cookie) {
    const response = await fetch(`${base}/api/state`, { headers: { cookie } });
    assert.equal(response.status, 200);
    return (await response.json()).state.obligations.map((item) => item.title);
  }

  async function createObligation(cookie, title) {
    const response = await fetch(`${base}/api/obligations`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ title }),
    });
    assert.equal(response.status, 201);
  }

  try {
    const stamp = Date.now();
    const cookieA = await signup(`sqlite-a-${stamp}@example.com`, "SQLite A");
    const cookieB = await signup(`sqlite-b-${stamp}@example.com`, "SQLite B");

    assert.ok((await titles(cookieA)).length > 0);
    await createObligation(cookieA, "A local renewal");
    assert.ok((await titles(cookieA)).includes("A local renewal"));
    assert.ok(!(await titles(cookieB)).includes("A local renewal"));

    let response = await fetch(`${base}/api/demo/reset`, {
      method: "POST",
      headers: { cookie: cookieA },
    });
    assert.equal(response.status, 200);
    assert.ok(!(await titles(cookieA)).includes("A local renewal"));
    assert.ok((await titles(cookieB)).length > 0);

    response = await fetch(`${base}/api/auth/session`, { headers: { cookie: cookieB } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).user.email, `sqlite-b-${stamp}@example.com`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
