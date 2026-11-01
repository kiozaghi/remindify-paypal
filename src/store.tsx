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
  deleteAccount: boolean;
  escrowFor: string | null;
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
    reclaim: (id: string) =>
      run(async () => {
        const res = await api.reclaim(id);
        toast("Back in your hands", "The handover is recorded in the audit trail.", "success");
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
        toast("Proof receipt filed", "Signed by Remindify. Run the auditor to verify the evidence.", "success");
        return res;
      }),
    auditReceipt: (id: string, artifact?: any) =>
      run(async () => {
        const res = await api.auditReceipt(id, artifact);
        if (res?.verified) {
          const pct = Math.round((res.audit?.confidence || 0) * 100);
          toast("Proof verified", `${pct}% confidence · the hold can be captured.`, "success");
        } else {
          toast("Proof rejected", res?.audit?.discrepancies?.[0] || "The artifact doesn't match this obligation.", "warn");
        }
        return res;
      }),
    createEscrow: (payload: any) =>
      run(async () => {
        const res = await api.createEscrow(payload);
        toast("Escrow opened", "Place the PayPal hold to reserve the payer's funds.", "success");
        return res;
      }),
    holdEscrow: (id: string) =>
      run(async () => {
        const res = await api.holdEscrow(id);
        toast("Hold requested", "Approve it on PayPal. The escrow flips to authorized when you return.", "default");
        return res;
      }),
    voidEscrow: (id: string) =>
      run(async () => {
        const res = await api.voidEscrow(id);
        toast("Hold released", "The payer's funds are back in their PayPal balance.", "default");
        return res;
      }),
    releaseEscrow: async (id: string, payload: any = {}) => {
      try {
        const res = await api.releaseEscrow(id, payload);
        if (res?.state) setState(res.state);
        const net = res?.escrow?.net_payout;
        toast(
          "Escrow settled",
          typeof net === "number"
            ? `$${net.toFixed(2)} paid to ${res.escrow.payee_paypal_email} · fee $${Number(res.escrow.platform_fee).toFixed(2)}`
            : "The hold was captured and the provider was paid.",
          "success"
        );
        return res;
      } catch (error: any) {
        if (error.payload?.state) setState(error.payload.state);
        if (error.code === "proof_rejected") {
          const pct = Math.round((error.payload?.audit?.confidence || 0) * 100);
          toast("Proof rejected", `${pct}% confidence · ${error.message}`, "warn");
        } else if (error.code === "payout_failed") {
          toast("Captured, payout failed", error.message, "warn");
        } else {
          toast("Escrow didn't settle", error.message, "warn");
        }
        return error.payload ?? null;
      }
    },
    payWithPaypal: (id: string) =>
      run(async () => {
        const res = await api.paypalOrder(id);
        toast(
          res.mode === "sandbox" ? "Opening PayPal sandbox" : "Opening PayPal",
          "Approve the payment there. Nothing is charged until you do.",
          "default"
        );
        // A full navigation, because the approval page belongs to PayPal.
        window.location.assign(res.approve_url);
        return res;
      }),
    sendInvoice: async (obligationId: string, payerEmail?: string) => {
      try {
        const res = await api.sendInvoice({
          obligation_id: obligationId,
          payer_paypal_email: payerEmail,
        });
        if (res?.state) setState(res.state);
        toast(
          "Invoice sent",
          `$${Number(res.invoice.amount).toFixed(2)} billed to ${res.invoice.payer_paypal_email} · ${res.invoice.paypal_invoice_id}`,
          "success"
        );
        return res;
      } catch (error: any) {
        if (error.payload?.state) setState(error.payload.state);
        if (error.code === "payer_required") {
          toast("Payer email needed", "Add the client's PayPal email to the obligation first.", "warn");
        } else if (error.code === "paypal_not_configured") {
          toast("PayPal isn't connected", "Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET, then try again.", "warn");
        } else {
          toast("Invoice not sent", error.message, "warn");
        }
        return error.payload ?? null;
      }
    },
    remindInvoice: async (invoiceId: string) => {
      try {
        const res = await api.remindInvoice(invoiceId);
        if (res?.state) setState(res.state);
        toast("Reminder sent", `PayPal will nudge ${res.invoice.payer_paypal_email}.`, "default");
        return res;
      } catch (error: any) {
        if (error.payload?.state) setState(error.payload.state);
        toast("Reminder not sent", error.message, "warn");
        return error.payload ?? null;
      }
    },
    capturePaypal: (orderId: string) =>
      run(async () => {
        const res = await api.paypalCapture(orderId);
        toast(
          res.already_captured ? "Already paid" : "Paid with PayPal",
          `$${Number(res.payment.amount).toFixed(2)} settled${
            res.payment.capture_id ? ` · ${res.payment.capture_id}` : ""
          }. The capture is filed as proof.`,
          "success"
        );
        return res;
      }),
    paySellerWithPaypal: (payoutId: string) =>
      run(async () => {
        const res = await api.paypalPayout(payoutId);
        toast(
          "Sent with PayPal",
          `Batch ${res.batch_id} is on its way. The ledger flips to paid when PayPal confirms.`,
          "success"
        );
        return res;
      }),
    saveSeller: (patch: any) =>
      run(async () => {
        const res = await api.sellerSave(patch);
        toast("Storefront saved", "Buyers see the same profile you do.", "success");
        return res;
      }),
    bookingAction: (
      id: string,
      action: "accept" | "decline" | "start" | "proof",
      payload: any = {}
    ) =>
      run(async () => {
        const res = await api.sellerBooking(id, action, payload);
        const title = res?.booking?.title || "Booking";
        if (action === "accept") {
          toast("Booking accepted", `${title} is yours. Start when the scope is clear.`, "success");
        } else if (action === "decline") {
          toast("Booking declined", "The buyer keeps the brief and can book elsewhere.", "default");
        } else if (action === "start") {
          toast("Work started", `${title} is in progress.`, "agent");
        } else {
          const release = res?.earning?.release_at
            ? new Date(res.earning.release_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : null;
          toast(
            "Proof filed, receipt issued",
            release
              ? `$${Number(res.earning.amount).toFixed(2)} clears the hold on ${release}.`
              : "The receipt is on file.",
            "success"
          );
        }
        return res;
      }),
    requestSellerPayout: () =>
      run(async () => {
        const res = await api.sellerPayout();
        toast(
          "Payout requested",
          `${res?.payout?.ref || "The payout"} is recorded. Confirm receipt once the money lands.`,
          "success"
        );
        return res;
      }),
    confirmSellerPayout: (id: string) =>
      run(async () => {
        const res = await api.sellerPayoutReceived(id);
        toast("Payout confirmed", "The ledger now shows it as paid.", "success");
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
    deleteAccount: false,
    escrowFor: null,
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
    // PayPal appends ?token=<order>&PayerID=<payer> to our return URL, so the
    // capture has to happen here. Drop the query first: the capture is
    // idempotent, but a refresh should not re-post it.
    const { page, params } = readLocation();
    if (page !== "obligations") return;
    const outcome = params.get("paypal");
    if (!outcome) return;
    window.history.replaceState(null, "", "/obligations");

    if (outcome === "cancel") {
      toast("Payment cancelled", "PayPal didn't take anything. The obligation is still open.", "warn");
      return;
    }
    const token = params.get("token");
    if (outcome === "return" && token) {
      actions.capturePaypal(token);
      return;
    }
    toast("No order to capture", "PayPal came back without an order id.", "warn");
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
