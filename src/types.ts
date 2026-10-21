export type Band = "critical" | "high" | "guarded" | "low";
export type Autonomy = "notify" | "prepare" | "approve" | "autopilot";

export interface Risk {
  score: number;
  band: Band;
  days: number;
  urgency: number;
}

export interface Obligation {
  id: string;
  title: string;
  category: string;
  provider: string;
  owner: string;
  owner_kind: "human" | "agent" | "team";
  agent_id: string | null;
  backup: string;
  amount: number;
  penalty: number;
  currency: string;
  due_at: string;
  recurrence: { unit: string; interval: number } | null;
  status: string;
  autonomy: Autonomy;
  severity: number;
  confidence: number;
  proof_required: string;
  consequence: string;
  notes: string;
  source: string;
  channel: string;
  grace_days: number;
  checklist: string[];
  evidence?: any;
  marketplace?: any;
  created_at: string;
  last_completed_at?: string;
  last_proof?: string;
  completions?: number;
  risk: Risk;
}

export interface Agent {
  id: string;
  name: string;
  handle: string;
  role: string;
  initials: string;
  tone: string;
  description: string;
  capabilities: string[];
  autonomy_ceiling: Autonomy;
  trust: number;
  runs_30d: number;
  success_rate: number;
  cost_per_run: number;
  status: string;
  scopes: string[];
  hours_saved: number;
  last_active: string;
  custom?: boolean;
}

export interface Approval {
  id: string;
  obligation_id: string;
  agent_id: string;
  title: string;
  summary: string;
  proposed_action: string;
  cost: number;
  evidence: { label: string; detail: string }[];
  risk: string;
  status: "pending" | "approved" | "denied";
  created_at: string;
  decided_at?: string;
  decision_note?: string;
  obligation?: Obligation | null;
  agent?: Agent | null;
}

export interface Run {
  id: string;
  agent_id: string;
  obligation_id: string;
  action: string;
  detail: string;
  status: string;
  proof: string | null;
  duration_ms: number;
  cost: number;
  created_at: string;
  agent?: Agent | null;
  obligation?: Obligation | null;
}

export interface Provider {
  id: string;
  name: string;
  kind: "human" | "agent";
  specialty: string;
  initials: string;
  tone: string;
  rating: number;
  jobs: number;
  price: number;
  price_unit: string;
  sla: string;
  verified: boolean;
  description: string;
  capabilities: string[];
  response_min: number;
}

export interface EventItem {
  id: string;
  actor_type: "human" | "agent" | "system" | "automation";
  actor_id: string | null;
  actor: string;
  verb: string;
  object: string;
  detail: string;
  kind: string;
  channel?: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  secret?: string;
  scopes: string[];
  created_at: string;
  last_used: string | null;
}

export interface Stats {
  active: number;
  due_week: number;
  critical: number;
  high: number;
  pending_approvals: number;
  exposure: number;
  coverage: number;
  delegated: number;
  with_backup: number;
  saved_year: number;
  agent_runs_30d: number;
  hours_saved: number;
  streak_weeks: number;
}

export interface AppState {
  now: string;
  clock_offset_days: number;
  live: boolean;
  workspace: string;
  user: string;
  plan: string;
  obligations: Obligation[];
  agents: Agent[];
  approvals: Approval[];
  runs: Run[];
  providers: Provider[];
  events: EventItem[];
  keys: ApiKey[];
  stats: Stats;
  api_calls: number;
}

export interface Draft {
  id: string;
  title: string;
  category: string;
  provider: string;
  amount: number;
  currency: string;
  due_at: string;
  recurrence: { unit: string; interval: number } | null;
  severity: number;
  confidence: number;
  autonomy: Autonomy;
  agent_id: string | null;
  owner: string;
  owner_kind: string;
  backup: string;
  proof_required: string;
  consequence: string;
  notes: string;
  source: string;
  channel: string;
  grace_days: number;
  checklist: string[];
  evidence?: any;
  needs_review?: boolean;
}
