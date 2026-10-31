# Devpost submission — PayPal AI Hackathon

Deadline: **November 12, 2026, 12:00pm PST** (23:00 EAT).
Repo: <https://github.com/kiozaghi/remindify-paypal> (public, MIT).
Build scope and gates: [PAYPAL-HACKATHON.md](./PAYPAL-HACKATHON.md).

---

## 1. Fields to paste into Devpost

**Project name**

> Remindify — money moves on proof

**Elevator pitch**

> Remindify turns recurring obligations into risk-scored, proof-backed work that humans and AI agents own together. An agent prepares the action, you approve it, proof is filed, and the money moves through PayPal — while the proof rail stays on Base. The agent never holds the funds.

**Inspiration**

> Everyone has a list of things that come back: rent, filings, renewals, payroll, the dentist. Reminders tell you about them and then leave you to it. Agents can now do the work, but handing an agent your money is the part nobody has solved. Remindify gives each obligation an owner, a backup, an autonomy ceiling and a proof requirement — so delegation is safe enough to pay for.

**What it does**

> The register is the product. Every obligation has a risk score, an owner and a named backup, an autonomy level (`notify → prepare → approve → autopilot`) capped by the assignee's passport, and a proof requirement. Agents act inside those limits; when a deadline is missed, the backup actually takes ownership, the escalation is written to the audit trail, and you can reclaim it.
>
> PayPal is the fiat rail. Pay an obligation from its drawer: the server creates an Orders v2 order from the stored obligation, redirects to PayPal, verifies the amount on capture, marks the obligation paid and files a receipt referencing the capture. Sellers get paid through Payouts v1 in a deliberate two-step flow, and the ledger only shows paid when PayPal confirms. Webhooks are signature-verified; forged events cannot close an obligation.

**How I built it**

> React 19 + Vite on the front, a plain Node HTTP server on the back, SQLite locally and Postgres on Vercel. No PayPal SDK — plain `fetch` against the REST APIs, with a mocked-fetch test suite for orders, capture, payouts and webhook verification. Agents execute through HMAC-SHA256-signed connectors; the seeded demo agents point at a first-party sandbox executor so judges can watch the real run → proof → receipt path without moving money.

**Challenges**

> Keeping money and proof honestly separate. A PayPal capture can produce a receipt, but the receipt's finality is a Base concern; the UI and copy never blur the two. The second hard part was making an agent's failure legible: a run that could not execute must never look completed, so execution is only reported when a connector answers and the sweep says how many obligations are waiting on one.

**Accomplishments**

> A complete, tested rail rather than a demo stub: idempotent capture, server-side amount guards, declined-card copy that explains what PayPal actually said, orders that expire instead of haunting the ledger, signed webhooks, payout state reconciliation, a visible ledger, real backup handover, and 43 passing tests covering the money paths and workspace isolation.

**What I learned**

> Trust in agent products is mostly about the failure path. Autonomy ceilings, named backups, proof requirements and an audit trail matter more than the happy path — and "the agent tried" is not the same as "the money moved."

**What's next**

> More rails behind the same proof contract (bank transfer where PayPal does not reach), a durable job runner for machine writes, and turning the marketplace's proof-on-delivery into the default way small teams hire.

**Built with**

> PayPal Orders v2, PayPal Payouts v1, PayPal Webhooks, Node.js 22, React 19, Vite 6, SQLite, Postgres (Neon), Solidity, Base Sepolia.

**Try it**

> Live: <https://remindify-xi.vercel.app> — **confirm it serves this commit before submitting.** The site responds, but on 31 Oct its bundle still predated `c58e554`, so the new repository is evidently not yet connected to the Vercel project. If it is still stale on submission day, drop the live link and point judges at the local run below.
> Local, no credentials needed:
>
> ```bash
> git clone https://github.com/kiozaghi/remindify-paypal
> cd remindify-paypal && npm install && npm run build && npm start
> ```
>
> Open <http://localhost:4178>, create an account, and follow the two-minute path in the README. PayPal sandbox credentials are only needed for the live order and payout beats.

**What was new for the hackathon**

> The entire PayPal rail — `server/paypal.mjs`, `server/payments.mjs`, the six payment routes, the obligation pay button, the seller payout flow, the PayPal ledger on Trust, the signed sandbox executor and backup handover — landed in **`f7d5310..HEAD` on `main`**, all after 1 October 2026. The register, capture, agents, marketplace, receipts and Base contracts are the pre-existing product, MIT licensed.

---

## 2. Demo video script (target 2:40, hard limit 3:00)

Record against a fresh account on the local production build so the seed is alive. Sandbox UI must be visibly labelled.

| Time | Picture | Voice-over |
| --- | --- | --- |
| 0:00 | Today, scrolled to the closest-to-edge rows | "A $612 car loan is due in two days. A payroll filing is due in four. This is the work that comes back — and the work agents should be able to carry." |
| 0:15 | Obligation drawer: owner, backup, autonomy, proof required, consequence | "Every obligation has an owner, a named backup, a risk score, an autonomy ceiling and the proof that counts as done. That structure is what makes it safe to delegate." |
| 0:35 | Hover agent passport, connector badge | "Agents hold scopes, not keys. They act only inside their ceiling, and only through a signed connector." |
| 0:50 | Car service → Run now → Approve → approve drawer → run + proof appears | "I approve the action. The connector receives a signed request, answers with proof, the run is logged, and a completion receipt is filed." |
| 1:15 | Trust → receipt → Sign; optionally Anchor on Base Sepolia | "Proof is offchain by default, signed as EIP-712, and anchored only when a third party needs finality. This is the proof rail." |
| 1:35 | Obligation with amount → **Pay with PayPal** → sandbox login → return → captured banner | "This is the money rail. The order is built on the server from the stored obligation — never from the browser. The capture is checked against the stored amount, the obligation closes, and the receipt references the PayPal capture. Sandbox, so no real money." |
| 2:10 | Seller desk → payout method PayPal → request → **Send with PayPal** → ledger row | "Sellers get paid through Payouts — request, then send. Nothing says paid until PayPal confirms." |
| 2:30 | Trust → PayPal ledger rows | "Every order, capture and payout keeps its PayPal reference in the same audit trail as the proof." |
| 2:40 | Overdue obligation drawer, coral handover banner → Reclaim | "And when the work slips anyway, the backup takes over, it is written down, and you can take it back. Agents prepare. You approve. Money moves on proof." |

If the sandbox buyer sign-in will not record cleanly, cut from 1:35 to the ledger row already captured, state that the capture was performed in sandbox, and keep the payout beat — never stage a fake success.

---

## 3. Judge test path (what a reviewer should do)

1. `npm install && npm run build && npm start`, open `http://localhost:4178`, create an account.
2. **Today → Run agent sweep.** Watch the summary: executed vs waiting-on-executor.
3. **Obligations → Car service → Run now → Approve & run.** The seeded agent executes through the built-in sandbox connector; the drawer timeline shows the signed run and `sandbox_executor_*` proof; a receipt appears under Trust.
4. **Obligations → Water filter / dental row.** After the sweep, overdue obligations with a backup show the handover banner; **Reclaim** restores the owner and keeps history.
5. **Trust.** Open a receipt → Sign. Open the PayPal ledger (empty until a sandbox payment is made).
6. **Seller desk.** Set a payout method to PayPal, request a payout, press **Send with PayPal** (requires sandbox credentials).
7. **Agent access.** Create a key, run `npm run mcp`, or hit `/api/v1/obligations` with the key to show agent parity.

Expected without any PayPal credentials: steps 2–5 and 7 work; step 6 explains that PayPal is not configured. With sandbox credentials, everything works end to end.

---

## 4. Pre-submit checklist

- [x] Public repo with visible MIT licence.
- [x] README hackathon section with the commit range, run steps and demo path.
- [x] Real contact address in the site, security policy and README.
- [x] `npm test` (43 passing), `npm run typecheck`, `npm run build` clean.
- [x] Sandbox executor proves the agent run lifecycle; handover and reclaim are real.
- [x] Agent sweep run in the browser: approval → sandbox execution → proof `sandbox_executor_run_*` → receipt → obligation rescheduled.
- [x] Handover run in the browser: dental check-up declined its approval, clock advanced +7 days, four obligations escalated to their backups, banner read "Kin owns this now", Reclaim restored the owner and kept history.
- [x] PayPal order creation, approval redirect, return/cancel handling and the decline path exercised against the live sandbox API.
- [x] PayPal ledger on Trust; payout flow is two-step and labelled.
- [ ] **Capture on camera:** sign in with the sandbox buyer account (see §6). Guest card checkout does not work for this merchant.
- [x] Push the final commit and tag `paypal-hackathon-2026`. `main` is at `1d57353`; the tag is pushed.
- [ ] Set repo topics/description/homepage on GitHub (no `gh` CLI on this machine — 30 seconds in the repo settings; suggested topics: `paypal`, `paypal-apis`, `ai-agents`, `hackathon`, `react`, `nodejs`).
- [ ] Deploy this branch to the public Vercel project and confirm the seeded sign-in works. No Vercel CLI/token on this machine; the GitHub integration should redeploy `main` if the new repo is connected.
- [ ] Record the video against the live or local sandbox build, under 3:00.
- [ ] Paste fields into Devpost and submit before **Nov 12, 12:00pm PST**.

---

## 5. Honest limits to state on camera

- PayPal receiving in Ethiopia is limited; the payout is demonstrated with a sandbox receiver. Do not claim live availability.
- The Base anchor is Sepolia testnet, unaudited. Say "testnet, unaudited" on camera.
- Sandbox executor responses are first-party confirmations, not a third-party provider. The UI says "sandbox".
- Prices, revenue and user counts are not claimed.

---

## 6. Demo pre-flight (checked 31 Oct)

Environment: `npm run build && npm start` on <http://localhost:4178>, with `PAYPAL_ENV`, `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` exported in the shell. `npm start` does **not** read `.env.local`; export only the three PayPal variables so the database stays on local SQLite.

**The one thing that does not work from a cold start is paying as a guest with a card.** The sandbox merchant is registered in Ethiopia, and PayPal's guest card form refuses to add test cards on that merchant ("We weren't able to add this card"), or declines them at capture (`INSTRUMENT_DECLINED`). Creating a new sandbox buyer on the same page requires an SMS OTP, which cannot be completed here.

**Pay with the sandbox buyer account instead.** The Gate 0 capture ($1.00, capture `8VP38066GM276680L`) was made with `sb-p5ewy53639394@personal.example.com`. That password lives in the PayPal developer dashboard (Sandbox → Accounts) or your password manager — it is not stored in this repo.

Capture beat for the video:

1. Obligations → an unpaid obligation with an amount (the $18 prescription refill is the cheapest) → **Pay with PayPal**. The server builds the order; the browser goes to `sandbox.paypal.com`.
2. Log in as the sandbox buyer. If you are already signed in, PayPal skips straight to the review page.
3. Confirm the $18 order → return to `/obligations?paypal=return&token=…`. The app captures, toasts "Paid with PayPal", closes the obligation and files a receipt.
4. Trust → PayPal ledger shows `captured` with the capture id and payer email.

If sign-in fails on camera, cut to the ledger and say the capture was performed in sandbox — do not stage a fake success.

**What is already proven in the ledger** (safe to show even if capture is skipped):

| Row | Status | What it proves |
| --- | --- | --- |
| Amoxicillin $18 | `expired` | An abandoned checkout is closed by the sweep instead of reading "awaiting payer" forever. |
| Car loan $612 | `failed` · `instrument_declined` | PayPal's decline is translated into plain English, the code is kept, and the obligation stays open for a retry. |

**Reset before recording.** The header has **Reset demo**; it returns the seeded workspace to 31 Oct with a clean ledger. Do this after experimenting.

**New since the first checklist pass:**

- PayPal issue codes are mapped to human copy (`server/paypal.mjs`); 4xx declines now return 4xx, not a fake 502.
- `markFailed` records `provider_status` and `failure_code`, rendered as a chip in the ledger.
- Sweeps expire unpaid orders after three hours of virtual time (`expireStalePayments`), so the ledger tells the truth.
- Reclaim timestamps use the virtual clock, so a reclaim can never precede the handover it reverses (regression test in `test/handover.test.mjs`).
