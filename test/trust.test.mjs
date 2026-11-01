import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Isolated database so the trust tests never touch the running app.
const dir = mkdtempSync(join(tmpdir(), "remindify-trust-"));
process.env.REMINDIFY_DATA_DIR = dir;
process.env.REMINDIFY_DB = join(dir, "test.db");

const { loadAll, put } = await import("../server/db.mjs");
const {
  auditReceipt, createEscrow, createReceipt, escrowSplit, releaseEscrow,
  trustSnapshot, verifyReceiptSignature,
} = await import("../server/trust.mjs");
const { auditEvidence } = await import("../server/audit.mjs");

const OBLIGATION = {
  id: "ob_test_tax",
  title: "Q4 withholding tax filing",
  provider: "Apex Tax & Compliance LLP",
  amount: 180,
  currency: "USD",
  proof_required: "Stamped filing receipt with confirmed payment",
  status: "active",
};

function seedObligation() {
  put("obligations", OBLIGATION);
}

const GOOD_PROOF = {
  name: "delaware-filing-receipt.pdf",
  type: "application/pdf",
  text: [
    "STATE OF DELAWARE — FRANCHISE TAX PAYMENT RECEIPT",
    "Confirmation number: DL-2026-8841",
    "Amount paid: $180.00 USD",
    "Date: 2026-10-28",
    "This stamped filing receipt confirms the filing was accepted with balance due of zero.",
  ].join("\n"),
};

const WRONG_PROOF = {
  name: "note.txt",
  type: "text/plain",
  text: "Paid the tax guy eventually, will send the paper later.",
};

const IMAGE_PROOF = {
  name: "stamped-receipt.jpg",
  type: "image/jpeg",
  mime: "image/jpeg",
  data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  text: "",
};

test("a filed receipt is signed and any edit breaks the signature", () => {
  seedObligation();
  const filed = createReceipt({
    obligation_id: OBLIGATION.id,
    proof: "filing receipt",
    artifact: GOOD_PROOF,
    silent: true,
  });
  assert.equal(filed.ok, true);
  assert.equal(filed.receipt.status, "filed");
  assert.equal(filed.receipt.signature.length, 64);
  assert.equal(verifyReceiptSignature(filed.receipt), true);

  const stored = loadAll().receipts.find((r) => r.id === filed.receipt.id);
  stored.proof_hash = "f".repeat(64);
  assert.equal(verifyReceiptSignature(stored), false);
});

test("the auditor verifies a receipt that carries the amount and a reference", async () => {
  seedObligation();
  const filed = createReceipt({
    obligation_id: OBLIGATION.id,
    proof: "filing receipt",
    artifact: GOOD_PROOF,
    silent: true,
  });
  const audited = await auditReceipt({ receipt_id: filed.receipt.id });
  assert.equal(audited.ok, true);
  assert.equal(audited.verified, true);
  assert.ok(audited.audit.confidence >= 0.8);
  assert.equal(audited.receipt.status, "verified");
});

test("the auditor rejects a note that proves nothing", async () => {
  seedObligation();
  const filed = createReceipt({
    obligation_id: OBLIGATION.id,
    proof: "filing receipt",
    artifact: WRONG_PROOF,
    silent: true,
  });
  const audited = await auditReceipt({ receipt_id: filed.receipt.id });
  assert.equal(audited.ok, true);
  assert.equal(audited.verified, false);
  assert.equal(audited.receipt.status, "rejected");
  assert.ok(audited.audit.discrepancies.length > 0);
});

test("an empty artifact never passes", async () => {
  const verdict = await auditEvidence({
    obligation: OBLIGATION,
    artifact: { name: "empty.pdf", text: "" },
    env: {},
  });
  assert.equal(verdict.verified, false);
  assert.equal(verdict.confidence, 0);
});

test("a photo is carried by its bytes, not by its caption", () => {
  seedObligation();
  const filed = createReceipt({
    obligation_id: OBLIGATION.id,
    proof: "photo of the stamped receipt",
    artifact: IMAGE_PROOF,
    silent: true,
  });
  assert.equal(filed.ok, true);

  const stored = loadAll().receipts.find((r) => r.id === filed.receipt.id);
  assert.equal(stored.artifact.mime, "image/jpeg");
  assert.equal(stored.artifact.data, IMAGE_PROOF.data);
  assert.equal(
    stored.artifact_hash,
    createHash("sha256").update(`inline:image/jpeg:${IMAGE_PROOF.data}`).digest("hex")
  );

  assert.equal(filed.receipt.artifact.inline, true);
  assert.equal(filed.receipt.artifact.data, undefined);
});

test("a photo needs the AI auditor and is refused without one", async () => {
  const verdict = await auditEvidence({ obligation: OBLIGATION, artifact: IMAGE_PROOF, env: {} });
  assert.equal(verdict.verified, false);
  assert.equal(verdict.confidence, 0);
  assert.match(verdict.discrepancies.join(" "), /AI auditor/);
});

test("a receipt for a different amount is rejected even with a reference and a date", async () => {
  const verdict = await auditEvidence({
    obligation: OBLIGATION,
    artifact: {
      name: "draft-payment-confirmation.pdf",
      type: "application/pdf",
      text: [
        "Payment confirmation — TAX FILING DRAFT COPY",
        "Reference: DE-Q4-8841",
        "Date: 2026-10-28",
        "Amount paid: $1,800.00 USD",
        "Status: Scheduled, not settled",
      ].join("\n"),
    },
    env: {},
  });
  assert.equal(verdict.verified, false);
  assert.ok(verdict.confidence < 0.8);
  assert.ok(verdict.discrepancies.some((entry) => /1,?800/.test(entry)));
});

test("escrow splits the fee and needs a payee", () => {
  const split = escrowSplit(180);
  assert.equal(split.gross, 180);
  assert.equal(split.fee, 18);
  assert.equal(split.net, 162);

  seedObligation();
  const missing = createEscrow({ obligation_id: OBLIGATION.id, amount: 180 });
  assert.equal(missing.ok, false);
  assert.equal(missing.error, "payee_required");

  const opened = createEscrow({
    obligation_id: OBLIGATION.id,
    amount: 180,
    payee_paypal_email: "cpa-sandbox@business.example.com",
    silent: true,
  });
  assert.equal(opened.ok, true);
  assert.equal(opened.escrow.status, "draft");
  assert.equal(opened.escrow.platform_fee, 18);
  assert.equal(opened.escrow.net_payout, 162);
});

test("a release cannot happen before a PayPal hold exists", async () => {
  seedObligation();
  const opened = createEscrow({
    obligation_id: OBLIGATION.id,
    amount: 180,
    payee_paypal_email: "cpa-sandbox@business.example.com",
    silent: true,
  });
  const released = await releaseEscrow({ id: opened.escrow.id });
  assert.equal(released.ok, false);
  assert.equal(released.error, "escrow_not_releasable");
});

test("a seeded rehearsal hold says so instead of faking a capture", async () => {
  seedObligation();
  const opened = createEscrow({
    obligation_id: OBLIGATION.id,
    amount: 180,
    payee_paypal_email: "cpa-sandbox@business.example.com",
    silent: true,
  });
  const stored = loadAll().escrows.find((e) => e.id === opened.escrow.id);
  stored.status = "authorized";
  stored.authorization_id = "DEMO-AUTH-TEST-180";
  put("escrows", stored);

  const released = await releaseEscrow({ id: stored.id });
  assert.equal(released.ok, false);
  assert.equal(released.error, "demo_hold");
  assert.match(released.message, /sandbox hold/);
});

test("the snapshot reports the rail and the receipt states", () => {
  const snapshot = trustSnapshot();
  assert.equal(snapshot.rail.key, "paypal");
  assert.equal(snapshot.rail.hold_days, 29);
  assert.ok(snapshot.stats.receipts >= 1);
  assert.equal(snapshot.guardrails.proof_before_money, true);
});
