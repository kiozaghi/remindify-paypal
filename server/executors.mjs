import { createHmac, randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { getMeta } from "./db.mjs";
import { currentWorkspaceId } from "./workspace.mjs";

const TIMEOUT_MS = Number(process.env.EXECUTOR_TIMEOUT_MS) || 8000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_ATTEMPTS = 5;

function attemptBudget() {
  const configured = Number(process.env.EXECUTOR_ATTEMPTS);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(MAX_ATTEMPTS, Math.floor(configured))
    : 3;
}

function retryBase() {
  const configured = Number(process.env.EXECUTOR_RETRY_BASE_MS);
  return Number.isFinite(configured) && configured >= 0 ? Math.min(5000, Math.floor(configured)) : 300;
}

export function newExecutorSecret() {
  return `rfy_exec_${randomBytes(24).toString("hex")}`;
}

// Seeded agents point at the app's own sandbox endpoint. Relative targets are
// resolved against this deployment so the same seed works locally and on
// Vercel without knowing the host in advance.
export const DEMO_EXECUTOR_PATH = "/api/demo/executor";

function deploymentOrigin() {
  const configured = process.env.PUBLIC_ORIGIN
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return configured.replace(/\/$/, "") || `http://localhost:${process.env.PORT || 4178}`;
}

// Executor URLs are user-supplied fetch targets, so they get the same
// treatment as any outbound webhook: https only, no credentials in the URL,
// and a resolved address that is not on a private network. The resolved
// address is returned so the send pins it instead of letting the transport
// resolve the host again (a second lookup is where DNS rebinding slips in).
export async function resolveExecutorTarget(raw) {
  let url;
  const value = String(raw ?? "");
  if (value.startsWith("/")) {
    // The built-in sandbox executor: same process, no DNS to pin.
    try {
      url = new URL(value, deploymentOrigin());
    } catch {
      return { ok: false, error: "The built-in executor path is invalid." };
    }
    return { ok: true, url, address: null, family: null };
  }
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "Enter a full URL, including https://." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "Remove the credentials from the URL; use the signing secret instead." };
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    return { ok: false, error: "Executors must be served over https." };
  }
  if (isLocal && process.env.EXECUTOR_ALLOW_LOCAL !== "1") {
    return { ok: false, error: "Local addresses are blocked for executors." };
  }
  if (isLocal) return { ok: true, url, address: null, family: null };

  let addresses;
  try {
    addresses = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    return { ok: false, error: "That host does not resolve." };
  }
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    return { ok: false, error: "That host resolves to a private address." };
  }
  return { ok: true, url, address: addresses[0].address, family: addresses[0].family };
}

export async function validateExecutorUrl(raw) {
  const target = await resolveExecutorTarget(raw);
  return target.ok
    ? { ok: true, url: target.url.toString() }
    : { ok: false, error: target.error };
}

export function isPrivateAddress(ip) {
  const value = String(ip).toLowerCase();
  if (value.includes(":")) {
    if (value === "::" || value === "::1") return true;
    if (value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
    const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

export function signExecutorRequest(secret, timestamp, rawBody) {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function connectorConfigured(agent) {
  return Boolean(agent?.executor_url && agent?.executor_secret);
}

// Strip the signing secret before an agent record leaves the server.
export function publicAgent(agent) {
  if (!agent) return agent;
  const { executor_secret, ...rest } = agent;
  return { ...rest, executor_configured: Boolean(agent.executor_url && executor_secret) };
}

export async function executeWithConnector({ runId, agent, obligation, action, detail }) {
  if (!connectorConfigured(agent)) {
    return { configured: false, ok: false, error: "No executor is connected to this agent." };
  }

  const base = {
    event: "obligation.execute",
    run_id: runId,
    workspace: {
      id: currentWorkspaceId(),
      name: getMeta("workspace", "Your desk"),
    },
    agent: { id: agent.id, name: agent.name, handle: agent.handle },
    obligation: {
      id: obligation.id,
      title: obligation.title,
      provider: obligation.provider,
      category: obligation.category,
      amount: obligation.amount,
      currency: obligation.currency,
      due_at: obligation.due_at,
      autonomy: obligation.autonomy,
    },
    action,
    detail,
  };

  const budget = attemptBudget();
  let outcome;
  for (let attempt = 1; attempt <= budget; attempt++) {
    outcome = await sendAttempt({ agent, base, runId, attempt });
    outcome.attempts = attempt;
    if (outcome.ok || !outcome.transient) break;
    if (attempt < budget) {
      const delay = retryBase() * 2 ** (attempt - 1);
      if (delay > 0) await sleep(delay);
    }
  }
  if (!outcome.ok && outcome.attempts > 1) {
    outcome.error = `${outcome.error} (tried ${outcome.attempts} times)`;
  }
  outcome.retryable = Boolean(outcome.transient);
  delete outcome.transient;
  return outcome;
}

async function sendAttempt({ agent, base, runId, attempt }) {
  // Re-resolve on every attempt and pin the address we validated.
  const target = await resolveExecutorTarget(agent.executor_url);
  if (!target.ok) {
    return { configured: true, ok: false, status: 0, error: target.error, transient: false };
  }

  const issuedAt = Date.now();
  const rawBody = JSON.stringify({ ...base, issued_at: new Date(issuedAt).toISOString() });
  const headers = {
    "content-type": "application/json",
    "user-agent": "Remindify-Executor/1",
    "x-remindify-event": "obligation.execute",
    "x-remindify-run": runId,
    "x-remindify-timestamp": String(issuedAt),
    "x-remindify-signature": `sha256=${signExecutorRequest(agent.executor_secret, issuedAt, rawBody)}`,
    "x-remindify-attempt": String(attempt),
  };

  try {
    const response = await sendSigned({ target, headers, body: rawBody });
    let payload = null;
    try {
      payload = response.text ? JSON.parse(response.text) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const reason = payload?.error ? `: ${String(payload.error).slice(0, 200)}` : "";
      return {
        configured: true,
        ok: false,
        status: response.status,
        error: `Executor answered ${response.status}${reason}`,
        transient: response.status === 408 || response.status === 429 || response.status >= 500,
      };
    }

    const proof =
      (typeof payload?.proof === "string" && payload.proof) ||
      (typeof payload?.receipt_url === "string" && payload.receipt_url) ||
      `connector_${response.status}`;
    return {
      configured: true,
      ok: true,
      status: response.status,
      proof: String(proof).slice(0, 300),
      transient: false,
    };
  } catch (error) {
    const message =
      error?.timedOut || error?.code === "ETIMEDOUT"
        ? `Executor timed out after ${TIMEOUT_MS}ms.`
        : `Executor unreachable (${error?.code || error?.message || "network error"}).`;
    return { configured: true, ok: false, status: 0, error: message, transient: true };
  }
}

function sendSigned({ target, headers, body }) {
  return new Promise((resolve, reject) => {
    const url = target.url;
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    const options = {
      method: "POST",
      hostname,
      port: url.port || undefined,
      path: `${url.pathname || "/"}${url.search}`,
      headers: { ...headers, "content-length": Buffer.byteLength(body) },
    };
    if (url.protocol === "https:") options.servername = hostname;
    if (target.address) {
      options.lookup = (host, lookupOptions, callback) => {
        if (lookupOptions && typeof lookupOptions === "object" && lookupOptions.all) {
          return callback(null, [{ address: target.address, family: target.family }]);
        }
        return callback(null, target.address, target.family);
      };
    }

    let settled = false;
    let timer;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const req = transport(options, (res) => {
      const chunks = [];
      let total = 0;
      res.on("data", (chunk) => {
        total += chunk.length;
        if (total <= MAX_RESPONSE_BYTES) chunks.push(chunk);
      });
      res.on("end", () =>
        finish(resolve, {
          status: res.statusCode || 0,
          ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
          text: Buffer.concat(chunks).subarray(0, MAX_RESPONSE_BYTES).toString("utf8"),
        })
      );
      res.on("error", (error) => finish(reject, error));
    });

    timer = setTimeout(() => {
      const error = new Error(`Executor timed out after ${TIMEOUT_MS}ms.`);
      error.code = "ETIMEDOUT";
      error.timedOut = true;
      req.destroy(error);
    }, TIMEOUT_MS);

    req.on("error", (error) => finish(reject, error));
    req.end(body);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
