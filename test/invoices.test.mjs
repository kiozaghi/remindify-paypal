import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "remindify-invoices-"));
process.env.REMINDIFY_DATA_DIR = dir;
process.env.REMINDIFY_DB = join(dir, "test.db");

const { loadAll, put } = await import("../server/db.mjs");
const {
  invoiceForObligation, listInvoices, remindObligationInvoice, sendObligationInvoice,
} = await import("../server/invoices.mjs");
const { PayPalError } = await import("../server/paypal.mjs");

const ENV = {
  PAYPAL_ENV: "sandbox",
  PAYPAL_CLIENT_ID: "test-client",
  PAYPAL_CLIENT_SECRET: "test-secret",
};

const realFetch = globalThis.fetch;
const calls = [];

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function installMock() {
  calls.length = 0;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (!target.startsWith("https://api-m.sandbox.paypal.com")) {
      return realFetch(url, options);
    }
    calls.push({ url: target, method: options.method || "GET" });
    if (target.endsWith("/v1/oauth2/token")) {
      return jsonResponse({ access_token: "test-token", expires_in: 3600 });
    }
    if (target.endsWith("/v2/invoicing/invoices") && options.method === "POST") {
      return jsonResponse({ id: "INV2-TEST", href: "https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-TEST" });
    }
    if (target.endsWith("/v2/invoicing/invoices/INV2-TEST/send")) {
      return jsonResponse({});
    }
    if (target.endsWith("/v2/invoicing/invoices/INV2-TEST/remind")) {
      return jsonResponse({});
    }
    if (target.endsWith("/v2/invoicing/invoices/INV2-TEST")) {
      return jsonResponse({
        id: "INV2-TEST",
        status: "SENT",
        links: [{ rel: "payer-view", href: "https://www.sandbox.paypal.com/invoice/p/#INV2-TEST" }],
      });
    }
    return jsonResponse({ name: "NOT_FOUND", message: "unexpected mock route" }, 404);
  };
}

const OBLIGATION = {
  id: "ob_invoice_test",
  title: "October retainer",
  amount: 2400,
  currency: "USD",
  due_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  status: "active",
  payer_paypal_email: "client@business.example.com",
};

function seed(kind, row) {
  put(kind, row);
}

test.after(() => {
  globalThis.fetch = realFetch;
});

test("the invoice is billed to the stored payer for the stored amount", async () => {
  installMock();
  seed("obligations", OBLIGATION);

  const row = await sendObligationInvoice({
    obligation: OBLIGATION,
    agent: { id: "ag_collect", name: "Collector" },
    env: ENV,
    now: Date.parse("2026-10-31T09:00:00Z"),
  });

  assert.equal(row.amount, 2400);
  assert.equal(row.payer_paypal_email, "client@business.example.com");
  assert.equal(row.paypal_invoice_id, "INV2-TEST");
  assert.equal(row.status, "SENT");
  assert.equal(row.payer_view_url, "https://www.sandbox.paypal.com/invoice/p/#INV2-TEST");
  assert.equal(row.agent_name, "Collector");

  const stored = invoiceForObligation(loadAll(), OBLIGATION.id);
  assert.equal(stored.id, row.id);
  assert.ok(loadAll().events.some((event) => event.detail.includes("INV2-TEST")));
});

test("a missing payer email is refused before PayPal is called", async () => {
  installMock();
  await assert.rejects(
    sendObligationInvoice({
      obligation: { ...OBLIGATION, id: "ob_no_payer", payer_paypal_email: null },
      env: ENV,
    }),
    (error) => error instanceof PayPalError && error.code === "payer_required"
  );
  assert.equal(calls.length, 0);
});

test("a closed obligation cannot be invoiced", async () => {
  installMock();
  await assert.rejects(
    sendObligationInvoice({
      obligation: { ...OBLIGATION, id: "ob_closed", status: "paid" },
      env: ENV,
    }),
    (error) => error instanceof PayPalError && error.code === "obligation_closed"
  );
  assert.equal(calls.length, 0);
});

test("a reminder increments the stored count", async () => {
  installMock();
  const [invoice] = listInvoices(loadAll()).filter((item) => item.paypal_invoice_id === "INV2-TEST");
  const next = await remindObligationInvoice({ invoice, env: ENV, now: Date.parse("2026-11-02T09:00:00Z") });
  assert.equal(next.reminders, 1);
  assert.ok(next.last_reminded_at.startsWith("2026-11-02"));
  assert.equal(invoiceForObligation(loadAll(), invoice.obligation_id).reminders, 1);
});

test("a sample invoice is never sent to PayPal for a reminder", async () => {
  installMock();
  await assert.rejects(
    remindObligationInvoice({
      invoice: { id: "in_demo", demo: true, paypal_invoice_id: "INV2-DEMO-1" },
      env: ENV,
    }),
    (error) => error instanceof PayPalError && error.code === "invoice_not_live"
  );
  assert.equal(calls.length, 0);
});
