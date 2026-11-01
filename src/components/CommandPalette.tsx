import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../store";
import { Icon } from "./Icon";
import { CategoryTile, Monogram } from "./ui";
import { dueLabel, download } from "../lib/format";

type Item = {
  id: string;
  group: string;
  label: string;
  detail?: string;
  icon?: string;
  shortcut?: string;
  run: () => void;
};

export function CommandPalette() {
  const { state, overlays, setOverlays, navigate, actions, nowMs, toast, openObligation, openAgent } = useApp();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => setOverlays((o) => ({ ...o, palette: false }));

  const items: Item[] = useMemo(() => {
    if (!state) return [];
    const nav: Item[] = [
      ["today", "Today", "today", "command center"],
      ["obligations", "Obligations", "list", "register tasks"],
      ["capture", "Capture", "sparkle", "paste parse document"],
      ["agents", "Agents", "bot", "roster automations"],
      ["market", "Marketplace", "store", "hire humans providers"],
      ["activity", "Activity & proof", "pulse", "audit log"],
      ["trust", "Trust layer", "shield", "receipts escrow paypal audit"],
      ["access", "Agent access", "key", "api keys mcp"],
    ].map(([route, label, icon, detail]) => ({
      id: `nav_${route}`,
      group: "Go to",
      label: label as string,
      detail: detail as string,
      icon: icon as string,
      run: () => navigate(route as string),
    }));

    const actionItems: Item[] = [
      {
        id: "act_sweep", group: "Actions", label: "Run an agent sweep", detail: "Scan the portfolio, propose what's next", icon: "bolt",
        run: () => { close(); actions.sweep(); },
      },
      {
        id: "act_capture", group: "Actions", label: "Capture something new", detail: "Paste a letter, email or note", icon: "sparkle",
        run: () => { close(); navigate("capture"); },
      },
      {
        id: "act_new", group: "Actions", label: "New obligation", detail: "Add it manually", icon: "plus",
        run: () => { close(); setOverlays((o) => ({ ...o, newObligation: true })); },
      },
      {
        id: "act_agent", group: "Actions", label: "Build an agent", detail: "Give it a role, scopes and a ceiling", icon: "bot",
        run: () => { close(); setOverlays((o) => ({ ...o, newAgent: true })); },
      },
      {
        id: "act_time", group: "Actions", label: "Advance time by 7 days", detail: "Watch risk and agents adapt", icon: "clock",
        run: () => { close(); actions.advance(7); },
      },
      {
        id: "act_live", group: "Actions", label: state.live ? "Pause live agents" : "Resume live agents", detail: "Toggle agent proposals", icon: state.live ? "pause" : "play",
        run: () => { close(); actions.setLive(!state.live); },
      },
      {
        id: "act_export", group: "Actions", label: "Export the audit log", detail: "Every event and proof reference", icon: "download",
        run: () => {
          close();
          download(`remindify-audit-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ events: state.events, runs: state.runs }, null, 2));
          toast("Audit log exported", "JSON, yours to keep.", "success");
        },
      },
    ];

    const obligations: Item[] = state.obligations
      .filter((o) => !["done", "archived"].includes(o.status))
      .sort((a, b) => b.risk.score - a.risk.score)
      .slice(0, 8)
      .map((o) => ({
        id: o.id,
        group: "Obligations",
        label: o.title,
        detail: `${o.provider} · ${dueLabel(o.due_at, nowMs)} · risk ${o.risk.score}`,
        icon: "circle",
        run: () => { close(); openObligation(o.id); },
      }));

    const agents: Item[] = state.agents.slice(0, 5).map((a) => ({
      id: a.id,
      group: "Agents",
      label: a.name,
      detail: `${a.role} · ceiling ${a.autonomy_ceiling}`,
      icon: "bot",
      run: () => { close(); openAgent(a.id); },
    }));

    return [...nav, ...actionItems, ...obligations, ...agents];
  }, [state, nowMs]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((i) => (i.label + " " + (i.detail || "") + " " + i.group).toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => { inputRef.current?.focus(); }, [overlays.palette]);

  if (!overlays.palette || !state) return null;

  const move = (delta: number) => {
    setActive((a) => Math.max(0, Math.min(filtered.length - 1, a + delta)));
  };

  const choose = (item?: Item) => {
    const target = item || filtered[active];
    if (target) target.run();
  };

  const groups = [...new Set(filtered.map((i) => i.group))];
  let index = -1;

  return (
    <div className="palette-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="palette">
        <div className="palette-input">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
              if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
              if (e.key === "Enter") { e.preventDefault(); choose(); }
              if (e.key === "Escape") close();
            }}
            placeholder="Search obligations, agents, actions…"
          />
          <kbd>esc</kbd>
        </div>

        <div className="palette-list">
          {filtered.length === 0 && <p className="palette-empty">No matches. Try “agent”, “insurance” or “capture”.</p>}
          {groups.map((group) => (
            <div className="palette-group" key={group}>
              <span className="palette-group-label">{group}</span>
              {filtered.filter((i) => i.group === group).map((item) => {
                index += 1;
                const isActive = index === active;
                const ob = item.group === "Obligations" ? state.obligations.find((o) => o.id === item.id) : null;
                const agent = item.group === "Agents" ? state.agents.find((a) => a.id === item.id) : null;
                const idx = index;
                return (
                  <button
                    key={item.id}
                    className={`palette-item ${isActive ? "on" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => choose(item)}
                  >
                    {ob ? (
                      <CategoryTile category={ob.category} size={26} />
                    ) : agent ? (
                      <Monogram name={agent.name} tone={agent.tone} kind="agent" size="xs" />
                    ) : (
                      <span className="palette-icon"><Icon name={item.icon || "circle"} size={15} /></span>
                    )}
                    <span className="palette-label">
                      <strong>{item.label}</strong>
                      {item.detail && <em>{item.detail}</em>}
                    </span>
                    {isActive && <Icon name="arrowRight" size={14} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <footer className="palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
          <span className="palette-brand">Remindify command</span>
        </footer>
      </div>
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div className={`toast toast-${t.tone || "default"}`} key={t.id}>
          <span className="toast-icon">
            <Icon
              name={t.tone === "success" ? "checkCircle" : t.tone === "warn" ? "alert" : t.tone === "agent" ? "bot" : "sparkle"}
              size={16}
            />
          </span>
          <div><strong>{t.title}</strong>{t.detail && <em>{t.detail}</em>}</div>
          <button className="tiny-icon" onClick={() => dismissToast(t.id)}><Icon name="x" size={12} /></button>
        </div>
      ))}
    </div>
  );
}
