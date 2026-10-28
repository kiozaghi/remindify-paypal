// Daily digest.
//
// The scheduler sweep also emails each verified account a once-a-day summary of
// what needs a human: obligations due in the next week and approvals waiting on
// a decision. Dedupe is a workspace meta key holding the UTC day, so replaying
// the cron call (or running two schedulers) still sends at most one digest.

import { loadAll, getMeta, setMeta, verifiedEmails } from "./db.mjs";
import { emailConfigured, sendEmail } from "./email.mjs";
import { daysUntil, riskFor, virtualNow } from "./engine.mjs";

const DEFAULT_ORIGIN = "https://remindify-xi.vercel.app";
const HORIZON_DAYS = 7;
const MAX_RECIPIENTS = 10;
const MAX_LINES = 15;
const SENT_KEY = "digest_sent_for";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function appOrigin() {
  return (process.env.PUBLIC_ORIGIN || DEFAULT_ORIGIN).replace(/\/+$/, "");
}

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "there";
}

function shortDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown date";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function dueLabel(days) {
  if (days < 0) {
    const late = Math.ceil(-days);
    return `overdue by ${late} ${late === 1 ? "day" : "days"}`;
  }
  const whole = Math.ceil(days);
  if (whole <= 0) return "due today";
  return `due in ${whole} ${whole === 1 ? "day" : "days"}`;
}

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

function summaryLine(dueCount, approvalCount) {
  const parts = [];
  if (dueCount) {
    parts.push(`${plural(dueCount, "obligation is", "obligations are")} due in the next ${HORIZON_DAYS} days`);
  }
  if (approvalCount) {
    parts.push(`${plural(approvalCount, "approval is", "approvals are")} waiting on you`);
  }
  return `${parts.join(" and ")}.`;
}

function bulletLines(items) {
  const shown = items.slice(0, MAX_LINES);
  const lines = shown.map((line) => `- ${line}`);
  if (items.length > shown.length) lines.push(`- …and ${items.length - shown.length} more in the register`);
  return lines;
}

function composeSubject(dueCount, approvalCount) {
  const parts = ["Remindify daily"];
  if (dueCount) parts.push(`${dueCount} due`);
  if (approvalCount) parts.push(`${approvalCount} waiting`);
  return parts.join(" · ");
}

function composeText({ name, due, approvals, origin, to }) {
  const lines = [`Hi ${firstName(name)},`, "", summaryLine(due.length, approvals.length)];

  if (due.length) {
    lines.push("", "This week");
    lines.push(...bulletLines(due.map((line) => line.label)));
  }

  if (approvals.length) {
    lines.push("", "Waiting on you");
    lines.push(...bulletLines(approvals.map((line) => line.label)));
  }

  lines.push("", `Open the register: ${origin}/today`, "");
  lines.push(`You're getting this because you confirmed ${to} with Remindify.`);
  return lines.join("\n");
}

export async function sendDailyDigest({ now = Date.now() } = {}) {
  if (!emailConfigured()) return { sent: 0, failed: 0, skipped: "email_not_configured" };

  const day = new Date(now).toISOString().slice(0, 10);
  if (getMeta(SENT_KEY, "") === day) return { sent: 0, failed: 0, skipped: "already_sent" };

  const recipients = verifiedEmails().slice(0, MAX_RECIPIENTS);
  if (!recipients.length) return { sent: 0, failed: 0, skipped: "no_verified_recipients" };

  const clock = virtualNow();
  const data = loadAll();
  const obligationsById = new Map(data.obligations.map((ob) => [ob.id, ob]));

  const due = data.obligations
    .filter((ob) => (ob.status === "active" || ob.status === "waiting") && daysUntil(ob.due_at, clock) <= HORIZON_DAYS)
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
    .map((ob) => {
      const days = daysUntil(ob.due_at, clock);
      const risk = riskFor(ob, clock);
      return { label: `${ob.title} — ${dueLabel(days)} (${shortDate(ob.due_at)}) · ${risk.band} risk` };
    });

  const approvals = data.approvals
    .filter((approval) => approval.status === "pending")
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((approval) => {
      const title = approval.title || obligationsById.get(approval.obligation_id)?.title || "Approval requested";
      const cost = approval.cost ? ` · $${Number(approval.cost).toLocaleString("en-US")}` : "";
      return { label: `${title}${cost}` };
    });

  if (!due.length && !approvals.length) return { sent: 0, failed: 0, skipped: "nothing_due" };

  const origin = appOrigin();
  const subject = composeSubject(due.length, approvals.length);
  const results = await Promise.allSettled(recipients.map((person) => sendEmail({
    to: person.email,
    subject,
    text: composeText({ name: person.name, due, approvals, origin, to: person.email }),
  })));

  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - sent;
  if (sent > 0) setMeta(SENT_KEY, day);
  return { sent, failed, skipped: sent > 0 ? null : "send_failed" };
}
