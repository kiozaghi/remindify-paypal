import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const {
  blockedCountries, jurisdictionFor, requestCountry,
} = await import("../server/jurisdiction.mjs");

test("blocked country parsing ignores junk and normalises codes", () => {
  assert.deepEqual(
    [...blockedCountries({ BLOCKED_COUNTRIES: " kp, ir;sy  Cu " })].sort(),
    ["CU", "IR", "KP", "SY"]
  );
  assert.equal(blockedCountries({}).size, 0);
  assert.deepEqual([...blockedCountries({ BLOCKED_COUNTRIES: "USA,1,kp" })], ["KP"]);
});

test("country comes from the edge header and unknown answers are allowed", () => {
  const req = (headers) => ({ headers });
  assert.equal(requestCountry(req({ "x-vercel-ip-country": "ir" })), "IR");
  assert.equal(requestCountry(req({ "cf-ipcountry": "de" })), "DE");
  assert.equal(requestCountry(req({ "x-country-code": "fr" })), "FR");
  assert.equal(requestCountry(req({ "x-vercel-ip-country": "ir", "cf-ipcountry": "de" })), "IR");
  assert.equal(requestCountry(req({ "x-vercel-ip-country": "XX" })), "");
  assert.equal(requestCountry(req({})), "");

  const blocked = jurisdictionFor(req({ "cf-ipcountry": "KP" }), { BLOCKED_COUNTRIES: "KP" });
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.country, "KP");
  assert.equal(jurisdictionFor(req({}), { BLOCKED_COUNTRIES: "KP" }).blocked, false);
});

test("region gating blocks account creation and escrow movement", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remindify-region-"));
  process.env.REMINDIFY_DATA_DIR = dir;
  process.env.REMINDIFY_DB = join(dir, "remindify.db");
  process.env.VERCEL = "1";
  process.env.COOKIE_SECURE = "false";
  process.env.BLOCKED_COUNTRIES = "KP,IR";
  delete process.env.EMAIL_WEBHOOK_URL;
  delete process.env.EMAIL_WEBHOOK_SECRET;

  const { default: handle } = await import(`../server/index.mjs?test=${Date.now()}`);

  const server = createServer(handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const post = (path, payload, { cookie, country } = {}) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...(country ? { "x-vercel-ip-country": country } : {}),
      },
      body: JSON.stringify(payload),
    });
  const get = (path, { cookie, country } = {}) =>
    fetch(`${base}${path}`, {
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(country ? { "cf-ipcountry": country } : {}),
      },
    });

  try {
    const password = "correct-horse-battery";
    const email = `region-${Date.now()}@example.com`;

    const refused = await post("/api/auth/signup", { name: "Regional", email, password }, { country: "KP" });
    assert.equal(refused.status, 451);
    assert.equal((await refused.json()).error, "region_blocked");

    const signup = await post("/api/auth/signup", { name: "Regional", email, password }, { country: "FR" });
    assert.equal(signup.status, 201);
    const cookie = signup.headers.get("set-cookie").split(";")[0];

    const opened = await post("/api/trust/escrows", {
      obligation_id: "ob_domain",
      amount: 5,
      payee_paypal_email: "cpa-sandbox@business.example.com",
    }, { cookie });
    assert.equal(opened.status, 201);
    const { escrow } = await opened.json();

    const blockedCreate = await post("/api/trust/escrows", {
      obligation_id: "ob_domain",
      amount: 5,
      payee_paypal_email: "cpa-sandbox@business.example.com",
    }, { cookie, country: "IR" });
    assert.equal(blockedCreate.status, 451);
    assert.equal((await blockedCreate.json()).error, "region_blocked");

    const blockedHold = await post(`/api/trust/escrows/${escrow.id}/hold`, {}, { cookie, country: "ir" });
    assert.equal(blockedHold.status, 451);

    const blockedRelease = await post(`/api/trust/escrows/${escrow.id}/release`, {}, { cookie, country: "KP" });
    assert.equal(blockedRelease.status, 451);

    const trust = await (await get("/api/trust", { cookie })).json();
    assert.equal(trust.trust.escrows.find((entry) => entry.id === escrow.id).status, "draft");

    const allowed = await get("/api/state", { cookie, country: "FR" });
    assert.equal(allowed.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
