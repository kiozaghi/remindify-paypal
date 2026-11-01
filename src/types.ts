export type Band = "critical" | "high" | "guarded" | "low";
export type Autonomy = "notify" | "prepare" | "approve" | "autopilot";

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  email_verified?: boolean;
  avatar_url: string | null;
  providers: Array<"email" | "google">;
  created_at: string;
}

export interface AuthConfig {
  email: boolean;
  google: boolean;
  reset?: boolean;
  verify?: boolean;
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
  payer_paypal_email?: string | null;
  payee_paypal_email?: string | null;
  created_at: string;
  last_completed_at?: string;
  last_proof?: string;
  completions?: number;
  handover_at?: string;
  handover_from?: string;
  handover_reason?: string;
  handover_owner_kind?: "human" | "agent" | "team";
  handover_history?: { at: string; from: string; to: string; reason: string; reclaimed_at?: string }[];
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
  spend_ceiling?: number | null;
  trust: number;
  runs_30d: number;
  success_rate: number | null;
  proofs_30d: number;
  cost_per_run: number;
  status: string;
  scopes: string[];
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
  paypal_email?: string | null;
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
  expires_at?: string | null;
  rotated_at?: string | null;
  expired?: boolean;
}

export interface TrustRail {
  key: "paypal";
  label: string;
  mode: "sandbox" | "live";
  configured: boolean;
  hold_days: number;
  fee_percent: number;
  auditor: string;
  auditor_configured: boolean;
  threshold: number;
}

export interface TrustStats {
  receipts: number;
  filed: number;
  verified: number;
  rejected: number;
  settled: number;
  escrows: number;
  open_escrows: number;
  released_escrows: number;
  escrow_value: number;
  released_value: number;
  fees_collected: number;
}

export interface TrustGuardrails {
  proof_before_money: boolean;
  note: string;
  disclosure: string;
}

export interface TrustSummary {
  rail: TrustRail;
  stats: TrustStats;
  guardrails: TrustGuardrails;
}

export interface ReceiptAudit {
  verified: boolean;
  confidence: number;
  engine: string;
  matching_verdict?: string;
  discrepancies?: string[];
  audited_at?: string;
}

export interface ReceiptSettlement {
  escrow_id: string;
  capture_id: string | null;
  payout_batch_id: string;
  gross: number;
  fee: number;
  net: number;
  recipient: string;
  at: string;
}

export type ReceiptStatus = "filed" | "verified" | "rejected" | "settled";

export interface ProofReceipt {
  id: string;
  obligation_id: string;
  obligation_title: string;
  obligation_amount: number;
  agent_id: string | null;
  agent_name: string | null;
  actor_id: string | null;
  actor_type: string;
  actor: string;
  proof_label: string;
  proof_hash: string;
  artifact_hash: string;
  artifact: {
    name: string;
    type: string;
    text: string;
    bytes: number;
    mime?: string;
    inline?: boolean;
  };
  completed_at: string;
  status: ReceiptStatus;
  audit: ReceiptAudit | null;
  settlement: ReceiptSettlement | null;
  signature: string | null;
  settlement_signature: string | null;
  signed_at: string | null;
  source: string;
  demo: boolean;
  created_at: string;
  short_hash: string;
  short_signature: string;
  verified: boolean;
  settled: boolean;
  mode: string;
}

export type EscrowStatus =
  | "draft"
  | "hold_pending"
  | "authorized"
  | "captured_awaiting_payout"
  | "released"
  | "voided";

export interface Escrow {
  id: string;
  obligation_id: string;
  obligation_title: string;
  provider_id: string | null;
  provider_name: string | null;
  provider_kind: string | null;
  payee_paypal_email: string;
  rail: "paypal";
  currency: string;
  amount: number;
  platform_fee_percent: number;
  platform_fee: number;
  net_payout: number;
  fee_percent: number;
  status: EscrowStatus;
  paypal_order_id: string | null;
  approve_url: string | null;
  authorization_id: string | null;
  authorization_expires_at: string | null;
  capture_id: string | null;
  payout_batch_id: string | null;
  payout_status?: string | null;
  proof_receipt_id: string | null;
  failure_code: string | null;
  failure_reason: string | null;
  timeline: { at: string; status: string; note: string }[];
  note: string;
  created_at: string;
  hold_at: string | null;
  authorized_at: string | null;
  captured_at: string | null;
  released_at: string | null;
  voided_at: string | null;
  short_id: string;
  hold_expires_in_days: number | null;
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
  agent_done_30d: number;
  agent_failed_30d: number;
  agent_proofs_30d: number;
}

export type SellerBookingStatus =
  | "requested"
  | "accepted"
  | "in_progress"
  | "delivered"
  | "completed"
  | "declined";

export type PayoutMethod = "none" | "bank" | "paypal";

export interface SellerPayoutAccount {
  method: PayoutMethod;
  label: string;
  account_last4: string;
  paypal_email?: string;
  currency: string;
  country: string;
  connected: boolean;
  updated_at: string | null;
}

export interface SellerProfile {
  id: string;
  name: string;
  headline: string;
  kind: "human" | "agent";
  specialty: string;
  description: string;
  rating: number | null;
  jobs: number;
  price: number;
  price_unit: string;
  sla: string;
  response_min: number;
  capabilities: string[];
  available: boolean;
  verified: boolean;
  payout: SellerPayoutAccount;
  created_at: string;
  updated_at: string;
}

export interface SellerProof {
  label: string;
  note: string;
  reference: string;
  hash: string;
  submitted_at: string;
}

export interface SellerReceipt {
  id: string;
  ref: string;
  booking_id: string;
  buyer_name: string;
  title: string;
  gross: number;
  fee: number;
  net: number;
  currency: string;
  fee_bps: number;
  proof_hash: string;
  issued_at: string;
  status: string;
}

export interface SellerEarning {
  id: string;
  booking_id: string;
  receipt_id: string;
  description: string;
  gross: number;
  fee: number;
  amount: number;
  currency: string;
  status: "held" | "available" | "processing" | "paid";
  release_at: string;
  created_at: string;
  released_at: string | null;
  paid_at: string | null;
  payout_id: string | null;
  requested_at?: string;
}

export interface SellerPayout {
  id: string;
  ref: string;
  amount: number;
  currency: string;
  method: PayoutMethod;
  destination: string;
  status: "processing" | "paid";
  entry_ids: string[];
  created_at: string;
  paid_at: string | null;
  note: string;
}

export interface SellerBooking {
  id: string;
  ref: string;
  buyer_name: string;
  buyer_kind: string;
  buyer_workspace: string;
  title: string;
  brief: string;
  amount: number;
  currency: string;
  status: SellerBookingStatus;
  requested_at: string;
  due_at: string;
  accepted_at: string | null;
  started_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  proof: SellerProof | null;
  receipt_id: string | null;
  earning_id: string | null;
  decline_reason: string | null;
  declined_at?: string;
  earning: SellerEarning | null;
  receipt: SellerReceipt | null;
  days_left: number;
}

export interface SellerSummary {
  currency: string;
  gross: number;
  fees: number;
  net: number;
  held: number;
  available: number;
  processing: number;
  paid: number;
  open_bookings: number;
  requests: number;
  in_flight: number;
  delivered: number;
  completed: number;
  declined: number;
  acceptance_rate: number | null;
  fee_bps: number;
  hold_days: number;
  next_release_at: string | null;
}

export interface SellerMaintenanceItem {
  id: string;
  label: string;
  detail: string;
  status: "done" | "todo" | "warn";
}

export interface SellerState {
  profile: SellerProfile;
  bookings: SellerBooking[];
  receipts: SellerReceipt[];
  payouts: SellerPayout[];
  earnings: SellerEarning[];
  summary: SellerSummary;
  maintenance: SellerMaintenanceItem[];
}

export interface Payment {
  id: string;
  kind: "obligation" | "payout";
  rail: "paypal";
  status: string;
  amount: number;
  currency: string;
  obligation_id?: string;
  obligation_title?: string;
  order_id?: string | null;
  capture_id?: string | null;
  payer_email?: string | null;
  payout_id?: string;
  payout_ref?: string;
  batch_id?: string | null;
  receiver?: string | null;
  provider_status?: string | null;
  failure_code?: string | null;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentsSummary {
  captured_count: number;
  captured_total: number;
  payouts_sent: number;
  failed: number;
}

export interface Invoice {
  id: string;
  obligation_id: string;
  obligation_title: string;
  agent_id: string | null;
  agent_name: string;
  payer_paypal_email: string;
  amount: number;
  currency: string;
  status: string;
  paypal_invoice_id: string;
  payer_view_url: string | null;
  due_date: string | null;
  reminders: number;
  last_reminded_at: string | null;
  demo: boolean;
  created_at: string;
}

export interface AppState {
  now: string;
  clock_offset_days: number;
  live: boolean;
  workspace: string;
  user: string;
  plan: string;
  storage: "local" | "cloud";
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
  seller: SellerState;
  payments: Payment[];
  invoices: Invoice[];
  paypal: { configured: boolean; mode: "sandbox" | "live" };
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
  payee_paypal_email?: string | null;
  needs_review?: boolean;
}
