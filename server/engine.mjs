import { loadAll, put, getMeta, setMeta, remove } from "./db.mjs";

const DAY = 86400000;
const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

export function virtualNow() {
  const offset = getMeta("clock_offset_days", 0) || 0;
  return Date.now() + offset * DAY;
}

export function daysUntil(due, now = virtualNow()) {
  return (new Date(due).getTime() - now) / DAY;
}

const AUTONOMY_FACTOR = { notify: 1.1, prepare: 0.95, approve: 0.8, autopilot: 0.55 };

function urgency(days) {
  if (days < 0) return 2.4 + Math.min(1, -days / 30);
  if (days <= 1) return 2.2;
  if (days <= 3) return 1.9;
  if (days <= 7) return 1.55;
  if (days <= 14) return 1.25;
  if (days <= 30) return 1;
  if (days <= 60) return 0.8;
  return 0.62;
}

export function riskFor(ob, now = virtualNow()) {
  const days = daysUntil(ob.due_at, now);
  const severity = Math.min(5, Math.max(1, ob.severity || 3));
  const confidence = Math.min(1, Math.max(0.4, ob.confidence ?? 0.85));
  const factor = AUTONOMY_FACTOR[ob.autonomy] ?? 1;
  const raw = severity * 15 * urgency(days) * factor * (0.85 + (1 - confidence) * 0.45);
  const score = Math.max(2, Math.min(97, Math.round(raw)));
  const band = score >= 75 ? "critical" : score >= 50 ? "high" : score >= 28 ? "guarded" : "low";
  return {
    score,
    band,
    days: Math.round(days * 10) / 10,
    urgency: Math.round(urgency(days) * 100) / 100,
  };
}

export function enrichObligation(ob, now) {
  const risk = riskFor(ob, now);
  return { ...ob, risk, due_label: new Date(ob.due_at).toISOString() };
}

export function buildState() {
  const data = loadAll();
  const now = virtualNow();
  const obligations = data.obligations.map((ob) => enrichObligation(ob, now));
  const byId = Object.fromEntries(obligations.map((o) => [o.id, o]));
  const agentsById = Object.fromEntries(data.agents.map((a) => [a.id, a]));

  const approvals = data.approvals.map((a) => ({
    ...a,
    obligation: byId[a.obligation_id] || null,
    agent: agentsById[a.agent_id] || null,
  }));
  const runs = data.runs.map((r) => ({
    ...r,
    obligation: byId[r.obligation_id] || null,
    agent: agentsById[r.agent_id] || null,
  }));

  const active = obligations.filter((o) => o.status === "active" || o.status === "waiting");
  const dueThisWeek = active.filter((o) => o.risk.days <= 7);
  const critical = active.filter((o) => o.risk.band === "critical");
  const high = active.filter((o) => o.risk.band === "high");
  const pending = approvals.filter((a) => a.status === "pending");
  const exposure = active
    .filter((o) => o.risk.days <= 14 && (o.risk.band === "high" || o.risk.band === "critical"))
    .reduce((sum, o) => sum + (o.penalty || 0), 0);
  const withBackup = active.filter((o) => o.backup).length;
  const avgRisk = active.length ? active.reduce((s, o) => s + o.risk.score, 0) / active.length : 0;
  const coverage = Math.max(
    4,
    Math.min(99, Math.round(100 - avgRisk * 0.62 + (withBackup / Math.max(1, active.length)) * 6))
  );

  const savedYear = Math.round(
    data.runs.filter((r) => r.status === "done").length * 0.35 + 1842
  );

  const stats = {
    active: active.length,
    due_week: dueThisWeek.length,
    critical: critical.length,
    high: high.length,
    pending_approvals: pending.length,
    exposure,
    coverage,
    delegated: active.filter((o) => o.owner_kind === "agent").length,
    with_backup: withBackup,
    saved_year: savedYear,
    agent_runs_30d: data.agents.reduce((s, a) => s + (a.runs_30d || 0), 0),
    hours_saved: Math.round(data.agents.reduce((s, a) => s + (a.hours_saved || 0), 0)),
    streak_weeks: getMeta("streak_weeks", 14),
  };

  return {
    now: new Date(now).toISOString(),
    clock_offset_days: getMeta("clock_offset_days", 0) || 0,
    live: getMeta("live", true),
    workspace: getMeta("workspace", "Exopya Studio"),
    user: getMeta("user", "Solomon Tigabu"),
    plan: getMeta("plan", "Studio"),
    obligations,
    agents: data.agents,
    approvals,
    runs,
    providers: data.providers,
    events: data.events.slice(0, 60),
    keys: data.keys,
    stats,
    api_calls: getMeta("api_calls", 0),
  };
}

export function logEvent(event) {
  const item = {
    id: uid("ev"),
    actor_type: "system",
    actor_id: null,
    actor: "Remindify",
    kind: "system",
    created_at: new Date().toISOString(),
    ...event,
  };
  put("events", item);
  return item;
}

export function logRun(run) {
  const item = {
    id: uid("run"),
    status: "done",
    proof: null,
    duration_ms: 1800,
    cost: 0,
    created_at: new Date().toISOString(),
    ...run,
  };
  put("runs", item);
  return item;
}

const NEXT = { day: 1, week: 7, month: 30, quarter: 91, year: 365 };

export function advanceDue(dueAt, recurrence, now = Date.now()) {
  if (!recurrence) return null;
  const step = (NEXT[recurrence.unit] || 30) * (recurrence.interval || 1);
  let next = new Date(dueAt).getTime();
  let guard = 0;
  do {
    next += step * DAY;
    guard += 1;
  } while (next < now + DAY && guard < 400);
  return new Date(next).toISOString();
}

export function completeObligation(id, { proof, note, by = "Solomon Tigabu", auto = false } = {}) {
  const data = loadAll();
  const ob = data.obligations.find((o) => o.id === id);
  if (!ob) return { ok: false, error: "Obligation not found" };
  const now = virtualNow();
  const wasDue = ob.due_at;

  if (ob.recurrence) {
    ob.due_at = advanceDue(ob.due_at, ob.recurrence, now);
    ob.last_completed_at = new Date(now).toISOString();
    ob.completions = (ob.completions || 0) + 1;
    ob.status = "active";
    ob.last_proof = proof || (auto ? "Verified automatically" : "Marked complete");
    if (note) ob.last_note = note;
    put("obligations", ob);
    logEvent({
      actor_type: auto ? "agent" : "human",
      actor_id: auto ? ob.agent_id : null,
      actor: by,
      verb: "completed and rescheduled",
      object: ob.title,
      detail: `${proof || "No proof attached"} · next due ${new Date(ob.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      kind: "proof",
    });
    return { ok: true, obligation: enrichObligation(ob, now), next_due: ob.due_at };
  }

  ob.status = "done";
  ob.completed_at = new Date(now).toISOString();
  ob.last_proof = proof || "Marked complete";
  if (note) ob.last_note = note;
  put("obligations", ob);
  logEvent({
    actor_type: auto ? "agent" : "human",
    actor_id: null,
    actor: by,
    verb: "closed",
    object: ob.title,
    detail: proof || "Completed",
    kind: "proof",
  });
  return { ok: true, obligation: enrichObligation(ob, now), archived: true, was_due: wasDue };
}

export function autonomyRank(a) {
  return { notify: 0, prepare: 1, approve: 2, autopilot: 3 }[a] ?? 0;
}

function proposalFor(ob, agent) {
  const money = ob.amount ? `$${ob.amount.toLocaleString("en-US")}` : "no cost";
  const templates = {
    finance: `Pay ${money} to ${ob.provider} using the verified account, then archive the receipt.`,
    work: `Submit the prepared ${ob.title.toLowerCase()} packet to ${ob.provider}, pay any fees and file the confirmation.`,
    home: `Confirm the held slot with ${ob.provider} and pay ${money} on completion.`,
    health: `Book the earliest available slot, confirm by phone and add it to the calendar.`,
    people: `Order the shortlisted gift and schedule delivery before the day.`,
    identity: `Book the appointment, upload the new photos and pay the ${money} fee.`,
    other: `Complete the task with ${ob.provider} and file proof.`,
  };
  return templates[ob.category] || templates.other;
}

export function sweep({ actor = "Remy", silent = false } = {}) {
  const data = loadAll();
  const now = virtualNow();
  const pendingIds = new Set(
    data.approvals.filter((a) => a.status === "pending").map((a) => a.obligation_id)
  );
  let proposed = 0;
  let executed = 0;
  let drafted = 0;

  const candidates = data.obligations
    .filter((o) => o.status === "active" && o.agent_id)
    .map((o) => ({ o, risk: riskFor(o, now) }))
    .filter(({ o, risk }) => risk.days <= 10 && risk.days > -45)
    .sort((a, b) => b.risk.score - a.risk.score);

  for (const { o, risk } of candidates) {
    const agent = data.agents.find((a) => a.id === o.agent_id);
    if (!agent) continue;
    const recent = data.runs.find(
      (r) =>
        r.obligation_id === o.id &&
        new Date(r.created_at).getTime() > now - 6 * 3600000 &&
        r.status !== "failed"
    );
    if (recent) continue;

    if (o.autonomy === "autopilot") {
      logRun({
        agent_id: agent.id,
        obligation_id: o.id,
        action: `Executed ${o.autonomy === "autopilot" ? "on autopilot" : "step"}`,
        detail: `${proposalFor(o, agent)} Done without a human in the loop.`,
        status: "done",
        proof: `auto_${o.id}_receipt.pdf`,
        duration_ms: 3200,
      });
      logEvent({
        actor_type: "agent",
        actor_id: agent.id,
        actor: agent.name,
        verb: "executed on autopilot",
        object: o.title,
        detail: `Risk ${risk.score} · ${risk.days <= 0 ? "due now" : `due in ${Math.ceil(risk.days)}d`}`,
        kind: "automation",
      });
      completeObligation(o.id, {
        proof: `auto_${o.id}_receipt.pdf`,
        note: "Autopilot within mandate",
        by: agent.name,
        auto: true,
      });
      executed += 1;
    } else if (o.autonomy === "approve" && !pendingIds.has(o.id)) {
      const approval = {
        id: uid("ap"),
        obligation_id: o.id,
        agent_id: agent.id,
        title: `${o.title} — ready for your call`,
        summary: proposalFor(o, agent),
        proposed_action: `${o.category}.execute`,
        cost: o.amount || 0,
        evidence: [
          { label: "Risk assessment", detail: `${risk.band} · score ${risk.score} · ${Math.ceil(risk.days)} days out` },
          { label: "Prepared payload", detail: `${o.provider} · verified details` },
        ],
        risk: o.consequence || "Missed deadline.",
        status: "pending",
        created_at: new Date().toISOString(),
      };
      put("approvals", approval);
      pendingIds.add(o.id);
      logRun({
        agent_id: agent.id,
        obligation_id: o.id,
        action: "Prepared an action",
        detail: proposalFor(o, agent),
        status: "proposed",
        duration_ms: 2600,
      });
      logEvent({
        actor_type: "agent",
        actor_id: agent.id,
        actor: agent.name,
        verb: "requested approval",
        object: o.title,
        detail: `${o.amount ? `$${o.amount} · ` : ""}risk ${risk.score}`,
        kind: "approval",
      });
      proposed += 1;
    } else if (o.autonomy === "prepare") {
      logRun({
        agent_id: agent.id,
        obligation_id: o.id,
        action: "Drafted the execution plan",
        detail: proposalFor(o, agent),
        status: "drafted",
        duration_ms: 2100,
      });
      logEvent({
        actor_type: "agent",
        actor_id: agent.id,
        actor: agent.name,
        verb: "prepared a plan",
        object: o.title,
        detail: "Waiting on you to start",
        kind: "draft",
      });
      drafted += 1;
    }
  }

  if (!silent) {
    logEvent({
      actor_type: actor === "Remy" ? "system" : "human",
      actor_id: null,
      actor,
      verb: "swept the portfolio",
      object: "All agents",
      detail: `${proposed} approvals · ${executed} executed · ${drafted} plans`,
      kind: "system",
    });
  }
  return { proposed, executed, drafted, scanned: candidates.length };
}

export function applyApproval(id, decision, note = "") {
  const data = loadAll();
  const approval = data.approvals.find((a) => a.id === id);
  if (!approval) return { ok: false, error: "Approval not found" };
  const ob = data.obligations.find((o) => o.id === approval.obligation_id);
  const agent = data.agents.find((a) => a.id === approval.agent_id);
  approval.status = decision === "approve" ? "approved" : "denied";
  approval.decided_at = new Date().toISOString();
  approval.decision_note = note;
  put("approvals", approval);

  if (decision === "approve") {
    logRun({
      agent_id: approval.agent_id,
      obligation_id: approval.obligation_id,
      action: "Executed the approved action",
      detail: `${approval.title} · approved by Solomon. ${approval.proposed_action} carried out.`,
      status: "done",
      proof: `${approval.proposed_action.replace(".", "_")}_confirmation.pdf`,
      duration_ms: 4200,
      cost: approval.cost ? 0 : 0,
    });
    if (ob) {
      ob.last_approved_at = new Date().toISOString();
      put("obligations", ob);
      completeObligation(ob.id, {
        proof: `${approval.proposed_action.replace(".", "_")}_confirmation.pdf`,
        note: "Approved by Solomon · executed by agent",
        by: agent?.name || "Agent",
        auto: true,
      });
    }
  } else {
    logEvent({
      actor_type: "human",
      actor_id: null,
      actor: "Solomon Tigabu",
      verb: "declined a proposed action",
      object: ob?.title || approval.title,
      detail: note || "No reason given",
      kind: "approval",
    });
  }
  return { ok: true, approval };
}

export function snoozeObligation(id, days = 3) {
  const data = loadAll();
  const ob = data.obligations.find((o) => o.id === id);
  if (!ob) return { ok: false, error: "Not found" };
  ob.due_at = new Date(new Date(ob.due_at).getTime() + days * DAY).toISOString();
  ob.snoozed_days = (ob.snoozed_days || 0) + days;
  put("obligations", ob);
  logEvent({
    actor_type: "human",
    actor_id: null,
    actor: "Solomon Tigabu",
    verb: "snoozed",
    object: ob.title,
    detail: `${days} days · risk recalculated`,
    kind: "human",
  });
  return { ok: true };
}

export function runObligation(id) {
  const data = loadAll();
  const ob = data.obligations.find((o) => o.id === id);
  if (!ob) return { ok: false, error: "Not found" };
  const agent = data.agents.find((a) => a.id === ob.agent_id);
  if (!agent) return { ok: false, error: "No agent assigned" };
  const risk = riskFor(ob);
  if (ob.autonomy === "autopilot") {
    logRun({
      agent_id: agent.id,
      obligation_id: ob.id,
      action: "Ran the obligation on autopilot",
      detail: proposalFor(ob, agent),
      status: "done",
      proof: `run_${ob.id}_confirmation.pdf`,
      duration_ms: 3600,
    });
    logEvent({
      actor_type: "agent",
      actor_id: agent.id,
      actor: agent.name,
      verb: "ran it end-to-end",
      object: ob.title,
      detail: `Manual run · risk ${risk.score}`,
      kind: "automation",
    });
    completeObligation(ob.id, {
      proof: `run_${ob.id}_confirmation.pdf`,
      note: "Manual run · autopilot",
      by: agent.name,
      auto: true,
    });
    return { ok: true, message: `${agent.name} completed it on autopilot and filed proof.` };
  }

  if (ob.autonomy === "approve") {
    const pending = data.approvals.find((a) => a.obligation_id === ob.id && a.status === "pending");
    if (pending) return { ok: true, message: `${agent.name} already has a decision waiting for you.` };
    const approval = {
      id: uid("ap"),
      obligation_id: ob.id,
      agent_id: agent.id,
      title: `${ob.title} — ready for your call`,
      summary: proposalFor(ob, agent),
      proposed_action: `${ob.category}.execute`,
      cost: ob.amount || 0,
      evidence: [
        { label: "Risk assessment", detail: `${risk.band} · score ${risk.score} · ${Math.ceil(risk.days)} days out` },
        { label: "Prepared payload", detail: `${ob.provider} · verified details` },
      ],
      risk: ob.consequence || "Missed deadline.",
      status: "pending",
      created_at: new Date().toISOString(),
    };
    put("approvals", approval);
    logRun({
      agent_id: agent.id,
      obligation_id: ob.id,
      action: "Prepared an action",
      detail: proposalFor(ob, agent),
      status: "proposed",
      duration_ms: 2600,
    });
    logEvent({
      actor_type: "agent",
      actor_id: agent.id,
      actor: agent.name,
      verb: "requested approval",
      object: ob.title,
      detail: `Manual run · risk ${risk.score}`,
      kind: "approval",
    });
    return { ok: true, message: `${agent.name} prepared it and is waiting for your approval.` };
  }

  logRun({
    agent_id: agent.id,
    obligation_id: ob.id,
    action: "Prepared a plan",
    detail: proposalFor(ob, agent),
    status: "drafted",
    duration_ms: 1800,
  });
  return { ok: true, message: `${agent.name} prepared a plan. You are still in control.` };
}

export function advanceClock(days) {
  const current = getMeta("clock_offset_days", 0) || 0;
  setMeta("clock_offset_days", current + Number(days || 0));
  logEvent({
    actor_type: "system",
    actor: "Time machine",
    verb: "advanced the clock",
    object: `${days} days`,
    detail: "Risk re-scored across the portfolio",
    kind: "system",
  });
  return { ok: true, clock_offset_days: current + Number(days || 0) };
}

export function deleteObligation(id) {
  remove("obligations", id);
  return { ok: true };
}

export { uid, DAY };
