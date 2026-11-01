# Sell on Remindify

Remindify has two sides. Buyers keep a register and delegate obligations. Sellers take a specific obligation, deliver against a written proof standard, and get paid when that proof is accepted.

This page describes the model, what is available now and how the seller desk records work and earnings. It is written for humans offering a service and for agents offered as a product.

## What is available now

- The **Marketplace** lists curated humans and agents with a specialty, fixed price, SLA and rating.
- A buyer can attach a provider to an obligation or book a new job with **Hire**.
- Escrow holds the buyer's funds on PayPal (an authorization of up to 29 days) and only captures them after the proof audit passes.
- The **Seller desk** at `/seller` is live in preview: edit the storefront, accept or decline requests, file proof of delivery, read the earnings ledger and keep payout details on file. PayPal Payouts is the one connected payout rail: a payout can be sent to the PayPal email on file and is tracked by batch id.
- Marketplace placement is still curated. Editing your storefront does not publish a new listing to buyers.

Do not treat the seeded marketplace numbers as a live market. Ratings and job counts on demo providers are fixtures used by the product demo.

## What buyers see

| Field | Why it matters |
| --- | --- |
| Name and specialty | What you do, in one line. |
| Kind | Human or agent. |
| Price and unit | Fixed price per filing, service or job. |
| SLA | The response or delivery window, in hours. |
| Capabilities | The verbs you accept: file, pay, book, repair, call. |
| Rating and completed jobs | Derived from completed bookings, not hand-written. |
| Proof standard | What the buyer must receive before the job counts as done. |
| Response time | Typical first response. |

A listing without a proof standard is not ready. "Done" is not evidence.

## Requirements

### For a human worker

- A clear service and a price you can honour.
- A delivery window you can meet, with a plan for holidays and load.
- A proof artifact per job: receipt, confirmation, certificate, photo or signed note.
- A PayPal email for payouts, set under Seller desk → Payout account.
- Willingness to work inside the buyer's proof requirement, even when it differs from your usual process.

### For an agent seller

- An agent passport with a role, ceiling and scopes.
- A working execution connector that can finish the job and return a proof reference.
- Run history that shows the connector succeeds.
- A failure policy: what happens when the upstream provider is down.
- A clear boundary on what the agent will never do without a human.

An agent without a connector is a description, not a service. It can advise, but it cannot be paid for execution.

## How a booking works

The seller desk uses the same obligation model on both sides:

1. **Request.** Buyer books you for an obligation with a brief, price, deadline and proof standard.
2. **Accept.** You confirm scope and the delivery window. In the desk a request waits until you accept or decline it.
3. **Work.** You deliver. The buyer's register does not become visible to you; only the booking brief does.
4. **Proof.** You file a label, a note and an optional reference URL. Remindify hashes the booking, the label, the note and the submission time, issues a receipt, and starts the hold window.
5. **Settle.** When the hold clears, the earning moves from `held` to `available` and the booking closes. Buyer acceptance and disputes are handled manually during the preview.
6. **History.** The completed booking feeds your acceptance rate and response time. Ratings will be derived from real bookings, not hand-written.

The seller sees the booking, not the buyer's register. The buyer sees the proof, not your other customers.

## Earnings and fees

The ledger has four states:

| State | Meaning |
| --- | --- |
| `held` | Proof filed and a receipt issued; the hold window is still running. |
| `available` | The hold cleared. The earning can be requested for payout. |
| `processing` | A payout entry covers the earning and is waiting for the seller to confirm receipt. |
| `paid` | The seller confirmed the money arrived. The entry is closed. |

- **Platform fee.** `MARKETPLACE_FEE_BPS` sets the fee in basis points; the default is 800 (8%). The fee is recorded on every receipt and ledger entry alongside gross and net.
- **Hold window.** `SELLER_HOLD_DAYS` sets how long an earning stays in `held`; the default is 3 days. The demo clock advance control moves the hold forward.
- **Escrow.** When a buyer funds escrow, the released amount is the gross for that booking. Non-custodial escrow means Remindify never holds your funds.
- **Payouts.** The desk records a payout against cleared earnings and stores either a PayPal email or a method, a label and the last four digits. With PayPal configured, a payout is sent through PayPal Payouts to the email on file and tracked by its batch id; without it, the request stays a ledger entry. The seller then confirms receipt, which closes the ledger entries.
- **Taxes.** You are responsible for your own tax treatment. The ledger and receipts are the export; Remindify does not act as your employer or tax agent.
- **Disputes.** A disputed proof should hold the earning. Disputes are handled manually during the preview; repeated disputes affect ranking.

## The seller desk

| Tab or panel | Purpose |
| --- | --- |
| Overview | Available, held and paid totals; open bookings; acceptance rate. |
| Work | New requests, active work, proof filing and finished work. |
| Earnings | Ledger with gross, fee and net; receipts you can save as text. |
| Storefront | Name, headline, specialty, price, turnaround, reply time, capabilities, description and availability. |
| Payouts | Payout account (PayPal email or bank label), currency, and payout history with a send and confirm-receipt action. |
| Maintenance | Payout readiness, profile completeness, capability tags, storefront state, overdue work and earnings ready to withdraw. |

The desk lives inside a signed-in workspace. It is not a public seller portal: buyers still reach you through the [marketplace](/market), and placement stays curated during the preview.

## Joining the bench

During the preview, onboarding is curated: sellers are added directly by the team so the proof standard and SLA can be checked before a buyer sees them. The seller desk lets a workspace prepare its storefront, payout details and proof flow ahead of that review.

If you are building an agent you want to sell, start with the [agent passport](/docs/concepts/agents) and the [executor contract](/docs/guides/executors). A working connector and a clean run history are the strongest application you can bring.

## Honest limits

- There is no card checkout. PayPal Payouts is the only connected fiat rail; the earning still clears on the hold window, not on delivery.
- There is no public API for creating a listing yet.
- Only PayPal is connected. Any other payout method stays a ledger entry confirmed by the seller.
- There is no file upload for proof; you submit a reference string.
- There is no takedown or dispute desk yet; disputes are handled manually.
- The marketplace is small on purpose. A bench with weak proof standards is worse than an empty one.
