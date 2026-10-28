// API key helpers shared by the stores, the HTTP layer and the state builder.
//
// Keys issued today are stored as a SHA-256 digest plus a display prefix. The
// only time the full secret leaves the server is the creation response. Seeded
// demo keys keep their plaintext secret so the public demo keeps working; code
// that reads a key should treat `secret` as optional.
import { createHash, timingSafeEqual } from "node:crypto";

export const KEY_SCOPES = [
  "obligations:read",
  "obligations:write",
  "risk:read",
  "agents:read",
];

export function digestSecret(secret) {
  return createHash("sha256").update(String(secret)).digest("hex");
}

function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function keyMatchesSecret(key, secret, digest = digestSecret(secret)) {
  if (!key) return false;
  if (key.secret_hash) return sameSecret(key.secret_hash, digest);
  if (key.secret) return sameSecret(key.secret, String(secret));
  return false;
}

export function publicKey(key) {
  if (!key) return null;
  const { secret, secret_hash, ...rest } = key;
  return rest;
}
