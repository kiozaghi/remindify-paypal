// Activity retention.
//
// The operator chooses how long events and run records stay in a workspace.
// Receipts, escrows and user records are never pruned here: they are the
// financial and identity record. Retention is disabled unless RETENTION_DAYS
// is a positive number, so an existing register does not lose history on
// upgrade.

import { loadAll, remove } from "./db.mjs";

const DAY = 86400000;

export function retentionDays(env = process.env) {
  const raw = Number(env.RETENTION_DAYS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

export function pruneActivity({ now = Date.now(), days = retentionDays() } = {}) {
  if (!days) return { enabled: false, events: 0, runs: 0 };

  const cutoff = now - days * DAY;
  const data = loadAll();
  let events = 0;
  let runs = 0;

  for (const event of data.events) {
    const at = Date.parse(event.created_at);
    if (Number.isFinite(at) && at < cutoff) {
      remove("events", event.id);
      events += 1;
    }
  }
  for (const run of data.runs) {
    const at = Date.parse(run.created_at);
    if (Number.isFinite(at) && at < cutoff) {
      remove("runs", run.id);
      runs += 1;
    }
  }

  return { enabled: true, events, runs };
}
