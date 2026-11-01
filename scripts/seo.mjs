/**
 * Post-build discovery files.
 *
 * Vite emits the client bundle and an SSR bundle. This script renders every
 * public page to static HTML, writes noindex shells for the app and auth
 * routes, then generates sitemap.xml, robots.txt and llms.txt / llms-full.txt.
 *
 * Canonical origin: PUBLIC_ORIGIN (set in Vercel), with a production fallback.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const origin = (process.env.PUBLIC_ORIGIN || "https://remindify-paypal.vercel.app").replace(/\/+$/, "");
const builtAt = new Date().toISOString().slice(0, 10);

const seo = await import(pathToFileURL(join(root, "dist-ssr", "entry-server.js")).href);
const {
  CONTENT_PAGES, SHELL_PAGES, PAGE_META,
  FAQS, PLANS, PRODUCTS, SIDES, DELEGATION, COMMUNITY_PACKS,
  DOCS_PAGES, docsHref,
  renderPage, headTags, routePath, canonicalFor,
} = seo;

const templatePath = join(dist, "index.html");
const templateCache = join(root, "dist-ssr", "index.template.html");
const SEO_BLOCK = /<!--seo-start-->[\s\S]*?<!--seo-end-->/;

let template = await readFile(templatePath, "utf8");
if (!SEO_BLOCK.test(template)) {
  // The script already ran once and replaced the markers; reuse the pristine copy.
  template = await readFile(templateCache, "utf8");
}
await writeFile(templateCache, template);
if (!SEO_BLOCK.test(template)) {
  throw new Error("SEO markers missing from the Vite index.html template");
}

const verification = {
  google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  bing: process.env.BING_SITE_VERIFICATION || undefined,
};

function htmlFor(page, body, slug) {
  return template
    .replace(SEO_BLOCK, () => headTags(page, origin, { verification }, slug))
    .replace(
      '<div id="root"></div>',
      `<div id="root">${body}</div>`,
    );
}

async function writeRoute(path, html) {
  const file = path === "/"
    ? join(dist, "index.html")
    : join(dist, path.replace(/^\//, ""), "index.html");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
}

// ---------- Prerendered public pages ----------
for (const page of CONTENT_PAGES) {
  await writeRoute(routePath(page), htmlFor(page, renderPage(page)));
}

// ---------- Developer docs ----------
await writeRoute(docsHref(""), htmlFor("docs", renderPage("docs"), ""));
for (const doc of DOCS_PAGES) {
  if (!doc.slug) continue;
  await writeRoute(docsHref(doc.slug), htmlFor("docs", renderPage("docs", doc.slug), doc.slug));
}

// ---------- App and auth shells (noindex, hydrated on the client) ----------
for (const page of SHELL_PAGES) {
  await writeRoute(routePath(page), htmlFor(page, ""));
}

// ---------- Sitemap ----------
const sitemapEntries = [
  ...CONTENT_PAGES.map((page) => ({
    loc: canonicalFor(page, origin),
    priority: page === "home" ? "1.0" : page === "pricing" ? "0.9" : "0.7",
    changefreq: page === "home" || page === "pricing" ? "weekly" : "monthly",
  })),
  ...DOCS_PAGES.map((doc) => ({
    loc: canonicalFor("docs", origin, doc.slug),
    priority: doc.slug ? "0.6" : "0.8",
    changefreq: "monthly",
  })),
  { loc: `${origin}/demo`, priority: "0.6", changefreq: "monthly" },
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map((entry) => `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${builtAt}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join("\n")}
</urlset>
`;
await writeFile(join(dist, "sitemap.xml"), sitemap);

// ---------- robots.txt ----------
const privatePaths = [
  ...SHELL_PAGES.filter((page) => !["login", "signup"].includes(page)),
  "login",
  "signup",
];
const robots = `# Remindify — public pages are open to search engines and AI crawlers.
User-agent: *
Allow: /
Disallow: /api/
${[...new Set(privatePaths)].map((page) => `Disallow: ${routePath(page)}`).join("\n")}

Sitemap: ${origin}/sitemap.xml
`;
await writeFile(join(dist, "robots.txt"), robots);

// ---------- llms.txt ----------
const pageIndex = CONTENT_PAGES.map((page) => {
  const meta = PAGE_META[page];
  return `- [${meta.label}](${canonicalFor(page, origin)}): ${meta.description}`;
}).join("\n");

const docsIndex = DOCS_PAGES.map((doc) => {
  return `- [${doc.label}](${canonicalFor("docs", origin, doc.slug)}): ${doc.description}`;
}).join("\n");

const llms = `# Remindify

> Remindify is the governance, risk and proof-gated escrow layer for PayPal agentic commerce. Vendor renewals, compliance filings, contractor deliverables and invoice collections, with agents that carry spending ceilings, humans who sign off, and verifiable proof before money moves.

Remindify is a web application for operators and small teams. Every recurring obligation has one owner, one backup, a risk score, an autonomy level, a spending ceiling, a proof requirement and an audit trail. The product is in private preview; billing is not enabled.

Key facts:
- Two books, one register: vendors (contractors, specialist merchants, deliverables) and compliance (filings, insurance, payroll, subscriptions).
- Remind, then do: open the item yourself, delegate to an agent you built, or hire a community agent or human for one obligation.
- Community packs: importable playbooks for tax filings, vendor onboarding, contractor milestones, workplace safety, travel and entity registration.
- No token. No custody. Remindify never holds a balance.
- Proof receipts are HMAC-SHA256 signed and stored on the register.
- An AI proof auditor checks evidence against the proof required; low-confidence evidence falls back to a deterministic check.
- Escrow is a PayPal authorization hold, captured and paid out only after the proof audit passes. Remindify keeps a 10% platform fee.
- Capture parses pasted text and text-based PDFs deterministically on the server. No third-party AI API is required.
- Live payments need a PayPal business account in a supported market; the demo runs against the PayPal sandbox.
- The code is MIT-licensed. The repository is private while the preview is running.

## Pages
${pageIndex}

## Developer docs
${docsIndex}

## Machine-readable
- [Sitemap](${origin}/sitemap.xml)
- [Full text summary](${origin}/llms-full.txt)

## Contact
- hello@remindify.app
- security@remindify.app
`;

await writeFile(join(dist, "llms.txt"), llms);

// ---------- llms-full.txt ----------
const productLines = PRODUCTS.map(
  (product) => `- ${product.title}: ${product.copy}`,
).join("\n");

const planLines = PLANS.map((plan) => {
  const price = plan.price === "$0" ? "Free while in preview" : `${plan.price} ${plan.cadence}`;
  return `### ${plan.name} — ${price}
${plan.line}
Features: ${plan.features.join("; ")}.
Call to action: ${plan.cta}.`;
}).join("\n\n");

const faqLines = FAQS.map((faq) => `### ${faq.q}\n${faq.a}`).join("\n\n");

const sideLines = SIDES.map(
  (side) => `### ${side.eyebrow}: ${side.title}\n${side.lede}\nExamples: ${side.items.map((item) => `${item.title} (${item.meta})`).join("; ")}.\nWhat it costs when it slips: ${side.cost}`,
).join("\n\n");

const delegationLines = DELEGATION.map(
  (path) => `${path.step}. ${path.title} (${path.tag}) — ${path.copy}`,
).join("\n");

const packLines = COMMUNITY_PACKS.map(
  (pack) => `- ${pack.name} (${pack.lens === "life" ? "people" : "money"}, ${pack.count} obligations, curated by ${pack.curator}): ${pack.tagline} Proof required: ${pack.proof}.`,
).join("\n");

const llmsFull = `# Remindify — full summary

Canonical site: ${origin}
Summary generated: ${builtAt}

## What Remindify is

Remindify is the register for everything that comes back. A reminder is a notification; an obligation is a relationship with an owner, a backup, a due date, a risk score, an autonomy ceiling and a proof requirement. Remindify gives recurring work a place to live so it stops depending on somebody remembering.

It is built for the operator who remembers everything for the business: a founder, an agency lead, a finance manager, a small team. Humans and agents work from the same register, with scoped access, spending ceilings and an audit trail.

## The two sides

Most tools pick one book. A finance app forgets the contractor handoff; a project board forgets the tax filing. Remindify carries both, with one owner, one backup and one proof trail.

${sideLines}

## Remind, then do

A notification ends with you. Remindify offers three ways for the work to leave your desk, each with scoped access and proof before payment:

${delegationLines}

## Community packs

Packs are playbooks someone already ran: tax filings, vendor onboarding, contractor milestones, workplace safety, travel and entity registration. Import a pack, edit it, and it becomes yours. Community agents are held to the same scopes, ceilings and proof standard as your own.

${packLines}

## Product surfaces

${productLines}

## How it works

1. Capture: paste a letter, email, note or text-based PDF. A deterministic parser extracts the dates, amounts, provider and recurrence. No AI API is required for this path.
2. Own: assign one owner and one backup. Set the risk, the autonomy ceiling (notify, prepare, approve, autopilot) and the agent's spending ceiling. Filter the register by vendor or compliance work.
3. Do: open the next step yourself, delegate to your own agent, or hire a community agent or vetted human from the marketplace.
4. Prove: define what evidence counts. Completion files a signed proof receipt with the evidence references.
5. Settle: send a PayPal invoice to collect a receivable, or place an authorization hold that is captured only after the proof audit passes, then paid out through PayPal Payouts.
6. Audit: Activity keeps an attributed event stream of who did what, with which scope, and what evidence was filed.

## Pricing

${planLines}

Preview pricing is shown in USD for planning. Billing is not switched on during the private preview, and there is no card requirement.

## Questions and answers

${faqLines}

## Trust and safety facts

- Authentication: email and password, or Google OAuth when configured.
- Data: production workspaces live in a managed Postgres database; local development uses SQLite. Accounts and sessions are stored in separate tables from workspace data.
- Capture privacy: text is parsed on the server and is not sent to a third party or an AI model. Scanned PDFs and images need OCR or a vision service and are not part of the deterministic path.
- Proof: an HMAC-SHA256 receipt over the evidence digest. The signing key stays on the server.
- Audit: Gemini 2.5 Flash checks the evidence against the proof required, with a minimum confidence (default 0.80). Without a model key a deterministic check runs instead.
- Escrow: a PayPal authorization hold for up to 29 days, captured only against a verified proof. The 10% application fee is deducted from the captured amount and the provider is paid by PayPal Payouts.
- Invoicing: receivables are sent and reminded through PayPal Invoicing. The amount is rebuilt from the obligation, never from the request.
- Payments: PayPal does not operate in every market. Live payments need a PayPal business account in a supported market; the demo runs on the PayPal sandbox.
- No token is planned or sold. Nothing in the product requires holding an asset.

## Page index

${CONTENT_PAGES.map((page) => {
  const meta = PAGE_META[page];
  return `### ${meta.label}
URL: ${canonicalFor(page, origin)}
${meta.description}`;
}).join("\n\n")}

## Developer documentation

The docs hub is at ${origin}/docs. The full text follows.

${DOCS_PAGES.map((doc) => `### ${doc.label}
URL: ${canonicalFor("docs", origin, doc.slug)}
Group: ${doc.group}

${doc.body}`).join("\n\n---\n\n")}

## Contact

- General: hello@remindify.app
- Security: security@remindify.app
- Location: Addis Ababa, Ethiopia
- License: MIT
`;

await writeFile(join(dist, "llms-full.txt"), llmsFull);

// ---------- 404 ----------
const notFound = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Page not found — Remindify</title>
    <meta name="robots" content="noindex,nofollow" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #ede9df; color: #14140f; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
      main { padding: 48px 28px; max-width: 560px; }
      span { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #6a6a60; }
      h1 { font-size: clamp(40px, 8vw, 68px); line-height: .95; letter-spacing: -.04em; margin: 18px 0 16px; }
      p { font-size: 15px; line-height: 1.6; color: #49493d; }
      a { display: inline-flex; margin-top: 22px; padding: 12px 18px; border-radius: 12px; background: #14140f; color: #fbf9f4; text-decoration: none; font-weight: 600; font-size: 14px; }
    </style>
  </head>
  <body>
    <main>
      <span>404 · nothing returns here</span>
      <h1>This page is not in the register.</h1>
      <p>The link may be old, or the page may have moved. The story, pricing and trust model are all still where you left them.</p>
      <a href="/">Back to Remindify</a>
    </main>
  </body>
</html>
`;
await writeFile(join(dist, "404.html"), notFound);

console.log(`[seo] prerendered ${CONTENT_PAGES.length} pages + ${DOCS_PAGES.length} docs + ${SHELL_PAGES.length} shells for ${origin}`);
