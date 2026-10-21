export const DAY = 86400000;

export const CATEGORIES: Record<string, { label: string; icon: string; tone: string }> = {
  finance: { label: "Finance", icon: "wallet", tone: "lime" },
  home: { label: "Home", icon: "home", tone: "amber" },
  health: { label: "Health", icon: "heart", tone: "coral" },
  people: { label: "People", icon: "gift", tone: "coral" },
  work: { label: "Work", icon: "briefcase", tone: "violet" },
  identity: { label: "Identity", icon: "id", tone: "blue" },
  other: { label: "Other", icon: "circle", tone: "ink" },
};

export const AUTONOMY: Record<string, { label: string; short: string; desc: string }> = {
  notify: { label: "Notify", short: "Notify", desc: "Nudge me. I'll do it." },
  prepare: { label: "Prepare", short: "Prepare", desc: "Draft the plan, don't act." },
  approve: { label: "Approve", short: "Approve", desc: "Act after my yes." },
  autopilot: { label: "Autopilot", short: "Auto", desc: "Act within limits." },
};

export const BANDS: Record<string, { label: string; tone: string }> = {
  critical: { label: "Critical", tone: "coral" },
  high: { label: "High", tone: "amber" },
  guarded: { label: "Guarded", tone: "blue" },
  low: { label: "Low", tone: "teal" },
};

export const money = (n: number, currency = "USD") => {
  if (!n) return "$0";
  const symbol = currency === "ETB" ? "ETB " : "$";
  return symbol + Math.round(n).toLocaleString("en-US");
};

export const moneyExact = (n: number) =>
  "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const dateShortYear = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function dueLabel(iso: string, nowMs: number) {
  const diff = (new Date(iso).getTime() - nowMs) / DAY;
  if (diff < -1) return `${Math.abs(Math.round(diff))}d overdue`;
  if (diff < 0) return "Overdue today";
  if (diff < 1) return "Today";
  if (diff < 2) return "Tomorrow";
  if (diff < 7) return `in ${Math.round(diff)} days`;
  if (diff < 14) return "next week";
  if (diff < 45) return `in ${Math.round(diff / 7)} wks`;
  return dateShort(iso);
}

export function timeAgo(iso: string, nowMs: number) {
  const s = Math.max(1, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return dateShort(iso);
}

export function clockLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function recurrenceLabel(rec: { unit: string; interval: number } | null) {
  if (!rec) return "One-off";
  const names: Record<string, string> = {
    day: "Daily", week: "Weekly", month: "Monthly", quarter: "Quarterly", year: "Annual",
  };
  if (rec.interval === 1) return names[rec.unit] || "Recurring";
  const unitNames: Record<string, string> = {
    day: "days", week: "weeks", month: "months", quarter: "quarters", year: "years",
  };
  return `Every ${rec.interval} ${unitNames[rec.unit] || "cycles"}`;
}

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export const TONES: Record<string, string> = {
  lime: "#D9F26A",
  violet: "#CFC7FF",
  coral: "#FFD0C5",
  amber: "#FBE0A8",
  teal: "#B8EAD9",
  blue: "#C7D8FF",
  ink: "#D9D7CC",
};

export const TONES_DEEP: Record<string, string> = {
  lime: "#5E7412",
  violet: "#4C3BC7",
  coral: "#B23A22",
  amber: "#9A6411",
  teal: "#0B6B52",
  blue: "#2852B8",
  ink: "#3D3D34",
};

export function riskTone(band: string) {
  return band === "critical" ? "coral" : band === "high" ? "amber" : band === "guarded" ? "blue" : "teal";
}

export function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
