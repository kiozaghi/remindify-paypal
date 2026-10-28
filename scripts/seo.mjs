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
const origin = (process.env.PUBLIC_ORIGIN || "https://remindify-xi.vercel.app").replace(/\/+$/, "");
const builtAt = new Date().toISOString().slice(0, 10);

const seo = await import(pathToFileURL(join(root, "dist-ssr", "entry-server.js")).href);
const {
  CONTENT_PAGES, SHELL_PAGES, PAGE_META,
  FAQS, PLANS, PRODUCTS, SIDES, DELEGATION, COMMUNITY_PACKS,
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

function htmlFor(page, body) {
  return template
    .replace(SEO_BLOCK, () => headTags(page, origin, { verification }))
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

// ---------- App and auth shells (noindex, hydrated on the client) ----------
for (const page of SHELL_PAGES) {
  await writeRoute(routePath(page), htmlFor(page, ""));
}

// ---------- Sitemap ----------
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${CONTENT_PAGES.map((page) => {
  const loc = canonicalFor(page, origin);
  const priority = page === "home" ? "1.0" : page === "pricing" ? "0.9" : "0.7";
  const changefreq = page === "home" || page === "pricing" ? "weekly" : "monthly";
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${builtAt}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}).join("\n")}
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

const llms = `# Remindify

> Remindify is one calm register for both kinds of weight: the people you love and the money you can't lose. Renewals, filings, school terms and birthdays, with humans and agents who can actually do the work, community calendar packs, and verifiable proof.

Remindify is a web application for individuals and small teams. Every recurring obligation has one owner, one backup, a risk score, an autonomy level, a proof requirement and an audit trail. The product is in private preview; billing is not enabled.

Key facts:
- Two sides, one register: people (relationships, family, health, caregiving) and money (jobs, insurance, subscriptions, filings, home).
- Remind, then do: open the item yourself, delegate to an agent you built, or hire a community agent or human for one obligation.
- Community packs: importable calendars for love and connection, the school year, holidays, caregiving, tax filings, home cover, subscriptions and moving country.
- No token. No custody. No server-held private keys.
- Wallet sign-in and onchain proof are optional; email and Google sign-in work without a wallet.
- Proof receipts are hashed and signed with EIP-712 offchain. Anchoring to Base is optional.
- Escrow is non-custodial USDC and releases only against a valid proof receipt.
- Capture parses pasted text and text-based PDFs deterministically on the server. No third-party AI API is required.
- In Ethiopia, wallet and payment features stay offchain until the National Bank of Ethiopia authorises virtual-asset activity.
- The code is MIT-licensed. The repository is private while the preview is running.

## Pages
${pageIndex}

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

It is built for the person who remembers everything for everyone: a founder, an operator, a household manager, a small team. Humans and agents work from the same register, with scoped access and an audit trail.

## The two sides

Most tools pick one side of a life. A finance app ignores a mother's birthday; a family calendar forgets the insurance renewal. Remindify carries both, with one owner, one backup and one proof trail.

${sideLines}

## Remind, then do

A notification ends with you. Remindify offers three ways for the work to leave your desk, each with scoped access and proof before payment:

${delegationLines}

## Community packs

Packs are calendars someone already survived: love and connection, the school year, holidays, caregiving, tax filings, home cover, subscriptions and moving country. Import a pack, edit it, and it becomes yours. Community agents are held to the same scopes, ceilings and proof standard as your own.

${packLines}

## Product surfaces

${productLines}

## How it works

1. Capture: paste a letter, email, note or text-based PDF. A deterministic parser extracts the dates, amounts, provider and recurrence. No AI API is required for this path.
2. Own: assign one owner and one backup. Set the risk and the autonomy ceiling (notify, prepare, approve, autopilot). Filter the register by the people side or the money side.
3. Do: open the next step yourself, delegate to your own agent, or hire a community agent or vetted human from the marketplace.
4. Prove: define what evidence counts. Completion files a hashed proof receipt signed with EIP-712.
5. Escalate only when needed: anchor the proof hash to Base, or fund non-custodial USDC escrow that releases against proof.
6. Audit: Activity keeps an attributed event stream of who did what, with which scope, and what evidence was filed.

## Pricing

${planLines}

Preview pricing is shown in USD for planning. Billing is not switched on during the private preview, and there is no card requirement.

## Questions and answers

${faqLines}

## Trust and safety facts

- Authentication: email and password, Google OAuth when configured, or an EVM wallet signature. Wallet use is optional.
- Data: production workspaces live in a managed Postgres database; local development uses SQLite. Accounts and sessions are stored in separate tables from workspace data.
- Capture privacy: text is parsed on the server and is not sent to a third party or an AI model. Scanned PDFs and images need OCR or a vision service and are not part of the deterministic path.
- Proof: EIP-712 typed data, hashed evidence references, offchain by default. Documents are never uploaded to a chain.
- Onchain: Base is the primary ecosystem. Celo is the pilot for mobile-first, emerging-market use. One reusable EVM proof and escrow module.
- Escrow: USDC only, non-custodial, created with an explicit jurisdiction acknowledgement, released against a valid receipt. Remindify never holds a private key.
- No token is planned or sold. Nothing in the product requires holding an asset.
- Ethiopia: the register, capture and offchain proof work today. Wallet and payment features remain offchain until the National Bank of Ethiopia authorises virtual-asset activity.

## Page index

${CONTENT_PAGES.map((page) => {
  const meta = PAGE_META[page];
  return `### ${meta.label}
URL: ${canonicalFor(page, origin)}
${meta.description}`;
}).join("\n\n")}

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

console.log(`[seo] prerendered ${CONTENT_PAGES.length} pages + ${SHELL_PAGES.length} shells for ${origin}`);
