// Channel3 product search.
//
// Channel3 (https://trychannel3.com) is a product graph for agents:
//
//   POST https://api.trychannel3.com/v1/search
//   x-api-key: <key>
//   { "query": "...", "filters": { "price": { "max": 150 } }, "limit": 8 }
//
// Responses are normalised here so the procurement agent sees one offer shape
// whether it is talking to Channel3 or to the local sample catalog. The sample
// catalog is labelled `fixture` and never claims to be live data.

const DEFAULT_BASE = "https://api.trychannel3.com";
const TIMEOUT_MS = 8000;

export function channel3Configured(env = process.env) {
  return Boolean(String(env.CHANNEL3_API_KEY || "").trim());
}

export function channel3Base(env = process.env) {
  return String(env.CHANNEL3_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
}

// Deterministic sample catalog for local runs without a key. Prices and
// merchants are invented; the quote copy says "sample" wherever it surfaces.
const SAMPLE_CATALOG = [
  {
    query: ["toner", "printer"],
    id: "CH3-TN450-2PK",
    title: "Brother TN-450 High-Yield Toner (2-pack)",
    brand: "Brother",
    price: 89.99,
    merchant: "Office Depot Business",
    domain: "officedepot.com",
    image: "https://images.example.com/channel3/tn450-2pk.jpg",
    rating: 4.7,
    availability: "in_stock",
  },
  {
    query: ["toner", "printer"],
    id: "CH3-TN450-1PK",
    title: "Brother TN-450 Toner Cartridge (single)",
    brand: "Brother",
    price: 64.5,
    merchant: "Staples Business",
    domain: "staples.com",
    image: "https://images.example.com/channel3/tn450-1pk.jpg",
    rating: 4.4,
    availability: "in_stock",
  },
  {
    query: ["backup", "drive", "ssd"],
    id: "CH3-SD-1TB",
    title: "SanDisk Extreme 1TB Portable SSD",
    brand: "SanDisk",
    price: 109.99,
    merchant: "B&H Photo Video",
    domain: "bhphotovideo.com",
    image: "https://images.example.com/channel3/sd-1tb.jpg",
    rating: 4.8,
    availability: "in_stock",
  },
  {
    query: ["backup", "drive", "ssd"],
    id: "CH3-ST-2TB",
    title: "Seagate One Touch 2TB Backup Drive",
    brand: "Seagate",
    price: 149.99,
    merchant: "Best Buy Business",
    domain: "bestbuy.com",
    image: "https://images.example.com/channel3/st-2tb.jpg",
    rating: 4.2,
    availability: "in_stock",
  },
  {
    query: ["toner", "printer"],
    id: "CH3-HP-26A",
    title: "HP 26A Black Toner (compatible)",
    brand: "HP",
    price: 172,
    merchant: "CDW",
    domain: "cdw.com",
    image: "https://images.example.com/channel3/hp-26a.jpg",
    rating: 4.1,
    availability: "in_stock",
  },
];

function asNumber(value) {
  if (value && typeof value === "object") value = value.value ?? value.amount ?? value.max;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstOffer(product) {
  const offers = Array.isArray(product?.offers) ? product.offers : [];
  return offers.find((offer) => asNumber(offer?.price) !== null) || offers[0] || {};
}

function normalizeTitle(product) {
  return String(product?.title || product?.name || "").trim();
}

function normalizeUrl(product, offer) {
  const candidates = [
    offer?.url,
    offer?.link,
    offer?.product_url,
    product?.url,
    product?.product_url,
  ];
  return String(candidates.find((value) => typeof value === "string" && /^https?:\/\//i.test(value)) || "");
}

function normalizeAvailability(value) {
  if (value === false) return "out_of_stock";
  if (typeof value === "string" && /out of stock|unavailable|discontinued|sold out|backorder/i.test(value)) {
    return "out_of_stock";
  }
  if (typeof value === "string" && value.trim()) return value.trim().toLowerCase().replace(/\s+/g, "_");
  return "in_stock";
}

// One normalised offer. `verified` is the procurement agent's bar: a product
// id, a positive price, an https merchant URL and availability that is not
// explicitly out of stock. Channel3 prices without a merchant link are not
// purchasable, so they never qualify.
export function normalizeOffer(product) {
  const offer = firstOffer(product);
  const price = asNumber(offer?.price) ?? asNumber(product?.price) ?? asNumber(product?.lowest_price);
  const url = normalizeUrl(product, offer);
  const title = normalizeTitle(product);
  const sku = String(product?.id || product?.sku || product?.product_id || "").trim();
  const image = product?.images?.[0]?.url
    || product?.images?.[0]
    || product?.image_url
    || product?.image
    || offer?.image
    || "";
  const rating = asNumber(product?.ratings?.value)
    ?? asNumber(product?.ratings)
    ?? asNumber(product?.rating?.value)
    ?? asNumber(product?.rating);
  const merchant = String(
    offer?.merchant?.name
    || offer?.merchant_name
    || offer?.domain
    || product?.brands?.[0]?.name
    || product?.brand?.name
    || ""
  ).trim();

  const availability = normalizeAvailability(offer?.availability ?? product?.availability);
  return {
    sku,
    title,
    brand: String(product?.brands?.[0]?.name || product?.brand?.name || product?.brand || "").trim(),
    price,
    currency: String(offer?.currency || offer?.price?.currency || product?.currency || "USD").toUpperCase(),
    merchant: merchant || (url ? new URL(url).hostname.replace(/^www\./, "") : ""),
    url,
    image: typeof image === "string" ? image : "",
    rating,
    availability,
    verified: Boolean(sku && title && Number.isFinite(price) && price > 0 && /^https?:\/\//i.test(url) && availability !== "out_of_stock"),
  };
}

function sampleOffers(query, maxPrice) {
  const words = String(query || "").toLowerCase();
  return SAMPLE_CATALOG
    .filter((item) => item.query.some((keyword) => words.includes(keyword)))
    .map((item) => normalizeOffer({
      id: item.id,
      title: item.title,
      brands: [{ name: item.brand }],
      images: [{ url: item.image }],
      ratings: { value: item.rating },
      offers: [{
        price: item.price,
        currency: "USD",
        url: `https://${item.domain}/p/${item.id.toLowerCase()}`,
        domain: item.domain,
        availability: item.availability,
      }],
    }))
    .filter((offer) => !maxPrice || (offer.price && offer.price <= maxPrice));
}

function productsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export async function searchChannel3({
  query,
  maxPrice,
  limit = 8,
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const text = String(query || "").trim();
  if (!text) return { ok: false, source: "channel3", error: "A product query is required." };

  if (!channel3Configured(env)) {
    return {
      ok: true,
      source: "fixture",
      offers: sampleOffers(text, maxPrice),
      note: "Sample catalog. Set CHANNEL3_API_KEY for live Channel3 results.",
    };
  }

  const payload = { query: text, limit: Math.min(20, Math.max(1, Number(limit) || 8)) };
  if (Number.isFinite(maxPrice) && maxPrice > 0) {
    payload.filters = { price: { max: maxPrice } };
  }

  try {
    const response = await fetchImpl(`${channel3Base(env)}/v1/search`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": String(env.CHANNEL3_API_KEY).trim(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        source: "channel3",
        status: response.status,
        error: `Channel3 answered ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`,
      };
    }

    const json = await response.json();
    return {
      ok: true,
      source: "channel3",
      offers: productsFrom(json).map(normalizeOffer),
    };
  } catch (error) {
    return {
      ok: false,
      source: "channel3",
      error: error?.name === "TimeoutError"
        ? `Channel3 timed out after ${TIMEOUT_MS}ms.`
        : `Channel3 unreachable (${error?.code || error?.message || "network error"}).`,
    };
  }
}
