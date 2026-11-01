import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../store";
import { api } from "../lib/api";
import { Icon } from "../components/Icon";
import { EmptyState, Field, Modal, Pill, Segmented } from "../components/ui";
import { moneyExact, timeAgo } from "../lib/format";
import { extractPdfText } from "../lib/pdfText";
import type { Escrow, Obligation, ProofReceipt } from "../types";

const shortHash = (value?: string | null, head = 10, tail = 6) =>
  value ? `${value.slice(0, head)}…${value.slice(-tail)}` : "";

const receiptStatusLabel: Record<string, string> = {
  filed: "Filed",
  verified: "Verified",
  rejected: "Rejected",
  settled: "Settled",
};

const escrowStatusLabel: Record<string, string> = {
  draft: "Draft",
  hold_pending: "Hold pending",
  authorized: "Authorized",
  captured_awaiting_payout: "Captured · payout failed",
  released: "Released",
  voided: "Voided",
};

const receiptIcon = (status: string) =>
  status === "settled"
    ? "checkCircle"
    : status === "verified"
      ? "shield"
      : status === "rejected"
        ? "x"
        : "receipt";

type ReceiptDraft = {
  obligation_id: string;
  proof: string;
  evidence: string;
  data?: string;
  mime?: string;
};

const MAX_INLINE_CHARS = 850_000;

const toBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

// Screenshots go to the auditor as images, so shrink them until the request
// fits inside the server's body limit instead of rejecting the upload.
const encodeImage = async (file: File) => {
  if (file.size > 12_000_000) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let url = canvas.toDataURL("image/jpeg", 0.82);
    if (url.length > MAX_INLINE_CHARS) url = canvas.toDataURL("image/jpeg", 0.6);
    if (url.length > MAX_INLINE_CHARS) return null;
    return { data: url.split(",")[1] || "", mime: "image/jpeg" };
  } catch {
    return null;
  }
};

type EscrowDraft = {
  obligation_id: string;
  provider_id: string;
  payee: string;
  amount: string;
  note: string;
};

export default function Trust() {
  const { state, actions, toast, nowMs, refresh, overlays, setOverlays } = useApp();
  const [receiptFilter, setReceiptFilter] = useState("all");
  const [receiptModal, setReceiptModal] = useState(false);
  const [escrowModal, setEscrowModal] = useState(false);
  const [auditing, setAuditing] = useState<ProofReceipt | null>(null);
  const [inspecting, setInspecting] = useState<ProofReceipt | null>(null);
  const [releasing, setReleasing] = useState<Escrow | null>(null);
  const [voiding, setVoiding] = useState<Escrow | null>(null);
  const [busy, setBusy] = useState("");
  const [auditText, setAuditText] = useState("");
  const [releaseArtifact, setReleaseArtifact] = useState("");
  const [releaseReceiptId, setReleaseReceiptId] = useState("");
  const [signatureCheck, setSignatureCheck] = useState<"" | "valid" | "invalid">("");
  const [readingProof, setReadingProof] = useState(false);
  const proofFileRef = useRef<HTMLInputElement>(null);

  const rail = state?.trust?.rail;
  const stats = state?.trust?.stats;
  const guardrails = state?.trust?.guardrails;
  const feePercent = rail?.fee_percent ?? 10;

  const receipts = useMemo(
    () =>
      [...(state?.receipts || [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [state?.receipts]
  );
  const escrows = useMemo(
    () =>
      [...(state?.escrows || [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [state?.escrows]
  );
  const payments = useMemo(
    () =>
      [...(state?.payments || [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [state?.payments]
  );
  const obligations = useMemo(
    () =>
      [...(state?.obligations || [])].sort(
        (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
      ),
    [state?.obligations]
  );
  const escrowCandidates = useMemo(
    () =>
      [...obligations].sort((a, b) => {
        const aBooked = a.marketplace?.status === "booked" ? 1 : 0;
        const bBooked = b.marketplace?.status === "booked" ? 1 : 0;
        return bBooked - aBooked;
      }),
    [obligations]
  );

  const filteredReceipts = useMemo(
    () => (receiptFilter === "all" ? receipts : receipts.filter((r) => r.status === receiptFilter)),
    [receipts, receiptFilter]
  );

  const [receiptDraft, setReceiptDraft] = useState<ReceiptDraft>({
    obligation_id: "",
    proof: "",
    evidence: "",
  });

  const [escrowDraft, setEscrowDraft] = useState<EscrowDraft>({
    obligation_id: "",
    provider_id: "",
    payee: "",
    amount: "",
    note: "",
  });

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("escrow");
    if (!result) return;
    if (result === "authorized") {
      toast("Hold authorized", "The payer approved. Release once a verified proof is on file.", "success");
    } else if (result === "cancelled") {
      toast("Hold cancelled", "Nothing was reserved.", "default");
    } else {
      toast("Hold didn't complete", result.replace(/_/g, " "), "warn");
    }
    window.history.replaceState({}, "", "/trust");
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast("Copied", label, "success");
    } catch {
      toast("Clipboard blocked", "Select the value and copy it manually.", "warn");
    }
  };

  const splitOf = (amount: number, percent: number) => {
    const cents = Math.round(Number(amount || 0) * 100);
    const fee = Math.round((cents * percent) / 100);
    return { gross: cents / 100, fee: fee / 100, net: (cents - fee) / 100 };
  };

  const openReceiptModal = () => {
    const first = obligations.find((o) => o.last_proof) || obligations[0];
    setReceiptDraft({
      obligation_id: first?.id || "",
      proof: first?.last_proof || first?.proof_required || "",
      evidence: "",
    });
    setReceiptModal(true);
  };

  const selectReceiptObligation = (id: string) => {
    const ob = obligations.find((o) => o.id === id);
    setReceiptDraft((draft) => ({
      ...draft,
      obligation_id: id,
      proof: ob?.last_proof || ob?.proof_required || draft.proof,
    }));
  };

  const providerFor = (ob: Obligation | undefined) =>
    state?.providers.find((p) => p.id === ob?.marketplace?.provider_id)
    || state?.providers.find((p) => p.name.toLowerCase() === String(ob?.provider || "").toLowerCase());

  const openEscrowModal = (obligationId?: string) => {
    const first = (obligationId && obligations.find((o) => o.id === obligationId)) || escrowCandidates[0];
    const provider = providerFor(first);
    setEscrowDraft({
      obligation_id: first?.id || "",
      provider_id: provider?.id || "",
      payee: provider?.paypal_email || first?.payee_paypal_email || first?.marketplace?.payee_paypal_email || "",
      amount: String(first?.amount || provider?.price || ""),
      note: "",
    });
    setEscrowModal(true);
  };

  useEffect(() => {
    if (!overlays.escrowFor) return;
    openEscrowModal(overlays.escrowFor);
    setOverlays((o) => ({ ...o, escrowFor: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlays.escrowFor]);

  const selectEscrowObligation = (id: string) => {
    const ob = obligations.find((o) => o.id === id);
    const provider = providerFor(ob);
    setEscrowDraft((draft) => ({
      ...draft,
      obligation_id: id,
      provider_id: provider?.id || draft.provider_id,
      payee: provider?.paypal_email || ob?.payee_paypal_email || ob?.marketplace?.payee_paypal_email || draft.payee,
      amount: String(ob?.amount || provider?.price || draft.amount || ""),
    }));
  };

  const selectEscrowProvider = (id: string) => {
    const provider = state?.providers.find((p) => p.id === id);
    setEscrowDraft((draft) => ({
      ...draft,
      provider_id: id,
      payee: provider?.paypal_email || draft.payee,
      amount: provider ? String(provider.price) : draft.amount,
    }));
  };

  const readProofFile = async (file: File) => {
    setReadingProof(true);
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isImage = file.type.startsWith("image/");

      if (!isPdf && !isImage) {
        const text = await file.text();
        if (!text.trim()) {
          toast("Nothing readable in that file", "The file is empty.", "warn");
          return;
        }
        setReceiptDraft((draft) => ({ ...draft, proof: file.name, evidence: text, data: undefined, mime: undefined }));
        toast("Proof attached", `${file.name} was read on this device.`, "success");
        return;
      }

      if (isPdf) {
        let text = "";
        try {
          text = (await extractPdfText(file)).text;
        } catch {
          text = "";
        }
        if (text.trim()) {
          setReceiptDraft((draft) => ({ ...draft, proof: file.name, evidence: text, data: undefined, mime: undefined }));
          toast("Proof attached", `${file.name} was read on this device.`, "success");
          return;
        }
      }

      // A photo or a scan has no text layer: hand the file itself to the auditor.
      const encoded = isPdf
        ? file.size <= 650_000
          ? { data: toBase64(await file.arrayBuffer()), mime: "application/pdf" }
          : null
        : await encodeImage(file);
      if (!encoded) {
        toast(
          "That file is too large to audit",
          isPdf ? "Use a PDF under 650 KB." : "Use a PNG or JPEG under 12 MB.",
          "warn"
        );
        return;
      }
      setReceiptDraft((draft) => ({ ...draft, proof: file.name, evidence: "", data: encoded.data, mime: encoded.mime }));
      toast("Proof attached", `${file.name} goes to the AI auditor as a document.`, "success");
    } catch {
      toast("Could not read that file", "Try a PNG or JPEG screenshot, or paste the evidence.", "warn");
    } finally {
      setReadingProof(false);
    }
  };

  const submitReceipt = async () => {
    if (!receiptDraft.obligation_id) return;
    setBusy("receipt");
    const evidence = receiptDraft.evidence.trim();
    const artifact =
      evidence || receiptDraft.data
        ? {
            name: receiptDraft.proof || "proof note",
            type: receiptDraft.data ? receiptDraft.mime || "application/octet-stream" : "text",
            text: evidence,
            ...(receiptDraft.data ? { data: receiptDraft.data, mime: receiptDraft.mime } : {}),
          }
        : undefined;
    const result = await actions.createReceipt({
      obligation_id: receiptDraft.obligation_id,
      proof: receiptDraft.proof,
      artifact,
      note: evidence,
    });
    setBusy("");
    if (result) {
      setReceiptModal(false);
      const receipt = (result as any).receipt as ProofReceipt | undefined;
      if (receipt) {
        setAuditText(evidence);
        setAuditing(receipt);
      }
    }
  };

  const submitEscrow = async () => {
    if (!escrowDraft.obligation_id || !escrowDraft.payee.trim()) return;
    setBusy("escrow");
    const result = await actions.createEscrow({
      obligation_id: escrowDraft.obligation_id,
      provider_id: escrowDraft.provider_id || undefined,
      payee_paypal_email: escrowDraft.payee.trim(),
      amount: Number(escrowDraft.amount || 0),
      note: escrowDraft.note,
    });
    setBusy("");
    if (result) setEscrowModal(false);
  };

  const submitAudit = async () => {
    if (!auditing) return;
    setBusy("audit");
    const evidence = auditText.trim();
    const result = await actions.auditReceipt(
      auditing.id,
      evidence ? { name: "evidence", type: "text", text: evidence } : undefined
    );
    setBusy("");
    if (result) {
      setSignatureCheck("");
      setInspecting((result as any).receipt || auditing);
      setAuditing(null);
    }
  };

  const openRelease = (escrow: Escrow) => {
    const latest = receipts.find((r) => r.obligation_id === escrow.obligation_id);
    setReleaseReceiptId(latest?.id || "");
    setReleaseArtifact("");
    setReleasing(escrow);
  };

  const submitRelease = async () => {
    if (!releasing) return;
    setBusy("release");
    const evidence = releaseArtifact.trim();
    const result = await actions.releaseEscrow(
      releasing.id,
      evidence
        ? { artifact: { name: "release evidence", type: "text", text: evidence } }
        : { proof_receipt_id: releaseReceiptId || undefined }
    );
    setBusy("");
    if (result?.ok) setReleasing(null);
  };

  const submitVoid = async () => {
    if (!voiding) return;
    setBusy("void");
    const result = await actions.voidEscrow(voiding.id);
    setBusy("");
    if (result) setVoiding(null);
  };

  const inspectReceipt = (receipt: ProofReceipt) => {
    setSignatureCheck("");
    setInspecting(receipt);
  };

  const checkSignature = async (receipt: ProofReceipt) => {
    setBusy("verify");
    try {
      const res = await api.verifyReceipt(receipt.id);
      setSignatureCheck(res.valid ? "valid" : "invalid");
      toast(
        res.valid ? "Signature valid" : "Signature mismatch",
        res.valid
          ? "The stored hash matches the HMAC Remindify signed."
          : "The stored hash no longer matches its signature.",
        res.valid ? "success" : "warn"
      );
    } catch (error: any) {
      toast("Couldn't verify", error.message, "warn");
    } finally {
      setBusy("");
    }
  };

  const copyEnv = () => {
    copy(
      [
        "# PayPal (sandbox by default)",
        "PAYPAL_CLIENT_ID=",
        "PAYPAL_CLIENT_SECRET=",
        "PAYPAL_ENV=sandbox",
        "PAYPAL_PLATFORM_FEE_PERCENT=10",
        "",
        "# Proof auditor",
        "GEMINI_API_KEY=",
        "AI_MODEL_ID=gemini-2.5-flash",
        "AUDIT_MIN_CONFIDENCE=0.8",
        "",
        "# Public origin for PayPal return URLs",
        "PUBLIC_ORIGIN=",
      ].join("\n"),
      "Environment template"
    );
  };

  if (!state) return null;

  const draftSplit = splitOf(Number(escrowDraft.amount || 0), feePercent);

  return (
    <div className="trust-view">
      <section className="trust-hero">
        <div className="trust-hero-copy">
          <span className="eyebrow light">PayPal rail · sandbox-first · no token</span>
          <h2>Proof before <em>the money moves.</em></h2>
          <p>
            Every completion files a receipt signed by Remindify. An AI auditor checks the evidence
            against the obligation. Only a verified proof lets PayPal capture the hold and pay the
            provider.
          </p>
          <div className="trust-hero-meta">
            <span><Icon name="fingerprint" size={13} /> HMAC-signed receipts</span>
            <span><Icon name="sparkle" size={13} /> AI proof auditor</span>
            <span><Icon name="lock" size={13} /> No custody</span>
            <span><Icon name="shield" size={13} /> PayPal holds the funds</span>
          </div>
        </div>
        <div className="trust-hero-stat">
          <strong>{stats?.settled ?? 0}</strong>
          <span>settled receipts</span>
          <em>
            {stats?.verified ?? 0} verified · {stats?.filed ?? 0} filed · {stats?.rejected ?? 0} rejected
          </em>
          <div className="trust-hero-money">
            {moneyExact(stats?.fees_collected || 0)} <span>platform fees</span>
          </div>
        </div>
      </section>

      <div className="trust-network-grid">
        <RailCard
          tone="blue"
          label="PayPal"
          role="Money rail"
          pill={rail?.configured ? rail.mode : "not configured"}
          tone2={rail?.configured ? "teal" : "amber"}
          description="Authorization holds reserve the payer's funds without moving them. Capture and payouts settle inside PayPal."
          facts={[
            ["Mode", rail?.mode || "sandbox"],
            ["Hold window", `${rail?.hold_days ?? 29} days`],
            ["Platform fee", `${feePercent}%`],
          ]}
          guard="No card numbers touch Remindify."
        />
        <RailCard
          tone="violet"
          label="Gemini auditor"
          role="Settlement gate"
          pill={rail?.auditor_configured ? "live" : "deterministic"}
          tone2={rail?.auditor_configured ? "teal" : "ink"}
          description="Reads the artifact and scores it against the obligation amount, reference and date before any capture."
          facts={[
            ["Model", rail?.auditor || "gemini-2.5-flash"],
            ["Threshold", `${rail?.threshold ?? 80}%`],
            ["Fallback", "Offline rules"],
          ]}
          guard="A rejected artifact leaves the hold in place."
        />
        <RailCard
          tone="teal"
          label="Provider payout"
          role="Settlement"
          pill="net of fee"
          tone2="ink"
          description="On a verified proof the hold is captured, the fee is deducted and the balance goes to the provider's PayPal email."
          facts={[
            ["Split", `${100 - feePercent} / ${feePercent}`],
            ["Recipient", "PayPal email"],
            ["Trigger", "Verified proof"],
          ]}
          guard="Each payout keeps its PayPal batch id."
        />
      </div>

      <div className="trust-layout">
        <div className="trust-main">
          <section className="panel trust-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Proof receipts</span>
                <h3>One hash per handoff</h3>
                <p className="trust-panel-sub">
                  The artifact stays with the receipt, hashed and signed by Remindify. The auditor
                  reads it before PayPal moves a cent.
                </p>
              </div>
              <button className="btn btn-sm btn-ink" onClick={openReceiptModal}>
                <Icon name="plus" size={14} /> New receipt
              </button>
            </div>

            <div className="trust-filter-row">
              <Segmented
                size="sm"
                value={receiptFilter}
                onChange={setReceiptFilter}
                options={[
                  { value: "all", label: `All ${stats?.receipts ?? receipts.length}` },
                  { value: "filed", label: `Filed ${stats?.filed ?? 0}` },
                  { value: "verified", label: `Verified ${stats?.verified ?? 0}` },
                  { value: "rejected", label: `Rejected ${stats?.rejected ?? 0}` },
                  { value: "settled", label: `Settled ${stats?.settled ?? 0}` },
                ]}
              />
              <span className="trust-filter-note">The auditor runs before money moves.</span>
            </div>

            {filteredReceipts.length ? (
              <div className="receipt-list">
                {filteredReceipts.map((receipt) => (
                  <article className="receipt-row" key={receipt.id}>
                    <span className={`receipt-icon status-${receipt.status}`}>
                      <Icon name={receiptIcon(receipt.status)} size={16} />
                    </span>
                    <div className="receipt-main">
                      <div className="receipt-title">
                        <strong>{receipt.obligation_title}</strong>
                        {receipt.demo && <Pill tone="amber">sample</Pill>}
                        <span className={`trust-status ${receipt.status}`}>
                          {receiptStatusLabel[receipt.status]}
                        </span>
                      </div>
                      <div className="receipt-meta">
                        <span>{receipt.proof_label}</span>
                        <i />
                        <span>{receipt.actor || receipt.agent_name || "Owner"}</span>
                        <i />
                        <span>{timeAgo(receipt.created_at, nowMs)}</span>
                        {receipt.audit && (
                          <>
                            <i />
                            <span>{Math.round((receipt.audit.confidence || 0) * 100)}% · {receipt.audit.engine}</span>
                          </>
                        )}
                      </div>
                      <div className="receipt-hash">
                        <code title={receipt.proof_hash}>{receipt.short_hash}</code>
                        <span>
                          {receipt.signature ? `signature ${receipt.short_signature}` : "unsigned"}
                        </span>
                      </div>
                    </div>
                    <div className="receipt-actions">
                      {(receipt.status === "filed" || receipt.status === "rejected") && (
                        <button
                          className="btn btn-xs btn-ink"
                          onClick={() => {
                            setAuditText(receipt.artifact?.text || "");
                            setAuditing(receipt);
                          }}
                        >
                          Audit
                        </button>
                      )}
                      <button className="btn btn-xs btn-ghost" onClick={() => inspectReceipt(receipt)}>
                        Inspect
                      </button>
                      <button
                        className="tiny-icon"
                        title="Copy proof hash"
                        onClick={() => copy(receipt.proof_hash, "Proof hash")}
                      >
                        <Icon name="copy" size={13} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="receipt"
                title={receipts.length ? "Nothing in this state" : "No receipts yet"}
                detail={
                  receipts.length
                    ? "Switch the filter, or file a new receipt from any obligation."
                    : "File a receipt from an obligation, paste the evidence, and let the auditor verify it."
                }
                action={<button className="btn btn-sm btn-ink" onClick={openReceiptModal}><Icon name="plus" size={14} /> File a receipt</button>}
              />
            )}
          </section>

          <section className="panel trust-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Money rail</span>
                <h3>PayPal ledger</h3>
                <p className="trust-panel-sub">
                  Every order, capture and payout this workspace has sent, with the PayPal reference that proves it.
                  {" "}
                  {rail?.mode === "sandbox" ? "Sandbox credentials — no real money moves." : "Live credentials."}
                </p>
              </div>
              <Pill tone={rail?.configured ? "teal" : "amber"}>
                {rail?.configured ? rail.mode : "not configured"}
              </Pill>
            </div>

            {payments.length ? (
              <div className="escrow-list">
                {payments.map((payment) => (
                  <article className="escrow-row" key={payment.id}>
                    <span className={`escrow-icon status-${payment.status}`}>
                      <Icon name={payment.kind === "payout" ? "arrowUpRight" : "wallet"} size={16} />
                    </span>
                    <div className="escrow-main">
                      <div className="escrow-title">
                        <strong>
                          {payment.kind === "payout"
                            ? `Payout · ${payment.payout_ref || payment.payout_id || "seller earnings"}`
                            : payment.obligation_title || "Obligation payment"}
                        </strong>
                        <span className={`trust-status ${payment.status}`}>{payment.status}</span>
                      </div>
                      <div className="escrow-meta">
                        <span>{moneyExact(payment.amount)} {payment.currency}</span>
                        <i />
                        <span>
                          {payment.kind === "payout"
                            ? `to ${payment.receiver || "payout account"}`
                            : payment.payer_email
                              ? `from ${payment.payer_email}`
                              : payment.status === "created"
                                ? "awaiting payer"
                                : "no payer"}
                        </span>
                        <i />
                        <span>
                          {payment.order_id
                            ? `order ${shortHash(payment.order_id)}`
                            : payment.batch_id
                              ? `batch ${shortHash(payment.batch_id)}`
                              : "no PayPal id yet"}
                        </span>
                        {payment.failure_code && (
                          <>
                            <i />
                            <span className="trust-code">{payment.failure_code.replace(/_/g, " ").toLowerCase()}</span>
                          </>
                        )}
                      </div>
                      {payment.failure_reason && <em>{payment.failure_reason}</em>}
                    </div>
                    <div className="escrow-actions">
                      <span className="drawer-event-time">{timeAgo(payment.updated_at || payment.created_at, nowMs)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="wallet"
                title="No PayPal activity yet"
                detail="Pay an obligation from its drawer, or send an earnings payout from the seller desk. Each step lands here with its PayPal reference."
              />
            )}
            <div className="trust-inline-note">
              <Icon name="info" size={12} />
              PayPal moves the money. Remindify never holds a balance or a card.
            </div>
          </section>

          <section className="panel trust-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Escrow</span>
                <h3>Capture only on verified proof</h3>
                <p className="trust-panel-sub">
                  The payer approves a {rail?.hold_days ?? 29}-day hold. A verified proof captures it
                  and pays the provider {100 - feePercent}% — Remindify keeps {feePercent}%.
                </p>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => openEscrowModal()}>
                <Icon name="plus" size={14} /> New escrow
              </button>
            </div>

            {escrows.length ? (
              <div className="escrow-list">
                {escrows.map((escrow) => (
                  <article className="escrow-row" key={escrow.id}>
                    <span className={`escrow-icon status-${escrow.status}`}>
                      <Icon name={escrow.status === "released" ? "checkCircle" : escrow.status === "voided" ? "x" : "lock"} size={16} />
                    </span>
                    <div className="escrow-main">
                      <div className="escrow-title">
                        <strong>{escrow.obligation_title}</strong>
                        <span className={`trust-status ${escrow.status}`}>{escrowStatusLabel[escrow.status]}</span>
                        <span className="escrow-chain">{escrow.payee_paypal_email}</span>
                      </div>
                      <div className="escrow-meta">
                        <span>{escrow.provider_name || "Unassigned provider"}</span>
                        <i />
                        <span>{moneyExact(escrow.amount)} held</span>
                        <i />
                        <span>fee {moneyExact(escrow.platform_fee)} · net {moneyExact(escrow.net_payout)}</span>
                      </div>
                      {escrow.note && <em>{escrow.note}</em>}
                      {escrow.failure_reason && <em>{escrow.failure_code}: {escrow.failure_reason}</em>}
                      <div className="escrow-track"><span className={escrow.status} /></div>
                      {escrow.status === "released" && escrow.released_at && (
                        <div className="escrow-release-note">
                          <Icon name="checkCircle" size={11} />
                          Paid {moneyExact(escrow.net_payout)} · capture {shortHash(escrow.capture_id, 8, 4)} · batch {shortHash(escrow.payout_batch_id, 8, 4)} · {timeAgo(escrow.released_at, nowMs)}
                        </div>
                      )}
                      {escrow.status === "hold_pending" && (
                        <div className="escrow-release-note">
                          <Icon name="clock" size={11} />
                          Waiting for the payer to approve order {shortHash(escrow.paypal_order_id, 8, 4)}.
                        </div>
                      )}
                      {escrow.status === "authorized" && escrow.hold_expires_in_days !== null && (
                        <div className="escrow-release-note">
                          <Icon name="clock" size={11} />
                          Hold authorized · expires in {escrow.hold_expires_in_days} day{escrow.hold_expires_in_days === 1 ? "" : "s"}.
                        </div>
                      )}
                    </div>
                    <div className="escrow-actions">
                      {escrow.status === "draft" && (
                        <button
                          className="btn btn-xs btn-ink"
                          onClick={() => actions.holdEscrow(escrow.id)}
                        >
                          Place hold
                        </button>
                      )}
                      {escrow.status === "hold_pending" && escrow.approve_url && (
                        <a className="btn btn-xs btn-ink" href={escrow.approve_url} target="_blank" rel="noreferrer">
                          Approve <Icon name="external" size={11} />
                        </a>
                      )}
                      {(escrow.status === "authorized" || escrow.status === "captured_awaiting_payout") && (
                        <button className="btn btn-xs btn-ink" onClick={() => openRelease(escrow)}>
                          {escrow.status === "authorized" ? "Release" : "Retry payout"}
                        </button>
                      )}
                      {(escrow.status === "draft" || escrow.status === "hold_pending" || escrow.status === "authorized") && (
                        <button className="btn btn-xs btn-ghost" onClick={() => setVoiding(escrow)}>
                          Void
                        </button>
                      )}
                      {escrow.status === "released" && <Pill tone="teal">released</Pill>}
                      {escrow.status === "voided" && <Pill tone="ink">voided</Pill>}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="lock"
                title="No escrows yet"
                detail="Open an escrow against an obligation, place the PayPal hold, and release it once the auditor verifies the proof."
                action={<button className="btn btn-sm btn-ghost" onClick={() => openEscrowModal()}><Icon name="plus" size={14} /> Open an escrow</button>}
              />
            )}
            <div className="trust-inline-note">
              <Icon name="info" size={12} />
              {guardrails?.note || "A hold is captured only after the proof auditor verifies the artifact."}
            </div>
          </section>
        </div>

        <aside className="trust-side">
          <section className="panel trust-side-panel">
            <span className="eyebrow">The path</span>
            <h3>Proof gates the capture.</h3>
            <div className="trust-steps">
              <Step index="01" title="File" detail="Completion files a receipt bound to the obligation and the evidence hash." />
              <Step index="02" title="Hold" detail="PayPal reserves the payer's funds for 29 days. Nothing moves yet." />
              <Step index="03" title="Audit" detail="Gemini scores the artifact against amount, reference and date." />
              <Step index="04" title="Settle" detail="A verified proof captures the hold and pays the provider net of fee." />
            </div>
          </section>

          <section className="panel trust-side-panel guardrail-panel">
            <span className="eyebrow">Guardrails</span>
            <h3>What this deliberately is not</h3>
            <ul className="trust-guard-list">
              <li><Icon name="x" size={12} /><span><strong>No token.</strong> Money moves in USD through PayPal.</span></li>
              <li><Icon name="check" size={12} /><span><strong>No custody.</strong> Remindify never holds a balance or a card.</span></li>
              <li><Icon name="check" size={12} /><span><strong>No proof, no money.</strong> A rejected artifact leaves the hold untouched.</span></li>
              <li><Icon name="eye" size={12} /><span><strong>No black box.</strong> Every verdict keeps its confidence and discrepancies.</span></li>
            </ul>
          </section>

          <section className="panel trust-side-panel">
            <span className="eyebrow">Configuration</span>
            <h3>Two credentials, one gate.</h3>
            <p className="trust-side-copy">
              PayPal moves the funds. Gemini reads the evidence. Without a Gemini key the auditor
              falls back to deterministic scoring so the demo still runs.
            </p>
            <div className="trust-env-list">
              <div className="trust-env">
                <div>
                  <strong>PayPal</strong>
                  <span>{rail?.configured ? rail.mode : "not configured"}</span>
                </div>
                <code>PAYPAL_CLIENT_ID</code>
                <code>PAYPAL_PLATFORM_FEE_PERCENT={feePercent}</code>
              </div>
              <div className="trust-env">
                <div>
                  <strong>Auditor</strong>
                  <span>{rail?.auditor_configured ? "keyed" : "fallback"}</span>
                </div>
                <code>GEMINI_API_KEY</code>
                <code>AI_MODEL_ID={rail?.auditor || "gemini-2.5-flash"}</code>
              </div>
            </div>
            <button className="btn btn-sm btn-ghost trust-copy-env" onClick={copyEnv}>
              <Icon name="copy" size={13} /> Copy env template
            </button>
            <p className="trust-side-foot">
              Payouts settle to the provider's PayPal email after capture.
            </p>
          </section>
        </aside>
      </div>

      {receiptModal && (
        <Modal
          title="File a proof receipt"
          eyebrow="Signed by Remindify"
          width={600}
          onClose={() => setReceiptModal(false)}
          footer={
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => setReceiptModal(false)}>Cancel</button>
              <button className="btn btn-sm btn-ink" onClick={submitReceipt} disabled={busy === "receipt" || !receiptDraft.obligation_id}>
                {busy === "receipt" ? "Filing…" : "File receipt"}
              </button>
            </>
          }
        >
          <div className="trust-form">
            <Field label="Obligation" hint="What was completed">
              <select value={receiptDraft.obligation_id} onChange={(e) => selectReceiptObligation(e.target.value)}>
                {obligations.map((ob) => (
                  <option key={ob.id} value={ob.id}>{ob.title}</option>
                ))}
              </select>
            </Field>
            <Field label="Proof label" hint="What's on file">
              <input
                value={receiptDraft.proof}
                onChange={(e) => setReceiptDraft({ ...receiptDraft, proof: e.target.value })}
                placeholder="receipt.pdf, confirmation ID, or a short description"
              />
            </Field>
            <Field label="Evidence" hint="Attach the receipt, a screenshot of the confirmation, or paste the text the auditor should read">
              <div className="proof-upload">
                <button
                  className="btn btn-xs btn-ghost"
                  type="button"
                  onClick={() => proofFileRef.current?.click()}
                  disabled={readingProof}
                >
                  <Icon name="file" size={12} /> {readingProof ? "Reading…" : "Attach PDF, image or text"}
                </button>
                <span>
                  {receiptDraft.proof || "No document attached"}
                  {receiptDraft.data ? ` · sent as ${receiptDraft.mime}` : ""}
                </span>
              </div>
              <textarea
                rows={5}
                value={receiptDraft.evidence}
                onChange={(e) => setReceiptDraft({ ...receiptDraft, evidence: e.target.value })}
                placeholder={"Paid $180.00 to Exopya Studio on 2026-10-28.\nConfirmation: 7XK2-91AB\nRenewal for the studio domain."}
              />
            </Field>
            <input
              ref={proofFileRef}
              type="file"
              hidden
              accept=".pdf,text/plain,.txt,.md,image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readProofFile(file);
                e.target.value = "";
              }}
            />
            <div className="trust-preview-box">
              <Icon name="fingerprint" size={16} />
              <div>
                <strong>What gets stored</strong>
                <span>The obligation id, a SHA-256 hash of the evidence, the actor and the completion time — all signed with an HMAC. The evidence text or document stays with the receipt so the auditor can judge it.</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {auditing && (
        <Modal
          title="Run the proof auditor"
          eyebrow={`${auditing.obligation_title} · threshold ${rail?.threshold ?? 80}%`}
          width={600}
          onClose={() => setAuditing(null)}
          footer={
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => setAuditing(null)}>Cancel</button>
              <button className="btn btn-sm btn-ink" onClick={submitAudit} disabled={busy === "audit"}>
                <Icon name="sparkle" size={13} /> {busy === "audit" ? "Auditing…" : "Audit evidence"}
              </button>
            </>
          }
        >
          <div className="trust-form">
            <div className="trust-sign-summary">
              <div>
                <span>Obligation</span>
                <strong>{auditing.obligation_title}</strong>
              </div>
              <div>
                <span>Expected amount</span>
                <strong>{moneyExact(auditing.obligation_amount || 0)}</strong>
              </div>
              <div>
                <span>Proof</span>
                <strong>{auditing.proof_label}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong className="capitalize">{receiptStatusLabel[auditing.status]}</strong>
              </div>
            </div>
            <Field label="Evidence to audit" hint="Leave blank to audit the filed artifact, or paste text to replace it">
              <textarea
                rows={6}
                value={auditText}
                onChange={(e) => setAuditText(e.target.value)}
                placeholder="The confirmation, invoice or note the provider submitted."
              />
            </Field>
            <div className="trust-preview-box">
              <Icon name="sparkle" size={16} />
              <div>
                <strong>{rail?.auditor_configured ? `${rail?.auditor} reads the evidence` : "Deterministic fallback"}</strong>
                <span>
                  {rail?.auditor_configured
                    ? "The model checks the amount, reference, date and scope, then returns a confidence score and any discrepancies."
                    : "No Gemini key is set, so offline rules score the amount, reference, date and keywords."}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {inspecting && (
        <Modal
          title="Receipt detail"
          eyebrow={`${receiptStatusLabel[inspecting.status]} · ${inspecting.short_hash}`}
          width={620}
          onClose={() => setInspecting(null)}
          footer={
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => copy(inspecting.proof_hash, "Proof hash")}>
                <Icon name="copy" size={13} /> Copy hash
              </button>
              <button
                className="btn btn-sm btn-ink"
                onClick={() => checkSignature(inspecting)}
                disabled={busy === "verify"}
              >
                <Icon name="shield" size={13} /> {busy === "verify" ? "Checking…" : "Verify signature"}
              </button>
            </>
          }
        >
          <div className="trust-form">
            <div className="trust-sign-summary">
              <div>
                <span>Obligation</span>
                <strong>{inspecting.obligation_title}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong className="capitalize">{receiptStatusLabel[inspecting.status]}</strong>
              </div>
              <div>
                <span>Actor</span>
                <strong>{inspecting.actor || inspecting.agent_name || "Owner"}</strong>
              </div>
              <div>
                <span>Filed</span>
                <strong>{timeAgo(inspecting.created_at, nowMs)}</strong>
              </div>
            </div>

            {inspecting.audit ? (
              <div className={`trust-preview-box ${inspecting.audit.verified ? "" : "trust-preview-warn"}`}>
                <Icon name={inspecting.audit.verified ? "checkCircle" : "x"} size={16} />
                <div>
                  <strong>
                    {inspecting.audit.verified ? "Verified" : "Rejected"} · {Math.round((inspecting.audit.confidence || 0) * 100)}% confidence · {inspecting.audit.engine}
                  </strong>
                  <span>{inspecting.audit.matching_verdict || "No verdict text."}</span>
                  {!!inspecting.audit.discrepancies?.length && (
                    <span>{inspecting.audit.discrepancies.join(" · ")}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="trust-preview-box trust-preview-warn">
                <Icon name="alert" size={16} />
                <div>
                  <strong>Not audited yet</strong>
                  <span>Run the auditor before this receipt can settle an escrow.</span>
                </div>
              </div>
            )}

            {inspecting.settlement && (
              <div className="trust-release-proof">
                <span className="receipt-icon status-settled"><Icon name="checkCircle" size={18} /></span>
                <div>
                  <strong>{moneyExact(inspecting.settlement.net)} paid to {inspecting.settlement.recipient}</strong>
                  <span>
                    gross {moneyExact(inspecting.settlement.gross)} · fee {moneyExact(inspecting.settlement.fee)} · batch {shortHash(inspecting.settlement.payout_batch_id, 8, 4)}
                  </span>
                </div>
                <Pill tone="teal">settled</Pill>
              </div>
            )}

            <div className="trust-digest">
              <span>Proof hash</span>
              <code>{inspecting.proof_hash}</code>
              <button className="tiny-icon" onClick={() => copy(inspecting.proof_hash, "Proof hash")}><Icon name="copy" size={13} /></button>
            </div>
            <div className="trust-digest">
              <span>Signature</span>
              <code>{inspecting.signature || "none"}</code>
              {signatureCheck !== "" && (
                <Pill tone={signatureCheck === "valid" ? "teal" : "coral"}>
                  {signatureCheck === "valid" ? "valid" : "mismatch"}
                </Pill>
              )}
            </div>

            {inspecting.artifact?.text && (
              <details className="trust-raw">
                <summary>View the evidence the auditor read</summary>
                <pre>{inspecting.artifact.text}</pre>
              </details>
            )}
          </div>
        </Modal>
      )}

      {escrowModal && (
        <Modal
          title="Open an escrow"
          eyebrow="PayPal hold · release on verified proof"
          width={600}
          onClose={() => setEscrowModal(false)}
          footer={
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => setEscrowModal(false)}>Cancel</button>
              <button
                className="btn btn-sm btn-ink"
                onClick={submitEscrow}
                disabled={busy === "escrow" || !escrowDraft.obligation_id || !escrowDraft.payee.trim()}
              >
                {busy === "escrow" ? "Opening…" : "Open escrow"}
              </button>
            </>
          }
        >
          <div className="trust-form">
            <Field label="Obligation" hint="The job being protected">
              <select value={escrowDraft.obligation_id} onChange={(e) => selectEscrowObligation(e.target.value)}>
                {escrowCandidates.map((ob) => (
                  <option key={ob.id} value={ob.id}>
                    {ob.marketplace?.provider_name ? `${ob.title} · ${ob.marketplace.provider_name}` : ob.title}
                  </option>
                ))}
              </select>
            </Field>
            <div className="trust-form-row">
              <Field label="Provider" hint="Who gets paid">
                <select value={escrowDraft.provider_id} onChange={(e) => selectEscrowProvider(e.target.value)}>
                  <option value="">Unassigned</option>
                  {state.providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.name} · {provider.specialty}</option>
                  ))}
                </select>
              </Field>
              <Field label="Amount" hint="USD">
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={escrowDraft.amount}
                  onChange={(e) => setEscrowDraft({ ...escrowDraft, amount: e.target.value })}
                  placeholder="180"
                />
              </Field>
            </div>
            <Field label="Provider PayPal email" hint="Where the payout lands">
              <input
                value={escrowDraft.payee}
                onChange={(e) => setEscrowDraft({ ...escrowDraft, payee: e.target.value })}
                placeholder="provider@business.example.com"
              />
            </Field>
            <Field label="Note" hint="Visible in the escrow">
              <textarea
                rows={2}
                value={escrowDraft.note}
                onChange={(e) => setEscrowDraft({ ...escrowDraft, note: e.target.value })}
                placeholder="Scope, milestone or release condition."
              />
            </Field>
            <div className="trust-sign-summary">
              <div>
                <span>Payer approves</span>
                <strong>{moneyExact(draftSplit.gross)}</strong>
              </div>
              <div>
                <span>Remindify fee ({feePercent}%)</span>
                <strong>{moneyExact(draftSplit.fee)}</strong>
              </div>
              <div>
                <span>Provider receives</span>
                <strong>{moneyExact(draftSplit.net)}</strong>
              </div>
              <div>
                <span>Hold window</span>
                <strong>{rail?.hold_days ?? 29} days</strong>
              </div>
            </div>
            <div className="trust-preview-box">
              <Icon name="lock" size={16} />
              <div>
                <strong>Nothing moves until a verified proof</strong>
                <span>The payer approves the hold on PayPal. Remindify captures it only after the auditor verifies the evidence, then pays the provider's email.</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {releasing && (
        <Modal
          title={releasing.status === "captured_awaiting_payout" ? "Retry the payout" : "Release escrow on proof"}
          eyebrow={`${releasing.provider_name || "Provider"} · ${moneyExact(releasing.amount)} held`}
          width={580}
          onClose={() => setReleasing(null)}
          footer={
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => setReleasing(null)}>Cancel</button>
              <button
                className="btn btn-sm btn-ink"
                onClick={submitRelease}
                disabled={busy === "release" || (!releaseReceiptId && !releaseArtifact.trim())}
              >
                {busy === "release"
                  ? "Releasing…"
                  : releasing.status === "captured_awaiting_payout"
                    ? "Retry payout"
                    : "Capture and pay"}
              </button>
            </>
          }
        >
          <div className="trust-form">
            <div className="trust-sign-summary">
              <div>
                <span>Captured</span>
                <strong>{moneyExact(releasing.amount)}</strong>
              </div>
              <div>
                <span>Fee</span>
                <strong>{moneyExact(releasing.platform_fee)}</strong>
              </div>
              <div>
                <span>Provider receives</span>
                <strong>{moneyExact(releasing.net_payout)}</strong>
              </div>
              <div>
                <span>PayPal email</span>
                <strong>{releasing.payee_paypal_email}</strong>
              </div>
            </div>

            {releasing.status === "authorized" && (
              <>
                <Field label="Proof receipt" hint="The latest receipt for this obligation">
                  <select value={releaseReceiptId} onChange={(e) => setReleaseReceiptId(e.target.value)}>
                    {receipts.filter((r) => r.obligation_id === releasing.obligation_id).length ? (
                      receipts
                        .filter((r) => r.obligation_id === releasing.obligation_id)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {receiptStatusLabel[r.status]} · {r.proof_label} · {timeAgo(r.created_at, nowMs)}
                          </option>
                        ))
                    ) : (
                      <option value="">No receipt on file — paste evidence below</option>
                    )}
                  </select>
                </Field>
                <Field label="Or paste new evidence" hint="Files a receipt and audits it in one step">
                  <textarea
                    rows={4}
                    value={releaseArtifact}
                    onChange={(e) => setReleaseArtifact(e.target.value)}
                    placeholder="Paid $180.00 to Exopya Studio on 2026-10-28. Confirmation: 7XK2-91AB."
                  />
                </Field>
              </>
            )}

            <div className="trust-preview-box trust-preview-warn">
              <Icon name="shield" size={16} />
              <div>
                <strong>If the receipt isn't verified, the auditor runs now</strong>
                <span>A rejected artifact leaves the payer's hold untouched. Only a verified proof captures the money.</span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {voiding && (
        <Modal
          title="Void the hold?"
          eyebrow={`${voiding.provider_name || "Provider"} · ${moneyExact(voiding.amount)}`}
          width={520}
          onClose={() => setVoiding(null)}
          footer={
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => setVoiding(null)}>Keep the hold</button>
              <button className="btn btn-sm btn-ink" onClick={submitVoid} disabled={busy === "void"}>
                {busy === "void" ? "Voiding…" : "Void hold"}
              </button>
            </>
          }
        >
          <div className="trust-form">
            <div className="trust-preview-box trust-preview-warn">
              <Icon name="alert" size={16} />
              <div>
                <strong>{moneyExact(voiding.amount)} goes back to the payer</strong>
                <span>
                  {voiding.authorization_id
                    ? "PayPal releases the authorization immediately. The provider is not paid."
                    : "The escrow closes before any money was reserved."}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RailCard({
  tone,
  label,
  role,
  pill,
  tone2,
  description,
  facts,
  guard,
}: {
  tone: "blue" | "violet" | "amber" | "teal";
  label: string;
  role: string;
  pill: string;
  tone2: "teal" | "amber" | "ink" | "blue";
  description: string;
  facts: [string, string][];
  guard: string;
}) {
  return (
    <article className={`trust-network tone-${tone}`}>
      <div className="trust-network-top">
        <div>
          <strong>{label}</strong>
          <span>{role}</span>
        </div>
        <Pill tone={tone2}>{pill}</Pill>
      </div>
      <p>{description}</p>
      <div className="trust-network-facts">
        {facts.map(([key, value]) => (
          <div key={key}>
            <span>{key}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="trust-network-guard">
        <Icon name="lock" size={12} />
        {guard}
      </div>
    </article>
  );
}

function Step({ index, title, detail }: { index: string; title: string; detail: string }) {
  return (
    <div className="trust-step">
      <span>{index}</span>
      <div>
        <strong>{title}</strong>
        <em>{detail}</em>
      </div>
    </div>
  );
}
