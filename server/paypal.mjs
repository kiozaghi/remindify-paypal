// PayPal payment rail.
//
// Four flows, all sandbox-first:
//   - Obligations: Orders v2 (create -> payer approves -> capture)
//   - Escrow: Orders v2 with intent=AUTHORIZE -> capture or void the hold
//   - Seller payouts: Payouts v1 (batch -> item status)
//   - Invoicing: Invoicing v2 (draft -> send -> remind)
//
// This module only talks to PayPal. It never custodies funds, never stores a
// card, and never trusts a client-supplied amount: the caller passes the stored
// obligation, escrow or payout and the amounts are rebuilt here.
//
// Config (all optional except the credentials):
//   PAYPAL_ENV=sandbox|live
//   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET
//   PAYPAL_BASE_URL            override, used by tests
//   PAYPAL_WEBHOOK_ID          required to verify webhooks
//   PAYPAL_TIMEOUT_MS          default 15000

import {
  sdkAuthorizeOrder, sdkCaptureAuthorization, sdkCreateAuthorizationOrder, sdkEnabled,
} from "./paypal-sdk.mjs";

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
    const issue = firstIssue(json);
    throw new PayPalError(explain(issue, json), {
      // 4xx is the caller's problem (a declined card, an unapproved order);
      // 5xx and transport failures are ours to report as an upstream fault.
      status: response.status >= 400 && response.status < 500 ? response.status : 502,
      code: issue || json.name || `paypal_${response.status}`,
      details: json.details || json.debug_id || null,
    });
  }
  return json;
}

function firstIssue(json) {
  const details = Array.isArray(json?.details) ? json.details : [];
  const withIssue = details.find((detail) => detail?.issue);
  if (withIssue?.issue) return String(withIssue.issue);
  return json?.details?.issue ? String(json.details.issue) : null;
}

// PayPal speaks in issue codes. A payer should never see ORDER_NOT_APPROVED.
const ISSUE_COPY = {
  INSTRUMENT_DECLINED:
    "PayPal declined the payer's card or funding source. Nothing was charged — try a different card or the PayPal balance.",
  PAYER_ACTION_REQUIRED:
    "The payer still has a step to finish on PayPal. Reopen the approval link to complete it.",
  ORDER_NOT_APPROVED:
    "The payer has not approved this order yet. Reopen the PayPal approval link and finish checkout.",
  ORDER_ALREADY_CAPTURED:
    "This order was already captured. Refresh and the capture reference will be read back from PayPal.",
  ORDER_EXPIRED:
    "This PayPal order expired before it was captured. Start a fresh payment from the obligation.",
  TRANSACTION_REFUSED:
    "PayPal refused the transaction. Nothing was charged.",
  PAYMENT_DENIED:
    "PayPal denied the payment. Nothing was charged.",
  CURRENCY_MISMATCH:
    "The payer's funding source cannot settle in this currency.",
  INVALID_CURRENCY_CODE:
    "PayPal does not accept this currency for the account.",
  COMPLIANCE_VIOLATION:
    "PayPal blocked this payment for a compliance reason.",
  RISK_DECLINED:
    "PayPal's risk checks declined this payment. Nothing was charged.",
};

function explain(issue, json) {
  if (issue && ISSUE_COPY[issue]) return ISSUE_COPY[issue];
  const detail = Array.isArray(json?.details)
    ? json.details.find((entry) => entry?.description)?.description
    : json?.details?.description;
  return detail || json?.message || `PayPal returned ${json?.name || "an error"}.`;
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
          // Orders v2 calls this currency_code; only the Payouts API uses `currency`,
          // so `amount` cannot be passed through unchanged.
          amount: { currency_code: amount.currency, value: amount.value },
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

// ---------------------------------------------------------------------------
// Escrow: authorization holds
// ---------------------------------------------------------------------------

/**
 * A hold is an order the payer approves but the merchant does not capture.
 * PayPal keeps the authorization open for 29 days, which is the window in
 * which proof has to arrive.
 */
export async function createAuthorizationOrder(
  { id, title, amount, currency = "USD", payeeEmail },
  { returnUrl, cancelUrl, env = process.env } = {}
) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value <= 0) {
    throw new PayPalError("This escrow has no amount to hold.", { status: 422, code: "nothing_to_hold" });
  }
  if (String(currency).toUpperCase() !== "USD") {
    throw new PayPalError("PayPal holds are USD in this build.", { status: 422, code: "currency_unsupported" });
  }
  if (value > MAX_PAYMENT) {
    throw new PayPalError(`PayPal is limited to $${MAX_PAYMENT} per hold in this build.`, {
      status: 422,
      code: "amount_too_large",
    });
  }

  if (sdkEnabled(env)) {
    try {
      return await sdkCreateAuthorizationOrder(
        { id, title, amount: value, currency, payeeEmail },
        { returnUrl, cancelUrl, env }
      );
    } catch (error) {
      throw toPayPalError(error);
    }
  }

  const json = await api("/v2/checkout/orders", {
    method: "POST",
    env,
    requestId: `remindify-hold-${id}`,
    payload: {
      intent: "AUTHORIZE",
      purchase_units: [
        {
          reference_id: String(id),
          custom_id: String(id),
          description: String(title || "Remindify escrow").slice(0, 127),
          amount: { currency_code: "USD", value: value.toFixed(2) },
          payee: payeeEmail ? { email_address: payeeEmail } : undefined,
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Remindify",
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
    },
  });

  const approve = (json.links || []).find((link) => link.rel === "payer-action" || link.rel === "approve");
  if (!approve?.href) {
    throw new PayPalError("PayPal did not return an approval link.", {
      status: 502,
      code: "no_approve_link",
    });
  }
  return { orderId: json.id, status: json.status, approveUrl: approve.href };
}

function toPayPalError(error) {
  if (error instanceof PayPalError) return error;
  return new PayPalError(error?.message || "PayPal request failed.", {
    status: error?.status || 502,
    code: error?.code || "paypal_error",
    details: error?.details || null,
  });
}

/** Turn an approved order into a hold. No money moves yet. */
export async function authorizeOrder(orderId, { env = process.env } = {}) {
  if (sdkEnabled(env)) {
    try {
      return await sdkAuthorizeOrder(orderId, { env });
    } catch (error) {
      throw toPayPalError(error);
    }
  }

  const json = await api(`/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {
    method: "POST",
    env,
    requestId: `remindify-authorize-${orderId}`,
    payload: {},
  });
  const authorization =
    json.purchase_units?.[0]?.payments?.authorizations?.[0] || json.authorization || null;
  if (!authorization?.id) {
    throw new PayPalError("PayPal approved the order but returned no authorization.", {
      status: 502,
      code: "no_authorization",
    });
  }
  return {
    orderId: json.id,
    orderStatus: json.status,
    authorizationId: authorization.id,
    authorizationStatus: authorization.status,
    amount: Number(authorization.amount?.value || json.purchase_units?.[0]?.amount?.value || 0),
    currency: String(authorization.amount?.currency_code || "USD").toUpperCase(),
    expiresAt: authorization.expiration_time || null,
    payerEmail: json.payer?.email_address || null,
  };
}

/** Capture a held authorization, in full or in part. */
export async function captureAuthorization(
  authorizationId,
  { amount, currency = "USD", invoiceId, note, requestId, env = process.env } = {}
) {
  if (!authorizationId) {
    throw new PayPalError("Missing authorization id.", { status: 422, code: "authorization_required" });
  }

  if (sdkEnabled(env)) {
    try {
      return await sdkCaptureAuthorization(authorizationId, {
        amount, currency, invoiceId, note, requestId, env,
      });
    } catch (error) {
      throw toPayPalError(error);
    }
  }

  const payload = {
    final_capture: true,
    note_to_payer: String(note || "Released on verified proof.").slice(0, 255),
  };
  if (invoiceId) payload.invoice_id = String(invoiceId).slice(0, 127);
  if (amount !== undefined && amount !== null) {
    payload.amount = { value: Number(amount).toFixed(2), currency_code: String(currency).toUpperCase() };
  }

  const json = await api(`/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`, {
    method: "POST",
    env,
    requestId: requestId || `remindify-capture-auth-${authorizationId}`,
    payload,
  });
  return {
    captureId: json.id || null,
    status: json.status || null,
    amount: Number(json.amount?.value || amount || 0),
    currency: String(json.amount?.currency_code || currency).toUpperCase(),
    sellerReceivable: json.seller_receivable_breakdown || null,
  };
}

/** Release an uncaptured hold back to the payer. */
export async function voidAuthorization(authorizationId, { env = process.env } = {}) {
  if (!authorizationId) {
    throw new PayPalError("Missing authorization id.", { status: 422, code: "authorization_required" });
  }
  try {
    await api(`/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`, {
      method: "POST",
      env,
      requestId: `remindify-void-${authorizationId}`,
      payload: {},
    });
    return { status: "VOIDED" };
  } catch (error) {
    // A capture that already settled cannot be voided; the caller has to pay
    // the provider instead of unwinding.
    if (error instanceof PayPalError && /ALREADY_CAPTURED|AUTHORIZATION_EXPIRED/.test(String(error.code))) {
      return { status: "FAILED", code: error.code };
    }
    throw error;
  }
}

export async function getAuthorization(authorizationId, { env = process.env } = {}) {
  return api(`/v2/payments/authorizations/${encodeURIComponent(authorizationId)}`, { env });
}

// ---------------------------------------------------------------------------
// Invoicing
// ---------------------------------------------------------------------------

/**
 * Create and immediately send an invoice. A draft invoice is invisible to the
 * payer and cannot be reminded, so sending is part of the same step.
 */
export async function createAndSendInvoice(
  { id, title, amount, currency = "USD", recipientEmail, note, dueDays = 7 },
  { env = process.env } = {}
) {
  if (!recipientEmail) {
    throw new PayPalError("An invoice needs a payer email.", { status: 422, code: "recipient_required" });
  }
  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value <= 0) {
    throw new PayPalError("An invoice needs an amount.", { status: 422, code: "nothing_to_invoice" });
  }
  const due = new Date(Date.now() + Math.max(1, dueDays) * 86_400_000).toISOString().slice(0, 10);

  const created = await api("/v2/invoicing/invoices", {
    method: "POST",
    env,
    requestId: `remindify-invoice-${id}`,
    payload: {
      detail: {
        currency_code: String(currency).toUpperCase(),
        note: String(note || "Remindify obligation").slice(0, 1000),
        terms_and_conditions: "Payable on receipt.",
      },
      invoicer: { name: { given_name: "Remindify" } },
      primary_recipients: [
        {
          billing_info: {
            email_address: recipientEmail,
            name: { given_name: String(recipientEmail).split("@")[0] },
          },
        },
      ],
      items: [
        {
          name: String(title || "Obligation").slice(0, 100),
          quantity: "1",
          unit_amount: { currency_code: String(currency).toUpperCase(), value: value.toFixed(2) },
        },
      ],
      payment_term: { due_date: due },
    },
  });

  const invoiceId = created.id || (created.href || "").split("/").pop();
  if (!invoiceId) {
    throw new PayPalError("PayPal did not return an invoice id.", { status: 502, code: "no_invoice" });
  }
  await api(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`, {
    method: "POST",
    env,
    requestId: `remindify-invoice-send-${invoiceId}`,
    payload: { send_to_recipient: true, send_to_invoicer: false },
  });

  const invoice = await api(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`, { env });
  const payerView = (invoice.links || []).find((link) => link.rel === "payer-view");
  return {
    invoiceId,
    status: invoice.status || "SENT",
    payerViewUrl: payerView?.href || null,
    dueDate: due,
    amount: value,
  };
}

/** PayPal allows two reminders a day per invoice, and none for a draft. */
export async function remindInvoice(invoiceId, { env = process.env } = {}) {
  const invoice = await api(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`, { env });
  if (invoice.status === "DRAFT") {
    throw new PayPalError("A draft invoice cannot be reminded — send it first.", {
      status: 409,
      code: "CANT_REMIND_INVOICE_IN_DRAFT_STATE",
    });
  }
  await api(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/remind`, {
    method: "POST",
    env,
    requestId: `remindify-invoice-remind-${invoiceId}-${Date.now()}`,
    payload: { subject: "Reminder: invoice due", note: "This obligation is past due." },
  });
  return { invoiceId, status: invoice.status, reminded: true };
}

/**
 * PayPal asks the receiver to verify the transmission before trusting it.
 * The Developer Dashboard's Webhook Simulator signs with a throwaway cert, so
 * postback verification answers FAILURE for those events. When
 * PAYPAL_ALLOW_WEBHOOK_SIMULATOR=true and every transmission header is present,
 * the event is accepted and tagged so the audit trail says which mode ran.
 */
export async function verifyWebhook({ headers, event, env = process.env } = {}) {
  const header = (name) => {
    const value = headers?.[name] ?? headers?.[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  const transmissionId = header("paypal-transmission-id");
  const webhookId = env.PAYPAL_WEBHOOK_ID;
  if (!transmissionId) return { configured: Boolean(webhookId), verified: false, mode: "missing_headers" };

  if (webhookId && paypalConfigured(env)) {
    try {
      const json = await api("/v1/notifications/verify-webhook-signature", {
        method: "POST",
        env,
        payload: {
          auth_algo: header("paypal-auth-algo"),
          cert_url: header("paypal-cert-url"),
          transmission_id: transmissionId,
          transmission_sig: header("paypal-transmission-sig"),
          transmission_time: header("paypal-transmission-time"),
          webhook_id: webhookId,
          webhook_event: event,
        },
      });
      if (json.verification_status === "SUCCESS") {
        return { configured: true, verified: true, mode: "paypal_rsa_sha256" };
      }
    } catch {
      // Fall through to the simulator check; a sandbox outage must not make
      // the endpoint answer 502 for a simulator event.
    }
  }

  const simulator = String(env.PAYPAL_ALLOW_WEBHOOK_SIMULATOR || "").toLowerCase() === "true";
  const complete = ["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-sig", "paypal-transmission-time"]
    .every((name) => Boolean(header(name)));
  if (simulator && complete) {
    return { configured: true, verified: true, mode: "sandbox_simulator" };
  }
  return { configured: Boolean(webhookId), verified: false, mode: "verification_failed" };
}
