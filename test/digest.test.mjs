import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("the sweep emails one digest per verified account per day", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remindify-digest-"));
  process.env.REMINDIFY_DATA_DIR = dir;
  process.env.REMINDIFY_DB = join(dir, "remindify.db");
  process.env.VERCEL = "1";
  process.env.COOKIE_SECURE = "false";
  process.env.CRON_SECRET = "digest-cron-secret";
  delete process.env.OUTBOX_SECRET;
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
  const { runWithWorkspace } = await import("../server/workspace.mjs");

  const server = createServer(handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const post = (path, payload, { cookie, auth } = {}) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...(auth ? { authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(payload || {}),
    });

  const cron = () => post("/api/cron/sweep", {}, { auth: "digest-cron-secret" });

  try {
    const signup = async (name, email) => {
      const response = await post("/api/auth/signup", { name, email, password: "correct-horse-battery" });
      assert.equal(response.status, 201);
      const { user } = await response.json();
      return { user, cookie: response.headers.get("set-cookie").split(";")[0] };
    };

    const alice = await signup("Alice Digest", `digest-a-${Date.now()}@example.com`);
    const bob = await signup("Bob Digest", `digest-b-${Date.now()}@example.com`);
    assert.equal(mailbox.length, 0, "signup sends nothing before a provider is configured");

    process.env.EMAIL_WEBHOOK_URL = mailerUrl;
    process.env.PUBLIC_ORIGIN = base;
    db.updateUser(alice.user.id, { email_verified_at: new Date().toISOString() });

    const aliceState = await (await fetch(`${base}/api/state`, { headers: { cookie: alice.cookie } })).json();
    const agentId = aliceState.state.agents[0].id;

    for (const [account, title] of [[alice, "Renew the studio licence"], [bob, "File the quarterly return"]]) {
      const created = await post("/api/obligations", {
        title,
        category: "work",
        agent_id: agentId,
        autonomy: "notify",
        due_at: new Date(Date.now() + 2 * 86400000).toISOString(),
      }, { cookie: account.cookie });
      assert.equal(created.status, 201);
    }

    const first = await (await cron()).json();
    assert.equal(first.ok, true);
    assert.equal(first.digests, 1, "only the confirmed mailbox gets a digest");
    assert.equal(first.digest_failed, 0);

    assert.equal(mailbox.length, 1);
    const mail = mailbox[0];
    assert.equal(mail.to, alice.user.email);
    assert.match(mail.subject, /^Remindify daily/);
    assert.match(mail.subject, /due/);
    assert.match(mail.text, /Renew the studio licence/);
    assert.match(mail.text, /due in 2 days/);
    assert.match(mail.text, /\/today/);
    assert.doesNotMatch(mail.text, /File the quarterly return/, "an unconfirmed account's register stays private");

    const unsubscribeLink = mail.text.match(/https?:\/\/\S+\/api\/digest\/unsubscribe\?token=\S+/)[0];
    assert.ok(unsubscribeLink.startsWith(base), "the link points at the configured origin");

    const optedOut = await fetch(unsubscribeLink);
    assert.equal(optedOut.status, 200);
    const optedOutPage = await optedOut.text();
    assert.match(optedOutPage, /Daily digest off/);
    const resubscribePath = optedOutPage.match(/href="(\/api\/digest\/subscribe\?token=[^"]+)"/)[1];
    assert.equal((await fetch(`${base}/api/digest/unsubscribe?token=forged`)).status, 400);

    const second = await (await cron()).json();
    assert.equal(second.digests, 0, "a replayed sweep does not send the digest twice");
    assert.equal(mailbox.length, 1);

    // A new UTC day would reopen the digest, but the opt-out holds.
    const workspaceId = db.getUser(alice.user.id).workspace_id;
    runWithWorkspace(workspaceId, () => db.setMeta("digest_sent_for", "2000-01-01"));
    const skipped = await (await cron()).json();
    assert.equal(skipped.digests, 0, "an opted-out mailbox is not emailed again");
    assert.equal(mailbox.length, 1);

    // The confirmation page links back, so the preference is self-service.
    const back = await fetch(`${base}${resubscribePath}`);
    assert.equal(back.status, 200);
    assert.match(await back.text(), /Daily digest on/);

    const third = await (await cron()).json();
    assert.equal(third.digests, 1);
    assert.equal(mailbox.length, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => mailer.close(resolve));
    delete process.env.EMAIL_WEBHOOK_URL;
    delete process.env.EMAIL_WEBHOOK_SECRET;
    delete process.env.CRON_SECRET;
    delete process.env.PUBLIC_ORIGIN;
    rmSync(dir, { recursive: true, force: true });
  }
});
