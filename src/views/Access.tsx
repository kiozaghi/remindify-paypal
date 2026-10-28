import { useState } from "react";
import { useApp } from "../store";
import { Icon } from "../components/Icon";
import { Field, Modal } from "../components/ui";
import { timeAgo, dateShort } from "../lib/format";

const ENDPOINTS = [
  { method: "GET", path: "/api/v1/obligations", desc: "Every live obligation, risk-scored, machine-readable." },
  { method: "POST", path: "/api/v1/obligations", desc: "Create one from any agent. Dates, recurrence, owner." },
  { method: "POST", path: "/api/v1/obligations/:id/complete", desc: "File an outcome and advance the schedule." },
  { method: "GET", path: "/api/v1/risk", desc: "Portfolio coverage, exposure and top risks." },
  { method: "GET", path: "/api/v1/agents", desc: "Discover the roster, scopes and autonomy ceilings." },
];

export default function Access() {
  const { state, actions, toast, refresh } = useApp();
  const [tab, setTab] = useState<"curl" | "js" | "mcp">("curl");
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState("");
  if (!state) return null;

  const key = state.keys[0];
  const token = newKey?.secret || key?.secret || "rfy_live_xxxxxxxxxxxxxxxx";

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1600);
      toast("Copied", label, "success");
    } catch {
      toast("Copy failed", "Select the text manually.", "warn");
    }
  };

  const create = async () => {
    if (!keyName.trim()) {
      toast("Give the key a name", "So you know which agent holds it.", "warn");
      return;
    }
    const res = await actions.createKey(keyName.trim());
    if (res?.key) {
      setNewKey(res.key);
      setKeyName("");
    }
  };

  const testCall = async () => {
    const secret = newKey?.secret || key?.secret;
    if (!secret) {
      toast("Create a key first", "The full secret is only shown once, at issue time.", "warn");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/v1/risk", { headers: { authorization: `Bearer ${secret}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Call failed");
      toast(
        "Agent API is live",
        `${data.counts.critical} critical · ${data.counts.high} high · coverage ${data.coverage}%`,
        "agent"
      );
      refresh();
    } catch (error: any) {
      toast("Call failed", error.message, "warn");
    } finally {
      setTesting(false);
    }
  };

  const samples = {
    curl: `curl https://remindify.app/api/v1/obligations \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Warehouse lease renewal",
    "due_at": "2026-12-01T09:00:00Z",
    "category": "finance",
    "amount": 2400,
    "recurrence": { "unit": "year", "interval": 1 },
    "autonomy": "approve"
  }'`,
    js: `import { Remindify } from "@remindify/sdk";

const rf = new Remindify({ key: "${token}" });

// An agent can read the register…
const { obligations } = await rf.obligations.list({ band: "critical" });

// …complete work with proof…
await rf.obligations.complete("ob_loan", {
  proof: "swift_ref_8841.pdf",
  note: "Paid from the operating account",
});

// …or file a new obligation it discovered.
await rf.obligations.create({
  title: "Renew trading licence",
  due_at: "2026-12-15",
  recurrence: { unit: "year", interval: 1 },
});`,
    mcp: `{
  "mcpServers": {
    "remindify": {
      "command": "node",
      "args": ["/path/to/remindify/mcp/server.mjs"],
      "env": {
        "REMINDIFY_API": "http://localhost:4178",
        "REMINDIFY_KEY": "${token}"
      }
    }
  }
}

// Tools exposed to any MCP client:
// list_obligations · create_obligation
// complete_obligation · get_portfolio_risk`,
  };

  const webhookEvents = ["obligation.due_soon", "approval.requested", "proof.filed", "risk.escalated"];
  const apiEvents = state.events.filter((e) => e.channel === "api" || e.kind === "api");

  return (
    <div className="view access-view">
      <header className="view-head">
        <div>
          <span className="eyebrow">Machine-native</span>
          <h1>Agent access</h1>
          <p>Remindify isn't just for people. Any agent can read the register, take work and file proof — with scoped keys.</p>
        </div>
        <div className="view-head-actions">
          <button className="btn btn-ink" onClick={testCall} disabled={testing}>
            {testing ? <span className="spinner" /> : <Icon name="bolt" size={16} />} Test live call
          </button>
        </div>
      </header>

      <section className="api-hero">
        <div className="api-hero-copy">
          <span className="eyebrow light">The agent API</span>
          <h2>Obligations as a <em>protocol.</em></h2>
          <p>
            The same graph your dashboard sees, exposed to the agents that do the work. Machine keys, scoped
            access, idempotent writes and proof receipts. Human oversight is a header, not a bottleneck.
          </p>
          <div className="api-hero-meta">
            <span><Icon name="terminal" size={13} /> REST + MCP</span>
            <span><Icon name="shield" size={13} /> Scoped bearer keys</span>
            <span><Icon name="webhook" size={13} /> Signed webhooks</span>
          </div>
        </div>
        <div className="api-hero-stat">
          <strong>{state.api_calls.toLocaleString()} / {state.api_calls_limit.toLocaleString()}</strong>
          <span>machine calls this month</span>
          <em>on the {state.plan} plan</em>
        </div>
      </section>

      <div className="access-layout">
        <div className="access-main">
          <section className="panel">
            <header className="panel-head">
              <div><span className="eyebrow">Credentials</span><h3>Agent keys</h3></div>
              <span className="key-count">{state.keys.length} active</span>
            </header>

            <div className="key-create">
              <Field label="New key">
                <input
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g. Finance agent · sandbox"
                  onKeyDown={(e) => e.key === "Enter" && create()}
                />
              </Field>
              <button className="btn btn-ink btn-sm" onClick={create}><Icon name="plus" size={14} /> Issue key</button>
            </div>

            {newKey && (
              <div className="new-key-banner">
                <div>
                  <strong>Copy this key now</strong>
                  <em>Shown once. Only a hash and this prefix are stored.</em>
                  <code>{newKey.secret}</code>
                </div>
                <button className="btn btn-lime btn-sm" onClick={() => copy(newKey.secret, "New key")}>
                  <Icon name={copied === "New key" ? "check" : "copy"} size={14} /> Copy
                </button>
                <button className="icon-btn" onClick={() => setNewKey(null)}><Icon name="x" size={14} /></button>
              </div>
            )}

            <div className="key-table">
              {state.keys.length === 0 && (
                <div className="key-row">
                  <span className="key-icon"><Icon name="key" size={15} /></span>
                  <div className="key-main">
                    <strong>No keys yet</strong>
                    <code>Issue one above to give an agent scoped access.</code>
                  </div>
                </div>
              )}
              {state.keys.map((k) => (
                <div className="key-row" key={k.id}>
                  <span className="key-icon"><Icon name="key" size={15} /></span>
                  <div className="key-main">
                    <strong>{k.name}</strong>
                    <code>{k.prefix}…</code>
                  </div>
                  <div className="key-scopes">
                    {k.scopes.slice(0, 2).map((s) => <span key={s}>{s}</span>)}
                    {k.scopes.length > 2 && <span>+{k.scopes.length - 2}</span>}
                  </div>
                  <div className="key-used">
                    <span>Last used</span>
                    <strong>{k.last_used ? timeAgo(k.last_used, new Date(state.now).getTime()) : "Never"}</strong>
                  </div>
                  <button className="tiny-icon danger" title="Revoke" onClick={() => actions.deleteKey(k.id)}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
            <p className="key-note"><Icon name="lock" size={12} /> Keys are scoped. Revoke in one tap. Every call is attributable.</p>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div><span className="eyebrow">Reference</span><h3>Endpoints</h3></div>
              <button className="link-btn" onClick={() => copy("http://localhost:4178", "Base URL")}>
                http://localhost:4178 <Icon name="copy" size={12} />
              </button>
            </header>
            <div className="endpoint-list">
              {ENDPOINTS.map((e) => (
                <div className="endpoint" key={e.path + e.method}>
                  <span className={`method ${e.method.toLowerCase()}`}>{e.method}</span>
                  <code>{e.path}</code>
                  <em>{e.desc}</em>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div><span className="eyebrow">Webhooks</span><h3>Events out</h3></div>
              <span className="webhook-state"><i /> endpoint healthy</span>
            </header>
            <div className="webhook-url">
              <code>https://your-app.dev/hooks/remindify</code>
              <button className="tiny-icon" onClick={() => copy("https://your-app.dev/hooks/remindify", "Webhook URL")}>
                <Icon name="copy" size={14} />
              </button>
            </div>
            <div className="webhook-events">
              {webhookEvents.map((e) => <span key={e}>{e}</span>)}
            </div>
            <div className="webhook-log">
              <div><span className="dot dot-teal" /> <code>proof.filed</code><em>2m ago · 200</em></div>
              <div><span className="dot dot-teal" /> <code>approval.requested</code><em>14m ago · 200</em></div>
              <div><span className="dot dot-amber" /> <code>risk.escalated</code><em>1h ago · retried</em></div>
            </div>
          </section>
        </div>

        <aside className="access-side">
          <section className="panel code-panel">
            <header className="panel-head">
              <div><span className="eyebrow">Make a call</span><h3>Quickstart</h3></div>
              <div className="code-tabs">
                {(["curl", "js", "mcp"] as const).map((t) => (
                  <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
                    {t === "js" ? "JS" : t.toUpperCase()}
                  </button>
                ))}
              </div>
            </header>
            <div className="code-block">
              <div className="code-top">
                <span>{tab === "curl" ? "terminal" : tab === "js" ? "sdk.ts" : "mcp.json"}</span>
                <button className="tiny-icon" onClick={() => copy(samples[tab], "Code sample")}>
                  <Icon name={copied === "Code sample" ? "check" : "copy"} size={13} />
                </button>
              </div>
              <pre>{samples[tab]}</pre>
            </div>
            <p className="code-note">
              <Icon name="terminal" size={12} />
              The MCP bridge is included in this repo: <code>npm run mcp</code>.
            </p>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div><span className="eyebrow">Live</span><h3>Recent machine calls</h3></div>
              <span className="pulse-dot" />
            </header>
            <div className="api-log">
              {apiEvents.slice(0, 6).map((e) => (
                <div key={e.id} className="api-log-row">
                  <span className="api-ok"><Icon name="check" size={10} /></span>
                  <div>
                    <strong>{e.verb}</strong>
                    <em>{e.actor} · {e.object}</em>
                  </div>
                  <span>{timeAgo(e.created_at, new Date(state.now).getTime())}</span>
                </div>
              ))}
              {!apiEvents.length && <p className="api-empty">No machine calls yet. Hit “Test live call”.</p>}
            </div>
            <button className="panel-link" onClick={testCall}>
              <Icon name="bolt" size={14} /> Send a test request <Icon name="arrowRight" size={14} />
            </button>
          </section>

          <section className="panel security-panel">
            <header className="panel-head">
              <div><span className="eyebrow">Guardrails</span><h3>Boring on purpose</h3></div>
            </header>
            <ul className="security-list">
              <li><Icon name="check" size={12} /> Scoped, expiring keys</li>
              <li><Icon name="check" size={12} /> Every write attributed + replayable</li>
              <li><Icon name="check" size={12} /> Human approval above your ceiling</li>
              <li><Icon name="check" size={12} /> Full export, no lock-in</li>
            </ul>
            <div className="security-foot">
              <span>Schema</span><strong>v1 · stable</strong>
              <span>Retention</span><strong>7 years</strong>
              <span>Last key rotation</span><strong>{dateShort(state.keys[0]?.created_at || state.now)}</strong>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
