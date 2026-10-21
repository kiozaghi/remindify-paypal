import { useRef, useState } from "react";
import { useApp } from "../store";
import { Icon } from "../components/Icon";
import { CategoryTile, Field } from "../components/ui";
import { CATEGORIES, recurrenceLabel, longDate } from "../lib/format";
import type { Draft } from "../types";

const SAMPLES = [
  {
    key: "insurance",
    label: "Insurance renewal letter",
    icon: "shield",
    note: "Email · 1 renewal, 2 dates",
    text: `Subject: Your motor insurance renewal — Awash Insurance
Dear Solomon,
Your comprehensive motor policy for vehicle 3-A12345 expires on November 28, 2026.
The renewal premium is USD 486. Renew before November 24 to keep your 4% loyalty discount.
Please confirm payment by bank transfer. A new certificate will be issued within 24 hours.`,
  },
  {
    key: "vehicle",
    label: "Garage + inspection email",
    icon: "car",
    note: "Email · 2 dates, 1 cost",
    text: `Dawit Auto — service reminder
Your vehicle is due for its 10,000 km service in 3 weeks.
Slot held: Saturday 09:00. Cost estimate USD 140.
Please confirm by October 30 so we can keep the bay.
Annual roadworthiness inspection is also due in 2 months.`,
  },
  {
    key: "work",
    label: "Quarterly compliance dump",
    icon: "briefcase",
    note: "Notes · messy on purpose",
    text: `Reminder: Q4 compliance pack
- Business licence renewal is due on 15 December 2026. Fee ETB 17,100.
- ISO 27001 surveillance audit scheduled 12 January 2027.
- Renew 3 staff contracts before 30 November 2026.
- Payroll tax filing is monthly — due on the 25th.`,
  },
  {
    key: "people",
    label: "Family + relationship notes",
    icon: "heart",
    note: "Notes · the ones that matter",
    text: `Mum's birthday is on 5 March. She mentioned the ceramic tea set from Ada Ceramics.
Anniversary dinner — book a table at Juniper every year on 14 February.
Call Grandma every week. Last call was 12 days ago.`,
  },
];

const REC_OPTIONS = [
  { value: "none", label: "One-off" },
  { value: "week:1", label: "Weekly" },
  { value: "month:1", label: "Monthly" },
  { value: "month:3", label: "Quarterly" },
  { value: "month:6", label: "Every 6 months" },
  { value: "year:1", label: "Annual" },
];

const recValue = (rec: Draft["recurrence"]) => (rec ? `${rec.unit}:${rec.interval}` : "none");
const decodeRec = (value: string) => {
  if (value === "none") return null;
  const [unit, interval] = value.split(":");
  return { unit, interval: Number(interval) };
};

function DraftCard({
  draft, onChange, onRemove, agents,
}: {
  draft: Draft;
  onChange: (id: string, patch: Partial<Draft>) => void;
  onRemove: (id: string) => void;
  agents: { id: string; name: string }[];
}) {
  const dateValue = new Date(draft.due_at).toISOString().slice(0, 10);
  const confidenceTone = draft.confidence > 0.9 ? "high" : draft.confidence > 0.75 ? "mid" : "low";
  return (
    <article className="draft-card">
      <div className="draft-top">
        <CategoryTile category={draft.category} />
        <div className="draft-title-wrap">
          <input
            className="draft-title"
            value={draft.title}
            onChange={(e) => onChange(draft.id, { title: e.target.value })}
            aria-label="Obligation title"
          />
          <div className="draft-evidence">
            <Icon name="sparkle" size={11} />
            <span>“{draft.evidence?.sentence || "Added manually"}”</span>
          </div>
        </div>
        <span className={`confidence conf-${confidenceTone}`}>
          {Math.round(draft.confidence * 100)}% <em>match</em>
        </span>
        <button className="icon-btn" onClick={() => onRemove(draft.id)} title="Remove">
          <Icon name="x" size={15} />
        </button>
      </div>

      <div className="draft-fields">
        <Field label="Category">
          <select value={draft.category} onChange={(e) => onChange(draft.id, { category: e.target.value })}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Provider">
          <input value={draft.provider} onChange={(e) => onChange(draft.id, { provider: e.target.value })} />
        </Field>
        <Field label="Due">
          <input
            type="date"
            value={dateValue}
            onChange={(e) =>
              e.target.value && onChange(draft.id, { due_at: new Date(`${e.target.value}T10:00:00Z`).toISOString() })
            }
          />
        </Field>
        <Field label="Repeats">
          <select
            value={recValue(draft.recurrence)}
            onChange={(e) => onChange(draft.id, { recurrence: decodeRec(e.target.value) })}
          >
            {REC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Amount">
          <div className="input-prefix">
            <span>$</span>
            <input
              type="number"
              value={draft.amount || ""}
              onChange={(e) => onChange(draft.id, { amount: Number(e.target.value) })}
              placeholder="0"
            />
          </div>
        </Field>
        <Field label="Autonomy">
          <select
            value={draft.autonomy}
            onChange={(e) => onChange(draft.id, { autonomy: e.target.value as any })}
          >
            <option value="notify">Notify</option>
            <option value="prepare">Prepare</option>
            <option value="approve">Approve</option>
            <option value="autopilot">Autopilot</option>
          </select>
        </Field>
        <Field label="Agent">
          <select value={draft.agent_id || ""} onChange={(e) => onChange(draft.id, { agent_id: e.target.value || null })}>
            <option value="">No agent yet</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Severity">
          <select value={draft.severity} onChange={(e) => onChange(draft.id, { severity: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{["Low", "Minor", "Normal", "High", "Critical"][n - 1]}</option>)}
          </select>
        </Field>
      </div>

      <div className="draft-foot">
        <span><Icon name="repeat" size={12} /> {recurrenceLabel(draft.recurrence)}</span>
        <span><Icon name="clock" size={12} /> {longDate(draft.due_at)}</span>
        <span><Icon name="user" size={12} /> {draft.owner}</span>
        <span className="draft-proof"><Icon name="receipt" size={12} /> Proof: {draft.proof_required}</span>
      </div>
    </article>
  );
}

export default function Capture() {
  const { state, actions, toast, navigate } = useApp();
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [parsing, setParsing] = useState(false);
  const [confirmed, setConfirmed] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!state) return null;

  const parse = async () => {
    if (text.trim().length < 4) {
      toast("Not enough to work with", "Paste a letter, an email or a messy list.", "warn");
      return;
    }
    setParsing(true);
    setConfirmed(0);
    const result = await actions.capture(text);
    setParsing(false);
    if (result?.items) {
      setDrafts((prev) => [...prev.filter((d) => !result.items.some((i: any) => i.title === d.title)), ...result.items]);
      if (!result.items.length) toast("Nothing extracted", "Try adding a date or a clearer task line.", "warn");
    }
  };

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch, needs_review: false } : d)));
  const remove = (id: string) => setDrafts((prev) => prev.filter((d) => d.id !== id));

  const confirm = async () => {
    if (!drafts.length) return;
    const result = await actions.addObligations(drafts);
    if (result) {
      setConfirmed(drafts.length);
      setDrafts([]);
      setText("");
    }
  };

  const readFile = async (file: File) => {
    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      toast("PDFs need the document agent", "This demo parses text. Paste the letter body, or try a sample.", "warn");
      return;
    }
    if (file.size > 400_000) {
      toast("That file is a little large", "Try the text you actually need.", "warn");
      return;
    }
    const content = await file.text();
    setText(content);
    toast("Document loaded", "Ready to structure locally.", "default");
  };

  return (
    <div className="view capture-view">
      <header className="view-head">
        <div>
          <span className="eyebrow">Capture</span>
          <h1>Give it to Remy.</h1>
          <p>Paste an email, a renewal letter, a receipt — or a messy note. Get structured obligations, owners and proof.</p>
        </div>
        <div className="parser-badge">
          <span className="parser-badge-icon"><Icon name="shield" size={16} /></span>
          <div>
            <strong>Local parser</strong>
            <em>No cloud · no key · 0.4s</em>
          </div>
        </div>
      </header>

      <div className="capture-grid">
        <section className={`composer ${dragging ? "dragging" : ""}`}>
          <div className="composer-head">
            <div className="composer-tabs">
              <span className="on"><Icon name="file" size={13} /> Paste text</span>
              <span><Icon name="mail" size={13} /> Forward an email</span>
              <span><Icon name="phone" size={13} /> Voice note</span>
            </div>
            <span className="composer-secure"><Icon name="lock" size={11} /> stays on device</span>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Paste anything. For example:\n\n"Your motor insurance renews on 28 November. Premium USD 486. Please confirm by the 24th to keep the 4% discount."`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) readFile(file);
            }}
          />

          <div className="composer-samples">
            <span className="eyebrow">Try a document</span>
            <div className="sample-chips">
              {SAMPLES.map((s) => (
                <button key={s.key} onClick={() => { setText(s.text); setDrafts([]); }}>
                  <Icon name={s.icon} size={13} /> {s.label}
                </button>
              ))}
            </div>
          </div>

          <footer className="composer-foot">
            <div className="composer-tools">
              <button className="tool-btn" onClick={() => fileRef.current?.click()}>
                <Icon name="file" size={14} /> Upload .txt
              </button>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".txt,.md,.csv,text/plain"
                onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
              />
              <span className="composer-count">{text.length.toLocaleString()} chars</span>
            </div>
            <button className="btn btn-ink" onClick={parse} disabled={parsing}>
              {parsing ? <span className="spinner" /> : <Icon name="sparkle" size={16} />}
              {parsing ? "Reading…" : "Parse & structure"}
            </button>
          </footer>
        </section>

        <aside className="capture-side">
          <section className="panel">
            <header className="panel-head">
              <div><span className="eyebrow">How it works</span><h3>From prose to proof</h3></div>
            </header>
            <ol className="capture-steps">
              <li><span>01</span><div><strong>Extract</strong><em>Dates, amounts, providers, recurrence — even from messy lines.</em></div></li>
              <li><span>02</span><div><strong>Infer risk</strong><em>Severity × urgency × confidence. Money at stake is made explicit.</em></div></li>
              <li><span>03</span><div><strong>Assign the bench</strong><em>Best agent, a human backup, and a proof requirement.</em></div></li>
              <li><span>04</span><div><strong>Keep the trail</strong><em>Approvals, receipts and outcomes are logged forever.</em></div></li>
            </ol>
          </section>

          <section className="panel capture-sample-panel">
            <header className="panel-head">
              <div><span className="eyebrow">Better inputs</span><h3>What to paste</h3></div>
            </header>
            <div className="sample-list">
              {SAMPLES.map((s) => (
                <button key={s.key} className="sample-row" onClick={() => { setText(s.text); setDrafts([]); }}>
                  <span className="sample-icon"><Icon name={s.icon} size={15} /></span>
                  <span><strong>{s.label}</strong><em>{s.note}</em></span>
                  <Icon name="arrowUpRight" size={14} />
                </button>
              ))}
            </div>
            <p className="capture-tip">
              <Icon name="sparkle" size={12} />
              In the paid product, Remindify watches a dedicated inbox and your document vault — no pasting required.
            </p>
          </section>
        </aside>
      </div>

      {parsing && (
        <section className="block">
          <header className="block-head">
            <div><span className="eyebrow">Extracting</span><h2>Remy is reading…</h2></div>
            <span className="thinking"><i /><i /><i /></span>
          </header>
          <div className="draft-grid">
            {[1, 2].map((n) => (
              <div className="draft-card skeleton-card" key={n}>
                <div className="skeleton w40" /><div className="skeleton w90" />
                <div className="skeleton w70" /><div className="skeleton w50" />
              </div>
            ))}
          </div>
        </section>
      )}

      {!parsing && drafts.length > 0 && (
        <section className="block drafts-block">
          <header className="block-head">
            <div>
              <span className="eyebrow">Review before it counts</span>
              <h2>{drafts.length} {drafts.length === 1 ? "obligation" : "obligations"} extracted <span className="count-badge">{drafts.length}</span></h2>
            </div>
            <div className="draft-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setDrafts([])}>Discard</button>
              <button className="btn btn-ink" onClick={confirm}>
                <Icon name="check" size={16} /> Confirm &amp; schedule {drafts.length}
              </button>
            </div>
          </header>
          <div className="draft-grid">
            {drafts.map((d) => (
              <DraftCard key={d.id} draft={d} onChange={update} onRemove={remove} agents={state.agents} />
            ))}
          </div>
          <p className="draft-note">
            <Icon name="info" size={12} />
            Dates are parsed in your local timezone. Nothing is scheduled until you confirm.
          </p>
        </section>
      )}

      {confirmed > 0 && !drafts.length && (
        <div className="success-banner">
          <span className="success-icon"><Icon name="checkCircle" size={20} /></span>
          <div>
            <strong>{confirmed} {confirmed === 1 ? "obligation is" : "obligations are"} now live.</strong>
            <em>Risk scored, owners assigned, backups in place.</em>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("obligations")}>
            Open the register <Icon name="arrowRight" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
