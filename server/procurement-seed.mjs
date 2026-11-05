// Seed rows for @procurement-bot. Kept separate from seed.mjs so the
// idempotent ensure step can add the same rows to workspaces that were seeded
// before this agent existed, without importing the database layer in a cycle.

import { randomBytes } from "node:crypto";

const DAY = 86400000;
export const PROCUREMENT_EXECUTOR_PATH = "/api/procurement";

function executorSecret() {
  return `rfy_exec_${randomBytes(24).toString("hex")}`;
}

export function buildProcurementAgent(now = Date.now()) {
  const at = (days) => new Date(now + days * DAY).toISOString();
  const past = (mins) => new Date(now - mins * 60000).toISOString();
  return {
    id: "ag_procurement",
    name: "Procurement",
    handle: "procurement-bot",
    role: "Office & hardware restock",
    initials: "PB",
    tone: "lime",
    description:
      "Restocks the office inside a $150 passport ceiling. Searches Channel3 for the lowest-priced verified item, attaches the SKU and merchant URL as the quote, and asks for the PayPal order.",
    capabilities: ["search", "compare", "quote", "order"],
    autonomy_ceiling: "approve",
    spend_ceiling: 150,
    trust: 92,
    cost_per_run: 0,
    status: "active",
    scopes: ["catalog:read", "orders:draft", "receipts:write"],
    executor_url: PROCUREMENT_EXECUTOR_PATH,
    executor_secret: executorSecret(),
    last_active: past(110),
    created_at: at(-60),
  };
}

export function buildProcurementObligation(now = Date.now()) {
  const at = (days, hours = 0) => new Date(now + days * DAY + hours * 3600000).toISOString();
  return {
    id: "ob_restock",
    title: "Quarterly printer toner & backup drive replacement",
    category: "work",
    provider: "Channel3 verified merchants",
    owner: "Procurement",
    owner_kind: "agent",
    agent_id: "ag_procurement",
    backup: "Hanna Bekele",
    amount: 150,
    penalty: 40,
    currency: "USD",
    due_at: at(5, 10),
    recurrence: { unit: "quarter", interval: 1 },
    status: "active",
    autonomy: "autopilot",
    severity: 2,
    confidence: 0.95,
    proof_required: "Channel3 quote (SKU + merchant URL) and PayPal order",
    consequence: "The printer stops mid-run and the quarterly backup never leaves the studio.",
    notes:
      "Budget is $150 per quarter. Buy the lowest-priced verified item that fits; the other line rolls to the next run.",
    source: "template",
    channel: "paypal",
    grace_days: 1,
    checklist: [
      "Search Channel3 for verified stock",
      "Check the $150 passport ceiling",
      "Approve the PayPal order",
      "Capture and file the receipt",
    ],
    procurement: {
      queries: ["printer toner cartridge", "portable backup drive"],
      max_price: 150,
      pick: "lowest",
    },
    created_at: at(-40),
  };
}
