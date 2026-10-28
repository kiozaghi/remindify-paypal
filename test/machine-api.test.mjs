import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("machine API enforces idempotency, expiry, rotation and per-key rate limits", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remindify-machine-"));
  process.env.REMINDIFY_DATA_DIR = dir;
  process.env.REMINDIFY_DB = join(dir, "remindify.db");
  process.env.VERCEL = "1";
  process.env.COOKIE_SECURE = "false";
  delete process.env.MACHINE_RATE_LIMIT;

  const { default: handle } = await import(`../server/index.mjs?test=${Date.now()}`);
  const db = await import("../server/db.mjs");
  const { runWithWorkspace } = await import("../server/workspace.mjs");

  const server = createServer(handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const email = `machine-${Date.now()}@example.com`;

  const signup = async () => {
    const response = await fetch(`${base}/api/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Machine API", email, password: "correct-horse-battery" }),
    });
    assert.equal(response.status, 201);
    return response.headers.get("set-cookie").split(";")[0];
  };

  const issueKey = async (cookie, name, extra = {}) => {
    const response = await fetch(`${base}/api/keys`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name, ...extra }),
    });
    assert.equal(response.status, 201);
    const { key } = await response.json();
    assert.match(key.secret, /^rfy_live_/);
    assert.equal(key.secret_hash, undefined);
    return key;
  };

  const call = (secret, path, init = {}) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${secret}`, ...(init.headers || {}) },
    });

  try {
    const cookie = await signup();

    // A retry with the same Idempotency-Key and body replays the first response.
    const key = await issueKey(cookie, "Idempotent agent");
    assert.ok(new Date(key.expires_at).getTime() > Date.now() + 89 * 86400000);

    const input = { title: "Idempotent warehouse renewal", due_at: "2026-12-01T09:00:00Z" };
    const request = {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "create-renewal-1" },
      body: JSON.stringify(input),
    };

    const first = await call(key.secret, "/api/v1/obligations", request);
    assert.equal(first.status, 201);
    assert.equal(first.headers.get("idempotent-replay"), null);
    const created = await first.json();

    const replay = await call(key.secret, "/api/v1/obligations", request);
    assert.equal(replay.status, 201);
    assert.equal(replay.headers.get("idempotent-replay"), "true");
    assert.deepEqual(await replay.json(), created);

    const conflict = await call(key.secret, "/api/v1/obligations", {
      ...request,
      body: JSON.stringify({ ...input, title: "A different renewal" }),
    });
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).error, "idempotency_conflict");

    const register = await (await call(key.secret, "/api/v1/obligations")).json();
    assert.equal(register.obligations.filter((o) => o.title === input.title).length, 1);
    assert.equal(register.obligations.filter((o) => o.title === "A different renewal").length, 0);

    // Rotation replaces the secret; the old one stops resolving.
    const rotating = await issueKey(cookie, "Rotating agent");
    const rotated = await fetch(`${base}/api/keys/${rotating.id}/rotate`, {
      method: "POST",
      headers: { cookie },
    });
    assert.equal(rotated.status, 200);
    const rotatedKey = (await rotated.json()).key;
    assert.ok(rotatedKey.secret && rotatedKey.secret !== rotating.secret);
    assert.ok(rotatedKey.rotated_at);

    assert.equal((await call(rotating.secret, "/api/v1/risk")).status, 401);
    assert.equal((await call(rotatedKey.secret, "/api/v1/risk")).status, 200);

    // An expired key is refused before any work runs.
    const expiring = await issueKey(cookie, "Expiring agent");
    const user = db.findUserByEmail(email);
    assert.ok(user?.workspace_id);
    runWithWorkspace(user.workspace_id, () => {
      const stored = db.loadAll().keys.find((k) => k.id === expiring.id);
      assert.ok(stored);
      db.put("keys", { ...stored, expires_at: new Date(Date.now() - 1000).toISOString() });
    });
    const expired = await call(expiring.secret, "/api/v1/risk");
    assert.equal(expired.status, 401);
    assert.equal((await expired.json()).error, "key_expired");

    // A new workspace is on Free: a fourth key is refused.
    const tooMany = await fetch(`${base}/api/keys`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "One too many" }),
    });
    assert.equal(tooMany.status, 402);
    assert.equal((await tooMany.json()).error, "plan_limit");

    // Free up slots so the rate-limit key fits.
    assert.equal((await fetch(`${base}/api/keys/${rotating.id}`, { method: "DELETE", headers: { cookie } })).status, 200);
    assert.equal((await fetch(`${base}/api/keys/${expiring.id}`, { method: "DELETE", headers: { cookie } })).status, 200);

    // Limits are per key, and the window is visible in the headers.
    process.env.MACHINE_RATE_LIMIT = "2";
    const limited = await issueKey(cookie, "Rate-limited agent");
    const one = await call(limited.secret, "/api/v1/risk");
    assert.equal(one.status, 200);
    assert.equal(one.headers.get("x-ratelimit-limit"), "2");
    assert.equal(one.headers.get("x-ratelimit-remaining"), "1");
    const two = await call(limited.secret, "/api/v1/risk");
    assert.equal(two.status, 200);
    assert.equal(two.headers.get("x-ratelimit-remaining"), "0");
    const three = await call(limited.secret, "/api/v1/risk");
    assert.equal(three.status, 429);
    assert.equal((await three.json()).error, "rate_limited");
    assert.ok(Number(three.headers.get("retry-after")) > 0);
    delete process.env.MACHINE_RATE_LIMIT;

    // App state exposes key metadata, never the secret or its digest.
    const state = await (await fetch(`${base}/api/state`, { headers: { cookie } })).json();
    assert.ok(state.state.keys.length >= 2);
    for (const item of state.state.keys) {
      assert.equal(item.secret, undefined);
      assert.equal(item.secret_hash, undefined);
    }
  } finally {
    delete process.env.MACHINE_RATE_LIMIT;
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
