import { useEffect, useState } from "react";
import { AppProvider, useApp } from "./store";
import { Icon } from "./components/Icon";
import { Monogram } from "./components/ui";
import Today from "./views/Today";
import Obligations from "./views/Obligations";
import Capture from "./views/Capture";
import Agents from "./views/Agents";
import Market from "./views/Market";
import Activity from "./views/Activity";
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
    items: [{ id: "access", label: "Agent access", icon: "key" }],
  },
];

const TITLES: Record<string, { title: string; sub: string }> = {
  today: { title: "Command center", sub: "The state of everything that comes back" },
  obligations: { title: "Register", sub: "One owner, one backup, one proof trail" },
  capture: { title: "Capture", sub: "Turn prose into obligations" },
  agents: { title: "The bench", sub: "Agents and automations with a paper trail" },
  market: { title: "Marketplace", sub: "Humans and agents, on the same bench" },
  activity: { title: "Proof", sub: "What happened, who did it, what's on file" },
  access: { title: "Agent access", sub: "Obligations as a protocol" },
};

function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`logo ${small ? "logo-small" : ""}`}>
      <svg width={small ? 24 : 28} height={small ? 24 : 28} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#14140F" />
        <path d="M8 18.5c0-4.5 3.4-8 8-8 3.4 0 6.2 1.8 7.4 4.7" stroke="#D9F26A" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <circle cx="23.4" cy="15.2" r="2" fill="#D9F26A" />
        <path d="M24 21.5c0 4.5-3.4 8-8 8-3.4 0-6.2-1.8-7.4-4.7" stroke="#FBF9F3" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <circle cx="8.6" cy="24.8" r="2" fill="#FBF9F3" />
      </svg>
    </span>
  );
}

function Shell() {
  const { state, loading, route, navigate, overlays, setOverlays, actions } = useApp();
  const [mobileNav, setMobileNav] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route]);

  if (loading || !state) {
    return (
      <div className="boot">
        <Logo />
        <h1>remindify</h1>
        <p>Loading your register…</p>
        <div className="boot-bar"><span /></div>
        <em>Local-first · your data stays on this machine</em>
      </div>
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
            <Monogram name={state.user} tone="ink" size="xs" />
            <span>{state.user}</span>
            <span className="user-status" title="Solo builder"><i /></span>
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
            <Monogram name={state.user} tone="ink" size="sm" />
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

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
