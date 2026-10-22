import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import {
  buildState, completeObligation, sweep, applyApproval, snoozeObligation,
  runObligation, advanceClock, deleteObligation, logEvent, uid, virtualNow,
  riskFor, enrichObligation,
} from "./engine.mjs";
import { loadAll, put, putMany, getMeta, setMeta, seedDatabase } from "./db.mjs";
import { parseCapture } from "./parse.mjs";
import {
  anchorReceipt, commitEscrow, createEscrow, createReceipt, ensureTrustDemo,
  fundEscrow, receiptCalldata, releaseEscrow, signReceipt, trustSnapshot,
} from "./trust.mjs";

ensureTrustDemo();

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");
const PORT = process.env.PORT || 4178;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

function send(res, status, payload, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  });
  if (typeof payload === "string" || Buffer.isBuffer(payload)) return res.end(payload);
  res.end(JSON.stringify(payload));
}

async function body(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error("Body too large");
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON");
  }
}

function normalizeObligation(input) {
  const now = new Date();
  const due = input.due_at ? new Date(input.due_at) : new Date(now.getTime() + 14 * 86400000);
  return {
    id: input.id && !String(input.id).startsWith("draft_") ? input.id : uid("ob"),
    title: String(input.title || "Untitled obligation").slice(0, 140),
    category: input.category || "other",
    provider: input.provider || "Unassigned",
    owner: input.owner || "Solomon Tigabu",
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
    created_at: input.created_at || new Date().toISOString(),
  };
}

function keyFromRequest(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return loadAll().keys.find((k) => k.secret === token) || null;
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

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  if (req.method === "OPTIONS") return send(res, 204, "");

  try {
    // ---------- Machine-native API (agent first) ----------
    if (path.startsWith("/api/v1/")) {
      const key = keyFromRequest(req);
      if (!key) {
        return send(res, 401, {
          error: "unauthorized",
          hint: "Pass a Remindify key: Authorization: Bearer rfy_live_...",
        });
      }
      setMeta("api_calls", (getMeta("api_calls", 0) || 0) + 1);
      const state = buildState();

      if (path === "/api/v1/obligations" && req.method === "GET") {
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
        const input = await body(req);
        if (!input.title) return send(res, 422, { error: "title_required" });
        const ob = normalizeObligation({ ...input, source: "api", channel: "api" });
        put("obligations", ob);
        logEvent({
          actor_type: "automation", actor: key.name, actor_id: key.id,
          verb: "created an obligation via API", object: ob.title,
          detail: input.due_at ? `Due ${new Date(ob.due_at).toDateString()}` : "Due in 14 days",
          kind: "api", channel: "api",
        });
        return send(res, 201, { obligation: enrichObligation(ob, virtualNow()) });
      }

      const completeMatch = path.match(/^\/api\/v1\/obligations\/([^/]+)\/complete$/);
      if (completeMatch && req.method === "POST") {
        const input = await body(req);
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
        return send(res, 200, result);
      }

      const patchMatch = path.match(/^\/api\/v1\/obligations\/([^/]+)$/);
      if (patchMatch && req.method === "GET") {
        const ob = buildState().obligations.find((o) => o.id === patchMatch[1]);
        if (!ob) return send(res, 404, { error: "not_found" });
        return send(res, 200, { obligation: ob });
      }

      if (path === "/api/v1/risk" && req.method === "GET") {
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
        const trust = trustSnapshot();
        logEvent({
          actor_type: "automation", actor: key.name, actor_id: key.id,
          verb: "read the trust layer", object: "Proof receipts",
          detail: "GET /v1/trust · receipts, escrows and chain status",
          kind: "api", channel: "api",
        });
        return send(res, 200, {
          networks: trust.networks,
          receipts: trust.receipts,
          escrows: trust.escrows,
          stats: trust.stats,
          guardrails: trust.guardrails,
        });
      }

      if (path === "/api/v1/trust/receipts" && req.method === "POST") {
        const input = await body(req);
        if (!input.obligation_id) return send(res, 422, { error: "obligation_id_required" });
        const result = createReceipt({
          ...input,
          source: "api",
          actor: { type: "automation", id: key.id, name: key.name },
          channel: "api",
        });
        if (!result.ok) return send(res, 422, result);
        return send(res, 201, { receipt: result.receipt });
      }

      if (path === "/api/v1/agents" && req.method === "GET") {
        logEvent({
          actor_type: "automation", actor: key.name, actor_id: key.id,
          verb: "read the agent roster", object: "The bench",
          detail: "GET /v1/agents · scopes and ceilings",
          kind: "api", channel: "api",
        });
        return send(res, 200, {
          agents: state.agents.map((a) => ({
            id: a.id, name: a.name, role: a.role, status: a.status,
            autonomy_ceiling: a.autonomy_ceiling, trust: a.trust,
            capabilities: a.capabilities, scopes: a.scopes, runs_30d: a.runs_30d,
          })),
        });
      }

      return send(res, 404, { error: "not_found", path });
    }

    // ---------- App API ----------
    if (path === "/api/health") return send(res, 200, { ok: true, now: new Date().toISOString() });

    if (path === "/api/state" && req.method === "GET") return send(res, 200, { state: buildState() });

    if (path === "/api/capture" && req.method === "POST") {
      const { text } = await body(req);
      if (!text || text.trim().length < 4) return send(res, 422, { error: "Paste a little more text." });
      const parsed = parseCapture(text, Date.now());
      return send(res, 200, parsed);
    }

    if (path === "/api/obligations" && req.method === "POST") {
      const input = normalizeObligation(await body(req));
      put("obligations", input);
      logEvent({
        actor_type: "human", actor: "Solomon Tigabu",
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
      put("obligations", ob);
      if ("autonomy" in patch) {
        logEvent({
          actor_type: "human", actor: "Solomon Tigabu", verb: "changed autonomy",
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
      const result = runObligation(runMatch[1]);
      return send(res, result.ok ? 200 : 400, { ...result, state: buildState() });
    }

    if (obMatch && req.method === "DELETE") {
      deleteObligation(obMatch[1]);
      return send(res, 200, { state: buildState() });
    }

    const approvalMatch = path.match(/^\/api\/approvals\/([^/]+)\/decide$/);
    if (approvalMatch && req.method === "POST") {
      const { decision, note } = await body(req);
      if (!["approve", "deny"].includes(decision)) return send(res, 422, { error: "bad_decision" });
      const result = applyApproval(approvalMatch[1], decision, note || "");
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
        trust: 80,
        runs_30d: 0,
        success_rate: 100,
        cost_per_run: 0,
        status: "active",
        scopes: input.scopes || ["obligations:read"],
        hours_saved: 0,
        last_active: new Date().toISOString(),
        created_at: new Date().toISOString(),
        custom: true,
      };
      put("agents", agent);
      logEvent({
        actor_type: "human", actor: "Solomon Tigabu", verb: "created an agent",
        object: agent.name, detail: `${agent.role} · ceiling ${agent.autonomy_ceiling}`,
        kind: "human",
      });
      return send(res, 201, { state: buildState(), agent });
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
      put("agents", agent);
      return send(res, 200, { state: buildState(), agent });
    }

    if (path === "/api/hire" && req.method === "POST") {
      const { provider_id, obligation_id, title, note } = await body(req);
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
          actor_type: "human", actor: "Solomon Tigabu",
          verb: `booked ${provider.kind === "agent" ? "an agent" : "a specialist"}`,
          object: ob.title, detail: `${provider.name} · $${provider.price} · SLA ${provider.sla}`,
          kind: "human",
        });
      } else if (title) {
        const created = normalizeObligation({
          title, provider: provider.name, owner: provider.name, owner_kind: "team",
          backup: "Solomon Tigabu", amount: provider.price, source: "marketplace",
          autonomy: provider.kind === "agent" ? "approve" : "notify",
          marketplace: {
            provider_id, provider_name: provider.name, kind: provider.kind,
            price: provider.price, status: "booked", booked_at: new Date().toISOString(),
          },
        });
        put("obligations", created);
        logEvent({
          actor_type: "human", actor: "Solomon Tigabu",
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
      const { name } = await body(req);
      const secret = `rfy_live_${randomBytes(14).toString("hex")}`;
      const key = {
        id: uid("key"),
        name: (name || "New agent key").slice(0, 40),
        prefix: secret.slice(0, 13),
        secret,
        scopes: ["obligations:read", "obligations:write", "risk:read"],
        created_at: new Date().toISOString(),
        last_used: null,
      };
      put("keys", key);
      logEvent({
        actor_type: "human", actor: "Solomon Tigabu", verb: "issued an agent key",
        object: key.name, detail: key.prefix + "…", kind: "human",
      });
      return send(res, 201, { state: buildState(), key });
    }

    const keyMatch = path.match(/^\/api\/keys\/([^/]+)$/);
    if (keyMatch && req.method === "DELETE") {
      const data = loadAll();
      const { remove } = await import("./db.mjs");
      remove("keys", keyMatch[1]);
      return send(res, 200, { state: buildState() });
    }

    if (path === "/api/meta" && req.method === "PATCH") {
      const patch = await body(req);
      if (typeof patch.live === "boolean") setMeta("live", patch.live);
      if (patch.workspace) setMeta("workspace", String(patch.workspace).slice(0, 60));
      return send(res, 200, { state: buildState() });
    }

    if (path === "/api/demo/sweep" && req.method === "POST") {
      const result = sweep({ actor: "Remy" });
      return send(res, 200, { ...result, state: buildState() });
    }

    if (path === "/api/demo/advance" && req.method === "POST") {
      const { days = 7, run = true } = await body(req);
      advanceClock(days);
      const result = run ? sweep({ actor: "Time machine", silent: true }) : null;
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

    const receiptSignMatch = path.match(/^\/api\/trust\/receipts\/([^/]+)\/sign$/);
    if (receiptSignMatch && req.method === "POST") {
      const { signature, signer } = await body(req);
      const result = await signReceipt({ id: receiptSignMatch[1], signature, signer });
      return send(res, result.ok ? 200 : 422, { ...result, state: buildState() });
    }

    const receiptAnchorMatch = path.match(/^\/api\/trust\/receipts\/([^/]+)\/anchor$/);
    if (receiptAnchorMatch && req.method === "POST") {
      const { tx_hash } = await body(req);
      const result = await anchorReceipt({ id: receiptAnchorMatch[1], tx_hash });
      return send(res, result.ok ? 200 : 422, { ...result, state: buildState() });
    }

    const receiptCalldataMatch = path.match(/^\/api\/trust\/receipts\/([^/]+)\/calldata$/);
    if (receiptCalldataMatch && req.method === "GET") {
      const result = receiptCalldata(receiptCalldataMatch[1]);
      return send(res, result.ok ? 200 : 422, result);
    }

    if (path === "/api/trust/escrows" && req.method === "POST") {
      const input = await body(req);
      const result = createEscrow(input);
      return send(res, result.ok ? 201 : 422, { ...result, state: buildState() });
    }

    const escrowCommitMatch = path.match(/^\/api\/trust\/escrows\/([^/]+)\/commit$/);
    if (escrowCommitMatch && req.method === "POST") {
      const result = commitEscrow({ id: escrowCommitMatch[1] });
      return send(res, result.ok ? 200 : 422, { ...result, state: buildState() });
    }

    const escrowFundMatch = path.match(/^\/api\/trust\/escrows\/([^/]+)\/fund$/);
    if (escrowFundMatch && req.method === "POST") {
      const { tx_hash } = await body(req);
      const result = await fundEscrow({ id: escrowFundMatch[1], tx_hash });
      return send(res, result.ok ? 200 : 422, { ...result, state: buildState() });
    }

    const escrowReleaseMatch = path.match(/^\/api\/trust\/escrows\/([^/]+)\/release$/);
    if (escrowReleaseMatch && req.method === "POST") {
      const { proof_receipt_id, tx_hash } = await body(req);
      const result = await releaseEscrow({
        id: escrowReleaseMatch[1],
        proof_receipt_id,
        tx_hash,
      });
      return send(res, result.ok ? 200 : 422, { ...result, state: buildState() });
    }

    if (path === "/api/export" && req.method === "GET") {
      const data = loadAll();
      return send(res, 200, { exported_at: new Date().toISOString(), ...data });
    }

    if (path.startsWith("/api/")) return send(res, 404, { error: "not_found", path });

    // ---------- Static app ----------
    let filePath = join(DIST, normalize(path).replace(/^(\.\.[\/\\])+/, ""));
    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = join(filePath, "index.html");
    } catch {
      filePath = join(DIST, "index.html");
    }
    try {
      const content = await readFile(filePath);
      return send(res, 200, content, MIME[extname(filePath)] || "application/octet-stream");
    } catch {
      return send(
        res,
        200,
        "<!doctype html><title>Remindify</title><body style='font-family:system-ui;background:#f3f0e9;color:#151510;padding:60px'><h1>Remindify API is running.</h1><p>The app bundle isn't built yet. Run <code>npm run dev</code> (Vite on :5173) or <code>npm run build</code>.</p><p><a href='/api/health'>/api/health</a> · <a href='/api/state'>/api/state</a></p></body>",
        "text/html; charset=utf-8"
      );
    }
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: "server_error", message: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`→ Remindify API  http://localhost:${PORT}`);
});

// Ambient heartbeat: keeps agents' presence alive without mutating obligations.
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
