// Capture parser. Two engines, same output shape:
//   - Gemini 2.5 Flash: AI-first extraction when GEMINI_API_KEY is set
//   - deterministic: local rules, used in tests and whenever the model fails
// The caller falls back to parseCapture() whenever parseCaptureAI() returns null.
const DAY = 86400000;
const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

const CATEGORY_RULES = [
  ["people", /birthday|anniversary|wedding|family|mum|mom|grandma|grandpa|dad|graduation|call\b|dinner/i],
  ["health", /dentist|dental|doctor|clinic|prescription|refill|pharmacy|medical|check-?up|vaccin/i],
  ["identity", /passport|visa|permit|residence|biometric|national id|kebele id/i],
  ["finance", /insurance|loan|premium|bank|bill|tax|payment|invoice|mortgage|credit card|fee\b/i],
  ["work", /licen[cs]e|audit|compliance|contract|filing|workspace|domain|ssl|server|backup|payroll|employee|client/i],
  ["home", /service|maintenance|inspection|rent|apartment|lease|filter|generator|car\b|vehicle|odometer|repair/i],
];

const AGENT_BY_CATEGORY = {
  finance: "ag_ledger",
  work: "ag_compliance",
  home: "ag_mileage",
  people: "ag_kin",
  identity: "ag_renew",
  health: "ag_kin",
};

const PROOF_BY_CATEGORY = {
  finance: "Receipt or confirmation",
  work: "Filed confirmation / certificate",
  home: "Invoice + photo",
  people: "Order confirmation",
  identity: "Appointment slip + new document",
  health: "Appointment or pharmacy receipt",
};

const CONSEQUENCE_BY_CATEGORY = {
  finance: "Missed payments compound: fees, credit impact or lapsed cover.",
  work: "A lapsed licence or filing can stop work entirely.",
  home: "Small maintenance issues get expensive when ignored.",
  people: "The one kind of deadline you cannot rebook.",
  identity: "Processing delays can take weeks to recover.",
  health: "Health deadlines are hard to negotiate with.",
};

const TASK_RE = /due|expire|renew|scheduled|inspection|audit|licen[cs]e|passport|visa|refill|birthday|anniversary|service|file|filing|submit|book|order|appointment|check-?up|contract|tax|insurance|pay\b|call\b|collect|confirm|notify|interview|review/i;
const SUB_DEADLINE_RE = /\b(confirm|pay|payment|renew\s+(?:before|by)|notify|submit|file)\b/i;
const SKIP_RE = /^(hi|hello|hey|dear|sincerely|regards|thanks|thank you|from:|to:|date:|sent:|cc:)\b/i;

function toNoonUTC(year, month, day) {
  return new Date(Date.UTC(year, month, day, 10, 0, 0));
}

function nextWeekday(now, weekday) {
  const d = new Date(now);
  const diff = (weekday - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(10, 0, 0, 0);
  return d;
}

const MONTH_NAMES = Object.keys(MONTHS).join("|");

function findDates(text, now) {
  const found = [];
  let m;
  const push = (match, date, confidence, kind) => {
    if (!match || match.index === undefined) return;
    found.push({ index: match.index, date, label: match[0], confidence, kind });
  };
  if ((m = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/))) {
    push(m, toNoonUTC(+m[1], +m[2] - 1, +m[3]), 0.95, "iso");
  }
  if ((m = text.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2})\b/))) {
    const day = +m[1];
    const month = +m[2];
    if (day <= 31 && month <= 12) push(m, toNoonUTC(+m[3], month - 1, day), 0.9, "slash");
  }
  const monthRe = new RegExp(
    `\\b(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?\\b`, "gi"
  );
  while ((m = monthRe.exec(text))) {
    const month = MONTHS[m[1].toLowerCase()];
    let year = m[3] ? +m[3] : new Date(now).getUTCFullYear();
    let date = toNoonUTC(year, month, +m[2]);
    if (!m[3] && date.getTime() < now - 2 * DAY) date = toNoonUTC(year + 1, month, +m[2]);
    push(m, date, m[3] ? 0.92 : 0.82, "month-name");
  }
  const dayRe = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_NAMES})\\.?(?:,?\\s*(20\\d{2}))?\\b`, "gi"
  );
  while ((m = dayRe.exec(text))) {
    const month = MONTHS[m[2].toLowerCase()];
    let year = m[3] ? +m[3] : new Date(now).getUTCFullYear();
    let date = toNoonUTC(year, month, +m[1]);
    if (!m[3] && date.getTime() < now - 2 * DAY) date = toNoonUTC(year + 1, month, +m[1]);
    push(m, date, m[3] ? 0.9 : 0.8, "day-month");
  }
  // "in 3 weeks", "in 2 months"
  if ((m = text.match(/\bin\s+(\d{1,2})\s+(day|week|month|year)s?\b/i))) {
    const n = +m[1];
    const unit = m[2].toLowerCase();
    const date = new Date(now);
    if (unit === "day") date.setUTCDate(date.getUTCDate() + n);
    if (unit === "week") date.setUTCDate(date.getUTCDate() + n * 7);
    if (unit === "month") date.setUTCMonth(date.getUTCMonth() + n);
    if (unit === "year") date.setUTCFullYear(date.getUTCFullYear() + n);
    date.setUTCHours(10, 0, 0, 0);
    push(m, date, 0.88, "relative");
  }
  if ((m = /\btomorrow\b/i.exec(text))) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(10, 0, 0, 0);
    push(m, d, 0.9, "relative");
  }
  if ((m = /\bnext week\b/i.exec(text))) push(m, new Date(now + 7 * DAY), 0.6, "relative");
  if ((m = /\bnext month\b/i.exec(text))) {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() + 1);
    push(m, d, 0.6, "relative");
  }
  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < weekdays.length; i++) {
    if ((m = new RegExp(`\\b(?:next\\s+)?${weekdays[i]}\\b`, "i").exec(text))) {
      push(m, nextWeekday(now, i), 0.5, "weekday");
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

function findDate(text, now) {
  const dates = findDates(text, now);
  const strong = dates.filter((d) => d.confidence >= 0.75);
  return (strong.length ? strong : dates)[0] || null;
}

function nextDayOfMonth(now, day) {
  const d = new Date(now);
  d.setUTCHours(10, 0, 0, 0);
  if (d.getUTCDate() >= day) d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(day);
  return d;
}

function findRecurrence(text) {
  let m;
  if ((m = text.match(/\bevery\s+(\d{1,2})\s+(day|week|month|quarter|year)s?\b/i))) {
    return { unit: m[2].toLowerCase(), interval: +m[1], label: m[0] };
  }
  if ((m = text.match(/\b(?:every|each|per)\s+(day|week|month|quarter|year)\b/i))) {
    return { unit: m[1].toLowerCase(), interval: 1, label: m[0] };
  }
  if ((m = text.match(/\bevery\s+(\d{1,2})\s+months\b/i))) {
    return { unit: "month", interval: +m[1], label: m[0] };
  }
  if (/\b(daily)\b/i.test(text)) return { unit: "day", interval: 1, label: "daily" };
  if (/\b(weekly|bi-?weekly)\b/i.test(text)) return { unit: "week", interval: /bi/i.test(text) ? 2 : 1, label: "weekly" };
  if (/\b(monthly)\b/i.test(text)) return { unit: "month", interval: 1, label: "monthly" };
  if (/\b(quarterly)\b/i.test(text)) return { unit: "quarter", interval: 1, label: "quarterly" };
  if (/\b(annual(?:ly)?|yearly|once a year)\b/i.test(text)) return { unit: "year", interval: 1, label: "annual" };
  if (/\brenews?\s+(?:on|every|each|annual)/i.test(text)) return { unit: "year", interval: 1, label: "renews" };
  if (/\bsubscription\b/i.test(text)) return { unit: "month", interval: 1, label: "subscription" };
  return null;
}

function findAmount(text) {
  let m;
  if ((m = text.match(/(?:USD|\$)\s?([\d,]+(?:\.\d{1,2})?)/i))) {
    return { amount: parseFloat(m[1].replace(/,/g, "")), currency: "USD", label: m[0] };
  }
  if ((m = text.match(/([\d,]+(?:\.\d{1,2})?)\s?(?:USD|US\$)/i))) {
    return { amount: parseFloat(m[1].replace(/,/g, "")), currency: "USD", label: m[0] };
  }
  if ((m = text.match(/(?:ETB|Br\.?|birr)\s?([\d,]+(?:\.\d{1,2})?)/i))) {
    return { amount: Math.round(parseFloat(m[1].replace(/,/g, "")) / 57), currency: "USD", original: "ETB", label: m[0] };
  }
  if ((m = text.match(/([\d,]+(?:\.\d{1,2})?)\s?(?:ETB|birr)/i))) {
    return { amount: Math.round(parseFloat(m[1].replace(/,/g, "")) / 57), currency: "USD", original: "ETB", label: m[0] };
  }
  return null;
}

// A PayPal payee is the address the money can be sent to. Keep it only when
// the surrounding sentence is actually about paying.
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
function findPayeeEmail(text) {
  const mail = text.match(EMAIL_RE);
  if (!mail || mail.index === undefined) return null;
  const around = text.slice(Math.max(0, mail.index - 80), mail.index + mail[0].length + 80);
  if (!/(paypal|invoice|bill|pay\b|payment|remit|settle)/i.test(around)) return null;
  return mail[0].toLowerCase();
}

const KNOWN_PROVIDERS = [
  "Awash Insurance", "Commercial Bank of Ethiopia", "Ministry of Revenue", "Trade Bureau",
  "Zewditu Pharmacy", "Bethel Dental Clinic", "ICS Addis Ababa", "SGS Ethiopia",
  "Cloudflare", "Google", "Netflix", "Spotify", "iCloud", "Apple", "Ethiopian Airlines",
  "Dawit Auto", "Selam Properties", "Addis Vehicle Inspection", "Exopya Studio", "Ada Ceramics",
  "Juniper", "Apex Tax & Compliance LLP", "Delaware Division of Revenue",
];

function findKnownProvider(text) {
  for (const name of KNOWN_PROVIDERS) {
    if (new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)) return name;
  }
  return "";
}

function titleCase(s) {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function findProvider(text, header) {
  const known = findKnownProvider(text) || findKnownProvider(header || "");
  if (known) return known;
  const source = header || text;
  const dash = source.match(/^(.+?)\s+[—–]\s+(.+)$/);
  if (dash) {
    const left = dash[1].replace(/^subject:\s*/i, "").trim();
    const right = dash[2].trim();
    if (/^(service reminder|reminder|notice|letter|invoice|receipt|quote)$/i.test(right) && left.length < 40) {
      return titleCase(left);
    }
    if (!/^(your|the|my)\b/i.test(right) && right.length < 40) return titleCase(right.replace(/^subject:\s*/i, ""));
  }
  const m = text.match(
    /\b(?:from|with|at|by|via)\s+((?:The\s+)?[A-Z][A-Za-z&.'-]+(?:\s+(?:of|and|&|for|[A-Z][A-Za-z&.'-]+)){0,3})/
  );
  if (m) {
    const value = m[1].trim().replace(/\s+(due|on|before|for|is|will|must)$/i, "");
    if (value.length > 2 && !/^(The|This|That|Your|Please|Due|Annual|Monthly)$/i.test(value)) return value;
  }
  if (/\bdmv\b/i.test(text)) return "DMV";
  return "";
}

function classify(text) {
  for (const [category, re] of CATEGORY_RULES) if (re.test(text)) return category;
  return "other";
}

function cleanTitle(line) {
  let t = line
    .replace(/^[\s\-•*–—>#]+/, "")
    .replace(/^\d{1,2}[.)]\s+/, "")
    .replace(/^(reminder|todo|action|task)\s*[:\-]\s*/i, "")
    .replace(/^(please|remember to|don't forget to|do not forget to|make sure to)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  t = t.split(/(?<=[.!?])\s+/)[0].replace(/[.!?]+$/, "").trim();
  const original = t;

  const plate = original.match(/(?:vehicle|plate|registration)\s+(?:no\.?\s*)?([A-Z0-9-]{3,})/i);
  if (/insurance|policy/i.test(original) && /(renew|expire)/i.test(original)) {
    return `Motor insurance renewal${plate ? ` · ${plate[1]}` : ""}`;
  }
  const km = original.match(/([\d,]{3,})\s?km/i);
  if (/service/i.test(original) && km) return `Vehicle service · ${km[1]} km`;

  t = t.replace(/\s*[—–]\s*(book|renew|pay|confirm|file|order|call|schedule|submit|buy)\b.*$/i, "");
  t = t.replace(/\b(?:is also due|is due|will be due|due|expires?|renews?|is scheduled|scheduled)\b.*$/i, "");
  t = t.replace(/\s+(?:every|each|per)\s+(?:day|week|month|quarter|year)\b.*$/i, "");
  t = t.replace(/\s+is\s+(?:monthly|weekly|quarterly|annual|annually|yearly).*$/i, "");
  t = t.replace(/^your\s+/i, "").replace(/[.,;:—–\-\s]+$/, "").trim();
  if (t.split(/\s+/).filter(Boolean).length < 3) t = original;
  if (t.length > 84) t = t.slice(0, 81).trimEnd() + "…";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function deriveTitle(itemText, header) {
  const text = `${header || ""}\n${itemText}`;
  let m;
  if (/insurance|policy|premium/i.test(text) && /renew|expire|cover/i.test(text)) {
    const plate = text.match(/(?:vehicle|plate)\s+(?:no\.?\s*)?([A-Z0-9-]{3,})/i);
    return `Motor insurance renewal${plate ? ` · ${plate[1]}` : ""}`;
  }
  if (/passport/i.test(text)) return "Passport renewal";
  if (/\b(lease|tenancy)\b/i.test(text)) return "Lease renewal";
  if (/(business|trade)\s+licen[cs]e/i.test(text)) return "Business licence renewal";
  if (/\biso\s*(\d{4,5})\b/i.test(text)) {
    const num = text.match(/\biso\s*(\d{4,5})\b/i)[1];
    return `ISO ${num} surveillance audit`;
  }
  if (/payroll/i.test(text)) return "Payroll tax filing";
  if (/roadworthiness/i.test(text) || (/inspection/i.test(text) && /vehicle|car\b/i.test(text))) {
    return "Vehicle roadworthiness inspection";
  }
  if (/staff contracts?|employment contracts?/i.test(text)) return "Staff contract renewals";
  if (/birthday/i.test(text)) {
    const name = text.match(/([A-Z][a-z]+(?:'s)?)\s+birthday/i);
    if (name) return `${name[1].replace(/'s$/i, "'s")} birthday`.replace(/^([A-Z][a-z]+)'s birthday$/, "$1's birthday");
    return "Birthday";
  }
  if (/anniversary/i.test(text)) return "Anniversary dinner";
  if ((m = text.match(/\bcall\s+([A-Z][a-z]+)/i))) return `Call ${titleCase(m[1])}`;
  if (/\bservice\b/i.test(text) && /\d[\d,]*\s?km/i.test(text)) {
    const km = text.match(/([\d,]{3,})\s?km/i);
    return `Vehicle service · ${km[1]} km`;
  }
  if (/registration/i.test(text) && /vehicle|annual|expire/i.test(text)) return "Vehicle registration renewal";
  if (/dentist|dental/i.test(text)) return "Dental check-up";
  if (/domain|ssl/i.test(text)) return "Domain renewal";
  if (/netflix|spotify|icloud|subscription/i.test(text)) {
    const p = findKnownProvider(text);
    return p ? `${p} subscription` : "Subscription renewal";
  }
  const base = header ? header.replace(/^subject:\s*/i, "").replace(/^(notice of|reminder:?)\s+/i, "") : itemText;
  return cleanTitle(base);
}

function isHeaderLine(line, notes, hasSeenObligation) {
  if (hasSeenObligation) {
    return line.length <= 64 && /^[A-Z0-9\s&.'’—–:()-]+$/.test(line) && /[A-Z]{3}/.test(line);
  }
  if (findDate(line, Date.now())) return false;
  if (line.length > 90) return false;
  if (/^[A-Z0-9\s&.'’—–:()-]+$/.test(line)) return true;
  if (/[—–]/.test(line) && line.length < 70) return true;
  if (/^(subject:|re:|notice|reminder|invoice|statement|policy|your .* renewal)/i.test(line)) return true;
  if (notes && line.length < 60 && !TASK_RE.test(line)) return true;
  return !TASK_RE.test(line);
}

function segmentize(text) {
  const lines = text.replace(/\r/g, "").split(/\n/);
  const segments = [];
  let header = "";
  let block = 0;
  let bulletDoc = lines.some((l) => /^([-*•]|\d{1,2}[.)])\s+/.test(l.trim()));

  for (const rawLine of lines) {
    const raw = rawLine.trim();
    if (!raw) {
      block += 1;
      continue;
    }
    if (SKIP_RE.test(raw)) {
      if (/^subject:/i.test(raw)) header = header || raw.replace(/^subject:\s*/i, "").trim();
      block += 1;
      continue;
    }
    const bullet = /^([-*•]|\d{1,2}[.)])\s+/.test(raw);
    const line = raw.replace(/^([-*•]|\d{1,2}[.)])\s+/, "").trim();
    if (!line) continue;

    if (!bullet && isHeaderLine(line, !segments.length, segments.some((s) => s.anchor))) {
      if (!header) header = line;
      block += 1;
      continue;
    }

    if (bullet) block += 1;
    const sentences = bullet || line.length < 120
      ? [line]
      : line.split(/(?<=[.!?])\s+(?=[A-Z(“"])/).filter((s) => s.trim().length > 4);
    sentences.forEach((sentence) => {
      segments.push({ text: sentence.trim(), header, paragraph: block, bullet });
    });
    if (bullet) block += 1;
  }
  return { segments, header, bulletDoc };
}

export function parseCapture(text, now = Date.now()) {
  const { segments, header, bulletDoc } = segmentize(text);
  const groups = [];
  let current = null;

  for (const seg of segments) {
    const date = findDate(seg.text, now);
    const recurrence = findRecurrence(seg.text);
    const hasTask = TASK_RE.test(seg.text);
    const anchor = hasTask && (date || recurrence);

    if (!anchor) {
      if (current) current.parts.push(seg);
      else {
        if (!groups.pending) groups.pending = [];
        groups.pending.push(seg);
      }
      continue;
    }

    const canMerge =
      current &&
      !seg.bullet &&
      !bulletDoc &&
      current.paragraph === seg.paragraph &&
      SUB_DEADLINE_RE.test(seg.text) &&
      !/also\b/i.test(seg.text) &&
      !recurrence;

    if (canMerge) {
      current.parts.push(seg);
      continue;
    }

    const parts = [];
    if (groups.pending?.length) {
      parts.push(...groups.pending);
      groups.pending = [];
    }
    parts.push(seg);
    current = { anchor: seg, parts, paragraph: seg.paragraph, header: seg.header || header };
    groups.push(current);
  }

  if (!groups.length && groups.pending?.length) {
    const material = groups.pending.filter((p) => TASK_RE.test(p.text));
    if (material.length) {
      groups.push({ anchor: material[0], parts: groups.pending, paragraph: 0, header });
    }
  }

  const items = [];
  const seen = new Set();

  for (const group of groups.slice(0, 12)) {
    const itemText = group.parts.map((p) => p.text).join(" ");
    const title = deriveTitle(itemText, group.header);
    if (!title || title.length < 4) continue;
    const key = title.toLowerCase().slice(0, 48);
    if (seen.has(key)) continue;
    seen.add(key);

    const classified = classify(itemText);
    const category = classified === "other" ? classify(group.header) : classified;
    const dates = group.parts.flatMap((p) => findDates(p.text, now));
    const strong = dates.filter((d) => d.confidence >= 0.75).sort((a, b) => a.date - b.date);
    const recurrence = group.parts.map((p) => findRecurrence(p.text)).find(Boolean) || null;
    const amount = group.parts.map((p) => findAmount(p.text)).find(Boolean) || null;
    const provider = category === "people" ? "" : findProvider(itemText, group.header);
    const payeeEmail = category === "people" ? null : findPayeeEmail(itemText);

    let due = strong[0]?.date || dates.sort((a, b) => a.date - b.date)[0]?.date || null;
    let dayOfMonth = null;
    if (!due && recurrence?.unit === "month") {
      const dom = itemText.match(/\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/i);
      if (dom) {
        dayOfMonth = +dom[1];
        due = nextDayOfMonth(now, dayOfMonth);
      }
    }
    if (!due) {
      const base = new Date(now);
      base.setUTCHours(10, 0, 0, 0);
      if (recurrence?.unit === "week") base.setUTCDate(base.getUTCDate() + 1);
      else if (recurrence?.unit === "month") base.setUTCDate(base.getUTCDate() + 7);
      else base.setUTCDate(base.getUTCDate() + 14);
      due = base;
    }

    let confidence = 0.56;
    if (dates.length) confidence += 0.18;
    if (recurrence) confidence += 0.09;
    if (amount) confidence += 0.06;
    if (provider) confidence += 0.05;
    if (payeeEmail) confidence += 0.02;
    if (category !== "other") confidence += 0.04;
    confidence = Math.min(0.98, Math.round(confidence * 100) / 100);

    const severityMap = { finance: 4, identity: 5, work: 4, health: 3, home: 3, people: 3, other: 2 };
    let severity = severityMap[category] ?? 3;
    if (/tax|licen[cs]e|passport|insurance|loan|deadline|penalty|legal|audit/i.test(itemText)) severity = 5;
    if (/subscription|streaming|domain|backup|wifi|filter|birthday|dinner/i.test(itemText)) severity = Math.min(severity, 2);
    if (/birthday|anniversary|call\b/i.test(itemText)) severity = 3;

    const chosen = strong[0] || null;
    const others = group.parts
      .filter((p) => p !== group.anchor && !SUB_DEADLINE_RE.test(p.text))
      .map((p) => p.text)
      .filter((t) => t.length > 8)
      .join(" ");
    const notes = others.length > 240 ? others.slice(0, 237) + "…" : others;

    const inferred =
      recurrence ||
      (/birthday|anniversary/i.test(itemText) ? { unit: "year", interval: 1, label: "annual" } : null) ||
      (/payroll/i.test(itemText) ? { unit: "month", interval: 1, label: "monthly" } : null) ||
      ((/insurance|policy|registration|lease|licen[cs]e/i.test(itemText) && /renew|expire/i.test(itemText))
        ? { unit: "year", interval: 1, label: "annual" }
        : null);

    const channel = payeeEmail
      ? "paypal"
      : bulletDoc ? "notes" : /subject:|dear\b/i.test(text) ? "email" : "document";

    items.push({
      id: `draft_${items.length + 1}`,
      title,
      category,
      provider: provider || "Unassigned",
      amount: amount?.amount || 0,
      currency: "USD",
      due_at: due.toISOString(),
      recurrence: inferred,
      severity,
      confidence,
      autonomy: category === "finance" || category === "work" ? "approve" : "prepare",
      agent_id: AGENT_BY_CATEGORY[category] || null,
      owner: "Solomon Tigabu",
      owner_kind: "human",
      backup: "Hanna Bekele",
      proof_required: PROOF_BY_CATEGORY[category] || "Confirmation",
      consequence: CONSEQUENCE_BY_CATEGORY[category] || "It slips through the cracks.",
      notes,
      payee_paypal_email: payeeEmail,
      source: "capture",
      channel,
      grace_days: 0,
      checklist: ["Review the extracted details", "Assign an owner", "Confirm the deadline"],
      evidence: {
        sentence: group.anchor.text.length > 180 ? group.anchor.text.slice(0, 177) + "…" : group.anchor.text,
        date: chosen?.label || null,
        recurrence: inferred?.label || null,
        amount: amount?.label || null,
      },
      needs_review: !dates.length,
    });
  }

  return {
    items,
    meta: {
      candidates: segments.length,
      parsed: items.length,
      model: "local-parser-v3",
      engine: "deterministic",
      ms: 320 + Math.round(Math.random() * 380),
    },
  };
}

// ---------------------------------------------------------------------------
// AI-first extraction
// ---------------------------------------------------------------------------

const CATEGORIES = ["finance", "work", "home", "identity", "health", "people", "other"];
const RECURRENCE_UNITS = ["day", "week", "month", "quarter", "year"];

const CAPTURE_SCHEMA = {
  type: "object",
  properties: {
    obligations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          category: { type: "string", enum: CATEGORIES },
          provider: { type: "string" },
          amount: { type: "number" },
          currency: { type: "string" },
          due_date: { type: "string" },
          recurrence_unit: { type: "string", enum: [...RECURRENCE_UNITS, ""] },
          recurrence_interval: { type: "integer" },
          severity: { type: "integer" },
          confidence: { type: "number" },
          proof_required: { type: "string" },
          consequence: { type: "string" },
          payee_paypal_email: { type: "string" },
          notes: { type: "string" },
        },
        required: ["title", "category", "confidence", "proof_required"],
      },
    },
  },
  required: ["obligations"],
};

export function captureAIConfigured(env = process.env) {
  return Boolean(env.GEMINI_API_KEY);
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function draftDue(value, now, fallback = 14) {
  const match = String(value || "").trim().match(ISO_DATE_RE);
  if (match) {
    const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], 10, 0, 0));
    if (!Number.isNaN(date.getTime())) return { due: date, dated: true };
  }
  const date = new Date(now);
  date.setUTCHours(10, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + fallback);
  return { due: date, dated: false };
}

function aiRecurrence(unit, interval) {
  const normalized = String(unit || "").toLowerCase();
  if (!RECURRENCE_UNITS.includes(normalized)) return null;
  const step = Number(interval);
  return {
    unit: normalized,
    interval: Number.isFinite(step) && step > 0 ? Math.min(12, Math.floor(step)) : 1,
    label: normalized,
  };
}

function aiItems(obligations, now) {
  const items = [];
  const seen = new Set();
  for (const raw of Array.isArray(obligations) ? obligations : []) {
    const title = String(raw?.title || "").replace(/\s+/g, " ").trim().slice(0, 84);
    if (title.length < 4) continue;
    const key = title.toLowerCase().slice(0, 48);
    if (seen.has(key)) continue;
    seen.add(key);

    const category = CATEGORIES.includes(raw?.category) ? raw.category : "other";
    const { due, dated } = draftDue(raw?.due_date, now);
    const recurrence = aiRecurrence(raw?.recurrence_unit, raw?.recurrence_interval);
    const amount = Number(raw?.amount);
    const email = String(raw?.payee_paypal_email || "").trim().toLowerCase();
    const payeeEmail = EMAIL_RE.test(email) && email.length <= 254 ? email : null;
    const severity = Number(raw?.severity);
    let confidence = Number(raw?.confidence);
    if (!Number.isFinite(confidence)) confidence = 0.7;
    if (!dated) confidence -= 0.12;
    confidence = Math.min(0.98, Math.max(0.35, Math.round(confidence * 100) / 100));

    items.push({
      id: `draft_${items.length + 1}`,
      title,
      category,
      provider: String(raw?.provider || "").trim().slice(0, 80) || "Unassigned",
      amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0,
      currency: "USD",
      due_at: due.toISOString(),
      recurrence,
      severity: Number.isFinite(severity) ? Math.min(5, Math.max(1, Math.round(severity))) : 3,
      confidence,
      autonomy: category === "finance" || category === "work" ? "approve" : "prepare",
      agent_id: AGENT_BY_CATEGORY[category] || null,
      owner: "Solomon Tigabu",
      owner_kind: "human",
      backup: "Hanna Bekele",
      proof_required: String(raw?.proof_required || "").slice(0, 160) || PROOF_BY_CATEGORY[category] || "Confirmation",
      consequence: String(raw?.consequence || "").slice(0, 240) || CONSEQUENCE_BY_CATEGORY[category] || "It slips through the cracks.",
      notes: String(raw?.notes || "").slice(0, 240),
      payee_paypal_email: payeeEmail,
      source: "capture",
      channel: payeeEmail ? "paypal" : "document",
      grace_days: 0,
      checklist: ["Review the extracted details", "Assign an owner", "Confirm the deadline"],
      evidence: { sentence: title, date: dated ? String(raw?.due_date || "") : null, recurrence: recurrence?.unit || null, amount: amount > 0 ? `$${amount.toFixed(2)}` : null },
      needs_review: !dated,
    });
    if (items.length >= 12) break;
  }
  return items;
}

/**
 * AI-first extraction. Returns null when no key is set or the model fails, so
 * the caller can fall back to the deterministic parser without losing the
 * capture. Never throws.
 */
export async function parseCaptureAI(text, now = Date.now(), { env = process.env } = {}) {
  if (!captureAIConfigured(env)) return null;
  const started = Date.now();
  const model = String(env.AI_MODEL_ID || "gemini-2.5-flash").trim();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{
              text: [
                "You extract recurring business obligations from a document, email or note.",
                "Return JSON only. One entry per obligation that carries a deadline or a recurrence.",
                `Today is ${new Date(now).toISOString().slice(0, 10)}. Resolve relative dates against it.`,
                "Rules:",
                "- amount is the money at stake in USD; use 0 when the document states none.",
                "- due_date is YYYY-MM-DD; use an empty string when no date is stated. Never invent one.",
                "- payee_paypal_email only when the document gives an address to pay.",
                "- confidence is 0-1 and reflects how certain the extraction is.",
                "- severity is 1-5: 5 for a tax filing, licence or insurance lapse.",
                "- proof_required is the artifact that proves completion, e.g. 'Stamped filing receipt'.",
                "- Ignore greetings, signatures and marketing copy.",
                "",
                "Document:",
                text.slice(0, 12_000),
              ].join("\n"),
            }],
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: CAPTURE_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(Number(env.CAPTURE_TIMEOUT_MS) || 15_000),
      }
    );
    if (!response.ok) return null;
    const json = await response.json();
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = JSON.parse(raw);
    const items = aiItems(parsed?.obligations, now);
    if (!items.length) return null;
    return {
      items,
      meta: {
        candidates: Array.isArray(parsed?.obligations) ? parsed.obligations.length : items.length,
        parsed: items.length,
        model: `gemini:${model}`,
        engine: "gemini",
        ms: Date.now() - started,
      },
    };
  } catch {
    return null;
  }
}
