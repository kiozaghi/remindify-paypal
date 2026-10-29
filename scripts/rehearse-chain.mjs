// Rehearse the full trust lifecycle against a deployed contract:
// file -> sign -> anchor -> escrow -> approve -> fund -> release.
//
// Usage:
//   BASE_SEPOLIA_ATTESTATION_CONTRACT=0x... \
//   BASE_SEPOLIA_ESCROW_CONTRACT=0x... \
//   npm run chain:rehearse
//
// Without REHEARSAL_PRIVATE_KEY the script generates a throwaway wallet,
// prints its address and waits for you to fund it. With the variable set, the
// key is read once and never written to disk. The server must already be
// running with the same contract addresses configured.

import { randomBytes } from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  http,
  keccak256,
  parseUnits,
  stringToHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { NETWORKS } from "../contracts/networks.mjs";

const API = (process.env.REHEARSAL_API || "http://localhost:4178").replace(/\/$/, "");
const CHAIN_KEY = process.env.REHEARSAL_CHAIN || "base-sepolia";
const network = NETWORKS[CHAIN_KEY];
const USDC_AMOUNT = Number(process.env.REHEARSAL_USDC || 1);
const WAIT_SECONDS = Number(process.env.REHEARSAL_WAIT_SECONDS || 900);

if (!network) {
  console.error(`Unknown chain "${CHAIN_KEY}". Choose one of: ${Object.keys(NETWORKS).join(", ")}`);
  process.exit(1);
}

const providedKey = (process.env.REHEARSAL_PRIVATE_KEY || "").trim().replace(/^0[xX]/, "");
const rpc = (process.env[network.rpc_env] || "").trim() || network.rpc_default;
const attestationContract = (process.env[network.attestation_env] || "").trim();
const escrowContract = (process.env[network.escrow_env] || "").trim();

if (!attestationContract || !escrowContract) {
  console.error(`Set ${network.attestation_env} and ${network.escrow_env} first.`);
  process.exit(1);
}

const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
];

const ESCROW_ABI = [
  { type: "function", name: "fund", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "bytes32" }, { name: "payee", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "release", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "bytes32" }, { name: "proofReceiptId", type: "bytes32" }], outputs: [] },
];

const publicClient = createPublicClient({ chain: network.chain, transport: http(rpc) });

let account = null;
let wallet = null;
let payee = "";

let cookie = "";

async function call(method, path, payload) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  if (!cookie) {
    const set = response.headers.getSetCookie?.() || [];
    const raw = set[0] || response.headers.get("set-cookie") || "";
    if (raw) cookie = raw.split(";")[0];
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

function step(message) {
  console.log(`\n• ${message}`);
}

function link(txHash) {
  return `${network.explorer}/tx/${txHash}`;
}

async function send(request) {
  const hash = await wallet.sendTransaction(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Transaction reverted: ${hash}`);
  return hash;
}

async function readBalances(address) {
  const [native, usdc] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.readContract({
      address: network.usdc,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    }),
  ]);
  return { native, usdc };
}

async function resolveAccount(amountBase) {
  if (providedKey) {
    if (!/^[0-9a-fA-F]{64}$/.test(providedKey)) {
      throw new Error("REHEARSAL_PRIVATE_KEY must be a 32-byte hex key, with or without 0x.");
    }
    return privateKeyToAccount(`0x${providedKey}`);
  }

  const generated = privateKeyToAccount(`0x${randomBytes(32).toString("hex")}`);
  console.log("\nNo REHEARSAL_PRIVATE_KEY set, so this run generated a throwaway wallet:");
  console.log(`  address : ${generated.address}`);
  console.log(`  gas     : any ${network.label} faucet`);
  console.log(`  USDC    : https://faucet.circle.com — select ${network.label}, ${USDC_AMOUNT} USDC`);
  console.log(`  Waiting up to ${Math.round(WAIT_SECONDS / 60)} minutes. Keep this terminal open;`);
  console.log("  the key lives only in this process and is discarded when it exits.");

  const deadline = Date.now() + WAIT_SECONDS * 1000;
  let previous = "";
  while (Date.now() < deadline) {
    const { native, usdc } = await readBalances(generated.address);
    const status = `gas ${formatEther(native)} · USDC ${formatUnits(usdc, 6)}`;
    if (status !== previous) {
      console.log(`  ${status}`);
      previous = status;
    }
    if (native > 0n && usdc >= amountBase) return generated;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Timed out waiting for funds. The generated wallet is gone; re-run to start again.");
}

async function main() {
  const amountBase = parseUnits(String(USDC_AMOUNT), 6);
  account = await resolveAccount(amountBase);
  wallet = createWalletClient({ account, chain: network.chain, transport: http(rpc) });
  payee = (process.env.REHEARSAL_PAYEE || account.address).trim();

  const { native, usdc } = await readBalances(account.address);

  console.log(`Network   : ${network.label} (${network.chain_id})`);
  console.log(`Wallet    : ${account.address}`);
  console.log(`Gas       : ${formatEther(native)} native`);
  console.log(`USDC      : ${formatUnits(usdc, 6)} (need ${USDC_AMOUNT})`);
  console.log(`Attest.   : ${attestationContract}`);
  console.log(`Escrow    : ${escrowContract}`);
  console.log(`API       : ${API}`);

  if (native === 0n) throw new Error(`Wallet has no gas. Fund ${account.address} on ${network.label}.`);
  if (usdc < amountBase) {
    throw new Error(
      `Wallet needs ${USDC_AMOUNT} test USDC. Get it at faucet.circle.com for ${network.label}.`
    );
  }

  step("Creating a rehearsal account");
  const email = `rehearsal-${Date.now()}@example.com`;
  await call("POST", "/api/auth/signup", {
    name: "Chain Rehearsal",
    email,
    password: "correct-horse-battery",
  });
  const state = (await call("GET", "/api/state")).state;
  const obligation =
    (state.obligations || []).find((item) => item.status !== "done") || (state.obligations || [])[0];
  if (!obligation) throw new Error("No obligation available to attach the receipt to.");

  const trust = await call("GET", "/api/trust");
  const profile = (trust.trust?.networks || []).find((item) => item.key === CHAIN_KEY);
  if (!profile || profile.status !== "configured") {
    throw new Error(`The server is in preview mode for ${CHAIN_KEY}. Start it with the contract env vars.`);
  }
  if (
    profile.attestation_contract?.toLowerCase() !== attestationContract.toLowerCase() ||
    profile.escrow_contract?.toLowerCase() !== escrowContract.toLowerCase()
  ) {
    throw new Error("The server's contract addresses differ from this shell's env. Restart it with the same values.");
  }

  step(`Filing a proof receipt for "${obligation.title}"`);
  const filed = await call("POST", "/api/trust/receipts", {
    obligation_id: obligation.id,
    proof: "Rehearsal proof: work completed and reviewed",
    chain: CHAIN_KEY,
  });
  const receipt = filed.receipt;

  step("Signing the EIP-712 receipt");
  const signature = await wallet.signTypedData({
    account,
    domain: receipt.typed_data.domain,
    types: receipt.typed_data.types,
    primaryType: receipt.typed_data.primaryType,
    message: receipt.typed_data.message,
  });
  await call("POST", `/api/trust/receipts/${receipt.id}/sign`, {
    signature,
    signer: account.address,
  });

  step("Anchoring onchain");
  const calldata = await call("GET", `/api/trust/receipts/${receipt.id}/calldata`);
  const anchorTx = await send({ to: calldata.to, data: calldata.data, value: 0n });
  await call("POST", `/api/trust/receipts/${receipt.id}/anchor`, { tx_hash: anchorTx });
  console.log(`  ${link(anchorTx)}`);

  step("Opening an escrow intent");
  const opened = await call("POST", "/api/trust/escrows", {
    obligation_id: obligation.id,
    amount: USDC_AMOUNT,
    chain: CHAIN_KEY,
    jurisdiction_ack: true,
    note: "Chain rehearsal",
  });
  const escrow = opened.escrow;
  const escrowId = keccak256(stringToHex(escrow.id));

  step(`Approving ${USDC_AMOUNT} USDC`);
  const approveTx = await send({
    to: network.usdc,
    data: encodeApprove(escrowContract, amountBase),
    value: 0n,
  });
  console.log(`  ${link(approveTx)}`);

  step("Funding the escrow");
  const fundTx = await send({
    to: escrowContract,
    data: encodeFund(escrowId, payee, amountBase),
    value: 0n,
  });
  await call("POST", `/api/trust/escrows/${escrow.id}/fund`, { tx_hash: fundTx });
  console.log(`  ${link(fundTx)}`);

  step("Releasing on proof");
  const releaseTx = await send({
    to: escrowContract,
    data: encodeRelease(escrowId, calldata.receipt_id),
    value: 0n,
  });
  await call("POST", `/api/trust/escrows/${escrow.id}/release`, {
    proof_receipt_id: receipt.id,
    tx_hash: releaseTx,
  });
  console.log(`  ${link(releaseTx)}`);

  console.log("\nRehearsal complete.");
  console.log(JSON.stringify({
    network: CHAIN_KEY,
    account: account.address,
    payee,
    receipt_id: receipt.id,
    onchain_receipt_id: calldata.receipt_id,
    anchor_tx: anchorTx,
    escrow_id: escrow.id,
    onchain_escrow_id: escrowId,
    fund_tx: fundTx,
    release_tx: releaseTx,
    explorer: {
      anchor: link(anchorTx),
      fund: link(fundTx),
      release: link(releaseTx),
    },
  }, null, 2));
}

// Minimal ABI encoding for the two calls the server does not build calldata for.

function encodeApprove(spender, amount) {
  return encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [spender, amount] });
}

function encodeFund(escrowId, to, amount) {
  return encodeFunctionData({ abi: ESCROW_ABI, functionName: "fund", args: [escrowId, to, amount] });
}

function encodeRelease(escrowId, proofReceiptId) {
  return encodeFunctionData({ abi: ESCROW_ABI, functionName: "release", args: [escrowId, proofReceiptId] });
}

main().catch((error) => {
  console.error(`\nRehearsal failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
