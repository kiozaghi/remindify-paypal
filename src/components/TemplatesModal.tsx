import { useState } from "react";
import { useApp } from "../store";
import { Icon } from "./Icon";
import { CategoryTile, Modal } from "./ui";
import { CATEGORIES, dueLabel, money } from "../lib/format";

const DAY = 86400000;

type TemplateItem = {
  title: string;
  category: string;
  provider: string;
  inDays: number;
  recurrence: { unit: string; interval: number } | null;
  amount?: number;
  autonomy: string;
  agent_id?: string;
  severity: number;
  proof_required: string;
  consequence: string;
};

type Pack = {
  id: string;
  name: string;
  tagline: string;
  detail: string;
  icon: string;
  tone: string;
  items: TemplateItem[];
};

const PACKS: Pack[] = [
  {
    id: "compliance",
    name: "Annual compliance",
    tagline: "The filings that stop the business.",
    detail: "Certificates, registrations and cover for a small studio. Import once, then let the register carry it.",
    icon: "briefcase",
    tone: "violet",
    items: [
      {
        title: "Fire safety certificate",
        category: "work", provider: "Trade Bureau", inDays: 30,
        recurrence: { unit: "year", interval: 1 }, amount: 120, autonomy: "prepare",
        agent_id: "ag_compliance", severity: 5,
        proof_required: "Certificate or inspection report",
        consequence: "A lapsed certificate can close the premises.",
      },
      {
        title: "Data protection registration",
        category: "work", provider: "Data Protection Authority", inDays: 45,
        recurrence: { unit: "year", interval: 1 }, amount: 80, autonomy: "approve",
        agent_id: "ag_compliance", severity: 5,
        proof_required: "Registration confirmation",
        consequence: "Unregistered processing creates regulatory exposure.",
      },
      {
        title: "Professional indemnity insurance",
        category: "finance", provider: "Awash Insurance", inDays: 60,
        recurrence: { unit: "year", interval: 1 }, amount: 640, autonomy: "approve",
        agent_id: "ag_ledger", severity: 5,
        proof_required: "Policy certificate + receipt",
        consequence: "One claim without cover can end the studio.",
      },
      {
        title: "Annual company return",
        category: "finance", provider: "Ministry of Revenue", inDays: 90,
        recurrence: { unit: "year", interval: 1 }, amount: 210, autonomy: "approve",
        agent_id: "ag_ledger", severity: 5,
        proof_required: "Filed return + receipt",
        consequence: "Late returns trigger fines and strike the company off.",
      },
    ],
  },
  {
    id: "home",
    name: "Home & vehicle",
    tagline: "The expensive things you only notice when they break.",
    detail: "Cover, servicing and the annual checks that protect the place you live in.",
    icon: "home",
    tone: "amber",
    items: [
      {
        title: "Home contents insurance",
        category: "finance", provider: "Awash Insurance", inDays: 21,
        recurrence: { unit: "year", interval: 1 }, amount: 220, autonomy: "approve",
        agent_id: "ag_ledger", severity: 4,
        proof_required: "Policy certificate",
        consequence: "A break-in or flood would be entirely out of pocket.",
      },
      {
        title: "Boiler service",
        category: "home", provider: "HomeGuard", inDays: 45,
        recurrence: { unit: "year", interval: 1 }, amount: 90, autonomy: "prepare",
        agent_id: "ag_mileage", severity: 3,
        proof_required: "Service invoice",
        consequence: "Small faults become winter emergencies.",
      },
      {
        title: "Gutter and roof check",
        category: "home", provider: "HomeGuard", inDays: 75,
        recurrence: { unit: "year", interval: 1 }, amount: 60, autonomy: "prepare",
        agent_id: "ag_mileage", severity: 3,
        proof_required: "Photo + invoice",
        consequence: "Water damage compounds quietly for months.",
      },
      {
        title: "Lease renewal decision",
        category: "home", provider: "Selam Properties", inDays: 120,
        recurrence: { unit: "year", interval: 1 }, amount: 750, autonomy: "prepare",
        agent_id: "ag_ledger", severity: 4,
        proof_required: "Signed lease or notice",
        consequence: "Miss the notice window and the lease rolls over on their terms.",
      },
    ],
  },
  {
    id: "family",
    name: "Family rhythm",
    tagline: "The deadlines you cannot rebook.",
    detail: "School terms, milestones and the small rituals that keep people close.",
    icon: "heart",
    tone: "coral",
    items: [
      {
        title: "School fees — term 2",
        category: "people", provider: "ICS Addis Ababa", inDays: 30,
        recurrence: { unit: "quarter", interval: 1 }, amount: 850, autonomy: "approve",
        agent_id: "ag_kin", severity: 3,
        proof_required: "School receipt",
        consequence: "The one deadline you cannot rebook.",
      },
      {
        title: "Cousin's graduation",
        category: "people", provider: "Family", inDays: 90,
        recurrence: null, autonomy: "prepare",
        agent_id: "ag_kin", severity: 2,
        proof_required: "Gift order or travel booking",
        consequence: "The one deadline you cannot rebook.",
      },
      {
        title: "Weekly family check-in",
        category: "people", provider: "Family", inDays: 2,
        recurrence: { unit: "week", interval: 1 }, autonomy: "notify",
        agent_id: "ag_kin", severity: 3,
        proof_required: "A note from the call",
        consequence: "The one deadline you cannot rebook.",
      },
    ],
  },
  {
    id: "subscriptions",
    name: "Subscription audit",
    tagline: "Stop paying for the same thing twice.",
    detail: "A quarterly sweep of the tools, storage and software that renew without asking.",
    icon: "card",
    tone: "lime",
    items: [
      {
        title: "Adobe Creative Cloud renewal",
        category: "work", provider: "Adobe", inDays: 12,
        recurrence: { unit: "year", interval: 1 }, amount: 360, autonomy: "autopilot",
        agent_id: "ag_trim", severity: 2,
        proof_required: "Renewal receipt",
        consequence: "The team loses its design tools mid-project.",
      },
      {
        title: "GitHub organization renewal",
        category: "work", provider: "GitHub", inDays: 20,
        recurrence: { unit: "month", interval: 1 }, amount: 84, autonomy: "autopilot",
        agent_id: "ag_stack", severity: 3,
        proof_required: "Invoice",
        consequence: "CI and private repositories stop building.",
      },
      {
        title: "Notion workspace renewal",
        category: "work", provider: "Notion", inDays: 35,
        recurrence: { unit: "year", interval: 1 }, amount: 192, autonomy: "autopilot",
        agent_id: "ag_stack", severity: 2,
        proof_required: "Invoice",
        consequence: "Docs and wikis go read-only.",
      },
      {
        title: "Quarterly subscription audit",
        category: "finance", provider: "All providers", inDays: 30,
        recurrence: { unit: "month", interval: 3 }, autonomy: "autopilot",
        agent_id: "ag_trim", severity: 2,
        proof_required: "Cancellation confirmations",
        consequence: "Duplicate subscriptions quietly drain the account.",
      },
    ],
  },
];

export function TemplatesModal() {
  const { state, overlays, setOverlays, actions, nowMs } = useApp();
  const [selected, setSelected] = useState<string[]>(["compliance"]);
  if (!state || !overlays.templates) return null;

  const close = () => setOverlays((o) => ({ ...o, templates: false }));
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const tracked = new Set(
    state.obligations.map((o) => o.title.toLowerCase().replace(/\s*[—–].*$/, "").trim())
  );
  const items = PACKS.filter((p) => selected.includes(p.id)).flatMap((p) =>
    p.items.filter((item) => !tracked.has(item.title.toLowerCase().trim())).map((item) => ({
      ...item,
      id: `draft_${p.id}_${item.title}`.replace(/\s+/g, "_"),
      due_at: new Date(nowMs + item.inDays * DAY).toISOString(),
      currency: "USD",
      source: "template",
      channel: "template",
      owner: "Solomon Tigabu",
      owner_kind: item.agent_id ? "agent" : "human",
      backup: "Hanna Bekele",
      confidence: 0.92,
      grace_days: 0,
      notes: `Added from the ${p.name} pack.`,
      checklist: ["Review the details", "Assign the owner", "File proof when done"],
    }))
  );
  const chosenCount = PACKS.filter((p) => selected.includes(p.id)).reduce((n, p) => n + p.items.length, 0);

  const add = async () => {
    if (!items.length) return;
    const res = await actions.addObligations(items);
    if (res) close();
  };

  return (
    <Modal
      title="Start from a pack"
      eyebrow="Templates · duplicate a year of work"
      onClose={close}
      width={780}
      footer={
        <>
          <span className="template-foot-note">
            {items.length} new of {chosenCount} · already-tracked items are skipped
          </span>
          <button className="btn btn-ghost" onClick={close}>Cancel</button>
          <button className="btn btn-ink" onClick={add} disabled={!items.length}>
            <Icon name="plus" size={15} /> Add {items.length || ""}
          </button>
        </>
      }
    >
      <div className="template-grid">
        {PACKS.map((pack) => {
          const on = selected.includes(pack.id);
          return (
            <button
              key={pack.id}
              className={`template-card ${on ? "on" : ""}`}
              onClick={() => toggle(pack.id)}
              aria-pressed={on}
            >
              <span className={`template-icon tone-${pack.tone}`}><Icon name={pack.icon} size={17} /></span>
              <span className="template-copy">
                <strong>{pack.name}</strong>
                <em>{pack.tagline}</em>
                <span className="template-meta">{pack.items.length} obligations · {pack.detail}</span>
              </span>
              <span className="template-check">{on && <Icon name="check" size={12} />}</span>
            </button>
          );
        })}
      </div>

      <div className="template-preview">
        <div className="template-preview-head">
          <span className="eyebrow">Preview</span>
          <span>{items.length} scheduled</span>
        </div>
        {items.length === 0 && <p className="template-empty">{chosenCount ? "Everything in these packs is already on the register." : "Choose a pack to see what lands in the register."}</p>}
        {items.map((item) => (
          <div className="template-row" key={item.id}>
            <CategoryTile category={item.category} size={28} />
            <div className="template-row-main">
              <strong>{item.title}</strong>
              <em>{item.provider} · {CATEGORIES[item.category]?.label || item.category}</em>
            </div>
            <span className="template-row-due">{dueLabel(item.due_at, nowMs)}</span>
            <span className="template-row-cost">{money(item.amount || 0)}</span>
            <span className="template-row-auto">{item.autonomy === "autopilot" ? "Auto" : item.autonomy}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
