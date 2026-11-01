# Devpost submission — PayPal AI Hackathon

Deadline: **November 12, 2026, 12:00pm PST** (23:00 EAT).
Repo: <https://github.com/kiozaghi/remindify-paypal> (public, MIT), branch **`feat/paypal-agentic-commerce`**.
Build scope and gates: [PAYPAL-HACKATHON.md](./PAYPAL-HACKATHON.md).

---

## 1. Fields to paste into Devpost

**Project name**

> Remindify — money moves on proof

**Elevator pitch**

> Remindify is the governance and escrow layer for recurring business operations: vendor renewals, compliance filings, contractor deliverables and invoice collections. An AI agent prepares the work, a human approves inside a spending ceiling, the proof auditor verifies the evidence, and only then does PayPal move the money.

**Inspiration**

> Every founder runs a back office nobody put on the org chart: the licence that expires, the contractor whose W-9 is missing, the vendor invoice that goes out late, the payroll filing that is due on the 25th. Reminders tell you about them and leave you to it. Agents can now do the work, but handing an agent your money is the part nobody has solved. Remindify gives each obligation an owner, a backup, an autonomy ceiling and a proof requirement — so delegation is safe enough to pay for.

**What it does**

> The register is the product. Every obligation has a risk score, an owner and a named backup, an autonomy level (`notify → prepare → approve → autopilot`) capped by the assignee's passport and spend ceiling, and a proof requirement. Agents act inside those limits; when a deadline is missed, the backup actually takes ownership, the escalation is written to the audit trail, and you can reclaim it.
>
> Capture is AI-first: paste a renewal letter, a filing notice or a contractor email and Gemini 2.5 Flash returns structured obligations with amounts, dates, proof requirements and the right agent. Without a model key the deterministic parser produces the same shape, so judges can run it with no credentials.
>
> Money moves on proof. An escrow is a PayPal authorization hold: the payer approves, the agent delivers, the AI auditor verifies the receipt, and only then does Remindify capture the hold, deduct its 10% application fee and pay the provider through Payouts. The escrow is always visible in the register — `AUTHORIZED_HOLD`, `AI_AUDITED`, `PAYOUT_RELEASED`.
>
> PayPal is the only money rail. Pay an obligation from its drawer: the server creates an Orders v2 order from the stored obligation, redirects to PayPal, verifies the amount on capture, marks the obligation paid and files a receipt referencing the capture. Receivables go out as PayPal invoices — created and then sent, never left as drafts — with reminders. Sellers get paid through Payouts v1 in a deliberate two-step flow, and the ledger only shows paid when PayPal confirms. Webhooks are signature-verified; forged events cannot close an obligation.

**How I built it**

> React 19 + Vite on the front, a plain Node HTTP server on the back, SQLite locally and Postgres on Vercel. The obligation grid is AG Grid with custom cells for the risk meter, inline autonomy, agent passport and PayPal escrow state. PayPal Orders and the authorize/capture primitives run through the APIMatic-generated `@paypal/paypal-server-sdk`; Payouts v1, Invoicing v2 and webhook verification stay on the REST client because the SDK does not cover them. Each request is idempotent (`PayPal-Request-Id`, `sender_batch_id`), and workspaces are isolated in Postgres behind a workspace-scoped advisory lock. Gemini 2.5 Flash is called with structured output for capture and proof audit, with deterministic fallbacks so the demo never depends on a model being reachable.

**Challenges**

> Keeping money and proof honestly separate. A PayPal capture produces a receipt, but a receipt is evidence, not settlement; the UI and copy never blur the two. PayPal has no platform-fee field, so the 10% fee cannot be taken by the order itself — the rail authorizes the full amount, captures only after a verified proof, and pays the provider the net through Payouts. Invoicing has a trap: a created invoice is a draft that nobody receives until it is sent, so the rail always sends. Without a webhook id, PayPal cannot sign an event, so the app refuses to apply unsigned events and the sandbox simulator is gated behind an explicit flag. And an agent's failure has to be legible: a run that could not execute must never look completed.

**Accomplishments**

> A complete, tested rail rather than a demo stub: AI capture with a deterministic fallback, server-side amount guards, idempotent orders and payouts, declined-card copy that explains what PayPal actually said, orders that expire instead of haunting the ledger, signed webhooks, payout state reconciliation, PayPal invoicing for receivables, authorization-hold escrow with a 10% application fee, an AI proof auditor that gates every release, a workspace-scoped Postgres lock, real backup handover, and 52 passing tests covering the money paths, the multimodal auditor and workspace isolation.

**What I learned**

> Trust in agent products is mostly about the failure path. Autonomy ceilings, named backups, proof requirements and an audit trail matter more than the happy path — and "the agent tried" is not the same as "the money moved."

**What's next**

> More settlement options behind the same proof model (bank transfer where PayPal does not reach), a durable job runner for machine writes, and turning proof-on-delivery into the default way small teams hire contractors.

**Built with**

> PayPal Orders v2, PayPal Authorizations v2, PayPal Payouts v1, PayPal Invoicing v2, PayPal Webhooks, APIMatic PayPal Server SDK, Gemini 2.5 Flash, AG Grid, Node.js 22, React 19, Vite 6, SQLite, Postgres (Neon).

**Try it**

> Live: <https://remindify-paypal.vercel.app> — **confirm it serves this branch before submitting.** The Vercel project must be pointed at this repository and `PUBLIC_ORIGIN` set to the same host. If it is not live on submission day, drop the live link and point judges at the local run below.
> Local, no credentials needed:
>
> ```bash
> git clone https://github.com/kiozaghi/remindify-paypal
> cd remindify-paypal && git checkout feat/paypal-agentic-commerce
> npm install && npm run build && npm start
> ```
>
> Open <http://localhost:4178>, create an account, and follow the three-minute path in the README. PayPal sandbox credentials are only needed for the live order, payout and invoice beats.

**What was new for the hackathon**

> The entire PayPal rail — `server/paypal.mjs`, `server/paypal-sdk.mjs`, `server/payments.mjs`, the payment and escrow routes, AI capture, the proof auditor, the invoicing flow, the AG Studio grid, the escrow strip, the obligation pay button, the seller payout flow, the sandbox executor and backup handover — landed on **`feat/paypal-agentic-commerce`**, all after 1 October 2026. The register, agents, marketplace and receipts are the pre-existing product, MIT licensed.

---

## 2. Demo video script (target 3:00, hard limit 3:00)

Record against a fresh account on the local production build so the seed is alive. Sandbox UI must be visibly labelled.

| Time | Picture | Voice-over |
| --- | --- | --- |
| 0:00 | Today: escrow strip `$180 HELD`, the Apex approval, closest-to-edge rows | "Every business runs a back office nobody put on the org chart: a $180 filing hold waiting on proof, a Kestrel deliverable needing a W-9, a payroll filing due in four days. This is the work that comes back — and the work agents should carry." |
| 0:25 | Capture → paste the Delaware withholding notice → review drafts → import; flip to Agent Studio | "Capture is AI-first. Gemini reads the notice and returns the obligation, the amount, the due date and the proof that counts. The register is AG Grid: risk, inline autonomy, the agent's passport and spend cap, and the PayPal escrow state — one governed surface." |
| 1:05 | Time Machine +7 days → sweep summary; open the Northwind retainer → **Send invoice** | "Time moves. The sweep runs every agent: those with a connector act, those without one draft, and overdue work escalates to its named backup. The collector sends the Northwind retainer as a PayPal invoice — created, then sent, never left as a draft." |
| 1:50 | Pre-staged $180 sandbox hold → attach the wrong-amount PDF → auditor rejects; attach the verified stamped receipt → capture $180 → $18 fee → $162 payout; Trust ledger | "The hold is already authorized, so the only question is proof. The wrong PDF fails the auditor on the amount. The stamped receipt clears it: PayPal captures $180, the 10% fee is $18, and $162 pays out through Payouts. The ledger keeps every PayPal reference next to the proof." |
| 2:40 | Agent access / MCP terminal, then back to the register | "Agents and humans share the same surface — over REST and MCP, with scopes, ceilings and a full audit trail. Agents prepare. You approve. Money moves on proof." |

If the sandbox buyer sign-in will not record cleanly, cut from the pay beat to the ledger row already captured, state that the capture was performed in sandbox, and keep the escrow release beat — never stage a fake success.

The shot-by-shot plan, pre-flight checks and fallbacks live in [`deck/demo-script.md`](deck/demo-script.md). Stage the $180 sandbox hold before recording: the seeded `DEMO-AUTH-APEX-180` row is a rehearsal with placeholder ids and now refuses release with an explanation, so the recorded capture uses a fresh authorization created from the filing.

---

## 3. Judge test path (what a reviewer should do)

1. `npm install && npm run build && npm start`, open `http://localhost:4178`, create an account.
2. **Today.** The escrow strip shows the seeded `$180` Apex hold in flight. Open the approval; the proposal releases only against the stamped receipt.
3. **Obligations → Agent Studio.** Risk meter, inline autonomy, agent passport with spend cap and escrow state per row.
4. **Obligations → Facilities service → Run now → Approve & run.** The seeded Mileage agent executes through the built-in sandbox connector; the drawer timeline shows the signed run and `sandbox_executor_*` proof; a receipt appears under Trust.
5. **Time machine → +7 days.** The overdue contractor NDA escalates to its backup; **Reclaim** restores the owner and keeps history.
6. **Trust.** Open the Apex receipt and run **Audit** with the wrong file, then the verified one. Open the PayPal ledger.
7. **Seller desk.** Set a payout method to PayPal, request a payout, press **Send with PayPal** (requires sandbox credentials).
8. **Agent access.** Create a key, run `npm run mcp`, or hit `/api/v1/obligations` with the key to show agent parity.

Expected without any PayPal credentials: steps 2–6 and 8 work; step 7 explains that PayPal is not configured. With sandbox credentials, everything works end to end.

---

## 4. Pre-submit checklist

- [x] Public repo with visible MIT licence.
- [x] README hackathon section with the commit range, run steps and demo path.
- [x] Real contact address in the site, security policy and README.
- [x] `npm test` (52 passing), `npx tsc --noEmit`, `npm run build` clean.
- [x] Sandbox executor proves the agent run lifecycle; handover and reclaim are real.
- [x] Agent sweep run in the browser: approval → sandbox execution → proof `sandbox_executor_run_*` → receipt → obligation rescheduled.
- [x] Handover run in the browser: an overdue contractor obligation declined its approval, clock advanced +7 days, obligations escalated to their backups, banner read "Kin owns this now", Reclaim restored the owner and kept history.
- [x] PayPal order creation, approval redirect, return/cancel handling and the decline path exercised against the live sandbox API.
- [x] PayPal ledger on Trust; payout flow is two-step and labelled.
- [x] Authorization-hold escrow, 10% application fee and AI proof auditor exercised in the browser.
- [x] PayPal invoicing and reminders covered by tests.
- [ ] **Capture on camera:** sign in with the sandbox buyer account (see §6). Guest card checkout does not work for this merchant.
- [x] Pushed `feat/paypal-agentic-commerce`; `paypal-hackathon-2026` tags the submission commit.
- [ ] Set repo topics/description/homepage on GitHub (no `gh` CLI on this machine — 30 seconds in the repo settings; suggested topics: `paypal`, `paypal-apis`, `ai-agents`, `hackathon`, `react`, `nodejs`).
- [ ] Deploy the branch to the `remindify-paypal` Vercel project and confirm the seeded sign-in works (runbook in §7).
- [ ] Record the video against the live or local sandbox build, under 3:00. **`public/demo/remindify-demo.mp4` is still the pre-scrub recording (car loan, dental check-up, "people and money") — replace it with the new 3:00 capture before deploying; the poster and OG card are already rebuilt from the B2B seed.**
- [ ] Paste fields into Devpost and submit before **Nov 12, 12:00pm PST**.

---

## 5. Honest limits to state on camera

- PayPal receiving in Ethiopia is limited; the payout is demonstrated with a sandbox receiver. Do not claim live availability.
- The proof auditor uses Gemini 2.5 Flash when `GEMINI_API_KEY` is set and deterministic rules otherwise; say which engine is shown.
- Sandbox executor responses are first-party confirmations, not a third-party provider. The UI says "sandbox".
- Prices, revenue and user counts are not claimed.

---

## 6. Demo pre-flight (checked 31 Oct)

Environment: `npm run build && npm start` on <http://localhost:4178>, with `PAYPAL_ENV`, `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` exported in the shell. `npm start` does **not** read `.env.local`; export only the PayPal variables so the database stays on local SQLite.

**The one thing that does not work from a cold start is paying as a guest with a card.** The sandbox merchant is registered in Ethiopia, and PayPal's guest card form refuses to add test cards on that merchant ("We weren't able to add this card"), or declines them at capture (`INSTRUMENT_DECLINED`). Creating a new sandbox buyer on the same page requires an SMS OTP, which cannot be completed here.

**Pay with the sandbox buyer account instead.** The Gate 0 capture ($1.00, capture `8VP38066GM276680L`) was made with `sb-p5ewy53639394@personal.example.com`. That password lives in the PayPal developer dashboard (Sandbox → Accounts) or your password manager — it is not stored in this repo.

Capture beat for the video:

1. Obligations → an unpaid obligation with an amount (the $18 first-aid restock is the cheapest) → **Pay with PayPal**. The server builds the order; the browser goes to `sandbox.paypal.com`.
2. Log in as the sandbox buyer. If you are already signed in, PayPal skips straight to the review page.
3. Confirm the $18 order → return to `/obligations?paypal=return&token=…`. The app captures, toasts "Paid with PayPal", closes the obligation and files a receipt.
4. Trust → PayPal ledger shows `captured` with the capture id and payer email.

If sign-in fails on camera, cut to the ledger and say the capture was performed in sandbox — do not stage a fake success.

**What is already proven in the ledger** (safe to show even if capture is skipped):

| Row | Status | What it proves |
| --- | --- | --- |
| First-aid restock $18 | `expired` | An abandoned checkout is closed by the sweep instead of reading "awaiting payer" forever. |
| Equipment loan $612 | `failed` · `instrument_declined` | PayPal's decline is translated into plain English, the code is kept, and the obligation stays open for a retry. |

**Reset before recording.** The header has **Reset demo**; it returns the seeded workspace to 31 Oct with a clean ledger. Do this after experimenting.

**New since the first checklist pass:**

- PayPal issue codes are mapped to human copy (`server/paypal.mjs`); 4xx declines now return 4xx, not a fake 502.
- `markFailed` records `provider_status` and `failure_code`, rendered as a chip in the ledger.
- Sweeps expire unpaid orders after three hours of virtual time (`expireStalePayments`), so the ledger tells the truth.
- Reclaim timestamps use the virtual clock, so a reclaim can never precede the handover it reverses (regression test in `test/handover.test.mjs`).

---

## 7. Deploy runbook (Vercel, `remindify-paypal`)

The hosted preview at `remindify-xi.vercel.app` serves an older build; `remindify-paypal.vercel.app` does not exist yet, and every canonical URL, the deck and `package.json` already point at it. Create that project rather than renaming strings.

1. **Import.** Vercel → Add New… → Project → Import Git Repository → `kiozaghi/remindify-paypal`. Leave Root Directory at `./`. The framework preset may read `vite`; `vercel.json` already sets build `npm run build` and output `dist`.
2. **Node version.** Settings → General → Node.js Version → **22.x** (`package.json` requires `>=22`; `node:sqlite` is only a local fallback).
3. **Environment variables** (Production and Preview):

   | Name | Value | Why |
   | --- | --- | --- |
   | `DATABASE_URL` | your Neon **pooled** connection string | Required. Without it the server falls back to SQLite, which cannot write on Vercel. |
   | `PUBLIC_ORIGIN` | `https://remindify-paypal.vercel.app` | PayPal return URL, canonical links, cookie origin. |
   | `PAYPAL_ENV` | `sandbox` | Keeps the demo off live money. |
   | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | sandbox app credentials | Orders, Payouts, Invoicing. |
   | `PAYPAL_WEBHOOK_ID` | the registered webhook id | Without it events are acknowledged but not applied. |
   | `COOKIE_SECURE` | `true` | Session cookies over HTTPS only. |
   | `PAYPAL_PLATFORM_FEE_PERCENT` | `10` | Fee deducted at release. |
   | `GEMINI_API_KEY` | optional | Capture and the proof auditor use Gemini 2.5 Flash; without it both fall back to deterministic rules. |
   | `TRUST_RECEIPT_SECRET` | optional | Otherwise generated once and stored in the database, which is also stable across functions. |

   Paste secrets in the dashboard, never in chat or the repo.
4. **Serve the submission branch.** Settings → Git → Production Branch → `feat/paypal-agentic-commerce`, then Deployments → Redeploy. Alternatively deploy the branch and use ⋯ → Promote to Production.
5. **Domain.** If the project name `remindify-paypal` was free, the production domain is already `remindify-paypal.vercel.app`. Confirm under Settings → Domains before submitting.
6. **Verify on the live host:** `/` shows "Your back office never clocks out." and the DUTY/MONEY packs; `/signup` creates a workspace and seeds it; `/demo` plays the video with the three proof PDFs; `/trust` renders the ledger. Then run the judge path in §3.
7. **GitHub metadata.** Repo → About (gear) → Description "The governance and escrow layer for recurring business operations, settled on PayPal"; Website `https://remindify-paypal.vercel.app`; Topics `paypal`, `paypal-apis`, `ai-agents`, `hackathon`, `react`, `nodejs`.

Serverless has no background timers: the outbox sweep and the demo time machine run on request, so +7 days still works but nothing advances by itself between visits.
