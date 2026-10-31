// PayPal payment rail.
//
// Two flows, both sandbox-first:
//   - Obligations: Orders v2 (create -> payer approves -> capture)
//   - Seller payouts: Payouts v1 (batch -> item status)
//
// This module only talks to PayPal. It never custodies funds, never stores a
// card, and never trusts a client-supplied amount: the caller passes the stored
// obligation or payout and the amounts are rebuilt here.
//
// Config (all optional except the credentials):
//   PAYPAL_ENV=sandbox|live
//   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET
//   PAYPAL_BASE_URL            override, used by tests
//   PAYPAL_WEBHOOK_ID          required to verify webhooks
//   PAYPAL_TIMEOUT_MS          default 15000

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const LIVE_BASE = "https://api-m.paypal.com";

const MIN_PAYOUT = 0.01;
const MAX_PAYMENT = 10000;

export class PayPalError extends Error {
  constructor(message, { status = 502, code = "paypal_error", details = null } = {}) {
    super(message);
    this.name = "PayPalError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function paypalConfigured(env = process.env) {
  return Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
}

export function paypalBase(env = process.env) {
  if (env.PAYPAL_BASE_URL) return String(env.PAYPAL_BASE_URL).replace(/\/+$/, "");
  return String(env.PAYPAL_ENV || "sandbox").toLowerCase() === "live" ? LIVE_BASE : SANDBOX_BASE;
}

export function paypalMode(env = process.env) {
  return String(env.PAYPAL_ENV || "sandbox").toLowerCase() === "live" ? "live" : "sandbox";
}

const tokenCache = new Map();

export async function accessToken(env = process.env) {
  if (!paypalConfigured(env)) {
    throw new PayPalError("PayPal is not configured on this server.", {
      status: 503,
      code: "paypal_not_configured",
    });
  }

  const base = paypalBase(env);
  const cacheKey = `${base}:${env.PAYPAL_CLIENT_ID}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  let response;
  try {
    response = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(Number(env.PAYPAL_TIMEOUT_MS) || 15000),
    });
  } catch (error) {
    throw new PayPalError("PayPal could not be reached.", {
      status: 502,
      code: "paypal_unreachable",
      details: String(error?.message || error),
    });
  }

  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.access_token) {
    throw new PayPalError("PayPal rejected the credentials.", {
      status: 502,
      code: json.error || "paypal_auth_failed",
      details: json.error_description || null,
    });
  }

  const ttl = Number(json.expires_in) || 300;
  tokenCache.set(cacheKey, {
    token: json.access_token,
    expiresAt: Date.now() + ttl * 1000,
  });
  return json.access_token;
}

async function api(path, { method = "GET", payload, env = process.env, requestId } = {}) {
  const token = await accessToken(env);
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "Remindify-PayPal/1",
  };
  if (requestId) headers["paypal-request-id"] = requestId;

  let response;
  try {
    response = await fetch(`${paypalBase(env)}${path}`, {
      method,
      headers,
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(Number(env.PAYPAL_TIMEOUT_MS) || 15000),
    });
  } catch (error) {
    throw new PayPalError("PayPal could not be reached.", {
      status: 502,
      code: "paypal_unreachable",
      details: String(error?.message || error),
    });
  }

  const text = await response.text();
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 300) };
    }
  }

  if (!response.ok) {
    throw new PayPalError(json.message || `PayPal returned ${response.status}.`, {
      status: 502,
      code: json.name || `paypal_${response.status}`,
      details: json.details || json.debug_id || null,
    });
  }
  return json;
}

function cents(value) {
  return Math.round(Number(value) * 100);
}

/** Rebuild the amount from the stored obligation, never from the request. */
export function payableAmount(obligation) {
  const amount = Number(obligation?.amount || 0);
  const currency = String(obligation?.currency || "USD").toUpperCase();

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PayPalError("This obligation has no amount to pay.", {
      status: 422,
      code: "nothing_to_pay",
    });
  }
  if (currency !== "USD") {
    throw new PayPalError(`PayPal supports USD here; this obligation is ${currency}.`, {
      status: 422,
      code: "currency_unsupported",
    });
  }
  if (amount > MAX_PAYMENT) {
    throw new PayPalError(`PayPal is limited to $${MAX_PAYMENT} per payment in this build.`, {
      status: 422,
      code: "amount_too_large",
    });
  }
  return { currency, value: amount.toFixed(2) };
}

export async function createOrder(obligation, { returnUrl, cancelUrl, env = process.env } = {}) {
  const amount = payableAmount(obligation);
  const json = await api("/v2/checkout/orders", {
    method: "POST",
    env,
    requestId: `remindify-order-${obligation.id}-${Date.now()}`,
    payload: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: obligation.id,
          custom_id: obligation.id,
          invoice_id: `RM-${String(obligation.id).slice(0, 12)}-${Date.now()}`,
          description: String(obligation.title || "Remindify obligation").slice(0, 127),
          amount,
        },
      ],
      application_context: {
        brand_name: "Remindify",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    },
  });

  const approve = (json.links || []).find(
    (link) => link.rel === "approve" || link.rel === "payer-action"
  );
  if (!approve?.href) {
    throw new PayPalError("PayPal did not return an approval link.", {
      status: 502,
      code: "no_approve_link",
    });
  }
  return { orderId: json.id, status: json.status, approveUrl: approve.href };
}

export async function getOrder(orderId, { env = process.env } = {}) {
  const json = await api(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { env });
  return json;
}

/** Normalise a GET order response into the same shape captureOrder returns. */
export function orderCapture(order, expected) {
  const capture = order?.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture?.id) return null;

  const amount = capture.amount || {};
  if (expected && cents(amount.value) !== cents(expected.value)) {
    throw new PayPalError("The captured amount did not match the obligation.", {
      status: 409,
      code: "amount_mismatch",
      details: { expected: expected.value, captured: amount.value },
    });
  }

  return {
    orderId: order.id,
    orderStatus: order.status,
    captureId: capture.id,
    captureStatus: capture.status,
    amount: Number(amount.value),
    currency: String(amount.currency_code || "").toUpperCase(),
    payerEmail: order.payer?.email_address || null,
    payerName: order.payer?.name?.given_name || null,
  };
}

export async function captureOrder(orderId, expected, { env = process.env } = {}) {
  if (!orderId) {
    throw new PayPalError("Missing PayPal order id.", { status: 422, code: "order_required" });
  }

  const json = await api(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    env,
    requestId: `remindify-capture-${orderId}`,
    payload: {},
  });

  const capture = json.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture?.id) {
    throw new PayPalError("PayPal did not return a capture for this order.", {
      status: 502,
      code: "no_capture",
    });
  }

  const amount = capture.amount || {};
  if (expected && cents(amount.value) !== cents(expected.value)) {
    throw new PayPalError("The captured amount did not match the obligation.", {
      status: 409,
      code: "amount_mismatch",
      details: { expected: expected.value, captured: amount.value },
    });
  }
  if (expected && String(amount.currency_code).toUpperCase() !== expected.currency) {
    throw new PayPalError("The captured currency did not match the obligation.", {
      status: 409,
      code: "currency_mismatch",
      details: { expected: expected.currency, captured: amount.currency_code },
    });
  }

  return {
    orderId: json.id,
    orderStatus: json.status,
    captureId: capture.id,
    captureStatus: capture.status,
    amount: Number(amount.value),
    currency: String(amount.currency_code || "").toUpperCase(),
    payerEmail: json.payer?.email_address || null,
    payerName: json.payer?.name?.given_name || null,
  };
}

export async function createPayout({ payout, receiverEmail, env = process.env } = {}) {
  const amount = Number(payout?.amount || 0);
  if (!receiverEmail) {
    throw new PayPalError("Add a PayPal email before requesting a payout.", {
      status: 422,
      code: "receiver_required",
    });
  }
  if (!Number.isFinite(amount) || amount < MIN_PAYOUT) {
    throw new PayPalError("This payout has no amount to send.", {
      status: 422,
      code: "nothing_to_pay_out",
    });
  }
  if (!payout?.id) {
    throw new PayPalError("Missing payout id.", { status: 422, code: "payout_required" });
  }

  const json = await api("/v1/payments/payouts", {
    method: "POST",
    env,
    requestId: `remindify-payout-${payout.id}`,
    payload: {
      sender_batch_header: {
        sender_batch_id: payout.id,
        email_subject: "Your Remindify payout",
        email_message: `Payout ${payout.ref || payout.id} for completed work on Remindify.`,
      },
      items: [
        {
          recipient_type: "EMAIL",
          receiver: receiverEmail,
          amount: { currency: "USD", value: amount.toFixed(2) },
          note: `${payout.ref || payout.id} · Remindify`,
          sender_item_id: payout.id,
        },
      ],
    },
  });

  return {
    batchId: json.batch_header?.payout_batch_id || null,
    status: json.batch_header?.batch_status || null,
    receiver: receiverEmail,
  };
}

export async function payoutBatch(batchId, { env = process.env } = {}) {
  const json = await api(`/v1/payments/payouts/${encodeURIComponent(batchId)}`, { env });
  const item = json.items?.[0];
  return {
    batchId: json.batch_header?.payout_batch_id || batchId,
    status: json.batch_header?.batch_status || null,
    itemStatus: item?.transaction_status || null,
    errors: json.batch_header?.errors || null,
  };
}

/** PayPal asks the receiver to verify the transmission before trusting it. */
export async function verifyWebhook({ headers, event, env = process.env } = {}) {
  const webhookId = env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return { configured: false, verified: false };

  const header = (name) => {
    const value = headers?.[name] ?? headers?.[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  const json = await api("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    env,
    payload: {
      auth_algo: header("paypal-auth-algo"),
      cert_url: header("paypal-cert-url"),
      transmission_id: header("paypal-transmission-id"),
      transmission_sig: header("paypal-transmission-sig"),
      transmission_time: header("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    },
  });

  return { configured: true, verified: json.verification_status === "SUCCESS" };
}
