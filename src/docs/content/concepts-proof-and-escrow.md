# Proof receipts and escrow

Completion is a claim. A proof receipt is the evidence. Remindify stores the evidence text, hashes it with SHA-256, and signs a canonical payload with HMAC-SHA256 on the server. An AI proof auditor decides whether the evidence actually satisfies the obligation. Escrow releases only against a receipt the auditor has verified, and settlement runs entirely through PayPal.

## The receipt lifecycle

| State | Meaning |
| --- | --- |
| `filed` | Created by a completion, an agent or the Trust page. The evidence, hashes and server signature exist. |
| `verified` | The proof auditor accepted the evidence at or above the confidence threshold. |
| `rejected` | The auditor found the evidence insufficient or inconsistent. The receipt stays visible. |
| `settled` | A PayPal escrow was captured and the provider was paid against this receipt. |

A receipt records:

- `proof_label` — the human-readable reference, such as `Cloudflare order CF-88213`.
- `proof_hash` — a SHA-256 hash of the obligation id, the evidence text and the filing time.
- `artifact` and `artifact_hash` — the evidence text and its own SHA-256 hash.
- `actor_id`, `actor_type` and `actor` — who filed it.
- `completed_at`, `status` and `signature`.
- `audit` — the auditor verdict, confidence and discrepancies once audited.
- `settlement` — the capture, payout, fee and net once released.

Proof is a **reference and an evidence excerpt**, not a stored document. File uploads are not part of the current preview. Keep the original receipt in your own storage and put its identifier, URL or hash in `proof`.

## The signature

The server signs a canonical JSON payload:

```json
{
  "obligation_id": "ob_domain",
  "actor_id": "ag_ledger",
  "actor_type": "human",
  "proof_hash": "9f2c...",
  "completed_at": "2026-10-28T09:00:00.000Z"
}
```

The signature is `HMAC-SHA256(TRUST_RECEIPT_SECRET, payload)`. It is computed when the receipt is filed and recomputed whenever the receipt changes, including after an audit. The only secret is the server's receipt secret, and nothing is signed in the browser.

A signed-in workspace member can check a receipt directly:

```bash
curl "$REMINDIFY_URL/api/trust/receipts/rcpt_.../verify"
```

```json
{
  "status": "verified",
  "valid": true,
  "proof_hash": "9f2c...",
  "settlement": null
}
```

`valid` compares the stored signature with a fresh HMAC over the canonical payload, so an edited receipt fails verification. `settlement` is `null` until an escrow release settles the receipt.

## The AI Proof Auditor

`POST /api/trust/receipts/:id/audit` scores the evidence against the obligation's amount, reference and date. It uses Gemini 2.5 Flash with structured JSON output (`AI_MODEL_ID`, default `gemini-2.5-flash`) and returns:

- `verified` — whether the evidence is sufficient;
- `confidence` — a score between 0 and 1;
- `matching_verdict` — a short explanation;
- `discrepancies` — the specific mismatches a payer can act on.

The release threshold is `AUDIT_MIN_CONFIDENCE` (default `0.8`). A confident model answer below the threshold is rejected and the threshold is named in the discrepancies.

Without `GEMINI_API_KEY`, the auditor falls back to deterministic offline rules that look for the amount, a confirmation or reference number, a date and the words of the proof requirement. A provider error uses the same fallback and labels the result `deterministic_fallback`, so a network hiccup never silently approves a payout.

A release runs the auditor first when the receipt is not already `verified`. A rejected proof returns `proof_rejected` and leaves the payer's hold untouched.

## Escrow

Escrow is a PayPal authorization hold. The payer approves a hold for up to 29 days (`HOLD_DAYS=29`) and nothing moves yet. On release Remindify captures the authorization and sends a PayPal Payout to the provider's PayPal email, net of the platform fee.

| State | Reached by | Meaning |
| --- | --- | --- |
| `draft` | `POST /api/trust/escrows` | Amount, obligation, provider and payee email recorded. |
| `hold_pending` | `/hold` | A PayPal order with `intent=AUTHORIZE` exists and awaits the payer. |
| `authorized` | PayPal return to `/api/trust/escrows/paypal/return?token=` | The payer approved the hold; no money has moved. |
| `captured_awaiting_payout` | `/release` when the payout fails | The hold was captured, but the provider was not paid. |
| `released` | `/release` | Capture and payout both succeeded against a verified receipt. |
| `voided` | `/void` | The hold was released back to the payer. |

Rules:

- Creating an escrow requires a PayPal email for the payee. Without one the route returns `payee_required`.
- The amount must be positive and is settled in USD.
- A hold needs `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`; otherwise the route returns `paypal_not_configured`.
- Release requires a verified receipt for **the same obligation**. A receipt for another obligation returns `proof_wrong_obligation`; a missing one returns `proof_required`.
- Release works from `authorized` or `captured_awaiting_payout`. A draft returns `escrow_not_releasable`.
- A payout failure parks the escrow in `captured_awaiting_payout` with `payout_failed`. It is never reported as settled, and the payout can be retried.
- Region gating applies to creating an escrow, placing a hold and releasing it.

```bash
curl -X POST http://localhost:4178/api/trust/escrows \
  -H "cookie: remindify_session=..." \
  -H "content-type: application/json" \
  -d '{
    "obligation_id": "ob_payroll",
    "provider_id": "pv_meron",
    "amount": 120,
    "payee_paypal_email": "meron@example.com"
  }'
```

The fee is deducted from the captured amount at release. With `PAYPAL_PLATFORM_FEE_PERCENT=10`, a $612 escrow captures $612, records a $61.20 platform fee and pays the provider $550.80. There is no token and no custody: Remindify never holds a balance or a card, and PayPal moves the money between the payer, the merchant account and the provider.

Escrow is a proof-gated trust boundary, not a general payment processor. It does not settle cards, run a refund desk or hold fiat outside PayPal. A receipt does not prove the underlying work is good. For an immediate payment with no release condition, use PayPal Orders ([Payments](/docs/guides/payments)).

## What is verifiable

A third party can verify:

1. the HMAC signature against the canonical payload and the receipt fields;
2. the proof hash and the evidence hash against the evidence text;
3. the auditor verdict, confidence and engine;
4. the settlement record, including capture id, payout batch, fee and net;
5. the event log entry that says who filed it and when.

They cannot verify the underlying document unless you publish it. The hash proves that a document did not change after filing; it does not prove the document is true.
