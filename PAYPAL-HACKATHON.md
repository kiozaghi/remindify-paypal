# PayPal AI Hackathon — build scope

**Status: Gate 0 and Gate 2 passed (Oct 31, 2026). Building Gate 1.**

- Event: <https://paypalaihackathon.devpost.com/>
- Deadline: **November 12, 2026, 12:00pm PST** — 23:00 EAT, Thursday.
- Prize pool: $67,500. ~24,900 participants at time of writing.
- Track fit: "new agents, new ways to pay and get paid."

---

## 1. What the rules actually allow

| Rule | Detail | Consequence for us |
| --- | --- | --- |
| Existing projects | "Projects can be new or existing, as long as you make meaningful progress on the project during the course of the hackathon." | We can submit Remindify, but the PayPal work must be real and dateable in git. |
| Required tools | Must use PayPal developer tools (Orders, Payouts, etc.). | A PayPal rail is the whole build, not a badge. |
| Repository | Must be **public and open source**, with a licence visible in the About section. | The repo flips from private to public. MIT is already in place. |
| Demo video | Under 3 minutes, must show the project working end to end. | Re-cut from the existing 2:22 demo plus the new PayPal flow. |
| Eligibility | Age of majority, standard excluded territories. Ethiopia is not excluded. | Eligible. PayPal *product* availability in Ethiopia is a separate question — see risks. |
| Judging | Innovation/Idea 20%, Presentation 20%, plus execution and real-world applicability. | The story matters as much as the code. |

**Meaningful progress test:** every PayPal-related commit lands after October 1, 2026, and the README gets a "what was added for this hackathon" section with the commit range. That is defensible and honest.

---

## 2. The one-sentence pitch

> Remindify already makes delegated work provable. Now the money can move on that proof — through **PayPal or USDC** — without the agent ever holding the funds.

This keeps Base central (USDC escrow, anchored receipts) and adds a fiat rail that a non-crypto payer or a marketplace seller can actually use. It is not a pivot; it is the missing last mile.

---

## 3. Scope

### Flow A — Pay an obligation with PayPal (core, must ship)

Today an obligation has `amount`, `currency`, `due_at`, `proof_required`, and a "mark complete" action. There is no payment rail.

1. Obligation detail gets **Pay with PayPal** when `amount > 0` and status is not already paid.
2. `POST /api/payments/paypal/orders` builds the order **from the stored obligation**, never from client input:
   - `intent: CAPTURE`, amount + currency from the obligation (USD only in v1),
   - `custom_id` = obligation id, `invoice_id` = a stable per-attempt reference,
   - return/cancel URLs back to the obligation.
3. Browser goes to the PayPal approval URL (sandbox).
4. Return lands on `/obligations?paypal=return&token=<order_id>`; the client calls
   `POST /api/payments/paypal/capture`.
5. On `COMPLETED`:
   - write a `payments` row (rail `paypal`, capture id, amount, payer email, status),
   - mark the obligation paid, log the event,
   - file a signed receipt referencing the capture id (existing `createReceipt`),
   - optionally anchor that receipt through the existing Base Sepolia path (`anchorReceipt`) — fiat payment, onchain proof. This is the differentiator and keeps Base in the submission.
6. `PAYMENT.CAPTURE.COMPLETED` / `DENIED` / `REFUNDED` webhook is the source of truth for reconciliation.

**Non-negotiable correctness:**
- Amount and currency are read from the obligation, then re-checked against the capture response.
- Capturing the same order twice is a no-op (idempotent, keyed on `order_id`).
- A failed or cancelled approval leaves the obligation untouched and says so plainly.

### Flow B — Seller payout to PayPal (stretch, cut on Gate 2)

The seller desk already records payouts in a ledger and literally says *"Connect a payout provider to move funds."*

1. Add `paypal` to `METHODS` in `src/views/Seller.tsx`; store the seller's PayPal email.
2. `requestPayout` → PayPal **Payouts** API, `sender_batch_id` = payout id (idempotent), receiver email, USD, note.
3. `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` / `FAILED` webhook flips the payout status.
4. If Payouts is not enabled on the sandbox account, **cut Flow B** and leave the existing "recorded payout" behaviour. Do not fake it.

### Explicitly out of scope

- No PayPal balance, custody, or wallet.
- No subscriptions or plan billing through PayPal (the plan/billing module stays as is).
- No refunds UI in v1; refunds are handled in the PayPal dashboard and reconciled by hand.
- No change to the escrow contracts.
- No claim of production PayPal availability.

---

## 4. Architecture

**New**
- `server/paypal.mjs` — config, OAuth token cache, `createOrder`, `captureOrder`, `createPayout`, `verifyWebhook`, error mapping. No SDK; plain `fetch`, so tests can stub it.
- `server/payments.mjs` — ledger and state machine (`created → approved → captured → refunded/failed`), idempotency keys, amount guards.
- `test/paypal.test.mjs` — mocked fetch: happy path, amount mismatch, double capture, webhook signature failure, payout failure.
- `.env.example` — `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENV=sandbox`, `PAYPAL_BASE_URL`.

**Changed**
- `server/index.mjs` — six routes, all behind the existing session check and rate limiter.
- `src/views/Obligations.tsx` — pay button, return banner, receipt link.
- `src/views/Seller.tsx` — PayPal payout method.
- `src/types.ts` — `Payment`, payout method union.
- `README.md` — hackathon section and architecture note.

**Routes**

```
POST /api/payments/paypal/orders        { obligation_id } -> { order_id, approve_url }
POST /api/payments/paypal/capture       { order_id }      -> { payment, obligation, receipt }
POST /api/payments/paypal/payouts       { payout_id }     -> { payout, provider_batch_id }
POST /api/paypal/webhook                                  -> 200 (signature verified, deduped)
GET  /api/payments                                        -> ledger for the workspace
POST /api/payments/paypal/refund        (stretch)
```

**Ledger shape**

```ts
{
  id, kind: "obligation" | "payout",
  rail: "paypal" | "usdc",
  status: "created" | "approved" | "captured" | "failed" | "refunded",
  amount, currency: "USD",
  obligation_id?, payout_id?,
  order_id, capture_id?, payer_email?,
  provider_status, created_at, updated_at
}
```

The existing store is collection-based (`put` / `loadAll`), so no SQL migration is required for SQLite. Confirm the Postgres path accepts the new collection before Gate 1 — that migration is already outstanding.

---

## 5. Ten-day plan

Today is **Sat Oct 31**. Deadline is **Thu Nov 12, 23:00 EAT**. Ten working days, two days of buffer.

| Day | Date | Work | Exit test |
| --- | --- | --- | --- |
| 0 | Sat Oct 31 | **Gate 0 — PASSED.** Sandbox app created; order `3GB45974EW376684L` approved and captured as `8VP38066GM276680L`, `COMPLETED`, $1.00 USD, payer `sb-p5ewy53639394@personal.example.com`. | A sandbox order is created and captured. ✅ |
| 1 | Sun Nov 1 | `server/paypal.mjs`: token cache, orders, capture, typed errors. | Unit tests against mocked fetch pass. |
| 2 | Mon Nov 2 | `server/payments.mjs`: ledger, transitions, idempotency, amount guard. Routes wired. | `POST /orders` + `POST /capture` work in sandbox. |
| 3 | Tue Nov 3 | Obligation UI: pay button, return/cancel banner, receipt link. | Pay a seeded obligation end to end in the browser. |
| 4 | Wed Nov 4 | Webhooks + signature verification + dedupe + reconciliation of missed callbacks. | Replayed webhook is a no-op; forged one is rejected. |
| 5 | Thu Nov 5 | **Gate 2 — PASSED EARLY (Oct 31).** Payouts enabled: batch `9J9GRPXKYC9AA`, item `SUCCESS`, $1.00 to the sandbox personal account. Flow B is real; keep it in scope. | Sandbox payout reaches a sandbox seller account. ✅ |
| 6 | Fri Nov 6 | Hardening: rate limits, failure copy, currency guard, audit events, sanctions screen unchanged. | `npm test`, `npm run typecheck`, `npm run build` clean. |
| 7 | Sat Nov 7 | UI polish, mobile, empty/error states, README skeleton. | No raw provider errors reach the user. |
| 8 | Sun Nov 8 | Record the 3-minute demo against sandbox. | Video under 3:00, audio clean, captions. |
| 9 | Mon Nov 9 | **Gate 3.** Repo public, README hackathon section, submission text, Devpost fields. | Public clone builds and tests pass from scratch. |
| 10 | Tue Nov 10 | Full QA on production build; submit. | Submission confirmed on Devpost. |
| — | Nov 11–12 | Buffer. Fix only what the demo touches. | — |

Effort: roughly 60–70 focused hours. This is the whole critical path; nothing else should be scheduled in that window.

---

## 6. What stays USDC-only

| Surface | Rail | Why |
| --- | --- | --- |
| Marketplace escrow | USDC on Base | The escrow contract is the product's trust primitive. PayPal cannot replicate "release on accepted proof" without custody. |
| Agent-to-agent settlement | USDC | Agents hold keys, not PayPal accounts. |
| Receipt anchoring | Base (Sepolia today) | A PayPal capture can *produce* a receipt that gets anchored; the anchor itself stays onchain. |
| Plan billing | Unchanged | No PayPal subscription work in v1. |

The honest framing: **PayPal is a payment rail; Base is the proof rail.** Do not blur the two in the submission.

---

## 7. Making the repo public

Verified today: `.env` and `.env.local` were never committed; the only secret-shaped strings in history are `DEPLOYER_PRIVATE_KEY=0x...` placeholders in the README and `contracts/deploy.mjs`. Repo is 14 MB.

Checklist before flipping:

- [ ] `LICENSE` is MIT and visible (already).
- [ ] Add `SECURITY.md` with a real contact — the current `security@remindify.app` is a placeholder. Use a real address or a GitHub security advisory.
- [ ] Scrub seed data of anything resembling a real person: names, phone numbers, emails, account numbers.
- [ ] Confirm no `.env*` files are tracked; add a test that fails if one is.
- [ ] Replace placeholder support addresses in the README or mark them clearly.
- [ ] Add the "What was added for the PayPal AI Hackathon" section with the commit range.
- [ ] Tag the submission commit (`paypal-hackathon-2026`) so the work is dateable.
- [ ] Rotate any key that has ever been pasted in chat before the repo goes public.

Public means public: the pitch deck, the application packs and the financial model in `FUNDING.md` all become readable. Decide whether those files should be in the public tree or moved out first.

---

## 8. Demo video (under 3:00)

| Time | Beat |
| --- | --- |
| 0:00 | The problem: a $612 obligation, due in two days, and a marketplace job nobody wants to chase. |
| 0:20 | The register: owner, backup, autonomy ceiling, proof required. Reuse existing footage. |
| 0:50 | **Pay with PayPal** on the obligation → sandbox approval → captured → marked paid. |
| 1:35 | The receipt: signed, referencing the PayPal capture, anchored on Base Sepolia. Say **testnet, unaudited**. |
| 2:05 | **Seller payout to PayPal** → webhook confirms → ledger shows paid. |
| 2:35 | Close: "Agents prepare. You approve. Money moves on proof — PayPal or USDC." |

Rules: sandbox UI is visible and labelled; no claim of live PayPal availability; no revenue or user numbers.

---

## 9. Risks and honest constraints

1. **PayPal in Ethiopia.** PayPal's country support for receiving money is limited; the hackathon runs on sandbox, and the submission must say so. Do not imply a live Ethiopian PayPal launch.
2. **24,900 entrants.** Expected value is low. The real return is a fiat rail, a public repo, and a distribution story — not the prize.
3. **Payouts API access.** Often gated. Gate 2 exists so we can cut Flow B without losing the core.
4. **Public repo exposure.** Everything in the tree becomes readable, including the funding ask and the application packs.
5. **Two weeks, one founder.** The Base Builder Grant submission is still pending and should be finished first; it needs no code.
6. **Pricing inconsistency.** `server/billing.mjs` says Studio $49 / Firm $199, while the public site and every application say Studio $18 / Operator $48. Fix before the demo or a judge will catch it.

---

## 10. Gates

- **Gate 0 (today):** sandbox app created, one order created and captured with `curl`. If PayPal blocks the account or the API from this network, stop and do not spend the ten days.
- **Gate 1 (Nov 2):** end-to-end sandbox capture through our own routes.
- **Gate 2 (Nov 5):** Payouts enabled? If not, ship Flow A only.
- **Gate 3 (Nov 9):** demo recorded and repo public. If not, submit Flow A with the existing video re-cut and no payout claims.

Each gate is a stop, not a slip. Slipping a gate by more than a day means cutting scope, not the deadline.

---

## 11. Submission fields (draft, fill after Gate 3)

- **Project name:** Remindify — pay on proof, with PayPal or USDC.
- **Elevator pitch:** Delegated work becomes payable: an agent prepares it, you approve it, proof is filed, and money moves through PayPal or USDC escrow on Base.
- **Built with:** PayPal Orders v2, PayPal Payouts, PayPal Webhooks, Node.js, React, SQLite/Postgres, Solidity, Base Sepolia.
- **What was new:** the PayPal rail, ledger, webhook reconciliation, and payout path — commit range `paypal-hackathon-2026`.
- **What pre-existed:** the register, capture, agents, marketplace, receipts and Base Sepolia contracts, built before October 1, 2026, MIT licensed.
- **Demo:** 3-minute video, sandbox labelled.
- **Try it:** live URL + a seeded sandbox account.
