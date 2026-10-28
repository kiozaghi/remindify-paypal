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
  lens: "life" | "money";
  curator: string;
  uses: number;
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
    lens: "money",
    curator: "@ledger.collective",
    uses: 3102,
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
    lens: "money",
    curator: "@homeguard",
    uses: 1540,
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
    lens: "life",
    curator: "@hanna.b",
    uses: 2310,
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
    icon: "repeat",
    tone: "lime",
    lens: "money",
    curator: "@trim.club",
    uses: 2888,
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
  {
    id: "love",
    name: "Love & connection",
    tagline: "The people you keep meaning to call.",
    detail: "Anniversaries, date nights and the small rituals that keep a relationship from becoming logistics.",
    icon: "heart",
    tone: "coral",
    lens: "life",
    curator: "@mira.builds",
    uses: 1284,
    items: [
      {
        title: "Anniversary dinner", category: "people", provider: "Us", inDays: 18,
        recurrence: { unit: "year", interval: 1 }, autonomy: "prepare",
        agent_id: "ag_kin", severity: 2,
        proof_required: "Booking or a photo",
        consequence: "The one date you cannot reschedule.",
      },
      {
        title: "Monthly date night", category: "people", provider: "Us", inDays: 9,
        recurrence: { unit: "month", interval: 1 }, autonomy: "notify",
        agent_id: "ag_kin", severity: 2,
        proof_required: "A note or a photo",
        consequence: "The relationship gets the leftover hours.",
      },
      {
        title: "Dad’s birthday call", category: "people", provider: "Family", inDays: 4,
        recurrence: { unit: "year", interval: 1 }, autonomy: "notify",
        agent_id: "ag_kin", severity: 3,
        proof_required: "A note from the call",
        consequence: "A missed call is remembered longer than a late gift.",
      },
      {
        title: "Gift for Mum", category: "people", provider: "Family", inDays: 6,
        recurrence: { unit: "year", interval: 1 }, autonomy: "prepare",
        agent_id: "ag_kin", severity: 3,
        proof_required: "Order confirmation",
        consequence: "The day arrives whether the gift does or not.",
      },
    ],
  },
  {
    id: "holidays",
    name: "Holidays & travel",
    tagline: "Passports before flights. Gifts before landing.",
    detail: "The travel year: documents, cover, bookings and the people and pets you leave behind.",
    icon: "globe",
    tone: "lime",
    lens: "life",
    curator: "@thekinco",
    uses: 976,
    items: [
      {
        title: "Passport expiry check", category: "identity", provider: "Passport office", inDays: 60,
        recurrence: { unit: "year", interval: 1 }, autonomy: "prepare",
        agent_id: "ag_compliance", severity: 4,
        proof_required: "Passport expiry date",
        consequence: "A valid passport is the first thing a trip needs.",
      },
      {
        title: "Travel insurance", category: "finance", provider: "Awash Insurance", inDays: 21,
        recurrence: { unit: "year", interval: 1 }, amount: 140, autonomy: "approve",
        agent_id: "ag_ledger", severity: 4,
        proof_required: "Policy certificate",
        consequence: "One hospital abroad without cover resets the year.",
      },
      {
        title: "December trip flights", category: "other", provider: "Ethiopian Airlines", inDays: 14,
        recurrence: null, amount: 620, autonomy: "approve",
        agent_id: "ag_kin", severity: 3,
        proof_required: "Booking confirmation",
        consequence: "Prices climb while the plan stays a maybe.",
      },
      {
        title: "Pet sitter while away", category: "home", provider: "Community", inDays: 30,
        recurrence: null, autonomy: "prepare",
        agent_id: "ag_kin", severity: 3,
        proof_required: "Booking confirmation",
        consequence: "The trip is booked before the care is.",
      },
    ],
  },
  {
    id: "care",
    name: "Caregiving",
    tagline: "Medication, appointments, the check-in.",
    detail: "A calm plan for looking after someone else without dropping your own life.",
    icon: "pill",
    tone: "teal",
    lens: "life",
    curator: "@nurse.ada",
    uses: 864,
    items: [
      {
        title: "Prescription refill", category: "health", provider: "Kenema Pharmacy", inDays: 5,
        recurrence: { unit: "month", interval: 1 }, amount: 45, autonomy: "approve",
        agent_id: "ag_kin", severity: 5,
        proof_required: "Pharmacy receipt",
        consequence: "A missed refill is a health event, not an inconvenience.",
      },
      {
        title: "Specialist appointment", category: "health", provider: "Bethany Clinic", inDays: 27,
        recurrence: { unit: "quarter", interval: 1 }, autonomy: "prepare",
        agent_id: "ag_kin", severity: 4,
        proof_required: "Appointment confirmation",
        consequence: "The next slot is months away.",
      },
      {
        title: "Monthly check-in with Aunt Selam", category: "people", provider: "Family", inDays: 3,
        recurrence: { unit: "month", interval: 1 }, autonomy: "notify",
        agent_id: "ag_kin", severity: 2,
        proof_required: "A note from the call",
        consequence: "Company is part of the care plan.",
      },
      {
        title: "Emergency contacts review", category: "health", provider: "Family", inDays: 90,
        recurrence: { unit: "year", interval: 1 }, autonomy: "prepare",
        agent_id: "ag_kin", severity: 3,
        proof_required: "Updated contact sheet",
        consequence: "Old numbers fail at the worst moment.",
      },
    ],
  },
  {
    id: "tax",
    name: "Tax & filings",
    tagline: "The deadlines with penalties attached.",
    detail: "Personal and company filings, contributions and the receipts that prove you did it.",
    icon: "scale",
    tone: "violet",
    lens: "money",
    curator: "@ledger.collective",
    uses: 3102,
    items: [
      {
        title: "Personal tax return", category: "finance", provider: "Ministry of Revenue", inDays: 45,
        recurrence: { unit: "year", interval: 1 }, amount: 320, autonomy: "approve",
        agent_id: "ag_ledger", severity: 5,
        proof_required: "Filed return + receipt",
        consequence: "Late filing triggers penalties that grow monthly.",
      },
      {
        title: "Quarterly VAT filing", category: "finance", provider: "Ministry of Revenue", inDays: 25,
        recurrence: { unit: "quarter", interval: 1 }, autonomy: "approve",
        agent_id: "ag_ledger", severity: 5,
        proof_required: "Filed return + receipt",
        consequence: "One missed quarter becomes an audit trail.",
      },
      {
        title: "Pension contribution", category: "finance", provider: "Pension fund", inDays: 30,
        recurrence: { unit: "month", interval: 1 }, amount: 250, autonomy: "autopilot",
        agent_id: "ag_ledger", severity: 3,
        proof_required: "Contribution statement",
        consequence: "The gap compounds quietly for decades.",
      },
      {
        title: "Receipts archive", category: "finance", provider: "Your records", inDays: 75,
        recurrence: { unit: "quarter", interval: 1 }, autonomy: "prepare",
        agent_id: "ag_ledger", severity: 2,
        proof_required: "Archive index",
        consequence: "Filing without receipts is a guess with a deadline.",
      },
    ],
  },
  {
    id: "moving",
    name: "Moving country",
    tagline: "Visa, address, utilities, school transfer.",
    detail: "A relocation is a hundred small deadlines wearing one suitcase. Start with the ones that block the rest.",
    icon: "globe",
    tone: "blue",
    lens: "money",
    curator: "@relocate.works",
    uses: 512,
    items: [
      {
        title: "Visa renewal", category: "identity", provider: "Immigration office", inDays: 50,
        recurrence: { unit: "year", interval: 1 }, autonomy: "approve",
        agent_id: "ag_compliance", severity: 5,
        proof_required: "Stamped approval",
        consequence: "Everything else waits on this document.",
      },
      {
        title: "Lease notice", category: "home", provider: "Landlord", inDays: 40,
        recurrence: null, autonomy: "approve",
        agent_id: "ag_ledger", severity: 4,
        proof_required: "Signed notice",
        consequence: "Miss the window and you pay for another term.",
      },
      {
        title: "Utilities transfer", category: "home", provider: "Providers", inDays: 10,
        recurrence: null, autonomy: "prepare",
        agent_id: "ag_mileage", severity: 3,
        proof_required: "Confirmation per provider",
        consequence: "The new place is dark before the paperwork is done.",
      },
      {
        title: "School transfer", category: "people", provider: "New school", inDays: 35,
        recurrence: null, autonomy: "prepare",
        agent_id: "ag_kin", severity: 4,
        proof_required: "School confirmation",
        consequence: "Term starts whether the place is confirmed or not.",
      },
    ],
  },
];

export function TemplatesModal() {
  const { state, overlays, setOverlays, actions, nowMs } = useApp();
  const [selected, setSelected] = useState<string[]>(["compliance"]);
  const [lens, setLens] = useState<"all" | "life" | "money">("all");
  if (!state || !overlays.templates) return null;

  const close = () => setOverlays((o) => ({ ...o, templates: false }));
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const visiblePacks = PACKS.filter((pack) => lens === "all" || pack.lens === lens);

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
      eyebrow="Community templates · someone already mapped the year"
      onClose={close}
      width={800}
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
      <div className="template-toolbar">
        <div className="template-lens">
          {(["all", "life", "money"] as const).map((value) => (
            <button
              key={value}
              className={lens === value ? "on" : ""}
              onClick={() => setLens(value)}
            >
              {value === "all" ? `All ${PACKS.length}` : value === "life" ? "People & life" : "Money & admin"}
            </button>
          ))}
        </div>
        <span className="template-selected">{selected.length} selected</span>
      </div>
      <div className="template-grid">
        {visiblePacks.map((pack) => {
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
                <span className="template-meta">
                  {pack.items.length} obligations · {pack.uses.toLocaleString("en-US")} imports · {pack.curator}
                </span>
                <span className="template-detail">{pack.detail}</span>
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
