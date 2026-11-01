import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  PayPalError, captureOrder, createOrder, createPayout, payableAmount,
  paypalConfigured, paypalMode, verifyWebhook,
} from "../server/paypal.mjs";

const ENV = {
  PAYPAL_ENV: "sandbox",
  PAYPAL_CLIENT_ID: "test-client",
  PAYPAL_CLIENT_SECRET: "test-secret",
};

const realFetch = globalThis.fetch;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const calls = [];

function installPayPalMock() {
  calls.length = 0;
  globalThis.__orders = {};
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (!target.startsWith("https://api-m.sandbox.paypal.com")) {
      return realFetch(url, options);
    }
    calls.push({ url: target, options });

    if (target.endsWith("/v1/oauth2/token")) {
      return jsonResponse({ access_token: "test-token", expires_in: 3600 });
    }
    if (target.endsWith("/v2/checkout/orders")) {
      const body = JSON.parse(options.body || "{}");
      const id = `ORDER${calls.filter((c) => c.url.endsWith("/v2/checkout/orders")).length}`;
      // Remember the amount so the capture can echo it back faithfully.
      globalThis.__orders = { ...(globalThis.__orders || {}), [id]: body.purchase_units[0].amount };
      return jsonResponse({
        id,
        status: "CREATED",
        links: [{ rel: "approve", href: `https://sandbox.paypal.com/checkoutnow?token=${id}` }],
      });
    }
    const captureMatch = target.match(/\/v2\/checkout\/orders\/([^/]+)\/capture$/);
    if (captureMatch) {
      const amount = globalThis.__orders?.[captureMatch[1]] || { currency_code: "USD", value: "1.00" };
      return jsonResponse({
        id: captureMatch[1],
        status: "COMPLETED",
        payer: { email_address: "buyer@example.com" },
        purchase_units: [{
          payments: { captures: [{
            id: `CAP${captureMatch[1]}`,
            status: "COMPLETED",
            amount: { currency_code: amount.currency_code, value: amount.value },
          }] },
        }],
      });
    }
    if (target.endsWith("/v1/payments/payouts") && options.method === "POST") {
      return jsonResponse({
        batch_header: { payout_batch_id: "BATCH1", batch_status: "PENDING" },
      }, 201);
    }
    if (target.endsWith("/v1/payments/payouts/BATCH1")) {
      return jsonResponse({
        batch_header: { payout_batch_id: "BATCH1", batch_status: "SUCCESS" },
        items: [{ transaction_status: "SUCCESS" }],
      });
    }
    if (target.endsWith("/v1/notifications/verify-webhook-signature")) {
      return jsonResponse({ verification_status: "SUCCESS" });
    }
    return jsonResponse({ name: "NOT_FOUND", message: "unexpected mock route" }, 404);
  };
}

test("amounts come from the obligation, never from the request", () => {
  assert.deepEqual(payableAmount({ amount: 42.5, currency: "USD" }), { currency: "USD", value: "42.50" });
  assert.deepEqual(payableAmount({ amount: 7, currency: "usd" }), { currency: "USD", value: "7.00" });

  assert.throws(() => payableAmount({ amount: 0, currency: "USD" }), (error) => {
    assert.ok(error instanceof PayPalError);
    assert.equal(error.code, "nothing_to_pay");
    return true;
  });
  assert.throws(() => payableAmount({ amount: 10, currency: "EUR" }), (error) => {
    assert.equal(error.code, "currency_unsupported");
    return true;
  });
  assert.throws(() => payableAmount({ amount: 50_000, currency: "USD" }), (error) => {
    assert.equal(error.code, "amount_too_large");
    return true;
  });
});

test("orders are created with the stored amount and a fresh approve link", async () => {
  installPayPalMock();
  const order = await createOrder(
    { id: "ob_test", title: "Rent", amount: 42.5, currency: "USD" },
    { returnUrl: "https://example.test/obligations?paypal=return", cancelUrl: "https://example.test/obligations?paypal=cancel", env: ENV }
  );
  assert.equal(order.orderId, "ORDER1");
  assert.match(order.approveUrl, /checkoutnow\?token=ORDER1$/);

  const createCall = calls.find((call) => call.url.endsWith("/v2/checkout/orders"));
  const payload = JSON.parse(createCall.options.body);
  assert.equal(payload.purchase_units[0].amount.value, "42.50");
  assert.equal(payload.purchase_units[0].amount.currency_code, "USD");
  assert.equal(payload.purchase_units[0].custom_id, "ob_test");
});

test("capture verifies the amount before reporting success", async () => {
  installPayPalMock();
  globalThis.__orders = { ORDER1: { currency_code: "USD", value: "42.50" } };
  const captured = await captureOrder("ORDER1", { currency: "USD", value: "42.50" }, { env: ENV });
  assert.equal(captured.captureStatus, "COMPLETED");
  assert.equal(captured.amount, 42.5);

  await assert.rejects(
    captureOrder("ORDER1", { currency: "USD", value: "99.00" }, { env: ENV }),
    (error) => {
      assert.equal(error.code, "amount_mismatch");
      return true;
    }
  );
});

test("a declined capture reads as a decline, not a generic PayPal error", async () => {
  installPayPalMock();
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).endsWith("/capture")) {
      return jsonResponse({
        name: "UNPROCESSABLE_ENTITY",
        message: "The requested action could not be performed, semantically incorrect, or failed business validation.",
        debug_id: "dbg_1",
        details: [{
          issue: "INSTRUMENT_DECLINED",
          description: "The provided payment method was declined.",
        }],
      }, 422);
    }
    return inner(url, options);
  };
  try {
    await assert.rejects(
      captureOrder("ORDER1", { currency: "USD", value: "18.00" }, { env: ENV }),
      (error) => {
        assert.ok(error instanceof PayPalError);
        assert.equal(error.code, "INSTRUMENT_DECLINED");
        assert.equal(error.status, 422);
        assert.match(error.message, /declined the payer's card/);
        return true;
      }
    );
  } finally {
    globalThis.fetch = inner;
  }
});

test("payouts send the Payouts API currency field", async () => {
  installPayPalMock();
  const result = await createPayout({
    payout: { id: "po_1", ref: "PO-2026-1", amount: 12.34, currency: "USD" },
    receiverEmail: "seller@example.com",
    env: ENV,
  });
  assert.equal(result.batchId, "BATCH1");

  const payoutCall = calls.find((call) => call.url.endsWith("/v1/payments/payouts"));
  const payload = JSON.parse(payoutCall.options.body);
  assert.deepEqual(payload.items[0].amount, { currency: "USD", value: "12.34" });
  assert.equal(payload.items[0].receiver, "seller@example.com");
});

test("webhooks are not trusted without a configured id", async () => {
  const result = await verifyWebhook({ headers: {}, event: {}, env: {} });
  assert.deepEqual(result, { configured: false, verified: false, mode: "missing_headers" });
  assert.equal(paypalConfigured({}), false);
  assert.equal(paypalMode({ PAYPAL_ENV: "LIVE" }), "live");
});

test("the PayPal rail moves an obligation and a seller payout end to end", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remindify-paypal-"));
  process.env.REMINDIFY_DATA_DIR = dir;
  process.env.REMINDIFY_DB = join(dir, "remindify.db");
  process.env.VERCEL = "1";
  process.env.COOKIE_SECURE = "false";
  process.env.PAYPAL_ENV = "sandbox";
  process.env.PAYPAL_CLIENT_ID = "test-client";
  process.env.PAYPAL_CLIENT_SECRET = "test-secret";
  process.env.PAYPAL_WEBHOOK_ID = "WH-TEST";
  delete process.env.PAYPAL_BASE_URL;

  installPayPalMock();

  const { default: handle } = await import(`../server/index.mjs?test=${Date.now()}`);
  const server = createServer(handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const call = async (path, method = "GET", payload, cookie, extra = {}) => {
    const response = await realFetch(`${base}${path}`, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(payload ? { "content-type": "application/json" } : {}),
        ...extra,
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return { status: response.status, data: await response.json() };
  };

  try {
    const signup = await realFetch(`${base}/api/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "PayPal Test",
        email: `paypal-${Date.now()}@example.com`,
        password: "correct-horse-battery",
      }),
    });
    assert.equal(signup.status, 201);
    const cookie = signup.headers.get("set-cookie").split(";")[0];

    // --- Flow A: pay an obligation ---
    let result = await call("/api/obligations", "POST", {
      title: "PayPal invoice",
      amount: 42.5,
      currency: "USD",
    }, cookie);
    assert.equal(result.status, 201);
    const obligationId = result.data.obligation.id;

    result = await call("/api/payments/paypal/orders", "POST", { obligation_id: obligationId }, cookie);
    assert.equal(result.status, 201);
    assert.equal(result.data.mode, "sandbox");
    assert.match(result.data.approve_url, /checkoutnow/);
    const orderId = result.data.payment.order_id;
    assert.equal(result.data.payment.amount, 42.5);
    assert.equal(result.data.payment.status, "created");

    result = await call("/api/payments/paypal/capture", "POST", { order_id: orderId }, cookie);
    assert.equal(result.status, 200);
    assert.equal(result.data.payment.status, "captured");
    assert.equal(result.data.payment.capture_id, `CAP${orderId}`);
    const paid = result.data.state.obligations.find((item) => item.id === obligationId);
    assert.equal(paid.status, "done");
    assert.match(paid.last_proof, /^PayPal capture CAP/);

    // Capturing twice is a replay, not a second charge.
    result = await call("/api/payments/paypal/capture", "POST", { order_id: orderId }, cookie);
    assert.equal(result.status, 200);
    assert.equal(result.data.already_captured, true);

    // --- Flow B: pay a seller through Payouts ---
    let seller = await call("/api/seller", "PATCH", {
      payout: {
        method: "paypal",
        label: "PayPal",
        paypal_email: "seller@example.com",
      },
    }, cookie);
    assert.equal(seller.status, 200);
    assert.equal(seller.data.profile.payout.connected, true);
    assert.equal(seller.data.profile.payout.paypal_email, "seller@example.com");

    const requested = await call("/api/seller/payouts", "POST", {}, cookie);
    assert.equal(requested.status, 201);
    const payoutId = requested.data.payout.id;
    assert.match(requested.data.payout.destination, /PayPal · seller@example.com/);

    result = await call("/api/payments/paypal/payouts", "POST", { payout_id: payoutId }, cookie);
    assert.equal(result.status, 201);
    assert.equal(result.data.batch_id, "BATCH1");
    assert.equal(result.data.payment.status, "processing");

    result = await call("/api/payments/paypal/payouts/BATCH1", "GET", undefined, cookie);
    assert.equal(result.status, 200);
    assert.equal(result.data.itemStatus, "SUCCESS");
    const settled = result.data.state.seller.payouts.find((item) => item.id === payoutId);
    assert.equal(settled.status, "paid");

    // --- Webhook: signed event closes an obligation exactly once ---
    result = await call("/api/obligations", "POST", {
      title: "Webhook invoice",
      amount: 10,
      currency: "USD",
    }, cookie);
    const webhookObligation = result.data.obligation.id;

    result = await call("/api/payments/paypal/orders", "POST", {
      obligation_id: webhookObligation,
    }, cookie);
    const webhookOrder = result.data.payment.order_id;

    result = await call("/api/paypal/webhook", "POST", {
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "CAP-WEBHOOK",
        status: "COMPLETED",
        amount: { currency_code: "USD", value: "10.00" },
        supplementary_data: { related_ids: { order_id: webhookOrder } },
      },
    }, undefined, {
      "paypal-transmission-id": "sim-1",
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.sandbox.paypal.com/cert.pem",
      "paypal-transmission-sig": "signature",
      "paypal-transmission-time": new Date().toISOString(),
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.verified, true);
    assert.equal(result.data.applied, true);

    result = await call("/api/payments", "GET", undefined, cookie);
    assert.equal(result.status, 200);
    const webhookPayment = result.data.payments.find((row) => row.order_id === webhookOrder);
    assert.equal(webhookPayment.status, "captured");
    assert.equal(result.data.summary.captured_count, 2);
    assert.equal(result.data.summary.captured_total, 52.5);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    globalThis.fetch = realFetch;
    delete process.env.PAYPAL_WEBHOOK_ID;
    rmSync(dir, { recursive: true, force: true });
  }
});
