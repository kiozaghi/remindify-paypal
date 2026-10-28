// Region gating for account creation and escrow movement.
//
// BLOCKED_COUNTRIES is an operator-supplied list of ISO 3166-1 alpha-2 codes.
// It is empty by default: a generic app cannot decide on its own which
// jurisdictions its operator may serve. Set it from your counsel or screening
// provider, for example BLOCKED_COUNTRIES=KP,IR,SY,CU.
//
// The country comes from the edge proxy header. Vercel, Cloudflare and most
// managed proxies set one. A request with no recognisable header is allowed,
// so local development and a self-hosted install without geo headers keep
// working. Only enable this behind a proxy you control; a direct client can
// send any header it likes.

const COUNTRY_HEADERS = ["x-vercel-ip-country", "cf-ipcountry", "x-country-code"];
const CODE_RE = /^[A-Z]{2}$/;
const UNKNOWN_CODES = new Set(["XX", "T1"]);

export function blockedCountries(env = process.env) {
  return new Set(
    String(env.BLOCKED_COUNTRIES || "")
      .split(/[\s,;]+/)
      .map((code) => code.trim().toUpperCase())
      .filter((code) => CODE_RE.test(code))
  );
}

export function requestCountry(req) {
  for (const name of COUNTRY_HEADERS) {
    const raw = req?.headers?.[name];
    const value = String(Array.isArray(raw) ? raw[0] : raw || "").trim().toUpperCase();
    if (CODE_RE.test(value) && !UNKNOWN_CODES.has(value)) return value;
  }
  return "";
}

export function jurisdictionFor(req, env = process.env) {
  const blocked = blockedCountries(env);
  const country = requestCountry(req);
  return {
    country,
    known: Boolean(country),
    configured: blocked.size > 0,
    blocked: Boolean(country && blocked.has(country)),
  };
}

export function regionBlocked(req, env = process.env) {
  return jurisdictionFor(req, env).blocked;
}

export const REGION_BLOCKED_MESSAGE =
  "Remindify isn't available in your region. Contact support if you believe this is a mistake.";
