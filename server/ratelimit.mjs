// Per-key fixed-window counter for the machine API.
//
// The counter lives in the workspace meta, so every instance sharing the store
// sees the same window. Postgres serialises a workspace's requests with an
// advisory lock; SQLite is a single process. That keeps read-modify-write
// honest without a second datastore.
import { getMeta, setMeta } from "./db.mjs";

const WINDOW_MS = 60_000;

function limit() {
  const configured = Number(process.env.MACHINE_RATE_LIMIT);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 600;
}

export function takeRateLimit(keyId, now = Date.now()) {
  const max = limit();
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const reset = windowStart + WINDOW_MS;
  const stored = getMeta(`rl:${keyId}`, null);
  const used = stored && stored.window === windowStart ? Math.max(0, Number(stored.count) || 0) : 0;
  if (used >= max) {
    return {
      allowed: false,
      limit: max,
      remaining: 0,
      retry_after: Math.max(1, Math.ceil((reset - now) / 1000)),
    };
  }
  const count = used + 1;
  setMeta(`rl:${keyId}`, { window: windowStart, count });
  return { allowed: true, limit: max, remaining: Math.max(0, max - count), retry_after: 0 };
}
