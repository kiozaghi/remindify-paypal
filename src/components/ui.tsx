import React, { useEffect } from "react";
import { Icon } from "./Icon";
import { useApp } from "../store";
import {
  AUTONOMY, BANDS, CATEGORIES, TONES, TONES_DEEP, initialsOf, riskTone, money,
} from "../lib/format";
import type { Autonomy, Obligation } from "../types";

export function Monogram({
  name, tone = "ink", kind = "human", size = "md", className = "",
}: {
  name: string; tone?: string; kind?: string; size?: "xs" | "sm" | "md" | "lg" | "xl"; className?: string;
}) {
  return (
    <span
      className={`mono-gram mono-${size} mono-kind-${kind} ${className}`}
      style={{ background: TONES[tone] || TONES.ink, color: TONES_DEEP[tone] || TONES_DEEP.ink }}
      title={name}
    >
      {kind === "agent" ? (
        <span className="mono-agent-glyph">{initialsOf(name)}</span>
      ) : (
        initialsOf(name)
      )}
      {kind === "agent" && <i className="mono-status" />}
    </span>
  );
}

export function CategoryTile({ category, size = 38 }: { category: string; size?: number }) {
  const meta = CATEGORIES[category] || CATEGORIES.other;
  return (
    <span
      className="cat-tile"
      style={{
        width: size, height: size, background: TONES[meta.tone], color: TONES_DEEP[meta.tone],
      }}
    >
      <Icon name={meta.icon} size={Math.round(size * 0.46)} />
    </span>
  );
}

export function RiskPill({ band, score, compact = false }: { band: string; score?: number; compact?: boolean }) {
  return (
    <span className={`risk-pill tone-${riskTone(band)}`}>
      <i className="risk-pill-dot" />
      {compact ? BANDS[band]?.label : `${BANDS[band]?.label || band}${score !== undefined ? ` · ${score}` : ""}`}
    </span>
  );
}

export function RiskMeter({ risk, showScore = true }: { risk: Obligation["risk"]; showScore?: boolean }) {
  return (
    <div className={`risk-meter tone-${riskTone(risk.band)}`}>
      <div className="risk-meter-track">
        <span className="risk-meter-fill" style={{ width: `${Math.max(4, risk.score)}%` }} />
        <span className="risk-meter-legend">
          <i /><i /><i /><i />
        </span>
      </div>
      {showScore && (
        <span className="risk-meter-value">
          {risk.score}
          <em>{risk.band === "critical" ? "crit" : risk.band}</em>
        </span>
      )}
    </div>
  );
}

export function Segmented({
  options, value, onChange, size = "md", className = "",
}: {
  options: { value: string; label: string; title?: string }[];
  value: string;
  onChange: (v: string) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={`segmented seg-${size} ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          className={`seg-btn ${value === o.value ? "on" : ""}`}
          onClick={(e) => { e.stopPropagation(); onChange(o.value); }}
          title={o.title || o.label}
          role="tab"
          aria-selected={value === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AutonomyControl({ obligation, compact = false }: { obligation: Obligation; compact?: boolean }) {
  const { actions } = useApp();
  return (
    <div className={`autonomy-control ${compact ? "compact" : ""}`}>
      <Segmented
        size="sm"
        value={obligation.autonomy}
        options={[
          { value: "notify", label: "Notify", title: "Just remind me" },
          { value: "prepare", label: "Prepare", title: "Agent drafts a plan" },
          { value: "approve", label: "Approve", title: "Agent acts after my approval" },
          { value: "autopilot", label: "Auto", title: "Agent acts within limits" },
        ]}
        onChange={(v) => actions.patchObligation(obligation.id, { autonomy: v })}
      />
      {!compact && <span className="autonomy-hint">{AUTONOMY[obligation.autonomy]?.desc}</span>}
    </div>
  );
}

export function Ring({
  value, size = 116, stroke = 9, tone = "lime", label, sub,
}: { value: number; size?: number; stroke?: number; tone?: string; label?: string; sub?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = tone === "lime" ? "#D9F26A" : tone === "coral" ? "#F05B3C" : "#FBF9F3";
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(251,249,243,.14)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray .8s cubic-bezier(.2,.7,.2,1)" }}
        />
      </svg>
      <div className="ring-inner">
        <strong>{label ?? value}</strong>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

export function Modal({
  title, eyebrow, children, onClose, width = 560, footer, className = "",
}: {
  title: string; eyebrow?: string; children: React.ReactNode; onClose: () => void;
  width?: number; footer?: React.ReactNode; className?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${className}`} style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({
  label, hint, children, className = "",
}: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}{hint && <em>{hint}</em>}</span>
      {children}
    </label>
  );
}

export function EmptyState({
  icon = "sparkle", title, detail, action,
}: { icon?: string; title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name={icon} size={22} /></span>
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
      {action}
    </div>
  );
}

export function Money({ value, currency = "USD" }: { value: number; currency?: string }) {
  return <span className="money">{money(value, currency)}</span>;
}

export function Pill({ children, tone = "ink", className = "" }: { children: React.ReactNode; tone?: string; className?: string }) {
  return <span className={`pill pill-${tone} ${className}`}>{children}</span>;
}

export function LiveDot({ live = true }: { live?: boolean }) {
  return <span className={`live-dot ${live ? "on" : "off"}`}><i />{live ? "Live" : "Paused"}</span>;
}
