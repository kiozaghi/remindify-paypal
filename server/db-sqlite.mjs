import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeed } from "./seed.mjs";
import { currentWorkspaceId, DEMO_WORKSPACE } from "./workspace.mjs";
import { digestSecret, keyMatchesSecret } from "./keys.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.REMINDIFY_DATA_DIR
  ? process.env.REMINDIFY_DATA_DIR
  : join(__dirname, "..", "data");
const DB_PATH = process.env.REMINDIFY_DB || join(DATA_DIR, "remindify.db");

mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    workspace_id TEXT NOT NULL DEFAULT 'ws_demo',
    kind TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (workspace_id, kind, id)
  );
  CREATE TABLE IF NOT EXISTS meta (
    workspace_id TEXT NOT NULL DEFAULT 'ws_demo',
    k TEXT NOT NULL,
    v TEXT NOT NULL,
    PRIMARY KEY (workspace_id, k)
  );

  -- Auth is deliberately stored outside any single workspace. A workspace
  -- reset never signs the operator out or deletes an account.
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT,
    password_salt TEXT,
    google_sub TEXT UNIQUE,
    avatar_url TEXT,
    wallet_address TEXT UNIQUE,
    email_verified_at TEXT,
    created_at TEXT NOT NULL,
    last_login_at TEXT,
    workspace_id TEXT NOT NULL DEFAULT 'ws_demo'
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
  CREATE TABLE IF NOT EXISTS auth_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id);
`);

function columns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
}

// Upgrade a single-workspace database in place. Existing rows become the demo
// workspace, so no data is dropped.
function migrate() {
  if (!columns("items").includes("workspace_id")) {
    db.exec(`
      BEGIN;
      DROP TABLE IF EXISTS items_legacy;
      ALTER TABLE items RENAME TO items_legacy;
      CREATE TABLE items (
        workspace_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (workspace_id, kind, id)
      );
      INSERT INTO items (workspace_id, kind, id, data)
        SELECT 'ws_demo', kind, id, data FROM items_legacy;
      DROP TABLE items_legacy;
      COMMIT;
    `);
  }
  if (!columns("meta").includes("workspace_id")) {
    db.exec(`
      BEGIN;
      DROP TABLE IF EXISTS meta_legacy;
      ALTER TABLE meta RENAME TO meta_legacy;
      CREATE TABLE meta (
        workspace_id TEXT NOT NULL,
        k TEXT NOT NULL,
        v TEXT NOT NULL,
        PRIMARY KEY (workspace_id, k)
      );
      INSERT INTO meta (workspace_id, k, v)
        SELECT 'ws_demo', k, v FROM meta_legacy;
      DROP TABLE meta_legacy;
      COMMIT;
    `);
  }
  if (!columns("users").includes("workspace_id")) {
    db.exec("ALTER TABLE users ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'ws_demo'");
  }
  if (!columns("users").includes("email_verified_at")) {
    db.exec("ALTER TABLE users ADD COLUMN email_verified_at TEXT");
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_items_workspace ON items(workspace_id, kind);
    CREATE INDEX IF NOT EXISTS idx_items_kind ON items(kind);
  `);
}

migrate();

const upsert = db.prepare(
  "INSERT INTO items (workspace_id, kind, id, data) VALUES (?, ?, ?, ?) ON CONFLICT(workspace_id, kind, id) DO UPDATE SET data = excluded.data"
);
const insertMany = (kind, rows, workspaceId = currentWorkspaceId()) => {
  for (const row of rows) upsert.run(workspaceId, kind, row.id, JSON.stringify(row));
};

export function getMeta(key, fallback = null) {
  const row = db.prepare("SELECT v FROM meta WHERE workspace_id = ? AND k = ?").get(currentWorkspaceId(), key);
  return row ? JSON.parse(row.v) : fallback;
}

export function setMeta(key, value) {
  db.prepare(
    "INSERT INTO meta (workspace_id, k, v) VALUES (?, ?, ?) ON CONFLICT(workspace_id, k) DO UPDATE SET v = excluded.v"
  ).run(currentWorkspaceId(), key, JSON.stringify(value));
}

export function loadAll() {
  const rows = db.prepare("SELECT kind, data FROM items WHERE workspace_id = ?").all(currentWorkspaceId());
  const out = {
    obligations: [], agents: [], approvals: [], runs: [], providers: [], events: [], keys: [],
    receipts: [], escrows: [], outbox: [],
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
  upsert.run(currentWorkspaceId(), kind, item.id, JSON.stringify(item));
  return item;
}

export function workspacesWithKind(kind) {
  return db
    .prepare("SELECT DISTINCT workspace_id FROM items WHERE kind = ?")
    .all(kind)
    .map((row) => row.workspace_id);
}

export function putMany(kind, items) {
  insertMany(kind, items);
}

export function remove(kind, id) {
  db.prepare("DELETE FROM items WHERE workspace_id = ? AND kind = ? AND id = ?")
    .run(currentWorkspaceId(), kind, id);
}

// Key lookup happens before the request knows its workspace, so it scans every
// workspace. Seeded keys get unique secrets per workspace, so this is
// unambiguous.
export function findKeyBySecret(secret) {
  const digest = digestSecret(secret);
  const rows = db.prepare("SELECT workspace_id, data FROM items WHERE kind = 'keys'").all();
  for (const row of rows) {
    let key;
    try {
      key = JSON.parse(row.data);
    } catch {
      continue;
    }
    if (keyMatchesSecret(key, secret, digest)) return { key, workspace_id: row.workspace_id };
  }
  return null;
}

const USER_COLUMNS = [
  "id", "email", "name", "password_hash", "password_salt", "google_sub",
  "avatar_url", "wallet_address", "email_verified_at", "created_at", "last_login_at", "workspace_id",
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
  const workspaceId = user.workspace_id || `ws_${randomBytes(8).toString("hex")}`;
  db.prepare(`
    INSERT INTO users (id, email, name, password_hash, password_salt, google_sub, avatar_url, wallet_address, created_at, last_login_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    workspaceId,
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

export function deleteUser(id) {
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function verifiedEmails() {
  return db.prepare(
    "SELECT id, email, name FROM users WHERE workspace_id = ? AND email IS NOT NULL AND email_verified_at IS NOT NULL ORDER BY created_at"
  ).all(currentWorkspaceId());
}

export function deleteWorkspace(workspaceId) {
  db.prepare("DELETE FROM items WHERE workspace_id = ?").run(workspaceId);
  db.prepare("DELETE FROM meta WHERE workspace_id = ?").run(workspaceId);
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

export function deleteAuthSessionsForUser(userId) {
  db.prepare("DELETE FROM auth_sessions WHERE user_id = ?").run(userId);
}

export function createAuthToken({ tokenHash, userId, purpose, createdAt, expiresAt }) {
  db.prepare(`
    INSERT INTO auth_tokens (token_hash, user_id, purpose, created_at, expires_at, used)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(tokenHash, userId, purpose, createdAt, expiresAt);
}

export function deleteAuthTokensForUser(userId, purpose) {
  if (purpose) {
    db.prepare("DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?").run(userId, purpose);
    return;
  }
  db.prepare("DELETE FROM auth_tokens WHERE user_id = ?").run(userId);
}

export function consumeAuthToken(tokenHash, purpose) {
  const row = db.prepare(`
    SELECT token_hash, user_id, purpose, created_at, expires_at, used
    FROM auth_tokens WHERE token_hash = ?
  `).get(tokenHash);
  if (!row || row.used || row.purpose !== purpose) return null;
  if (row.expires_at <= new Date().toISOString()) return null;
  const claimed = db.prepare("UPDATE auth_tokens SET used = 1 WHERE token_hash = ? AND used = 0").run(tokenHash);
  if (!claimed.changes) return null;
  return row;
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
  db.prepare("DELETE FROM auth_tokens WHERE expires_at <= ?").run(now);
}

export function seeded() {
  return getMeta("seeded", false);
}

export function seedDatabase(force = false) {
  if (seeded() && !force) return false;
  const workspaceId = currentWorkspaceId();
  const isDemo = workspaceId === DEMO_WORKSPACE;
  const preserved = isDemo ? null : {
    workspace: getMeta("workspace", null),
    user: getMeta("user", null),
    plan: getMeta("plan", null),
    api_calls: getMeta("api_calls", null),
    usage_period: getMeta("usage_period", null),
  };
  db.prepare("DELETE FROM items WHERE workspace_id = ?").run(workspaceId);
  db.prepare("DELETE FROM meta WHERE workspace_id = ?").run(workspaceId);
  const seed = buildSeed(Date.now());
  let meta = seed.meta;
  if (!isDemo) {
    // A real workspace keeps its name, plan and metered usage across a reset,
    // and starts without the public demo credentials.
    seed.keys = [];
    meta = {
      workspace: preserved.workspace || seed.meta.workspace,
      user: preserved.user || seed.meta.user,
      plan: preserved.plan || "Free",
      clock_offset_days: 0,
      live: true,
      seed_now: seed.meta.seed_now,
      api_calls: preserved.api_calls ?? 0,
    };
    if (preserved.usage_period) meta.usage_period = preserved.usage_period;
  }
  for (const kind of [
    "obligations", "agents", "approvals", "runs", "providers", "events", "keys", "receipts", "escrows",
  ]) {
    insertMany(kind, seed[kind] || [], workspaceId);
  }
  for (const [key, value] of Object.entries(meta)) setMeta(key, value);
  setMeta("seeded", true);
  setMeta("created_at", new Date().toISOString());
  return true;
}

seedDatabase();
pruneAuth();

// Lifecycle hooks are no-ops for the local SQLite store. The Postgres store
// implements them to load and flush a request-scoped snapshot.
export const isPostgres = false;

export async function beginRequest() {
  return null;
}

export function runWithStore(_store, fn) {
  return fn();
}

export async function endRequest(_store) {
  // No request-scoped transaction in SQLite mode.
}

export async function abortRequest(_store) {
  // No request-scoped transaction in SQLite mode.
}
