import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule, ModuleRegistry, themeQuartz,
  type ColDef, type ICellRendererParams,
} from "ag-grid-community";
import { CategoryTile, Monogram } from "./ui";
import { AUTONOMY, dateShort, dueLabel, money } from "../lib/format";
import type { Agent, Escrow, Obligation } from "../types";

ModuleRegistry.registerModules([AllCommunityModule]);

const studioTheme = themeQuartz.withParams({
  accentColor: "#1f6f5c",
  backgroundColor: "#ffffff",
  borderColor: "#e7e2d8",
  fontFamily: "inherit",
  fontSize: 13,
  headerBackgroundColor: "#f7f4ee",
  headerTextColor: "#5b564c",
  rowHoverColor: "#faf7f1",
  oddRowBackgroundColor: "#fdfbf7",
  spacing: 6,
});

type StudioRow = {
  id: string;
  category: string;
  title: string;
  provider: string;
  amount: number;
  due: string;
  dueText: string;
  dueShort: string;
  days: number;
  band: string;
  autonomy: Obligation["autonomy"];
  owner: string;
  owner_kind: string;
  agent?: Agent | null;
  escrow?: Escrow | null;
};

const ESCROW_LABEL: Record<string, string> = {
  draft: "DRAFT",
  hold_pending: "HELD_PENDING",
  authorized: "AUTHORIZED_HOLD",
  captured_awaiting_payout: "AI_AUDITED",
  released: "PAYOUT_RELEASED",
  voided: "VOIDED",
};

function ObligationCell({ data }: ICellRendererParams<StudioRow>) {
  if (!data) return null;
  return (
    <div className="studio-cell studio-obligation">
      <CategoryTile category={data.category} />
      <div>
        <strong>{data.title}</strong>
        <em>{data.provider}</em>
      </div>
    </div>
  );
}

function DeadlineCell({ data }: ICellRendererParams<StudioRow>) {
  if (!data) return null;
  const width = Math.max(4, Math.min(100, 100 - Math.max(0, data.days) * 4));
  return (
    <div className={`studio-cell studio-deadline ${data.days < 0 ? "late" : data.days <= 3 ? "soon" : ""}`}>
      <div>
        <strong>{data.dueText}</strong>
        <em>{data.dueShort}</em>
      </div>
      <span className={`studio-bar band-${data.band}`} aria-hidden="true">
        <i style={{ width: `${width}%` }} />
      </span>
    </div>
  );
}

function AgentCell({ data }: ICellRendererParams<StudioRow>) {
  if (!data) return null;
  if (data.agent) {
    return (
      <div className="studio-cell studio-agent">
        <Monogram name={data.agent.name} tone={data.agent.tone} kind="agent" size="xs" />
        <div>
          <strong>{data.agent.name}</strong>
          <em>
            @{data.agent.handle}
            {data.agent.spend_ceiling ? ` · $${data.agent.spend_ceiling.toLocaleString("en-US")} cap` : ""}
          </em>
        </div>
      </div>
    );
  }
  return (
    <div className="studio-cell studio-agent">
      <Monogram name={data.owner} tone={data.owner_kind === "team" ? "violet" : "ink"} size="xs" />
      <div>
        <strong>{data.owner.split(" ")[0]}</strong>
        <em>{data.owner_kind === "team" ? "team" : "human owner"}</em>
      </div>
    </div>
  );
}

function EscrowCell({ data }: ICellRendererParams<StudioRow>) {
  if (!data) return null;
  const escrow = data.escrow;
  if (!escrow) return <span className="studio-escrow none">No hold</span>;
  const label = ESCROW_LABEL[escrow.status] || escrow.status.toUpperCase();
  return (
    <div className="studio-escrow-wrap">
      <span className={`studio-escrow ${escrow.status}`}>
        <i />
        {label}
      </span>
      <em>{money(escrow.amount)} · fee {money(escrow.platform_fee)}</em>
    </div>
  );
}

function AutonomyCell({ data, context }: ICellRendererParams<StudioRow>) {
  if (!data) return null;
  const choose = (context as { onAutonomy?: (id: string, autonomy: Obligation["autonomy"]) => void } | undefined)?.onAutonomy;
  return (
    <div className="mini-seg studio-seg" onClick={(event) => event.stopPropagation()}>
      {(["notify", "prepare", "approve", "autopilot"] as const).map((value) => (
        <button
          key={value}
          className={data.autonomy === value ? `on tone-${value}` : ""}
          title={AUTONOMY[value].desc}
          onClick={() => choose?.(data.id, value)}
        >
          {value === "autopilot" ? "Auto" : value === "prepare" ? "Prep" : value === "notify" ? "Notify" : "Approve"}
        </button>
      ))}
    </div>
  );
}

export default function AgentStudioGrid({
  obligations, agents, escrows = [], nowMs, onOpen, onAutonomy,
}: {
  obligations: Obligation[];
  agents: Agent[];
  escrows?: Escrow[];
  nowMs: number;
  onOpen: (id: string) => void;
  onAutonomy?: (id: string, autonomy: Obligation["autonomy"]) => void;
}) {
  const rows = useMemo<StudioRow[]>(
    () =>
      obligations.map((ob) => ({
        id: ob.id,
        category: ob.category,
        title: ob.title,
        provider: ob.provider,
        amount: ob.amount,
        due: ob.due_at,
        dueText: dueLabel(ob.due_at, nowMs),
        dueShort: dateShort(ob.due_at),
        days: ob.risk.days,
        band: ob.risk.band,
        autonomy: ob.autonomy,
        owner: ob.owner,
        owner_kind: ob.owner_kind,
        agent: ob.agent_id ? agents.find((a) => a.id === ob.agent_id) || null : null,
        escrow: escrows.find((e) => e.obligation_id === ob.id && e.status !== "voided") || null,
      })),
    [obligations, agents, escrows, nowMs]
  );

  const columns = useMemo<ColDef<StudioRow>[]>(
    () => [
      { field: "title", headerName: "Obligation", flex: 3, minWidth: 250, cellRenderer: ObligationCell },
      { field: "due", headerName: "Risk & deadline", flex: 2, minWidth: 175, cellRenderer: DeadlineCell, comparator: (a, b) => new Date(a).getTime() - new Date(b).getTime() },
      { field: "agent", headerName: "Passport", flex: 2, minWidth: 190, cellRenderer: AgentCell, valueGetter: (p) => p.data?.agent?.name || p.data?.owner || "" },
      { field: "escrow", headerName: "PayPal escrow", width: 165, cellRenderer: EscrowCell, valueGetter: (p) => p.data?.escrow?.status || "" },
      {
        field: "autonomy",
        headerName: "Autonomy",
        width: 212,
        cellRenderer: AutonomyCell,
        valueFormatter: (p) => AUTONOMY[p.value as Obligation["autonomy"]]?.label || p.value,
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 110,
        type: "rightAligned",
        valueFormatter: (p) => (p.value > 0 ? money(p.value) : "—"),
      },
    ],
    []
  );

  return (
    <div className="studio-card">
      <div className="studio-head">
        <div>
          <span className="eyebrow">Agent Studio · AG Grid</span>
          <strong>{rows.length} live rows</strong>
        </div>
        <p>Sort, filter and scan the same register the agents see. Custom cells for the obligation, risk meter, inline autonomy and PayPal escrow state.</p>
      </div>
      <div className="studio-grid">
        <AgGridReact<StudioRow>
          theme={studioTheme}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={{ sortable: true, filter: true, resizable: true, suppressHeaderMenuButton: false }}
          context={{ onAutonomy }}
          domLayout="autoHeight"
          rowHeight={54}
          headerHeight={38}
          suppressCellFocus
          onRowClicked={(event) => event.data && onOpen(event.data.id)}
        />
      </div>
    </div>
  );
}
