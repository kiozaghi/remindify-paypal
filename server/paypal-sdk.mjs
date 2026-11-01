// APIMatic-generated PayPal Server SDK path for the escrow primitives:
// create an authorization order, authorize it, and capture the hold.
//
// Payouts v1, Invoicing v2 and webhook verification stay on the REST client in
// paypal.mjs: the SDK generation does not cover Payouts, and the invoice flow
// needs the create-then-send chaining that is clearer as two calls.
//
// The SDK is skipped when PAYPAL_BASE_URL is set (tests point the REST client
// at a local mock) or PAYPAL_SDK=off.
import {
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  CheckoutPaymentIntent,
} from "@paypal/paypal-server-sdk";

const clients = new Map();

export class PayPalSdkError extends Error {
  constructor(message, { status = 502, code = "paypal_sdk_error", details = null } = {}) {
    super(message);
    this.name = "PayPalSdkError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function sdkEnabled(env = process.env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) return false;
  if (env.PAYPAL_BASE_URL) return false;
  return String(env.PAYPAL_SDK || "on").toLowerCase() !== "off";
}

function controllers(env) {
  const live = String(env.PAYPAL_ENV || "sandbox").toLowerCase() === "live";
  const cacheKey = `${live ? "live" : "sandbox"}:${env.PAYPAL_CLIENT_ID}`;
  let entry = clients.get(cacheKey);
  if (!entry) {
    const client = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: env.PAYPAL_CLIENT_ID,
        oAuthClientSecret: env.PAYPAL_CLIENT_SECRET,
      },
      timeout: Number(env.PAYPAL_TIMEOUT_MS) || 15_000,
      environment: live ? Environment.Production : Environment.Sandbox,
    });
    entry = { orders: new OrdersController(client), payments: new PaymentsController(client) };
    clients.set(cacheKey, entry);
  }
  return entry;
}

function wrap(error) {
  const body = error?.body || error?.result || {};
  const issue = body?.details?.[0]?.issue || body?.name || null;
  const status = Number(error?.statusCode || error?.status) || 502;
  return new PayPalSdkError(
    issue ? `PayPal returned ${issue}.` : String(body?.message || error?.message || "PayPal request failed."),
    {
      status: status >= 400 && status < 500 ? status : 502,
      code: issue || `paypal_${status}`,
      details: body?.debug_id || null,
    }
  );
}

async function run(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof PayPalSdkError) throw error;
    throw wrap(error);
  }
}

export async function sdkCreateAuthorizationOrder(
  { id, title, amount, currency = "USD", payeeEmail },
  { returnUrl, cancelUrl, env = process.env } = {}
) {
  const { orders } = controllers(env);
  const result = await run(async () => {
    const response = await orders.createOrder({
      paypalRequestId: `remindify-hold-${id}`,
      prefer: "return=representation",
      body: {
        intent: CheckoutPaymentIntent.Authorize,
        purchaseUnits: [
          {
            referenceId: String(id),
            customId: String(id),
            description: String(title || "Remindify escrow").slice(0, 127),
            amount: { currencyCode: "USD", value: Number(amount).toFixed(2) },
            payee: payeeEmail ? { emailAddress: payeeEmail } : undefined,
          },
        ],
        paymentSource: {
          paypal: {
            experienceContext: {
              brandName: "Remindify",
              userAction: "PAY_NOW",
              shippingPreference: "NO_SHIPPING",
              returnUrl,
              cancelUrl,
            },
          },
        },
      },
    });
    return response.result;
  });

  const approve = (result?.links || []).find(
    (link) => link.rel === "payer-action" || link.rel === "approve"
  );
  if (!approve?.href) {
    throw new PayPalSdkError("PayPal did not return an approval link.", { code: "no_approve_link" });
  }
  return { orderId: result.id, status: result.status, approveUrl: approve.href };
}

export async function sdkAuthorizeOrder(orderId, { env = process.env } = {}) {
  const { orders } = controllers(env);
  const result = await run(async () => {
    const response = await orders.authorizeOrder({
      id: orderId,
      paypalRequestId: `remindify-authorize-${orderId}`,
      prefer: "return=representation",
    });
    return response.result;
  });

  const authorization = result?.purchaseUnits?.[0]?.payments?.authorizations?.[0] || null;
  if (!authorization?.id) {
    throw new PayPalSdkError("PayPal approved the order but returned no authorization.", {
      code: "no_authorization",
    });
  }
  return {
    orderId: result.id || orderId,
    orderStatus: result.status,
    authorizationId: authorization.id,
    authorizationStatus: authorization.status,
    amount: Number(authorization.amount?.value || 0),
    currency: String(authorization.amount?.currencyCode || "USD").toUpperCase(),
    expiresAt: authorization.expirationTime || null,
    payerEmail: result.payer?.emailAddress || null,
    via: "sdk",
  };
}

export async function sdkCaptureAuthorization(
  authorizationId,
  { amount, currency = "USD", invoiceId, note, requestId, env = process.env } = {}
) {
  const { payments } = controllers(env);
  const result = await run(async () => {
    const response = await payments.captureAuthorizedPayment({
      authorizationId,
      paypalRequestId: requestId || `remindify-capture-auth-${authorizationId}`,
      prefer: "return=representation",
      body: {
        finalCapture: true,
        noteToPayer: String(note || "Released on verified proof.").slice(0, 255),
        ...(invoiceId ? { invoiceId: String(invoiceId).slice(0, 127) } : {}),
        ...(amount !== undefined && amount !== null
          ? { amount: { currencyCode: String(currency).toUpperCase(), value: Number(amount).toFixed(2) } }
          : {}),
      },
    });
    return response.result;
  });

  return {
    captureId: result?.id || null,
    status: result?.status || null,
    amount: Number(result?.amount?.value || amount || 0),
    currency: String(result?.amount?.currencyCode || currency).toUpperCase(),
    sellerReceivable: result?.sellerReceivableBreakdown || null,
    via: "sdk",
  };
}
