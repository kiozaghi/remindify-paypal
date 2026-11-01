import { useEffect, useMemo, useState } from "react";
import { useApp } from "../store";
import { Icon } from "../components/Icon";
import { RiskMeter } from "../components/ui";
import { CATEGORIES, money, timeOf, dueLabel, AUTONOMY } from "../lib/format";
import type { Risk } from "../types";

type Entry = {
  key: string;
  kind: "obligation" | "hold";
  obligationId: string;
  title: string;
  at: string;
  tone: string;
  category: string;
  status: string;
  agentName: string;
  amount: number;
  risk: Risk | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfDay(value: Date | number) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function Calendar() {
  const { state, nowMs, openObligation, navigate } = useApp();
  const today = startOfDay(nowMs);
  const todayKey = dayKey(today);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [picked, setPicked] = useState<string | null>(null);

  // Until the operator picks a day, open on the first day this month with
  // something on it — today itself when today has work. Derived rather than
  // stored so it settles once the register has loaded.
  const autoSelected = useMemo(() => {
    if (!state) return todayKey;
    const monthKey = todayKey.slice(0, 7);
    const dueDays = [
      ...state.obligations.map((ob) => dayKey(new Date(ob.due_at))),
      ...state.runs.flatMap((run) =>
        run.result?.hold?.at ? [dayKey(new Date(run.result.hold.at))] : []
      ),
    ]
      .filter((key) => key.startsWith(monthKey))
      .sort();
    return !dueDays.length || dueDays.includes(todayKey) ? todayKey : dueDays[0];
  }, [state, todayKey]);
  const selected = picked ?? autoSelected;

  // The virtual clock can move. When it does, bring the calendar back to it
  // rather than leaving the operator in a month that no longer exists.
  useEffect(() => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setPicked(null);
  }, [todayKey]);

  const entries = useMemo(() => {
    if (!state) return [] as Entry[];
    const out: Entry[] = [];
    for (const ob of state.obligations) {
      const agent = state.agents.find((a) => a.id === ob.agent_id);
      out.push({
        key: `ob:${ob.id}`,
        kind: "obligation",
        obligationId: ob.id,
        title: ob.title,
        at: ob.due_at,
        tone: CATEGORIES[ob.category]?.tone || "ink",
        category: ob.category,
        status: ob.status,
        agentName: agent?.name || ob.owner,
        amount: ob.amount,
        risk: ob.risk,
      });
    }

    // Slots an agent already held show up on the day they were held, not on
    // the obligation's deadline. Only the latest run per obligation counts.
    const holds = new Map<string, Entry>();
    for (const run of state.runs) {
      const hold = run.result?.hold;
      if (!hold?.at) continue;
      const at = new Date(hold.at).getTime();
      const existing = holds.get(run.obligation_id);
      if (existing && new Date(existing.at).getTime() >= at) continue;
      holds.set(run.obligation_id, {
        key: `hold:${run.id}`,
        kind: "hold",
        obligationId: run.obligation_id,
        title: `${hold.kind === "table" ? "Table held" : "Call held"} — ${hold.with}`,
        at: hold.at,
        tone: "violet",
        category: "people",
        status: hold.status,
        agentName: run.agent?.name || "Agent",
        amount: 0,
        risk: null,
      });
    }
    return [...out, ...holds.values()];
  }, [state]);

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of entries) {
      const key = dayKey(new Date(entry.at));
      const list = map.get(key) || [];
      list.push(entry);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    }
    return map;
  }, [entries]);

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((monthStart.getDay() + daysInMonth) / 7) * 7;
  const days = Array.from({ length: cells }, (_, i) =>
    new Date(cursor.getFullYear(), cursor.getMonth(), 1 - monthStart.getDay() + i)
  );

  const monthEntries = entries.filter((entry) => {
    const date = new Date(entry.at);
    return date.getFullYear() === cursor.getFullYear() && date.getMonth() === cursor.getMonth();
  });
  const heldCount = monthEntries.filter((entry) => entry.kind === "hold").length;
  const overdue = monthEntries.filter(
    (entry) => entry.kind === "obligation" && entry.risk && entry.risk.days < 0 && entry.status === "active"
  ).length;
  const monthMoney = monthEntries.reduce(
    (sum, entry) => sum + (entry.kind === "obligation" && entry.status !== "done" ? entry.amount : 0),
    0
  );

  const selectedEntries = byDay.get(selected) || [];
  const selectedDate = selectedEntries.length ? new Date(selectedEntries[0].at) : new Date(`${selected}T12:00:00`);
  const selectedLabel = selectedDate.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const selectedIsToday = selected === todayKey;

  const shift = (months: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + months, 1);
    setCursor(next);
    const keep = new Date(`${selected}T12:00:00`);
    if (keep.getMonth() !== next.getMonth() || keep.getFullYear() !== next.getFullYear()) {
      setPicked(dayKey(next));
    }
  };

  const jumpToday = () => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setPicked(todayKey);
  };

  if (!state) return null;

  return (
    <div className="view calendar-view">
      <header className="view-head calendar-head">
        <div>
          <span className="eyebrow">Every placement, one grid</span>
          <h1>Calendar</h1>
          <p>Every obligation on the day it lands, plus the slots agents already hold. Open any item to work it.</p>
        </div>
        <div className="view-head-actions">
          <button className="btn btn-ghost" onClick={() => navigate("activity")}>
            <Icon name="pulse" size={16} /> Activity right now
          </button>
          <button className="btn btn-ink" onClick={jumpToday}>
            <Icon name="today" size={16} /> Today
          </button>
        </div>
      </header>

      <section className="calendar-shell">
        <header className="calendar-bar">
          <div className="calendar-month">
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
              <Icon name="chevronLeft" size={16} />
            </button>
            <h2>{cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
            <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month">
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
          <div className="calendar-summary">
            <span><b>{monthEntries.length}</b> placements</span>
            <span><b>{heldCount}</b> held slots</span>
            <span className={overdue ? "warn" : ""}><b>{overdue}</b> overdue</span>
            <span><b>{money(monthMoney)}</b> in play</span>
          </div>
        </header>

        <div className="calendar-weekdays">
          {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
        </div>

        <div className="calendar-grid">
          {days.map((date) => {
            const key = dayKey(date);
            const inMonth = date.getMonth() === cursor.getMonth();
            const isToday = key === todayKey;
            const isSelected = key === selected;
            const dayEntries = byDay.get(key) || [];
            const visible = dayEntries.slice(0, 3);
            return (
              <div
                key={key}
                className={`calendar-cell ${inMonth ? "" : "outside"} ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`}
              >
                <button className="calendar-day" onClick={() => setPicked(key)} aria-pressed={isSelected}>
                  <span>{date.getDate()}</span>
                  {isToday && <em>today</em>}
                </button>
                <div className="calendar-items">
                  {visible.map((entry) => (
                    <button
                      key={entry.key}
                      className={`calendar-chip tone-${entry.tone} ${entry.kind === "hold" ? "hold" : ""} ${entry.status === "done" ? "done" : ""}`}
                      title={`${entry.title} · ${entry.agentName}`}
                      onClick={() => { setPicked(key); openObligation(entry.obligationId); }}
                    >
                      <i />
                      <span>{entry.title}</span>
                    </button>
                  ))}
                  {dayEntries.length > visible.length && (
                    <button className="calendar-more" onClick={() => setPicked(key)}>
                      +{dayEntries.length - visible.length} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="calendar-legend">
          <span><i className="lg-finance" /> Finance &amp; money</span>
          <span><i className="lg-work" /> Work &amp; compliance</span>
          <span><i className="lg-people" /> People</span>
          <span><i className="lg-identity" /> Identity &amp; facilities</span>
          <span><i className="lg-hold" /> Slot held by an agent</span>
          <span><i className="lg-done" /> Done</span>
        </div>
      </section>

      <section className="calendar-day-panel">
        <header className="day-panel-head">
          <div>
            <span className="eyebrow">{selectedIsToday ? "Today · selected" : "Selected day"}</span>
            <h2>{selectedLabel}</h2>
          </div>
          <span className="day-panel-count">
            {selectedEntries.length} {selectedEntries.length === 1 ? "item" : "items"}
          </span>
        </header>

        {selectedEntries.length ? (
          <div className="day-list">
            {selectedEntries.map((entry) => (
              <button
                className={`day-row ${entry.kind === "hold" ? "hold" : ""}`}
                key={entry.key}
                onClick={() => openObligation(entry.obligationId)}
              >
                <span className={`day-time ${entry.kind === "hold" ? "hold" : ""}`}>
                  {entry.kind === "hold" ? <Icon name="calendar" size={12} /> : timeOf(entry.at)}
                </span>
                <span className="day-main">
                  <span className="day-title">
                    <strong>{entry.title}</strong>
                    {entry.kind === "hold" && <em className="day-tag">held</em>}
                    {entry.status === "done" && <em className="day-tag done">done</em>}
                  </span>
                  <span className="day-meta">
                    {CATEGORIES[entry.category]?.label || entry.category} · with {entry.agentName}
                    {entry.amount > 0 ? ` · ${money(entry.amount)}` : ""}
                  </span>
                </span>
                {entry.risk ? <RiskMeter risk={entry.risk} /> : <span className="day-risk-empty" />}
                <span className={`day-when ${entry.risk && entry.risk.days < 0 ? "late" : ""}`}>
                  {entry.kind === "hold" ? "held" : dueLabel(entry.at, nowMs)}
                  <em>
                    {entry.kind === "hold"
                      ? "calendar"
                      : AUTONOMY[state.obligations.find((o) => o.id === entry.obligationId)?.autonomy || "prepare"]?.label}
                  </em>
                </span>
                <Icon name="chevronRight" size={15} className="day-chevron" />
              </button>
            ))}
          </div>
        ) : (
          <div className="calendar-empty">
            <Icon name="calendar" size={20} />
            <div>
              <strong>Nothing lands this day.</strong>
              <p>Pick another day, or capture a new obligation and it will appear here.</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("capture")}>
              <Icon name="sparkle" size={14} /> Capture
            </button>
          </div>
        )}

        <footer className="calendar-foot">
          <span className="calendar-foot-note">
            <Icon name="lock" size={12} /> Every item opens where it lives; nothing is edited from the grid.
          </span>
          <div className="calendar-foot-actions">
            {!selectedIsToday && (
              <button className="btn btn-ghost btn-sm" onClick={jumpToday}>
                <Icon name="today" size={14} /> Back to today
              </button>
            )}
            <button className="btn btn-ink btn-sm" onClick={() => navigate("activity")}>
              Go to activity <Icon name="arrowRight" size={14} />
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
