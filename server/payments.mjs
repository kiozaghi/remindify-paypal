// Payment ledger.
//
// One row per provider attempt, keyed so a retried capture or a replayed
// webhook can never double-count. Obligation payments and seller payouts share
// the collection; `kind` separates them.
//
// Statuses:
//   obligation: created -> captured | failed | superseded
//   payout:     processing -> paid | failed
import { randomUUID } from "node:crypto";
import { loadAll, put } from "./db.mjs";

export const PAYMENT_KINDS = ["obligation", "payout"];

function nowIso(now) {
  return new Date(now).toISOString();
}

function newId(prefix = "pay") {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function listPayments(data = loadAll()) {
  return [...(data.payments || [])].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

export function findPayment(data, { orderId, obligationId, captureId, batchId } = {}) {
  const rows = data.payments || [];
  if (orderId) return rows.find((row) => row.order_id === orderId) || null;
  if (captureId) return rows.find((row) => row.capture_id === captureId) || null;
  if (batchId) return rows.find((row) => row.batch_id === batchId) || null;
  if (obligationId) {
    return rows
      .filter((row) => row.obligation_id === obligationId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
  }
  return null;
}

export function beginObligationPayment({ obligation, orderId, amount, currency, now = Date.now() }) {
  const data = loadAll();
  const stamp = nowIso(now);

  for (const row of data.payments || []) {
    if (row.obligation_id === obligation.id && row.status === "created") {
      put("payments", { ...row, status: "superseded", updated_at: stamp });
    }
  }

  const payment = {
    id: newId("pay"),
    kind: "obligation",
    rail: "paypal",
    status: "created",
    amount: Number(amount),
    currency: String(currency || "USD").toUpperCase(),
    obligation_id: obligation.id,
    obligation_title: obligation.title || "",
    order_id: orderId,
    capture_id: null,
    payer_email: null,
    provider_status: null,
    failure_code: null,
    failure_reason: null,
    created_at: stamp,
    updated_at: stamp,
  };
  put("payments", payment);
  return payment;
}

export function markCaptured({
  orderId, captureId, amount, currency, payerEmail, providerStatus = "COMPLETED", now = Date.now(),
}) {
  const data = loadAll();
  const existing = findPayment(data, { orderId });
  if (!existing) return null;
  if (existing.status === "captured") return existing;

  const next = {
    ...existing,
    status: "captured",
    capture_id: captureId,
    payer_email: payerEmail || existing.payer_email,
    provider_status: providerStatus,
    amount: Number(amount ?? existing.amount),
    currency: String(currency || existing.currency).toUpperCase(),
    failure_reason: null,
    updated_at: nowIso(now),
  };
  put("payments", next);
  return next;
}

export function markFailed({
  orderId, reason, providerStatus = "FAILED", failureCode = null, now = Date.now(),
}) {
  const data = loadAll();
  const existing = findPayment(data, { orderId });
  if (!existing || existing.status === "captured") return existing;
  const next = {
    ...existing,
    status: "failed",
    provider_status: providerStatus,
    failure_code: failureCode,
    failure_reason: String(reason || "PayPal did not complete the payment.").slice(0, 240),
    updated_at: nowIso(now),
  };
  put("payments", next);
  return next;
}

// PayPal expires an unused order after a few hours. A row left in `created`
// would otherwise claim "awaiting payer" forever and stale out the ledger.
export function expireStalePayments({ maxAgeMs = 3 * 3600000, now = Date.now() } = {}) {
  let expired = 0;
  for (const row of loadAll().payments || []) {
    if (row.kind !== "obligation" || row.status !== "created") continue;
    if (now - new Date(row.created_at).getTime() < maxAgeMs) continue;
    put("payments", {
      ...row,
      status: "expired",
      provider_status: "ORDER_EXPIRED",
      failure_code: "ORDER_EXPIRED",
      failure_reason:
        "The payer never finished checkout, so PayPal expired this order. Start a fresh payment from the obligation.",
      updated_at: nowIso(now),
    });
    expired += 1;
  }
  return expired;
}

export function recordPayout({ payout, batchId, status = "processing", receiver, now = Date.now() }) {
  const data = loadAll();
  const existing = (data.payments || []).find(
    (row) => row.kind === "payout" && row.payout_id === payout.id
  );
  const stamp = nowIso(now);

  const next = {
    id: existing?.id || newId("pay"),
    kind: "payout",
    rail: "paypal",
    status,
    amount: Number(payout.amount),
    currency: String(payout.currency || "USD").toUpperCase(),
    payout_id: payout.id,
    payout_ref: payout.ref || payout.id,
    batch_id: batchId || existing?.batch_id || null,
    receiver: receiver || existing?.receiver || null,
    provider_status: status,
    created_at: existing?.created_at || stamp,
    updated_at: stamp,
  };
  put("payments", next);
  return next;
}

export function markPayoutStatus({ batchId, status, now = Date.now() }) {
  const data = loadAll();
  const existing = findPayment(data, { batchId });
  if (!existing) return null;
  const next = { ...existing, status, provider_status: status, updated_at: nowIso(now) };
  put("payments", next);
  return next;
}

export function paymentsSummary(data = loadAll()) {
  const rows = data.payments || [];
  const captured = rows.filter((row) => row.status === "captured");
  return {
    captured_count: captured.length,
    captured_total: Math.round(captured.reduce((sum, row) => sum + Number(row.amount || 0), 0) * 100) / 100,
    payouts_sent: rows.filter((row) => row.kind === "payout" && row.status !== "failed").length,
    failed: rows.filter((row) => row.status === "failed").length,
  };
}
