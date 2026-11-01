import { useMemo, useState } from "react";
import { useApp } from "../store";
import { Icon } from "../components/Icon";
import AgentStudioGrid from "../components/AgentStudioGrid";
import { Monogram, CategoryTile, RiskMeter, RiskPill, EmptyState } from "../components/ui";
import {
  CATEGORIES, AUTONOMY, LENSES, lensOf, money, dueLabel, recurrenceLabel, dateShort, BANDS,
} from "../lib/format";

type Filter = "all" | "needs" | "delegated" | "overdue" | "done";
type LensFilter = "all" | "life" | "money";

export default function Obligations() {
  const { state, nowMs, openObligation, setOverlays, actions } = useApp();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [lens, setLens] = useState<LensFilter>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"risk" | "due" | "title">("risk");
  const [view, setView] = useState<"register" | "studio">("register");

  if (!state) return null;

  const live = state.obligations.filter((o) => !["done", "archived"].includes(o.status));
  const list = useMemo(() => {
    let items = [...live];
    if (lens !== "all") items = items.filter((o) => lensOf(o.category) === lens);
    if (category !== "all") items = items.filter((o) => o.category === category);
    if (filter === "needs") items = items.filter((o) => o.risk.band === "critical" || o.risk.band === "high");
    if (filter === "delegated") items = items.filter((o) => o.owner_kind === "agent");
    if (filter === "overdue") items = items.filter((o) => o.risk.days < 0);
    if (filter === "done") items = state.obligations.filter((o) => o.status === "done");
    if (query.trim()) {
      const q = query.toLowerCase();
      items = items.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.provider.toLowerCase().includes(q) ||
          o.category.includes(q) ||
          o.owner.toLowerCase().includes(q)
      );
    }
    if (sort === "risk") items.sort((a, b) => b.risk.score - a.risk.score);
    if (sort === "due") items.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
    if (sort === "title") items.sort((a, b) => a.title.localeCompare(b.title));
    return items;
  }, [live, lens, category, filter, query, sort, state.obligations]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    live.forEach((o) => { counts[o.category] = (counts[o.category] || 0) + 1; });
    return counts;
  }, [live]);

  const lensCounts = useMemo(() => ({
    life: live.filter((o) => lensOf(o.category) === "life").length,
    money: live.filter((o) => lensOf(o.category) === "money").length,
  }), [live]);

  const chooseLens = (value: LensFilter) => {
    setLens(value);
    if (value !== "all" && category !== "all" && lensOf(category) !== value) setCategory("all");
  };

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All live", count: live.length },
    { key: "needs", label: "Needs attention", count: live.filter((o) => o.risk.band === "critical" || o.risk.band === "high").length },
    { key: "delegated", label: "Delegated", count: live.filter((o) => o.owner_kind === "agent").length },
    { key: "overdue", label: "Overdue", count: live.filter((o) => o.risk.days < 0).length },
  ];

  return (
    <div className="view obligations-view">
      <header className="view-head">
        <div>
          <span className="eyebrow">The register</span>
          <h1>Obligations</h1>
          <p>Everything that comes back — vendor renewals, filings, contractor handoffs, invoices. One owner, one backup, one proof trail.</p>
        </div>
        <div className="view-head-actions">
          <button className="btn btn-ghost" onClick={() => setOverlays((o) => ({ ...o, templates: true }))}>
            <Icon name="copy" size={16} /> Templates
          </button>
          <button className="btn btn-ghost" onClick={() => actions.sweep()}>
            <Icon name="bolt" size={16} /> Agent sweep
          </button>
          <button className="btn btn-ink" onClick={() => setOverlays((o) => ({ ...o, newObligation: true }))}>
            <Icon name="plus" size={16} /> New obligation
          </button>
        </div>
      </header>

      <div className="register-strip">
        <div className="register-stat">
          <span className="dot dot-coral" />
          <div><strong>{state.stats.critical}</strong><em>Critical</em></div>
        </div>
        <div className="register-stat">
          <span className="dot dot-amber" />
          <div><strong>{state.stats.high}</strong><em>High risk</em></div>
        </div>
        <div className="register-stat">
          <span className="dot dot-lime" />
          <div><strong>{state.stats.delegated}</strong><em>With agents</em></div>
        </div>
        <div className="register-stat">
          <span className="dot dot-ink" />
          <div><strong>{money(state.stats.exposure)}</strong><em>Exposed this week</em></div>
        </div>
        <div className="register-stat grow">
          <span className="dot dot-teal" />
          <div><strong>{state.stats.with_backup}/{state.stats.active}</strong><em>Have a backup</em></div>
        </div>
        <div className="register-note">
          <Icon name="shield" size={14} /> Risk recalculated on virtual clock · {dateShort(state.now)}
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search obligations, providers, owners…"
          />
          {query && <button className="tiny-icon" onClick={() => setQuery("")}><Icon name="x" size={14} /></button>}
        </div>
        <div className="toolbar-filters">
          {filters.map((f) => (
            <button
              key={f.key}
              className={`filter-chip ${filter === f.key ? "on" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}<span>{f.count}</span>
            </button>
          ))}
        </div>
        <div className="view-switch" role="group" aria-label="Register view">
          <button className={view === "register" ? "on" : ""} onClick={() => setView("register")}>
            Register
          </button>
          <button className={view === "studio" ? "on" : ""} onClick={() => setView("studio")}>
            Agent Studio <span>AG Grid</span>
          </button>
        </div>
        <label className="sort-select">
          <Icon name="filter" size={14} />
          <select value={sort} onChange={(e) => setSort(e.target.value as any)}>
            <option value="risk">Sort · risk</option>
            <option value="due">Sort · due date</option>
            <option value="title">Sort · A–Z</option>
          </select>
        </label>
      </div>

      <div className="lens-rail">
        <button className={`lens-chip all ${lens === "all" ? "on" : ""}`} onClick={() => chooseLens("all")}>
          Everything <span>{live.length}</span>
        </button>
        <button className={`lens-chip life ${lens === "life" ? "on" : ""}`} onClick={() => chooseLens("life")}>
          <Icon name="shield" size={13} /> {LENSES.life.label} <span>{lensCounts.life}</span>
        </button>
        <button className={`lens-chip money ${lens === "money" ? "on" : ""}`} onClick={() => chooseLens("money")}>
          <Icon name="wallet" size={13} /> {LENSES.money.label} <span>{lensCounts.money}</span>
        </button>
        <em>One register. Both kinds of weight.</em>
      </div>

      <div className="category-rail">
        <button className={`cat-chip ${category === "all" ? "on" : ""}`} onClick={() => setCategory("all")}>
          All categories
        </button>
        {Object.entries(CATEGORIES).map(([key, meta]) => (
          <button
            key={key}
            className={`cat-chip ${category === key ? "on" : ""}`}
            onClick={() => setCategory(key)}
          >
            <Icon name={meta.icon} size={14} />
            {meta.label}
            {categoryCounts[key] ? <span>{categoryCounts[key]}</span> : null}
          </button>
        ))}
      </div>

      {view === "studio" ? (
        <AgentStudioGrid
          obligations={list}
          agents={state.agents}
          escrows={state.escrows}
          nowMs={nowMs}
          onOpen={openObligation}
          onAutonomy={(id, autonomy) => actions.patchObligation(id, { autonomy })}
        />
      ) : (
      <div className="table-card">
        <div className="table-head">
          <span>Obligation</span>
          <span>Risk</span>
          <span>Deadline</span>
          <span>Autonomy</span>
          <span>Owner</span>
          <span />
        </div>

        {list.length === 0 && (
          <EmptyState
            icon="search"
            title="Nothing matches that"
            detail="Try a broader filter, or capture something new."
            action={<button className="btn btn-ghost btn-sm" onClick={() => { setFilter("all"); setCategory("all"); setLens("all"); setQuery(""); }}>Clear filters</button>}
          />
        )}

        {list.map((ob) => {
          const agent = ob.agent_id ? state.agents.find((a) => a.id === ob.agent_id) : null;
          return (
            <div
              className="table-row"
              key={ob.id}
              role="button"
              tabIndex={0}
              onClick={() => openObligation(ob.id)}
              onKeyDown={(e) => { if (e.key === "Enter") openObligation(ob.id); }}
            >
              <div className="row-main">
                <CategoryTile category={ob.category} />
                <div>
                  <div className="row-title">{ob.title}</div>
                  <div className="row-sub">
                    {ob.provider} · {recurrenceLabel(ob.recurrence)}
                    {ob.amount > 0 && <> · {money(ob.amount)}</>}
                  </div>
                </div>
              </div>

              <div className="row-risk">
                <RiskMeter risk={ob.risk} />
                <span className="risk-band-label">{BANDS[ob.risk.band]?.label}</span>
              </div>

              <div className={`row-due ${ob.risk.days < 0 ? "late" : ob.risk.days <= 3 ? "soon" : ""}`}>
                <strong>{dueLabel(ob.due_at, nowMs)}</strong>
                <em>{dateShort(ob.due_at)}</em>
              </div>

              <div className="row-autonomy" onClick={(e) => e.stopPropagation()}>
                <div className="mini-seg">
                  {(["notify", "prepare", "approve", "autopilot"] as const).map((a) => (
                    <button
                      key={a}
                      className={ob.autonomy === a ? `on tone-${a}` : ""}
                      onClick={() => actions.patchObligation(ob.id, { autonomy: a })}
                      title={AUTONOMY[a].desc}
                    >
                      {a === "autopilot" ? "Auto" : a === "prepare" ? "Prep" : a === "notify" ? "Notify" : "Approve"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="row-owner">
                {agent ? (
                  <>
                    <Monogram name={agent.name} tone={agent.tone} kind="agent" size="xs" />
                    <span><strong>{agent.name}</strong><em>agent</em></span>
                  </>
                ) : (
                  <>
                    <Monogram name={ob.owner} tone={ob.owner_kind === "team" ? "violet" : "ink"} size="xs" />
                    <span><strong>{ob.owner.split(" ")[0]}</strong><em>{ob.owner_kind === "team" ? "team" : "human"}</em></span>
                  </>
                )}
              </div>

              <div className="row-actions">
                <RiskPill band={ob.risk.band} compact />
                <button
                  className="row-check"
                  title="Mark complete"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.complete(ob.id, { proof: ob.proof_required, by: state.user });
                  }}
                >
                  <Icon name="check" size={14} />
                </button>
                <Icon name="chevronRight" size={16} className="row-chev" />
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
