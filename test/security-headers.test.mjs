import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("every response carries the baseline security headers", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remindify-headers-"));
  process.env.REMINDIFY_DATA_DIR = dir;
  process.env.REMINDIFY_DB = join(dir, "remindify.db");
  process.env.VERCEL = "1";
  process.env.COOKIE_SECURE = "false";

  const { default: handle } = await import(`../server/index.mjs?test=${Date.now()}`);

  const server = createServer(handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const expectBaseline = (response) => {
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("content-security-policy"), "frame-ancestors 'none'");
    assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.match(response.headers.get("permissions-policy"), /camera=\(\)/);
  };

  try {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    expectBaseline(health);
    assert.equal((await health.json()).ok, true);
    assert.equal(health.headers.get("strict-transport-security"), null, "no HSTS without TLS");

    const secure = await fetch(`${base}/api/health`, { headers: { "x-forwarded-proto": "https" } });
    assert.match(secure.headers.get("strict-transport-security"), /max-age=\d+; includeSubDomains/);

    const denied = await fetch(`${base}/api/state`);
    assert.equal(denied.status, 401);
    expectBaseline(denied);

    const page = await fetch(`${base}/`);
    expectBaseline(page);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
