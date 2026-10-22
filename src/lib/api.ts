import type { AuthConfig, AuthUser } from "../types";

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
    if (res.status === 401 && !path.startsWith("/api/auth/")) {
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
  walletChallenge: (address: string) =>
    request<{ address: string; nonce: string; message: string; expires_at: string }>(
      "/api/auth/wallet/challenge",
      "POST",
      { address }
    ),
  walletVerify: (payload: { address: string; nonce: string; signature: string }) =>
    request<{ user: AuthUser }>("/api/auth/wallet/verify", "POST", payload),

  capture: (text: string) => request("/api/capture", "POST", { text }),
  addObligations: (items: any[]) => request("/api/obligations/bulk", "POST", { items }),
  createObligation: (item: any) => request("/api/obligations", "POST", item),
  patchObligation: (id: string, patch: any) => request(`/api/obligations/${id}`, "PATCH", patch),
  complete: (id: string, payload: any) => request(`/api/obligations/${id}/complete`, "POST", payload),
  snooze: (id: string, days: number) => request(`/api/obligations/${id}/snooze`, "POST", { days }),
  run: (id: string) => request(`/api/obligations/${id}/run`, "POST", {}),
  remove: (id: string) => request(`/api/obligations/${id}`, "DELETE"),
  decide: (id: string, decision: string, note = "") =>
    request(`/api/approvals/${id}/decide`, "POST", { decision, note }),
  createAgent: (agent: any) => request("/api/agents", "POST", agent),
  patchAgent: (id: string, patch: any) => request(`/api/agents/${id}`, "PATCH", patch),
  hire: (payload: any) => request("/api/hire", "POST", payload),
  createKey: (name: string) => request("/api/keys", "POST", { name }),
  deleteKey: (id: string) => request(`/api/keys/${id}`, "DELETE"),
  sweep: () => request("/api/demo/sweep", "POST", {}),
  advance: (days: number) => request("/api/demo/advance", "POST", { days }),
  reset: () => request("/api/demo/reset", "POST", {}),
  setLive: (live: boolean) => request("/api/meta", "PATCH", { live }),
  trust: () => request("/api/trust"),
  createReceipt: (payload: any) => request("/api/trust/receipts", "POST", payload),
  signReceipt: (id: string, signature: string, signer: string) =>
    request(`/api/trust/receipts/${id}/sign`, "POST", { signature, signer }),
  anchorReceipt: (id: string, tx_hash: string) =>
    request(`/api/trust/receipts/${id}/anchor`, "POST", { tx_hash }),
  receiptCalldata: (id: string) => request(`/api/trust/receipts/${id}/calldata`),
  createEscrow: (payload: any) => request("/api/trust/escrows", "POST", payload),
  commitEscrow: (id: string) => request(`/api/trust/escrows/${id}/commit`, "POST", {}),
  fundEscrow: (id: string, tx_hash: string) =>
    request(`/api/trust/escrows/${id}/fund`, "POST", { tx_hash }),
  releaseEscrow: (id: string, proof_receipt_id?: string | null, tx_hash?: string) =>
    request(`/api/trust/escrows/${id}/release`, "POST", { proof_receipt_id, tx_hash }),
};
