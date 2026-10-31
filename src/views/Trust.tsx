import { useMemo, useState } from "react";
import { useApp } from "../store";
import { api } from "../lib/api";
import { Icon } from "../components/Icon";
import { EmptyState, Field, Modal, Pill, Segmented } from "../components/ui";
import { moneyExact, timeAgo } from "../lib/format";
import type { Escrow, ProofReceipt, TrustNetwork } from "../types";

const shortAddr = (value?: string | null) =>
  value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "";

const shortHash = (value?: string | null) =>
  value ? `${value.slice(0, 10)}…${value.slice(-6)}` : "";

const shortContract = (value?: string | null) =>
  value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—";

const roleLabel = (role: string) =>
  role === "primary" ? "Primary" : role === "grant-pilot" ? "Grant pilot" : "Testnet";

const statusLabel: Record<string, string> = {
  prepared: "Prepared",
  signed: "Signed",
  anchored: "Anchored",
  draft: "Draft",
  committed: "Committed",
  funded: "Funded",
  released: "Released",
};

const statusTone: Record<string, string> = {
  prepared: "amber",
  signed: "blue",
  anchored: "teal",
  draft: "ink",
  committed: "amber",
  funded: "blue",
  released: "teal",
};

type ReceiptDraft = {
  obligation_id: string;
  chain: string;
  proof: string;
  note: string;
};

type EscrowDraft = {
  obligation_id: string;
  provider_id: string;
  amount: string;
  chain: string;
  note: string;
  acknowledged: boolean;
};

export default function Trust() {
  const { state, actions, toast, nowMs } = useApp();
  const [receiptFilter, setReceiptFilter] = useState("all");
  const [receiptModal, setReceiptModal] = useState(false);
  const [escrowModal, setEscrowModal] = useState(false);
  const [signing, setSigning] = useState<ProofReceipt | null>(null);
  const [anchoring, setAnchoring] = useState<ProofReceipt | null>(null);
  const [releasing, setReleasing] = useState<Escrow | null>(null);
  const [busy, setBusy] = useState("");
  const [sentTx, setSentTx] = useState("");

  const receipts = state?.receipts || [];
  const escrows = state?.escrows || [];
  const networks = state?.trust?.networks || [];
  const payments = useMemo(
    () => [...(state?.payments || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [state?.payments]
  );
  const stats = state?.trust?.stats;
  const guardrails = state?.trust?.guardrails;

  const obligations = useMemo(
    () => [...(state?.obligations || [])].sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()),
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

  const latestSignedByObligation = useMemo(() => {
    const map: Record<string, ProofReceipt> = {};
    for (const receipt of receipts) {
      if (!["signed", "anchored"].includes(receipt.status)) continue;
      if (!map[receipt.obligation_id]) map[receipt.obligation_id] = receipt;
    }
    return map;
  }, [receipts]);

  const [receiptDraft, setReceiptDraft] = useState<ReceiptDraft>({
    obligation_id: "",
    chain: "base",
    proof: "",
    note: "",
  });

  const [escrowDraft, setEscrowDraft] = useState<EscrowDraft>({
    obligation_id: "",
    provider_id: "",
    amount: "",
    chain: "base",
    note: "",
    acknowledged: false,
  });

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast("Copied", label, "success");
    } catch {
      toast("Clipboard blocked", "Select the value and copy it manually.", "warn");
    }
  };

  const openReceiptModal = () => {
    const first = obligations.find((o) => o.last_proof) || obligations[0];
    setReceiptDraft({
      obligation_id: first?.id || "",
      chain: "base",
      proof: first?.last_proof || first?.proof_required || "",
      note: "",
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

  const openEscrowModal = () => {
    const first = escrowCandidates[0];
    const provider = state?.providers.find((p) => p.id === first?.marketplace?.provider_id);
    setEscrowDraft({
      obligation_id: first?.id || "",
      provider_id: provider?.id || "",
      amount: String(provider?.price || first?.amount || ""),
      chain: "base",
      note: "",
      acknowledged: false,
    });
    setEscrowModal(true);
  };

  const selectEscrowObligation = (id: string) => {
    const ob = obligations.find((o) => o.id === id);
    const provider = state?.providers.find((p) => p.id === ob?.marketplace?.provider_id);
    setEscrowDraft((draft) => ({
      ...draft,
      obligation_id: id,
      provider_id: provider?.id || draft.provider_id,
      amount: String(provider?.price || ob?.amount || draft.amount || ""),
    }));
  };

  const selectEscrowProvider = (id: string) => {
    const provider = state?.providers.find((p) => p.id === id);
    setEscrowDraft((draft) => ({
      ...draft,
      provider_id: id,
      amount: provider ? String(provider.price) : draft.amount,
    }));
  };

  const selectedReceiptNetwork = networks.find((n) => n.key === receiptDraft.chain);
  const selectedEscrowNetwork = networks.find((n) => n.key === escrowDraft.chain);
  const isCeloEscrow = escrowDraft.chain.startsWith("celo");

  const submitReceipt = async () => {
    if (!receiptDraft.obligation_id) return;
    setBusy("receipt");
    const result = await actions.createReceipt({
      obligation_id: receiptDraft.obligation_id,
      chain: receiptDraft.chain,
      proof: receiptDraft.proof,
      note: receiptDraft.note,
    });
    setBusy("");
    if (result) {
      setReceiptModal(false);
      const receipt = (result as any).receipt as ProofReceipt | undefined;
      if (receipt) setSigning(receipt);
    }
  };

  const submitEscrow = async () => {
    if (!escrowDraft.obligation_id || !escrowDraft.acknowledged) return;
    setBusy("escrow");
    const result = await actions.createEscrow({
      obligation_id: escrowDraft.obligation_id,
      provider_id: escrowDraft.provider_id || undefined,
      amount: Number(escrowDraft.amount || 0),
      chain: escrowDraft.chain,
      note: escrowDraft.note,
      jurisdiction_ack: true,
    });
    setBusy("");
    if (result) setEscrowModal(false);
  };

  const signWithWallet = async (receipt: ProofReceipt) => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      toast("No EVM wallet detected", "Install a wallet, or copy the EIP-712 payload into your signer.", "warn");
      return;
    }
    setBusy("sign");
    try {
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      const from = accounts?.[0];
      if (!from) throw new Error("No wallet account available.");
      const signature = await ethereum.request({
        method: "eth_signTypedData_v4",
        params: [from, JSON.stringify(receipt.wallet_payload)],
      });
      const result = await actions.signReceipt(receipt.id, signature, from);
      if (result) {
        setSigning(null);
      }
    } catch (error: any) {
      toast("Wallet didn't sign", error?.message || "The signature was cancelled.", "warn");
    } finally {
      setBusy("");
    }
  };

  const anchorWithWallet = async (receipt: ProofReceipt) => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      toast("No EVM wallet detected", "Install a wallet, or paste a transaction hash from another signer.", "warn");
      return;
    }
    setBusy("anchor");
    try {
      const info: any = await api.receiptCalldata(receipt.id);
      if (!info?.to) throw new Error(info?.hint || "Attestation contract is not configured.");
      const chainHex = `0x${receipt.chain_id.toString(16)}`;
      try {
        await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
      } catch {
        /* wallet may already be on the right chain */
      }
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      const from = accounts?.[0];
      if (!from) throw new Error("No wallet account available.");
      const txHash = await ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from, to: info.to, data: info.data, value: "0x0" }],
      });
      setSentTx(txHash);
      toast("Anchor transaction sent", "Waiting for the receipt. Verify once it confirms.", "agent");
      await new Promise((resolve) => setTimeout(resolve, 2400));
      const result = await actions.anchorReceipt(receipt.id, txHash);
      if (result) setAnchoring(null);
    } catch (error: any) {
      toast("Couldn't anchor", error?.message || "The transaction was cancelled.", "warn");
    } finally {
      setBusy("");
    }
  };

  const verifyAnchor = async (receipt: ProofReceipt) => {
    if (!sentTx.trim()) return;
    setBusy("verify");
    const result = await actions.anchorReceipt(receipt.id, sentTx.trim());
    setBusy("");
    if (result) setAnchoring(null);
  };

  const release = async (escrow: Escrow) => {
    const receipt = latestSignedByObligation[escrow.obligation_id];
    if (!receipt) {
      toast("Proof required", "Sign a proof receipt for this obligation before releasing escrow.", "warn");
      return;
    }
    setBusy("release");
    const result = await actions.releaseEscrow(escrow.id, receipt.id);
    setBusy("");
    if (result) setReleasing(null);
  };

  const copyEnv = () => {
    copy(
      [
        "# Base mainnet",
        "BASE_RPC_URL=https://mainnet.base.org",
        "BASE_ATTESTATION_CONTRACT=",
        "BASE_ESCROW_CONTRACT=",
        "",
        "# Base Sepolia",
        "BASE_SEPOLIA_RPC_URL=https://sepolia.base.org",
        "BASE_SEPOLIA_ATTESTATION_CONTRACT=",
        "BASE_SEPOLIA_ESCROW_CONTRACT=",
        "",
        "# Celo mainnet",
        "CELO_RPC_URL=https://forno.celo.org",
        "CELO_ATTESTATION_CONTRACT=",
        "CELO_ESCROW_CONTRACT=",
      ].join("\n"),
      "Contract environment template"
    );
  };

  if (!state) return null;

  return (
    <div className="trust-view">
      <section className="trust-hero">
        <div className="trust-hero-copy">
          <span className="eyebrow light">Base first · Celo pilot · no token</span>
          <h2>Proof that survives <em>the handoff.</em></h2>
          <p>
            Every completion files an offchain receipt. Sign it when a provider needs to verify
            without trusting Remindify. Anchor it only when a third party needs public finality.
          </p>
          <div className="trust-hero-meta">
            <span><Icon name="fingerprint" size={13} /> EIP-712 signed</span>
            <span><Icon name="wallet" size={13} /> Wallet-optional</span>
            <span><Icon name="shield" size={13} /> Hashed proof</span>
            <span><Icon name="lock" size={13} /> Ethiopia offchain</span>
          </div>
        </div>
        <div className="trust-hero-stat">
          <strong>{stats?.anchored ?? 0}</strong>
          <span>anchored receipts</span>
          <em>{stats?.signed ?? 0} signed · {stats?.prepared ?? 0} prepared</em>
          <div className="trust-hero-money">
            {moneyExact(stats?.escrow_value || 0)} <span>open escrow</span>
          </div>
        </div>
      </section>

      <div className="trust-network-grid">
        {networks.map((network) => (
          <NetworkCard key={network.key} network={network} />
        ))}
      </div>

      <div className="trust-layout">
        <div className="trust-main">
          <section className="panel trust-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Proof receipts</span>
                <h3>One hash per handoff</h3>
                <p className="trust-panel-sub">
                  The proof stays offchain. The receipt binds it to the obligation, the agent and the chain.
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
                  { value: "all", label: `All ${receipts.length}` },
                  { value: "prepared", label: `Prepared ${stats?.prepared ?? 0}` },
                  { value: "signed", label: `Signed ${stats?.signed ?? 0}` },
                  { value: "anchored", label: `Anchored ${stats?.anchored ?? 0}` },
                ]}
              />
              <span className="trust-filter-note">Wallet only appears at signing or anchoring.</span>
            </div>

            {filteredReceipts.length ? (
              <div className="receipt-list">
                {filteredReceipts.map((receipt) => (
                  <article className="receipt-row" key={receipt.id}>
                    <span className={`receipt-icon status-${receipt.status}`}>
                      <Icon name={receipt.status === "anchored" ? "shield" : "receipt"} size={16} />
                    </span>
                    <div className="receipt-main">
                      <div className="receipt-title">
                        <strong>{receipt.obligation_title}</strong>
                        {receipt.demo && <Pill tone="amber">sample</Pill>}
                        <span className={`trust-status ${receipt.status}`}>{statusLabel[receipt.status]}</span>
                      </div>
                      <div className="receipt-meta">
                        <span>{receipt.network_label}</span>
                        <i />
                        <span>{receipt.proof_label}</span>
                        <i />
                        <span>{timeAgo(receipt.created_at, nowMs)}</span>
                      </div>
                      <div className="receipt-hash">
                        <code title={receipt.digest}>{receipt.short_hash}</code>
                        {receipt.signer && <span>signed by {shortAddr(receipt.signer)}</span>}
                        {receipt.tx_hash && (
                          <a href={receipt.explorer_url || "#"} target="_blank" rel="noreferrer">
                            tx {shortHash(receipt.tx_hash)} <Icon name="external" size={10} />
                          </a>
                        )}
                        {!receipt.signer && <span>not signed</span>}
                      </div>
                    </div>
                    <div className="receipt-actions">
                      {receipt.status === "prepared" && (
                        <button className="btn btn-xs btn-ink" onClick={() => setSigning(receipt)}>
                          Sign
                        </button>
                      )}
                      {receipt.status === "signed" && (
                        <button className="btn btn-xs btn-ink" onClick={() => { setSentTx(""); setAnchoring(receipt); }}>
                          Anchor
                        </button>
                      )}
                      {receipt.status === "anchored" && receipt.explorer_url && (
                        <a className="btn btn-xs btn-ghost" href={receipt.explorer_url} target="_blank" rel="noreferrer">
                          Explorer <Icon name="external" size={12} />
                        </a>
                      )}
                      <button
                        className="tiny-icon"
                        title="Copy EIP-712 digest"
                        onClick={() => copy(receipt.digest, "EIP-712 digest")}
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
                    : "Complete an obligation, or file a receipt from an existing proof. The receipt is offchain until someone signs or anchors it."
                }
                action={<button className="btn btn-sm btn-ink" onClick={openReceiptModal}><Icon name="plus" size={14} /> File a receipt</button>}
              />
            )}
          </section>

          <section className="panel trust-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Fiat rail</span>
                <h3>PayPal ledger</h3>
                <p className="trust-panel-sub">
                  Every order, capture and payout this workspace has sent, with the PayPal reference that proves it.
                  {" "}
                  {state.paypal.mode === "sandbox" ? "Sandbox credentials — no real money moves." : "Live credentials."}
                </p>
              </div>
              <Pill tone={state.paypal.configured ? "teal" : "amber"}>
                {state.paypal.configured ? state.paypal.mode : "not configured"}
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
              PayPal moves the fiat. Proof still files to the vault, and the Base rail stays separate.
            </div>
          </section>

          <section className="panel trust-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Escrow</span>
                <h3>Release only on proof</h3>
                <p className="trust-panel-sub">
                  Commit a USDC amount against the job. The release needs a signed or anchored receipt.
                </p>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={openEscrowModal}>
                <Icon name="plus" size={14} /> New escrow
              </button>
            </div>

            {escrows.length ? (
              <div className="escrow-list">
                {escrows.map((escrow) => (
                  <article className="escrow-row" key={escrow.id}>
                    <span className={`escrow-icon status-${escrow.status}`}>
                      <Icon name="lock" size={16} />
                    </span>
                    <div className="escrow-main">
                      <div className="escrow-title">
                        <strong>{escrow.obligation_title}</strong>
                        <span className={`trust-status ${escrow.status}`}>{statusLabel[escrow.status]}</span>
                        <span className="escrow-chain">{escrow.network_label}</span>
                      </div>
                      <div className="escrow-meta">
                        <span>{escrow.provider_name}</span>
                        <i />
                        <span>{moneyExact(escrow.amount)} USDC</span>
                        <i />
                        <span>{escrow.mode === "onchain" ? "onchain" : escrow.mode === "offchain" ? "offchain" : "contract-ready"}</span>
                      </div>
                      {escrow.note && <em>{escrow.note}</em>}
                      <div className="escrow-track"><span className={escrow.status} /></div>
                      {escrow.status === "released" && escrow.released_at && (
                        <div className="escrow-release-note">
                          <Icon name="checkCircle" size={11} />
                          Released on {shortHash(escrow.proof_receipt_id || "")} · {timeAgo(escrow.released_at, nowMs)}
                          {escrow.release_url && (
                            <a href={escrow.release_url} target="_blank" rel="noreferrer">tx <Icon name="external" size={10} /></a>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="escrow-actions">
                      {escrow.status === "draft" && (
                        <button className="btn btn-xs btn-ink" onClick={() => actions.commitEscrow(escrow.id)}>
                          Commit
                        </button>
                      )}
                      {(escrow.status === "committed" || escrow.status === "funded") && (
                        <button className="btn btn-xs btn-ink" onClick={() => setReleasing(escrow)}>
                          Release
                        </button>
                      )}
                      {escrow.status === "released" && (
                        <Pill tone="teal">released</Pill>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="lock"
                title="No escrow intents yet"
                detail="Open an intent from a booked job. Commit records the obligation offchain; funding and release can be anchored when a contract is configured."
                action={<button className="btn btn-sm btn-ghost" onClick={openEscrowModal}><Icon name="plus" size={14} /> Open an escrow intent</button>}
              />
            )}
            <div className="trust-inline-note">
              <Icon name="info" size={12} />
              No custody. The server never holds a key. {guardrails?.note}
            </div>
          </section>
        </div>

        <aside className="trust-side">
          <section className="panel trust-side-panel">
            <span className="eyebrow">The path</span>
            <h3>Offchain by default. Onchain by exception.</h3>
            <div className="trust-steps">
              <Step index="01" title="File" detail="Completion writes a hash-bound receipt. No wallet." />
              <Step index="02" title="Sign" detail="The owner or agent signs EIP-712 typed data." />
              <Step index="03" title="Anchor" detail="Only if a third party needs public finality." />
              <Step index="04" title="Release" detail="Escrow releases on a signed or anchored receipt." />
            </div>
          </section>

          <section className="panel trust-side-panel guardrail-panel">
            <span className="eyebrow">Guardrails</span>
            <h3>What this deliberately is not</h3>
            <ul className="trust-guard-list">
              <li><Icon name="x" size={12} /><span><strong>No token.</strong> USDC is the only asset that moves.</span></li>
              <li><Icon name="x" size={12} /><span><strong>No custody.</strong> The server never holds a private key.</span></li>
              <li><Icon name="x" size={12} /><span><strong>No forced wallet.</strong> Receipts work without one.</span></li>
              <li><Icon name="lock" size={12} /><span><strong>Ethiopia stays offchain.</strong> No wallets or USDC payments until the NBE authorises virtual-asset activity.</span></li>
            </ul>
          </section>

          <section className="panel trust-side-panel">
            <span className="eyebrow">Configuration</span>
            <h3>Bring a contract when you're ready.</h3>
            <p className="trust-side-copy">
              Preview mode files, signs and verifies receipts today. Set a contract address to enable
              onchain anchoring and USDC funding.
            </p>
            <div className="trust-env-list">
              {networks.filter((n) => n.role !== "testnet").map((network) => (
                <div className="trust-env" key={network.key}>
                  <div>
                    <strong>{network.label}</strong>
                    <span>{network.status === "configured" ? "configured" : "preview"}</span>
                  </div>
                  <code>{network.env.attestation}</code>
                  <code>{network.env.escrow}</code>
                </div>
              ))}
            </div>
            <button className="btn btn-sm btn-ghost trust-copy-env" onClick={copyEnv}>
              <Icon name="copy" size={13} /> Copy env template
            </button>
            <p className="trust-side-foot">
              Reference contracts live in <code>contracts/</code>. Unaudited; deploy to a testnet first.
            </p>
          </section>
        </aside>
      </div>

      {receiptModal && (
        <Modal
          title="File a proof receipt"
          eyebrow="Offchain first"
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
            <div className="trust-form-row">
              <Field label="Anchor chain" hint="Optional">
                <select value={receiptDraft.chain} onChange={(e) => setReceiptDraft({ ...receiptDraft, chain: e.target.value })}>
                  {networks.map((network) => (
                    <option key={network.key} value={network.key}>{network.label} · {roleLabel(network.role)}</option>
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
            </div>
            <Field label="Note" hint="Never stored raw">
              <textarea
                rows={3}
                value={receiptDraft.note}
                onChange={(e) => setReceiptDraft({ ...receiptDraft, note: e.target.value })}
                placeholder="Optional context for the signer. The proof label is hashed with the obligation id and nonce; file contents are never uploaded."
              />
            </Field>
            <div className="trust-preview-box">
              <Icon name="fingerprint" size={16} />
              <div>
                <strong>What gets stored</strong>
                <span>Obligation id, proof label, proof hash, evidence hash, chain id, nonce and issued-at. No file contents.</span>
              </div>
            </div>
            {selectedReceiptNetwork && (
              <p className="trust-form-note">
                {selectedReceiptNetwork.attestation_contract
                  ? `Anchoring is configured on ${selectedReceiptNetwork.label}.`
                  : `${selectedReceiptNetwork.label} is in preview: the receipt can be signed and verified, but not anchored until ${selectedReceiptNetwork.env.attestation} is set.`}
              </p>
            )}
          </div>
        </Modal>
      )}

      {signing && (
        <Modal
          title="Sign the receipt"
          eyebrow={`${signing.network_label} · EIP-712`}
          width={620}
          onClose={() => setSigning(null)}
          footer={
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => copy(JSON.stringify(signing.wallet_payload, null, 2), "EIP-712 payload")}>
                <Icon name="copy" size={13} /> Copy payload
              </button>
              <button
                className="btn btn-sm btn-ink"
                onClick={() => signWithWallet(signing)}
                disabled={busy === "sign"}
              >
                <Icon name="fingerprint" size={14} /> {busy === "sign" ? "Waiting for wallet…" : "Sign with wallet"}
              </button>
            </>
          }
        >
          <div className="trust-sign-summary">
            <div>
              <span>Obligation</span>
              <strong>{signing.obligation_title}</strong>
            </div>
            <div>
              <span>Proof</span>
              <strong>{signing.proof_label}</strong>
            </div>
            <div>
              <span>Chain</span>
              <strong>{signing.network_label} · {signing.chain_id}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong className="capitalize">{signing.status}</strong>
            </div>
          </div>
          <div className="trust-digest">
            <span>EIP-712 digest</span>
            <code>{signing.digest}</code>
            <button className="tiny-icon" onClick={() => copy(signing.digest, "EIP-712 digest")}><Icon name="copy" size={13} /></button>
          </div>
          <div className="trust-preview-box">
            <Icon name="info" size={16} />
            <div>
              <strong>Wallet-optional by design</strong>
              <span>Signing proves the signer approved this exact obligation and proof hash. The receipt already exists offchain; nothing moves and no gas is spent until you anchor.</span>
            </div>
          </div>
          <details className="trust-raw">
            <summary>View the typed data</summary>
            <pre>{JSON.stringify(signing.wallet_payload, null, 2)}</pre>
          </details>
        </Modal>
      )}

      {anchoring && (
        <Modal
          title="Anchor the receipt"
          eyebrow={`${anchoring.network_label} · ${shortHash(anchoring.digest)}`}
          width={620}
          onClose={() => setAnchoring(null)}
          footer={
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => setAnchoring(null)}>Close</button>
              <button
                className="btn btn-sm btn-ink"
                onClick={() => verifyAnchor(anchoring)}
                disabled={busy === "verify" || !sentTx.trim()}
              >
                {busy === "verify" ? "Verifying…" : "Verify transaction"}
              </button>
            </>
          }
        >
          <div className="trust-anchor-head">
            <span className={`receipt-icon status-${anchoring.status}`}><Icon name="shield" size={18} /></span>
            <div>
              <strong>{anchoring.contract ? "Attestation contract configured" : "Preview mode"}</strong>
              <p>
                {anchoring.contract
                  ? `The receipt will be written to ${shortContract(anchoring.contract)} on ${anchoring.network_label}.`
                  : `No attestation contract is configured for ${anchoring.network_label}. You can still copy the calldata for a later deployment.`}
              </p>
            </div>
          </div>

          {anchoring.contract ? (
            <>
              <div className="trust-anchor-actions">
                <button className="btn btn-sm btn-ink" onClick={() => anchorWithWallet(anchoring)} disabled={busy === "anchor"}>
                  <Icon name="wallet" size={14} /> {busy === "anchor" ? "Waiting for wallet…" : "Send anchor transaction"}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => copy(anchoring.contract || "", "Contract address")}>
                  <Icon name="copy" size={13} /> Copy contract
                </button>
              </div>
              <Field label="Transaction hash" hint="Paste a hash if you sent it elsewhere">
                <input value={sentTx} onChange={(e) => setSentTx(e.target.value)} placeholder="0x…" />
              </Field>
            </>
          ) : (
            <div className="trust-preview-box trust-preview-warn">
              <Icon name="info" size={16} />
              <div>
                <strong>Set the contract address when deployed</strong>
                <span>{networks.find((n) => n.key === anchoring.chain)?.env.attestation || "BASE_ATTESTATION_CONTRACT"}</span>
              </div>
            </div>
          )}

          <div className="trust-preview-box">
            <Icon name="fingerprint" size={16} />
            <div>
              <strong>What anchoring adds</strong>
              <span>Public finality for the proof hash. The onchain event includes the signer, proof hash and issued-at; the raw proof remains offchain.</span>
            </div>
          </div>
          <details className="trust-raw">
            <summary>View calldata input</summary>
            <pre>{JSON.stringify(anchoring.wallet_payload, null, 2)}</pre>
          </details>
        </Modal>
      )}

      {escrowModal && (
        <Modal
          title="Open an escrow intent"
          eyebrow="USDC · release on proof"
          width={600}
          onClose={() => setEscrowModal(false)}
          footer={
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => setEscrowModal(false)}>Cancel</button>
              <button
                className="btn btn-sm btn-ink"
                onClick={submitEscrow}
                disabled={busy === "escrow" || !escrowDraft.obligation_id || !escrowDraft.acknowledged}
              >
                {busy === "escrow" ? "Opening…" : "Open intent"}
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
              <Field label="Amount" hint="USDC">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={escrowDraft.amount}
                  onChange={(e) => setEscrowDraft({ ...escrowDraft, amount: e.target.value })}
                  placeholder="120"
                />
              </Field>
            </div>
            <Field label="Chain" hint="Base first; Celo is the grant pilot">
              <select value={escrowDraft.chain} onChange={(e) => setEscrowDraft({ ...escrowDraft, chain: e.target.value, acknowledged: false })}>
                {networks.map((network) => (
                  <option key={network.key} value={network.key}>{network.label} · {roleLabel(network.role)}</option>
                ))}
              </select>
            </Field>
            <Field label="Note" hint="Visible in the intent">
              <textarea
                rows={2}
                value={escrowDraft.note}
                onChange={(e) => setEscrowDraft({ ...escrowDraft, note: e.target.value })}
                placeholder="Scope, milestone or release condition."
              />
            </Field>
            <label className="trust-check guardrail-check">
              <input
                type="checkbox"
                checked={escrowDraft.acknowledged}
                onChange={(e) => setEscrowDraft({ ...escrowDraft, acknowledged: e.target.checked })}
              />
              <span>
                {isCeloEscrow
                  ? "This counterparty is outside Ethiopia and the NBE restriction. I understand Ethiopian obligations stay offchain."
                  : "I confirm this payment is outside Ethiopia's virtual-asset restrictions. Ethiopian obligations stay offchain until the NBE authorises virtual-asset activity."}
              </span>
            </label>
            <div className="trust-preview-box">
              <Icon name="lock" size={16} />
              <div>
                <strong>{selectedEscrowNetwork?.escrow_contract ? "Contract configured" : "Offchain commitment"}</strong>
                <span>
                  {selectedEscrowNetwork?.escrow_contract
                    ? "Funding can be recorded against the configured escrow contract."
                    : "No escrow contract is configured. Commit records the intent; no funds move."}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {releasing && (
        <Modal
          title="Release escrow on proof"
          eyebrow={`${releasing.provider_name} · ${moneyExact(releasing.amount)} USDC`}
          width={560}
          onClose={() => setReleasing(null)}
          footer={
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => setReleasing(null)}>Cancel</button>
              <button
                className="btn btn-sm btn-ink"
                onClick={() => release(releasing)}
                disabled={busy === "release" || !latestSignedByObligation[releasing.obligation_id]}
              >
                {busy === "release" ? "Releasing…" : "Release on proof"}
              </button>
            </>
          }
        >
          {latestSignedByObligation[releasing.obligation_id] ? (
            <>
              <div className="trust-release-proof">
                <span className="receipt-icon status-signed"><Icon name="receipt" size={18} /></span>
                <div>
                  <strong>{latestSignedByObligation[releasing.obligation_id].obligation_title}</strong>
                  <span>{latestSignedByObligation[releasing.obligation_id].network_label} · {latestSignedByObligation[releasing.obligation_id].short_hash}</span>
                </div>
                <Pill tone="blue">signed</Pill>
              </div>
              <div className="trust-preview-box">
                <Icon name="checkCircle" size={16} />
                <div>
                  <strong>The release condition is satisfied</strong>
                  <span>Remindify will mark the intent released and write an audit event. No custody, no automatic transfer.</span>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon="receipt"
              title="Proof first"
              detail="This obligation has no signed receipt yet. Open the receipt list, sign one, then come back to release."
              action={<button className="btn btn-sm btn-ghost" onClick={() => setReleasing(null)}>Back to receipts</button>}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function NetworkCard({ network }: { network: TrustNetwork }) {
  return (
    <article className={`trust-network tone-${network.tone}`}>
      <div className="trust-network-top">
        <div>
          <strong>{network.label}</strong>
          <span>{roleLabel(network.role)}</span>
        </div>
        <Pill tone={network.status === "configured" ? "teal" : "ink"}>
          {network.status === "configured" ? "Configured" : "Preview"}
        </Pill>
      </div>
      <p>{network.description}</p>
      <div className="trust-network-facts">
        <div><span>Chain</span><strong>{network.chain_id}</strong></div>
        <div><span>USDC</span><strong>{shortContract(network.usdc)}</strong></div>
        <div><span>Attest</span><strong>{shortContract(network.attestation_contract)}</strong></div>
        <div><span>Escrow</span><strong>{shortContract(network.escrow_contract)}</strong></div>
      </div>
      {network.guardrail && (
        <div className="trust-network-guard">
          <Icon name="lock" size={12} />
          {network.guardrail}
        </div>
      )}
      <a className="trust-network-link" href={network.explorer} target="_blank" rel="noreferrer">
        Explorer <Icon name="external" size={11} />
      </a>
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
