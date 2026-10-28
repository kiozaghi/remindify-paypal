import type { AppRoute } from "../lib/router";

export const PRODUCTS: Array<{
  route: AppRoute;
  icon: string;
  title: string;
  copy: string;
  tone: string;
  badge: string;
}> = [
  {
    route: "today",
    icon: "today",
    title: "Today",
    copy: "The morning read: what is closest to the edge, what an agent handled, and what actually needs you.",
    tone: "lime",
    badge: "The calm start",
  },
  {
    route: "obligations",
    icon: "list",
    title: "Obligations",
    copy: "One register for renewals, filings, payroll, people and the boiler service. Owner, backup, proof.",
    tone: "amber",
    badge: "The register",
  },
  {
    route: "capture",
    icon: "sparkle",
    title: "Capture",
    copy: "Paste a letter, a school email or a messy note. A deterministic parser turns prose into a structured obligation. No AI API required.",
    tone: "violet",
    badge: "From mess to model",
  },
  {
    route: "agents",
    icon: "bot",
    title: "Agents",
    copy: "Not chatbots. Operators with a passport: scopes, autonomy ceiling, trust and a perfect little paper trail.",
    tone: "teal",
    badge: "The bench",
  },
  {
    route: "market",
    icon: "store",
    title: "Marketplace",
    copy: "Vetted humans and agents side by side. Hire for one obligation, with scoped access and payment on proof.",
    tone: "coral",
    badge: "Extra hands",
  },
  {
    route: "activity",
    icon: "pulse",
    title: "Proof",
    copy: "An immutable event stream of who did what, with which scope, and what evidence was filed afterwards.",
    tone: "blue",
    badge: "The audit trail",
  },
  {
    route: "trust",
    icon: "shield",
    title: "Trust layer",
    copy: "EIP-712 receipts, optional Base or Celo anchoring, and USDC escrow that releases against proof.",
    tone: "violet",
    badge: "Base-first",
  },
  {
    route: "access",
    icon: "key",
    title: "Agent access",
    copy: "The same register over a machine API and MCP. Keys, scopes and guardrails for software that acts.",
    tone: "ink",
    badge: "Machine-readable",
  },
];

export const PLANS = [
  {
    id: "personal",
    name: "Personal",
    price: "$0",
    cadence: "while in preview",
    line: "For the life admin one person is quietly holding together.",
    features: [
      "Up to 25 live obligations",
      "Human + agent owners",
      "Proof vault and audit stream",
      "Capture from pasted text",
      "Email and wallet sign-in",
    ],
    cta: "Start free",
    tone: "paper",
  },
  {
    id: "studio",
    name: "Studio",
    price: "$18",
    cadence: "/ month after preview",
    line: "For a solo business, a household with staff, or a very full plate.",
    features: [
      "Unlimited obligations",
      "Agent passports and autonomy ceilings",
      "Marketplace hiring with escrow",
      "Shared workspace and backups",
      "Proof receipts and export",
      "Priority support from a human",
    ],
    cta: "Join the preview",
    tone: "ink",
    featured: true,
  },
  {
    id: "operator",
    name: "Operator",
    price: "$48",
    cadence: "/ month after preview",
    line: "For small teams who need one source of truth for recurring work.",
    features: [
      "Everything in Studio",
      "Unlimited seats and agent keys",
      "Scoped machine API + MCP",
      "Custom proof requirements",
      "Base / Celo anchoring controls",
      "Onboarding and migration help",
    ],
    cta: "Talk to us",
    tone: "lime",
  },
];

export const FAQS = [
  {
    q: "Is this another reminder app?",
    a: "No. A reminder is a notification. An obligation has an owner, a backup, a risk score, an autonomy level, a proof requirement and an audit trail. Remindify is the register those things live in.",
  },
  {
    q: "Do I need a wallet to use it?",
    a: "No. Remindify is wallet-optional. You can sign in with email or Google and keep everything offchain. Wallet sign-in exists for people who want it. USDC escrow is only used when a contract is configured and you explicitly choose it.",
  },
  {
    q: "What is actually onchain?",
    a: "Only what you choose to anchor: a hashed proof receipt, or an escrow transaction. Documents are never uploaded. There is no token, no custody and no server-held key. The default is offchain.",
  },
  {
    q: "Why Base? Why Celo?",
    a: "Base is the long-term ecosystem for the proof and escrow module. Celo is the near-term pilot because of its mobile-first, emerging-market fit. One EVM module, reused across both.",
  },
  {
    q: "Does it work in Ethiopia?",
    a: "The register, capture, agents and offchain proof work today. Wallet and payment features remain offchain in Ethiopia until the National Bank of Ethiopia authorises virtual-asset activity. We do not pretend otherwise.",
  },
  {
    q: "Is the product live?",
    a: "This is a preview build. The core workspace is functional and every action writes to the live register. Billing, paid workspaces and onchain contracts are still being prepared. Pricing shown is preview pricing.",
  },
  {
    q: "What happens to my data?",
    a: "Your workspace is stored in the deployment's Postgres database; local development uses SQLite. Accounts and sessions live in separate tables. Capture parsing runs on the server without sending your text to a third party or to an AI model. Google sign-in is optional and uses Google's OAuth flow.",
  },
];

export const CHAPTERS = [
  { id: "story", label: "The leak" },
  { id: "chapter-one", label: "The letter" },
  { id: "chapter-two", label: "The owner" },
  { id: "chapter-three", label: "The bench" },
  { id: "chapter-four", label: "The proof" },
  { id: "chapter-five", label: "The Monday" },
  { id: "product", label: "The rooms" },
];
