import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { api } from "./lib/api";
import { isAppRoute, navigateTo, readLocation } from "./lib/router";
import type { AppState } from "./types";

type Toast = { id: number; title: string; detail?: string; tone?: "default" | "success" | "warn" | "agent" };

type Overlays = {
  drawer: string | null;
  agentDrawer: string | null;
  palette: boolean;
  hire: string | null;
  newAgent: boolean;
  newObligation: boolean;
  templates: boolean;
};

type Ctx = {
  state: AppState | null;
  loading: boolean;
  nowMs: number;
  route: string;
  navigate: (route: string) => void;
  overlays: Overlays;
  setOverlays: React.Dispatch<React.SetStateAction<Overlays>>;
  openObligation: (id: string) => void;
  openAgent: (id: string) => void;
  openHire: (id: string) => void;
  toast: (title: string, detail?: string, tone?: Toast["tone"]) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  refresh: () => Promise<void>;
  actions: ReturnType<typeof makeActions>;
};

const AppCtx = createContext<Ctx | null>(null);

function currentRoute() {
  const { page } = readLocation();
  return isAppRoute(page) ? page : "today";
}

function makeActions(
  setState: (s: AppState) => void,
  toast: Ctx["toast"],
  closeOverlays: () => void,
  setOverlays: React.Dispatch<React.SetStateAction<Overlays>>
) {
  const run = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      const result = await fn();
      if (result && (result as any).state) setState((result as any).state);
      return result;
    } catch (error: any) {
      toast("Something didn't land", error.message, "warn");
      return null;
    }
  };

  return {
    capture: (text: string) => run(() => api.capture(text)),
    addObligations: (items: any[]) =>
      run(async () => {
        const res = await api.addObligations(items);
        toast(`${items.length} ${items.length === 1 ? "obligation" : "obligations"} scheduled`, "Owners assigned, backups set, risk scored.", "success");
        return res;
      }),
    createObligation: (item: any) =>
      run(async () => {
        const res = await api.createObligation(item);
        toast("Obligation created", "It's on the board and risk-scored.", "success");
        closeOverlays();
        return res;
      }),
    patchObligation: (id: string, patch: any) =>
      run(async () => {
        const res = await api.patchObligation(id, patch);
        if (patch.autonomy) {
          const labels: Record<string, string> = { notify: "Notify — just remind me", prepare: "Prepare — draft a plan", approve: "Approve — act after my yes", autopilot: "Autopilot — act within limits" };
          toast("Autonomy updated", labels[patch.autonomy] || patch.autonomy, "agent");
        }
        return res;
      }),
    complete: (id: string, payload: any = {}) =>
      run(async () => {
        const res = await api.complete(id, payload);
        const next = res?.next_due
          ? `Next due ${new Date(res.next_due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`
          : res?.archived
            ? "Archived with proof."
            : "";
        toast("Proof filed. Beat kept.", next || "The audit trail is updated.", "success");
        return res;
      }),
    snooze: (id: string, days = 3) =>
      run(async () => {
        const res = await api.snooze(id, days);
        toast(`Snoozed ${days} days`, "Risk recalculated. Nothing is lost.", "default");
        return res;
      }),
    runNow: (id: string) =>
      run(async () => {
        const res = await api.run(id);
        if (res?.message) {
          toast(res.executed ? "Agent executed" : "Plan drafted", res.message, res.executed ? "agent" : "default");
        }
        return res;
      }),
    remove: (id: string) =>
      run(async () => {
        const res = await api.remove(id);
        toast("Obligation removed", "The audit log keeps a record.", "default");
        closeOverlays();
        return res;
      }),
    decide: (id: string, decision: string, note = "") =>
      run(async () => {
        const res = await api.decide(id, decision, note);
        if (decision !== "approve") {
          toast("Declined", "The agent will wait for new instructions.", "default");
        } else if (res?.executed) {
          toast("Approved and executed", res.message || "The action ran and proof was filed.", "agent");
        } else {
          toast("Approved", res?.message || "No executor is connected, so nothing ran.", "warn");
        }
        return res;
      }),
    createAgent: (payload: any) =>
      run(async () => {
        const res = await api.createAgent(payload);
        toast(`${payload.name} is on the roster`, "Give it an obligation to earn its keep.", "agent");
        setOverlays((o) => ({ ...o, newAgent: false }));
        return res;
      }),
    patchAgent: (id: string, patch: any) =>
      run(async () => {
        const res = await api.patchAgent(id, patch);
        if (patch.status) toast(patch.status === "paused" ? "Agent paused" : "Agent resumed", "Presence updated.", "default");
        return res;
      }),
    connectExecutor: (id: string, url: string | null) =>
      run(async () => {
        const res = await api.connectExecutor(id, url);
        toast(
          url ? "Executor connected" : "Executor disconnected",
          url
            ? "Copy the signing secret now. It is shown once and never again."
            : "The agent can draft and request approval, but it cannot act.",
          url ? "agent" : "warn"
        );
        return res;
      }),
    hire: (payload: any) =>
      run(async () => {
        const res = await api.hire(payload);
        toast(
          `Booked ${res?.provider?.name || "your provider"}`,
          "Scoped access granted. Proof will land in your vault.",
          "success"
        );
        setOverlays((o) => ({ ...o, hire: null }));
        return res;
      }),
    createKey: (name: string) =>
      run(async () => {
        const res = await api.createKey(name);
        toast("Agent key issued", "Copy it now — it's only shown once.", "agent");
        return res;
      }),
    rotateKey: (id: string) =>
      run(async () => {
        const res = await api.rotateKey(id);
        toast("Key rotated", "The old secret stopped working. Copy the new one now.", "agent");
        return res;
      }),
    deleteKey: (id: string) =>
      run(async () => {
        const res = await api.deleteKey(id);
        toast("Key revoked", "Any agent using it is now locked out.", "warn");
        return res;
      }),
    sweep: () =>
      run(async () => {
        const res = await api.sweep();
        const bits = [];
        if (res?.proposed) bits.push(`${res.proposed} ready for approval`);
        if (res?.executed) bits.push(`${res.executed} executed`);
        if (res?.drafted) bits.push(`${res.drafted} plans drafted`);
        if (res?.blocked) bits.push(`${res.blocked} waiting on an executor`);
        if (res?.failed) bits.push(`${res.failed} failed`);
        toast(
          "Agent sweep complete",
          bits.length ? bits.join(" · ") : "Nothing needed a decision. Portfolio is quiet.",
          "agent"
        );
        return res;
      }),
    advance: (days: number) =>
      run(async () => {
        const res = await api.advance(days);
        const bits = [];
        if (res?.proposed) bits.push(`${res.proposed} escalated for approval`);
        if (res?.executed) bits.push(`${res.executed} executed`);
        if (res?.blocked) bits.push(`${res.blocked} waiting on an executor`);
        if (res?.failed) bits.push(`${res.failed} failed`);
        toast(
          `${days} days later`,
          bits.length ? bits.join(" · ") : "Risk re-scored. Agents re-planned.",
          "agent"
        );
        return res;
      }),
    reset: () =>
      run(async () => {
        const res = await api.reset();
        toast("Demo restored", "Back to today, with the original portfolio.", "default");
        return res;
      }),
    setLive: (live: boolean) =>
      run(async () => {
        const res = await api.setLive(live);
        toast(live ? "Agents are live" : "Agents paused", live ? "They'll propose actions as risk moves." : "No new proposals will be generated.", "default");
        return res;
      }),
    createReceipt: (payload: any) =>
      run(async () => {
        const res = await api.createReceipt(payload);
        toast("Proof receipt filed", "The EIP-712 payload is ready to sign or anchor.", "success");
        return res;
      }),
    signReceipt: (id: string, signature: string, signer: string) =>
      run(async () => {
        const res = await api.signReceipt(id, signature, signer);
        toast("Receipt signed", "The signature is verified against the EIP-712 digest.", "success");
        return res;
      }),
    anchorReceipt: (id: string, tx_hash: string) =>
      run(async () => {
        const res = await api.anchorReceipt(id, tx_hash);
        toast("Receipt anchored", `${res?.receipt?.network_label || "Chain"} now holds the proof hash.`, "success");
        return res;
      }),
    createEscrow: (payload: any) =>
      run(async () => {
        const res = await api.createEscrow(payload);
        toast("Escrow intent opened", "Commit it offchain or fund it when a contract is configured.", "success");
        return res;
      }),
    commitEscrow: (id: string) =>
      run(async () => {
        const res = await api.commitEscrow(id);
        toast("Escrow committed", "Release now requires a signed proof receipt.", "default");
        return res;
      }),
    fundEscrow: (id: string, tx_hash: string) =>
      run(async () => {
        const res = await api.fundEscrow(id, tx_hash);
        toast("Escrow funded", "USDC funding recorded onchain.", "success");
        return res;
      }),
    releaseEscrow: (id: string, proof_receipt_id?: string | null, tx_hash?: string) =>
      run(async () => {
        const res = await api.releaseEscrow(id, proof_receipt_id, tx_hash);
        toast("Escrow released", "A signed receipt satisfied the release condition.", "success");
        return res;
      }),
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState(currentRoute);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [overlays, setOverlays] = useState<Overlays>({
    drawer: null,
    agentDrawer: null,
    palette: false,
    hire: null,
    newAgent: false,
    newObligation: false,
    templates: false,
  });
  const toastId = useRef(0);

  const toast = useCallback((title: string, detail?: string, tone: Toast["tone"] = "default") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, title, detail, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await api.state();
      setState(data.state);
    } catch (error: any) {
      if (error?.status === 401) setState(null);
      /* otherwise keep the last known state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, 12000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    // Landing pack cards deep-link to /obligations?templates=1. Open the pack
    // picker once, then drop the parameter so a refresh doesn't reopen it.
    const { page, params } = readLocation();
    if (page !== "obligations" || params.get("templates") !== "1") return;
    setOverlays((o) => ({ ...o, templates: true }));
    window.history.replaceState(null, "", "/obligations");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOverlays((o) => ({ ...o, palette: !o.palette }));
      }
      if (e.key === "Escape") {
        setOverlays((o) => ({ ...o, palette: false, drawer: null, agentDrawer: null, hire: null, newAgent: false, newObligation: false, templates: false }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navigate = useCallback((next: string) => {
    if (!isAppRoute(next)) return;
    navigateTo(next);
    setRoute(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setOverlays((o) => ({ ...o, palette: false }));
  }, []);

  const closeOverlays = useCallback(() => {
    setOverlays((o) => ({ ...o, newAgent: false, newObligation: false, hire: null, templates: false }));
  }, []);

  const actions = useMemo(
    () => makeActions((s) => setState(s), toast, closeOverlays, setOverlays),
    [toast, closeOverlays]
  );

  const openObligation = useCallback((id: string) => setOverlays((o) => ({ ...o, drawer: id, palette: false })), []);
  const openAgent = useCallback((id: string) => setOverlays((o) => ({ ...o, agentDrawer: id, palette: false })), []);
  const openHire = useCallback((id: string) => setOverlays((o) => ({ ...o, hire: id, palette: false })), []);

  const nowMs = state ? new Date(state.now).getTime() : Date.now();

  const value: Ctx = {
    state,
    loading,
    nowMs,
    route,
    navigate,
    overlays,
    setOverlays,
    openObligation,
    openAgent,
    openHire,
    toast,
    toasts,
    dismissToast,
    refresh,
    actions,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}
