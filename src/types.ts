export type Band = "critical" | "high" | "guarded" | "low";
export type Autonomy = "notify" | "prepare" | "approve" | "autopilot";

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
  providers: Array<"email" | "google" | "wallet">;
  created_at: string;
}

export interface AuthConfig {
  email: boolean;
  google: boolean;
  wallet: boolean;
}

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
  executor_url?: string | null;
  executor_configured?: boolean;
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
  executed?: boolean;
  execution_error?: string;
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
  connector_status?: number | null;
  error?: string | null;
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

export interface TrustNetwork {
  key: string;
  label: string;
  role: string;
  description: string;
  chain_id: number;
  caip2: string;
  currency: string;
  usdc: string;
  usdc_decimals: number;
  explorer: string;
  rpc_configured: boolean;
  attestation_contract: string | null;
  escrow_contract: string | null;
  ready: boolean;
  preview: boolean;
  status: "configured" | "preview";
  tone: string;
  testnet: boolean;
  guardrail: string | null;
  env: { rpc: string; attestation: string; escrow: string };
}

export interface TrustStats {
  receipts: number;
  prepared: number;
  signed: number;
  anchored: number;
  escrows: number;
  open_escrows: number;
  released_escrows: number;
  escrow_value: number;
  released_value: number;
}

export interface TrustGuardrails {
  ethiopia_offchain: boolean;
  note: string;
  disclosure: string;
}

export interface TrustSummary {
  networks: TrustNetwork[];
  stats: TrustStats;
  guardrails: TrustGuardrails;
}

export interface TypedDataPayload {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: {
    obligationId: string;
    proofHash: string;
    evidenceHash: string;
    agentId: string;
    issuedAt: number;
    nonce: string;
  };
}

export interface ProofReceipt {
  id: string;
  obligation_id: string;
  obligation_title: string;
  agent_id: string | null;
  agent_name: string | null;
  chain: string;
  chain_id: number;
  network_label: string;
  network_role: string;
  explorer: string;
  explorer_url: string | null;
  contract: string | null;
  contract_url: string | null;
  proof_label: string;
  proof_hash: string;
  evidence_hash: string;
  short_hash: string;
  short_proof: string;
  issued_at: string;
  issued_at_unix: number;
  nonce: string;
  digest: string;
  typed_data: TypedDataPayload;
  wallet_payload: TypedDataPayload;
  status: "prepared" | "signed" | "anchored";
  signer: string | null;
  signature: string | null;
  signed_at: string | null;
  tx_hash: string | null;
  block_number: number | null;
  anchored_at: string | null;
  anchor_mode: string;
  source: string;
  demo: boolean;
  created_at: string;
  usdc: string;
  mode: "preview" | "live";
}

export interface Escrow {
  id: string;
  obligation_id: string;
  obligation_title: string;
  provider_id: string | null;
  provider_name: string | null;
  provider_kind: string | null;
  chain: string;
  chain_id: number;
  network_label: string;
  network_role: string;
  explorer: string;
  explorer_url: string | null;
  release_url: string | null;
  contract: string | null;
  contract_url: string | null;
  currency: string;
  amount: number;
  amount_base: string;
  mode: string;
  jurisdiction_ack: boolean;
  status: "draft" | "committed" | "funded" | "released";
  proof_receipt_id: string | null;
  note: string;
  short_id: string;
  tx_hash: string | null;
  release_tx_hash: string | null;
  created_at: string;
  committed_at: string | null;
  funded_at: string | null;
  released_at: string | null;
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
  receipts: ProofReceipt[];
  escrows: Escrow[];
  trust: TrustSummary;
  stats: Stats;
  api_calls: number;
  api_calls_limit: number;
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
