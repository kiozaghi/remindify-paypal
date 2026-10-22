import { useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "../components/Icon";
import { Logo } from "../components/Logo";
import type { AuthUser } from "../types";
import { isAppRoute, type AppRoute, type PublicRoute, type Route } from "../lib/router";

export type Navigate = (page: Route, params?: Record<string, string>) => void;

const LINKS: Array<{ label: string; page: PublicRoute; section?: string }> = [
  { label: "The story", page: "home", section: "story" },
  { label: "Product", page: "home", section: "product" },
  { label: "Trust", page: "home", section: "trust" },
  { label: "Pricing", page: "pricing" },
  { label: "About", page: "about" },
];

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
      <button className="site-brand" onClick={() => onNavigate("home")}>
        <Logo />
        <span className="site-word">remindify</span>
        <span className="site-beta">preview</span>
      </button>

      <nav className="site-links" aria-label="Primary">
        {LINKS.map((link) => (
          <button key={link.label} onClick={() => go(link)} className={page === link.page && !link.section ? "on" : ""}>
            {link.label}
          </button>
        ))}
      </nav>

      <div className="site-actions">
        {user ? (
          <>
            <span className="site-user">
              <i />
              {user.name.split(/\s+/)[0]}
            </span>
            <button className="btn btn-lime btn-sm" onClick={() => openApp("today")}>
              Open workspace <Icon name="arrowRight" size={14} />
            </button>
          </>
        ) : (
          <>
            <button className="site-login" onClick={() => onNavigate("login")}>Sign in</button>
            <button className="btn btn-ink btn-sm" onClick={() => onNavigate("signup")}>
              Start free <Icon name="arrowRight" size={14} />
            </button>
          </>
        )}
        <button className="site-menu-btn" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
          <Icon name={open ? "x" : "menu"} size={19} />
        </button>
      </div>

      {open && (
        <div className="site-mobile">
          {LINKS.map((link) => (
            <button key={link.label} onClick={() => go(link)}>{link.label}</button>
          ))}
          <div className="site-mobile-products">
            <span className="eyebrow">Inside the register</span>
            <button onClick={() => openApp("today")}>Today</button>
            <button onClick={() => openApp("obligations")}>Obligations</button>
            <button onClick={() => openApp("agents")}>Agents</button>
            <button onClick={() => openApp("trust")}>Proof &amp; escrow</button>
          </div>
          <div className="site-mobile-actions">
            {user ? (
              <button className="btn btn-lime" onClick={() => openApp("today")}>Open workspace</button>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={() => { setOpen(false); onNavigate("login"); }}>Sign in</button>
                <button className="btn btn-ink" onClick={() => { setOpen(false); onNavigate("signup"); }}>Start free</button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter({ onNavigate, user }: { onNavigate: Navigate; user?: AuthUser | null }) {
  const open = (page: Route) => {
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
              <button className="btn btn-lime btn-sm" onClick={() => open("today")}>Open workspace <Icon name="arrowRight" size={14} /></button>
            ) : (
              <>
                <button className="btn btn-lime btn-sm" onClick={() => open("signup")}>Start free <Icon name="arrowRight" size={14} /></button>
                <button className="site-footer-signin" onClick={() => open("login")}>Sign in</button>
              </>
            )}
          </div>
        </div>

        <div className="site-footer-col">
          <span className="eyebrow">Product</span>
          <button onClick={() => open("today")}>Today</button>
          <button onClick={() => open("obligations")}>Obligations</button>
          <button onClick={() => open("agents")}>Agents</button>
          <button onClick={() => open("market")}>Marketplace</button>
          <button onClick={() => open("trust")}>Proof &amp; escrow</button>
        </div>

        <div className="site-footer-col">
          <span className="eyebrow">Company</span>
          <button onClick={() => open("about")}>About</button>
          <button onClick={() => open("security")}>Security &amp; trust</button>
          <button onClick={() => open("pricing")}>Pricing</button>
          <button onClick={() => open("home")}>Manifesto</button>
        </div>

        <div className="site-footer-col">
          <span className="eyebrow">Small print</span>
          <button onClick={() => open("privacy")}>Privacy</button>
          <button onClick={() => open("terms")}>Terms</button>
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
  children, onClick, light = false,
}: { children: ReactNode; onClick: () => void; light?: boolean }) {
  return (
    <button className={`arrow-link ${light ? "light" : ""}`} onClick={onClick}>
      {children} <Icon name="arrowRight" size={15} />
    </button>
  );
}
