import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("email verification issues single-use tokens and marks the account", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remindify-verify-"));
  process.env.REMINDIFY_DATA_DIR = dir;
  process.env.REMINDIFY_DB = join(dir, "remindify.db");
  process.env.VERCEL = "1";
  process.env.COOKIE_SECURE = "false";
  delete process.env.EMAIL_WEBHOOK_URL;
  delete process.env.EMAIL_WEBHOOK_SECRET;

  const mailbox = [];
  const mailer = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      mailbox.push(JSON.parse(raw));
      res.writeHead(202, { "content-type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise((resolve) => mailer.listen(0, "127.0.0.1", resolve));
  const mailerUrl = `http://127.0.0.1:${mailer.address().port}/email`;

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

  const signup = async (email) => {
    const response = await post("/api/auth/signup", { name: "Verify Tester", email, password: "correct-horse-battery" });
    assert.equal(response.status, 201);
    const { user } = await response.json();
    return { user, cookie: response.headers.get("set-cookie").split(";")[0] };
  };

  const tokenFrom = (message) => {
    const link = message.text.match(/https?:\/\/\S+\/login\?verify=\S+/)[0];
    return decodeURIComponent(new URL(link).searchParams.get("verify"));
  };

  try {
    // Without a mail webhook, signup still works and verification is unavailable.
    const offline = await signup(`offline-${Date.now()}@example.com`);
    assert.equal(offline.user.email_verified, false);
    const unavailable = await post("/api/auth/verify/request", {}, offline.cookie);
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).error, "email_not_configured");
    assert.equal(mailbox.length, 0);

    process.env.EMAIL_WEBHOOK_URL = mailerUrl;

    const email = `verify-${Date.now()}@example.com`;
    const account = await signup(email);
    assert.equal(account.user.email_verified, false);
    assert.equal(mailbox.length, 1);
    assert.equal(mailbox[0].to, email);
    assert.match(mailbox[0].subject, /Confirm your Remindify email/);
    const firstToken = tokenFrom(mailbox[0]);

    const stored = db.getUser(account.user.id);
    assert.equal(stored.email_verified_at, null);

    // A resend replaces the earlier link so only the newest one works.
    const resent = await post("/api/auth/verify/request", {}, account.cookie);
    assert.equal(resent.status, 202);
    assert.equal(mailbox.length, 2);
    const secondToken = tokenFrom(mailbox[1]);
    assert.notEqual(firstToken, secondToken);

    const stale = await post("/api/auth/verify/confirm", { token: firstToken });
    assert.equal(stale.status, 400);

    const confirmed = await post("/api/auth/verify/confirm", { token: secondToken });
    assert.equal(confirmed.status, 200);
    assert.equal((await confirmed.json()).user.email_verified, true);
    assert.ok(db.getUser(account.user.id).email_verified_at);

    const session = await fetch(`${base}/api/auth/session`, { headers: { cookie: account.cookie } });
    assert.equal((await session.json()).user.email_verified, true);

    // Tokens are single use.
    const reuse = await post("/api/auth/verify/confirm", { token: secondToken });
    assert.equal(reuse.status, 400);

    const again = await post("/api/auth/verify/request", {}, account.cookie);
    assert.equal(again.status, 200);
    assert.equal((await again.json()).already_verified, true);
    assert.equal(mailbox.length, 2);

    // Following a password reset proves the mailbox, so it also verifies it.
    const otherEmail = `reset-verify-${Date.now()}@example.com`;
    const other = await signup(otherEmail);
    assert.equal(other.user.email_verified, false);
    const resetRequest = await post("/api/auth/reset/request", { email: otherEmail });
    assert.equal(resetRequest.status, 202);
    const resetText = mailbox[mailbox.length - 1].text;
    const resetLink = resetText.match(/https?:\/\/\S+\/login\?reset=\S+/)[0];
    const resetToken = decodeURIComponent(new URL(resetLink).searchParams.get("reset"));
    const resetConfirm = await post("/api/auth/reset/confirm", { token: resetToken, password: "replacement-password" });
    assert.equal(resetConfirm.status, 200);
    assert.ok(db.getUser(other.user.id).email_verified_at);

    // Verification tokens cannot be replayed as reset tokens.
    const purposeToken = "verify-purpose-token";
    db.createAuthToken({
      tokenHash: createHash("sha256").update(purposeToken).digest("hex"),
      userId: account.user.id,
      purpose: "verify",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const wrongPurpose = await post("/api/auth/reset/confirm", { token: purposeToken, password: "not-allowed-here" });
    assert.equal(wrongPurpose.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => mailer.close(resolve));
    delete process.env.EMAIL_WEBHOOK_URL;
    delete process.env.EMAIL_WEBHOOK_SECRET;
    rmSync(dir, { recursive: true, force: true });
  }
});
