// @procurement-bot.
//
// The agent's brain lives here: search Channel3, keep only verified offers
// that fit the passport ceiling, pick the lowest price, and hand the app a
// quote. The app creates the PayPal order because the agent never holds PayPal
// credentials — agents prepare, the workspace enforces, a human approves.

import { getMeta, loadAll, put, setMeta } from "./db.mjs";
import { searchChannel3 } from "./channel3.mjs";
import { createOrder } from "./paypal.mjs";
import { beginObligationPayment, findPayment } from "./payments.mjs";
import {
  PROCUREMENT_EXECUTOR_PATH,
  buildProcurementAgent,
  buildProcurementObligation,
} from "./procurement-seed.mjs";

export { PROCUREMENT_EXECUTOR_PATH };

const DEFAULT_CEILING = 150;
const ORDER_REUSE_MS = 2 * 3600000;

export function isProcurementAgent(agent) {
  return agent?.id === "ag_procurement" || agent?.handle === "procurement-bot";
}

export function procurementCeiling(agent, obligation) {
  const caps = [
    Number(agent?.spend_ceiling),
    Number(obligation?.procurement?.max_price),
  ].filter((value) => Number.isFinite(value) && value > 0);
  return caps.length ? Math.min(...caps) : DEFAULT_CEILING;
}

export function procurementQueries(obligation) {
  const configured = Array.isArray(obligation?.procurement?.queries)
    ? obligation.procurement.queries
    : [];
  const queries = configured.map((query) => String(query || "").trim()).filter(Boolean);
  return queries.length ? queries : [String(obligation?.title || "office supplies")];
}

function dedupe(offers) {
  const bySku = new Map();
  for (const offer of offers) {
    const key = offer.sku || `${offer.title}|${offer.merchant}`;
    const seen = bySku.get(key);
    if (!seen || Number(offer.price) < Number(seen.price)) bySku.set(key, offer);
  }
  return [...bySku.values()];
}

// Pure selection: verified, USD, at or under the ceiling, cheapest first.
export function pickLowestVerified(offers, ceiling) {
  return dedupe(offers)
    .filter((offer) => offer?.verified)
    .filter((offer) => Number.isFinite(Number(offer.price)) && Number(offer.price) > 0)
    .filter((offer) => String(offer.currency || "USD").toUpperCase() === "USD")
    .filter((offer) => Number(offer.price) <= ceiling)
    .sort((a, b) => Number(a.price) - Number(b.price) || Number(b.rating || 0) - Number(a.rating || 0));
}

export async function planProcurement({
  agent,
  obligation,
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const ceiling = procurementCeiling(agent, obligation);
  const queries = procurementQueries(obligation);
  const results = await Promise.all(
    queries.map(async (query) => ({
      query,
      ...(await searchChannel3({ query, maxPrice: ceiling, env, fetchImpl })),
    }))
  );

  const offers = [];
  for (const result of results) {
    if (!result.ok) continue;
    for (const offer of result.offers || []) offers.push({ ...offer, query: result.query });
  }

  const ranked = pickLowestVerified(offers, ceiling);
  const live = results.some((result) => result.ok && result.source === "channel3");
  const source = live ? "channel3" : "fixture";

  if (!ranked.length) {
    const failure = results.find((result) => !result.ok);
    return {
      ok: false,
      ceiling,
      source,
      queries,
      considered: offers.length,
      error: failure?.error
        || `No verified item under the $${ceiling.toFixed(2)} ceiling.`,
    };
  }

  const best = ranked[0];
  return {
    ok: true,
    ceiling,
    source,
    queries,
    considered: offers.length,
    quote: {
      ...best,
      source,
      query: best.query || queries[0],
      ceiling,
      quoted_at: new Date().toISOString(),
    },
  };
}

export function procurementProof(quote, { orderId } = {}) {
  if (!quote) return "Channel3 quote unavailable";
  const sample = quote.source === "fixture" ? "sample · " : "";
  const reference = orderId ? ` · PayPal ${orderId}` : "";
  return `Channel3 ${sample}${quote.sku} · ${quote.title} · $${Number(quote.price).toFixed(2)} at ${quote.merchant} · ${quote.url}${reference}`.slice(0, 300);
}

function orderIsFresh(restock, payment) {
  if (!restock?.paypal_order_id || !restock?.approve_url) return false;
  if (payment && payment.status !== "created") return false;
  const at = new Date(restock.order_created_at || 0).getTime();
  return Number.isFinite(at) && Date.now() - at < ORDER_REUSE_MS;
}

export async function ensureProcurementOrder({
  obligation,
  quote,
  origin,
  env = process.env,
} = {}) {
  const data = loadAll();
  const current = data.obligations.find((item) => item.id === obligation.id) || obligation;
  const payment = findPayment(data, { obligationId: current.id });

  if (orderIsFresh(current.restock, payment)) {
    return { ...current.restock, reused: true };
  }

  const order = await createOrder(
    {
      ...current,
      amount: Number(quote.price),
      currency: quote.currency || "USD",
      title: `Restock · ${quote.title}`,
    },
    {
      returnUrl: `${origin}/obligations?paypal=return`,
      cancelUrl: `${origin}/obligations?paypal=cancel`,
      env,
    }
  );

  const recorded = beginObligationPayment({
    obligation: current,
    orderId: order.orderId,
    amount: quote.price,
    currency: quote.currency || "USD",
  });

  const restock = {
    ...quote,
    paypal_order_id: order.orderId,
    order_status: order.status,
    approve_url: order.approveUrl,
    order_created_at: new Date().toISOString(),
    payment_id: recorded.id,
  };
  put("obligations", { ...current, restock });
  return restock;
}

// The capture arrives from PayPal, not from the agent, so the quote row has to
// be closed out here. Without it the drawer keeps offering an order that is
// already paid.
export function markRestockCaptured(orderId, { captureId } = {}) {
  const data = loadAll();
  const current = data.obligations.find(
    (item) => item.restock?.paypal_order_id === orderId
  );
  if (!current) return false;
  put("obligations", {
    ...current,
    restock: {
      ...current.restock,
      order_status: "COMPLETED",
      approve_url: null,
      capture_id: captureId || null,
      paid_at: new Date().toISOString(),
    },
  });
  return true;
}

// Existing workspaces were seeded before this agent existed. Add the rows once,
// without touching anything the workspace already has.
export function ensureProcurementDemo() {
  if (getMeta("procurement_demo", false)) return false;
  const data = loadAll();
  let changed = false;

  if (!data.agents.some((agent) => agent.id === "ag_procurement")) {
    put("agents", buildProcurementAgent());
    changed = true;
  }
  if (!data.obligations.some((obligation) => obligation.id === "ob_restock")) {
    put("obligations", buildProcurementObligation());
    changed = true;
  }

  setMeta("procurement_demo", true);
  return changed;
}
