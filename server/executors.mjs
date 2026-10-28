import { createHmac, randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import { getMeta } from "./db.mjs";
import { currentWorkspaceId } from "./workspace.mjs";

const TIMEOUT_MS = Number(process.env.EXECUTOR_TIMEOUT_MS) || 8000;
const MAX_RESPONSE_BYTES = 64 * 1024;

export function newExecutorSecret() {
  return `rfy_exec_${randomBytes(24).toString("hex")}`;
}

// Executor URLs are user-supplied fetch targets, so they get the same
// treatment as any outbound webhook: https only, no credentials in the URL,
// and a resolved address that is not on a private network. Redirects are
// refused at fetch time so a public host cannot bounce the request inward.
export async function validateExecutorUrl(raw) {
  let url;
  try {
    url = new URL(String(raw));
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
  if (isLocal) return { ok: true, url: url.toString() };

  let addresses;
  try {
    addresses = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    return { ok: false, error: "That host does not resolve." };
  }
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    return { ok: false, error: "That host resolves to a private address." };
  }
  return { ok: true, url: url.toString() };
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
  const check = await validateExecutorUrl(agent.executor_url);
  if (!check.ok) {
    return { configured: true, ok: false, status: 0, error: check.error };
  }

  const issuedAt = Date.now();
  const rawBody = JSON.stringify({
    event: "obligation.execute",
    run_id: runId,
    issued_at: new Date(issuedAt).toISOString(),
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
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(check.url, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "user-agent": "Remindify-Executor/1",
        "x-remindify-event": "obligation.execute",
        "x-remindify-run": runId,
        "x-remindify-timestamp": String(issuedAt),
        "x-remindify-signature": `sha256=${signExecutorRequest(
          agent.executor_secret,
          issuedAt,
          rawBody
        )}`,
      },
      body: rawBody,
    });

    const text = await readLimited(response);
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
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
    };
  } catch (error) {
    const message =
      error?.name === "AbortError"
        ? `Executor timed out after ${TIMEOUT_MS}ms.`
        : `Executor unreachable (${error?.code || error?.message || "network error"}).`;
    return { configured: true, ok: false, status: 0, error: message };
  } finally {
    clearTimeout(timer);
  }
}

async function readLimited(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (total < MAX_RESPONSE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks).subarray(0, MAX_RESPONSE_BYTES).toString("utf8");
}
