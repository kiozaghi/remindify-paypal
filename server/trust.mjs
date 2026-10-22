// Remindify Trust — proof receipts and escrow intents on EVM chains.
//
// Design notes:
// - Wallet-optional: a receipt exists offchain the moment proof is filed.
//   A wallet only enters the picture when someone signs the EIP-712 receipt
//   or anchors it to a deployed contract.
// - No custody: the server never holds a private key and never moves funds.
//   When a contract is configured, the owner's wallet sends the transaction
//   and the server verifies the result against the configured RPC.
// - Ethiopia stays offchain. The EVM module is geo-fenced by product policy:
//   no wallet or USDC flows are offered for Ethiopian counterparties until
//   the NBE authorises virtual-asset activity.
// - Preview mode is a first-class state. Without a deployed contract the
//   module still files, signs, verifies and audits receipts, and prepares
//   calldata for a later deployment.

import { randomBytes } from "node:crypto";
import { loadAll, put, getMeta, setMeta } from "./db.mjs";
import {
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  hashTypedData,
  http,
  isAddress,
  keccak256,
  parseEventLogs,
  stringToHex,
  verifyTypedData,
  zeroAddress,
} from "viem";
import { base, baseSepolia, celo, celoSepolia } from "viem/chains";

const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

// ---------------------------------------------------------------------------
// Network registry
// ---------------------------------------------------------------------------

const NETWORKS = [
  {
    key: "base",
    label: "Base",
    role: "primary",
    description: "Primary chain for proof anchoring and USDC escrow.",
    chain: base,
    chain_id: 8453,
    caip2: "eip155:8453",
    currency: "USDC",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdc_decimals: 6,
    explorer: "https://basescan.org",
    rpc_env: "BASE_RPC_URL",
    rpc_default: "https://mainnet.base.org",
    attestation_env: "BASE_ATTESTATION_CONTRACT",
    escrow_env: "BASE_ESCROW_CONTRACT",
    tone: "blue",
    testnet: false,
  },
  {
    key: "base-sepolia",
    label: "Base Sepolia",
    role: "testnet",
    description: "Rehearsal chain for anchoring and escrow before mainnet.",
    chain: baseSepolia,
    chain_id: 84532,
    caip2: "eip155:84532",
    currency: "USDC",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    usdc_decimals: 6,
    explorer: "https://sepolia.basescan.org",
    rpc_env: "BASE_SEPOLIA_RPC_URL",
    rpc_default: "https://sepolia.base.org",
    attestation_env: "BASE_SEPOLIA_ATTESTATION_CONTRACT",
    escrow_env: "BASE_SEPOLIA_ESCROW_CONTRACT",
    tone: "violet",
    testnet: true,
  },
  {
    key: "celo",
    label: "Celo",
    role: "grant-pilot",
    description: "Prezenti pilot chain. Mainnet only, for non-Ethiopian counterparties.",
    chain: celo,
    chain_id: 42220,
    caip2: "eip155:42220",
    currency: "USDC",
    usdc: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    usdc_decimals: 6,
    explorer: "https://celoscan.io",
    rpc_env: "CELO_RPC_URL",
    rpc_default: "https://forno.celo.org",
    attestation_env: "CELO_ATTESTATION_CONTRACT",
    escrow_env: "CELO_ESCROW_CONTRACT",
    tone: "amber",
    testnet: false,
    guardrail: "Ethiopian obligations stay offchain. Celo is for counterparties outside NBE restrictions.",
  },
  {
    key: "celo-sepolia",
    label: "Celo Sepolia",
    role: "testnet",
    description: "Celo testnet for rehearsing the Prezenti pilot.",
    chain: celoSepolia,
    chain_id: 11142220,
    caip2: "eip155:11142220",
    currency: "USDC",
    usdc: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
    usdc_decimals: 6,
    explorer: "https://celo-sepolia.blockscout.com",
    rpc_env: "CELO_SEPOLIA_RPC_URL",
    rpc_default: "https://forno.celo-sepolia.celo-testnet.org",
    attestation_env: "CELO_SEPOLIA_ATTESTATION_CONTRACT",
    escrow_env: "CELO_SEPOLIA_ESCROW_CONTRACT",
    tone: "teal",
    testnet: true,
  },
];

const NETWORK_BY_KEY = Object.fromEntries(NETWORKS.map((n) => [n.key, n]));

function networkFor(key) {
  return NETWORK_BY_KEY[key] || NETWORK_BY_KEY.base;
}

function rpcFor(net) {
  return (process.env[net.rpc_env] || "").trim() || net.rpc_default;
}

function contractFor(net, kind) {
  const env = kind === "escrow" ? net.escrow_env : net.attestation_env;
  const value = (process.env[env] || "").trim();
  return isAddress(value) ? getAddress(value) : null;
}

export function networkProfiles() {
  return NETWORKS.map((net) => {
    const attestation = contractFor(net, "attestation");
    const escrow = contractFor(net, "escrow");
    return {
      key: net.key,
      label: net.label,
      role: net.role,
      description: net.description,
      chain_id: net.chain_id,
      caip2: net.caip2,
      currency: net.currency,
      usdc: net.usdc,
      usdc_decimals: net.usdc_decimals,
      explorer: net.explorer,
      rpc_configured: Boolean((process.env[net.rpc_env] || "").trim()),
      attestation_contract: attestation,
      escrow_contract: escrow,
      ready: Boolean(attestation || escrow),
      preview: !(attestation && escrow),
      status: attestation && escrow ? "configured" : "preview",
      tone: net.tone,
      testnet: net.testnet,
      guardrail: net.guardrail || null,
      env: {
        rpc: net.rpc_env,
        attestation: net.attestation_env,
        escrow: net.escrow_env,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// EIP-712 proof receipts
// ---------------------------------------------------------------------------

const DOMAIN_NAME = "Remindify Trust";
const DOMAIN_VERSION = "1";

const DOMAIN_TYPE = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
];

const RECEIPT_TYPE = [
  { name: "obligationId", type: "string" },
  { name: "proofHash", type: "bytes32" },
  { name: "evidenceHash", type: "bytes32" },
  { name: "agentId", type: "string" },
  { name: "issuedAt", type: "uint64" },
  { name: "nonce", type: "bytes32" },
];

const RECEIPT_TYPES = { ProofReceipt: RECEIPT_TYPE };
const WALLET_TYPES = { EIP712Domain: DOMAIN_TYPE, ProofReceipt: RECEIPT_TYPE };

const ANCHOR_ABI = [
  {
    type: "function",
    name: "anchor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "obligationId", type: "string" },
      { name: "proofHash", type: "bytes32" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "agentId", type: "string" },
      { name: "issuedAt", type: "uint64" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
];

const ATTESTATION_ABI = [
  {
    type: "event",
    name: "ReceiptAnchored",
    inputs: [
      { indexed: true, name: "receiptId", type: "bytes32" },
      { indexed: true, name: "signer", type: "address" },
      { indexed: false, name: "proofHash", type: "bytes32" },
      { indexed: false, name: "evidenceHash", type: "bytes32" },
      { indexed: false, name: "issuedAt", type: "uint64" },
    ],
  },
];

function typedDataFor({ chainId, contract, message }) {
  const domain = {
    name: DOMAIN_NAME,
    version: DOMAIN_VERSION,
    chainId,
    verifyingContract: contract || zeroAddress,
  };
  return {
    typed_data: { domain, types: RECEIPT_TYPES, primaryType: "ProofReceipt", message },
    wallet_payload: { domain, types: WALLET_TYPES, primaryType: "ProofReceipt", message },
  };
}

function shortHex(value, head = 8, tail = 6) {
  if (!value || typeof value !== "string") return "";
  if (value.length <= head + tail + 2) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function logTrustEvent(event) {
  const item = {
    id: uid("ev"),
    actor_type: "system",
    actor_id: null,
    actor: "Remindify",
    kind: "trust",
    created_at: new Date().toISOString(),
    ...event,
  };
  put("events", item);
  return item;
}

function actorFrom(input) {
  const actor = input?.actor || {};
  return {
    actor_type: actor.type || "human",
    actor_id: actor.id ?? null,
    actor: actor.name || "Solomon Tigabu",
    channel: input?.channel || actor.channel || "app",
  };
}

export function enrichReceipt(receipt) {
  const net = networkFor(receipt.chain);
  const contract = receipt.contract || null;
  return {
    ...receipt,
    network_label: net.label,
    network_role: net.role,
    chain_id: receipt.chain_id || net.chain_id,
    explorer: net.explorer,
    explorer_url: receipt.tx_hash ? `${net.explorer}/tx/${receipt.tx_hash}` : null,
    contract,
    contract_url: contract ? `${net.explorer}/address/${contract}` : null,
    short_hash: shortHex(receipt.digest, 10, 6),
    short_proof: shortHex(receipt.proof_hash, 10, 6),
    usdc: net.usdc,
    mode: contract ? "live" : "preview",
  };
}

export function createReceipt(input = {}) {
  const data = loadAll();
  const obligationId = input.obligation_id || input.obligationId;
  const ob = data.obligations.find((o) => o.id === obligationId);
  if (!ob) return { ok: false, error: "obligation_not_found" };

  const net = networkFor(input.chain || "base");
  const contract = contractFor(net, "attestation");
  const proof = String(input.proof || ob.last_proof || ob.proof_required || "Completed").slice(0, 240);
  const agent = data.agents.find((a) => a.id === (input.agent_id || ob.agent_id));
  const nonce = `0x${randomBytes(32).toString("hex")}`;
  const issuedAtUnix = Math.floor(Date.now() / 1000);
  const issuedAt = new Date().toISOString();

  const proofHash = keccak256(
    stringToHex(`remindify:proof:${ob.id}:${nonce}:${proof}`)
  );
  const evidenceHash = keccak256(
    stringToHex(
      JSON.stringify({
        obligation_id: ob.id,
        title: ob.title,
        category: ob.category,
        provider: ob.provider,
        amount: ob.amount || 0,
        currency: ob.currency || "USD",
        proof_required: ob.proof_required,
        completed_at: ob.last_completed_at || ob.completed_at || null,
      })
    )
  );

  const message = {
    obligationId: ob.id,
    proofHash,
    evidenceHash,
    agentId: agent?.id || "",
    issuedAt: issuedAtUnix,
    nonce,
  };

  const { typed_data, wallet_payload } = typedDataFor({
    chainId: net.chain_id,
    contract,
    message,
  });
  const digest = hashTypedData(typed_data);

  const receipt = {
    id: uid("rcpt"),
    obligation_id: ob.id,
    obligation_title: ob.title,
    agent_id: agent?.id || null,
    agent_name: agent?.name || null,
    chain: net.key,
    chain_id: net.chain_id,
    contract,
    proof_label: proof,
    proof_hash: proofHash,
    evidence_hash: evidenceHash,
    issued_at: issuedAt,
    issued_at_unix: issuedAtUnix,
    nonce,
    digest,
    typed_data,
    wallet_payload,
    status: "prepared",
    signer: null,
    signature: null,
    signed_at: null,
    tx_hash: null,
    block_number: null,
    anchored_at: null,
    anchor_mode: contract ? "ready" : "preview",
    source: input.source || "manual",
    demo: Boolean(input.demo || input.source === "demo"),
    created_at: issuedAt,
  };

  put("receipts", receipt);

  if (!input.silent) {
    const who = actorFrom(input);
    logTrustEvent({
      actor_type: who.actor_type,
      actor_id: who.actor_id,
      actor: who.actor,
      verb: "filed a proof receipt",
      object: ob.title,
      detail: `${net.label} · ${shortHex(proofHash)}${contract ? "" : " · preview"}`,
      kind: "proof",
      channel: who.channel,
    });
  }

  return { ok: true, receipt: enrichReceipt(receipt) };
}

export function fileReceiptForCompletion({ obligation, proof, by, auto = false } = {}) {
  if (!obligation) return { ok: false, error: "obligation_required" };
  try {
    return createReceipt({
      obligation_id: obligation.id,
      proof: proof || obligation.last_proof || obligation.proof_required,
      note: auto
        ? `Filed automatically when ${by || "an agent"} completed the obligation.`
        : `Filed when ${by || "the owner"} completed the obligation.`,
      source: "completion",
      chain: "base",
      silent: true,
      demo: false,
    });
  } catch {
    return { ok: false, error: "receipt_failed" };
  }
}

export async function signReceipt(input = {}) {
  const data = loadAll();
  const receipt = data.receipts.find((r) => r.id === input.id || r.id === input.receipt_id);
  if (!receipt) return { ok: false, error: "receipt_not_found" };
  if (receipt.status === "anchored") return { ok: false, error: "receipt_already_anchored" };
  if (!input.signature || !input.signer) return { ok: false, error: "signature_required" };
  if (!isAddress(input.signer)) return { ok: false, error: "signer_invalid" };

  const signer = getAddress(input.signer);
  let valid = false;
  try {
    valid = await verifyTypedData({
      address: signer,
      domain: receipt.typed_data.domain,
      types: RECEIPT_TYPES,
      primaryType: "ProofReceipt",
      message: receipt.typed_data.message,
      signature: input.signature,
    });
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, error: "signature_invalid" };

  receipt.signature = input.signature;
  receipt.signer = signer;
  receipt.signed_at = new Date().toISOString();
  receipt.status = "signed";
  receipt.anchor_mode = receipt.contract ? "ready" : "preview";
  put("receipts", receipt);

  logTrustEvent({
    actor_type: "human",
    actor_id: null,
    actor: `${signer.slice(0, 6)}…${signer.slice(-4)}`,
    verb: "signed a proof receipt",
    object: receipt.obligation_title,
    detail: `${networkFor(receipt.chain).label} · ${shortHex(receipt.digest)}`,
    kind: "trust",
    channel: "app",
  });

  return { ok: true, receipt: enrichReceipt(receipt) };
}

function receiptIdOnchain(receipt) {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "string" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "string" },
        { type: "uint64" },
        { type: "bytes32" },
      ],
      [
        receipt.obligation_id,
        receipt.proof_hash,
        receipt.evidence_hash,
        receipt.agent_id || "",
        BigInt(receipt.issued_at_unix),
        receipt.nonce,
      ]
    )
  );
}

export function receiptCalldata(id) {
  const data = loadAll();
  const receipt = data.receipts.find((r) => r.id === id || r.obligation_id === id);
  if (!receipt) return { ok: false, error: "receipt_not_found" };
  const net = networkFor(receipt.chain);
  const contract = contractFor(net, "attestation");
  if (!receipt.signature) return { ok: false, error: "receipt_not_signed" };
  if (contract && (!receipt.contract || receipt.contract.toLowerCase() !== contract.toLowerCase())) {
    return {
      ok: false,
      error: "receipt_domain_mismatch",
      hint: "This receipt was prepared for a different contract. File a new receipt after configuring the attestation contract.",
    };
  }

  const calldata = encodeFunctionData({
    abi: ANCHOR_ABI,
    functionName: "anchor",
    args: [
      receipt.obligation_id,
      receipt.proof_hash,
      receipt.evidence_hash,
      receipt.agent_id || "",
      BigInt(receipt.issued_at_unix),
      receipt.nonce,
      receipt.signature,
    ],
  });

  return {
    ok: true,
    chain: net.key,
    chain_id: net.chain_id,
    contract: contract,
    to: contract,
    data: calldata,
    value: "0x0",
    receipt_id: receiptIdOnchain(receipt),
    preview: !contract,
    hint: contract
      ? "Send this transaction from the signer's wallet, then verify the hash."
      : `Set ${net.attestation_env} to a deployed RemindifyAttestations address to anchor.`,
  };
}

export async function anchorReceipt(input = {}) {
  const data = loadAll();
  const receipt = data.receipts.find((r) => r.id === input.id || r.id === input.receipt_id);
  if (!receipt) return { ok: false, error: "receipt_not_found" };
  if (receipt.status === "anchored") {
    return { ok: false, error: "receipt_already_anchored", receipt: enrichReceipt(receipt) };
  }
  if (receipt.status !== "signed") {
    return { ok: false, error: "receipt_not_signed" };
  }
  if (!input.tx_hash) return { ok: false, error: "tx_hash_required" };

  const net = networkFor(receipt.chain);
  const contract = contractFor(net, "attestation");
  if (!contract) {
    return {
      ok: false,
      error: "attestation_contract_not_configured",
      hint: `Set ${net.attestation_env} to enable onchain anchoring. The signed receipt is already verifiable offchain.`,
    };
  }
  if (!receipt.contract || receipt.contract.toLowerCase() !== contract.toLowerCase()) {
    return {
      ok: false,
      error: "receipt_domain_mismatch",
      hint: "This receipt was signed for preview mode or a different contract. File a new receipt after configuring the attestation contract.",
    };
  }

  let tx;
  try {
    const client = createPublicClient({ chain: net.chain, transport: http(rpcFor(net)) });
    tx = await client.getTransactionReceipt({ hash: input.tx_hash });
  } catch (error) {
    return { ok: false, error: "receipt_lookup_failed", detail: String(error?.message || error) };
  }
  if (!tx) return { ok: false, error: "transaction_not_found" };
  if (tx.status !== "success") return { ok: false, error: "transaction_reverted" };
  if (!tx.to || tx.to.toLowerCase() !== contract.toLowerCase()) {
    return { ok: false, error: "wrong_contract", expected: contract, got: tx.to };
  }

  const expectedId = receiptIdOnchain(receipt);
  const events = parseEventLogs({
    abi: ATTESTATION_ABI,
    logs: tx.logs,
    eventName: "ReceiptAnchored",
  });
  const match = events.find((event) => event.args?.receiptId === expectedId);
  if (!match) return { ok: false, error: "attestation_event_not_found" };

  receipt.tx_hash = input.tx_hash;
  receipt.block_number = Number(tx.blockNumber);
  receipt.anchored_at = new Date().toISOString();
  receipt.status = "anchored";
  receipt.anchor_mode = "onchain";
  put("receipts", receipt);

  logTrustEvent({
    actor_type: "human",
    actor_id: null,
    actor: receipt.signer ? `${receipt.signer.slice(0, 6)}…${receipt.signer.slice(-4)}` : "Solomon Tigabu",
    verb: "anchored a proof receipt",
    object: receipt.obligation_title,
    detail: `${net.label} · ${shortHex(input.tx_hash)}`,
    kind: "trust",
    channel: "app",
  });

  return { ok: true, receipt: enrichReceipt(receipt) };
}

// ---------------------------------------------------------------------------
// Escrow intents
// ---------------------------------------------------------------------------

export function enrichEscrow(escrow) {
  const net = networkFor(escrow.chain);
  const contract = escrow.contract || null;
  return {
    ...escrow,
    network_label: net.label,
    network_role: net.role,
    chain_id: escrow.chain_id || net.chain_id,
    explorer: net.explorer,
    explorer_url: escrow.tx_hash ? `${net.explorer}/tx/${escrow.tx_hash}` : null,
    release_url: escrow.release_tx_hash ? `${net.explorer}/tx/${escrow.release_tx_hash}` : null,
    contract,
    contract_url: contract ? `${net.explorer}/address/${contract}` : null,
    short_id: shortHex(escrow.id),
    mode: escrow.mode || (contract ? "onchain-ready" : "offchain"),
  };
}

export function createEscrow(input = {}) {
  const data = loadAll();
  const ob = data.obligations.find((o) => o.id === (input.obligation_id || input.obligationId));
  if (!ob) return { ok: false, error: "obligation_not_found" };
  if (input.jurisdiction_ack !== true) {
    return {
      ok: false,
      error: "jurisdiction_ack_required",
      hint: "Confirm the payment is outside Ethiopia's virtual-asset restrictions. Ethiopian obligations stay offchain.",
    };
  }

  const provider = data.providers.find(
    (p) => p.id === (input.provider_id || ob.marketplace?.provider_id)
  );
  const amount = Number(input.amount ?? provider?.price ?? ob.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "amount_required" };

  const net = networkFor(input.chain || "base");
  const contract = contractFor(net, "escrow");
  const now = new Date().toISOString();

  const escrow = {
    id: uid("esc"),
    obligation_id: ob.id,
    obligation_title: ob.title,
    provider_id: provider?.id || null,
    provider_name: provider?.name || ob.provider || null,
    provider_kind: provider?.kind || null,
    chain: net.key,
    chain_id: net.chain_id,
    currency: "USDC",
    amount,
    amount_base: String(Math.round(amount * 10 ** net.usdc_decimals)),
    contract,
    status: "draft",
    mode: contract ? "onchain-ready" : "offchain",
    jurisdiction_ack: true,
    proof_receipt_id: null,
    note: String(input.note || "").slice(0, 240),
    tx_hash: null,
    release_tx_hash: null,
    created_at: now,
    committed_at: null,
    funded_at: null,
    released_at: null,
  };
  put("escrows", escrow);

  if (!input.silent) {
    const who = actorFrom(input);
    logTrustEvent({
      actor_type: who.actor_type,
      actor_id: who.actor_id,
      actor: who.actor,
      verb: "opened an escrow intent",
      object: ob.title,
      detail: `${provider?.name || ob.provider} · ${amount} USDC on ${net.label}${contract ? "" : " · offchain"}`,
      kind: "trust",
      channel: who.channel,
    });
  }

  return { ok: true, escrow: enrichEscrow(escrow) };
}

export function commitEscrow(input = {}) {
  const data = loadAll();
  const escrow = data.escrows.find((e) => e.id === input.id || e.id === input.escrow_id);
  if (!escrow) return { ok: false, error: "escrow_not_found" };
  if (escrow.status !== "draft") return { ok: false, error: "escrow_not_draft" };

  escrow.status = "committed";
  escrow.mode = "offchain";
  escrow.committed_at = new Date().toISOString();
  put("escrows", escrow);

  logTrustEvent({
    actor_type: "human",
    actor_id: null,
    actor: "Solomon Tigabu",
    verb: "committed an escrow offchain",
    object: escrow.obligation_title,
    detail: `${escrow.provider_name} · ${escrow.amount} USDC · release requires a signed receipt`,
    kind: "trust",
    channel: "app",
  });

  return { ok: true, escrow: enrichEscrow(escrow) };
}

export async function fundEscrow(input = {}) {
  const data = loadAll();
  const escrow = data.escrows.find((e) => e.id === input.id || e.id === input.escrow_id);
  if (!escrow) return { ok: false, error: "escrow_not_found" };
  if (escrow.status === "released") return { ok: false, error: "escrow_already_released" };
  if (escrow.status === "funded") return { ok: false, error: "escrow_already_funded" };
  if (!input.tx_hash) return { ok: false, error: "tx_hash_required" };

  const net = networkFor(escrow.chain);
  const contract = contractFor(net, "escrow");
  if (!contract) {
    return {
      ok: false,
      error: "escrow_contract_not_configured",
      hint: `Set ${net.escrow_env} to record onchain funding. Use Commit for an offchain intent.`,
    };
  }
  if (!escrow.contract || escrow.contract.toLowerCase() !== contract.toLowerCase()) {
    return {
      ok: false,
      error: "escrow_contract_changed",
      hint: "Open a new escrow intent after configuring the escrow contract.",
    };
  }

  let tx;
  try {
    const client = createPublicClient({ chain: net.chain, transport: http(rpcFor(net)) });
    tx = await client.getTransactionReceipt({ hash: input.tx_hash });
  } catch (error) {
    return { ok: false, error: "receipt_lookup_failed", detail: String(error?.message || error) };
  }
  if (!tx) return { ok: false, error: "transaction_not_found" };
  if (tx.status !== "success") return { ok: false, error: "transaction_reverted" };
  if (!tx.to || tx.to.toLowerCase() !== contract.toLowerCase()) {
    return { ok: false, error: "wrong_contract", expected: contract, got: tx.to };
  }

  escrow.status = "funded";
  escrow.mode = "onchain";
  escrow.tx_hash = input.tx_hash;
  escrow.funded_at = new Date().toISOString();
  put("escrows", escrow);

  logTrustEvent({
    actor_type: "human",
    actor_id: null,
    actor: "Solomon Tigabu",
    verb: "funded an escrow with USDC",
    object: escrow.obligation_title,
    detail: `${net.label} · ${shortHex(input.tx_hash)}`,
    kind: "trust",
    channel: "app",
  });

  return { ok: true, escrow: enrichEscrow(escrow) };
}

export async function releaseEscrow(input = {}) {
  const data = loadAll();
  const escrow = data.escrows.find((e) => e.id === input.id || e.id === input.escrow_id);
  if (!escrow) return { ok: false, error: "escrow_not_found" };
  if (!["committed", "funded"].includes(escrow.status)) {
    return { ok: false, error: "escrow_not_releasable" };
  }

  const receiptId = input.proof_receipt_id || input.receipt_id;
  const candidates = data.receipts
    .filter((r) => r.obligation_id === escrow.obligation_id)
    .filter((r) => r.status === "signed" || r.status === "anchored")
    .sort((a, b) => new Date(b.signed_at || b.created_at) - new Date(a.signed_at || a.created_at));
  const receipt = receiptId
    ? data.receipts.find((r) => r.id === receiptId)
    : candidates[0];

  if (!receipt) {
    return { ok: false, error: "proof_required", hint: "Sign a proof receipt for this obligation first." };
  }
  if (receipt.obligation_id !== escrow.obligation_id) {
    return { ok: false, error: "proof_wrong_obligation", hint: "The receipt must belong to the escrow obligation." };
  }
  if (!["signed", "anchored"].includes(receipt.status)) {
    return { ok: false, error: "proof_not_signed", hint: "The release needs a signed or anchored receipt." };
  }

  const net = networkFor(escrow.chain);
  const contract = contractFor(net, "escrow");
  let releaseTx = null;

  if (contract && escrow.contract && escrow.contract.toLowerCase() !== contract.toLowerCase()) {
    return {
      ok: false,
      error: "escrow_contract_changed",
      hint: "This escrow belongs to a different contract. Open a new intent after configuring the escrow contract.",
    };
  }
  if (contract && input.tx_hash) {
    try {
      const client = createPublicClient({ chain: net.chain, transport: http(rpcFor(net)) });
      const tx = await client.getTransactionReceipt({ hash: input.tx_hash });
      if (!tx || tx.status !== "success") return { ok: false, error: "transaction_reverted" };
      if (!tx.to || tx.to.toLowerCase() !== contract.toLowerCase()) {
        return { ok: false, error: "wrong_contract", expected: contract, got: tx.to };
      }
      releaseTx = input.tx_hash;
    } catch (error) {
      return { ok: false, error: "receipt_lookup_failed", detail: String(error?.message || error) };
    }
  }

  escrow.status = "released";
  escrow.mode = releaseTx ? "onchain" : "offchain";
  escrow.proof_receipt_id = receipt.id;
  escrow.release_tx_hash = releaseTx;
  escrow.released_at = new Date().toISOString();
  put("escrows", escrow);

  logTrustEvent({
    actor_type: "human",
    actor_id: null,
    actor: "Solomon Tigabu",
    verb: "released an escrow on proof",
    object: escrow.obligation_title,
    detail: `${escrow.provider_name} · ${escrow.amount} USDC · proof ${shortHex(receipt.digest)}${releaseTx ? ` · ${shortHex(releaseTx)}` : " · offchain"}`,
    kind: "trust",
    channel: "app",
  });

  return { ok: true, escrow: enrichEscrow(escrow), receipt: enrichReceipt(receipt) };
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export function trustSnapshot(data = loadAll()) {
  const receipts = (data.receipts || [])
    .map(enrichReceipt)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const escrows = (data.escrows || [])
    .map(enrichEscrow)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const stats = {
    receipts: receipts.length,
    prepared: receipts.filter((r) => r.status === "prepared").length,
    signed: receipts.filter((r) => r.status === "signed").length,
    anchored: receipts.filter((r) => r.status === "anchored").length,
    escrows: escrows.length,
    open_escrows: escrows.filter((e) => e.status !== "released").length,
    released_escrows: escrows.filter((e) => e.status === "released").length,
    escrow_value: escrows
      .filter((e) => e.status !== "released")
      .reduce((sum, e) => sum + (e.amount || 0), 0),
    released_value: escrows
      .filter((e) => e.status === "released")
      .reduce((sum, e) => sum + (e.amount || 0), 0),
  };

  return {
    networks: networkProfiles(),
    receipts,
    escrows,
    stats,
    guardrails: {
      ethiopia_offchain: true,
      note: "No wallets or USDC payments for Ethiopian obligations until the NBE authorises virtual-asset activity.",
      disclosure: "Remindify never holds a private key. Anchoring and funding are signed by the owner's wallet.",
    },
  };
}

export function trustSummary(data = loadAll()) {
  const snapshot = trustSnapshot(data);
  return {
    networks: snapshot.networks,
    stats: snapshot.stats,
    guardrails: snapshot.guardrails,
  };
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

export function ensureTrustDemo() {
  if (getMeta("trust_demo", false)) return false;
  const data = loadAll();
  if ((data.receipts || []).length) return false;
  const ob = data.obligations.find((o) => o.id === "ob_domain") || data.obligations[0];
  if (!ob) return false;

  createReceipt({
    obligation_id: ob.id,
    proof: ob.id === "ob_domain" ? "domain_renewal_receipt_2026.pdf" : `${ob.id}_proof_2026.pdf`,
    note: "Sample receipt. Sign it, anchor it when a contract is configured, or file your own from any completed obligation.",
    chain: "base",
    source: "demo",
    demo: true,
    silent: true,
  });
  setMeta("trust_demo", true);
  return true;
}
