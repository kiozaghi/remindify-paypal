import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WALLET = `0x${"a1".repeat(20)}`;

test("escrow movement is refused when the payer wallet is sanctioned", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remindify-sanctions-"));
  process.env.REMINDIFY_DATA_DIR = dir;
  process.env.REMINDIFY_DB = join(dir, "remindify.db");
  process.env.VERCEL = "1";
  process.env.COOKIE_SECURE = "false";
  delete process.env.BLOCKED_COUNTRIES;
  delete process.env.SANCTIONS_API_URL;
  delete process.env.SANCTIONS_API_KEY;
  delete process.env.SANCTIONS_FAIL_CLOSED;

  let mode = "clear";
  const screened = [];
  const provider = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      screened.push(JSON.parse(raw));
      if (mode === "error") {
        res.writeHead(500, { "content-type": "application/json" });
        res.end("{}");
        return;
      }
      const body = mode === "hit"
        ? { hits: [{ address: WALLET, reason: "test list" }] }
        : { hits: [] };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    });
  });
  await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const providerUrl = `http://127.0.0.1:${provider.address().port}/screen`;

  const { default: handle } = await import(`../server/index.mjs?test=${Date.now()}`);
  const db = await import("../server/db.mjs");

  const server = createServer(handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const post = (path, payload, cookie) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(payload || {}),
    });

  try {
    const signup = await post("/api/auth/signup", {
      name: "Screen Tester",
      email: `screen-${Date.now()}@example.com`,
      password: "correct-horse-battery",
    });
    assert.equal(signup.status, 201);
    const { user } = await signup.json();
    const cookie = signup.headers.get("set-cookie").split(";")[0];
    db.updateUser(user.id, { wallet_address: WALLET });

    const state = await (await fetch(`${base}/api/state`, { headers: { cookie } })).json();
    const obligation = await post("/api/obligations", {
      title: "Pay the interpreter",
      category: "work",
      agent_id: state.state.agents[0].id,
      autonomy: "approve",
      amount: 25,
      due_at: new Date(Date.now() + 2 * 86400000).toISOString(),
    }, cookie);
    assert.equal(obligation.status, 201);
    const obligationId = (await obligation.json()).state.obligations.find((o) => o.title === "Pay the interpreter").id;

    const escrow = (payload = {}) => post("/api/trust/escrows", {
      obligation_id: obligationId,
      amount: 25,
      jurisdiction_ack: true,
      ...payload,
    }, cookie);

    // No provider configured: nothing is screened and the intent is accepted.
    const open = await escrow();
    assert.equal(open.status, 201);
    assert.equal(screened.length, 0);

    process.env.SANCTIONS_API_URL = providerUrl;

    mode = "hit";
    const blocked = await escrow();
    assert.equal(blocked.status, 403);
    const blockedBody = await blocked.json();
    assert.equal(blockedBody.error, "sanctions_hit");
    assert.equal(blockedBody.hits[0].address, WALLET);
    assert.equal(screened.length, 1);
    assert.deepEqual(screened[0].addresses, [WALLET]);

    mode = "clear";
    assert.equal((await escrow()).status, 201);

    // A provider outage fails open by default.
    mode = "error";
    assert.equal((await escrow()).status, 201);

    // Operators can choose to fail closed instead.
    process.env.SANCTIONS_FAIL_CLOSED = "1";
    const unavailable = await escrow();
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).error, "sanctions_unavailable");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => provider.close(resolve));
    delete process.env.SANCTIONS_API_URL;
    delete process.env.SANCTIONS_API_KEY;
    delete process.env.SANCTIONS_FAIL_CLOSED;
    rmSync(dir, { recursive: true, force: true });
  }
});
