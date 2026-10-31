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
    copy: "One register for both kinds of weight: the people you love and the money you can't lose. Owner, backup, proof.",
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
    copy: "EIP-712 receipts, optional Base or Celo anchoring, and USDC escrow that releases against proof. Everyday payments ride PayPal.",
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
      "Both sides of the register",
      "Community packs and templates",
      "Human + agent owners",
      "Proof vault and audit stream",
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
      "Community packs and marketplace hiring",
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
    a: "No. A reminder is a notification. An obligation has an owner, a backup, a risk score, an autonomy level, a proof requirement and an audit trail. Remindify is the register those things live in — and the place where the work can actually get done.",
  },
  {
    q: "Can it do the thing, or only remind me?",
    a: "Both. You can open the item and do it yourself, hand it to an agent you built, or hire a human or community agent from the marketplace for one job. You choose the ceiling: notify, prepare, approve or autopilot. Payment and escrow release against accepted proof.",
  },
  {
    q: "Can I use agents and packs other people made?",
    a: "Yes. Community packs cover things like love and connection, the school year, holidays, tax filings, home cover, subscriptions, caregiving and moving country. You import a pack, edit it, and it becomes yours. Community agents are held to the same scopes, ceilings and proof standard as your own.",
  },
  {
    q: "What does the blockchain actually add?",
    a: "A checkable record, when you need one. Completed work files a hashed EIP-712 proof receipt offchain. If a counterparty needs more than your word, anchor that hash to Base. If a provider needs to be paid on delivery, USDC sits in non-custodial escrow that releases only against a valid receipt. No documents onchain, no custody, no token. Ordinary payments do not need any of this — they ride PayPal.",
  },
  {
    q: "How do payments work?",
    a: "Two rails. Everyday money moves through PayPal: pay an obligation from your own PayPal account, or send a seller a payout, and the capture is filed as proof. USDC escrow is the optional onchain rail for work that must release against a signed receipt. Remindify records payments; it never holds a balance, a card or a private key.",
  },
  {
    q: "Do I need a wallet to use it?",
    a: "No. Sign in with email or Google, and pay through PayPal without ever creating a wallet. A wallet is only needed if you choose to sign a proof receipt yourself or fund USDC escrow.",
  },
  {
    q: "Do I need crypto at all?",
    a: "No. There is no token and nothing to buy. Crypto only appears if you choose to anchor a proof hash or fund an escrow on Base or Celo.",
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
    a: "The register, capture, agents and offchain proof work today. Wallet, escrow and PayPal routes are region-gated where the operator's rules require it, so those features stay offchain in Ethiopia until the National Bank of Ethiopia authorises virtual-asset activity. We do not pretend otherwise.",
  },
  {
    q: "Is the product live?",
    a: "This is a preview build. The core workspace is functional and every action writes to the live register. PayPal payments and seller payouts run against the sandbox; plan billing and onchain contracts are still being prepared. Pricing shown is preview pricing.",
  },
  {
    q: "What happens to my data?",
    a: "Your workspace is stored in the deployment's Postgres database; local development uses SQLite. Accounts and sessions live in separate tables. Capture parsing runs on the server without sending your text to a third party or to an AI model. Google sign-in is optional and uses Google's OAuth flow.",
  },
];

/** The two kinds of weight the register is built to carry. */
export const SIDES = [
  {
    key: "people",
    tone: "coral",
    icon: "heart",
    eyebrow: "The people side",
    title: "The things you can’t rebook.",
    lede: "A birthday. A school form. The call to your father you keep moving to next week. These don’t send an invoice. They just quietly cost you something you don’t get back.",
    items: [
      { title: "Mum’s birthday", meta: "People · gift + a real call · backup: Mira", due: "6d" },
      { title: "School fees — term 2", meta: "People · $850 · quarterly · paid by you", due: "12d" },
      { title: "Weekly call with Dad", meta: "People · Sundays · recurring · no backup", due: "2d" },
      { title: "Cousin’s graduation", meta: "People · travel + gift · not booked", due: "34d" },
    ],
    cost: "Miss one and the penalty isn’t a fee. It’s a look. A silence. A year.",
  },
  {
    key: "money",
    tone: "lime",
    icon: "wallet",
    eyebrow: "The money side",
    title: "The things that send an invoice.",
    lede: "Insurance. Filings. Subscriptions. Payroll. The boiler service. They don’t care that you were busy — they just charge you for it, or stop covering you at the worst possible moment.",
    items: [
      { title: "Warehouse insurance", meta: "Cover · $1,840 · annual · broker: Northline", due: "12d" },
      { title: "Company tax filing", meta: "Finance · with Ledger · proof: receipt", due: "21d" },
      { title: "Adobe + GitHub + Notion", meta: "Subscriptions · $51/mo · renewing", due: "auto" },
      { title: "Boiler service", meta: "Home · $90 · annual · last one: 2025", due: "45d" },
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
    icon: "wallet",
    tone: "coral",
    kind: "Guide",
    title: "Payments",
    copy: "PayPal Orders and Payouts, plus proof-gated USDC escrow.",
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
    name: "Love & connection",
    tagline: "The people you keep meaning to call.",
    curator: "@mira.builds",
    uses: 1284,
    count: 4,
    proof: "Booking, gift order or a note from the call",
    tone: "coral",
    icon: "heart",
    lens: "life",
  },
  {
    id: "family",
    name: "Family rhythm",
    tagline: "Terms, fees and the rituals you can’t rebook.",
    curator: "@hanna.b",
    uses: 2310,
    count: 3,
    proof: "School receipt or form confirmation",
    tone: "amber",
    icon: "calendar",
    lens: "life",
  },
  {
    id: "care",
    name: "Caregiving",
    tagline: "Medication, appointments, the check-in.",
    curator: "@nurse.ada",
    uses: 864,
    count: 4,
    proof: "Appointment note or prescription",
    tone: "teal",
    icon: "pill",
    lens: "life",
  },
  {
    id: "holidays",
    name: "Holidays & travel",
    tagline: "Passports before flights. Gifts before landing.",
    curator: "@thekinco",
    uses: 976,
    count: 4,
    proof: "Booking, itinerary or travel cover",
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
    name: "Home & vehicle",
    tagline: "The expensive things you only notice when they break.",
    curator: "@homeguard",
    uses: 1540,
    count: 4,
    proof: "Policy certificate or service invoice",
    tone: "amber",
    icon: "home",
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
    name: "Moving country",
    tagline: "Visa, address, utilities, school transfer.",
    curator: "@relocate.works",
    uses: 512,
    count: 4,
    proof: "Stamped form, confirmation or contract",
    tone: "blue",
    icon: "globe",
    lens: "money",
  },
] as const;

/** A self-audit: the weight people are already carrying without naming it. */
export const CARRYING = [
  { label: "A birthday I’m the only one tracking", side: "life" },
  { label: "School fees or a form due this term", side: "life" },
  { label: "A call to a parent I keep postponing", side: "life" },
  { label: "A trip or family event with no plan yet", side: "life" },
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
