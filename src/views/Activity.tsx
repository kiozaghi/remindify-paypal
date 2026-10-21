import { useMemo, useState } from "react";
import { useApp } from "../store";
import { Icon } from "../components/Icon";
import { Monogram, EmptyState } from "../components/ui";
import { timeOf, timeAgo, dateShort, download, dateShortYear } from "../lib/format";

const FILTERS = [
  { key: "all", label: "Everything" },
  { key: "agent", label: "Agents" },
  { key: "human", label: "Humans" },
  { key: "system", label: "System" },
  { key: "api", label: "Machine API" },
  { key: "proof", label: "Proof only" },
];

function groupLabel(iso: string, nowMs: number) {
  const d = new Date(iso);
  const now = new Date(nowMs);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.floor((dayStart - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export default function Activity() {
  const { state, nowMs, toast } = useApp();
  const [filter, setFilter] = useState("all");
  if (!state) return null;

  const events = useMemo(() => {
    let list = [...state.events];
    if (filter === "agent") list = list.filter((e) => e.actor_type === "agent" || e.actor_type === "automation");
    else if (filter === "human") list = list.filter((e) => e.actor_type === "human");
    else if (filter === "system") list = list.filter((e) => e.actor_type === "system");
    else if (filter === "api") list = list.filter((e) => e.kind === "api" || e.channel === "api");
    else if (filter === "proof") list = list.filter((e) => e.kind === "proof");
    return list;
  }, [state.events, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const e of events) {
      const label = groupLabel(e.created_at, nowMs);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(e);
    }
    return [...map.entries()];
  }, [events, nowMs]);

  const proofs = state.runs.filter((r) => r.proof).slice(0, 6);
  const todayCount = state.events.filter((e) => groupLabel(e.created_at, nowMs) === "Today").length;
  const agentCount = state.events.filter((e) => e.actor_type === "agent").length;
  const agentShare = Math.round((agentCount / Math.max(1, state.events.length)) * 100);

  const exportLog = () => {
    download(
      `remindify-audit-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ exported_at: new Date().toISOString(), workspace: state.workspace, events: state.events, runs: state.runs }, null, 2)
    );
    toast("Audit log exported", "Every event, actor and proof reference.", "success");
  };

  const downloadProof = (run: any) => {
    download(
      run.proof,
      JSON.stringify(
        {
          receipt: run.proof,
          obligation: run.obligation?.title,
          action: run.action,
          agent: run.agent?.name,
          executed_at: run.created_at,
          verification: "remindify://proof/" + run.id,
          status: "verified",
        },
        null, 2
      )
    );
    toast("Proof downloaded", `${run.agent?.name || "Agent"} · ${run.obligation?.title || ""}`, "success");
  };

  return (
    <div className="view activity-view">
      <header className="view-head">
        <div>
          <span className="eyebrow">The record</span>
          <h1>Activity &amp; proof</h1>
          <p>Every nudge, decision and receipt. The thing you show a partner, an auditor or your future self.</p>
        </div>
        <div className="view-head-actions">
          <button className="btn btn-ghost" onClick={exportLog}>
            <Icon name="download" size={16} /> Export audit log
          </button>
        </div>
      </header>

      <div className="activity-summary">
        <div><strong>{todayCount}</strong><span>actions today</span></div>
        <div><strong>{agentShare}%</strong><span>done by agents</span></div>
        <div><strong>{state.runs.filter((r) => r.proof).length}</strong><span>proofs on file</span></div>
        <div className="activity-streak"><Icon name="shield" size={14} /> {state.stats.streak_weeks} weeks without a missed deadline</div>
      </div>

      <div className="activity-layout">
        <section className="timeline-card">
          <header className="timeline-toolbar">
            <div className="filter-chips">
              {FILTERS.map((f) => (
                <button key={f.key} className={`filter-chip ${filter === f.key ? "on" : ""}`} onClick={() => setFilter(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
            <span className="timeline-count">{events.length} events</span>
          </header>

          {!events.length && <EmptyState icon="pulse" title="Nothing here yet" detail="This filter is quiet. Try 'Everything'." />}

          {groups.map(([label, items]) => (
            <div className="timeline-group" key={label}>
              <div className="timeline-date"><span>{label}</span><i /></div>
              {items.map((e) => {
                const agent = state.agents.find((a) => a.id === e.actor_id);
                const isAgent = e.actor_type === "agent" || e.actor_type === "automation";
                return (
                  <div className={`timeline-item actor-${e.actor_type}`} key={e.id}>
                    <div className="timeline-node">
                      {agent ? (
                        <Monogram name={agent.name} tone={agent.tone} kind="agent" size="xs" />
                      ) : isAgent ? (
                        <span className="node-icon"><Icon name="bot" size={12} /></span>
                      ) : e.actor_type === "human" ? (
                        <Monogram name={e.actor} tone="ink" size="xs" />
                      ) : (
                        <span className="node-icon system"><Icon name={e.kind === "api" ? "terminal" : "pulse"} size={12} /></span>
                      )}
                    </div>
                    <div className="timeline-body">
                      <p>
                        <strong>{e.actor}</strong> {e.verb} <span className="timeline-object">{e.object}</span>
                      </p>
                      {e.detail && <em>{e.detail}</em>}
                      <div className="timeline-tags">
                        {e.kind === "proof" && <span className="proof-tag"><Icon name="checkCircle" size={11} /> proof</span>}
                        {e.kind === "approval" && <span className="approval-tag"><Icon name="clock" size={11} /> approval</span>}
                        {e.channel === "api" && <span className="api-tag"><Icon name="terminal" size={11} /> api</span>}
                        {e.actor_type === "agent" && <span className="agent-tag">agent</span>}
                      </div>
                    </div>
                    <div className="timeline-time">
                      <span>{timeOf(e.created_at)}</span>
                      <em>{timeAgo(e.created_at, nowMs)}</em>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </section>

        <aside className="activity-side">
          <section className="panel">
            <header className="panel-head">
              <div><span className="eyebrow">Vault</span><h3>Recent proof</h3></div>
              <span className="vault-count">{state.runs.filter((r) => r.proof).length}</span>
            </header>
            <div className="vault-list">
              {proofs.map((r) => (
                <button className="vault-item" key={r.id} onClick={() => downloadProof(r)}>
                  <span className="vault-icon"><Icon name="receipt" size={14} /></span>
                  <span className="vault-main">
                    <strong>{r.proof}</strong>
                    <em>{r.obligation?.title || r.action}</em>
                  </span>
                  <span className="vault-meta">{dateShort(r.created_at)}<Icon name="download" size={12} /></span>
                </button>
              ))}
            </div>
            <p className="vault-note"><Icon name="lock" size={11} /> Hash-chained and exportable. Yours, not ours.</p>
          </section>

          <section className="panel actor-split">
            <header className="panel-head">
              <div><span className="eyebrow">Division of labour</span><h3>Who's doing the work</h3></div>
            </header>
            <div className="split-bar">
              <span className="split-agent" style={{ width: `${agentShare}%` }} />
              <span className="split-human" style={{ width: `${100 - agentShare}%` }} />
            </div>
            <div className="split-legend">
              <span><i className="dot-violet" /> Agents <strong>{agentShare}%</strong></span>
              <span><i className="dot-ink" /> Humans &amp; system <strong>{100 - agentShare}%</strong></span>
            </div>
            <div className="audit-facts">
              <div><span>Oldest retained event</span><strong>{dateShortYear(state.events[state.events.length - 1]?.created_at || state.now)}</strong></div>
              <div><span>Machine API calls</span><strong>{state.api_calls.toLocaleString()}</strong></div>
              <div><span>Data location</span><strong>Local SQLite</strong></div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
