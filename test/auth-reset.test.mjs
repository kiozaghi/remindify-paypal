import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

test("password reset issues single-use hashed tokens and revokes sessions", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remindify-reset-"));
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
      mailbox.push({ headers: req.headers, raw, body: JSON.parse(raw) });
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

  const email = `reset-${Date.now()}@example.com`;
  const oldPassword = "correct-horse-battery";
  const newPassword = "a-longer-replacement";

  try {
    // Without an email webhook the feature is explicitly unavailable.
    const unavailable = await post("/api/auth/reset/request", { email });
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).error, "email_not_configured");

    process.env.EMAIL_WEBHOOK_URL = mailerUrl;
    process.env.EMAIL_WEBHOOK_SECRET = "test-reset-secret";

    const signup = await post("/api/auth/signup", { name: "Reset Tester", email, password: oldPassword });
    assert.equal(signup.status, 201);
    const cookie = signup.headers.get("set-cookie").split(";")[0];
    assert.equal(mailbox.length, 1);
    assert.match(mailbox[0].body.subject, /Confirm your Remindify email/);

    // Unknown addresses get the same answer as known ones and no email.
    const stranger = await post("/api/auth/reset/request", { email: `nobody-${Date.now()}@example.com` });
    assert.equal(stranger.status, 202);
    const strangerBody = await stranger.json();
    assert.equal(strangerBody.message, "If that email has an account, a reset link is on its way.");
    assert.equal(mailbox.length, 1);

    const requested = await post("/api/auth/reset/request", { email });
    assert.equal(requested.status, 202);
    assert.deepEqual(await requested.json(), strangerBody);
    assert.equal(mailbox.length, 2);

    const { headers, raw, body } = mailbox[1];
    assert.equal(body.to, email);
    assert.match(body.subject, /Reset your Remindify password/);
    const timestamp = headers["x-remindify-timestamp"];
    const expected = `sha256=${createHmac("sha256", "test-reset-secret").update(`${timestamp}.${raw}`).digest("hex")}`;
    assert.equal(headers["x-remindify-signature"], expected);

    const link = body.text.match(/https?:\/\/\S+\/login\?reset=\S+/)[0];
    const token = decodeURIComponent(new URL(link).searchParams.get("reset"));
    assert.ok(token.length > 20);

    // The database stores only a digest of the token.
    const disk = new DatabaseSync(process.env.REMINDIFY_DB, { readOnly: true });
    const rows = disk.prepare("SELECT token_hash FROM auth_tokens").all();
    disk.close();
    assert.ok(rows.length >= 1);
    assert.ok(rows.every((row) => row.token_hash !== token));
    assert.ok(rows.some((row) => row.token_hash === createHash("sha256").update(token).digest("hex")));

    // A short password is rejected without burning the token.
    const weak = await post("/api/auth/reset/confirm", { token, password: "short" });
    assert.equal(weak.status, 422);

    const confirmed = await post("/api/auth/reset/confirm", { token, password: newPassword });
    assert.equal(confirmed.status, 200);

    // The token is single use.
    const reuse = await post("/api/auth/reset/confirm", { token, password: "another-replacement" });
    assert.equal(reuse.status, 400);

    // Sessions created before the reset are gone.
    const session = await fetch(`${base}/api/auth/session`, { headers: { cookie } });
    assert.equal(session.status, 200);
    assert.equal((await session.json()).user, null);

    const oldLogin = await post("/api/auth/login", { email, password: oldPassword });
    assert.equal(oldLogin.status, 401);
    const newLogin = await post("/api/auth/login", { email, password: newPassword });
    assert.equal(newLogin.status, 200);
    assert.equal((await newLogin.json()).user.email, email);

    // Expired tokens are rejected even if they were never used.
    const expiredToken = "expired-reset-token-value";
    db.createAuthToken({
      tokenHash: createHash("sha256").update(expiredToken).digest("hex"),
      userId: "usr_does_not_matter",
      purpose: "reset",
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
    });
    const late = await post("/api/auth/reset/confirm", { token: expiredToken, password: "yet-another-one" });
    assert.equal(late.status, 400);

    // A token issued for another purpose cannot be used to reset a password.
    const loginAgain = await post("/api/auth/login", { email, password: newPassword });
    assert.equal(loginAgain.status, 200);
    const userId = (await loginAgain.json()).user.id;
    const purposeToken = "purpose-scoped-token-value";
    db.createAuthToken({
      tokenHash: createHash("sha256").update(purposeToken).digest("hex"),
      userId,
      purpose: "email_verify",
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
