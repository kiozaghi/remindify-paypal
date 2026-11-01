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
    copy: "One register for recurring business work: vendor renewals, compliance filings, contractor deliverables and invoice collections. Owner, backup, proof.",
    tone: "amber",
    badge: "The register",
  },
  {
    route: "capture",
    icon: "sparkle",
    title: "Capture",
    copy: "Paste a vendor email, a filing notice or a messy note. Gemini extracts the obligation, payee and proof requirement; a deterministic parser is the fallback.",
    tone: "violet",
    badge: "From mess to model",
  },
  {
    route: "agents",
    icon: "bot",
    title: "Agents",
    copy: "Build your own operators, or borrow one. Every agent has a passport: scopes, autonomy ceiling, trust and a paper trail.",
    tone: "teal",
    badge: "Your bench",
  },
  {
    route: "market",
    icon: "store",
    title: "Marketplace",
    copy: "Community-built agents and vetted humans, side by side. Hire for one obligation, with scoped access and payment released on accepted proof.",
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
    copy: "HMAC-signed receipts, an AI auditor that reads the evidence, and PayPal holds that release only on a verified proof. The fee is 10%, taken when money settles.",
    tone: "violet",
    badge: "PayPal-only",
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
    id: "solo",
    name: "Solo",
    price: "$0",
    cadence: "while in preview",
    line: "For the founder who is the whole back office.",
    features: [
      "Up to 25 live obligations",
      "Both books of the register",
      "Community packs and templates",
      "Human + agent owners",
      "AI proof audit and HMAC receipts",
      "Email and Google sign-in",
    ],
    cta: "Start free",
    tone: "paper",
  },
  {
    id: "studio",
    name: "Studio",
    price: "$18",
    cadence: "/ month after preview",
    line: "For a founder with a contractor bench and a very full plate.",
    features: [
      "Unlimited obligations",
      "Agent passports and autonomy ceilings",
      "Community packs and marketplace hiring",
      "Shared workspace and backups",
      "Proof receipts, export and a 10% fee on settled work",
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
      "PayPal hold and payout controls",
      "Onboarding and migration help",
    ],
    cta: "Talk to us",
    tone: "lime",
  },
];

export const FAQS = [
  {
    q: "Is this another reminder app?",
    a: "No. A reminder is a notification. An obligation has an owner, a backup, a risk score, an autonomy level, a proof requirement and an audit trail. Remindify is the register those things live in — and the place where the work can actually get done.",
  },
  {
    q: "Can it do the thing, or only remind me?",
    a: "Both. You can open the item and do it yourself, hand it to an agent you built, or hire a human or community agent from the marketplace for one job. You choose the ceiling: notify, prepare, approve or autopilot. The PayPal hold releases only against accepted proof.",
  },
  {
    q: "Can I use agents and packs other people made?",
    a: "Yes. Community packs cover things like US and EU tax filings, vendor onboarding, security reviews, facilities inspections, subscriptions and cross-border compliance. You import a pack, edit it, and it becomes yours. Community agents are held to the same scopes, ceilings and proof standard as your own.",
  },
  {
    q: "What does the proof layer actually add?",
    a: "A checkable record, and a gate on the money. Completed work files a receipt signed by the server with HMAC-SHA256 over the obligation id, the actor, the proof hash and the completion time. A PayPal hold releases only when the evidence behind that receipt is verified. If a counterparty needs more than your word, the receipt is the answer.",
  },
  {
    q: "How do payments work?",
    a: "PayPal only. You pay an obligation from your own PayPal account, and seller payouts go through PayPal Payouts to the provider's PayPal email. Remindify never holds a balance, a card or a private key. It records the payment and files the proof.",
  },
  {
    q: "How does escrow work?",
    a: "The payer approves a PayPal authorization hold for up to 29 days. Nothing is captured at that point. When a proof is verified, PayPal captures the hold, the 10% platform fee is deducted, and the provider is paid the net to their PayPal email. A rejected proof leaves the hold untouched.",
  },
  {
    q: "What does the AI proof auditor do?",
    a: "Gemini 2.5 Flash reads the evidence and scores it against the obligation's amount, reference and date, returning a confidence score and any discrepancies. Anything below 80% is not treated as verified. If no model key is configured, the same checks run as deterministic rules.",
  },
  {
    q: "What is in a proof receipt?",
    a: "An HMAC-SHA256 signature by the server over the obligation id, the actor, the proof hash and the completion time. Receipts move through four states: filed, verified, rejected and settled. A receipt can be checked against the server, and no extra app or key is needed.",
  },
  {
    q: "What happens when a proof is rejected?",
    a: "The payer's hold stays exactly where it is. The provider sees the auditor's discrepancies and can file better evidence against the same obligation. Money moves only on a verified proof.",
  },
  {
    q: "Does it work in Ethiopia?",
    a: "The register, capture, agents and proof receipts work today. PayPal payments and payouts are available where PayPal operates; where they are not, you can still track the obligation and file proof of work done outside the app. We do not pretend otherwise.",
  },
  {
    q: "Is the product live?",
    a: "This is a preview build. The core workspace is functional and every action writes to the live register. PayPal payments, holds and seller payouts run against the sandbox; plan billing is still being prepared. Pricing shown is preview pricing.",
  },
  {
    q: "What happens to my data?",
    a: "Your workspace is stored in the deployment's Postgres database; local development uses SQLite. Accounts and sessions live in separate tables. Capture sends the text or document you paste to Gemini 2.5 Flash when a model key is configured, and uses the server-side parser when it is not. The proof auditor also sends the evidence you file to Gemini for scoring, with a deterministic fallback. Google sign-in is optional and uses Google's OAuth flow.",
  },
];

/** The two kinds of weight the register is built to carry. */
export const SIDES = [
  {
    key: "people",
    tone: "coral",
    icon: "heart",
    eyebrow: "The vendor side",
    title: "The people who do the work.",
    lede: "A contractor you keep chasing. A deliverable stuck in review. The specialist whose invoice sits unsigned. These don’t bill on a schedule, but the work stalls every time they slip.",
    items: [
      { title: "Kestrel pen-test sign-off", meta: "Vendor · $350 held · proof: scan report", due: "6d" },
      { title: "Contractor W-9 refresh", meta: "Vendor · 3 contractors · backup: Hanna", due: "12d" },
      { title: "Apex Q4 filing", meta: "Vendor · $180 hold authorized", due: "7d" },
      { title: "Addis generator inspection", meta: "Facilities · $120 · photo proof", due: "34d" },
    ],
    cost: "Miss one and the penalty isn’t a fee. It’s a stalled launch, a lapsed contract, a vendor who stops picking up.",
  },
  {
    key: "money",
    tone: "lime",
    icon: "wallet",
    eyebrow: "The money side",
    title: "The things that send an invoice.",
    lede: "Insurance. Filings. Payroll. Subscriptions. The tools and cover that bill on a schedule. They don’t care that you were busy — they just charge you for it, or stop covering you at the worst possible moment.",
    items: [
      { title: "Warehouse insurance", meta: "Cover · $1,840 · annual · broker: Northline", due: "12d" },
      { title: "Company tax filing", meta: "Finance · with Ledger · proof: receipt", due: "21d" },
      { title: "Adobe + GitHub + Notion", meta: "Subscriptions · $51/mo · renewing", due: "auto" },
      { title: "Quarterly VAT filing", meta: "Finance · 3 entities · proof: stamped receipt", due: "45d" },
    ],
    cost: "Miss one and the penalty is a fee, a fine, a lapsed policy, or a month of paying twice.",
  },
] as const;

/** Remembering is the floor. This is what happens after the nudge. */
export const DELEGATION = [
  {
    step: "01",
    tone: "ink",
    icon: "user",
    title: "Do it yourself",
    copy: "The next step is already written down: who to call, what to send, what counts as done. You act, then file the proof in one move.",
    tag: "you",
  },
  {
    step: "02",
    tone: "teal",
    icon: "bot",
    title: "Delegate to your agent",
    copy: "Build an operator for your own recurring work, or start from the bench. It drafts, files, chases or pays — inside the ceiling you set.",
    tag: "your bench",
  },
  {
    step: "03",
    tone: "violet",
    icon: "store",
    title: "Hire the community",
    copy: "Borrow a marketplace agent or a human specialist for one obligation. Fixed price, scoped access, payment released when the proof is accepted.",
    tag: "community",
  },
] as const;

/** Where builders land when they want the register inside their own stack. */
export const DEV_DOCS = [
  {
    slug: "concepts/agents",
    icon: "bot",
    tone: "violet",
    kind: "Concept",
    title: "Agents and passports",
    copy: "Scopes, an autonomy ceiling and a paper trail for every run.",
  },
  {
    slug: "guides/agent-tools",
    icon: "command",
    tone: "teal",
    kind: "Guide",
    title: "MCP and agent tools",
    copy: "Wire the register into Claude, Cursor, LangGraph or n8n.",
  },
  {
    slug: "guides/executors",
    icon: "webhook",
    tone: "amber",
    kind: "Guide",
    title: "Execution connectors",
    copy: "Receive signed requests at an HTTPS endpoint and return proof.",
  },
  {
    slug: "guides/payments",
    icon: "send",
    tone: "coral",
    kind: "Guide",
    title: "Payments",
    copy: "PayPal Orders, Payouts and authorization holds, released on a verified proof.",
  },
  {
    slug: "reference/api",
    icon: "terminal",
    tone: "blue",
    kind: "Reference",
    title: "REST API",
    copy: "Endpoints, scopes, headers and error codes in one place.",
  },
] as const;

/** Curated packs people can import instead of starting from a blank register. */
export const COMMUNITY_PACKS = [
  {
    id: "love",
    name: "Vendor onboarding",
    tagline: "W-9s, contracts and insurance certificates.",
    curator: "@mira.builds",
    uses: 1284,
    count: 4,
    proof: "Signed W-9, contract or certificate of insurance",
    tone: "coral",
    icon: "users",
    lens: "life",
  },
  {
    id: "family",
    name: "Contractor bench",
    tagline: "Statements of work, milestones and renewals.",
    curator: "@hanna.b",
    uses: 2310,
    count: 3,
    proof: "Signed SOW or milestone acceptance",
    tone: "amber",
    icon: "briefcase",
    lens: "life",
  },
  {
    id: "care",
    name: "Workplace safety",
    tagline: "Inspections, drills and equipment tags.",
    curator: "@safety.desk",
    uses: 864,
    count: 4,
    proof: "Inspection tag photo or signed work order",
    tone: "teal",
    icon: "shield",
    lens: "life",
  },
  {
    id: "holidays",
    name: "Travel & secondments",
    tagline: "Staff visas before flights. Cover before landing.",
    curator: "@thekinco",
    uses: 976,
    count: 4,
    proof: "Visa stamp, booking or travel cover",
    tone: "lime",
    icon: "globe",
    lens: "life",
  },
  {
    id: "tax",
    name: "Tax & filings",
    tagline: "The deadlines with penalties attached.",
    curator: "@ledger.collective",
    uses: 3102,
    count: 4,
    proof: "Filed return + payment receipt",
    tone: "violet",
    icon: "scale",
    lens: "money",
  },
  {
    id: "cover",
    name: "Cover & facilities",
    tagline: "The expensive things you only notice when they break.",
    curator: "@homeguard",
    uses: 1540,
    count: 4,
    proof: "Policy certificate or service invoice",
    tone: "amber",
    icon: "briefcase",
    lens: "money",
  },
  {
    id: "subs",
    name: "Subscription audit",
    tagline: "Stop paying for the same thing twice.",
    curator: "@trim.club",
    uses: 2888,
    count: 4,
    proof: "Cancellation or renewal confirmation",
    tone: "lime",
    icon: "repeat",
    lens: "money",
  },
  {
    id: "moving",
    name: "Entity expansion",
    tagline: "Registrations, local counsel, utilities.",
    curator: "@relocate.works",
    uses: 512,
    count: 4,
    proof: "Stamped registration or local counsel receipt",
    tone: "blue",
    icon: "globe",
    lens: "money",
  },
] as const;

/** A self-audit: the weight people are already carrying without naming it. */
export const CARRYING = [
  { label: "A contractor deliverable I’m chasing", side: "life" },
  { label: "A filing I’m not sure actually landed", side: "life" },
  { label: "An invoice I keep forgetting to send", side: "money" },
  { label: "A vendor whose price quietly jumped", side: "life" },
  { label: "An insurance renewal I think is on auto-pay", side: "money" },
  { label: "A subscription I forgot I had", side: "money" },
  { label: "A tax or filing deadline", side: "money" },
  { label: "A service, MOT or repair that’s nearly due", side: "money" },
] as const;


export const CHAPTERS = [
  { id: "story", label: "The leak" },
  { id: "two-sides", label: "Two sides" },
  { id: "chapter-one", label: "The letter" },
  { id: "chapter-two", label: "The owner" },
  { id: "chapter-three", label: "The doers" },
  { id: "packs", label: "The packs" },
  { id: "chapter-four", label: "The proof" },
  { id: "chapter-five", label: "The Monday" },
  { id: "product", label: "The rooms" },
  { id: "developers", label: "The API" },
];
