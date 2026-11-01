// Remindify Trust — proof receipts and PayPal-settled escrow.
//
// Design notes:
// - A receipt is filed the moment proof is attached and signed by the server
//   with HMAC-SHA256 over a canonical payload, so any later edit is detectable.
// - Nothing moves on an unverified artifact. The proof auditor gates the
//   release; a rejection leaves the payer's hold in place.
// - Escrow is a PayPal authorization hold. The buyer approves the amount up
//   front, the merchant captures only on verified proof, and the provider is
//   paid net of the Remindify fee.
// - A capture that cannot be followed by a payout is parked as
//   CAPTURED_AWAITING_PAYOUT rather than reported as settled.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getMeta, loadAll, put, setMeta } from "./db.mjs";
import {
  authorizeOrder,
  captureAuthorization,
  createAuthorizationOrder,
  createPayout,
  paypalConfigured,
  paypalMode,
  voidAuthorization,
} from "./paypal.mjs";
import { auditEvidence, auditThreshold } from "./audit.mjs";

const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

export const HOLD_DAYS = 29;

export function escrowFeePercent(env = process.env) {
  const raw = Number(env.PAYPAL_PLATFORM_FEE_PERCENT ?? 10);
  if (!Number.isFinite(raw) || raw < 0 || raw >= 100) return 10;
  return raw;
}

function cents(value) {
  return Math.round(Number(value) * 100);
}

export function escrowSplit(amount, env = process.env) {
  const total = cents(amount);
  const percent = escrowFeePercent(env);
  const fee = Math.round((total * percent) / 100);
  return { gross: total / 100, fee: fee / 100, net: (total - fee) / 100, percent };
}

// ---------------------------------------------------------------------------
// Receipt signatures
// ---------------------------------------------------------------------------

function receiptSecret() {
  const configured = String(process.env.TRUST_RECEIPT_SECRET || "").trim();
  if (configured) return configured;
  let secret = getMeta("receipt_secret", null);
  if (!secret) {
    secret = randomBytes(32).toString("hex");
    setMeta("receipt_secret", secret);
  }
  return secret;
}

export function canonicalPayload(receipt) {
  return JSON.stringify({
    obligation_id: receipt.obligation_id,
    actor_id: receipt.actor_id || null,
    actor_type: receipt.actor_type || "human",
    proof_hash: receipt.proof_hash,
    completed_at: receipt.completed_at,
  });
}

function sign(payload) {
  return createHmac("sha256", receiptSecret()).update(payload).digest("hex");
}

export function verifyReceiptSignature(receipt) {
  if (!receipt?.signature) return false;
  const expected = Buffer.from(sign(canonicalPayload(receipt)), "hex");
  const given = Buffer.from(String(receipt.signature), "hex");
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

function settlementPayload(receipt) {
  return JSON.stringify({
    receipt: canonicalPayload(receipt),
    audit: receipt.audit
      ? {
          verified: receipt.audit.verified,
          confidence: receipt.audit.confidence,
          engine: receipt.audit.engine,
        }
      : null,
    settlement: receipt.settlement || null,
  });
}

function shortHex(value, head = 10, tail = 6) {
  if (!value || typeof value !== "string") return "";
  if (value.length <= head + tail + 2) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function logTrustEvent(event) {
  const item = {
    id: uid("ev"),
    actor_type: "system",
    actor_id: null,
    actor: "Remindify",
    kind: "trust",
    created_at: new Date().toISOString(),
    ...event,
  };
  put("events", item);
  return item;
}

function actorFrom(input) {
  const actor = input?.actor || {};
  return {
    actor_type: actor.type || "human",
    actor_id: actor.id ?? null,
    actor: actor.name || "Solomon Tigabu",
    channel: input?.channel || actor.channel || "app",
    agent_id: actor.agent_id || input?.agent_id || null,
  };
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

export function enrichReceipt(receipt) {
  const artifact = receipt.artifact
    ? {
        name: receipt.artifact.name,
        type: receipt.artifact.type,
        text: receipt.artifact.text,
        bytes: receipt.artifact.bytes,
        ...(receipt.artifact.data
          ? { mime: receipt.artifact.mime || receipt.artifact.type, inline: true }
          : {}),
      }
    : receipt.artifact;
  return {
    ...receipt,
    artifact,
    short_hash: shortHex(receipt.proof_hash),
    short_signature: shortHex(receipt.signature, 8, 6),
    verified: receipt.status === "verified" || receipt.status === "settled",
    settled: receipt.status === "settled",
    mode: receipt.status === "settled" ? "paypal" : "recorded",
  };
}

export function createReceipt(input = {}) {
  const data = loadAll();
  const obligationId = input.obligation_id || input.obligationId;
  const ob = data.obligations.find((o) => o.id === obligationId);
  if (!ob) return { ok: false, error: "obligation_not_found" };

  const proof = String(input.proof || ob.last_proof || ob.proof_required || "Completed").slice(0, 240);
  const artifact = normaliseArtifact(input.artifact, input.note || proof);
  const agent = data.agents.find((a) => a.id === (input.agent_id || ob.agent_id));
  const who = actorFrom(input);
  const createdAt = new Date().toISOString();

  const receipt = {
    id: uid("rcpt"),
    obligation_id: ob.id,
    obligation_title: ob.title,
    obligation_amount: ob.amount || 0,
    agent_id: who.agent_id || agent?.id || null,
    agent_name: agent?.name || null,
    actor_id: who.actor_id,
    actor_type: who.actor_type,
    actor: who.actor,
    proof_label: proof,
    proof_hash: createHash("sha256").update(`${ob.id}:${artifactDigestInput(artifact)}:${createdAt}`).digest("hex"),
    artifact_hash: createHash("sha256").update(artifactDigestInput(artifact)).digest("hex"),
    artifact,
    completed_at: ob.last_completed_at || ob.completed_at || createdAt,
    status: "filed",
    audit: null,
    settlement: null,
    signature: null,
    settlement_signature: null,
    signed_at: null,
    source: input.source || "manual",
    demo: Boolean(input.demo || input.source === "demo"),
    created_at: createdAt,
  };
  receipt.signature = sign(canonicalPayload(receipt));
  receipt.signed_at = createdAt;

  put("receipts", receipt);

  if (!input.silent) {
    logTrustEvent({
      actor_type: who.actor_type,
      actor_id: who.actor_id,
      actor: who.actor,
      verb: "filed a proof receipt",
      object: ob.title,
      detail: `${artifact.name || "proof"} · ${shortHex(receipt.proof_hash)}`,
      kind: "proof",
      channel: who.channel,
    });
  }

  return { ok: true, receipt: enrichReceipt(receipt) };
}

const MAX_INLINE_CHARS = 900_000;

// Text artifacts hash their text; media artifacts hash the payload itself, so
// two different images can never share a receipt hash.
function artifactDigestInput(artifact) {
  const text = String(artifact?.text || "");
  if (text) return text;
  const data = String(artifact?.data || "");
  return data ? `inline:${artifact?.mime || artifact?.type || ""}:${data}` : "";
}

function normaliseArtifact(artifact, fallbackText) {
  if (!artifact) {
    const text = String(fallbackText || "").trim();
    return { name: "proof note", type: "text", text: text.slice(0, 4000), bytes: text.length };
  }
  if (typeof artifact === "string") {
    const text = artifact.slice(0, 4000);
    return { name: "proof note", type: "text", text, bytes: text.length };
  }
  const text = String(artifact.text || artifact.excerpt || "").slice(0, 4000);
  const data = typeof artifact.data === "string" ? artifact.data.trim().slice(0, MAX_INLINE_CHARS) : "";
  const mime = String(artifact.mime || "").trim().toLowerCase().slice(0, 60);
  const normalised = {
    name: String(artifact.name || "proof").slice(0, 160),
    type: String(artifact.type || mime || (data ? "application/octet-stream" : "text")).slice(0, 60),
    text,
    bytes: Number(artifact.bytes || (data ? Math.round(data.length * 0.75) : text.length)),
  };
  if (data) {
    normalised.data = data;
    normalised.mime = mime || normalised.type;
  }
  return normalised;
}

export function fileReceiptForCompletion({ obligation, proof, by, auto = false } = {}) {
  if (!obligation) return { ok: false, error: "obligation_required" };
  try {
    return createReceipt({
      obligation_id: obligation.id,
      proof: proof || obligation.last_proof || obligation.proof_required,
      note: auto
        ? `Filed automatically when ${by || "an agent"} completed the obligation.`
        : `Filed when ${by || "the owner"} completed the obligation.`,
      source: "completion",
      silent: true,
      demo: false,
    });
  } catch {
    return { ok: false, error: "receipt_failed" };
  }
}

/** Run the proof auditor over a filed receipt and record the verdict. */
export async function auditReceipt(input = {}) {
  const data = loadAll();
  const receipt = data.receipts.find((r) => r.id === input.id || r.id === input.receipt_id);
  if (!receipt) return { ok: false, error: "receipt_not_found" };
  if (receipt.status === "settled") return { ok: false, error: "receipt_already_settled" };

  const ob = data.obligations.find((o) => o.id === receipt.obligation_id);
  if (!ob) return { ok: false, error: "obligation_not_found" };

  const artifact = input.artifact
    ? normaliseArtifact(input.artifact, receipt.proof_label)
    : receipt.artifact;
  if (input.artifact) {
    receipt.artifact = artifact;
    receipt.artifact_hash = createHash("sha256").update(artifactDigestInput(artifact)).digest("hex");
  }

  const verdict = await auditEvidence({ obligation: ob, artifact, receipt, env: process.env });

  receipt.audit = { ...verdict, audited_at: new Date().toISOString() };
  receipt.status = verdict.verified ? "verified" : "rejected";
  receipt.signature = sign(canonicalPayload(receipt));
  put("receipts", receipt);

  logTrustEvent({
    actor_type: "system",
    actor: "Proof auditor",
    verb: verdict.verified ? "verified a proof receipt" : "rejected a proof receipt",
    object: receipt.obligation_title,
    detail: `${Math.round((verdict.confidence || 0) * 100)}% · ${verdict.engine}${
      verdict.discrepancies?.length ? ` · ${verdict.discrepancies.length} discrepancies` : ""
    }`,
    kind: "proof",
    channel: "system",
  });

  return { ok: true, verified: verdict.verified, audit: receipt.audit, receipt: enrichReceipt(receipt) };
}

// ---------------------------------------------------------------------------
// Escrows
// ---------------------------------------------------------------------------

export function enrichEscrow(escrow) {
  const split = escrowSplit(escrow.amount);
  return {
    ...escrow,
    fee_percent: escrow.platform_fee_percent ?? split.percent,
    platform_fee: escrow.platform_fee ?? split.fee,
    net_payout: escrow.net_payout ?? split.net,
    short_id: shortHex(escrow.id, 8, 4),
    hold_expires_in_days: escrow.authorization_expires_at
      ? Math.ceil((new Date(escrow.authorization_expires_at).getTime() - Date.now()) / 86_400_000)
      : null,
  };
}

export function createEscrow(input = {}) {
  const data = loadAll();
  const ob = data.obligations.find((o) => o.id === (input.obligation_id || input.obligationId));
  if (!ob) return { ok: false, error: "obligation_not_found" };

  const provider = data.providers.find(
    (p) => p.id === (input.provider_id || ob.marketplace?.provider_id)
  );
  const amount = Number(input.amount ?? provider?.price ?? ob.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "amount_required" };

  const payeeEmail = String(
    input.payee_paypal_email || provider?.paypal_email || ob.payee_paypal_email || ""
  ).trim();
  if (!payeeEmail) {
    return {
      ok: false,
      error: "payee_required",
      hint: "Add the provider's PayPal email before opening an escrow — the payout goes there.",
    };
  }

  const split = escrowSplit(amount);
  const now = new Date().toISOString();
  const escrow = {
    id: uid("esc"),
    obligation_id: ob.id,
    obligation_title: ob.title,
    provider_id: provider?.id || null,
    provider_name: provider?.name || ob.provider || null,
    provider_kind: provider?.kind || null,
    payee_paypal_email: payeeEmail,
    rail: "paypal",
    currency: "USD",
    amount: split.gross,
    platform_fee_percent: split.percent,
    platform_fee: split.fee,
    net_payout: split.net,
    status: "draft",
    paypal_order_id: null,
    approve_url: null,
    authorization_id: null,
    authorization_expires_at: null,
    capture_id: null,
    payout_batch_id: null,
    proof_receipt_id: null,
    failure_code: null,
    failure_reason: null,
    timeline: [{ at: now, status: "draft", note: "Escrow opened" }],
    note: String(input.note || "").slice(0, 240),
    created_at: now,
    hold_at: null,
    authorized_at: null,
    captured_at: null,
    released_at: null,
    voided_at: null,
  };
  put("escrows", escrow);

  if (!input.silent) {
    const who = actorFrom(input);
    logTrustEvent({
      actor_type: who.actor_type,
      actor_id: who.actor_id,
      actor: who.actor,
      verb: "opened an escrow",
      object: ob.title,
      detail: `${escrow.provider_name} · $${split.gross.toFixed(2)} · fee $${split.fee.toFixed(2)}`,
      kind: "trust",
      channel: who.channel,
    });
  }

  return { ok: true, escrow: enrichEscrow(escrow) };
}

function pushTimeline(escrow, status, note) {
  escrow.timeline = Array.isArray(escrow.timeline) ? escrow.timeline : [];
  escrow.timeline.push({ at: new Date().toISOString(), status, note });
}

/** Ask PayPal for a hold the payer can approve. */
export async function holdEscrow(input = {}) {
  const data = loadAll();
  const escrow = data.escrows.find((e) => e.id === input.id || e.id === input.escrow_id);
  if (!escrow) return { ok: false, error: "escrow_not_found" };
  if (["released", "voided"].includes(escrow.status)) return { ok: false, error: "escrow_closed" };
  if (["authorized", "captured_awaiting_payout"].includes(escrow.status)) {
    return { ok: false, error: "escrow_already_held", escrow: enrichEscrow(escrow) };
  }
  if (!paypalConfigured()) {
    return {
      ok: false,
      error: "paypal_not_configured",
      hint: "Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to place a hold.",
    };
  }

  const origin = String(input.origin || process.env.PUBLIC_ORIGIN || "").replace(/\/+$/, "");
  const order = await createAuthorizationOrder(
    {
      id: escrow.id,
      title: `Escrow: ${escrow.obligation_title}`,
      amount: escrow.amount,
      currency: escrow.currency,
      payeeEmail: escrow.payee_paypal_email,
    },
    {
      returnUrl: input.return_url || `${origin}/api/trust/escrows/paypal/return`,
      cancelUrl: input.cancel_url || `${origin}/trust?escrow=cancelled`,
    }
  );

  escrow.status = "hold_pending";
  escrow.paypal_order_id = order.orderId;
  escrow.approve_url = order.approveUrl;
  escrow.hold_at = new Date().toISOString();
  escrow.failure_code = null;
  escrow.failure_reason = null;
  pushTimeline(
    escrow,
    "hold_pending",
    `PayPal order ${order.orderId} created; $${escrow.amount.toFixed(2)} awaiting approval`
  );
  put("escrows", escrow);

  logTrustEvent({
    actor_type: "human",
    actor: "Solomon Tigabu",
    verb: "asked PayPal for an escrow hold",
    object: escrow.obligation_title,
    detail: `$${escrow.amount.toFixed(2)} · order ${order.orderId}`,
    kind: "trust",
    channel: "app",
  });

  return { ok: true, escrow: enrichEscrow(escrow), approveUrl: order.approveUrl };
}

/** Turn the payer's approval (return_url token) into an authorization hold. */
export async function authorizeEscrowHold(input = {}) {
  const data = loadAll();
  const escrow = data.escrows.find(
    (e) => (input.id && e.id === input.id) || (input.order_id && e.paypal_order_id === input.order_id)
  );
  if (!escrow) return { ok: false, error: "escrow_not_found" };
  if (escrow.status === "authorized") return { ok: true, escrow: enrichEscrow(escrow) };
  if (!escrow.paypal_order_id) return { ok: false, error: "escrow_not_held" };

  const authorization = await authorizeOrder(input.order_id || escrow.paypal_order_id);
  escrow.status = "authorized";
  escrow.authorization_id = authorization.authorizationId;
  escrow.authorization_expires_at =
    authorization.expiresAt || new Date(Date.now() + HOLD_DAYS * 86_400_000).toISOString();
  escrow.authorized_at = new Date().toISOString();
  escrow.payer_email = authorization.payerEmail || null;
  pushTimeline(escrow, "authorized", `Hold placed · ${authorization.authorizationId}`);
  put("escrows", escrow);

  logTrustEvent({
    actor_type: "human",
    actor: authorization.payerEmail || "Payer",
    verb: "authorized an escrow hold",
    object: escrow.obligation_title,
    detail: `$${escrow.amount.toFixed(2)} held for ${HOLD_DAYS} days · ${authorization.authorizationId}`,
    kind: "trust",
    channel: "paypal",
  });

  return { ok: true, escrow: enrichEscrow(escrow) };
}

/**
 * Capture and pay out. The receipt must be verified by the auditor first; a
 * capture whose payout fails is parked, never reported as settled.
 */
export async function releaseEscrow(input = {}) {
  const data = loadAll();
  const escrow = data.escrows.find((e) => e.id === input.id || e.id === input.escrow_id);
  if (!escrow) return { ok: false, error: "escrow_not_found" };
  if (escrow.status === "released") return { ok: true, escrow: enrichEscrow(escrow), replayed: true };
  if (escrow.status === "voided") return { ok: false, error: "escrow_voided" };
  if (!["authorized", "captured_awaiting_payout"].includes(escrow.status)) {
    return {
      ok: false,
      error: "escrow_not_releasable",
      hint: "Place the PayPal hold before releasing.",
    };
  }

  // Seeded escrows carry placeholder PayPal ids so the UI can show an
  // authorized hold without credentials. They can never settle for real.
  if (String(escrow.authorization_id || "").startsWith("DEMO-")) {
    return {
      ok: false,
      error: "demo_hold",
      message:
        "This is a seeded rehearsal hold with placeholder PayPal ids. Open escrow on the filing and authorize a sandbox hold to exercise capture and payout.",
      escrow: enrichEscrow(escrow),
    };
  }

  const receiptId = input.proof_receipt_id || input.receipt_id;
  const candidates = data.receipts
    .filter((r) => r.obligation_id === escrow.obligation_id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  let receipt = receiptId ? data.receipts.find((r) => r.id === receiptId) : candidates[0];

  if (!receipt) {
    return { ok: false, error: "proof_required", hint: "Attach proof for this obligation first." };
  }
  if (receipt.obligation_id !== escrow.obligation_id) {
    return {
      ok: false,
      error: "proof_wrong_obligation",
      hint: "The receipt must belong to the escrow obligation.",
    };
  }

  if (receipt.status !== "verified" && receipt.status !== "settled") {
    const audited = await auditReceipt({ receipt_id: receipt.id });
    receipt = audited.receipt || receipt;
    if (!audited.ok) return { ok: false, error: audited.error || "audit_failed", receipt };
    if (!audited.verified) {
      return {
        ok: false,
        error: "proof_rejected",
        message: "The proof auditor rejected this artifact. The PayPal hold is still in place.",
        audit: audited.audit,
        receipt,
        escrow: enrichEscrow(escrow),
      };
    }
  }

  if (!paypalConfigured()) return { ok: false, error: "paypal_not_configured" };

  const split = escrowSplit(escrow.amount);
  let captureId = escrow.capture_id;

  if (escrow.status === "authorized") {
    const capture = await captureAuthorization(escrow.authorization_id, {
      invoiceId: `RMDFY-${escrow.id}`,
      note: `Released on verified proof ${shortHex(receipt.proof_hash, 8, 4)}`,
      requestId: `remindify-capture-${escrow.id}`,
    });
    captureId = capture.captureId;
    escrow.capture_id = captureId;
    escrow.captured_at = new Date().toISOString();
    pushTimeline(escrow, "captured", `$${split.gross.toFixed(2)} captured · ${captureId}`);
  }

  try {
    const payout = await createPayout({
      payout: { id: `rmdfy_${escrow.id}`, amount: split.net, ref: escrow.obligation_id },
      receiverEmail: escrow.payee_paypal_email,
    });
    escrow.payout_batch_id = payout.batchId;
    escrow.payout_status = payout.status;
    escrow.platform_fee = split.fee;
    escrow.net_payout = split.net;
    escrow.proof_receipt_id = receipt.id;
    escrow.status = "released";
    escrow.released_at = new Date().toISOString();
    escrow.failure_code = null;
    escrow.failure_reason = null;
    pushTimeline(
      escrow,
      "released",
      `$${split.net.toFixed(2)} paid to ${escrow.payee_paypal_email} · ${payout.batchId}`
    );
  } catch (error) {
    escrow.status = "captured_awaiting_payout";
    escrow.proof_receipt_id = receipt.id;
    escrow.failure_code = error?.code || "payout_failed";
    escrow.failure_reason = String(error?.message || error).slice(0, 240);
    pushTimeline(
      escrow,
      "captured_awaiting_payout",
      `Captured ${captureId}; payout failed: ${escrow.failure_reason}`
    );
    put("escrows", escrow);
    logTrustEvent({
      actor_type: "system",
      actor: "Remindify",
      verb: "captured an escrow but could not pay out",
      object: escrow.obligation_title,
      detail: `$${split.net.toFixed(2)} owed to ${escrow.payee_paypal_email} · ${escrow.failure_reason}`,
      kind: "trust",
      channel: "system",
    });
    return {
      ok: false,
      error: "payout_failed",
      message:
        "The hold was captured, but the payout was refused. The balance is parked and can be retried.",
      escrow: enrichEscrow(escrow),
      receipt,
    };
  }

  put("escrows", escrow);

  receipt.status = "settled";
  receipt.settlement = {
    escrow_id: escrow.id,
    capture_id: captureId || null,
    payout_batch_id: escrow.payout_batch_id,
    gross: split.gross,
    fee: split.fee,
    net: split.net,
    recipient: escrow.payee_paypal_email,
    at: escrow.released_at,
  };
  receipt.settlement_signature = sign(settlementPayload(receipt));
  put("receipts", receipt);

  logTrustEvent({
    actor_type: "human",
    actor: "Solomon Tigabu",
    verb: "released an escrow on verified proof",
    object: escrow.obligation_title,
    detail: `$${split.net.toFixed(2)} to ${escrow.payee_paypal_email} · fee $${split.fee.toFixed(2)} · ${escrow.payout_batch_id}`,
    kind: "trust",
    channel: "app",
  });

  return { ok: true, escrow: enrichEscrow(escrow), receipt: enrichReceipt(receipt) };
}

/** Release the hold back to the payer. */
export async function voidEscrow(input = {}) {
  const data = loadAll();
  const escrow = data.escrows.find((e) => e.id === input.id || e.id === input.escrow_id);
  if (!escrow) return { ok: false, error: "escrow_not_found" };
  if (escrow.status === "released") return { ok: false, error: "escrow_already_released" };
  if (escrow.status === "captured_awaiting_payout") {
    return {
      ok: false,
      error: "escrow_already_captured",
      hint: "The hold was captured; retry the payout instead of voiding.",
    };
  }

  if (escrow.authorization_id) {
    const result = await voidAuthorization(escrow.authorization_id);
    if (result.status === "FAILED") {
      escrow.failure_code = result.code || "void_failed";
      escrow.failure_reason = "PayPal refused to void this hold.";
      put("escrows", escrow);
      return { ok: false, error: "void_failed", escrow: enrichEscrow(escrow) };
    }
  }

  escrow.status = "voided";
  escrow.voided_at = new Date().toISOString();
  pushTimeline(
    escrow,
    "voided",
    escrow.authorization_id ? "Hold released back to the payer" : "Escrow closed before a hold"
  );
  put("escrows", escrow);

  logTrustEvent({
    actor_type: "human",
    actor: "Solomon Tigabu",
    verb: "voided an escrow hold",
    object: escrow.obligation_title,
    detail: `$${escrow.amount.toFixed(2)} returned to the payer`,
    kind: "trust",
    channel: "app",
  });

  return { ok: true, escrow: enrichEscrow(escrow) };
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export function trustSnapshot(data = loadAll()) {
  const receipts = (data.receipts || [])
    .map(enrichReceipt)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const escrows = (data.escrows || [])
    .map(enrichEscrow)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const stats = {
    receipts: receipts.length,
    filed: receipts.filter((r) => r.status === "filed").length,
    verified: receipts.filter((r) => r.status === "verified").length,
    rejected: receipts.filter((r) => r.status === "rejected").length,
    settled: receipts.filter((r) => r.status === "settled").length,
    escrows: escrows.length,
    open_escrows: escrows.filter((e) => ["draft", "hold_pending", "authorized"].includes(e.status)).length,
    released_escrows: escrows.filter((e) => e.status === "released").length,
    escrow_value: escrows
      .filter((e) => ["hold_pending", "authorized"].includes(e.status))
      .reduce((sum, e) => sum + (e.amount || 0), 0),
    released_value: escrows
      .filter((e) => e.status === "released")
      .reduce((sum, e) => sum + (e.amount || 0), 0),
    fees_collected: escrows
      .filter((e) => e.status === "released")
      .reduce((sum, e) => sum + (e.platform_fee || 0), 0),
  };

  return {
    rail: {
      key: "paypal",
      label: "PayPal",
      mode: paypalMode(),
      configured: paypalConfigured(),
      hold_days: HOLD_DAYS,
      fee_percent: escrowFeePercent(),
      auditor: String(process.env.AI_MODEL_ID || "gemini-2.5-flash"),
      auditor_configured: Boolean(process.env.GEMINI_API_KEY),
      threshold: Math.round(auditThreshold() * 100),
    },
    receipts,
    escrows,
    stats,
    guardrails: {
      proof_before_money: true,
      note: "A hold is captured only after the proof auditor verifies the artifact. A rejected artifact leaves the payer's money in place.",
      disclosure:
        "Remindify never holds a card or a private key. PayPal holds and payouts settle between the payer, the merchant account and the provider.",
    },
  };
}

export function trustSummary(data = loadAll()) {
  const snapshot = trustSnapshot(data);
  return { rail: snapshot.rail, stats: snapshot.stats, guardrails: snapshot.guardrails };
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

export function ensureTrustDemo() {
  if (getMeta("trust_demo", false)) return false;
  const data = loadAll();
  if ((data.receipts || []).length) return false;
  const ob = data.obligations.find((o) => o.id === "ob_domain") || data.obligations[0];
  if (!ob) return false;

  createReceipt({
    obligation_id: ob.id,
    proof: ob.id === "ob_domain" ? "domain_renewal_receipt_2026.pdf" : `${ob.id}_proof_2026.pdf`,
    note: "Sample receipt. Attach proof to any completed obligation to file your own.",
    source: "demo",
    demo: true,
    silent: true,
  });
  setMeta("trust_demo", true);
  return true;
}
