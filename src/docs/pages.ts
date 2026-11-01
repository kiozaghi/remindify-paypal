import overview from "./content/overview.md?raw";
import quickstart from "./content/quickstart.md?raw";
import obligations from "./content/concepts-obligations.md?raw";
import agents from "./content/concepts-agents.md?raw";
import proof from "./content/concepts-proof-and-escrow.md?raw";
import workspaces from "./content/concepts-workspaces-and-keys.md?raw";
import agentTools from "./content/guides-agent-tools.md?raw";
import executors from "./content/guides-executors.md?raw";
import payments from "./content/guides-payments.md?raw";
import sellers from "./content/guides-sellers.md?raw";
import api from "./content/reference-api.md?raw";
import errors from "./content/reference-errors.md?raw";
import environment from "./content/reference-environment.md?raw";

export type DocsGroup = "Start" | "Concepts" | "Guides" | "Reference";

export type DocsPage = {
  slug: string;
  group: DocsGroup;
  label: string;
  title: string;
  description: string;
  keywords: string;
  body: string;
};

export const DOCS_GROUPS: DocsGroup[] = ["Start", "Concepts", "Guides", "Reference"];

export const DOCS_PAGES: DocsPage[] = [
  {
    slug: "",
    group: "Start",
    label: "Overview",
    title: "Developer docs",
    description:
      "Build on Remindify: the obligation register, agent passports, signed execution connectors, proof receipts, PayPal payments, escrow and marketplace guides.",
    keywords: "overview start introduction register api agents mcp payments paypal escrow",
    body: overview,
  },
  {
    slug: "quickstart",
    group: "Start",
    label: "Quickstart",
    title: "Quickstart",
    description:
      "Create an agent, issue a machine key and read, create and complete an obligation in ten minutes.",
    keywords: "quickstart first call curl api key machine obligation",
    body: quickstart,
  },
  {
    slug: "concepts/obligations",
    group: "Concepts",
    label: "Obligations",
    title: "Obligations",
    description:
      "The record at the center of Remindify: owner, backup, due date, recurrence, risk, autonomy and proof.",
    keywords: "obligation register due date recurrence risk autonomy owner backup proof",
    body: obligations,
  },
  {
    slug: "concepts/agents",
    group: "Concepts",
    label: "Agents and passports",
    title: "Agents and passports",
    description:
      "Give an agent a scoped identity, an autonomy ceiling, a connector and an audit trail.",
    keywords: "agent passport scopes autonomy ceiling connector runs trust",
    body: agents,
  },
  {
    slug: "concepts/proof-and-escrow",
    group: "Concepts",
    label: "Proof and escrow",
    title: "Proof receipts and escrow",
    description:
      "How completion becomes evidence: HMAC-SHA256 proof receipts, the Gemini proof auditor, PayPal authorization holds, capture and the fee split.",
    keywords: "proof receipt hmac sha256 auditor gemini paypal hold capture payout fee escrow release",
    body: proof,
  },
  {
    slug: "concepts/workspaces-and-keys",
    group: "Concepts",
    label: "Workspaces and keys",
    title: "Workspaces and machine keys",
    description:
      "How workspace isolation, bearer keys, scopes, expiry, rate limits, metering and idempotency fit together.",
    keywords: "workspace isolation machine key scope expiry rate limit metering idempotency",
    body: workspaces,
  },
  {
    slug: "guides/agent-tools",
    group: "Guides",
    label: "Agent tools and models",
    title: "Use Remindify with agent tools",
    description:
      "Recipes for OpenAI Agents SDK, Claude and Cursor over MCP, LangGraph, CrewAI, n8n and the Vercel AI SDK.",
    keywords: "openai agents sdk claude cursor mcp langgraph crewai n8n vercel ai sdk tools",
    body: agentTools,
  },
  {
    slug: "guides/executors",
    group: "Guides",
    label: "Execution connectors",
    title: "Build an execution connector",
    description:
      "Receive signed execution requests, verify HMAC signatures, return proof and handle retries and duplicate delivery.",
    keywords: "executor connector hmac signature webhook retry outbox idempotency proof",
    body: executors,
  },
  {
    slug: "guides/payments",
    group: "Guides",
    label: "Payments",
    title: "Payments: PayPal and escrow",
    description:
      "Settle an obligation with PayPal Orders, send a seller payout through PayPal Payouts, and release escrow from a PayPal authorization hold.",
    keywords: "paypal payment orders capture hold payout sellers webhook usd fiat money escrow fee",
    body: payments,
  },
  {
    slug: "guides/sellers",
    group: "Guides",
    label: "Sell on Remindify",
    title: "Sell on Remindify",
    description:
      "What sellers and human workers need to know: listings, proof standards, SLAs, fees and payouts.",
    keywords: "seller merchant marketplace provider human worker agent listing sla payout earnings",
    body: sellers,
  },
  {
    slug: "reference/api",
    group: "Reference",
    label: "REST API",
    title: "REST API reference",
    description:
      "Machine endpoints, scopes, headers, request bodies and response shapes for the Remindify API.",
    keywords: "api reference rest endpoints obligations risk trust receipts agents bearer scope",
    body: api,
  },
  {
    slug: "reference/errors",
    group: "Reference",
    label: "Errors",
    title: "Error reference",
    description:
      "Every documented Remindify error code, the HTTP status it uses and how to fix it.",
    keywords: "errors status codes troubleshooting unauthorized key expired scope plan limit",
    body: errors,
  },
  {
    slug: "reference/environment",
    group: "Reference",
    label: "Environment",
    title: "Environment variables",
    description:
      "Configuration for the server, database, auth, email, billing, machine API, connectors, schedulers, trust layer and region gating.",
    keywords: "environment variables configuration env deploy database auth email billing outbox cron trust",
    body: environment,
  },
];

export function docsSlug(slug?: string | null) {
  return String(slug || "").replace(/^\/+|\/+$/g, "");
}

export function docsPage(slug?: string | null) {
  const clean = docsSlug(slug);
  return DOCS_PAGES.find((page) => page.slug === clean) || null;
}

export function docsMeta(slug?: string | null) {
  const page = docsPage(slug);
  return page
    ? {
        label: page.label,
        title: page.slug ? `${page.title} — Remindify docs` : `${page.title} — Remindify`,
        description: page.description,
        index: true,
      }
    : {
        label: "Developer docs",
        title: "Developer docs — Remindify",
        description:
          "Build on Remindify: the obligation register, agent passports, signed execution connectors, proof receipts, PayPal payments, escrow and marketplace guides.",
        index: true,
      };
}

export function docsHref(slug?: string | null) {
  const clean = docsSlug(slug);
  return clean ? `/docs/${clean}` : "/docs";
}

export function docsNeighbours(slug?: string | null) {
  const index = DOCS_PAGES.findIndex((page) => page.slug === docsSlug(slug));
  if (index === -1) return { previous: null, next: null };
  return {
    previous: DOCS_PAGES[index - 1] || null,
    next: DOCS_PAGES[index + 1] || null,
  };
}
