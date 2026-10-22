import { useMemo, useState } from "react";
import { useAuth } from "../auth";
import { useApp } from "../store";
import { Icon } from "../components/Icon";
import {
  Monogram, CategoryTile, RiskMeter, RiskPill, AutonomyControl, Ring, EmptyState, LiveDot,
} from "../components/ui";
import {
  CATEGORIES, AUTONOMY, money, dueLabel, timeAgo, dateShort, recurrenceLabel, clockLabel, riskTone,
} from "../lib/format";
import type { Approval } from "../types";

function greeting(nowMs: number) {
  const hour = new Date(nowMs).getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function ApprovalCard({ approval }: { approval: Approval }) {
  const { actions, openObligation, nowMs } = useApp();
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);

  const decide = async (decision: "approve" | "deny") => {
    setBusy(decision === "approve" ? "yes" : "no");
    await actions.decide(approval.id, decision);
    setBusy(null);
  };

  return (
    <article className="approval-card">
      <header className="approval-head">
        <div className="approval-actor">
          <Monogram
            name={approval.agent?.name || "Agent"}
            tone={approval.agent?.tone || "violet"}
            kind="agent"
            size="sm"
          />
          <div>
            <strong>{approval.agent?.name || "Agent"}</strong>
            <span className="approval-time">
              <Icon name="clock" size={11} /> {timeAgo(approval.created_at, nowMs)}
            </span>
          </div>
        </div>
        {approval.cost > 0 && <span className="approval-cost">{money(approval.cost)}</span>}
      </header>

      <h3 className="approval-title">{approval.title}</h3>
      <p className="approval-summary">{approval.summary}</p>

      <div className="evidence-list">
        {approval.evidence.slice(0, 2).map((ev, i) => (
          <div className="evidence" key={i}>
            <span className="evidence-icon"><Icon name={i === 0 ? "file" : "shield"} size={13} /></span>
            <span><strong>{ev.label}</strong><em>{ev.detail}</em></span>
          </div>
        ))}
      </div>

      <p className="approval-risk"><Icon name="alert" size={13} /> {approval.risk}</p>

      <footer className="approval-foot">
        <button className="btn btn-ink btn-sm" onClick={() => decide("approve")} disabled={!!busy}>
          {busy === "yes" ? <span className="spinner" /> : <Icon name="check" size={15} />}
          Approve &amp; run
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => decide("deny")} disabled={!!busy}>
          Decline
        </button>
        <button
          className="link-btn"
          onClick={() => approval.obligation && openObligation(approval.obligation.id)}
        >
          Open
        </button>
      </footer>
    </article>
  );
}

function Horizon({ obligations, nowMs }: { obligations: any[]; nowMs: number }) {
  const { navigate } = useApp();
  const days = useMemo(() => {
    const start = new Date(nowMs);
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(start.getTime() + i * 86400000);
      const items = obligations.filter((o) => {
        const due = new Date(o.due_at);
        return (
          due.getFullYear() === d.getFullYear() &&
          due.getMonth() === d.getMonth() &&
          due.getDate() === d.getDate()
        );
      });
      const top = items.reduce((max, o) => Math.max(max, o.risk.score), 0);
      return { date: d, items, top };
    });
  }, [obligations, nowMs]);

  const max = Math.max(1, ...days.map((d) => d.items.length));

  return (
    <div className="horizon">
      {days.map((d, i) => (
        <button
          className="horizon-col"
          key={i}
          onClick={() => navigate("obligations")}
          title={`${d.items.length} due ${d.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`}
        >
          <span className={`horizon-bar ${d.top >= 75 ? "crit" : d.top >= 50 ? "high" : d.top > 0 ? "ok" : "empty"}`}
            style={{ height: `${d.items.length ? 18 + (d.items.length / max) * 42 : 4}px` }}>
            {d.items.length > 0 && <i>{d.items.length}</i>}
          </span>
          <span className={`horizon-day ${i === 0 ? "today" : ""}`}>
            {i === 0 ? "Today" : d.date.getDate()}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function Today() {
  const { state, nowMs, navigate, actions, openObligation, setOverlays } = useApp();
  const { user } = useAuth();
  const [sweeping, setSweeping] = useState(false);
  const [stepping, setStepping] = useState(false);
  if (!state) return null;

  const firstName = (user?.name || state.user || "there").trim().split(/\s+/)[0] || "there";
  const pending = state.approvals.filter((a) => a.status === "pending");
  const active = state.obligations.filter((o) => o.status === "active" || o.status === "waiting");
  const focus = [...active]
    .filter((o) => o.risk.days <= 21)
    .sort((a, b) => b.risk.score - a.risk.score)
    .slice(0, 6);
  const wire = state.events
    .filter((e) => e.actor_type === "agent" || e.actor_type === "system" || e.actor_type === "automation")
    .slice(0, 6);
  const nextApproval = pending[0];

  const sweep = async () => {
    setSweeping(true);
    await actions.sweep();
    setSweeping(false);
  };
  const step = async (days: number) => {
    setStepping(true);
    await actions.advance(days);
    setStepping(false);
  };

  return (
    <div className="view today-view">
      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <LiveDot live={state.live} />
            <span>{clockLabel(state.now)} · {state.workspace}</span>
          </div>
          <h1>
            {greeting(nowMs)}, {firstName}.<br />
            <em>
              {state.stats.pending_approvals
                ? `${state.stats.pending_approvals} ${state.stats.pending_approvals === 1 ? "thing needs" : "things need"} you.`
                : "Nothing needs you. Yet."}
            </em>
          </h1>
          <p>
            {state.stats.due_week} obligations fall due this week. {state.stats.delegated} are already with
            agents, {state.stats.with_backup} have a human backup, and every action lands in the proof vault.
          </p>
          <div className="hero-actions">
            <button className="btn btn-lime" onClick={sweep} disabled={sweeping}>
              {sweeping ? <span className="spinner dark" /> : <Icon name="bolt" size={16} />}
              Run agent sweep
            </button>
            <button className="btn btn-ghost-light" onClick={() => step(7)} disabled={stepping}>
              {stepping ? <span className="spinner" /> : <Icon name="clock" size={16} />}
              Time machine · +7 days
            </button>
          </div>
          {nextApproval && (
            <button className="hero-note" onClick={() => setOverlays((o) => ({ ...o, palette: false }))}>
              <span className="hero-note-dot" />
              <span>
                <strong>{nextApproval.agent?.name}</strong> is waiting on you: {nextApproval.title.toLowerCase()}
              </span>
              <Icon name="arrowRight" size={15} />
            </button>
          )}
        </div>

        <aside className="hero-side">
          <div className="coverage">
            <Ring
              value={state.stats.coverage}
              label={`${state.stats.coverage}%`}
              sub="covered"
              size={128}
              stroke={9}
            />
            <div className="coverage-copy">
              <span className="hero-eyebrow small">Portfolio coverage</span>
              <strong>{state.stats.coverage >= 85 ? "Holding steady" : "A few gaps"}</strong>
              <p>Risk-weighted across {state.stats.active} live obligations.</p>
            </div>
          </div>
          <div className="hero-stats">
            <div>
              <span>At risk</span>
              <strong>{money(state.stats.exposure)}</strong>
              <em>if this week slips</em>
            </div>
            <div>
              <span>Needs a call</span>
              <strong>{state.stats.pending_approvals}</strong>
              <em>agent proposals</em>
            </div>
            <div>
              <span>Hours back</span>
              <strong>{state.stats.hours_saved}</strong>
              <em>this month</em>
            </div>
          </div>
        </aside>
      </section>

      <div className="today-grid">
        <div className="today-main">
          <section className="block">
            <header className="block-head">
              <div>
                <span className="eyebrow">Needs your call</span>
                <h2>Approvals <span className="count-badge">{pending.length}</span></h2>
              </div>
              <p className="block-sub">Agents prepared everything. One tap executes and files proof.</p>
            </header>

            {pending.length ? (
              <div className="approval-grid">
                {pending.map((a) => <ApprovalCard key={a.id} approval={a} />)}
              </div>
            ) : (
              <EmptyState
                icon="checkCircle"
                title="Inbox zero. Nothing needs your yes."
                detail="Agents are watching the portfolio. Run a sweep to see what they'd do next."
                action={<button className="btn btn-ghost btn-sm" onClick={sweep}>Run agent sweep</button>}
              />
            )}
          </section>

          <section className="block">
            <header className="block-head">
              <div>
                <span className="eyebrow">The horizon</span>
                <h2>Closest to the edge</h2>
              </div>
              <button className="link-btn" onClick={() => navigate("obligations")}>
                All {state.stats.active} obligations <Icon name="arrowRight" size={14} />
              </button>
            </header>

            <div className="due-list">
              {focus.map((ob) => (
                <button className="due-row" key={ob.id} onClick={() => openObligation(ob.id)}>
                  <CategoryTile category={ob.category} />
                  <span className="due-main">
                    <span className="due-title-line">
                      <strong>{ob.title}</strong>
                      {ob.risk.days < 0 && <span className="overdue-tag">Overdue</span>}
                    </span>
                    <span className="due-meta">
                      {ob.provider} · {recurrenceLabel(ob.recurrence)} · {ob.owner_kind === "agent" ? AUTONOMY[ob.autonomy].label : ob.owner}
                    </span>
                  </span>
                  <span className="due-risk"><RiskMeter risk={ob.risk} /></span>
                  <span className={`due-when ${ob.risk.days < 0 ? "late" : ob.risk.days <= 3 ? "soon" : ""}`}>
                    {dueLabel(ob.due_at, nowMs)}
                    <em>{dateShort(ob.due_at)}</em>
                  </span>
                  <Monogram
                    name={ob.agent_id ? state.agents.find((a) => a.id === ob.agent_id)?.name || ob.owner : ob.owner}
                    tone={ob.agent_id ? state.agents.find((a) => a.id === ob.agent_id)?.tone : "ink"}
                    kind={ob.owner_kind === "agent" ? "agent" : "human"}
                    size="sm"
                  />
                  <Icon name="chevronRight" size={15} className="due-chevron" />
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="today-rail">
          <section className="panel pulse-card">
            <header className="panel-head">
              <div>
                <span className="eyebrow">Next 14 days</span>
                <h3>Portfolio pulse</h3>
              </div>
              <RiskPill band={state.stats.critical ? "critical" : "guarded"} compact />
            </header>
            <Horizon obligations={active} nowMs={nowMs} />
            <div className="pulse-legend">
              <span><i className="lg-crit" /> Critical</span>
              <span><i className="lg-high" /> High</span>
              <span><i className="lg-ok" /> Guarded</span>
              <span className="pulse-more">{state.stats.due_week} due this week</span>
            </div>
            <div className="pulse-foot">
              <div><span>Exposure</span><strong>{money(state.stats.exposure)}</strong></div>
              <div><span>With backup</span><strong>{state.stats.with_backup}/{state.stats.active}</strong></div>
            </div>
          </section>

          <section className="panel wire-card">
            <header className="panel-head">
              <div>
                <span className="eyebrow">Agent wire</span>
                <h3>What agents are doing</h3>
              </div>
              <button
                className={`live-toggle ${state.live ? "on" : ""}`}
                onClick={() => actions.setLive(!state.live)}
                title={state.live ? "Pause live proposals" : "Resume live proposals"}
              >
                <i />{state.live ? "Live" : "Paused"}
              </button>
            </header>
            <div className="wire-list">
              {wire.map((e) => {
                const agent = state.agents.find((a) => a.id === e.actor_id);
                return (
                  <div className="wire-item" key={e.id}>
                    {agent ? (
                      <Monogram name={agent.name} tone={agent.tone} kind="agent" size="xs" />
                    ) : (
                      <span className="wire-system"><Icon name={e.kind === "api" ? "terminal" : "pulse"} size={13} /></span>
                    )}
                    <span className="wire-copy">
                      <span><strong>{e.actor}</strong> {e.verb}</span>
                      <em>{e.object}</em>
                    </span>
                    <span className="wire-time">{timeAgo(e.created_at, nowMs)}</span>
                  </div>
                );
              })}
            </div>
            <button className="panel-link" onClick={sweep} disabled={sweeping}>
              {sweeping ? <span className="spinner dark" /> : <Icon name="bolt" size={14} />}
              Run a sweep now <Icon name="arrowRight" size={14} />
            </button>
          </section>

          <section className="panel failsafe-card">
            <header className="panel-head">
              <div>
                <span className="eyebrow">Failsafe</span>
                <h3>If you go quiet</h3>
              </div>
              <span className="failsafe-icon"><Icon name="shield" size={16} /></span>
            </header>
            <div className="failsafe-chain">
              <div className="chain-step">
                <span className="chain-dot now" />
                <div><strong>Primary owner</strong><em>You, then 8 delegated agents</em></div>
              </div>
              <div className="chain-step">
                <span className="chain-dot" />
                <div><strong>Backup escalates</strong><em>Hanna &amp; Kin after 24h of silence</em></div>
              </div>
              <div className="chain-step">
                <span className="chain-dot" />
                <div><strong>Marketplace fallback</strong><em>Verified humans &amp; agents, fixed price</em></div>
              </div>
            </div>
            <p className="failsafe-note">
              <Icon name="lock" size={12} />
              Autopilot never exceeds your mandate. Every action is reversible for 24h.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
