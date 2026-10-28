// Database facade.
//
// Local development and Docker use SQLite (`node:sqlite`) on a persistent
// volume. Vercel uses Postgres because serverless functions do not have a
// writable, persistent disk. Set DATABASE_URL (or Vercel's POSTGRES_URL) to
// switch to the Postgres store.
//
// The Postgres store loads a request-scoped snapshot inside a transaction and
// flushes it before the response ends. That keeps the existing synchronous
// engine and trust code unchanged while making every request durable.

const connectionString = process.env.DATABASE_URL
  || process.env.POSTGRES_URL
  || process.env.POSTGRES_PRISMA_URL
  || process.env.POSTGRES_URL_NON_POOLING
  || "";

export const isPostgres = Boolean(connectionString);

const impl = isPostgres
  ? await import("./db-postgres.mjs")
  : await import("./db-sqlite.mjs");

export const DATA_DIR = impl.DATA_DIR || null;

export const getMeta = (...args) => impl.getMeta(...args);
export const setMeta = (...args) => impl.setMeta(...args);
export const loadAll = (...args) => impl.loadAll(...args);
export const put = (...args) => impl.put(...args);
export const putMany = (...args) => impl.putMany(...args);
export const remove = (...args) => impl.remove(...args);
export const findKeyBySecret = (...args) => impl.findKeyBySecret(...args);

export const getUser = (...args) => impl.getUser(...args);
export const findUserByEmail = (...args) => impl.findUserByEmail(...args);
export const findUserByGoogleSub = (...args) => impl.findUserByGoogleSub(...args);
export const findUserByWallet = (...args) => impl.findUserByWallet(...args);
export const createUser = (...args) => impl.createUser(...args);
export const updateUser = (...args) => impl.updateUser(...args);

export const createAuthSession = (...args) => impl.createAuthSession(...args);
export const getAuthSession = (...args) => impl.getAuthSession(...args);
export const deleteAuthSession = (...args) => impl.deleteAuthSession(...args);
export const deleteAuthSessionsForUser = (...args) => impl.deleteAuthSessionsForUser(...args);
export const createAuthToken = (...args) => impl.createAuthToken(...args);
export const deleteAuthTokensForUser = (...args) => impl.deleteAuthTokensForUser(...args);
export const consumeAuthToken = (...args) => impl.consumeAuthToken(...args);
export const createAuthChallenge = (...args) => impl.createAuthChallenge(...args);
export const consumeAuthChallenge = (...args) => impl.consumeAuthChallenge(...args);
export const pruneAuth = (...args) => impl.pruneAuth(...args);

export const seeded = (...args) => impl.seeded(...args);
export const seedDatabase = (...args) => impl.seedDatabase(...args);

export const beginRequest = (...args) => impl.beginRequest(...args);
export const runWithStore = (...args) => impl.runWithStore(...args);
export const endRequest = (...args) => impl.endRequest(...args);
export const abortRequest = (...args) => impl.abortRequest(...args);
