// Counterparty screening.
//
// Optional sanctions provider seam for money movement. When
// SANCTIONS_API_URL is set, the app POSTs { "addresses": [...] } and expects
// { "hits": [{ "address", "reason" }] } (a bare array of strings is accepted
// too). A provider failure is allowed by default so the register keeps
// working; set SANCTIONS_FAIL_CLOSED=1 to refuse movement instead.

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function sanctionsConfigured(env = process.env) {
  return Boolean(env.SANCTIONS_API_URL);
}

function failClosed(env) {
  return env.SANCTIONS_FAIL_CLOSED === "1";
}

function normaliseHits(payload) {
  if (!payload) return [];
  if (payload.sanctioned === true && !Array.isArray(payload.hits)) {
    return [{ address: "", reason: String(payload.reason || "listed") }];
  }
  const raw = Array.isArray(payload.hits) ? payload.hits : [];
  return raw.map((hit) => {
    if (typeof hit === "string") return { address: hit, reason: "listed" };
    return {
      address: String(hit?.address || ""),
      reason: String(hit?.reason || "listed"),
    };
  });
}

export async function screenAddresses(addresses, env = process.env) {
  const url = env.SANCTIONS_API_URL;
  if (!url) return { configured: false, ok: true, checked: [], hits: [] };

  const checked = [...new Set(
    (addresses || [])
      .map((address) => String(address || "").trim())
      .filter((address) => ADDRESS_RE.test(address))
  )];
  if (!checked.length) return { configured: true, ok: true, checked: [], hits: [] };

  const headers = {
    "content-type": "application/json",
    "user-agent": "Remindify-Screen/1",
  };
  if (env.SANCTIONS_API_KEY) headers.authorization = `Bearer ${env.SANCTIONS_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ addresses: checked }),
      signal: AbortSignal.timeout(Number(env.SANCTIONS_TIMEOUT_MS) || 5000),
    });
    if (!response.ok) throw new Error(`sanctions_${response.status}`);
    const hits = normaliseHits(await response.json());
    return { configured: true, ok: hits.length === 0, checked, hits };
  } catch {
    return { configured: true, ok: !failClosed(env), checked, hits: [], unavailable: true };
  }
}
