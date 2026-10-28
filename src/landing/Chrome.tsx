import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { Icon } from "../components/Icon";
import { Logo } from "../components/Logo";
import type { AuthUser } from "../types";
import {
  appHref, isAppRoute, routeHref,
  type AppRoute, type PublicRoute, type Route,
} from "../lib/router";

export type Navigate = (page: Route, params?: Record<string, string>) => void;

/**
 * Follow a link inside the single-page app without losing normal browser
 * behaviour for modified clicks (new tab, new window, download).
 */
export function spaClick(action: () => void) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 || event.metaKey || event.ctrlKey
      || event.shiftKey || event.altKey
    ) return;
    event.preventDefault();
    action();
  };
}

const LINKS: Array<{ label: string; page: PublicRoute; section?: string }> = [
  { label: "The story", page: "home", section: "story" },
  { label: "Product", page: "home", section: "product" },
  { label: "Trust", page: "home", section: "trust" },
  { label: "Pricing", page: "pricing" },
  { label: "Docs", page: "docs" },
  { label: "About", page: "about" },
];

function linkHref(link: typeof LINKS[number]) {
  return link.section ? routeHref("home", { section: link.section }) : routeHref(link.page);
}

export function PublicNav({
  page, onNavigate, user, dark = false,
}: {
  page: Route;
  onNavigate: Navigate;
  user?: AuthUser | null;
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const go = (link: typeof LINKS[number]) => {
    setOpen(false);
    if (link.section) {
      onNavigate("home", { section: link.section });
      return;
    }
    onNavigate(link.page);
  };

  const openApp = (route: AppRoute) => {
    setOpen(false);
    onNavigate(user ? route : "login", user ? undefined : { next: route });
  };

  return (
    <header className={`site-nav ${dark ? "site-nav-dark" : ""}`}>
      <a
        className="site-brand"
        href={routeHref("home")}
        onClick={spaClick(() => onNavigate("home"))}
      >
        <Logo />
        <span className="site-word">remindify</span>
        <span className="site-beta">preview</span>
      </a>

      <nav className="site-links" aria-label="Primary">
        {LINKS.map((link) => (
          <a
            key={link.label}
            href={linkHref(link)}
            onClick={spaClick(() => go(link))}
            className={page === link.page && !link.section ? "on" : ""}
          >
            {link.label}
          </a>
        ))}
      </nav>

      <div className="site-actions">
        {user ? (
          <>
            <span className="site-user">
              <i />
              {user.name.split(/\s+/)[0]}
            </span>
            <a
              className="btn btn-lime btn-sm"
              href={appHref("today", user)}
              onClick={spaClick(() => openApp("today"))}
            >
              Open workspace <Icon name="arrowRight" size={14} />
            </a>
          </>
        ) : (
          <>
            <a
              className="site-login"
              href={routeHref("login")}
              onClick={spaClick(() => onNavigate("login"))}
            >
              Sign in
            </a>
            <a
              className="btn btn-ink btn-sm"
              href={routeHref("signup")}
              onClick={spaClick(() => onNavigate("signup"))}
            >
              Start free <Icon name="arrowRight" size={14} />
            </a>
          </>
        )}
        <button className="site-menu-btn" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
          <Icon name={open ? "x" : "menu"} size={19} />
        </button>
      </div>

      {open && (
        <div className="site-mobile">
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={linkHref(link)}
              onClick={spaClick(() => go(link))}
            >
              {link.label}
            </a>
          ))}
          <div className="site-mobile-products">
            <span className="eyebrow">Inside the register</span>
            {(["today", "obligations", "agents", "trust"] as AppRoute[]).map((route) => (
              <a
                key={route}
                href={appHref(route, user)}
                onClick={spaClick(() => openApp(route))}
              >
                {route === "today" ? "Today" : route === "obligations" ? "Obligations" : route === "agents" ? "Agents" : "Proof & escrow"}
              </a>
            ))}
          </div>
          <div className="site-mobile-actions">
            {user ? (
              <a
                className="btn btn-lime"
                href={appHref("today", user)}
                onClick={spaClick(() => openApp("today"))}
              >
                Open workspace
              </a>
            ) : (
              <>
                <a
                  className="btn btn-ghost"
                  href={routeHref("login")}
                  onClick={spaClick(() => { setOpen(false); onNavigate("login"); })}
                >
                  Sign in
                </a>
                <a
                  className="btn btn-ink"
                  href={routeHref("signup")}
                  onClick={spaClick(() => { setOpen(false); onNavigate("signup"); })}
                >
                  Start free
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter({ onNavigate, user }: { onNavigate: Navigate; user?: AuthUser | null }) {
  const goPublic = (page: PublicRoute, section?: string) => {
    if (section) onNavigate("home", { section });
    else onNavigate(page);
  };

  const productHref = (page: AppRoute) => appHref(page, user);
  const openProduct = (page: AppRoute) => {
    if (!user && isAppRoute(page)) onNavigate("login", { next: page });
    else onNavigate(page);
  };

  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <div className="site-footer-brand">
          <Logo />
          <h3>Give the recurring work<br /><em>somewhere to live.</em></h3>
          <p>
            The calm register for renewals, filings, people, payroll and the small things
            that become large when forgotten.
          </p>
          <div className="site-footer-actions">
            {user ? (
              <a
                className="btn btn-lime btn-sm"
                href={appHref("today", user)}
                onClick={spaClick(() => openProduct("today"))}
              >
                Open workspace <Icon name="arrowRight" size={14} />
              </a>
            ) : (
              <>
                <a
                  className="btn btn-lime btn-sm"
                  href={routeHref("signup")}
                  onClick={spaClick(() => onNavigate("signup"))}
                >
                  Start free <Icon name="arrowRight" size={14} />
                </a>
                <a
                  className="site-footer-signin"
                  href={routeHref("login")}
                  onClick={spaClick(() => onNavigate("login"))}
                >
                  Sign in
                </a>
              </>
            )}
          </div>
        </div>

        <div className="site-footer-col">
          <span className="eyebrow">Product</span>
          {(["today", "obligations", "agents", "market", "trust"] as AppRoute[]).map((route) => (
            <a
              key={route}
              href={productHref(route)}
              onClick={spaClick(() => openProduct(route))}
            >
              {route === "today" ? "Today" : route === "obligations" ? "Obligations" : route === "agents" ? "Agents" : route === "market" ? "Marketplace" : "Proof & escrow"}
            </a>
          ))}
        </div>

        <div className="site-footer-col">
          <span className="eyebrow">Company</span>
          <a href={routeHref("about")} onClick={spaClick(() => goPublic("about"))}>About</a>
          <a href={routeHref("security")} onClick={spaClick(() => goPublic("security"))}>Security &amp; trust</a>
          <a href={routeHref("pricing")} onClick={spaClick(() => goPublic("pricing"))}>Pricing</a>
          <a href={routeHref("docs")} onClick={spaClick(() => goPublic("docs"))}>Developer docs</a>
          <a href={routeHref("home", { section: "story" })} onClick={spaClick(() => goPublic("home", "story"))}>Manifesto</a>
        </div>

        <div className="site-footer-col">
          <span className="eyebrow">Small print</span>
          <a href={routeHref("privacy")} onClick={spaClick(() => goPublic("privacy"))}>Privacy</a>
          <a href={routeHref("terms")} onClick={spaClick(() => goPublic("terms"))}>Terms</a>
          <a href="mailto:hello@remindify.app">hello@remindify.app</a>
          <a href="https://base.org" target="_blank" rel="noreferrer">Base ecosystem <Icon name="arrowUpRight" size={11} /></a>
        </div>
      </div>

      <div className="site-footer-bottom">
        <span>© 2026 Remindify. Built in Addis Ababa, for everywhere.</span>
        <span className="site-footer-values">
          <i>No token</i>
          <i>Wallet optional</i>
          <i>USDC only</i>
          <i>MIT-licensed</i>
        </span>
        <span>Preview build · v1.0</span>
      </div>
    </footer>
  );
}

export function SectionTag({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return <span className={`section-tag ${light ? "light" : ""}`}><i />{children}</span>;
}

export function ArrowLink({
  children, href, onClick, light = false,
}: {
  children: ReactNode;
  href: string;
  onClick: () => void;
  light?: boolean;
}) {
  return (
    <a className={`arrow-link ${light ? "light" : ""}`} href={href} onClick={spaClick(onClick)}>
      {children} <Icon name="arrowRight" size={15} />
    </a>
  );
}
