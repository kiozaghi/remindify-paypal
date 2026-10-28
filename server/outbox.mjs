import { randomBytes } from "node:crypto";
import { loadAll, put } from "./db.mjs";

const DEFAULT_BASE_MS = 60_000;
const MAX_BASE_MS = 6 * 60 * 60 * 1000;
const DEFAULT_ATTEMPTS = 5;
const MAX_ATTEMPTS = 10;
const DEFAULT_LEASE_MS = 10 * 60 * 1000;

function positiveEnv(name, fallback, max) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.min(max, Math.floor(value));
}

export function outboxRetryBase() {
  return positiveEnv("OUTBOX_RETRY_BASE_MS", DEFAULT_BASE_MS, MAX_BASE_MS);
}

export function outboxMaxAttempts() {
  const value = positiveEnv("OUTBOX_MAX_ATTEMPTS", DEFAULT_ATTEMPTS, MAX_ATTEMPTS);
  return Math.max(1, value);
}

export function outboxLeaseMs() {
  return Math.max(60_000, positiveEnv("OUTBOX_LEASE_MS", DEFAULT_LEASE_MS, MAX_BASE_MS));
}

export function outboxBackoff(attempts) {
  const step = Math.max(1, Math.floor(attempts));
  if (outboxRetryBase() === 0) return 0;
  return Math.min(MAX_BASE_MS, outboxRetryBase() * 2 ** (step - 1));
}

// A transient connector failure becomes a durable job. The job keeps the
// original run id so the executor can dedupe a redelivery after a crash.
export function enqueueConnectorRetry({ runId, agent, obligation, action, detail, note, error }) {
  const data = loadAll();
  const existing = (data.outbox || []).find(
    (job) => job.run_id === runId && job.status === "pending"
  );
  if (existing) return null;

  const now = new Date();
  const job = {
    id: `obx_${randomBytes(8).toString("hex")}`,
    run_id: runId,
    agent_id: agent.id,
    obligation_id: obligation.id,
    action,
    detail,
    note: note || "",
    status: "pending",
    attempts: 0,
    max_attempts: outboxMaxAttempts(),
    next_at: new Date(now.getTime() + outboxBackoff(1)).toISOString(),
    last_error: error || null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  put("outbox", job);
  return job;
}

export function dueOutboxJobs(now = Date.now(), limit = 5) {
  return (loadAll().outbox || [])
    .filter((job) => job.status === "pending" && new Date(job.next_at).getTime() <= now)
    .sort((a, b) => new Date(a.next_at) - new Date(b.next_at))
    .slice(0, limit);
}
