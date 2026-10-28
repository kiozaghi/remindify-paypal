import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";

test("a paid plan needs a confirmed email once email is configured", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remindify-plan-"));
  process.env.REMINDIFY_DATA_DIR = dir;
  process.env.REMINDIFY_DB = join(dir, "remindify.db");
  process.env.VERCEL = "1";
  process.env.COOKIE_SECURE = "false";
  process.env.BILLING_ALLOW_PLAN_SWITCH = "1";
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
      body: JSON.stringify(payload || {}),
    });
  const plan = (name, cookie) => post("/api/billing/plan", { plan: name }, cookie);

  try {
    const email = `plan-${Date.now()}@example.com`;
    const signup = await post("/api/auth/signup", {
      name: "Plan Tester", email, password: "correct-horse-battery",
    });
    assert.equal(signup.status, 201);
    const cookie = signup.headers.get("set-cookie").split(";")[0];

    // Without an email provider nobody can confirm, so the preview stays usable.
    assert.equal((await plan("studio", cookie)).status, 200);
    assert.equal((await plan("free", cookie)).status, 200);

    // Once confirmation is possible, an unconfirmed address cannot buy a plan.
    process.env.EMAIL_WEBHOOK_URL = "http://127.0.0.1:9/mail";
    const refused = await plan("studio", cookie);
    assert.equal(refused.status, 403);
    assert.equal((await refused.json()).error, "email_unverified");
    assert.equal((await plan("free", cookie)).status, 200, "downgrades stay open");

    db.updateUser(db.findUserByEmail(email).id, { email_verified_at: new Date().toISOString() });
    assert.equal((await plan("studio", cookie)).status, 200);

    // A wallet account has no address to confirm; it is not blocked.
    const account = privateKeyToAccount(`0x${"11".repeat(32)}`);
    const challenge = await post("/api/auth/wallet/challenge", { address: account.address });
    assert.equal(challenge.status, 200);
    const { nonce, message } = await challenge.json();
    const verified = await post("/api/auth/wallet/verify", {
      address: account.address,
      nonce,
      signature: await account.signMessage({ message }),
    });
    assert.equal(verified.status, 200);
    const walletCookie = verified.headers.get("set-cookie").split(";")[0];
    assert.equal((await plan("studio", walletCookie)).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
