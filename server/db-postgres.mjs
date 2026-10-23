import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import { buildSeed } from "./seed.mjs";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL
  || process.env.POSTGRES_URL
  || process.env.POSTGRES_PRISMA_URL
  || process.env.POSTGRES_URL_NON_POOLING
  || "";

// Keep certificate verification on. Vercel, Neon and Supabase connection
// strings include `sslmode=require`; use DATABASE_SSL=false only for a local
// Postgres that does not speak TLS.
const ssl = process.env.DATABASE_SSL === "false" ? false : undefined;

const pool = globalThis.__remindifyPool || new Pool({
  connectionString,
  ssl,
  max: Number(process.env.PG_POOL_MAX || 2),
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: true,
});

pool.on?.("error", (error) => {
  console.error("Postgres pool error:", error);
});

const als = new AsyncLocalStorage();
let schemaPromise = null;

export const DATA_DIR = null;
export const isPostgres = true;

const USER_COLUMNS = [
  "id", "email", "name", "password_hash", "password_salt", "google_sub",
  "avatar_url", "wallet_address", "created_at", "last_login_at",
];
const USER_COLUMNS_SQL = USER_COLUMNS.join(", ");
const ITEM_KINDS = [
  "obligations", "agents", "approvals", "runs", "providers", "events",
  "keys", "receipts", "escrows",
];

// One workspace, one serialized writer. This keeps the existing single-tenant
// demo semantics intact while requests are spread across serverless instances.
const WORKSPACE_LOCK = 728394;

function itemKey(kind, id) {
  return `${kind}\u0000${id}`;
}

function splitItemKey(key) {
  const index = key.indexOf("\u0000");
  return { kind: key.slice(0, index), id: key.slice(index + 1) };
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function requireStore() {
  const store = als.getStore();
  if (!store) throw new Error("Postgres store accessed outside a request");
  return store;
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS app_items (
    kind text NOT NULL,
    id text NOT NULL,
    data jsonb NOT NULL,
    PRIMARY KEY (kind, id)
  )`,
  `CREATE TABLE IF NOT EXISTS app_meta (
    k text PRIMARY KEY,
    v jsonb NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    email text UNIQUE,
    name text NOT NULL,
    password_hash text,
    password_salt text,
    google_sub text UNIQUE,
    avatar_url text,
    wallet_address text UNIQUE,
    created_at text NOT NULL,
    last_login_at text
  )`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash text PRIMARY KEY,
    user_id text NOT NULL,
    created_at text NOT NULL,
    expires_at text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS auth_challenges (
    nonce text PRIMARY KEY,
    address text NOT NULL,
    message text NOT NULL,
    created_at text NOT NULL,
    expires_at text NOT NULL,
    used integer NOT NULL DEFAULT 0
  )`,
  "CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at)",
  "CREATE INDEX IF NOT EXISTS idx_auth_challenges_address ON auth_challenges(address)",
];

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      for (const statement of SCHEMA_STATEMENTS) await pool.query(statement);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

export async function beginRequest() {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (process.env.PG_NO_LOCK !== "1") {
      await client.query("SELECT pg_advisory_xact_lock($1)", [WORKSPACE_LOCK]);
    }

    const items = await client.query("SELECT kind, id, data FROM app_items");
    const meta = await client.query("SELECT k, v FROM app_meta");
    const users = await client.query(`SELECT ${USER_COLUMNS_SQL} FROM users`);
    const sessions = await client.query("SELECT token_hash, user_id, created_at, expires_at FROM auth_sessions");
    const challenges = await client.query("SELECT nonce, address, message, created_at, expires_at, used FROM auth_challenges");

    const store = {
      client,
      finished: false,
      resetItems: false,
      items: new Map(),
      meta: new Map(),
      users: new Map(),
      usersByEmail: new Map(),
      usersByGoogleSub: new Map(),
      usersByWallet: new Map(),
      sessions: new Map(),
      challenges: new Map(),
      dirtyItems: new Set(),
      deletedItems: new Set(),
      dirtyMeta: new Set(),
      deletedMeta: new Set(),
      dirtyUsers: new Set(),
      deletedUsers: new Set(),
      dirtySessions: new Set(),
      deletedSessions: new Set(),
      dirtyChallenges: new Set(),
      deletedChallenges: new Set(),
    };

    for (const row of items.rows) {
      store.items.set(itemKey(row.kind, row.id), {
        kind: row.kind,
        id: row.id,
        data: row.data,
      });
    }
    for (const row of meta.rows) store.meta.set(row.k, row.v);
    for (const row of users.rows) {
      const user = { ...row };
      store.users.set(user.id, user);
      indexUser(store, user);
    }
    for (const row of sessions.rows) store.sessions.set(row.token_hash, { ...row });
    for (const row of challenges.rows) store.challenges.set(row.nonce, { ...row });

    return store;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    throw error;
  }
}

export function runWithStore(store, fn) {
  if (!store) return fn();
  return als.run(store, fn);
}

function indexUser(store, user) {
  if (user.email) store.usersByEmail.set(String(user.email).toLowerCase(), user);
  if (user.google_sub) store.usersByGoogleSub.set(String(user.google_sub), user);
  if (user.wallet_address) store.usersByWallet.set(String(user.wallet_address).toLowerCase(), user);
}

function unindexUser(store, user) {
  if (user.email && store.usersByEmail.get(String(user.email).toLowerCase())?.id === user.id) {
    store.usersByEmail.delete(String(user.email).toLowerCase());
  }
  if (user.google_sub && store.usersByGoogleSub.get(String(user.google_sub))?.id === user.id) {
    store.usersByGoogleSub.delete(String(user.google_sub));
  }
  if (user.wallet_address && store.usersByWallet.get(String(user.wallet_address).toLowerCase())?.id === user.id) {
    store.usersByWallet.delete(String(user.wallet_address).toLowerCase());
  }
}

export async function abortRequest(store) {
  if (!store || store.finished) return;
  store.finished = true;
  const { client } = store;
  try {
    await client.query("ROLLBACK");
  } catch (error) {
    console.error("Postgres rollback failed:", error);
  } finally {
    client.release();
  }
}

export async function endRequest(store) {
  if (!store || store.finished) return;
  store.finished = true;
  const { client } = store;
  try {
    if (store.resetItems) {
      await client.query("DELETE FROM app_items");
      await client.query("DELETE FROM app_meta");
      for (const row of store.items.values()) {
        await client.query(
          "INSERT INTO app_items (kind, id, data) VALUES ($1, $2, $3::jsonb)",
          [row.kind, row.id, JSON.stringify(row.data)],
        );
      }
      for (const [key, value] of store.meta) {
        await client.query(
          "INSERT INTO app_meta (k, v) VALUES ($1, $2::jsonb)",
          [key, JSON.stringify(value)],
        );
      }
    } else {
      for (const key of store.deletedItems) {
        const { kind, id } = splitItemKey(key);
        await client.query("DELETE FROM app_items WHERE kind = $1 AND id = $2", [kind, id]);
      }
      for (const key of store.dirtyItems) {
        const row = store.items.get(key);
        if (!row) continue;
        await client.query(
          "INSERT INTO app_items (kind, id, data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (kind, id) DO UPDATE SET data = EXCLUDED.data",
          [row.kind, row.id, JSON.stringify(row.data)],
        );
      }
      for (const key of store.deletedMeta) {
        await client.query("DELETE FROM app_meta WHERE k = $1", [key]);
      }
      for (const key of store.dirtyMeta) {
        if (!store.meta.has(key)) continue;
        await client.query(
          "INSERT INTO app_meta (k, v) VALUES ($1, $2::jsonb) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v",
          [key, JSON.stringify(store.meta.get(key))],
        );
      }
    }

    for (const id of store.deletedUsers) {
      await client.query("DELETE FROM users WHERE id = $1", [id]);
    }
    for (const id of store.dirtyUsers) {
      const user = store.users.get(id);
      if (!user) continue;
      await client.query(`
        INSERT INTO users (${USER_COLUMNS_SQL})
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          password_salt = EXCLUDED.password_salt,
          google_sub = EXCLUDED.google_sub,
          avatar_url = EXCLUDED.avatar_url,
          wallet_address = EXCLUDED.wallet_address,
          created_at = EXCLUDED.created_at,
          last_login_at = EXCLUDED.last_login_at
      `, USER_COLUMNS.map((column) => user[column] ?? null));
    }

    for (const tokenHash of store.deletedSessions) {
      await client.query("DELETE FROM auth_sessions WHERE token_hash = $1", [tokenHash]);
    }
    for (const tokenHash of store.dirtySessions) {
      const session = store.sessions.get(tokenHash);
      if (!session) continue;
      await client.query(`
        INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (token_hash) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          created_at = EXCLUDED.created_at,
          expires_at = EXCLUDED.expires_at
      `, [session.token_hash, session.user_id, session.created_at, session.expires_at]);
    }

    for (const nonce of store.deletedChallenges) {
      await client.query("DELETE FROM auth_challenges WHERE nonce = $1", [nonce]);
    }
    for (const nonce of store.dirtyChallenges) {
      const challenge = store.challenges.get(nonce);
      if (!challenge) continue;
      await client.query(`
        INSERT INTO auth_challenges (nonce, address, message, created_at, expires_at, used)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (nonce) DO UPDATE SET
          address = EXCLUDED.address,
          message = EXCLUDED.message,
          created_at = EXCLUDED.created_at,
          expires_at = EXCLUDED.expires_at,
          used = EXCLUDED.used
      `, [
        challenge.nonce,
        challenge.address,
        challenge.message,
        challenge.created_at,
        challenge.expires_at,
        challenge.used,
      ]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function getMeta(key, fallback = null) {
  const store = requireStore();
  return store.meta.has(key) ? clone(store.meta.get(key)) : fallback;
}

export function setMeta(key, value) {
  const store = requireStore();
  store.meta.set(key, clone(value));
  store.dirtyMeta.add(key);
  store.deletedMeta.delete(key);
}

export function loadAll() {
  const store = requireStore();
  const out = {
    obligations: [], agents: [], approvals: [], runs: [], providers: [], events: [], keys: [],
    receipts: [], escrows: [],
  };
  for (const row of store.items.values()) {
    if (out[row.kind]) out[row.kind].push(clone(row.data));
  }
  out.obligations.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  out.events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  out.runs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  out.approvals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return out;
}

export function put(kind, item) {
  const store = requireStore();
  const key = itemKey(kind, item.id);
  store.items.set(key, { kind, id: item.id, data: clone(item) });
  store.dirtyItems.add(key);
  store.deletedItems.delete(key);
  return item;
}

export function putMany(kind, items) {
  for (const item of items) put(kind, item);
}

export function remove(kind, id) {
  const store = requireStore();
  const key = itemKey(kind, id);
  store.items.delete(key);
  store.dirtyItems.delete(key);
  store.deletedItems.add(key);
}

export function getUser(id) {
  const store = requireStore();
  const user = store.users.get(id);
  return user ? { ...user } : null;
}

export function findUserByEmail(email) {
  const store = requireStore();
  const user = store.usersByEmail.get(String(email).toLowerCase());
  return user ? { ...user } : null;
}

export function findUserByGoogleSub(sub) {
  const store = requireStore();
  const user = store.usersByGoogleSub.get(String(sub));
  return user ? { ...user } : null;
}

export function findUserByWallet(address) {
  const store = requireStore();
  const user = store.usersByWallet.get(String(address).toLowerCase());
  return user ? { ...user } : null;
}

export function createUser(user) {
  const store = requireStore();
  const row = {
    id: user.id,
    email: user.email ? String(user.email).toLowerCase() : null,
    name: user.name,
    password_hash: user.password_hash || null,
    password_salt: user.password_salt || null,
    google_sub: user.google_sub || null,
    avatar_url: user.avatar_url || null,
    wallet_address: user.wallet_address || null,
    created_at: user.created_at,
    last_login_at: user.last_login_at || null,
  };
  if (row.email && store.usersByEmail.has(row.email)) throw new Error("email_taken");
  if (row.google_sub && store.usersByGoogleSub.has(row.google_sub)) throw new Error("google_taken");
  if (row.wallet_address && store.usersByWallet.has(row.wallet_address.toLowerCase())) {
    throw new Error("wallet_taken");
  }
  store.users.set(row.id, row);
  indexUser(store, row);
  store.dirtyUsers.add(row.id);
  store.deletedUsers.delete(row.id);
  return { ...row };
}

export function updateUser(id, patch) {
  const store = requireStore();
  const previous = store.users.get(id);
  if (!previous) return null;
  const next = { ...previous };
  for (const key of Object.keys(patch)) {
    if (USER_COLUMNS.includes(key)) next[key] = patch[key];
  }
  next.email = next.email ? String(next.email).toLowerCase() : null;

  if (next.email) {
    const other = store.usersByEmail.get(next.email);
    if (other && other.id !== id) throw new Error("email_taken");
  }
  if (next.google_sub) {
    const other = store.usersByGoogleSub.get(String(next.google_sub));
    if (other && other.id !== id) throw new Error("google_taken");
  }
  if (next.wallet_address) {
    const other = store.usersByWallet.get(String(next.wallet_address).toLowerCase());
    if (other && other.id !== id) throw new Error("wallet_taken");
  }

  unindexUser(store, previous);
  store.users.set(id, next);
  indexUser(store, next);
  store.dirtyUsers.add(id);
  return { ...next };
}

export function createAuthSession({ tokenHash, userId, createdAt, expiresAt }) {
  const store = requireStore();
  store.sessions.set(tokenHash, {
    token_hash: tokenHash,
    user_id: userId,
    created_at: createdAt,
    expires_at: expiresAt,
  });
  store.dirtySessions.add(tokenHash);
  store.deletedSessions.delete(tokenHash);
}

export function getAuthSession(tokenHash) {
  const store = requireStore();
  const session = store.sessions.get(tokenHash);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    store.sessions.delete(tokenHash);
    store.dirtySessions.delete(tokenHash);
    store.deletedSessions.add(tokenHash);
    return null;
  }
  const user = store.users.get(session.user_id);
  return user ? { ...session, user: { ...user } } : null;
}

export function deleteAuthSession(tokenHash) {
  const store = requireStore();
  store.sessions.delete(tokenHash);
  store.dirtySessions.delete(tokenHash);
  store.deletedSessions.add(tokenHash);
}

export function createAuthChallenge({ nonce, address, message, createdAt, expiresAt }) {
  const store = requireStore();
  store.challenges.set(nonce, {
    nonce,
    address,
    message,
    created_at: createdAt,
    expires_at: expiresAt,
    used: 0,
  });
  store.dirtyChallenges.add(nonce);
  store.deletedChallenges.delete(nonce);
}

export function consumeAuthChallenge(nonce, address) {
  const store = requireStore();
  const challenge = store.challenges.get(nonce);
  if (!challenge || challenge.used || challenge.expires_at <= new Date().toISOString()) return null;
  if (challenge.address.toLowerCase() !== String(address).toLowerCase()) return null;
  const next = { ...challenge, used: 1 };
  store.challenges.set(nonce, next);
  store.dirtyChallenges.add(nonce);
  return { ...next };
}

export function pruneAuth() {
  const store = requireStore();
  const now = new Date().toISOString();
  for (const [tokenHash, session] of store.sessions) {
    if (session.expires_at <= now) {
      store.sessions.delete(tokenHash);
      store.dirtySessions.delete(tokenHash);
      store.deletedSessions.add(tokenHash);
    }
  }
  for (const [nonce, challenge] of store.challenges) {
    if (challenge.expires_at <= now) {
      store.challenges.delete(nonce);
      store.dirtyChallenges.delete(nonce);
      store.deletedChallenges.add(nonce);
    }
  }
}

export function seeded() {
  return getMeta("seeded", false);
}

export function seedDatabase(force = false) {
  const store = requireStore();
  if (seeded() && !force) return false;
  store.items.clear();
  store.meta.clear();
  store.dirtyItems.clear();
  store.deletedItems.clear();
  store.dirtyMeta.clear();
  store.deletedMeta.clear();
  store.resetItems = true;
  const seed = buildSeed(Date.now());
  for (const kind of ITEM_KINDS) {
    for (const item of seed[kind] || []) put(kind, item);
  }
  for (const [key, value] of Object.entries(seed.meta)) setMeta(key, value);
  setMeta("seeded", true);
  setMeta("created_at", new Date().toISOString());
  return true;
}
