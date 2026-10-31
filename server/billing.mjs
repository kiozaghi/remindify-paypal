// Plan limits and usage metering.
//
// There is no payment provider wired up yet, so this module deliberately stops
// at entitlements: each workspace has a plan, a key allowance and a monthly
// machine-call allowance, and usage is metered in the workspace's own meta.
// Plan changes are refused unless an operator opts in (BILLING_ALLOW_PLAN_SWITCH)
// or a provider is connected later.
import { getMeta, setMeta } from "./db.mjs";

export const PLANS = {
  free: { key: "free", name: "Personal", price: 0, currency: "USD", key_limit: 3, call_limit: 500 },
  studio: { key: "studio", name: "Studio", price: 18, currency: "USD", key_limit: 25, call_limit: 50_000 },
  operator: { key: "operator", name: "Operator", price: 48, currency: "USD", key_limit: 100, call_limit: 500_000 },
};

export function currentPeriod(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function planForWorkspace() {
  const raw = String(getMeta("plan", "Free")).trim().toLowerCase();
  return PLANS[raw] || PLANS.free;
}

export function usage() {
  const period = currentPeriod();
  const stored = getMeta("usage_period", null);
  if (stored && stored !== period) return { period, calls: 0 };
  return { period, calls: Number(getMeta("api_calls", 0)) || 0 };
}

// Counts one machine call against the current month. Returns allowed=false
// without writing when the plan's allowance is spent.
export function meterApiCall() {
  const plan = planForWorkspace();
  const { period, calls } = usage();
  if (calls >= plan.call_limit) {
    return { allowed: false, calls, limit: plan.call_limit, period, plan };
  }
  const next = calls + 1;
  setMeta("api_calls", next);
  setMeta("usage_period", period);
  return { allowed: true, calls: next, limit: plan.call_limit, period, plan };
}

export function billingSummary() {
  const plan = planForWorkspace();
  const { period, calls } = usage();
  return {
    plan: plan.key,
    plan_name: plan.name,
    price: plan.price,
    currency: plan.currency,
    period,
    calls,
    call_limit: plan.call_limit,
    key_limit: plan.key_limit,
    provider: process.env.STRIPE_SECRET_KEY ? "stripe" : "unset",
  };
}

export function keyLimitReached(keyCount) {
  return keyCount >= planForWorkspace().key_limit;
}

export function canSwitchPlans() {
  return process.env.BILLING_ALLOW_PLAN_SWITCH === "1" || process.env.BILLING_MODE === "demo";
}

export function setPlan(name) {
  const plan = PLANS[String(name || "").toLowerCase()];
  if (!plan) return null;
  setMeta("plan", plan.name);
  return plan;
}
