import { useApp } from "../store";
import { Icon } from "../components/Icon";
import { Monogram } from "../components/ui";
import { AUTONOMY } from "../lib/format";
import { navigateTo } from "../lib/router";

export default function Agents() {
  const { state, openAgent, actions, setOverlays, openHire } = useApp();
  if (!state) return null;

  const delegated = state.obligations.filter(
    (o) => o.agent_id && !["done", "archived"].includes(o.status)
  );
  const { agent_runs_30d: runs, agent_done_30d: done, agent_failed_30d: failed, agent_proofs_30d: proofs } = state.stats;
  const attempts = done + failed;
  const success = attempts ? ((done / attempts) * 100).toFixed(1) + "%" : "—";
  const partnerAgents = state.providers.filter((p) => p.kind === "agent");

  return (
    <div className="view agents-view">
      <header className="view-head">
        <div>
          <span className="eyebrow">The bench</span>
          <h1>Agents &amp; automations</h1>
          <p>First-class actors with scopes, ceilings and a track record. They work the register; you keep the veto.</p>
        </div>
        <div className="view-head-actions">
          <button className="btn btn-ghost" onClick={() => navigateApi(setOverlays)}>
            <Icon name="terminal" size={16} /> Agent API
          </button>
          <button className="btn btn-ink" onClick={() => setOverlays((o) => ({ ...o, newAgent: true }))}>
            <Icon name="plus" size={16} /> Build an agent
          </button>
        </div>
      </header>

      <div className="agent-metrics">
        <div className="metric-card">
          <span className="metric-icon tone-lime"><Icon name="route" size={18} /></span>
          <div><strong>{delegated.length}</strong><em>Obligations delegated</em></div>
          <span className="metric-tag">of {state.stats.active} live</span>
        </div>
        <div className="metric-card">
          <span className="metric-icon tone-violet"><Icon name="bolt" size={18} /></span>
          <div><strong>{runs.toLocaleString()}</strong><em>Agent runs · 30 days</em></div>
          <span className="metric-tag">{failed} failed</span>
        </div>
        <div className="metric-card">
          <span className="metric-icon tone-teal"><Icon name="receipt" size={18} /></span>
          <div><strong>{proofs.toLocaleString()}</strong><em>Proofs filed · 30 days</em></div>
          <span className="metric-tag">with a reference</span>
        </div>
        <div className="metric-card">
          <span className="metric-icon tone-amber"><Icon name="shield" size={18} /></span>
          <div><strong>{success}</strong><em>Success rate</em></div>
          <span className="metric-tag">{attempts ? `across ${attempts} finished` : "no finished runs yet"}</span>
        </div>
      </div>

      <div className="section-head">
        <div>
          <span className="eyebrow">Their own identities</span>
          <h2>Your roster <span className="count-badge">{state.agents.length}</span></h2>
        </div>
        <p className="section-note">Every agent has a passport: scopes, an autonomy ceiling, and an audit trail.</p>
      </div>

      <div className="agent-grid">
        {state.agents.map((agent) => {
          const assigned = delegated.filter((o) => o.agent_id === agent.id);
          const paused = agent.status === "paused";
          return (
            <article className={`agent-card ${paused ? "paused" : ""}`} key={agent.id}>
              <div className="agent-card-top">
                <Monogram name={agent.name} tone={agent.tone} kind="agent" size="lg" />
                <div className="agent-id">
                  <div className="agent-name-row">
                    <h3>{agent.name}</h3>
                    <span className={`agent-state ${paused ? "off" : "on"}`}><i />{paused ? "Paused" : "Active"}</span>
                  </div>
                  <span className="agent-handle">@{agent.handle} · {agent.role}</span>
                </div>
                <button
                  className="icon-btn"
                  title={paused ? "Resume" : "Pause"}
                  onClick={() => actions.patchAgent(agent.id, { status: paused ? "active" : "paused" })}
                >
                  <Icon name={paused ? "play" : "pause"} size={15} />
                </button>
              </div>

              <p className="agent-desc">{agent.description}</p>

              <div className="agent-capabilities">
                {agent.capabilities.slice(0, 4).map((c) => <span key={c}>{c}</span>)}
              </div>

              <div className="agent-ceiling">
                <span className="eyebrow">Ceiling</span>
                <div className="ceiling-track">
                  {["notify", "prepare", "approve", "autopilot"].map((a) => (
                    <span
                      key={a}
                      className={`${a === agent.autonomy_ceiling ? "on" : ""} ${["notify", "prepare", "approve", "autopilot"].indexOf(a) <= ["notify", "prepare", "approve", "autopilot"].indexOf(agent.autonomy_ceiling) ? "reach" : ""}`}
                    />
                  ))}
                </div>
                <strong>{AUTONOMY[agent.autonomy_ceiling]?.label}</strong>
              </div>

              <footer className="agent-foot">
                <div><strong>{agent.runs_30d.toLocaleString()}</strong><em>runs</em></div>
                <div><strong>{agent.success_rate == null ? "—" : `${agent.success_rate}%`}</strong><em>success</em></div>
                <div><strong>{agent.trust}</strong><em>trust</em></div>
                <div><strong>{assigned.length}</strong><em>assigned</em></div>
                <button className="agent-open" onClick={() => openAgent(agent.id)}>
                  Passport <Icon name="arrowRight" size={14} />
                </button>
              </footer>
            </article>
          );
        })}

        <button className="agent-card agent-card-new" onClick={() => setOverlays((o) => ({ ...o, newAgent: true }))}>
          <span className="new-agent-icon"><Icon name="plus" size={22} /></span>
          <h3>Build an agent</h3>
          <p>Give it a job, a scope and a ceiling. Start it on draft, earn trust, then let it run.</p>
          <span className="new-agent-cta">Open the builder <Icon name="arrowRight" size={14} /></span>
        </button>
      </div>

      <div className="section-head market-head">
        <div>
          <span className="eyebrow">Certified partners</span>
          <h2>Agents you can hire by the job</h2>
        </div>
        <p className="section-note">External agents plug into the same audit trail. Fixed price, SLA, proof.</p>
      </div>

      <div className="partner-agent-grid">
        {partnerAgents.map((p) => (
          <article className="partner-agent" key={p.id}>
            <Monogram name={p.name} tone={p.tone} kind="agent" size="md" />
            <div className="partner-agent-body">
              <div className="partner-agent-head">
                <h3>{p.name}</h3>
                {p.verified && <span className="verified"><Icon name="check" size={9} /> verified</span>}
              </div>
              <span className="partner-agent-spec">{p.specialty} · ${p.price} {p.price_unit}</span>
              <p>{p.description}</p>
              <div className="partner-agent-foot">
                <span><Icon name="star" size={12} /> {p.rating} · {p.jobs.toLocaleString()} jobs</span>
                <span><Icon name="clock" size={12} /> {p.sla}</span>
                <button className="btn btn-ghost btn-xs" onClick={() => openHire(p.id)}>Delegate</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function navigateApi(setOverlays: any) {
  navigateTo("access");
  setOverlays((o: any) => ({ ...o, palette: false }));
}
