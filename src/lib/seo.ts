import type { Route } from "./router";
import { routePath } from "./router";
import { FAQS, PLANS } from "../landing/data";
import { docsHref, docsMeta, docsPage } from "../docs/pages";

export const SITE_ORIGIN = "https://remindify-xi.vercel.app";

export const CONTENT_PAGES: Route[] = [
  "home", "pricing", "security", "about", "privacy", "terms",
];

export const SHELL_PAGES: Route[] = [
  "login", "signup", "today", "obligations", "capture", "agents",
  "market", "seller", "activity", "trust", "access",
];

export type PageMeta = {
  label: string;
  title: string;
  description: string;
  index: boolean;
};

const APP_DESCRIPTION = "Private Remindify workspace. Sign in to open your register.";

export const PAGE_META: Record<Route, PageMeta> = {
  home: {
    label: "Home",
    title: "Remindify — the register for everything that comes back",
    description:
      "One calm register for both kinds of weight: the people you love and the money you can't lose. Renewals, filings, school terms and birthdays — with agents and humans who actually do the work, community calendar packs, and proof when it matters.",
    index: true,
  },
  pricing: {
    label: "Pricing",
    title: "Pricing — Remindify",
    description:
      "Start free while Remindify is in preview. Personal, Studio and Operator plans for recurring obligations, agent passports, proof receipts and optional USDC escrow.",
    index: true,
  },
  security: {
    label: "Security & trust",
    title: "Security & trust — Remindify",
    description:
      "How Remindify handles accounts, proof receipts, EIP-712 signatures, optional Base and Celo anchoring, and non-custodial USDC escrow.",
    index: true,
  },
  about: {
    label: "About",
    title: "About — Remindify",
    description:
      "Why we built Remindify: the people side and the money side of the same life, carried by one person. A calm register built in Addis Ababa, for everywhere.",
    index: true,
  },
  privacy: {
    label: "Privacy",
    title: "Privacy — Remindify",
    description:
      "What Remindify collects, why, and what stays yours. Plain-language privacy for the preview.",
    index: true,
  },
  terms: {
    label: "Terms",
    title: "Terms — Remindify",
    description:
      "The rules for using the Remindify preview, including accounts, content, wallets and onchain transactions.",
    index: true,
  },
  docs: {
    label: "Developer docs",
    title: "Developer docs — Remindify",
    description:
      "Build on Remindify: the obligation register, agent passports, signed execution connectors, proof receipts, escrow and marketplace guides.",
    index: true,
  },
  login: {
    label: "Sign in",
    title: "Sign in — Remindify",
    description: "Sign in to your Remindify register.",
    index: false,
  },
  signup: {
    label: "Create account",
    title: "Create your register — Remindify",
    description: "Create a Remindify account with email, Google or a wallet.",
    index: false,
  },
  today: { label: "Today", title: "Today — Remindify", description: APP_DESCRIPTION, index: false },
  obligations: { label: "Obligations", title: "Obligations — Remindify", description: APP_DESCRIPTION, index: false },
  capture: { label: "Capture", title: "Capture — Remindify", description: APP_DESCRIPTION, index: false },
  agents: { label: "Agents", title: "Agents — Remindify", description: APP_DESCRIPTION, index: false },
  market: { label: "Marketplace", title: "Marketplace — Remindify", description: APP_DESCRIPTION, index: false },
  seller: { label: "Seller desk", title: "Seller desk — Remindify", description: APP_DESCRIPTION, index: false },
  activity: { label: "Activity", title: "Activity — Remindify", description: APP_DESCRIPTION, index: false },
  trust: { label: "Trust layer", title: "Trust layer — Remindify", description: APP_DESCRIPTION, index: false },
  access: { label: "Agent access", title: "Agent access — Remindify", description: APP_DESCRIPTION, index: false },
};

export function canonicalFor(page: Route, origin = SITE_ORIGIN, slug?: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}${page === "docs" ? docsHref(slug) : routePath(page)}`;
}

export function structuredData(page: Route, origin = SITE_ORIGIN, slug?: string) {
  const base = origin.replace(/\/$/, "");
  const doc = page === "docs" ? docsPage(slug) : null;
  const meta = doc ? docsMeta(slug) : PAGE_META[page];
  const canonical = `${base}${page === "docs" ? docsHref(slug) : routePath(page)}`;
  const organizationId = `${base}/#organization`;
  const websiteId = `${base}/#website`;
  const softwareId = `${base}/#software`;

  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      "@id": organizationId,
      name: "Remindify",
      url: base,
      logo: `${base}/icon-512.png`,
      email: "hello@remindify.app",
      description:
        "Remindify is the calm register for both sides of a life: the people you love and the money you can't lose.",
      foundingLocation: { "@type": "Place", name: "Addis Ababa, Ethiopia" },
    },
    {
      "@type": "WebSite",
      "@id": websiteId,
      url: base,
      name: "Remindify",
      alternateName: "Remindify OS",
      description:
        "The register for everything that comes back — people and money, owners and agents, community packs and proof.",
      inLanguage: "en",
      publisher: { "@id": organizationId },
    },
    {
      "@type": "SoftwareApplication",
      "@id": softwareId,
      name: "Remindify",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: base,
      description:
        "A register for both sides of a life — people and money — with owners, backups, risk scoring, agent passports, proof receipts, community packs and optional USDC escrow.",
      featureList: [
        "Recurring obligation register for people and money",
        "Life and money lenses on one register",
        "Community calendar packs",
        "Human and agent owners with scopes",
        "Do it yourself, delegate to your agent, or hire the community",
        "Risk scoring and approvals",
        "Deterministic capture from text and text-based PDFs",
        "EIP-712 proof receipts",
        "Optional Base and Celo anchoring",
        "Non-custodial USDC escrow",
        "Machine API and MCP access",
      ],
      offers: PLANS.map((plan) => ({
        "@type": "Offer",
        name: plan.name,
        price: plan.price.replace(/[^0-9.]/g, "") || "0",
        priceCurrency: "USD",
        description: plan.line,
        availability: "https://schema.org/PreOrder",
      })),
    },
    {
      "@type": page === "docs" ? (doc ? "TechArticle" : "CollectionPage") : "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: meta.title,
      description: meta.description,
      isPartOf: { "@id": websiteId },
      about: { "@id": softwareId },
      inLanguage: "en",
      primaryImageOfPage: `${base}/og.png`,
      ...(doc ? { headline: doc.title, articleSection: doc.group, keywords: doc.keywords } : {}),
    },
  ];

  if (page === "home") {
    graph.push({
      "@type": "FAQPage",
      "@id": `${base}/#faq`,
      mainEntity: FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    });
  } else {
    const crumbs = page === "docs"
      ? [
          { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
          { "@type": "ListItem", position: 2, name: "Developer docs", item: `${base}/docs` },
          ...(doc ? [{ "@type": "ListItem", position: 3, name: doc.label, item: canonical }] : []),
        ]
      : [
          { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
          { "@type": "ListItem", position: 2, name: meta.label, item: canonical },
        ];
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${canonical}#breadcrumb`,
      itemListElement: crumbs,
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    element.dataset.seo = "true";
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function setLink(rel: string, href: string, type?: string, title?: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    element.dataset.seo = "true";
    document.head.appendChild(element);
  }
  element.href = href;
  if (type) element.type = type;
  if (title) element.title = title;
}

export function applySeo(page: Route, slug?: string) {
  const knownDoc = page !== "docs" || !slug || Boolean(docsPage(slug));
  const meta = page === "docs" ? docsMeta(slug) : PAGE_META[page];
  const origin = window.location.origin;
  const canonical = `${origin}${page === "docs" ? docsHref(slug) : routePath(page)}`;
  const image = `${origin}/og.png`;
  const robots = meta.index && knownDoc
    ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    : "noindex,nofollow";

  document.title = meta.title;
  document.documentElement.lang = "en";

  setMeta("name", "description", meta.description);
  setMeta("name", "robots", robots);
  setMeta("name", "application-name", "Remindify");
  setMeta("name", "author", "Remindify");
  setMeta("property", "og:type", "website");
  setMeta("property", "og:site_name", "Remindify");
  setMeta("property", "og:locale", "en_US");
  setMeta("property", "og:title", meta.title);
  setMeta("property", "og:description", meta.description);
  setMeta("property", "og:url", canonical);
  setMeta("property", "og:image", image);
  setMeta("property", "og:image:width", "1200");
  setMeta("property", "og:image:height", "630");
  setMeta("property", "og:image:alt", "Remindify — the register for everything that comes back.");
  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:title", meta.title);
  setMeta("name", "twitter:description", meta.description);
  setMeta("name", "twitter:image", image);

  if (meta.index && knownDoc) {
    setLink("canonical", canonical);
  } else {
    document.head.querySelector('link[rel="canonical"]')?.remove();
  }
  setLink("alternate", `${origin}/llms.txt`, "text/plain", "LLM-readable summary");

  let script = document.getElementById("remindify-jsonld") as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.id = "remindify-jsonld";
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(structuredData(page, origin, slug));
}
