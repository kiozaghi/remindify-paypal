import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Use an isolated database so the trust tests never touch the running app.
const dir = mkdtempSync(join(tmpdir(), "remindify-trust-"));
process.env.REMINDIFY_DATA_DIR = dir;
process.env.REMINDIFY_DB = join(dir, "test.db");

const { loadAll } = await import("../server/db.mjs");
const {
  createEscrow, commitEscrow, createReceipt, networkProfiles, receiptCalldata,
  releaseEscrow, signReceipt, trustSnapshot,
} = await import("../server/trust.mjs");
const { privateKeyToAccount } = await import("viem/accounts");

const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
);

test("network registry includes Base and Celo with verified USDC addresses", () => {
  const networks = networkProfiles();
  const base = networks.find((network) => network.key === "base");
  const celo = networks.find((network) => network.key === "celo");

  assert.equal(base.chain_id, 8453);
  assert.equal(base.usdc, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  assert.equal(celo.chain_id, 42220);
  assert.equal(celo.usdc, "0xcebA9300f2b948710d2653dD7B07f33A8B32118C");
  assert.match(celo.guardrail, /Ethiopian obligations stay offchain/);
  assert.equal(base.preview, true);
});

test("files and verifies an EIP-712 proof receipt", async () => {
  const filed = createReceipt({
    obligation_id: "ob_domain",
    chain: "base",
    proof: "domain_renewal_receipt_2026.pdf",
    note: "Unit test receipt",
  });

  assert.equal(filed.ok, true);
  assert.equal(filed.receipt.status, "prepared");
  assert.match(filed.receipt.proof_hash, /^0x[0-9a-f]{64}$/);
  assert.match(filed.receipt.digest, /^0x[0-9a-f]{64}$/);
  assert.equal(filed.receipt.typed_data.primaryType, "ProofReceipt");
  assert.ok(filed.receipt.wallet_payload.types.EIP712Domain);

  const signature = await account.signTypedData(filed.receipt.typed_data);
  const signed = await signReceipt({
    id: filed.receipt.id,
    signature,
    signer: account.address,
  });

  assert.equal(signed.ok, true);
  assert.equal(signed.receipt.status, "signed");
  assert.equal(signed.receipt.signer, account.address);
  assert.match(signed.receipt.signature, /^0x[0-9a-f]+$/);

  const bad = await signReceipt({
    id: filed.receipt.id,
    signature: `0x${"00".repeat(65)}`,
    signer: account.address,
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "signature_invalid");
});

test("escrow releases only after a signed proof receipt", async () => {
  const blocked = createEscrow({
    obligation_id: "ob_payroll",
    provider_id: "pv_meron",
    amount: 120,
    chain: "base",
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, "jurisdiction_ack_required");

  const opened = createEscrow({
    obligation_id: "ob_payroll",
    provider_id: "pv_meron",
    amount: 120,
    chain: "base",
    jurisdiction_ack: true,
  });
  assert.equal(opened.ok, true);
  assert.equal(opened.escrow.status, "draft");
  assert.equal(opened.escrow.amount, 120);

  const committed = commitEscrow({ id: opened.escrow.id });
  assert.equal(committed.ok, true);
  assert.equal(committed.escrow.status, "committed");

  const early = await releaseEscrow({ id: opened.escrow.id });
  assert.equal(early.ok, false);
  assert.equal(early.error, "proof_required");

  const domainReceipt = loadAll().receipts.find(
    (receipt) => receipt.obligation_id === "ob_domain" && receipt.status === "signed"
  );
  assert.ok(domainReceipt, "expected the domain receipt from the previous test");
  const wrongObligation = await releaseEscrow({
    id: opened.escrow.id,
    proof_receipt_id: domainReceipt.id,
  });
  assert.equal(wrongObligation.ok, false);
  assert.equal(wrongObligation.error, "proof_wrong_obligation");

  const filed = createReceipt({
    obligation_id: "ob_payroll",
    chain: "base",
    proof: "payroll_return_2026_09.pdf",
  });
  const signature = await account.signTypedData(filed.receipt.typed_data);
  const signed = await signReceipt({
    id: filed.receipt.id,
    signature,
    signer: account.address,
  });
  assert.equal(signed.ok, true);

  const released = await releaseEscrow({ id: opened.escrow.id });
  assert.equal(released.ok, true);
  assert.equal(released.escrow.status, "released");
  assert.equal(released.escrow.proof_receipt_id, filed.receipt.id);

  const snapshot = trustSnapshot();
  assert.ok(snapshot.stats.receipts >= 2);
  assert.ok(snapshot.stats.anchored === 0);
  assert.equal(snapshot.stats.released_escrows, 1);
  assert.ok(snapshot.stats.released_value >= 120);
});

test("prepares anchor calldata when an attestation contract is configured", async () => {
  process.env.BASE_ATTESTATION_CONTRACT = "0x000000000000000000000000000000000000dEaD";
  try {
    const filed = createReceipt({
      obligation_id: "ob_domain",
      chain: "base",
      proof: "anchor calldata test",
    });
    assert.equal(filed.receipt.contract.toLowerCase(), "0x000000000000000000000000000000000000dead");
    const signature = await account.signTypedData(filed.receipt.typed_data);
    const signed = await signReceipt({
      id: filed.receipt.id,
      signature,
      signer: account.address,
    });
    assert.equal(signed.ok, true);

    const calldata = receiptCalldata(signed.receipt.id);
    assert.equal(calldata.ok, true);
    assert.equal(calldata.to.toLowerCase(), "0x000000000000000000000000000000000000dead");
    assert.match(calldata.data, /^0x[0-9a-f]+$/);
    assert.match(calldata.receipt_id, /^0x[0-9a-f]{64}$/);
    assert.equal(calldata.preview, false);
  } finally {
    delete process.env.BASE_ATTESTATION_CONTRACT;
  }
});
