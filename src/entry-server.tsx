import { renderToString } from "react-dom/server";
import Landing from "./landing/Landing";
import { FAQS, PLANS, PRODUCTS, SIDES, DELEGATION, COMMUNITY_PACKS } from "./landing/data";
import {
  CONTENT_PAGES, PAGE_META, SHELL_PAGES, canonicalFor, structuredData,
} from "./lib/seo";
import type { Route } from "./lib/router";
import { routePath } from "./lib/router";
import { DOCS_PAGES, docsHref, docsMeta, docsPage } from "./docs/pages";

export { CONTENT_PAGES, SHELL_PAGES, PAGE_META, FAQS, PLANS, PRODUCTS, SIDES, DELEGATION, COMMUNITY_PACKS, routePath, canonicalFor, DOCS_PAGES, docsHref };

export type HeadOptions = {
  verification?: { google?: string; bing?: string };
};

/** Server-render the public body for a page. Used only at build time. */
export function renderPage(page: Route, slug?: string): string {
  return renderToString(<Landing page={page} slug={slug} onNavigate={() => {}} />);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function meta(attribute: "name" | "property", key: string, content: string) {
  return `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;
}

/** Static <head> for a prerendered page or an app shell. */
export function headTags(page: Route, origin: string, options: HeadOptions = {}, slug?: string): string {
  const base = origin.replace(/\/$/, "");
  const knownDoc = page !== "docs" || !slug || Boolean(docsPage(slug));
  const pageMeta = page === "docs" ? docsMeta(slug) : PAGE_META[page];
  const canonical = canonicalFor(page, base, slug);
  const image = `${base}/og.png`;
  const robots = pageMeta.index && knownDoc
    ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    : "noindex,nofollow";

  const tags = [
    `<title>${escapeHtml(pageMeta.title)}</title>`,
    meta("name", "description", pageMeta.description),
    meta("name", "robots", robots),
    meta("name", "application-name", "Remindify"),
    meta("name", "author", "Remindify"),
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`,
    `<link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png" />`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`,
    `<link rel="manifest" href="/site.webmanifest" />`,
    meta("property", "og:type", "website"),
    meta("property", "og:site_name", "Remindify"),
    meta("property", "og:locale", "en_US"),
    meta("property", "og:title", pageMeta.title),
    meta("property", "og:description", pageMeta.description),
    meta("property", "og:url", canonical),
    meta("property", "og:image", image),
    meta("property", "og:image:type", "image/png"),
    meta("property", "og:image:width", "1200"),
    meta("property", "og:image:height", "630"),
    meta("property", "og:image:alt", "Remindify — the register for everything that comes back."),
    meta("name", "twitter:card", "summary_large_image"),
    meta("name", "twitter:title", pageMeta.title),
    meta("name", "twitter:description", pageMeta.description),
    meta("name", "twitter:image", image),
    `<link rel="alternate" type="text/plain" title="LLM-readable summary" href="/llms.txt" />`,
    `<link rel="alternate" type="application/xml" title="Sitemap" href="/sitemap.xml" />`,
  ];

  if (pageMeta.index && knownDoc) tags.push(`<link rel="canonical" href="${escapeHtml(canonical)}" />`);
  if (options.verification?.google) {
    tags.push(meta("name", "google-site-verification", options.verification.google));
  }
  if (options.verification?.bing) {
    tags.push(meta("name", "msvalidate.01", options.verification.bing));
  }

  const json = JSON.stringify(structuredData(page, base, slug)).replace(/</g, "\\u003c");
  tags.push(`<script type="application/ld+json" id="remindify-jsonld">${json}</script>`);

  return tags.join("\n    ");
}

/** The same metadata the browser applies on client-side navigation. */
export function pageMetaFor(page: Route, origin: string) {
  return {
    path: routePath(page),
    canonical: canonicalFor(page, origin),
    ...PAGE_META[page],
  };
}
