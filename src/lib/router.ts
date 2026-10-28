export const APP_ROUTES = [
  "today", "obligations", "capture", "agents", "market", "activity", "trust", "access",
] as const;

export const PUBLIC_ROUTES = [
  "home", "pricing", "security", "about", "privacy", "terms", "login", "signup",
] as const;

export type AppRoute = typeof APP_ROUTES[number];
export type PublicRoute = typeof PUBLIC_ROUTES[number];
export type Route = AppRoute | PublicRoute;

export type LocationState = {
  page: Route;
  params: URLSearchParams;
};

export const NAV_EVENT = "remindify:navigate";

const ROUTE_PATHS: Record<Route, string> = {
  home: "/",
  pricing: "/pricing",
  security: "/security",
  about: "/about",
  privacy: "/privacy",
  terms: "/terms",
  login: "/login",
  signup: "/signup",
  today: "/today",
  obligations: "/obligations",
  capture: "/capture",
  agents: "/agents",
  market: "/market",
  activity: "/activity",
  trust: "/trust",
  access: "/access",
};

function asRoute(value: string): Route | null {
  if ((APP_ROUTES as readonly string[]).includes(value)) return value as AppRoute;
  if ((PUBLIC_ROUTES as readonly string[]).includes(value)) return value as PublicRoute;
  return null;
}

/** The canonical URL path served for a page — shared by the app, SSR and sitemap. */
export function routePath(page: Route) {
  return ROUTE_PATHS[page];
}

/** A crawlable href for a page. Section links on the home page become real anchors. */
export function routeHref(page: Route, params?: Record<string, string>) {
  if (page === "home" && params?.section) return `/#${params.section}`;
  const rest = params ? Object.entries(params).filter(([key]) => key !== "section") : [];
  const query = new URLSearchParams(rest).toString();
  return `${routePath(page)}${query ? `?${query}` : ""}`;
}

/** A link to an app page, routed through sign-in when the visitor is logged out. */
export function appHref(page: AppRoute, user?: { id?: string } | null) {
  return user ? routePath(page) : routeHref("login", { next: page });
}

export function isAppRoute(page: string): page is AppRoute {
  return (APP_ROUTES as readonly string[]).includes(page);
}

export function isPublicRoute(page: string): page is PublicRoute {
  return (PUBLIC_ROUTES as readonly string[]).includes(page);
}

export function isAuthRoute(page: string) {
  return page === "login" || page === "signup";
}

/** Old `#/route` links still work: read them, then rewrite the address bar. */
function readLegacyHash(): { page: Route; params: URLSearchParams } | null {
  const hash = window.location.hash;
  // Only `#/route` is a legacy route. Bare `#section` anchors belong to the page.
  if (!hash.startsWith("#/")) return null;
  const raw = hash.slice(2);
  if (!raw) return null;
  const [path, query = ""] = raw.split("?");
  const page = asRoute(path.replace(/\/+$/, ""));
  if (!page) return null;
  const params = new URLSearchParams(query);
  const extra = params.toString();
  window.history.replaceState(null, "", `${routePath(page)}${extra ? `?${extra}` : ""}`);
  return { page, params };
}

export function readLocation(): LocationState {
  const legacy = readLegacyHash();
  if (legacy) return legacy;

  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const page = path === "/" ? "home" : (asRoute(path.replace(/^\//, "")) ?? "home");
  return { page, params: new URLSearchParams(window.location.search) };
}

export function navigateTo(page: Route, params?: Record<string, string>) {
  const href = routeHref(page, params);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current !== href) window.history.pushState(null, "", href);
  window.dispatchEvent(new Event(NAV_EVENT));
}
