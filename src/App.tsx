import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./auth";
import { AppProvider, useApp } from "./store";
import { Icon } from "./components/Icon";
import { Logo } from "./components/Logo";
import { Monogram } from "./components/ui";
import Landing from "./landing/Landing";
import AuthPage from "./landing/AuthPage";
import { isAppRoute, isAuthRoute, navigateTo, readLocation } from "./lib/router";
import Today from "./views/Today";
import Obligations from "./views/Obligations";
import Capture from "./views/Capture";
import Agents from "./views/Agents";
import Market from "./views/Market";
import Activity from "./views/Activity";
import Trust from "./views/Trust";
import Access from "./views/Access";
import ObligationDrawer from "./components/ObligationDrawer";
import AgentDrawer from "./components/AgentDrawer";
import { CommandPalette, Toasts } from "./components/CommandPalette";
import { CreateAgentModal, HireModal, NewObligationModal } from "./components/Modals";
import { TemplatesModal } from "./components/TemplatesModal";
import { clockLabel } from "./lib/format";

const NAV = [
  {
    label: "Run",
    items: [
      { id: "today", label: "Today", icon: "today" },
      { id: "obligations", label: "Obligations", icon: "list" },
      { id: "capture", label: "Capture", icon: "sparkle" },
    ],
  },
  {
    label: "Delegated",
    items: [
      { id: "agents", label: "Agents", icon: "bot" },
      { id: "market", label: "Marketplace", icon: "store" },
      { id: "activity", label: "Activity", icon: "pulse" },
    ],
  },
  {
    label: "Machine",
    items: [
      { id: "trust", label: "Trust layer", icon: "shield" },
      { id: "access", label: "Agent access", icon: "key" },
    ],
  },
];

const TITLES: Record<string, { title: string; sub: string }> = {
  today: { title: "Command center", sub: "The state of everything that comes back" },
  obligations: { title: "Register", sub: "One owner, one backup, one proof trail" },
  capture: { title: "Capture", sub: "Turn prose into obligations" },
  agents: { title: "The bench", sub: "Agents and automations with a paper trail" },
  market: { title: "Marketplace", sub: "Humans and agents, on the same bench" },
  activity: { title: "Proof", sub: "What happened, who did it, what's on file" },
  trust: { title: "Trust layer", sub: "Proof receipts and USDC escrow, anchored when needed" },
  access: { title: "Agent access", sub: "Obligations as a protocol" },
};

function Shell() {
  const { state, loading, route, navigate, overlays, setOverlays, actions } = useApp();
  const { user, logout } = useAuth();
  const [mobileNav, setMobileNav] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const displayUser = user?.name || state?.user || "Operator";
  const displayDetail = user?.email || user?.wallet_address || "Signed in";

  const handleSignOut = async () => {
    setSigningOut(true);
    await logout();
    navigateTo("home");
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route]);

  if (loading || !state) {
    return (
      <main className="boot" aria-busy="true">
        <Logo />
        <h1>remindify</h1>
        <p>Loading your register…</p>
        <div className="boot-bar"><span /></div>
        <em>Private by default · proof when it matters</em>
      </main>
    );
  }

  const titles = TITLES[route] || TITLES.today;
  const pending = state.stats.pending_approvals;
  const offset = state.clock_offset_days;

  const resetTime = async () => {
    setResetting(true);
    await actions.reset();
    setResetting(false);
  };

  return (
    <div className="app">
      <aside className="rail">
        <button className="brand" onClick={() => navigate("today")} aria-label="Remindify home">
          <Logo />
          <span className="brand-word">remindify<span className="brand-os">OS</span></span>
        </button>

        <nav className="rail-nav">
          {NAV.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-label">{group.label}</span>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${route === item.id ? "on" : ""}`}
                  onClick={() => navigate(item.id)}
                >
                  <Icon name={item.icon} size={17} />
                  <span>{item.label}</span>
                  {item.id === "today" && pending > 0 && <em className="nav-badge">{pending}</em>}
                  {item.id === "agents" && <em className="nav-badge ghost">{state.agents.length}</em>}
                  {route === item.id && <span className="nav-active-dot" />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="rail-foot">
          <div className="streak-card">
            <span className="streak-icon"><Icon name="shield" size={15} /></span>
            <div>
              <strong>{state.stats.streak_weeks} weeks</strong>
              <em>without a missed deadline</em>
            </div>
          </div>
          <div className="workspace-card">
            <span className="workspace-avatar">EX</span>
            <div>
              <strong>{state.workspace}</strong>
              <em>{state.plan} plan · local</em>
            </div>
            <Icon name="chevronDown" size={14} />
          </div>
          <div className="user-row">
            <Monogram name={displayUser} tone="ink" size="xs" />
            <span>{displayUser.split(/\s+/)[0]}</span>
            <span className="user-status" title="Signed in"><i /></span>
            <button
              className="tiny-icon user-signout"
              onClick={handleSignOut}
              disabled={signingOut}
              title="Sign out"
              aria-label="Sign out"
            >
              <Icon name="power" size={13} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Menu">
              <Icon name={mobileNav ? "x" : "menu"} size={18} />
            </button>
            <div className="crumb">
              <span>{state.workspace}</span>
              <Icon name="chevronRight" size={12} />
              <strong>{titles.title}</strong>
            </div>
            <div className="topbar-sub">{titles.sub}</div>
          </div>

          <div className="topbar-right">
            <button className="clock-chip" onClick={() => navigate("activity")} title="Virtual portfolio clock">
              <Icon name="calendar" size={14} />
              <span>{clockLabel(state.now)}</span>
              {offset !== 0 && <em className="clock-offset">+{offset}d</em>}
            </button>
            {offset !== 0 && (
              <button className="tiny-icon reset-clock" onClick={resetTime} disabled={resetting} title="Reset demo">
                <Icon name="refresh" size={14} />
              </button>
            )}
            <button className="search-trigger" onClick={() => setOverlays((o) => ({ ...o, palette: true }))}>
              <Icon name="search" size={15} />
              <span>Search anything</span>
              <kbd>⌘K</kbd>
            </button>
            <button className="top-live" onClick={() => actions.setLive(!state.live)} title="Toggle agent proposals">
              <i className={state.live ? "on" : ""} /> {state.live ? "Agents live" : "Paused"}
            </button>
            <button className="icon-btn top-bell" title="Approvals" onClick={() => navigate("today")}>
              <Icon name="inbox" size={17} />
              {pending > 0 && <span className="bell-badge">{pending}</span>}
            </button>
            <div className="top-user">
              <button className="top-user-trigger" aria-label="Account menu" aria-haspopup="menu">
                <Monogram name={displayUser} tone="ink" size="sm" />
              </button>
              <div className="top-user-menu" role="menu">
                <span className="eyebrow">Signed in</span>
                <strong>{displayUser}</strong>
                <em>{displayDetail}</em>
                <button onClick={handleSignOut} disabled={signingOut} role="menuitem">
                  <Icon name="power" size={13} />
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
          </div>
        </header>

        {mobileNav && (
          <div className="mobile-nav-panel">
            {NAV.flatMap((g) => g.items).map((item) => (
              <button
                key={item.id}
                className={route === item.id ? "on" : ""}
                onClick={() => { navigate(item.id); setMobileNav(false); }}
              >
                <Icon name={item.icon} size={16} /> {item.label}
              </button>
            ))}
          </div>
        )}

        <main className="content" key={route}>
          {route === "today" && <Today />}
          {route === "obligations" && <Obligations />}
          {route === "capture" && <Capture />}
          {route === "agents" && <Agents />}
          {route === "market" && <Market />}
          {route === "activity" && <Activity />}
          {route === "trust" && <Trust />}
          {route === "access" && <Access />}
          <footer className="app-foot">
            <span><Logo small /> Remindify OS · v1.0</span>
            <span>Never miss a beat. {state.stats.active} obligations under watch.</span>
            <button onClick={() => navigate("access")}>Machine-readable <Icon name="arrowUpRight" size={11} /></button>
          </footer>
        </main>
      </div>

      {overlays.drawer && <ObligationDrawer />}
      {overlays.agentDrawer && <AgentDrawer />}
      <CommandPalette />
      <NewObligationModal />
      <TemplatesModal />
      <CreateAgentModal />
      <HireModal />
      <Toasts />
    </div>
  );
}

function BootScreen() {
  return (
    <main className="boot" aria-busy="true">
      <Logo />
      <h1>remindify</h1>
      <p>Opening your register…</p>
      <div className="boot-bar"><span /></div>
      <em>Private by default · proof when it matters</em>
    </main>
  );
}

function Root() {
  const { user, loading } = useAuth();
  const [location, setLocation] = useState(readLocation);

  useEffect(() => {
    const sync = () => setLocation(readLocation());
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  useEffect(() => {
    const section = location.params.get("section");
    if (location.page === "home" && section) {
      const timer = window.setTimeout(() => {
        document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return () => window.clearTimeout(timer);
    }
    window.scrollTo({ top: 0 });
  }, [location]);

  useEffect(() => {
    if (user && isAuthRoute(location.page)) navigateTo("today");
  }, [user, location.page]);

  if (loading) return <BootScreen />;

  if (!user) {
    if (isAppRoute(location.page)) {
      return (
        <AuthPage
          mode="login"
          next={location.page}
          notice={location.params.get("notice")}
          onNavigate={navigateTo}
        />
      );
    }
    if (isAuthRoute(location.page)) {
      return (
        <AuthPage
          mode={location.page === "signup" ? "signup" : "login"}
          next={location.params.get("next") || undefined}
          notice={location.params.get("notice")}
          onNavigate={navigateTo}
        />
      );
    }
    return <Landing page={location.page} onNavigate={navigateTo} />;
  }

  if (isAuthRoute(location.page)) {
    return <BootScreen />;
  }

  if (isAppRoute(location.page)) {
    return (
      <AppProvider>
        <Shell />
      </AppProvider>
    );
  }

  return <Landing page={location.page} onNavigate={navigateTo} user={user} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
