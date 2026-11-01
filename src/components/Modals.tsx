import { useMemo, useState } from "react";
import { useApp } from "../store";
import { useAuth } from "../auth";
import { api, request } from "../lib/api";
import { Icon } from "./Icon";
import { Field, Modal, Monogram, CategoryTile, RiskMeter } from "./ui";
import { CATEGORIES, AUTONOMY, money, dueLabel, dateInput, TONES, download } from "../lib/format";

const RECS = [
  { value: "none", label: "One-off" },
  { value: "week:1", label: "Weekly" },
  { value: "month:1", label: "Monthly" },
  { value: "month:3", label: "Quarterly" },
  { value: "year:1", label: "Annual" },
];

export function NewObligationModal() {
  const { state, overlays, setOverlays, actions, nowMs } = useApp();
  const [form, setForm] = useState({
    title: "",
    category: "finance",
    provider: "",
    due: dateInput(nowMs + 14 * 86400000),
    rec: "none",
    amount: "",
    autonomy: "prepare",
    agent_id: "ag_ledger",
    backup: "Hanna Bekele",
    severity: 3,
    proof_required: "Confirmation or receipt",
    consequence: "",
  });
  if (!state || !overlays.newObligation) return null;

  const close = () => setOverlays((o) => ({ ...o, newObligation: false }));
  const set = (patch: any) => setForm((f) => ({ ...f, ...patch }));
  const submit = () => {
    if (!form.title.trim()) return;
    const [unit, interval] = form.rec === "none" ? [null, null] : form.rec.split(":");
    actions.createObligation({
      title: form.title.trim(),
      category: form.category,
      provider: form.provider || "Unassigned",
      due_at: new Date(`${form.due}T10:00:00Z`).toISOString(),
      recurrence: unit ? { unit, interval: Number(interval) } : null,
      amount: Number(form.amount) || 0,
      autonomy: form.autonomy,
      agent_id: form.agent_id,
      backup: form.backup,
      severity: form.severity,
      confidence: 0.9,
      proof_required: form.proof_required,
      consequence: form.consequence || "It slips through the cracks.",
      owner: "Solomon Tigabu",
      owner_kind: form.agent_id ? "agent" : "human",
      source: "manual",
      channel: "app",
      checklist: ["Review details", "Do the thing", "File proof"],
    });
  };

  return (
    <Modal
      title="New obligation"
      eyebrow="Add to the register"
      onClose={close}
      width={620}
      footer={
        <>
          <button className="btn btn-ghost" onClick={close}>Cancel</button>
          <button className="btn btn-ink" onClick={submit} disabled={!form.title.trim()}>
            <Icon name="plus" size={15} /> Create obligation
          </button>
        </>
      }
    >
      <div className="form-stack">
        <Field label="What comes back?" hint="Be specific">
          <input autoFocus value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Business licence renewal" />
        </Field>
        <div className="form-grid">
          <Field label="Category">
            <select value={form.category} onChange={(e) => set({ category: e.target.value })}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Provider">
            <input value={form.provider} onChange={(e) => set({ provider: e.target.value })} placeholder="Bank, office, person…" />
          </Field>
          <Field label="Due">
            <input type="date" value={form.due} onChange={(e) => set({ due: e.target.value })} />
          </Field>
          <Field label="Repeats">
            <select value={form.rec} onChange={(e) => set({ rec: e.target.value })}>
              {RECS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Amount">
            <div className="input-prefix"><span>$</span><input type="number" value={form.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0" /></div>
          </Field>
          <Field label="Severity">
            <select value={form.severity} onChange={(e) => set({ severity: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{["Low", "Minor", "Normal", "High", "Critical"][n - 1]}</option>)}
            </select>
          </Field>
          <Field label="Agent">
            <select value={form.agent_id} onChange={(e) => set({ agent_id: e.target.value })}>
              <option value="">No agent (you own it)</option>
              {state.agents.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.role}</option>)}
            </select>
          </Field>
          <Field label="Autonomy">
            <select value={form.autonomy} onChange={(e) => set({ autonomy: e.target.value })}>
              {Object.entries(AUTONOMY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Proof required">
          <input value={form.proof_required} onChange={(e) => set({ proof_required: e.target.value })} />
        </Field>
        <Field label="Consequence if missed" hint="Optional but useful">
          <textarea rows={2} value={form.consequence} onChange={(e) => set({ consequence: e.target.value })} placeholder="What actually happens if this slips?" />
        </Field>
      </div>
    </Modal>
  );
}

export function CreateAgentModal() {
  const { overlays, setOverlays, actions } = useApp();
  const [form, setForm] = useState({
    name: "",
    role: "Custom agent",
    description: "",
    capabilities: "monitor, execute",
    ceiling: "approve",
    tone: "violet",
    scopes: ["obligations:read", "obligations:write"],
  });
  if (!overlays.newAgent) return null;

  const close = () => setOverlays((o) => ({ ...o, newAgent: false }));
  const set = (patch: any) => setForm((f) => ({ ...f, ...patch }));
  const scopeOptions = ["obligations:read", "obligations:write", "calendar:write", "docs:read", "billing:read", "bank:transfer"];

  const submit = () => {
    if (!form.name.trim()) return;
    actions.createAgent({
      name: form.name.trim(),
      role: form.role,
      description: form.description || "A custom agent built inside Remindify.",
      capabilities: form.capabilities.split(",").map((c) => c.trim()).filter(Boolean),
      autonomy_ceiling: form.ceiling,
      tone: form.tone,
      scopes: form.scopes,
    });
  };

  return (
    <Modal
      title="Build an agent"
      eyebrow="New identity"
      onClose={close}
      width={660}
      footer={
        <>
          <button className="btn btn-ghost" onClick={close}>Cancel</button>
          <button className="btn btn-ink" onClick={submit} disabled={!form.name.trim()}>
            <Icon name="bot" size={15} /> Put it on the bench
          </button>
        </>
      }
    >
      <div className="agent-builder">
        <div className="agent-preview">
          <Monogram name={form.name || "New agent"} tone={form.tone} kind="agent" size="lg" />
          <div>
            <strong>{form.name || "Unnamed agent"}</strong>
            <em>@{form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "handle"} · {form.role}</em>
          </div>
          <span className="preview-ceiling">{AUTONOMY[form.ceiling].label}</span>
        </div>

        <div className="form-grid">
          <Field label="Name">
            <input autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Lease" />
          </Field>
          <Field label="Role">
            <input value={form.role} onChange={(e) => set({ role: e.target.value })} placeholder="What is its job?" />
          </Field>
        </div>

        <Field label="Instructions">
          <textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Describe how it should behave, what it may do alone, and when it must ask." />
        </Field>

        <div className="form-grid">
          <Field label="Capabilities" hint="comma separated">
            <input value={form.capabilities} onChange={(e) => set({ capabilities: e.target.value })} />
          </Field>
          <Field label="Autonomy ceiling">
            <select value={form.ceiling} onChange={(e) => set({ ceiling: e.target.value })}>
              {Object.entries(AUTONOMY).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.desc}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Accent">
          <div className="tone-picker">
            {Object.keys(TONES).map((tone) => (
              <button
                key={tone}
                className={form.tone === tone ? "on" : ""}
                style={{ background: TONES[tone] }}
                onClick={() => set({ tone })}
                aria-label={tone}
              />
            ))}
          </div>
        </Field>

        <Field label="Scopes" hint="least privilege">
          <div className="scope-picker">
            {scopeOptions.map((s) => (
              <button
                key={s}
                className={form.scopes.includes(s) ? "on" : ""}
                onClick={() =>
                  set({
                    scopes: form.scopes.includes(s)
                      ? form.scopes.filter((x: string) => x !== s)
                      : [...form.scopes, s],
                  })
                }
              >
                {form.scopes.includes(s) && <Icon name="check" size={10} />} {s}
              </button>
            ))}
          </div>
        </Field>

        <p className="builder-note">
          <Icon name="shield" size={12} />
          New agents start at trust 80. They earn autonomy by filing accepted proof — never by asking.
        </p>
      </div>
    </Modal>
  );
}

export function HireModal() {
  const { state, overlays, setOverlays, actions, nowMs } = useApp();
  const provider = state?.providers.find((p) => p.id === overlays.hire);
  const [mode, setMode] = useState<"obligation" | "job">("obligation");
  const [obligationId, setObligationId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDue, setJobDue] = useState(() => dateInput(nowMs + 7 * 86400000));
  const [jobTime, setJobTime] = useState("09:00");

  const candidates = useMemo(
    () =>
      (state?.obligations || [])
        .filter((o) => !["done", "archived"].includes(o.status) && !o.marketplace)
        .sort((a, b) => b.risk.score - a.risk.score)
        .slice(0, 8),
    [state?.obligations]
  );

  if (!state || !provider || !overlays.hire) return null;
  const close = () => setOverlays((o) => ({ ...o, hire: null }));
  const selected = candidates.find((o) => o.id === obligationId);
  const canSubmit = mode === "obligation" ? !!selected : jobTitle.trim().length > 2;

  const jobDueMs = new Date(`${jobDue}T${jobTime || "09:00"}:00`).getTime();
  const jobDueIso = Number.isFinite(jobDueMs) ? new Date(jobDueMs).toISOString() : null;

  const submit = () => {
    if (!canSubmit) return;
    if (mode === "obligation") {
      actions.hire({ provider_id: provider.id, obligation_id: obligationId });
    } else {
      actions.hire({ provider_id: provider.id, title: jobTitle.trim(), due_at: jobDueIso });
    }
  };

  return (
    <Modal
      title={`Book ${provider.name}`}
      eyebrow={`${provider.kind === "agent" ? "Agent" : "Human"} · ${provider.specialty}`}
      onClose={close}
      width={640}
      footer={
        <>
          <button className="btn btn-ghost" onClick={close}>Cancel</button>
          <button className="btn btn-ink" onClick={submit} disabled={!canSubmit}>
            <Icon name="lock" size={15} /> Confirm · ${provider.price}
          </button>
        </>
      }
    >
      <div className="hire-provider">
        <Monogram name={provider.name} tone={provider.tone} kind={provider.kind} size="md" />
        <div>
          <strong>{provider.name}</strong>
          <span>{provider.rating} ★ · {provider.jobs.toLocaleString()} jobs · replies in ~{provider.response_min}m</span>
        </div>
        <span className="hire-sla">SLA {provider.sla}</span>
      </div>

      <div className="hire-tabs">
        <button className={mode === "obligation" ? "on" : ""} onClick={() => setMode("obligation")}>
          <Icon name="list" size={14} /> Attach to an obligation
        </button>
        <button className={mode === "job" ? "on" : ""} onClick={() => setMode("job")}>
          <Icon name="plus" size={14} /> Post a new job
        </button>
      </div>

      {mode === "obligation" ? (
        <div className="hire-obligations">
          {candidates.map((o) => (
            <button
              key={o.id}
              className={`hire-obligation ${obligationId === o.id ? "on" : ""}`}
              onClick={() => setObligationId(o.id)}
            >
              <CategoryTile category={o.category} size={32} />
              <span className="hire-obligation-main">
                <strong>{o.title}</strong>
                <em>{o.provider} · {dueLabel(o.due_at, nowMs)}</em>
              </span>
              <RiskMeter risk={o.risk} />
            </button>
          ))}
        </div>
      ) : (
        <div className="form-stack">
          <Field label="What needs doing?">
            <input autoFocus value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Renew the Trade Bureau licence" />
          </Field>
          <div className="hire-due">
            <Field label="Needed by">
              <input type="date" value={jobDue} onChange={(e) => setJobDue(e.target.value)} />
            </Field>
            <Field label="At">
              <input type="time" value={jobTime} onChange={(e) => setJobTime(e.target.value || "09:00")} />
            </Field>
          </div>
          <p className="hire-due-note">
            <Icon name="calendar" size={12} /> Lands on your register {jobDueIso ? dueLabel(jobDueIso, nowMs) : "today"} — the provider works to that date.
          </p>
        </div>
      )}

      <div className="hire-summary">
        <div><span>Price</span><strong>${provider.price} <em>{provider.price_unit}</em></strong></div>
        <div><span>Escrow</span><strong>Released on proof</strong></div>
        <div><span>Access</span><strong>Scoped, expires {provider.sla}</strong></div>
      </div>

      <div className="hire-terms">
        <p><Icon name="shield" size={12} /> {provider.name} sees only this obligation: title, deadline, provider and the documents you attach.</p>
        <p><Icon name="receipt" size={12} /> Proof is required before funds release. If it's rejected, the bench replaces it free.</p>
      </div>
    </Modal>
  );
}

export function DeleteAccountModal() {
  const { overlays, setOverlays } = useApp();
  const { user } = useAuth();
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!overlays.deleteAccount) return null;

  const needsPassword = Boolean(user?.providers.includes("email"));
  const canDelete = confirm.trim().toLowerCase() === "delete" && (!needsPassword || password.length > 0);

  const close = () => {
    setOverlays((o) => ({ ...o, deleteAccount: false }));
    setConfirm("");
    setPassword("");
    setError(null);
  };

  const downloadCopy = async () => {
    setExporting(true);
    setError(null);
    try {
      const data = await request("/api/export");
      download(
        `remindify-export-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(data, null, 2)
      );
    } catch (err: any) {
      setError(err?.message || "The export didn't build. Try again before deleting.");
    } finally {
      setExporting(false);
    }
  };

  const remove = async () => {
    if (!canDelete || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount({
        confirm: confirm.trim(),
        password: needsPassword ? password : undefined,
      });
      window.location.assign("/");
    } catch (err: any) {
      setError(err?.message || "That didn't go through. Nothing was deleted.");
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Delete this account?"
      eyebrow="Data control"
      onClose={busy ? () => {} : close}
      width={560}
      footer={
        <>
          <button className="btn btn-ghost" onClick={close} disabled={busy}>Keep my account</button>
          <button className="btn btn-danger" onClick={remove} disabled={!canDelete || busy}>
            <Icon name="trash" size={15} />
            {busy ? "Deleting…" : "Delete everything"}
          </button>
        </>
      }
    >
      <div className="form-stack">
        <div className="danger-note">
          <Icon name="alert" size={16} />
          <p>
            This erases your private register for good — obligations, agents, approvals, receipts,
            escrows, API keys and machine credentials. Sign-in sessions are revoked and the account
            itself is removed. It cannot be undone.
          </p>
        </div>

        <p className="danger-copy">
          Want a copy first? Export includes everything currently in the register.
        </p>
        <button className="btn btn-ghost btn-sm" onClick={downloadCopy} disabled={exporting}>
          <Icon name="download" size={14} /> {exporting ? "Building export…" : "Download my data"}
        </button>

        <Field label="Type delete to confirm" hint="case-insensitive">
          <input
            autoFocus
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="delete"
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
        </Field>

        {needsPassword && (
          <Field label="Current password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={busy}
            />
          </Field>
        )}

        {error && <p className="danger-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
