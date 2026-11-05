import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "remindify-procurement-"));
process.env.REMINDIFY_DATA_DIR = dir;
process.env.REMINDIFY_DB = join(dir, "remindify.db");
process.env.VERCEL = "1";
process.env.COOKIE_SECURE = "false";
delete process.env.CHANNEL3_API_KEY;
delete process.env.EXECUTOR_ALLOW_LOCAL;

const {
  isProcurementAgent, markRestockCaptured, procurementCeiling, pickLowestVerified, planProcurement, procurementProof,
} = await import(`../server/procurement.mjs?test=${Date.now()}`);
const { normalizeOffer } = await import("../server/channel3.mjs");
const { loadAll, put } = await import("../server/db.mjs");
const { signExecutorRequest } = await import("../server/executors.mjs");
const { default: handle } = await import(`../server/index.mjs?test=${Date.now()}`);

test.after(() => rmSync(dir, { recursive: true, force: true }));

test("normalises a Channel3 product into a verified offer", () => {
  const offer = normalizeOffer({
    id: "ch3_123",
    title: "Brother TN-450 Toner",
    brands: [{ name: "Brother" }],
    images: [{ url: "https://img.example/toner.jpg" }],
    ratings: { value: 4.6 },
    offers: [{
      price: "89.99",
      currency: "usd",
      url: "https://shop.example/p/1",
      domain: "shop.example",
      availability: "in_stock",
    }],
  });

  assert.equal(offer.sku, "ch3_123");
  assert.equal(offer.title, "Brother TN-450 Toner");
  assert.equal(offer.price, 89.99);
  assert.equal(offer.currency, "USD");
  assert.equal(offer.merchant, "shop.example");
  assert.equal(offer.verified, true);
});

test("an offer without a merchant URL is not verified", () => {
  const offer = normalizeOffer({
    id: "ch3_404",
    title: "Mystery toner",
    offers: [{ price: "20.00", currency: "USD", availability: "in_stock" }],
  });
  assert.equal(offer.url, "");
  assert.equal(offer.verified, false);
});

test("keeps only verified, in-stock, USD offers under the ceiling", () => {
  const ranked = pickLowestVerified([
    { sku: "a", price: 90, currency: "USD", verified: true, rating: 4 },
    { sku: "b", price: 60, currency: "USD", verified: true, rating: 3 },
    { sku: "c", price: 50, currency: "USD", verified: false },
    { sku: "d", price: 40, currency: "EUR", verified: true },
    { sku: "e", price: 200, currency: "USD", verified: true },
  ], 150);

  assert.deepEqual(ranked.map((offer) => offer.sku), ["b", "a"]);
});

test("the passport ceiling is the lower of the agent cap and the obligation budget", () => {
  assert.equal(procurementCeiling({ spend_ceiling: 150 }, { procurement: { max_price: 120 } }), 120);
  assert.equal(procurementCeiling({ spend_ceiling: 90 }, { procurement: { max_price: 150 } }), 90);
  assert.equal(procurementCeiling({ spend_ceiling: null }, {}), 150);
  assert.equal(isProcurementAgent({ handle: "procurement-bot" }), true);
  assert.equal(isProcurementAgent({ handle: "ar-collector" }), false);
});

test("quotes the cheapest verified restock from the sample catalog", async () => {
  const plan = await planProcurement({
    agent: { handle: "procurement-bot", spend_ceiling: 150 },
    obligation: {
      title: "Quarterly printer toner & backup drive replacement",
      procurement: {
        queries: ["printer toner cartridge", "portable backup drive"],
        max_price: 150,
      },
    },
    env: {},
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.source, "fixture");
  assert.equal(plan.quote.sku, "CH3-TN450-1PK");
  assert.equal(plan.quote.price, 64.5);
  assert.ok(plan.quote.verified);
  assert.match(plan.quote.url, /^https:\/\//);
});

test("uses live Channel3 results and picks the lowest verified price", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    const products = body.query.includes("drive")
      ? [{ id: "d1", title: "Backup Drive", offers: [{ price: "120.00", currency: "USD", url: "https://m.example/d", domain: "m.example" }] }]
      : [
          { id: "t1", title: "Toner A", offers: [{ price: "74.00", currency: "USD", url: "https://m.example/t1", domain: "m.example" }] },
          { id: "t2", title: "Toner B", offers: [{ price: "64.00", currency: "USD", url: "https://m.example/t2", domain: "m.example" }] },
        ];
    return { ok: true, json: async () => ({ products }), text: async () => "" };
  };

  const plan = await planProcurement({
    agent: { spend_ceiling: 150 },
    obligation: { procurement: { queries: ["toner", "drive"], max_price: 150 } },
    env: { CHANNEL3_API_KEY: "test-key" },
    fetchImpl,
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.source, "channel3");
  assert.equal(plan.quote.sku, "t2");
  assert.equal(calls[0].url, "https://api.trychannel3.com/v1/search");
  assert.equal(calls[0].body.filters.price.max, 150);
});

test("refuses to quote when the only verified item is over the ceiling", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      products: [{
        id: "x1",
        title: "Oversized toner",
        offers: [{ price: "260.00", currency: "USD", url: "https://m.example/x", domain: "m.example" }],
      }],
    }),
    text: async () => "",
  });

  const plan = await planProcurement({
    agent: { spend_ceiling: 150 },
    obligation: { procurement: { queries: ["toner"], max_price: 150 } },
    env: { CHANNEL3_API_KEY: "test-key" },
    fetchImpl,
  });

  assert.equal(plan.ok, false);
  assert.match(plan.error, /\$150\.00/);
});

test("the proof carries the SKU, merchant URL and PayPal order", () => {
  const proof = procurementProof(
    {
      source: "channel3",
      sku: "CH3-1",
      title: "Toner",
      price: 64.5,
      merchant: "Shop",
      url: "https://shop.example/p/1",
    },
    { orderId: "ORDER-1" }
  );

  assert.match(proof, /CH3-1/);
  assert.match(proof, /https:\/\/shop\.example\/p\/1/);
  assert.match(proof, /PayPal ORDER-1/);
});

test("a PayPal capture closes the restock quote", () => {
  const saved = loadAll().obligations.find((item) => item.id === "ob_restock");
  put("obligations", {
    ...saved,
    restock: {
      ...(saved.restock || {}),
      paypal_order_id: "ORDER-CAPTURE",
      order_status: "CREATED",
      approve_url: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-CAPTURE",
    },
  });

  assert.equal(markRestockCaptured("ORDER-CAPTURE", { captureId: "CAP-1" }), true);
  const after = loadAll().obligations.find((item) => item.id === "ob_restock");
  assert.equal(after.restock.order_status, "COMPLETED");
  assert.equal(after.restock.approve_url, null);
  assert.equal(after.restock.capture_id, "CAP-1");
  assert.equal(markRestockCaptured("ORDER-UNKNOWN"), false);
});

test("the signed executor quotes, files the quote and leaves the obligation open", async () => {
  const server = createServer(handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const agent = loadAll().agents.find((item) => item.id === "ag_procurement");
    assert.ok(agent?.executor_secret);

    const raw = JSON.stringify({
      event: "obligation.execute",
      run_id: "run_procurement_test",
      workspace: { id: "ws_demo", name: "Exopya Studio" },
      agent: { id: agent.id, name: agent.name, handle: agent.handle },
      obligation: { id: "ob_restock" },
      action: "Executed the approved action",
      detail: "Restock quote",
      issued_at: new Date().toISOString(),
    });
    const issuedAt = Date.now();
    const response = await fetch(`${base}/api/procurement`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-remindify-timestamp": String(issuedAt),
        "x-remindify-signature": `sha256=${signExecutorRequest(agent.executor_secret, issuedAt, raw)}`,
      },
      body: raw,
    });

    const json = await response.json();
    assert.equal(response.status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.complete, false);
    assert.equal(json.paypal_configured, false);
    assert.equal(json.quote.sku, "CH3-TN450-1PK");
    assert.match(json.proof, /Channel3/);

    const saved = loadAll().obligations.find((item) => item.id === "ob_restock");
    assert.equal(saved.restock.sku, "CH3-TN450-1PK");
    assert.equal(saved.status, "active");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("an unsigned executor call is rejected", async () => {
  const server = createServer(handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const response = await fetch(`${base}/api/procurement`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspace: { id: "ws_demo" },
        agent: { id: "ag_procurement" },
        obligation: { id: "ob_restock" },
      }),
    });
    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
