import { useMemo, useState } from "react";
import { useApp } from "../store";
import { Icon } from "../components/Icon";
import { CategoryTile, Monogram, AutonomyControl, RiskMeter } from "../components/ui";
import {
  AUTONOMY, BANDS, CATEGORIES, money, dueLabel, dateShort, longDate, recurrenceLabel, timeAgo, riskTone,
} from "../lib/format";

export default function ObligationDrawer() {
  const { state, overlays, setOverlays, nowMs, actions, openAgent, navigate } = useApp();
  const [completing, setCompleting] = useState(false);
  const [proof, setProof] = useState("");
  const [menu, setMenu] = useState(false);
  const [payerEmail, setPayerEmail] = useState("");

  const ob = state?.obligations.find((o) => o.id === overlays.drawer);
  if (!state || !ob) return null;

  const agent = state.agents.find((a) => a.id === ob.agent_id);
  const category = CATEGORIES[ob.category] || CATEGORIES.other;
  const runs = state.runs.filter((r) => r.obligation_id === ob.id).slice(0, 4);
  const events = state.events.filter((e) => e.object === ob.title).slice(0, 4);
  const payment = state.payments.find((p) => p.obligation_id === ob.id && p.rail === "paypal");
  const invoice = state.invoices.find((i) => i.obligation_id === ob.id) || null;
  const escrow = state.escrows.find((e) => e.obligation_id === ob.id) || null;
  const invoicable = ob.amount > 0
    && ["active", "waiting"].includes(ob.status)
    && !ob.payee_paypal_email;
  const payable = ob.amount > 0
    && ["active", "waiting"].includes(ob.status)
    && !payment?.capture_id
    && state.paypal.configured;
  const close = () => setOverlays((o) => ({ ...o, drawer: null }));

  const timeline = useMemo(() => {
    const items = [
      ...runs.map((r) => ({
        id: r.id, at: r.created_at, actor: r.agent?.name || "Agent", tone: r.agent?.tone || "violet",
        kind: "agent", title: r.action, detail: r.detail, proof: r.proof,
      })),
      ...events.map((e) => ({
        id: e.id, at: e.created_at, actor: e.actor, tone: "ink",
        kind: e.actor_type, title: `${e.verb}`, detail: e.detail, proof: e.kind === "proof" ? e.detail : null,
      })),
    ];
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 7);
  }, [runs, events]);

  const spendCeiling = Number(agent?.spend_ceiling) || null;
  const aboveSpendCeiling = Boolean(spendCeiling && Number(ob.amount || 0) > spendCeiling);
  const autonomyAboveCeiling = agent
    ? aboveSpendCeiling ||
      ["notify", "prepare", "approve", "autopilot"].indexOf(ob.autonomy) >
        ["notify", "prepare", "approve", "autopilot"].indexOf(agent.autonomy_ceiling)
    : false;

  const toggleStep = (step: string) => {
    const done = step.startsWith("✓ ");
    const next = ob.checklist.map((s) =>
      s === step ? (done ? s.replace("✓ ", "") : `✓ ${s}`) : s
    );
    actions.patchObligation(ob.id, { checklist: next });
  };

  return (
    <div className="drawer-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <aside className="drawer">
        <header className="drawer-head">
          <div className="drawer-title">
            <CategoryTile category={ob.category} size={42} />
            <div>
              <span className="eyebrow">{category.label} · {recurrenceLabel(ob.recurrence)}</span>
              <h2>{ob.title}</h2>
            </div>
          </div>
          <div className="drawer-head-actions">
            <button className="icon-btn" onClick={() => setMenu(!menu)} title="More"><Icon name="more" size={18} /></button>
            <button className="icon-btn" onClick={close} title="Close"><Icon name="x" size={18} /></button>
            {menu && (
              <div className="drawer-menu">
                <button onClick={() => { actions.remove(ob.id); setMenu(false); }}>
                  <Icon name="trash" size={14} /> Delete obligation
                </button>
                <button onClick={() => { actions.runNow(ob.id); setMenu(false); }}>
                  <Icon name="bolt" size={14} /> Dispatch agent now
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="drawer-body">
          <section className={`risk-panel tone-${riskTone(ob.risk.band)}`}>
            <div className="risk-panel-score">
              <span className="eyebrow">Risk score</span>
              <strong>{ob.risk.score}<em>/100</em></strong>
              <span className={`risk-label tone-${riskTone(ob.risk.band)}`}>{BANDS[ob.risk.band].label}</span>
            </div>
            <div className="risk-panel-detail">
              <RiskMeter risk={ob.risk} showScore={false} />
              <p>
                {ob.risk.days < 0
                  ? `Overdue by ${Math.abs(Math.round(ob.risk.days))} days.`
                  : `Due in ${Math.ceil(ob.risk.days)} days.`}{" "}
                Severity {ob.severity}/5. Confidence {Math.round(ob.confidence * 100)}%.
                {ob.penalty > 0 && <> <strong>{money(ob.penalty)}</strong> exposed if missed.</>}
              </p>
            </div>
            <div className="risk-panel-due">
              <span className="eyebrow">Deadline</span>
              <strong>{dueLabel(ob.due_at, nowMs)}</strong>
              <em>{longDate(ob.due_at)}</em>
            </div>
          </section>

          {ob.handover_at && (
            <section className="handover-banner">
              <div className="handover-copy">
                <span className="handover-tag"><Icon name="users" size={12} /> Escalated to your backup</span>
                <strong>{ob.owner} owns this now</strong>
                <em>{ob.handover_reason} Reclaim it when you are ready.</em>
              </div>
              <button className="btn btn-ink btn-sm" onClick={() => actions.reclaim(ob.id)}>
                <Icon name="arrowLeft" size={14} /> Reclaim
              </button>
            </section>
          )}

          <section className="drawer-section">
            <div className="drawer-section-head">
              <h3>How far can it go?</h3>
              <span className="eyebrow">Autonomy</span>
            </div>
            <div className="autonomy-box">
              <div className="autonomy-head">
                {agent ? (
                  <>
                    <button className="agent-chip" onClick={() => openAgent(agent.id)}>
                      <Monogram name={agent.name} tone={agent.tone} kind="agent" size="xs" />
                      <span><strong>{agent.name}</strong><em>{agent.role}</em></span>
                      <Icon name="arrowUpRight" size={12} />
                    </button>
                    <span className="ceiling-tag">
                      ceiling · {AUTONOMY[agent.autonomy_ceiling].label}
                      {spendCeiling ? ` · $${spendCeiling.toLocaleString("en-US")}/run` : ""}
                    </span>
                  </>
                ) : (
                  <span className="no-agent"><Icon name="users" size={14} /> You own this one</span>
                )}
              </div>
              <AutonomyControl obligation={ob} />
              {autonomyAboveCeiling && (
                <p className="ceiling-warning">
                  <Icon name="alert" size={12} />
                  {aboveSpendCeiling
                    ? ` Above ${agent?.name}'s $${spendCeiling?.toLocaleString("en-US")} per-run ceiling — a human will still approve each run.`
                    : ` Above ${agent?.name}'s ceiling — a human will still approve each run.`}
                </p>
              )}
            </div>
          </section>

          <section className="drawer-section">
            <div className="drawer-section-head"><h3>Why it matters</h3></div>
            <p className="consequence">{ob.consequence}</p>
            <div className="meta-grid">
              <div><span>Provider</span><strong>{ob.provider}</strong></div>
              <div><span>Cost</span><strong>{ob.amount ? money(ob.amount) : "—"}</strong></div>
              <div><span>Backup</span><strong>{ob.backup || "None yet"}</strong></div>
              <div><span>Grace</span><strong>{ob.grace_days ? `${ob.grace_days} days` : "None"}</strong></div>
              <div><span>Source</span><strong className="capitalize">{ob.source}</strong></div>
              <div><span>Channel</span><strong className="capitalize">{ob.channel}</strong></div>
            </div>
          </section>

          <section className="drawer-section">
            <div className="drawer-section-head">
              <h3>Checklist</h3>
              <span className="eyebrow">{ob.checklist.filter((s) => s.startsWith("✓")).length}/{ob.checklist.length}</span>
            </div>
            <div className="checklist">
              {ob.checklist.map((step) => {
                const done = step.startsWith("✓ ");
                return (
                  <button className={`check-row ${done ? "done" : ""}`} key={step} onClick={() => toggleStep(step)}>
                    <span className="check-box">{done && <Icon name="check" size={11} />}</span>
                    <span>{step.replace("✓ ", "")}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="drawer-section">
            <div className="drawer-section-head">
              <h3>Proof</h3>
              <span className="proof-required"><Icon name="receipt" size={12} /> required</span>
            </div>
            <div className="proof-box">
              <div>
                <strong>{ob.proof_required}</strong>
                <em>{ob.last_proof ? `Last filed: ${ob.last_proof}` : "Nothing filed yet."}</em>
              </div>
              <Icon name="shield" size={18} />
            </div>
            {payment?.capture_id && (
              <span className="mini-proof">
                <Icon name="receipt" size={10} />
                PayPal capture {payment.capture_id} · ${Number(payment.amount).toFixed(2)}
                {state.paypal.mode === "sandbox" ? " · sandbox" : ""}
              </span>
            )}
          </section>

          <section className="drawer-section">
            <div className="drawer-section-head">
              <h3>Settlement</h3>
              <span className="eyebrow">PayPal</span>
            </div>
            {invoice ? (
              <div className="proof-box invoice-box">
                <div>
                  <strong>Invoice {invoice.paypal_invoice_id}</strong>
                  <em>
                    {invoice.payer_paypal_email} · {money(invoice.amount)} · {invoice.status}
                    {invoice.reminders ? ` · ${invoice.reminders} reminder${invoice.reminders === 1 ? "" : "s"}` : ""}
                  </em>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={invoice.demo}
                  title={invoice.demo ? "Sample invoice — send a live one to remind it" : "Send a reminder"}
                  onClick={() => actions.remindInvoice(invoice.id)}
                >
                  Remind
                </button>
              </div>
            ) : invoicable && ob.channel === "paypal" ? (
              <div className="complete-form invoice-form">
                <input
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(e.target.value)}
                  placeholder={ob.payer_paypal_email || "client@business.example.com"}
                />
                <button
                  className="btn btn-lime btn-sm"
                  onClick={() => actions.sendInvoice(ob.id, payerEmail.trim() || undefined)}
                >
                  <Icon name="receipt" size={14} /> Send invoice
                </button>
              </div>
            ) : ob.payee_paypal_email ? null : (
              <p className="drawer-empty">No invoice on this obligation.</p>
            )}
            {escrow ? (
              <div className="proof-box invoice-box">
                <div>
                  <strong>Escrow {escrow.status.replace(/_/g, " ")}</strong>
                  <em>
                    {money(escrow.amount)} held · {money(escrow.net_payout)} net to{" "}
                    {escrow.payee_paypal_email}
                  </em>
                </div>
                <span className="mini-proof"><Icon name="shield" size={10} /> {escrow.short_id}</span>
              </div>
            ) : ob.payee_paypal_email ? (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setOverlays((o) => ({ ...o, drawer: null, escrowFor: ob.id }));
                  navigate("trust");
                }}
              >
                <Icon name="shield" size={13} /> Open escrow in Trust
              </button>
            ) : null}
            <p className="ceiling-help">
              PayPal moves the money; Remindify never holds a balance. The invoice is rebuilt from this obligation,
              so the amount cannot be edited in the request.
            </p>
          </section>

          <section className="drawer-section">
            <div className="drawer-section-head"><h3>Timeline</h3><span className="eyebrow">Immutable</span></div>            <div className="drawer-timeline">
              {timeline.length ? timeline.map((t) => (
                <div className="drawer-event" key={t.id}>
                  <span className={`drawer-event-dot actor-${t.kind}`} />
                  <div>
                    <p><strong>{t.actor}</strong> {t.title}</p>
                    <em>{t.detail}</em>
                    {t.proof && <span className="mini-proof"><Icon name="file" size={10} /> {t.proof}</span>}
                  </div>
                  <span className="drawer-event-time">{timeAgo(t.at, nowMs)}</span>
                </div>
              )) : <p className="drawer-empty">No activity yet. The first run will show up here.</p>}
            </div>
          </section>
        </div>

        <footer className="drawer-foot">
          {completing ? (
            <div className="complete-form">
              <input
                autoFocus
                value={proof}
                onChange={(e) => setProof(e.target.value)}
                placeholder={ob.proof_required}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    actions.complete(ob.id, { proof: proof || ob.proof_required, by: state.user });
                    close();
                  }
                }}
              />
              <button
                className="btn btn-lime btn-sm"
                onClick={() => { actions.complete(ob.id, { proof: proof || ob.proof_required }); close(); }}
              >
                <Icon name="check" size={14} /> File proof
              </button>
              <button className="tiny-icon" onClick={() => setCompleting(false)}><Icon name="x" size={14} /></button>
            </div>
          ) : (
            <>
              <button className="btn btn-ink" onClick={() => setCompleting(true)}>
                <Icon name="check" size={16} /> Complete
              </button>
              <button className="btn btn-ghost" onClick={() => actions.snooze(ob.id, 3)}>
                <Icon name="clock" size={16} /> +3 days
              </button>
              {payable && (
                <button className="btn btn-lime" onClick={() => actions.payWithPaypal(ob.id)}>
                  <Icon name="wallet" size={16} /> Pay {money(ob.amount)} with PayPal
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => actions.runNow(ob.id)}>
                <Icon name="bolt" size={16} /> Run now
              </button>
              <span className="drawer-foot-hint">
                <Icon name="lock" size={11} /> Logged to {state.workspace}
              </span>
            </>
          )}
        </footer>
      </aside>
    </div>
  );
}
