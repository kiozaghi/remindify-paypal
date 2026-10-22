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

function asRoute(value: string): Route | null {
  if ((APP_ROUTES as readonly string[]).includes(value)) return value as AppRoute;
  if ((PUBLIC_ROUTES as readonly string[]).includes(value)) return value as PublicRoute;
  return null;
}

export function readLocation(): LocationState {
  const rawHash = window.location.hash.replace(/^#\/?/, "");
  const [hashPath, hashQuery = ""] = rawHash.split("?");
  const cleanHash = hashPath.replace(/\/+$/, "");
  const fromHash = asRoute(cleanHash);
  if (fromHash) {
    return { page: fromHash, params: new URLSearchParams(hashQuery) };
  }

  const pathname = window.location.pathname.replace(/^\/+|\/+$/g, "");
  const fromPath = asRoute(pathname);
  if (fromPath) {
    return { page: fromPath, params: new URLSearchParams(window.location.search) };
  }

  return {
    page: "home",
    params: new URLSearchParams(hashQuery || window.location.search),
  };
}

export function navigateTo(page: Route, params?: Record<string, string>) {
  const query = params ? new URLSearchParams(params).toString() : "";
  const next = `#/${page}${query ? `?${query}` : ""}`;
  if (window.location.hash === next) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = next;
  }
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
}

export function routeHref(page: Route) {
  return `#/${page}`;
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
