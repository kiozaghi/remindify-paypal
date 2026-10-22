import {
  createHash, randomBytes, scryptSync, timingSafeEqual,
} from "node:crypto";
import { getAddress, isAddress, verifyMessage } from "viem";
import {
  consumeAuthChallenge, createAuthChallenge, createAuthSession, createUser,
  deleteAuthSession, findUserByEmail, findUserByGoogleSub, findUserByWallet,
  getAuthSession, updateUser,
} from "./db.mjs";

const SESSION_COOKIE = "remindify_session";
const OAUTH_COOKIE = "remindify_oauth";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const CHALLENGE_SECONDS = 60 * 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const attempts = new Map();

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function cleanEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function nameFromEmail(email) {
  const local = String(email || "").split("@")[0] || "Operator";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .slice(0, 80);
}

function walletName(address) {
  return `Wallet ${address.slice(0, 6)}…${address.slice(-4)}`;
}

function publicUser(user) {
  if (!user) return null;
  const providers = [];
  if (user.password_hash) providers.push("email");
  if (user.google_sub) providers.push("google");
  if (user.wallet_address) providers.push("wallet");
  return {
    id: user.id,
    name: user.name,
    email: user.email || null,
    avatar_url: user.avatar_url || null,
    wallet_address: user.wallet_address || null,
    providers,
    created_at: user.created_at,
  };
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

function passwordMatches(password, salt, expectedHex) {
  if (!salt || !expectedHex) return false;
  try {
    const actual = scryptSync(String(password), salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function appendCookie(res, cookie) {
  const current = res.getHeader("Set-Cookie");
  if (!current) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }
  res.setHeader("Set-Cookie", Array.isArray(current) ? [...current, cookie] : [current, cookie]);
}

function serializeCookie(req, name, value, { maxAge = SESSION_SECONDS, path = "/", httpOnly = true } = {}) {
  const bits = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
  ];
  if (httpOnly) bits.push("HttpOnly");
  const forwarded = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const secure = process.env.COOKIE_SECURE === "true"
    || (process.env.COOKIE_SECURE !== "false" && forwarded === "https");
  if (secure) bits.push("Secure");
  return bits.join("; ");
}

function startSession(req, res, userId) {
  const token = randomBytes(32).toString("base64url");
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  createAuthSession({ tokenHash: hashToken(token), userId, createdAt, expiresAt });
  appendCookie(res, serializeCookie(req, SESSION_COOKIE, token));
  return expiresAt;
}

export function getSessionFromRequest(req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = getAuthSession(tokenHash);
  if (!session) return null;
  return { tokenHash, user: publicUser(session.user) };
}

function limited(req, path, max = 20) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || "local";
  const key = `${path}:${ip}`;
  const now = Date.now();
  const bucket = attempts.get(key);
  if (!bucket || bucket.reset <= now) {
    attempts.set(key, { count: 1, reset: now + 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}

function originFor(req) {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN.replace(/\/$/, "");
  const forwarded = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = forwarded || (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${process.env.PORT || 4178}`;
  return `${proto}://${host}`;
}

function redirect(res, location, cookie) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  if (cookie) res.setHeader("Set-Cookie", cookie);
  res.end();
}

function normaliseNotice(code) {
  return encodeURIComponent(String(code || "auth_failed").slice(0, 60));
}

async function googleProfile(code, redirectUri) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("google_not_configured");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokens.access_token) {
    throw new Error(tokens.error_description || tokens.error || "google_token_failed");
  }

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await infoRes.json().catch(() => ({}));
  if (!infoRes.ok || !profile.sub || !profile.email) {
    throw new Error(profile.error_description || "google_profile_failed");
  }
  if (profile.email_verified === false || profile.email_verified === "false") {
    throw new Error("google_email_unverified");
  }
  return profile;
}

function findOrCreateGoogleUser(profile) {
  const email = cleanEmail(profile.email);
  let user = findUserByGoogleSub(profile.sub) || findUserByEmail(email);
  if (user) {
    const patch = { last_login_at: nowIso() };
    if (!user.google_sub) patch.google_sub = profile.sub;
    if (profile.picture && !user.avatar_url) patch.avatar_url = profile.picture;
    if (profile.name && !user.name) patch.name = String(profile.name).slice(0, 80);
    return updateUser(user.id, patch);
  }
  user = createUser({
    id: uid("usr"),
    email,
    name: String(profile.name || nameFromEmail(email)).slice(0, 80),
    google_sub: profile.sub,
    avatar_url: profile.picture || null,
    created_at: nowIso(),
    last_login_at: nowIso(),
  });
  return user;
}

function findOrCreateWalletUser(address) {
  let user = findUserByWallet(address);
  if (user) return updateUser(user.id, { last_login_at: nowIso() });
  user = createUser({
    id: uid("usr"),
    email: null,
    name: walletName(address),
    wallet_address: address,
    created_at: nowIso(),
    last_login_at: nowIso(),
  });
  return user;
}

function walletMessage(req, address, nonce) {
  const issuedAt = new Date().toISOString();
  return [
    "Remindify wants you to sign in with your Ethereum account:",
    address,
    "",
    "Sign in to Remindify. This request will not trigger a blockchain transaction or cost any gas.",
    "",
    `URI: ${originFor(req)}`,
    "Version: 1",
    "Chain ID: 8453",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

export async function handleAuthRoute(req, res, url, { send, body }) {
  const path = url.pathname;
  if (!path.startsWith("/api/auth/")) return false;

  if (path === "/api/auth/config" && req.method === "GET") {
    send(res, 200, {
      email: true,
      google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      wallet: true,
    });
    return true;
  }

  if (path === "/api/auth/session" && req.method === "GET") {
    const session = getSessionFromRequest(req);
    send(res, 200, { user: session?.user || null });
    return true;
  }

  if (path === "/api/auth/signup" && req.method === "POST") {
    if (limited(req, path, 10)) {
      send(res, 429, { error: "rate_limited", message: "Too many attempts. Wait a minute and try again." });
      return true;
    }
    const input = await body(req);
    const email = cleanEmail(input.email);
    const password = String(input.password || "");
    if (email.length > 254) {
      send(res, 422, { error: "invalid_email", message: "That email address is too long." });
      return true;
    }
    if (!EMAIL_RE.test(email)) {
      send(res, 422, { error: "invalid_email", message: "Enter a valid email address." });
      return true;
    }
    if (password.length < 8 || password.length > 256) {
      send(res, 422, { error: "weak_password", message: "Use a password between 8 and 256 characters." });
      return true;
    }
    if (findUserByEmail(email)) {
      send(res, 409, { error: "email_taken", message: "That email already has an account. Sign in instead." });
      return true;
    }
    const { salt, hash } = hashPassword(password);
    const user = createUser({
      id: uid("usr"),
      email,
      name: String(input.name || nameFromEmail(email)).trim().slice(0, 80) || nameFromEmail(email),
      password_hash: hash,
      password_salt: salt,
      created_at: nowIso(),
      last_login_at: nowIso(),
    });
    startSession(req, res, user.id);
    send(res, 201, { user: publicUser(user) });
    return true;
  }

  if (path === "/api/auth/login" && req.method === "POST") {
    if (limited(req, path, 20)) {
      send(res, 429, { error: "rate_limited", message: "Too many attempts. Wait a minute and try again." });
      return true;
    }
    const input = await body(req);
    const email = cleanEmail(input.email);
    const password = String(input.password || "");
    if (password.length > 256) {
      send(res, 401, { error: "invalid_credentials", message: "Email or password is incorrect." });
      return true;
    }
    const user = findUserByEmail(email);
    if (!user || !user.password_hash) {
      send(res, 401, {
        error: user?.google_sub && !user.password_hash ? "use_google" : "invalid_credentials",
        message: user?.google_sub && !user.password_hash
          ? "This account was created with Google. Continue with Google instead."
          : "Email or password is incorrect.",
      });
      return true;
    }
    if (!passwordMatches(password, user.password_salt, user.password_hash)) {
      send(res, 401, { error: "invalid_credentials", message: "Email or password is incorrect." });
      return true;
    }
    const fresh = updateUser(user.id, { last_login_at: nowIso() });
    startSession(req, res, user.id);
    send(res, 200, { user: publicUser(fresh) });
    return true;
  }

  if (path === "/api/auth/logout" && req.method === "POST") {
    const session = getSessionFromRequest(req);
    if (session) deleteAuthSession(session.tokenHash);
    appendCookie(res, serializeCookie(req, SESSION_COOKIE, "", { maxAge: 0 }));
    send(res, 200, { ok: true });
    return true;
  }

  if (path === "/api/auth/google" && req.method === "GET") {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      redirect(res, "/#/login?notice=google_not_configured");
      return true;
    }
    const state = randomBytes(24).toString("base64url");
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${originFor(req)}/api/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
      access_type: "online",
    });
    const cookie = serializeCookie(req, OAUTH_COOKIE, state, {
      maxAge: 600,
      path: "/api/auth/google",
    });
    redirect(res, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, cookie);
    return true;
  }

  if (path === "/api/auth/google/callback" && req.method === "GET") {
    const cleared = serializeCookie(req, OAUTH_COOKIE, "", {
      maxAge: 0,
      path: "/api/auth/google",
    });
    const expected = readCookie(req, OAUTH_COOKIE);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    if (!expected || !state || expected !== state || !code) {
      redirect(res, `/#/login?notice=${normaliseNotice("google_state")}`, cleared);
      return true;
    }
    try {
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${originFor(req)}/api/auth/google/callback`;
      const profile = await googleProfile(code, redirectUri);
      const user = findOrCreateGoogleUser(profile);
      startSession(req, res, user.id);
      appendCookie(res, cleared);
      redirect(res, "/#/today");
    } catch (error) {
      console.error("Google sign-in failed:", error.message);
      const notice = error.message === "google_not_configured" ? "google_not_configured" : "google_failed";
      redirect(res, `/#/login?notice=${normaliseNotice(notice)}`, cleared);
    }
    return true;
  }

  if (path === "/api/auth/wallet/challenge" && req.method === "POST") {
    if (limited(req, path, 30)) {
      send(res, 429, { error: "rate_limited", message: "Too many attempts. Wait a minute and try again." });
      return true;
    }
    const input = await body(req);
    if (!isAddress(String(input.address || ""))) {
      send(res, 422, { error: "invalid_address", message: "That wallet address doesn't look right." });
      return true;
    }
    const address = getAddress(input.address);
    const nonce = randomBytes(16).toString("hex");
    const message = walletMessage(req, address, nonce);
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + CHALLENGE_SECONDS * 1000).toISOString();
    createAuthChallenge({ nonce, address, message, createdAt, expiresAt });
    send(res, 200, { address, nonce, message, expires_at: expiresAt });
    return true;
  }

  if (path === "/api/auth/wallet/verify" && req.method === "POST") {
    if (limited(req, path, 30)) {
      send(res, 429, { error: "rate_limited", message: "Too many attempts. Wait a minute and try again." });
      return true;
    }
    const input = await body(req);
    if (!isAddress(String(input.address || ""))) {
      send(res, 422, { error: "invalid_address", message: "That wallet address doesn't look right." });
      return true;
    }
    const address = getAddress(input.address);
    const challenge = consumeAuthChallenge(String(input.nonce || ""), address);
    if (!challenge) {
      send(res, 401, { error: "challenge_expired", message: "The sign-in request expired. Please try again." });
      return true;
    }
    let valid = false;
    try {
      valid = await verifyMessage({
        address,
        message: challenge.message,
        signature: String(input.signature || ""),
      });
    } catch {
      valid = false;
    }
    if (!valid) {
      send(res, 401, { error: "invalid_signature", message: "That signature didn't verify. Please try again." });
      return true;
    }
    const user = findOrCreateWalletUser(address);
    startSession(req, res, user.id);
    send(res, 200, { user: publicUser(user) });
    return true;
  }

  send(res, 404, { error: "not_found", path });
  return true;
}

export { SESSION_COOKIE };
