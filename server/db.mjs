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

  -- Auth is deliberately stored outside the demo workspace. A demo reset clears
  -- items and meta, but never signs the operator out or deletes an account.
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT,
    password_salt TEXT,
    google_sub TEXT UNIQUE,
    avatar_url TEXT,
    wallet_address TEXT UNIQUE,
    created_at TEXT NOT NULL,
    last_login_at TEXT
  );
  CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS auth_challenges (
    nonce TEXT PRIMARY KEY,
    address TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_auth_challenges_address ON auth_challenges(address);
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

const USER_COLUMNS = [
  "id", "email", "name", "password_hash", "password_salt", "google_sub",
  "avatar_url", "wallet_address", "created_at", "last_login_at",
].join(", ");

export function getUser(id) {
  return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id) || null;
}

export function findUserByEmail(email) {
  return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`).get(String(email).toLowerCase()) || null;
}

export function findUserByGoogleSub(sub) {
  return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE google_sub = ?`).get(String(sub)) || null;
}

export function findUserByWallet(address) {
  return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE lower(wallet_address) = lower(?)`).get(String(address)) || null;
}

export function createUser(user) {
  db.prepare(`
    INSERT INTO users (id, email, name, password_hash, password_salt, google_sub, avatar_url, wallet_address, created_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    user.email || null,
    user.name,
    user.password_hash || null,
    user.password_salt || null,
    user.google_sub || null,
    user.avatar_url || null,
    user.wallet_address || null,
    user.created_at,
    user.last_login_at || null,
  );
  return getUser(user.id);
}

export function updateUser(id, patch) {
  const keys = Object.keys(patch).filter((key) => USER_COLUMNS.split(", ").includes(key));
  if (!keys.length) return getUser(id);
  db.prepare(`UPDATE users SET ${keys.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`)
    .run(...keys.map((key) => patch[key]), id);
  return getUser(id);
}

export function createAuthSession({ tokenHash, userId, createdAt, expiresAt }) {
  db.prepare(`
    INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(tokenHash, userId, createdAt, expiresAt);
}

export function getAuthSession(tokenHash) {
  const session = db.prepare(
    "SELECT token_hash, user_id, created_at, expires_at FROM auth_sessions WHERE token_hash = ?"
  ).get(tokenHash);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }
  const user = getUser(session.user_id);
  return user ? { ...session, user } : null;
}

export function deleteAuthSession(tokenHash) {
  db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(tokenHash);
}

export function createAuthChallenge({ nonce, address, message, createdAt, expiresAt }) {
  db.prepare(`
    INSERT INTO auth_challenges (nonce, address, message, created_at, expires_at, used)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(nonce, address, message, createdAt, expiresAt);
}

export function consumeAuthChallenge(nonce, address) {
  const row = db.prepare(`
    SELECT nonce, address, message, created_at, expires_at, used
    FROM auth_challenges WHERE nonce = ?
  `).get(nonce);
  if (!row || row.used || row.expires_at <= new Date().toISOString()) return null;
  if (row.address.toLowerCase() !== String(address).toLowerCase()) return null;
  db.prepare("UPDATE auth_challenges SET used = 1 WHERE nonce = ?").run(nonce);
  return row;
}

export function pruneAuth() {
  const now = new Date().toISOString();
  db.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").run(now);
  db.prepare("DELETE FROM auth_challenges WHERE expires_at <= ?").run(now);
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
pruneAuth();
