import { useState } from "react";
import { useApp } from "../store";
import { Icon } from "../components/Icon";
import { Monogram, Segmented, RiskMeter } from "./ui";
import { AUTONOMY, timeAgo, recurrenceLabel, dateShort } from "../lib/format";

function executorHost(url?: string | null) {
  if (!url) return "connector";
  try {
    return new URL(url).host;
  } catch {
    return "connector";
  }
}

export default function AgentDrawer() {
  const { state, overlays, setOverlays, nowMs, actions, openObligation } = useApp();
  const [executorUrl, setExecutorUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const agent = state?.agents.find((a) => a.id === overlays.agentDrawer);
  if (!state || !agent) return null;

  const assigned = state.obligations.filter(
    (o) => o.agent_id === agent.id && !["done", "archived"].includes(o.status)
  );
  const runs = state.runs.filter((r) => r.agent_id === agent.id).slice(0, 6);
  const close = () => setOverlays((o) => ({ ...o, agentDrawer: null }));
  const paused = agent.status === "paused";

  const connect = async () => {
    const url = executorUrl.trim();
    if (!url) return;
    setConnecting(true);
    const res = await actions.connectExecutor(agent.id, url);
    setConnecting(false);
    if (res?.signing_secret) {
      setSecret(res.signing_secret);
      setCopied(false);
    }
    setExecutorUrl("");
  };

  const disconnect = async () => {
    await actions.connectExecutor(agent.id, null);
    setSecret(null);
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="drawer-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <aside className="drawer agent-drawer">
        <header className="drawer-head">
          <div className="drawer-title">
            <Monogram name={agent.name} tone={agent.tone} kind="agent" size="lg" />
            <div>
              <span className="eyebrow">Agent passport · @{agent.handle}</span>
              <h2>{agent.name}</h2>
            </div>
          </div>
          <div className="drawer-head-actions">
            <button className="icon-btn" onClick={close}><Icon name="x" size={18} /></button>
          </div>
        </header>

        <div className="drawer-body">
          <div className="passport-status">
            <span className={`agent-state ${paused ? "off" : "on"}`}><i />{paused ? "Paused" : "Active"}</span>
            <span className="passport-meta">Last seen {timeAgo(agent.last_active, nowMs)}</span>
            <span className="passport-meta">Trust {agent.trust}/100</span>
          </div>

          <p className="agent-bio">{agent.description}</p>

          <div className="passport-stats">
            <div><strong>{agent.runs_30d.toLocaleString()}</strong><em>runs · 30d</em></div>
            <div><strong>{agent.success_rate}%</strong><em>success</em></div>
            <div><strong>{agent.hours_saved}h</strong><em>returned</em></div>
            <div><strong>{assigned.length}</strong><em>obligations</em></div>
          </div>

          <section className="drawer-section">
            <div className="drawer-section-head"><h3>Autonomy ceiling</h3><span className="eyebrow">Set by you</span></div>
            <Segmented
              value={agent.autonomy_ceiling}
              options={[
                { value: "notify", label: "Notify" },
                { value: "prepare", label: "Prepare" },
                { value: "approve", label: "Approve" },
                { value: "autopilot", label: "Autopilot" },
              ]}
              onChange={(v) => actions.patchAgent(agent.id, { autonomy_ceiling: v })}
            />
            <p className="ceiling-help">{AUTONOMY[agent.autonomy_ceiling].desc} — nothing above this ceiling executes without you.</p>
          </section>

          <section className="drawer-section">
            <div className="drawer-section-head"><h3>Scopes</h3><span className="eyebrow">Least privilege</span></div>
            <div className="scope-list">
              {agent.scopes.map((s) => <span key={s}><Icon name="lock" size={11} /> {s}</span>)}
            </div>
            <div className="capability-list">
              {agent.capabilities.map((c) => <span key={c}>{c}</span>)}
            </div>
          </section>

          <section className="drawer-section">
            <div className="drawer-section-head">
              <h3>Execution</h3>
              <span className="eyebrow">{agent.executor_configured ? "Connected" : "Draft only"}</span>
            </div>
            {agent.executor_configured ? (
              <div className="executor-box">
                <div className="executor-state">
                  <span className="agent-state on"><i />{executorHost(agent.executor_url)}</span>
                </div>
                <p className="executor-note">
                  Every run is a signed POST. The agent only counts an action as done when your
                  endpoint answers 2xx and returns a proof reference.
                </p>
                <button className="btn btn-ghost btn-xs" onClick={disconnect}>
                  Disconnect and rotate the secret
                </button>
              </div>
            ) : (
              <div className="executor-box">
                <p className="executor-note">
                  This agent can read, draft and request approval, but nothing runs until you
                  connect an executor. A sweep will draft a plan instead of claiming an execution.
                </p>
                <div className="executor-form">
                  <input
                    value={executorUrl}
                    onChange={(event) => setExecutorUrl(event.target.value)}
                    placeholder="https://your-automation.example/execute"
                    spellCheck={false}
                  />
                  <button
                    className="btn btn-ink btn-xs"
                    disabled={connecting || !executorUrl.trim()}
                    onClick={connect}
                  >
                    {connecting ? "Checking…" : "Connect"}
                  </button>
                </div>
              </div>
            )}
            {secret && (
              <div className="executor-secret">
                <div>
                  <span className="eyebrow">Signing secret · shown once</span>
                  <code>{secret}</code>
                </div>
                <button className="btn btn-ghost btn-xs" onClick={copySecret}>
                  <Icon name={copied ? "check" : "copy"} size={12} /> {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </section>

          <section className="drawer-section">
            <div className="drawer-section-head"><h3>On its desk</h3><span className="eyebrow">{assigned.length}</span></div>
            <div className="agent-assigned">
              {assigned.map((ob) => (
                <button key={ob.id} className="assigned-row" onClick={() => { close(); openObligation(ob.id); }}>
                  <span className="assigned-main"><strong>{ob.title}</strong><em>{recurrenceLabel(ob.recurrence)} · {dateShort(ob.due_at)}</em></span>
                  <RiskMeter risk={ob.risk} />
                  <Icon name="chevronRight" size={14} />
                </button>
              ))}
              {!assigned.length && <p className="drawer-empty">No obligations yet. Assign one from the register.</p>}
            </div>
          </section>

          <section className="drawer-section">
            <div className="drawer-section-head"><h3>Recent runs</h3><button className="link-btn" onClick={() => actions.sweep()}><Icon name="bolt" size={12} /> Sweep</button></div>
            <div className="run-list">
              {runs.map((r) => (
                <div className="run-row" key={r.id}>
                  <span className={`run-status ${r.status}`}>
                    {r.status === "done" ? (
                      <Icon name="check" size={10} />
                    ) : r.status === "failed" ? (
                      <Icon name="x" size={10} />
                    ) : (
                      <Icon name="clock" size={10} />
                    )}
                  </span>
                  <div>
                    <strong>{r.action}</strong>
                    <em>{r.obligation?.title} · {timeAgo(r.created_at, nowMs)}</em>
                  </div>
                  {r.proof && <span className="run-proof"><Icon name="file" size={10} /> proof</span>}
                </div>
              ))}
              {!runs.length && <p className="drawer-empty">No runs yet.</p>}
            </div>
          </section>

          <section className="drawer-section">
            <div className="drawer-section-head"><h3>Passport JSON</h3><span className="eyebrow">Machine-readable</span></div>
            <pre className="passport-json">{JSON.stringify({
              id: agent.id,
              handle: agent.handle,
              status: agent.status,
              autonomy_ceiling: agent.autonomy_ceiling,
              scopes: agent.scopes,
              trust: agent.trust,
            }, null, 2)}</pre>
          </section>
        </div>

        <footer className="drawer-foot">
          <button
            className={`btn ${paused ? "btn-lime" : "btn-ink"}`}
            onClick={() => actions.patchAgent(agent.id, { status: paused ? "active" : "paused" })}
          >
            <Icon name={paused ? "play" : "pause"} size={15} /> {paused ? "Resume agent" : "Pause agent"}
          </button>
          <button className="btn btn-ghost" onClick={() => actions.sweep()}>
            <Icon name="bolt" size={15} /> Run a sweep
          </button>
          <span className="drawer-foot-hint"><Icon name="shield" size={11} /> Audited by {state.workspace}</span>
        </footer>
      </aside>
    </div>
  );
}
