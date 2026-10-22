import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeed } from "./seed.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.REMINDIFY_DATA_DIR
  ? process.env.REMINDIFY_DATA_DIR
  : join(__dirname, "..", "data");
const DB_PATH = process.env.REMINDIFY_DB || join(DATA_DIR, "remindify.db");

mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS items (
    kind TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (kind, id)
  );
  CREATE TABLE IF NOT EXISTS meta (
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL
  );
`);

const upsert = db.prepare(
  "INSERT INTO items (kind, id, data) VALUES (?, ?, ?) ON CONFLICT(kind, id) DO UPDATE SET data = excluded.data"
);
const insertMany = (kind, rows) => {
  for (const row of rows) upsert.run(kind, row.id, JSON.stringify(row));
};

export function getMeta(key, fallback = null) {
  const row = db.prepare("SELECT v FROM meta WHERE k = ?").get(key);
  return row ? JSON.parse(row.v) : fallback;
}

export function setMeta(key, value) {
  db.prepare(
    "INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v"
  ).run(key, JSON.stringify(value));
}

export function loadAll() {
  const rows = db.prepare("SELECT kind, data FROM items").all();
  const out = {
    obligations: [], agents: [], approvals: [], runs: [], providers: [], events: [], keys: [],
    receipts: [], escrows: [],
  };
  for (const row of rows) {
    const item = JSON.parse(row.data);
    if (out[row.kind]) out[row.kind].push(item);
  }
  out.obligations.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  out.events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  out.runs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  out.approvals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return out;
}

export function put(kind, item) {
  upsert.run(kind, item.id, JSON.stringify(item));
  return item;
}

export function putMany(kind, items) {
  insertMany(kind, items);
}

export function remove(kind, id) {
  db.prepare("DELETE FROM items WHERE kind = ? AND id = ?").run(kind, id);
}

export function seeded() {
  return getMeta("seeded", false);
}

export function seedDatabase(force = false) {
  if (seeded() && !force) return false;
  db.exec("DELETE FROM items; DELETE FROM meta;");
  const seed = buildSeed(Date.now());
  for (const kind of [
    "obligations", "agents", "approvals", "runs", "providers", "events", "keys", "receipts", "escrows",
  ]) {
    insertMany(kind, seed[kind] || []);
  }
  for (const [key, value] of Object.entries(seed.meta)) setMeta(key, value);
  setMeta("seeded", true);
  setMeta("created_at", new Date().toISOString());
  return true;
}

seedDatabase();
