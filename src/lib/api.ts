import type { AuthConfig, AuthUser, Payment } from "../types";

export interface ApiFailure extends Error {
  status?: number;
  code?: string;
  payload?: any;
}

export async function request<T = any>(path: string, method = "GET", payload?: any): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: payload ? { "content-type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(
      data.message || data.error || `Request failed (${res.status})`
    ) as ApiFailure;
    error.status = res.status;
    error.code = data.error;
    error.payload = data;
    if (
      res.status === 401 &&
      !path.startsWith("/api/auth/") &&
      path !== "/api/account/delete"
    ) {
      window.dispatchEvent(new CustomEvent("remindify:unauthorized"));
    }
    throw error;
  }
  return data as T;
}

export const api = {
  state: () => request("/api/state"),

  authConfig: () => request<AuthConfig>("/api/auth/config"),
  authSession: () => request<{ user: AuthUser | null }>("/api/auth/session"),
  authSignup: (payload: { name?: string; email: string; password: string }) =>
    request<{ user: AuthUser }>("/api/auth/signup", "POST", payload),
  authLogin: (payload: { email: string; password: string }) =>
    request<{ user: AuthUser }>("/api/auth/login", "POST", payload),
  authLogout: () => request<{ ok: true }>("/api/auth/logout", "POST", {}),
  authRequestReset: (email: string) =>
    request<{ ok: true; message: string }>("/api/auth/reset/request", "POST", { email }),
  authResetPassword: (payload: { token: string; password: string }) =>
    request<{ ok: true; message: string }>("/api/auth/reset/confirm", "POST", payload),
  authVerifyRequest: () =>
    request<{ ok: true; message: string; already_verified?: boolean }>("/api/auth/verify/request", "POST", {}),
  authVerifyConfirm: (token: string) =>
    request<{ user: AuthUser; message: string }>("/api/auth/verify/confirm", "POST", { token }),
  deleteAccount: (payload: { confirm: string; password?: string }) =>
    request<{ ok: true; purged_workspace: boolean; message: string }>(
      "/api/account/delete",
      "POST",
      payload
    ),

  capture: (text: string) => request("/api/capture", "POST", { text }),
  addObligations: (items: any[]) => request("/api/obligations/bulk", "POST", { items }),
  createObligation: (item: any) => request("/api/obligations", "POST", item),
  patchObligation: (id: string, patch: any) => request(`/api/obligations/${id}`, "PATCH", patch),
  complete: (id: string, payload: any) => request(`/api/obligations/${id}/complete`, "POST", payload),
  snooze: (id: string, days: number) => request(`/api/obligations/${id}/snooze`, "POST", { days }),
  run: (id: string) => request(`/api/obligations/${id}/run`, "POST", {}),
  reclaim: (id: string) => request(`/api/obligations/${id}/reclaim`, "POST", {}),
  remove: (id: string) => request(`/api/obligations/${id}`, "DELETE"),
  decide: (id: string, decision: string, note = "") =>
    request(`/api/approvals/${id}/decide`, "POST", { decision, note }),
  createAgent: (agent: any) => request("/api/agents", "POST", agent),
  patchAgent: (id: string, patch: any) => request(`/api/agents/${id}`, "PATCH", patch),
  connectExecutor: (id: string, url: string | null) =>
    request(`/api/agents/${id}/executor`, "POST", { url }),
  hire: (payload: any) => request("/api/hire", "POST", payload),
  createKey: (name: string) => request("/api/keys", "POST", { name }),
  rotateKey: (id: string) => request(`/api/keys/${id}/rotate`, "POST", {}),
  deleteKey: (id: string) => request(`/api/keys/${id}`, "DELETE"),
  sweep: () => request("/api/demo/sweep", "POST", {}),
  advance: (days: number) => request("/api/demo/advance", "POST", { days }),
  reset: () => request("/api/demo/reset", "POST", {}),
  setLive: (live: boolean) => request("/api/meta", "PATCH", { live }),
  trust: () => request("/api/trust"),
  createReceipt: (payload: any) => request("/api/trust/receipts", "POST", payload),
  auditReceipt: (id: string, artifact?: any) =>
    request(`/api/trust/receipts/${id}/audit`, "POST", artifact ? { artifact } : {}),
  verifyReceipt: (id: string) => request(`/api/trust/receipts/${id}/verify`),
  createEscrow: (payload: any) => request("/api/trust/escrows", "POST", payload),
  holdEscrow: (id: string) => request(`/api/trust/escrows/${id}/hold`, "POST", {}),
  voidEscrow: (id: string) => request(`/api/trust/escrows/${id}/void`, "POST", {}),
  releaseEscrow: (id: string, payload: { proof_receipt_id?: string; artifact?: any } = {}) =>
    request(`/api/trust/escrows/${id}/release`, "POST", payload),

  paypalOrder: (obligation_id: string) =>
    request<{ payment: Payment; approve_url: string; mode: "sandbox" | "live" }>(
      "/api/payments/paypal/orders",
      "POST",
      { obligation_id }
    ),
  paypalCapture: (order_id: string) =>
    request<{ payment: Payment; already_captured?: boolean }>(
      "/api/payments/paypal/capture",
      "POST",
      { order_id }
    ),
  paypalPayout: (payout_id: string) =>
    request<{ payment: Payment; batch_id: string; batch_status: string }>(
      "/api/payments/paypal/payouts",
      "POST",
      { payout_id }
    ),
  sendInvoice: (payload: { obligation_id: string; payer_paypal_email?: string }) =>
    request("/api/invoices", "POST", payload),
  remindInvoice: (id: string) => request(`/api/invoices/${id}/remind`, "POST", {}),

  sellerSave: (payload: any) => request("/api/seller", "PATCH", payload),
  sellerBooking: (id: string, action: "accept" | "decline" | "start" | "proof", payload: any = {}) =>
    request(`/api/seller/bookings/${id}/${action}`, "POST", payload),
  sellerPayout: () => request("/api/seller/payouts", "POST", {}),
  sellerPayoutReceived: (id: string) =>
    request(`/api/seller/payouts/${id}/receive`, "POST", {}),
};
