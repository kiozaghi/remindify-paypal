export async function request<T = any>(path: string, method = "GET", payload?: any): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: payload ? { "content-type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  state: () => request("/api/state"),
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
};
