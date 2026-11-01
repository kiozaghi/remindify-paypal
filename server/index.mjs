import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  buildState, completeObligation, sweep, applyApproval, snoozeObligation,
  runObligation, advanceClock, deleteObligation, logEvent, uid, virtualNow,
  riskFor, enrichObligation, drainOutbox, effectiveAutonomy, reclaimObligation,
} from "./engine.mjs";
import {
  loadAll, put, putMany, getMeta, setMeta, seedDatabase, pruneAuth,
  beginRequest, runWithStore, endRequest, abortRequest, isPostgres, findKeyBySecret,
  workspacesWithKind,
} from "./db.mjs";
import { parseCapture, parseCaptureAI } from "./parse.mjs";
import {
  auditReceipt, authorizeEscrowHold, createEscrow, createReceipt, ensureTrustDemo,
  holdEscrow, releaseEscrow, trustSnapshot, verifyReceiptSignature, voidEscrow,
} from "./trust.mjs";
import { handleAuthRoute, handleAccountDelete, getSessionFromRequest } from "./auth.mjs";
import { emailConfigured } from "./email.mjs";
import {
  sendDailyDigest, subscribeByToken, unsubscribeByToken, unsubscribePage,
} from "./digest.mjs";
import { pruneActivity } from "./retention.mjs";
import { setWorkspace, runWithWorkspace } from "./workspace.mjs";
import { digestSecret, publicKey, KEY_SCOPES, keyExpired } from "./keys.mjs";
import {
  DEMO_EXECUTOR_PATH, LEGACY_EXECUTOR_PATH, newExecutorSecret, signExecutorRequest, validateExecutorUrl,
} from "./executors.mjs";
import { takeRateLimit } from "./ratelimit.mjs";
import { REGION_BLOCKED_MESSAGE, regionBlocked } from "./jurisdiction.mjs";
import {
  billingSummary, canSwitchPlans, keyLimitReached, meterApiCall, PLANS, setPlan,
} from "./billing.mjs";
import {
  acceptBooking, confirmPayoutReceived, declineBooking, requestPayout,
  startBooking, submitBookingProof, updateSellerProfile,
} from "./seller.mjs";
import {
  PayPalError, captureOrder, createOrder, createPayout, getOrder, orderCapture,
  payableAmount, paypalConfigured, paypalMode, payoutBatch, verifyWebhook,
} from "./paypal.mjs";
import { remindObligationInvoice, sendObligationInvoice } from "./invoices.mjs";
import {
  beginObligationPayment, findPayment, listPayments, markCaptured, markFailed,
  markPayoutStatus, paymentsSummary, recordPayout,
} from "./payments.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");
const PORT = process.env.PORT || 4178;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
};

// Baseline headers for every response, API and static. HSTS is only added
// behind TLS so local development is never pinned.
function applySecurityHeaders(req, res) {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("content-security-policy", "frame-ancestors 'none'");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  if (proto === "https" || req.socket?.encrypted) {
    res.setHeader("strict-transport-security", "max-age=15552000; includeSubDomains");
  }
}

function send(res, status, payload, type = "application/json; charset=utf-8") {
  const headers = {
    "content-type": type,
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  };
  const cookies = res.getHeader("Set-Cookie");
  if (cookies) headers["set-cookie"] = cookies;
  res.writeHead(status, headers);
  if (typeof payload === "string" || Buffer.isBuffer(payload)) return res.end(payload);
  return res.end(JSON.stringify(payload));
}

async function body(req) {
  if (req.parsedBody !== undefined) return req.parsedBody;
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error("Body too large");
  }
  req.rawBody = raw;
  if (!raw) return (req.parsedBody = {});
  try {
    return (req.parsedBody = JSON.parse(raw));
  } catch {
    throw new Error("Invalid JSON");
  }
}

// Public origin for PayPal return/cancel links. Vercel terminates TLS and
// forwards the original protocol and host.
function publicOrigin(req) {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN.replace(/\/$/, "");
  const forwarded = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = forwarded
    || (req.socket?.encrypted || process.env.NODE_ENV === "production" ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function paypalFailure(res, error) {
  if (error instanceof PayPalError) {
    return send(res, error.status || 502, {
      error: error.code,
      message: error.message,
      details: error.details ?? null,
      state: buildState(),
    });
  }
  console.error("PayPal error:", error);
  return send(res, 502, {
    error: "paypal_error",
    message: "PayPal did not complete that request.",
    state: buildState(),
  });
}

/**
 * Webhook update, scoped to whichever workspace owns the payment row.
 * Returns true when a row was found and updated.
 */
function applyPaypalEvent(event) {
  const type = String(event?.event_type || "");
  const resource = event?.resource || {};
  const data = loadAll();
  const stamp = Date.now();

  if (type === "PAYMENT.CAPTURE.COMPLETED" || type === "PAYMENT.CAPTURE.DENIED"
    || type === "PAYMENT.CAPTURE.REVERSED" || type === "CHECKOUT.ORDER.VOIDED") {
    const orderId = resource?.supplementary_data?.related_ids?.order_id
      || resource?.id
      || null;
    const row = orderId ? findPayment(data, { orderId }) : null;
    if (!row) return false;

    if (type === "PAYMENT.CAPTURE.COMPLETED") {
      markCaptured({
        orderId: row.order_id,
        captureId: resource.id || row.capture_id,
        amount: Number(resource.amount?.value ?? row.amount),
        currency: resource.amount?.currency_code || row.currency,
        payerEmail: resource.payer?.email_address || row.payer_email,
        providerStatus: resource.status || "COMPLETED",
        now: stamp,
      });
      const obligation = data.obligations.find((item) => item.id === row.obligation_id);
      if (obligation && ["active", "waiting"].includes(obligation.status)) {
        completeObligation(obligation.id, {
          proof: `PayPal capture ${resource.id || row.capture_id || "confirmed"}`,
          note: `Settled $${Number(resource.amount?.value ?? row.amount).toFixed(2)} USD via PayPal.`,
          by: "PayPal",
        });
      }
    } else {
      markFailed({ orderId: row.order_id, reason: `${type} received from PayPal.`, now: stamp });
    }
    return true;
  }

  if (type.startsWith("PAYMENT.PAYOUTS-ITEM.")) {
    const batchId = resource?.payout_batch_id
      || resource?.batch_header?.payout_batch_id
      || null;
    const row = batchId ? findPayment(data, { batchId }) : null;
    if (!row) return false;

    const succeeded = type === "PAYMENT.PAYOUTS-ITEM.SUCCEEDED";
    const status = succeeded ? "paid" : "failed";
    markPayoutStatus({ batchId, status, now: stamp });

    const payout = (data.payouts || []).find((item) => item.id === row.payout_id);
    if (payout && succeeded) {
      confirmPayoutReceived(payout.id, stamp);
    } else if (payout && payout.status === "processing") {
      put("payouts", { ...payout, status: "failed", note: `${type} received from PayPal.` });
    }
    return true;
  }

  return false;
}

function clampAutonomyToCeiling(ob) {
  if (!ob.agent_id) return ob;
  const agent = loadAll().agents.find((a) => a.id === ob.agent_id);
  if (agent) ob.autonomy = effectiveAutonomy(ob, agent);
  return ob;
}

// The account name resolved for this workspace. Provisioning writes it to meta
// on signup, so every human action can be attributed to whoever is signed in.
function humanActor() {
  return getMeta("user", "Operator");
}

const PAYPAL_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function paypalEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email || email.length > 254 || !PAYPAL_EMAIL_RE.test(email)) return null;
  return email;
}

function normalizeObligation(input) {
  const parsed = input.due_at ? new Date(input.due_at) : null;
  const due = parsed && !Number.isNaN(parsed.getTime())
    ? parsed
    : new Date(virtualNow() + 14 * 86400000);
  return {
    id: input.id && !String(input.id).startsWith("draft_") ? input.id : uid("ob"),
    title: String(input.title || "Untitled obligation").slice(0, 140),
    category: input.category || "other",
    provider: input.provider || "Unassigned",
    owner: input.owner || humanActor(),
    owner_kind: input.owner_kind || "human",
    agent_id: input.agent_id || null,
    backup: input.backup || "",
    amount: Number(input.amount) || 0,
    penalty: Number(input.penalty) || 0,
    currency: input.currency || "USD",
    due_at: due.toISOString(),
    recurrence: input.recurrence || null,
    status: input.status || "active",
    autonomy: ["notify", "prepare", "approve", "autopilot"].includes(input.autonomy)
      ? input.autonomy
      : "prepare",
    severity: Math.min(5, Math.max(1, Number(input.severity) || 3)),
    confidence: Math.min(1, Math.max(0.4, Number(input.confidence) || 0.8)),
    proof_required: input.proof_required || "Confirmation",
    consequence: input.consequence || "It slips through the cracks.",
    notes: input.notes || "",
    source: input.source || "manual",
    channel: input.channel || "app",
    grace_days: Number(input.grace_days) || 0,
    checklist: Array.isArray(input.checklist) ? input.checklist : [],
    evidence: input.evidence || null,
    marketplace: input.marketplace || null,
    payee_paypal_email: paypalEmail(input.payee_paypal_email),
    payer_paypal_email: paypalEmail(input.payer_paypal_email),
    created_at: input.created_at || new Date().toISOString(),
  };
}

// A machine key identifies its workspace, so resolve both together. The lookup
// scans every workspace because the workspace is unknown until the secret
// matches.
function keyFromRequest(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return findKeyBySecret(header.slice(7).trim());
}

function keyHasScope(key, scope) {
  return Array.isArray(key.scopes) && key.scopes.includes(scope);
}

function scopeDenied(res, scope) {
  return send(res, 403, {
    error: "missing_scope",
    scope,
    message: `This key does not carry ${scope}.`,
  });
}

const IDEMPOTENCY_TTL = 24 * 3600 * 1000;

function idempotencySlot(key, header) {
  return `idem:${key.id}:${digestSecret(header)}`;
}

// Reads the body once and decides whether this call is a first attempt or a
// replay, before any side effect runs. A repeated key with the same body gets
// the stored response; a different body is a conflict.
async function idempotencyGuard(req, key) {
  const header = String(req.headers["idempotency-key"] || "").trim().slice(0, 200);
  const input = await body(req);
  if (!header) return { key, header: "", input, hash: "", replay: null, conflict: false };
  const hash = digestSecret(req.rawBody || "");
  const record = getMeta(idempotencySlot(key, header), null);
  const fresh = record && Date.now() - new Date(record.at).getTime() <= IDEMPOTENCY_TTL;
  if (!fresh) return { key, header, input, hash, replay: null, conflict: false };
  return { key, header, input, hash, replay: record, conflict: record.hash !== hash };
}

function replayIdempotent(res, pending) {
  if (pending.conflict) {
    send(res, 409, {
      error: "idempotency_conflict",
      message: "That Idempotency-Key was already used with a different body.",
    });
    return true;
  }
  if (pending.replay) {
    res.setHeader("idempotent-replay", "true");
    send(res, pending.replay.status, pending.replay.payload);
    return true;
  }
  return false;
}

function rememberIdempotent(pending, status, payload) {
  if (!pending.header) return;
  setMeta(idempotencySlot(pending.key, pending.header), {
    hash: pending.hash,
    status,
    payload,
    at: new Date().toISOString(),
  });
}

function machineObligations() {
  const state = buildState();
  return state.obligations
    .filter((o) => o.status === "active" || o.status === "waiting")
    .map((o) => ({
      id: o.id,
      title: o.title,
      category: o.category,
      provider: o.provider,
      due_at: o.due_at,
      recurrence: o.recurrence,
      owner: o.owner,
      owner_kind: o.owner_kind,
      autonomy: o.autonomy,
      status: o.status,
      amount: o.amount,
      risk: o.risk,
      proof_required: o.proof_required,
      consequence: o.consequence,
      proof_url: `/api/v1/obligations/${o.id}/proof`,
    }));
}

async function handleRequest(req, res) {
  applySecurityHeaders(req, res);
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  if (req.method === "OPTIONS") return send(res, 204, "");

  try {
    // ---------- Authentication ----------
    if (await handleAuthRoute(req, res, url, { send, body })) return;

    // ---------- Machine-native API (agent first) ----------
    if (path.startsWith("/api/v1/")) {
      const resolved = keyFromRequest(req);
      if (!resolved) {
        return send(res, 401, {
          error: "unauthorized",
          hint: "Pass a Remindify key: Authorization: Bearer rfy_live_...",
        });
      }
      setWorkspace(resolved.workspace_id);
      seedDatabase();
      ensureTrustDemo();
      const key = resolved.key;
      if (keyExpired(key)) {
        return send(res, 401, {
          error: "key_expired",
          message: "This key expired. Rotate it in Agent access.",
        });
      }
      const burst = takeRateLimit(key.id);
      res.setHeader("x-ratelimit-limit", String(burst.limit));
      res.setHeader("x-ratelimit-remaining", String(burst.remaining));
      if (!burst.allowed) {
        res.setHeader("retry-after", String(burst.retry_after));
        return send(res, 429, {
          error: "rate_limited",
          limit: burst.limit,
          retry_after: burst.retry_after,
          message: `Too many requests: ${burst.limit} per minute for this key.`,
        });
      }
      const meter = meterApiCall();
      if (!meter.allowed) {
        return send(res, 429, {
          error: "plan_limit",
          plan: meter.plan.name,
          period: meter.period,
          limit: meter.limit,
          message: `The ${meter.plan.name} plan includes ${meter.limit} machine calls per month.`,
        });
      }
      const usedAt = new Date().toISOString();
      put("keys", { ...key, last_used: usedAt });
      key.last_used = usedAt;
      const state = buildState();

      if (path === "/api/v1/obligations" && req.method === "GET") {
        if (!keyHasScope(key, "obligations:read")) return scopeDenied(res, "obligations:read");
        logEvent({
          actor_type: "automation", actor: key.name, actor_id: key.id,
          verb: "read obligations", object: "API", detail: "GET /v1/obligations",
          kind: "api", channel: "api",
        });
        return send(res, 200, {
          count: machineObligations().length,
          clock: state.now,
          obligations: machineObligations(),
        });
      }

      if (path === "/api/v1/obligations" && req.method === "POST") {
        if (!keyHasScope(key, "obligations:write")) return scopeDenied(res, "obligations:write");
        const pending = await idempotencyGuard(req, key);
        if (replayIdempotent(res, pending)) return;
        const input = pending.input;
        if (!input.title) return send(res, 422, { error: "title_required" });
        const ob = normalizeObligation({ ...input, source: "api", channel: "api" });
        clampAutonomyToCeiling(ob);
        put("obligations", ob);
        logEvent({
          actor_type: "automation", actor: key.name, actor_id: key.id,
          verb: "created an obligation via API", object: ob.title,
          detail: input.due_at ? `Due ${new Date(ob.due_at).toDateString()}` : "Due in 14 days",
          kind: "api", channel: "api",
        });
        const payload = { obligation: enrichObligation(ob, virtualNow()) };
        rememberIdempotent(pending, 201, payload);
        return send(res, 201, payload);
      }

      const completeMatch = path.match(/^\/api\/v1\/obligations\/([^/]+)\/complete$/);
      if (completeMatch && req.method === "POST") {
        if (!keyHasScope(key, "obligations:write")) return scopeDenied(res, "obligations:write");
        const pending = await idempotencyGuard(req, key);
        if (replayIdempotent(res, pending)) return;
        const input = pending.input;
        const result = completeObligation(completeMatch[1], {
          proof: input.proof || "Completed via API",
          note: input.note || "",
          by: `Agent · ${key.name}`,
          auto: true,
        });
        if (!result.ok) return send(res, 404, result);
        logEvent({
          actor_type: "automation", actor: key.name, actor_id: key.id,
          verb: "completed via API", object: result.obligation.title,
          detail: input.proof || "Proof filed", kind: "api", channel: "api",
        });
        rememberIdempotent(pending, 200, result);
        return send(res, 200, result);
      }

      const patchMatch = path.match(/^\/api\/v1\/obligations\/([^/]+)$/);
      if (patchMatch && req.method === "GET") {
        if (!keyHasScope(key, "obligations:read")) return scopeDenied(res, "obligations:read");
        const ob = buildState().obligations.find((o) => o.id === patchMatch[1]);
        if (!ob) return send(res, 404, { error: "not_found" });
        return send(res, 200, { obligation: ob });
      }

      if (path === "/api/v1/risk" && req.method === "GET") {
        if (!keyHasScope(key, "risk:read")) return scopeDenied(res, "risk:read");
        const obs = state.obligations.filter((o) => o.status === "active");
        logEvent({
          actor_type: "automation", actor: key.name, actor_id: key.id,
          verb: "read portfolio risk", object: "Risk engine",
          detail: "GET /v1/risk · coverage, exposure, top risks",
          kind: "api", channel: "api",
        });
        return send(res, 200, {
          clock: state.now,
          coverage: state.stats.coverage,
          exposure_usd: state.stats.exposure,
          counts: {
            critical: state.stats.critical,
            high: state.stats.high,
            pending_approvals: state.stats.pending_approvals,
          },
          top_risks: obs
            .filter((o) => o.risk.band === "critical" || o.risk.band === "high")
            .sort((a, b) => b.risk.score - a.risk.score)
            .slice(0, 8)
            .map((o) => ({ id: o.id, title: o.title, risk: o.risk, penalty: o.penalty })),
        });
      }

      if (path === "/api/v1/trust" && req.method === "GET") {
        if (!keyHasScope(key, "risk:read")) return scopeDenied(res, "risk:read");
        const trust = trustSnapshot();
        logEvent({
          actor_type: "automation", actor: key.name, actor_id: key.id,
          verb: "read the trust layer", object: "Proof receipts",
          detail: "GET /v1/trust · receipts, escrows and settlement state",
          kind: "api", channel: "api",
        });
        return send(res, 200, {
          rail: trust.rail,
          receipts: trust.receipts,
          escrows: trust.escrows,
          stats: trust.stats,
          guardrails: trust.guardrails,
        });
      }

      if (path === "/api/v1/trust/receipts" && req.method === "POST") {
        if (!keyHasScope(key, "obligations:write")) return scopeDenied(res, "obligations:write");
        const pending = await idempotencyGuard(req, key);
        if (replayIdempotent(res, pending)) return;
        const input = pending.input;
        if (!input.obligation_id) return send(res, 422, { error: "obligation_id_required" });
        const result = createReceipt({
          ...input,
          source: "api",
          actor: { type: "automation", id: key.id, name: key.name },
          channel: "api",
        });
        if (!result.ok) return send(res, 422, result);
        const payload = { receipt: result.receipt };
        rememberIdempotent(pending, 201, payload);
        return send(res, 201, payload);
      }

      if (path === "/api/v1/agents" && req.method === "GET") {
        if (!keyHasScope(key, "agents:read")) return scopeDenied(res, "agents:read");
        logEvent({
          actor_type: "automation", actor: key.name, actor_id: key.id,
          verb: "read the agent roster", object: "The bench",
          detail: "GET /v1/agents · scopes and ceilings",
          kind: "api", channel: "api",
        });
        return send(res, 200, {
          agents: state.agents.map((a) => ({
            id: a.id, name: a.name, role: a.role, status: a.status,
            autonomy_ceiling: a.autonomy_ceiling, spend_ceiling: a.spend_ceiling ?? null, trust: a.trust,
            capabilities: a.capabilities, scopes: a.scopes, runs_30d: a.runs_30d,
          })),
        });
      }

      return send(res, 404, { error: "not_found", path });
    }

    // ---------- App API ----------
    if (path === "/api/health") return send(res, 200, { ok: true, now: new Date().toISOString() });

    // Serverless deployments have no background timer, so a scheduler calls
    // this with the shared secret. It is the only app path that skips sessions.
    // Vercel Cron sends GET; other schedulers may POST. Both carry the secret,
    // so neither relies on a cookie.
    const cronCall = req.method === "GET" || req.method === "POST";
    if (path === "/api/cron/outbox" && cronCall) {
      if (!process.env.OUTBOX_SECRET) return send(res, 404, { error: "not_found", path });
      const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
      if (!outboxSecretMatches(given)) return send(res, 401, { error: "unauthorized" });
      const result = await sweepOutbox();
      return send(res, 200, { ok: true, ...result });
    }

    if (path === "/api/cron/sweep" && cronCall) {
      if (!process.env.CRON_SECRET && !process.env.OUTBOX_SECRET) {
        return send(res, 404, { error: "not_found", path });
      }
      const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
      if (!cronSecretMatches(given)) return send(res, 401, { error: "unauthorized" });
      const result = await sweepAllWorkspaces();
      return send(res, 200, { ok: true, ...result });
    }

    // Digest links are signed per recipient and work without a session, so a
    // mailbox can opt out from the email itself and undo it from the page.
    const digestPrefMatch = path.match(/^\/api\/digest\/(unsubscribe|subscribe)$/);
    if (digestPrefMatch && req.method === "GET") {
      const token = new URL(req.url, "http://localhost").searchParams.get("token") || "";
      const result = digestPrefMatch[1] === "subscribe"
        ? subscribeByToken(token)
        : unsubscribeByToken(token);
      const resubscribeUrl = result.ok && !result.enabled
        ? `/api/digest/subscribe?token=${encodeURIComponent(token)}`
        : null;
      res.writeHead(result.ok ? 200 : 400, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(unsubscribePage(result, { resubscribeUrl }));
      return;
    }

    // PayPal calls this directly; there is no session. Relays are retried, so
    // the handler is idempotent and only applies events whose signature PayPal
    // confirms. Without PAYPAL_WEBHOOK_ID the event is acknowledged but not
    // applied, so a forged call cannot move money or close an obligation.
    if (path === "/api/paypal/webhook" && req.method === "POST") {
      if (!paypalConfigured()) return send(res, 404, { error: "not_found", path });
      const event = await body(req);
      let verification;
      try {
        verification = await verifyWebhook({ headers: req.headers, event });
      } catch (error) {
        console.error("PayPal webhook verification failed:", error?.message || error);
        return send(res, 502, { error: "verification_unavailable" });
      }
      if (!verification.verified) {
        if (!verification.configured) {
          return send(res, 202, { ok: true, verified: false, applied: false });
        }
        return send(res, 400, { error: "invalid_signature" });
      }

      let applied = false;
      for (const workspaceId of workspacesWithKind("payments")) {
        if (runWithWorkspace(workspaceId, () => applyPaypalEvent(event))) {
          applied = true;
          runWithWorkspace(workspaceId, () => logEvent({
            actor: "PayPal",
            kind: "payment",
            verb: "delivered a webhook",
            object: String(event?.event_type || "event"),
            detail: `Signature verified (${verification.mode || "paypal_rsa_sha256"}).`,
          }));
          break;
        }
      }
      return send(res, 200, { ok: true, verified: true, mode: verification.mode, applied });
    }

    // Seeded agents point their connector at this route. It accepts the same
    // signed envelope as any external executor, scoped to the workspace in the
    // payload, so the demo exercises the real execution path rather than
    // pretending. It acknowledges the run and files sandbox proof; it never
    // moves money. Users can still connect their own https executor instead.
    if ((path === DEMO_EXECUTOR_PATH || path === LEGACY_EXECUTOR_PATH) && req.method === "POST") {
      const event = await body(req);
      const workspaceId = String(event?.workspace?.id || "").slice(0, 80);
      const agentId = String(event?.agent?.id || "").slice(0, 80);
      if (!workspaceId || !agentId) {
        return send(res, 422, { error: "bad_executor_payload" });
      }

      const verdict = runWithWorkspace(workspaceId, () => {
        const agent = loadAll().agents.find((item) => item.id === agentId);
        const builtIn = agent?.executor_url === DEMO_EXECUTOR_PATH || agent?.executor_url === LEGACY_EXECUTOR_PATH;
        if (!agent || !builtIn) {
          return { status: 404, body: { error: "unknown_executor" } };
        }
        const issuedAt = Number(req.headers["x-remindify-timestamp"] || 0);
        if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > 5 * 60_000) {
          return { status: 401, body: { error: "stale_signature" } };
        }
        const expected = `sha256=${signExecutorRequest(agent.executor_secret, issuedAt, req.rawBody || "")}`;
        if (!secretMatches(String(req.headers["x-remindify-signature"] || ""), expected)) {
          return { status: 401, body: { error: "invalid_signature" } };
        }
        const runId = String(event.run_id || "run").slice(0, 80);
        return {
          status: 200,
          body: {
            ok: true,
            sandbox: true,
            proof: `sandbox_executor_${runId}`,
            executed_at: new Date().toISOString(),
            note: "Sandbox connector acknowledged the run. No funds moved.",
          },
        };
      });
      return send(res, verdict.status, verdict.body);
    }

    // Everything below this line is the signed-in workspace. The machine API
    // above keeps its own Bearer-key auth; auth routes and health stay public.
    if (path.startsWith("/api/")) {
      const session = getSessionFromRequest(req);
      if (!session) {
        return send(res, 401, {
          error: "unauthorized",
          message: "Sign in to open your workspace.",
        });
      }
      setWorkspace(session.workspace_id);
      seedDatabase();
      ensureTrustDemo();
      req.auth = session;
    }

    if (path === "/api/state" && req.method === "GET") return send(res, 200, { state: buildState() });

    if (path === "/api/capture" && req.method === "POST") {
      const { text } = await body(req);
      if (!text || text.trim().length < 4) return send(res, 422, { error: "Paste a little more text." });
      const now = Date.now();
      const parsed = (await parseCaptureAI(text, now)) || parseCapture(text, now);
      return send(res, 200, parsed);
    }

    if (path === "/api/obligations" && req.method === "POST") {
      const input = normalizeObligation(await body(req));
      clampAutonomyToCeiling(input);
      put("obligations", input);
      logEvent({
        actor_type: "human", actor: humanActor(),
        verb: "created an obligation", object: input.title,
        detail: `${input.source} · ${input.autonomy}`, kind: "human",
      });
      return send(res, 201, { state: buildState(), obligation: input });
    }

    if (path === "/api/obligations/bulk" && req.method === "POST") {
      const { items } = await body(req);
      if (!Array.isArray(items) || !items.length) return send(res, 422, { error: "No items." });
      const created = items.slice(0, 20).map(normalizeObligation);
      putMany("obligations", created);
      logEvent({
        actor_type: "agent", actor: "Remy", actor_id: null,
        verb: "scheduled obligations from a document",
        object: `${created.length} new obligations`,
        detail: `Parsed locally · ${created.map((c) => c.title).slice(0, 2).join(" · ")}`,
        kind: "draft",
      });
      return send(res, 201, { state: buildState(), created: created.length });
    }

    const obMatch = path.match(/^\/api\/obligations\/([^/]+)$/);
    if (obMatch && req.method === "PATCH") {
      const patch = await body(req);
      const data = loadAll();
      const ob = data.obligations.find((o) => o.id === obMatch[1]);
      if (!ob) return send(res, 404, { error: "not_found" });
      const allowed = [
        "title", "category", "provider", "owner", "owner_kind", "agent_id", "backup",
        "amount", "penalty", "due_at", "recurrence", "status", "autonomy", "severity",
        "confidence", "proof_required", "consequence", "notes", "grace_days",
        "checklist", "last_note",
      ];
      for (const key of allowed) if (key in patch) ob[key] = patch[key];
      clampAutonomyToCeiling(ob);
      put("obligations", ob);
      if ("autonomy" in patch) {
        logEvent({
          actor_type: "human", actor: humanActor(), verb: "changed autonomy",
          object: ob.title, detail: `Now ${patch.autonomy}`, kind: "human",
        });
      }
      return send(res, 200, { state: buildState(), obligation: ob });
    }

    const completeMatch = path.match(/^\/api\/obligations\/([^/]+)\/complete$/);
    if (completeMatch && req.method === "POST") {
      const input = await body(req);
      const result = completeObligation(completeMatch[1], input);
      if (!result.ok) return send(res, 404, { ...result, state: buildState() });
      return send(res, 200, { ...result, state: buildState() });
    }

    const snoozeMatch = path.match(/^\/api\/obligations\/([^/]+)\/snooze$/);
    if (snoozeMatch && req.method === "POST") {
      const { days } = await body(req);
      const result = snoozeObligation(snoozeMatch[1], Number(days) || 3);
      return send(res, result.ok ? 200 : 404, { ...result, state: buildState() });
    }

    const runMatch = path.match(/^\/api\/obligations\/([^/]+)\/run$/);
    if (runMatch && req.method === "POST") {
      const result = await runObligation(runMatch[1]);
      return send(res, result.ok ? 200 : 400, { ...result, state: buildState() });
    }

    const reclaimMatch = path.match(/^\/api\/obligations\/([^/]+)\/reclaim$/);
    if (reclaimMatch && req.method === "POST") {
      const result = reclaimObligation(reclaimMatch[1], humanActor());
      return send(res, result.ok ? 200 : 409, { ...result, state: buildState() });
    }

    if (obMatch && req.method === "DELETE") {
      deleteObligation(obMatch[1]);
      return send(res, 200, { state: buildState() });
    }

    const approvalMatch = path.match(/^\/api\/approvals\/([^/]+)\/decide$/);
    if (approvalMatch && req.method === "POST") {
      const { decision, note } = await body(req);
      if (!["approve", "deny"].includes(decision)) return send(res, 422, { error: "bad_decision" });
      const result = await applyApproval(approvalMatch[1], decision, note || "");
      return send(res, result.ok ? 200 : 404, { ...result, state: buildState() });
    }

    if (path === "/api/agents" && req.method === "POST") {
      const input = await body(req);
      if (!input.name) return send(res, 422, { error: "name_required" });
      const agent = {
        id: uid("ag"),
        name: String(input.name).slice(0, 40),
        handle: String(input.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24),
        role: input.role || "Custom agent",
        initials: String(input.name).slice(0, 2).toUpperCase(),
        tone: input.tone || "violet",
        description: input.description || "A custom agent built inside Remindify.",
        capabilities: input.capabilities || ["execute"],
        autonomy_ceiling: input.autonomy_ceiling || "approve",
        spend_ceiling: Number(input.spend_ceiling) > 0 ? Number(input.spend_ceiling) : null,
        trust: 80,
        cost_per_run: 0,
        status: "active",
        scopes: input.scopes || ["obligations:read"],
        last_active: new Date().toISOString(),
        created_at: new Date().toISOString(),
        custom: true,
      };
      put("agents", agent);
      logEvent({
        actor_type: "human", actor: humanActor(), verb: "created an agent",
        object: agent.name, detail: `${agent.role} · ceiling ${agent.autonomy_ceiling}`,
        kind: "human",
      });
      const state = buildState();
      return send(res, 201, { state, agent: state.agents.find((a) => a.id === agent.id) });
    }

    const agentMatch = path.match(/^\/api\/agents\/([^/]+)$/);
    if (agentMatch && req.method === "PATCH") {
      const patch = await body(req);
      const data = loadAll();
      const agent = data.agents.find((a) => a.id === agentMatch[1]);
      if (!agent) return send(res, 404, { error: "not_found" });
      for (const key of ["name", "role", "description", "autonomy_ceiling", "status", "capabilities", "scopes"]) {
        if (key in patch) agent[key] = patch[key];
      }
      if ("spend_ceiling" in patch) {
        const value = Number(patch.spend_ceiling);
        agent.spend_ceiling = Number.isFinite(value) && value > 0 ? value : null;
      }
      put("agents", agent);
      const state = buildState();
      return send(res, 200, { state, agent: state.agents.find((a) => a.id === agent.id) });
    }

    const executorMatch = path.match(/^\/api\/agents\/([^/]+)\/executor$/);
    if (executorMatch && req.method === "POST") {
      const { url } = await body(req);
      const data = loadAll();
      const agent = data.agents.find((a) => a.id === executorMatch[1]);
      if (!agent) return send(res, 404, { error: "not_found" });

      if (url === null || url === undefined || url === "") {
        delete agent.executor_url;
        delete agent.executor_secret;
        put("agents", agent);
        logEvent({
          actor_type: "human", actor: humanActor(), verb: "disconnected an executor",
          object: agent.name, detail: "The agent can draft and request approval, but not act.",
          kind: "human",
        });
        const state = buildState();
        return send(res, 200, { state, agent: state.agents.find((a) => a.id === agent.id) });
      }

      if (String(url).startsWith("/")) {
        return send(res, 422, {
          error: "invalid_executor",
          message: "Connect your own https endpoint. The built-in sandbox executor is reserved for the seeded demo agents.",
        });
      }
      const check = await validateExecutorUrl(url);
      if (!check.ok) {
        return send(res, 422, { error: "invalid_executor", message: check.error });
      }
      const secret = newExecutorSecret();
      agent.executor_url = check.url;
      agent.executor_secret = secret;
      put("agents", agent);
      let host = "connector";
      try {
        host = new URL(check.url).host;
      } catch {}
      logEvent({
        actor_type: "human", actor: humanActor(), verb: "connected an executor",
        object: agent.name, detail: `${host} · signed requests`,
        kind: "human",
      });
      const state = buildState();
      return send(res, 200, {
        state,
        agent: state.agents.find((a) => a.id === agent.id),
        signing_secret: secret,
      });
    }

    if (path === "/api/hire" && req.method === "POST") {
      const { provider_id, obligation_id, title, note, due_at } = await body(req);
      const state0 = buildState();
      const provider = state0.providers.find((p) => p.id === provider_id);
      if (!provider) return send(res, 404, { error: "provider_not_found" });
      const ob = state0.obligations.find((o) => o.id === obligation_id);
      if (ob) {
        const data = loadAll();
        const stored = data.obligations.find((o) => o.id === ob.id);
        stored.marketplace = {
          provider_id,
          provider_name: provider.name,
          kind: provider.kind,
          price: provider.price,
          status: "booked",
          booked_at: new Date().toISOString(),
        };
        stored.backup = provider.name;
        put("obligations", stored);
        logEvent({
          actor_type: "human", actor: humanActor(),
          verb: `booked ${provider.kind === "agent" ? "an agent" : "a specialist"}`,
          object: ob.title, detail: `${provider.name} · $${provider.price} · SLA ${provider.sla}`,
          kind: "human",
        });
      } else if (title) {
        const created = normalizeObligation({
          title, provider: provider.name, owner: provider.name, owner_kind: "team",
          backup: "Solomon Tigabu", amount: provider.price, source: "marketplace",
          due_at,
          autonomy: provider.kind === "agent" ? "approve" : "notify",
          marketplace: {
            provider_id, provider_name: provider.name, kind: provider.kind,
            price: provider.price, status: "booked", booked_at: new Date().toISOString(),
          },
        });
        put("obligations", created);
        logEvent({
          actor_type: "human", actor: humanActor(),
          verb: "created a job from the marketplace", object: title,
          detail: `${provider.name} · $${provider.price}`,
          kind: "human",
        });
      } else {
        return send(res, 422, { error: "obligation_required" });
      }
      return send(res, 200, { state: buildState(), provider });
    }

    if (path === "/api/keys" && req.method === "POST") {
      const { name, scopes, expires_in_days } = await body(req);
      const billing = billingSummary();
      if (keyLimitReached(loadAll().keys.length)) {
        return send(res, 402, {
          error: "plan_limit",
          plan: billing.plan_name,
          limit: billing.key_limit,
          message: `The ${billing.plan_name} plan includes ${billing.key_limit} agent keys.`,
        });
      }
      const secret = `rfy_live_${randomBytes(14).toString("hex")}`;
      const requested = Array.isArray(scopes)
        ? [...new Set(scopes.filter((scope) => KEY_SCOPES.includes(scope)))]
        : [];
      const requestedDays = Number(expires_in_days);
      const days = Number.isFinite(requestedDays) && requestedDays > 0
        ? Math.max(1, Math.min(365, Math.floor(requestedDays)))
        : 90;
      const key = {
        id: uid("key"),
        name: (name || "New agent key").slice(0, 40),
        prefix: secret.slice(0, 13),
        secret_hash: digestSecret(secret),
        scopes: requested.length ? requested : [...KEY_SCOPES],
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + days * 86400000).toISOString(),
        last_used: null,
      };
      put("keys", key);
      logEvent({
        actor_type: "human", actor: humanActor(), verb: "issued an agent key",
        object: key.name, detail: `${key.prefix}… · expires in ${days} days`, kind: "human",
      });
      return send(res, 201, { state: buildState(), key: { ...publicKey(key), secret } });
    }

    const rotateMatch = path.match(/^\/api\/keys\/([^/]+)\/rotate$/);
    if (rotateMatch && req.method === "POST") {
      const existing = loadAll().keys.find((k) => k.id === rotateMatch[1]);
      if (!existing) return send(res, 404, { error: "not_found" });
      const secret = `rfy_live_${randomBytes(14).toString("hex")}`;
      const key = {
        ...existing,
        prefix: secret.slice(0, 13),
        secret_hash: digestSecret(secret),
        rotated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
      };
      delete key.secret;
      put("keys", key);
      logEvent({
        actor_type: "human", actor: humanActor(), verb: "rotated an agent key",
        object: key.name, detail: `${key.prefix}… · the old secret no longer works`, kind: "human",
      });
      return send(res, 200, { state: buildState(), key: { ...publicKey(key), secret } });
    }

    const keyMatch = path.match(/^\/api\/keys\/([^/]+)$/);
    if (keyMatch && req.method === "DELETE") {
      const data = loadAll();
      const revoked = data.keys.find((k) => k.id === keyMatch[1]);
      const { remove } = await import("./db.mjs");
      remove("keys", keyMatch[1]);
      if (revoked) {
        logEvent({
          actor_type: "human", actor: humanActor(), verb: "revoked an agent key",
          object: revoked.name, detail: `${revoked.prefix}… · every client using it is locked out`,
          kind: "human",
        });
      }
      return send(res, 200, { state: buildState() });
    }

    if (path === "/api/billing" && req.method === "GET") {
      return send(res, 200, { billing: billingSummary(), plans: Object.values(PLANS) });
    }

    if (path === "/api/billing/plan" && req.method === "POST") {
      if (!canSwitchPlans()) {
        return send(res, 503, {
          error: "billing_not_configured",
          message: "Connect a billing provider before changing plans.",
        });
      }
      const { plan } = await body(req);
      const target = PLANS[String(plan || "").toLowerCase()];
      if (!target) {
        return send(res, 422, { error: "unknown_plan", plans: Object.keys(PLANS) });
      }
      // A paid plan needs a confirmed address for invoices and dunning. Without
      // an email provider nobody can confirm, so the gate only applies when
      // verification is actually possible.
      const user = req.auth?.user;
      if (target.price > 0 && emailConfigured() && user?.email && !user.email_verified) {
        return send(res, 403, {
          error: "email_unverified",
          message: "Confirm your email address before choosing a paid plan.",
        });
      }
      setPlan(target.key);
      return send(res, 200, { billing: billingSummary(), state: buildState() });
    }

    if (path === "/api/meta" && req.method === "PATCH") {
      const patch = await body(req);
      if (typeof patch.live === "boolean") setMeta("live", patch.live);
      if (patch.workspace) setMeta("workspace", String(patch.workspace).slice(0, 60));
      return send(res, 200, { state: buildState() });
    }

    if (path === "/api/demo/sweep" && req.method === "POST") {
      const result = await sweep({ actor: "Remy" });
      return send(res, 200, { ...result, state: buildState() });
    }

    if (path === "/api/demo/advance" && req.method === "POST") {
      const { days = 7, run = true } = await body(req);
      advanceClock(days);
      const result = run ? await sweep({ actor: "Time machine", silent: true }) : null;
      return send(res, 200, { ...result, state: buildState() });
    }

    if (path === "/api/demo/reset" && req.method === "POST") {
      seedDatabase(true);
      ensureTrustDemo();
      return send(res, 200, { state: buildState() });
    }

    // ---------- Trust layer ----------
    if (path === "/api/trust" && req.method === "GET") {
      return send(res, 200, { trust: trustSnapshot(), state: buildState() });
    }

    if (path === "/api/trust/receipts" && req.method === "POST") {
      const input = await body(req);
      const result = createReceipt(input);
      return send(res, result.ok ? 201 : 422, { ...result, state: buildState() });
    }

    const receiptAuditMatch = path.match(/^\/api\/trust\/receipts\/([^/]+)\/audit$/);
    if (receiptAuditMatch && req.method === "POST") {
      const { artifact } = await body(req);
      const result = await auditReceipt({
        receipt_id: receiptAuditMatch[1],
        artifact: artifact || undefined,
      });
      return send(res, result.ok ? 200 : 422, { ...result, state: buildState() });
    }

    const receiptVerifyMatch = path.match(/^\/api\/trust\/receipts\/([^/]+)\/verify$/);
    if (receiptVerifyMatch && req.method === "GET") {
      const receipt = (loadAll().receipts || []).find((r) => r.id === receiptVerifyMatch[1]);
      if (!receipt) return send(res, 404, { error: "receipt_not_found" });
      return send(res, 200, {
        id: receipt.id,
        status: receipt.status,
        valid: verifyReceiptSignature(receipt),
        proof_hash: receipt.proof_hash,
        settlement: receipt.settlement || null,
      });
    }

    if (path === "/api/trust/escrows" && req.method === "POST") {
      if (regionBlockedResponse(req, res)) return;
      const input = await body(req);
      const result = createEscrow(input);
      return send(res, result.ok ? 201 : 422, { ...result, state: buildState() });
    }

    if (path === "/api/trust/escrows/paypal/return" && req.method === "GET") {
      const url = new URL(req.url || "/", originFor(req));
      const token = url.searchParams.get("token") || url.searchParams.get("order_id");
      if (!token) return redirect(res, "/trust?escrow=missing");
      try {
        const result = await authorizeEscrowHold({ order_id: token });
        return redirect(res, `/trust?escrow=${result.ok ? "authorized" : result.error || "error"}`);
      } catch (error) {
        if (error instanceof PayPalError) return redirect(res, `/trust?escrow=${error.code}`);
        throw error;
      }
    }

    const escrowHoldMatch = path.match(/^\/api\/trust\/escrows\/([^/]+)\/hold$/);
    if (escrowHoldMatch && req.method === "POST") {
      if (regionBlockedResponse(req, res)) return;
      const result = await holdEscrow({ id: escrowHoldMatch[1], origin: originFor(req) });
      return send(res, result.ok ? 200 : 422, { ...result, state: buildState() });
    }

    const escrowReleaseMatch = path.match(/^\/api\/trust\/escrows\/([^/]+)\/release$/);
    if (escrowReleaseMatch && req.method === "POST") {
      if (regionBlockedResponse(req, res)) return;
      const { proof_receipt_id, artifact } = await body(req);
      const escrow = (loadAll().escrows || []).find((e) => e.id === escrowReleaseMatch[1]);
      let receiptId = proof_receipt_id;
      if (artifact && escrow) {
        const filed = createReceipt({
          obligation_id: escrow.obligation_id,
          artifact,
          proof: artifact.name || "Escrow proof",
          source: "escrow",
        });
        receiptId = filed.receipt?.id || receiptId;
      }
      const result = await releaseEscrow({ id: escrowReleaseMatch[1], proof_receipt_id: receiptId });
      return send(res, result.ok ? 200 : 422, { ...result, state: buildState() });
    }

    const escrowVoidMatch = path.match(/^\/api\/trust\/escrows\/([^/]+)\/void$/);
    if (escrowVoidMatch && req.method === "POST") {
      if (regionBlockedResponse(req, res)) return;
      const result = await voidEscrow({ id: escrowVoidMatch[1] });
      return send(res, result.ok ? 200 : 422, { ...result, state: buildState() });
    }

    if (path === "/api/invoices" && req.method === "POST") {
      if (regionBlockedResponse(req, res)) return;
      if (!paypalConfigured()) {
        return send(res, 503, {
          error: "paypal_not_configured",
          message: "Add PayPal credentials before sending an invoice.",
          state: buildState(),
        });
      }
      const input = await body(req);
      const data = loadAll();
      const obligation = (data.obligations || []).find((item) => item.id === input.obligation_id);
      if (!obligation) return send(res, 404, { error: "obligation_not_found", state: buildState() });
      const agent = (data.agents || []).find(
        (item) => item.id === (input.agent_id || obligation.agent_id)
      );
      try {
        const invoice = await sendObligationInvoice({
          obligation,
          agent,
          payerEmail: input.payer_paypal_email,
          now: virtualNow(),
        });
        return send(res, 201, { invoice, state: buildState() });
      } catch (error) {
        return paypalFailure(res, error);
      }
    }

    const invoiceRemindMatch = path.match(/^\/api\/invoices\/([^/]+)\/remind$/);
    if (invoiceRemindMatch && req.method === "POST") {
      if (regionBlockedResponse(req, res)) return;
      const data = loadAll();
      const invoice = (data.invoices || []).find((item) => item.id === invoiceRemindMatch[1]);
      if (!invoice) return send(res, 404, { error: "invoice_not_found", state: buildState() });
      try {
        const next = await remindObligationInvoice({ invoice, now: virtualNow() });
        return send(res, 200, { invoice: next, state: buildState() });
      } catch (error) {
        return paypalFailure(res, error);
      }
    }

    if (path === "/api/account/delete" && req.method === "POST") {
      return handleAccountDelete(req, res, { send, body });
    }

    if (path === "/api/seller" && req.method === "PATCH") {
      const input = await body(req);
      const profile = updateSellerProfile(input, virtualNow());
      return send(res, 200, { profile, state: buildState() });
    }

    const sellerBookingMatch = path.match(/^\/api\/seller\/bookings\/([^/]+)\/(accept|decline|start|proof)$/);
    if (sellerBookingMatch && req.method === "POST") {
      const id = sellerBookingMatch[1];
      const action = sellerBookingMatch[2];
      let result;
      if (action === "accept") {
        result = acceptBooking(id, virtualNow());
      } else if (action === "decline") {
        const { reason } = await body(req);
        result = declineBooking(id, reason, virtualNow());
      } else if (action === "start") {
        result = startBooking(id, virtualNow());
      } else {
        result = submitBookingProof(id, await body(req), virtualNow());
      }
      return send(res, result.ok ? 200 : result.status || 422, { ...result, state: buildState() });
    }

    if (path === "/api/seller/payouts" && req.method === "POST") {
      if (regionBlockedResponse(req, res)) return;
      const result = requestPayout(virtualNow());
      return send(res, result.ok ? 201 : result.status || 422, { ...result, state: buildState() });
    }

    const sellerPayoutMatch = path.match(/^\/api\/seller\/payouts\/([^/]+)\/receive$/);
    if (sellerPayoutMatch && req.method === "POST") {
      const result = confirmPayoutReceived(sellerPayoutMatch[1], virtualNow());
      return send(res, result.ok ? 200 : result.status || 422, { ...result, state: buildState() });
    }

    // ---------- PayPal payment rail ----------
    // PayPal is a fiat rail: it moves money for an obligation, but the proof
    // rail stays Base. Amounts are rebuilt from stored rows, never from input.
    if (path === "/api/payments" && req.method === "GET") {
      const data = loadAll();
      return send(res, 200, {
        payments: listPayments(data),
        summary: paymentsSummary(data),
        paypal: { configured: paypalConfigured(), mode: paypalMode() },
      });
    }

    if (path === "/api/payments/paypal/orders" && req.method === "POST") {
      if (regionBlockedResponse(req, res)) return;
      const input = await body(req);
      const data = loadAll();
      const obligation = (data.obligations || []).find((item) => item.id === input.obligation_id);
      if (!obligation) {
        return send(res, 404, { error: "obligation_not_found", state: buildState() });
      }
      if (!["active", "waiting"].includes(obligation.status)) {
        return send(res, 409, {
          error: "obligation_not_payable",
          message: "This obligation is already settled.",
          state: buildState(),
        });
      }

      try {
        const amount = payableAmount(obligation);
        const origin = publicOrigin(req);
        const order = await createOrder(obligation, {
          returnUrl: `${origin}/obligations?paypal=return`,
          cancelUrl: `${origin}/obligations?paypal=cancel`,
        });
        const payment = beginObligationPayment({
          obligation,
          orderId: order.orderId,
          amount: amount.value,
          currency: amount.currency,
        });
        return send(res, 201, {
          payment,
          approve_url: order.approveUrl,
          mode: paypalMode(),
          state: buildState(),
        });
      } catch (error) {
        return paypalFailure(res, error);
      }
    }

    if (path === "/api/payments/paypal/capture" && req.method === "POST") {
      if (regionBlockedResponse(req, res)) return;
      const input = await body(req);
      const orderId = String(input.order_id || "").trim();
      if (!orderId) return send(res, 422, { error: "order_id_required", state: buildState() });

      const data = loadAll();
      const payment = findPayment(data, { orderId });
      if (!payment) {
        return send(res, 404, { error: "payment_not_found", state: buildState() });
      }
      if (payment.status === "captured") {
        return send(res, 200, { payment, already_captured: true, state: buildState() });
      }

      try {
        const expected = { currency: payment.currency, value: Number(payment.amount).toFixed(2) };
        let capture;
        try {
          capture = await captureOrder(orderId, expected);
        } catch (error) {
          // A returned browser can race a webhook or a retried request. Read
          // the order back instead of charging or failing a paid obligation.
          const detail = JSON.stringify(error?.details || "");
          const alreadyCaptured = error instanceof PayPalError
            && (error.code === "ORDER_ALREADY_CAPTURED" || detail.includes("ORDER_ALREADY_CAPTURED"));
          if (!alreadyCaptured) throw error;
          capture = orderCapture(await getOrder(orderId), expected);
          if (!capture) throw error;
        }

        const next = markCaptured({
          orderId,
          captureId: capture.captureId,
          amount: capture.amount,
          currency: capture.currency,
          payerEmail: capture.payerEmail,
          providerStatus: capture.captureStatus,
        });

        const fresh = loadAll();
        const obligation = (fresh.obligations || []).find(
          (item) => item.id === payment.obligation_id
        );
        if (obligation && ["active", "waiting"].includes(obligation.status)) {
          completeObligation(obligation.id, {
            proof: `PayPal capture ${capture.captureId}`,
            note: `Settled $${capture.amount.toFixed(2)} ${capture.currency} via PayPal.`,
            by: "PayPal",
          });
        }

        return send(res, 200, {
          payment: next,
          capture,
          mode: paypalMode(),
          state: buildState(),
        });
      } catch (error) {
        if (error instanceof PayPalError && error.code !== "paypal_unreachable") {
          markFailed({
            orderId,
            reason: error.message,
            providerStatus: error.code,
            failureCode: error.code,
          });
        }
        return paypalFailure(res, error);
      }
    }

    if (path === "/api/payments/paypal/payouts" && req.method === "POST") {
      if (regionBlockedResponse(req, res)) return;
      const input = await body(req);
      const payoutId = String(input.payout_id || "").trim();
      if (!payoutId) return send(res, 422, { error: "payout_id_required", state: buildState() });

      const data = loadAll();
      const payout = (data.payouts || []).find((item) => item.id === payoutId);
      if (!payout) return send(res, 404, { error: "payout_not_found", state: buildState() });
      if (payout.status !== "processing") {
        return send(res, 409, {
          error: "payout_state",
          message: "This payout is already settled.",
          state: buildState(),
        });
      }

      const profile = (data.seller_profile || [])[0];
      const receiver = String(profile?.payout?.paypal_email || "").trim();
      if (!receiver) {
        return send(res, 409, {
          error: "paypal_email_required",
          message: "Add a PayPal email to the payout method first.",
          state: buildState(),
        });
      }

      try {
        const result = await createPayout({ payout, receiverEmail: receiver });
        const row = recordPayout({
          payout,
          batchId: result.batchId,
          status: "processing",
          receiver,
        });
        return send(res, 201, {
          payment: row,
          batch_id: result.batchId,
          batch_status: result.status,
          mode: paypalMode(),
          state: buildState(),
        });
      } catch (error) {
        return paypalFailure(res, error);
      }
    }

    const paypalPayoutMatch = path.match(/^\/api\/payments\/paypal\/payouts\/([^/]+)$/);
    if (paypalPayoutMatch && req.method === "GET") {
      const batchId = decodeURIComponent(paypalPayoutMatch[1]);
      const data = loadAll();
      const row = findPayment(data, { batchId });
      if (!row) return send(res, 404, { error: "payout_not_found", state: buildState() });

      try {
        const status = await payoutBatch(batchId);
        if (status.itemStatus === "SUCCESS" || status.status === "SUCCESS") {
          markPayoutStatus({ batchId, status: "paid" });
          const payout = (data.payouts || []).find((item) => item.id === row.payout_id);
          if (payout && payout.status === "processing") confirmPayoutReceived(payout.id);
        } else if (["FAILED", "DENIED", "RETURNED", "CANCELED", "BLOCKED"].includes(status.itemStatus)) {
          markPayoutStatus({ batchId, status: "failed" });
        }
        return send(res, 200, { ...status, state: buildState() });
      } catch (error) {
        return paypalFailure(res, error);
      }
    }

    if (path === "/api/export" && req.method === "GET") {
      const data = loadAll();
      return send(res, 200, {
        exported_at: new Date().toISOString(),
        ...data,
        agents: buildState().agents,
        keys: data.keys.map(publicKey),
      });
    }

    if (path.startsWith("/api/")) return send(res, 404, { error: "not_found", path });

    // ---------- Static app ----------
    const cleanPath = normalize(path).replace(/^(\.\.[\/\\])+/, "").replace(/\/+$/, "");
    let filePath = join(DIST, cleanPath);
    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = join(filePath, "index.html");
    } catch {
      // Clean URL: /pricing -> dist/pricing/index.html
      const directoryIndex = join(DIST, cleanPath, "index.html");
      try {
        await stat(directoryIndex);
        filePath = directoryIndex;
      } catch {
        filePath = join(DIST, "index.html");
      }
    }
    try {
      const content = await readFile(filePath);
      const type = MIME[extname(filePath)] || "application/octet-stream";
      res.setHeader("accept-ranges", "bytes");
      const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
      if (range && content.length) {
        const start = range[1] ? Number(range[1]) : 0;
        const end = range[2] ? Number(range[2]) : content.length - 1;
        if (start <= end && start < content.length) {
          const last = Math.min(end, content.length - 1);
          res.setHeader("content-range", `bytes ${start}-${last}/${content.length}`);
          res.setHeader("content-length", last - start + 1);
          return send(res, 206, content.subarray(start, last + 1), type);
        }
      }
      return send(res, 200, content, type);
    } catch {
      return send(
        res,
        200,
        "<!doctype html><title>Remindify</title><body style='font-family:system-ui;background:#f3f0e9;color:#151510;padding:60px'><h1>Remindify API is running.</h1><p>The app bundle isn't built yet. Run <code>npm run dev</code> (Vite on :5173) or <code>npm run build</code>.</p><p><a href='/api/health'>/api/health</a></p></body>",
        "text/html; charset=utf-8"
      );
    }
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: "server_error", message: "Something went wrong on our side." });
  }
}

// Money movement is refused in a blocked region even for an existing session.
function regionBlockedResponse(req, res) {
  if (!regionBlocked(req)) return false;
  send(res, 451, { error: "region_blocked", message: REGION_BLOCKED_MESSAGE });
  return true;
}

// Where PayPal sends the payer back. PUBLIC_ORIGIN wins so a proxied deploy
// never hands PayPal an internal host.
function originFor(req) {
  const configured = String(process.env.PUBLIC_ORIGIN || "").replace(/\/+$/, "");
  if (configured) return configured;
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:4178")
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
}

function redirect(res, location) {
  res.writeHead(302, { location });
  res.end();
}

function secretMatches(given, secret) {
  if (!secret || !given) return false;
  const provided = Buffer.from(String(given));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function outboxSecretMatches(given) {
  return secretMatches(given, process.env.OUTBOX_SECRET || "");
}

// One secret could schedule both jobs, so CRON_SECRET falls back to
// OUTBOX_SECRET when only the older variable is set.
function cronSecretMatches(given) {
  return secretMatches(given, process.env.CRON_SECRET || process.env.OUTBOX_SECRET || "");
}

const SWEEP_LEASE_MS = 5 * 60_000;
// Vercel's function limit is 30s; stop early and let the next run continue.
const SWEEP_BUDGET_MS = 20_000;

// Replay-safe: sweep() skips an obligation that already has a run in the last
// six hours, and this lease stops a second scheduler from entering the same
// workspace while the first is still calling connectors.
async function sweepAllWorkspaces() {
  const summary = {
    workspaces: 0, skipped: 0, deferred: 0, scanned: 0, proposed: 0, executed: 0, drafted: 0, blocked: 0, failed: 0,
    handed_over: 0,
    digests: 0, digest_failed: 0, pruned_events: 0, pruned_runs: 0,
  };
  const workspaces = workspacesWithKind("obligations");
  const deadline = Date.now() + SWEEP_BUDGET_MS;
  for (let index = 0; index < workspaces.length; index++) {
    if (Date.now() >= deadline) {
      summary.deferred = workspaces.length - index;
      break;
    }
    const workspaceId = workspaces[index];
    summary.workspaces += 1;
    await runWithWorkspace(workspaceId, async () => {
      const now = Date.now();
      const leasedUntil = Date.parse(getMeta("sweep_lease_until", "")) || 0;
      if (leasedUntil > now) {
        summary.skipped += 1;
        return;
      }
      setMeta("sweep_lease_until", new Date(now + SWEEP_LEASE_MS).toISOString());
      try {
        const result = await sweep({ actor: "Scheduled sweep", silent: true });
        for (const key of ["scanned", "proposed", "executed", "drafted", "blocked", "failed", "handed_over"]) {
          summary[key] += result[key] || 0;
        }
        try {
          const digest = await sendDailyDigest();
          summary.digests += digest.sent || 0;
          summary.digest_failed += digest.failed || 0;
        } catch {
          summary.digest_failed += 1;
        }
        try {
          const pruned = pruneActivity();
          summary.pruned_events += pruned.events;
          summary.pruned_runs += pruned.runs;
        } catch {
          // Retention is best-effort: a failed prune must not fail the sweep.
        }
      } finally {
        setMeta("sweep_lease_until", new Date(0).toISOString());
      }
    });
  }
  return summary;
}

// Runs inside whatever workspace/store context the caller already entered.
async function sweepOutbox() {
  const results = [];
  for (const workspaceId of workspacesWithKind("outbox")) {
    const result = await runWithWorkspace(workspaceId, () => drainOutbox());
    results.push({ workspace: workspaceId, processed: result.processed || 0 });
  }
  return { workspaces: results.length, processed: results.reduce((sum, r) => sum + r.processed, 0) };
}

// The local timer has no request to lean on, so it opens its own snapshot.
async function sweepOutboxWithStore() {
  if (!isPostgres) return sweepOutbox();
  let store;
  try {
    store = await beginRequest();
  } catch {
    return null;
  }
  try {
    const result = await runWithStore(store, sweepOutbox);
    await endRequest(store);
    return result;
  } catch (error) {
    await abortRequest(store).catch(() => {});
    throw error;
  }
}

function needsDatabase(path) {
  return path.startsWith("/api/")
    && path !== "/api/health"
    && path !== "/api/auth/config"
    && path !== "/api/auth/google";
}

// Vercel rewrites every /api/* request to the single api/index function and
// passes the original path in __path. Restore the URL before the router sees
// it, keeping query parameters such as the Google OAuth state and code.
function normalizedPath(req) {
  try {
    const url = new URL(req.url, "http://localhost");
    if (!url.searchParams.has("__path")) return url.pathname;
    const inner = String(url.searchParams.get("__path") || "").replace(/^\/+/, "");
    url.searchParams.delete("__path");
    const path = `/api/${inner}`;
    const query = url.searchParams.toString();
    req.url = query ? `${path}?${query}` : path;
    return path;
  } catch {
    return "/";
  }
}

// The store needs the workspace before it can take the per-workspace advisory
// lock. Read the credential from the request without a database round trip:
// the session cookie hashes to the auth_sessions key, the bearer token to a
// workspace API key.
function requestLockHint(req) {
  const cookie = String(req.headers.cookie || "");
  let sessionToken = "";
  for (const part of cookie.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== "remindify_session") continue;
    try {
      sessionToken = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      sessionToken = "";
    }
    break;
  }
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  return {
    sessionTokenHash: sessionToken ? digestSecret(sessionToken) : null,
    apiKey: bearer || null,
    apiKeyDigest: bearer ? digestSecret(bearer) : null,
  };
}

// Vercel and the local Node server both enter through this handler. With
// Postgres, a request-scoped snapshot is loaded under a transaction and
// flushed before the response ends. With SQLite, the lifecycle hooks are
// no-ops and the existing synchronous store is used directly.
export async function handle(req, res) {
  const path = normalizedPath(req);

  if (!isPostgres) {
    if (needsDatabase(path)) ensureTrustDemo();
    return handleRequest(req, res);
  }

  if (!needsDatabase(path)) return handleRequest(req, res);

  let store;
  try {
    store = await beginRequest(requestLockHint(req));
  } catch (error) {
    console.error("Postgres request start failed:", error);
    return send(res, 500, { error: "database_unavailable", message: "The workspace database is unavailable." });
  }

  try {
    return await runWithStore(store, async () => {
      try {
        seedDatabase();
        pruneAuth();
        ensureTrustDemo();
      } catch (error) {
        await abortRequest(store);
        console.error("Postgres request setup failed:", error);
        return send(res, 500, {
          error: "database_unavailable",
          message: "The workspace database is unavailable.",
        });
      }

      let flush = null;
      const originalEnd = res.end.bind(res);
      res.end = (...args) => {
        if (!flush) {
          flush = endRequest(store)
            .catch((error) => {
              console.error("Postgres request flush failed:", error);
            })
            .then(() => originalEnd(...args));
        }
        return res;
      };

      try {
        await handleRequest(req, res);
        if (flush) await flush;
        else await endRequest(store);
      } catch (error) {
        if (!flush) await abortRequest(store);
        throw error;
      }
    });
  } catch (error) {
    console.error("Postgres request failed:", error);
    if (!res.headersSent) {
      return send(res, 500, { error: "server_error", message: "Something went wrong on our side." });
    }
    if (!res.writableEnded) res.end();
  }
}

if (!process.env.VERCEL) {
  const server = createServer(handle);
  server.listen(PORT, () => {
    console.log(`→ Remindify API  http://localhost:${PORT}`);
  });

  // Ambient heartbeat: keep agents' presence alive without mutating obligations.
  if (!isPostgres) {
    setInterval(() => {
      try {
        const data = loadAll();
        const now = new Date().toISOString();
        for (const agent of data.agents) {
          if (agent.status === "active") {
            agent.last_active = now;
            put("agents", agent);
          }
        }
      } catch {
        /* ignore */
      }
    }, 45_000).unref();
  }

  // Durable connector retries: the job list lives in the database, so this
  // timer only decides when to look, not whether the retry survives a restart.
  const configuredSweep = Number(process.env.OUTBOX_INTERVAL_MS);
  const sweepEvery =
    Number.isFinite(configuredSweep) && configuredSweep >= 0 ? Math.floor(configuredSweep) : 30_000;
  if (sweepEvery > 0) {
    setInterval(() => {
      sweepOutboxWithStore().catch((error) => console.error("Outbox sweep failed:", error));
    }, sweepEvery).unref();
  }
}

export default handle;
