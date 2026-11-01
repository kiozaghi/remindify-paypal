# Remindify OS

**The governance, risk and proof-gated escrow layer for PayPal agentic commerce.**

Remindify turns recurring business obligations — vendor renewals, compliance filings, contractor deliverables, invoice collections and payroll — into an owned, risk-scored, proof-backed register. AI agents and human merchants share the same work surface, each agent carries a scoped passport and a spending ceiling, and money moves only after evidence clears the proof auditor.

The repo now includes a public, story-led site and a real account gate. Anyone can read the story, pricing, security model, legal pages and manifesto. The register itself is private: email/password or Google sign-in is required.

Built from the original Remindify pitch, modernised for a world where agents are first-class operators, not just notifications.

**Live preview:** https://remindify-paypal.vercel.app

```bash
npm install
cp .env.example .env         # optional; the defaults work locally
npm run dev                  # API on :4178, app on :5173
# or
npm run build && npm start   # production build on :4178
```

Open **http://localhost:5173** (dev) or **http://localhost:4178** (built). Create an account on the first visit. Google sign-in explains what is missing until OAuth credentials are configured; email and password sign-in work without Google.

## PayPal AI Hackathon

This public repository is the hackathon entry. The licence is MIT. Everything on the PayPal rail below was written after **1 October 2026**, on top of an existing obligation register.

**What was added for this submission**

- **AI-first capture** — Gemini 2.5 Flash (`AI_MODEL_ID`, default `gemini-2.5-flash`) extracts the obligation, amount, payee PayPal email and proof requirement from pasted text. Without `GEMINI_API_KEY`, the deterministic parser runs as a fallback so the app and the test suite stay offline-safe.
- **Multimodal proof auditor** — Gemini scores the filed evidence against the obligation's amount, reference and date, and returns a confidence score plus discrepancies. Below `AUDIT_MIN_CONFIDENCE` (default 0.80) nothing settles. Without a key, the same checks run as local rules.
- **PayPal Orders v2 authorization holds** — the payer approves an `AUTHORIZE` order for up to 29 days. Nothing is captured until the auditor verifies the proof; a rejected proof leaves the hold untouched.
- **Hybrid escrow settlement** — on a verified proof the hold is captured, a 10% platform fee is computed in application logic, and the 90% net is sent to the merchant through **PayPal Payouts v1**. Standard sandbox accounts are not asked for `platform_fees`.
- **PayPal Invoicing v2** — `@ar-collector` creates and immediately sends invoices (never leaves them in `DRAFT`), then files the payer URL as proof.
- **Signed webhooks** at `/api/paypal/webhook` verify the PayPal transmission signature first. When the Developer Dashboard simulator produces a `FAILURE`, `PAYPAL_ALLOW_WEBHOOK_SIMULATOR=true` plus transmission headers accepts the event and tags the log `sandbox_simulator`.
- **Idempotent retries** — `PayPal-Request-Id` on orders and captures, `sender_batch_id` on payouts, so the durable outbox can retry safely.
- **Spending ceilings** — every seeded agent (`@ar-collector` $2,500, `@pr-escrow-bot` $500, `@finops-guardian` $200) has an autonomy ceiling and a per-run spend cap. Anything above the cap escalates to `approve`.
- **A native executor** at `POST /api/internal/agent-executor`, pre-wired into the seeded agents, so one click exercises the HMAC-signed connector round-trip (run, proof, receipt) without pasting an external webhook.
- **AG Studio register** — the Obligations table flips to an AG Grid view with custom cells for the obligation, risk meter, inline autonomy, agent passport and PayPal escrow status.
- **Workspace-scoped Postgres locking** — `pg_advisory_xact_lock(hashtext(workspace_id))` replaces a single global lock, so concurrent workspaces never block each other.
- **Real backup handover** — when an obligation passes its deadline with a backup named, the backup becomes the owner, the escalation is written to the audit trail and portfolio stats, and the owner can reclaim it from the drawer.
- **A PayPal ledger** on the Trust page: every order, capture and payout with its PayPal reference and status.
- UI for paying an obligation from its drawer (PayPal button + sandbox return handling), the seller payout method and the “Send with PayPal” step.

**Commit range:** `f7d5310..HEAD` on `feat/paypal-agentic-commerce`. The first commit adds the rail; everything after it is UI, documentation, tests, sandbox execution and handover.

**Run it (judges)**

```bash
npm install
npm run build
npm start            # http://localhost:4178
```

Create an account on first run; the workspace seeds itself with recent obligations, agents, approvals, an authorized PayPal hold and history. No PayPal credentials are needed to walk the register, the AG Studio grid, the executor, handover or the trust layer.

To exercise the live PayPal sandbox rail, export `PAYPAL_ENV=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (and optionally `PAYPAL_WEBHOOK_ID`, `PAYPAL_ALLOW_WEBHOOK_SIMULATOR=true`), then restart. `npm start` does not read `.env.local`, so export the variables in the shell or pass them inline. Pay an obligation from its drawer while signed in to a PayPal **sandbox buyer** account — the guest card form does not accept test cards on this merchant. Payouts need a sandbox receiver email on the seller desk.

**Three-minute demo path**

1. **Today → Run agent sweep.** Agents with an executor act; agents without one draft. The summary counts both. The PayPal escrow strip shows the $180 Apex hold in flight.
2. **Obligations → Agent Studio.** Flip the register to AG Grid: risk meter, inline autonomy, agent passport with its spend cap, and the PayPal escrow state.
3. **Time machine +7 days → Run agent sweep.** Overdue work escalates to its backup and the agent wire fills with drafts. Open the Northwind retainer and **Send invoice**: `@ar-collector` creates and sends a PayPal Sandbox invoice, and the payer URL is filed as proof.
4. **Trust → $180 Q4 filing.** File [`public/demo/proofs/unverified-wrong-amount.pdf`](public/demo/proofs/unverified-wrong-amount.pdf); the auditor rejects it and the hold stays locked. File [`public/demo/proofs/delaware-tax-receipt-verified.pdf`](public/demo/proofs/delaware-tax-receipt-verified.pdf); the auditor verifies it. Release then captures $180, retains the $18 fee and pays $162 through Payouts. The seeded row is a rehearsal with placeholder PayPal ids and says so; authorize a fresh sandbox hold from the filing to run the capture end to end.
5. **Access → MCP.** The same register over REST and MCP, with scoped keys and the APIMatic-validated PayPal schema badge.

**Honest limits**

- PayPal payouts to Ethiopia are limited; the payout demo uses a sandbox receiver. Receiving fiat is the rail’s own constraint, not something this app hides.
- The record is the product: Remindify files proof and the audit trail. A PayPal capture and a proof receipt are separate records, and neither implies the other.

## Deploy on Vercel

Vercel functions do not have a persistent writable filesystem, so **SQLite cannot be the production database**. The repository is already wired for a single Vercel deployment with Postgres:

1. Create a Postgres database with **Vercel Postgres**, **Neon** or **Supabase**.
2. Import this repository into Vercel. The included `vercel.json` builds the Vite app into `dist` and deploys the single `api/index.js` function as the `/api/*` handler. A rewrite restores the original path (including nested routes and OAuth callback query strings) before the router runs.
3. Add these environment variables in **Project → Settings → Environment Variables**:

   ```bash
   DATABASE_URL=postgres://...        # Vercel also injects POSTGRES_URL automatically
   PUBLIC_ORIGIN=https://your-app.vercel.app
   COOKIE_SECURE=true
   ```

4. Deploy. On the first API request the Postgres store creates its tables and seeds the demo workspace. Accounts, sessions and workspace data now survive redeploys and cold starts.
5. If Google sign-in is enabled, register `https://your-app.vercel.app/api/auth/google/callback` as an authorized redirect URI and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

Do **not** set `REMINDIFY_DB`, `DATABASE_SSL=false` or `PG_NO_LOCK=1` on Vercel. The Postgres store serializes each request's writes under an advisory lock; that bounds write throughput but every row is still partitioned by `workspace_id`, and each account resolves to its own workspace.

If a CLI deployment is blocked because the latest Git commit author is not a member of the Vercel team, either add that email to the team or deploy from a clean copy without a `.git` directory. GitHub auto-deploy also requires the Vercel GitHub app to have access to this public repository.

---

## What's in the product

| Surface | What it does |
| --- | --- |
| **Public site** | Story-led landing page, pricing, security model, about, privacy, terms and auth screens, all in the same warm editorial system. |
| **Accounts** | Email/password and Google OAuth; emailed email confirmation and single-use password reset; 30-day HttpOnly sessions; every app API route is gated. |
| **Today** | Greeting, live approvals, closest-to-the-edge obligations, portfolio pulse, agent wire, failsafe policy. |
| **Obligations** | The register. Search, filter by risk/owner/autonomy, inline autonomy control, risk meters, due dates, backups. |
| **Capture** | Paste a vendor letter, regulator email or messy handoff note, or drop a text-based PDF. Gemini 2.5 Flash extracts obligations, dates, amounts, recurrence, provider and category through structured output; without a key the deterministic parser takes over. Review before anything is scheduled. Text-based PDFs are read in the browser; images and scanned PDFs are read by the vision model once attached as proof. |
| **Agents** | Agent passports: role, scopes, trust, runs, success rate, autonomy ceiling, execution connector, obligations on desk, recent runs, exportable passport JSON. |
| **Marketplace** | Vetted humans and agents side by side. Fixed price, escrow on proof, scoped access, SLA. Attach a provider to an obligation or post a new job. |
| **Activity & proof** | Immutable event stream, filterable by agents/humans/system/API/proof, exportable audit log, proof vault. |
| **Trust layer** | Server-signed HMAC-SHA256 proof receipts, a multimodal Gemini proof auditor (text, images and scanned PDFs), PayPal authorization holds that release on verified proof, capture, payout net of the platform fee, and a PayPal ledger of every order, capture and payout. |
| **Agent access** | Machine API keys, endpoint reference, webhooks, live test call, recent machine calls, guardrails. |

Plus: **⌘K command palette**, obligation drawer with autonomy + checklist + proof + timeline, agent passport drawer, create-agent / new-obligation / hire flows, toasts, and a virtual clock.

### The demo, in 90 seconds

1. **Today** — 6 approvals are waiting. Open one and **Approve**. With no executor connected, the decision is recorded and the obligation stays open for you. Connect an executor in an agent's passport, then the same button reads **Approve & run** and the agent executes.
2. **Capture** — choose “Policy renewal letter” → **Parse & structure**. One obligation appears with due date, amount, provider, recurrence and the exact source sentence. Confirm and schedule it.
3. **Obligations** — open any row. Change autonomy from Notify to Auto and watch the risk score recalculate. Add proof to complete it.
4. **Agents** — open **Ledger**’s passport. See its ceiling, scopes, trust, work on desk, and the execution connector.
5. **Marketplace** — delegate the payroll filing to a human PA or an agent. Access is scoped to that obligation; payment releases on proof.
6. **Trust layer** — every completion files a receipt signed by the server. Open it and **Audit** the evidence; a PayPal escrow hold releases only against a verified receipt, then captures and pays the provider net of the fee.
7. **Agent access** — hit **Test live call**, create a key, or run the MCP server.
8. **Time machine** — on Today, **Run agent sweep**, then **Time machine · +7 days**. Agents draft plans and escalate approvals; overdue obligations are handed to their backup, and the drawer shows the escalation with a **Reclaim** action. Autopilot obligations execute only where a connector is connected; otherwise the sweep tells you how many are waiting on one. Reset from the clock chip.

Nothing here is a static mock: every button writes to the active store — SQLite locally, Postgres on Vercel — and re-renders from the API. Agent work is only reported as executed when a connector answers.

---

## Why this is different from a reminder app

A reminder is a notification. An obligation has:

- **an owner and a backup** — not just a person who feels bad when it slips;
- **a risk score** — severity × urgency × confidence × autonomy, with money exposure and consequences;
- **an autonomy level** — `notify` → `prepare` → `approve` → `autopilot`, capped by the agent’s passport;
- **a proof requirement** — a receipt, confirmation, certificate or photo before it counts;
- **an audit trail** — who did what, when, with which scope, and what evidence was filed.

That structure is what makes it safe to hand recurring work to software. It is also what makes the marketplace trustworthy: providers are paid on accepted proof, not promises.

### Agent-native by design

- Every agent has a **passport**: scopes, trust, autonomy ceiling and a machine-readable JSON export.
- The same register is available over **REST** (`/api/v1/*`) and **MCP** (`mcp/server.mjs`).
- Machine calls are attributed to a key, logged in the same event stream as human actions, metered against the plan and rate-limited per key.
- Agents can read, create and complete obligations — but completion without proof is rejected by the MCP tool contract.
- Autonomy above an agent’s ceiling still requires a human approval.

### Execution connectors

An agent cannot act until you connect an executor. In an agent's passport, paste an `https://` endpoint; Remindify shows the signing secret once. From then on, every action the agent takes is a real HTTP `POST` to that endpoint, signed with HMAC-SHA256.

```http
POST /your/execute
x-remindify-event: obligation.execute
x-remindify-run: run_ab12cd3
x-remindify-timestamp: 1761600000000
x-remindify-signature: sha256=<hmac>
content-type: application/json
```

The signature is `HMAC-SHA256(secret, "<timestamp>.<raw body>")`. Verify it before acting:

```js
import { createHmac, timingSafeEqual } from "node:crypto";
const expected = createHmac("sha256", process.env.REMINDIFY_EXECUTOR_SECRET)
  .update(`${req.headers["x-remindify-timestamp"]}.${rawBody}`)
  .digest("hex");
const given = String(req.headers["x-remindify-signature"] || "").replace(/^sha256=/, "");
const ok = given.length === expected.length &&
  timingSafeEqual(Buffer.from(given), Buffer.from(expected));
```

Body:

```json
{
  "event": "obligation.execute",
  "run_id": "run_ab12cd3",
  "issued_at": "2026-10-28T09:00:00.000Z",
  "workspace": { "id": "ws_5f2c…", "name": "Exopya Studio" },
  "agent": { "id": "ag_ledger", "name": "Ledger", "handle": "ledger" },
  "obligation": { "id": "ob_rent", "title": "Pay rent", "provider": "…", "amount": 750, "currency": "USD", "due_at": "…", "autonomy": "autopilot" },
  "action": "Executed the obligation",
  "detail": "Pay $750 to … using the verified account, then archive the receipt."
}
```

Return any `2xx` and include `{"proof": "your-proof-reference"}` (or `receipt_url`) to file it as evidence. A non-2xx response, timeout or network error records a **failed** run, leaves the obligation open, and surfaces the error in the passport. A `2xx` without a proof reference is recorded as `connector_<status>` so the gap is visible.

Transient failures (network errors, timeouts, `408`, `429` and `5xx`) are retried up to three times with exponential backoff; other `4xx` answers are final. Each attempt carries a fresh timestamp and signature plus `x-remindify-attempt`, so an executor can dedupe on `x-remindify-run` while still verifying every request.

When those inline attempts still fail transiently, the execution is saved to a durable outbox instead of being lost. The job keeps the original run id, retries with exponential backoff (one minute, then two, four, eight… capped at six hours) for up to five attempts, and completes the obligation with proof when an executor finally answers. Jobs are ordinary workspace rows, so they survive a restart; a connector that is permanently broken or an obligation that closes first ends the job instead of retrying forever. The local server sweeps the outbox every 30 seconds (`OUTBOX_INTERVAL_MS`). Serverless deployments have no timer, so point a scheduler at `GET` or `POST /api/cron/outbox` with `Authorization: Bearer $OUTBOX_SECRET`; the route is absent unless the secret is set.

| Variable | Default | Purpose |
| --- | --- | --- |
| `EXECUTOR_ATTEMPTS` | `3` | Inline attempts per call (max 5) |
| `EXECUTOR_RETRY_BASE_MS` | `300` | Inline backoff base |
| `EXECUTOR_TIMEOUT_MS` | `8000` | Per-attempt timeout |
| `OUTBOX_MAX_ATTEMPTS` | `5` | Delayed attempts after inline failures (max 10) |
| `OUTBOX_RETRY_BASE_MS` | `60000` | Delayed backoff base |
| `OUTBOX_INTERVAL_MS` | `30000` | Local sweep interval (`0` disables) |
| `OUTBOX_SECRET` | unset | Enables the outbox cron route |
| `CRON_SECRET` | unset | Enables the sweep cron route (falls back to `OUTBOX_SECRET`) |

Because a crash can land between claiming a job and recording the result, delivery is at-least-once. Executors should treat `x-remindify-run` as the idempotency key.

### Scheduled sweeps

`GET` or `POST /api/cron/sweep` runs the same sweep as the **Run agent sweep** button for every workspace that has obligations: autopilot obligations execute where a connector is connected, prepare obligations get a plan, approve obligations raise an approval request. It requires `Authorization: Bearer $CRON_SECRET` (or `OUTBOX_SECRET` when only that one is set) and returns `404` when neither is configured. Vercel Cron issues `GET`; other schedulers can `POST`.

Replaying the call is safe. Any obligation with a successful run in the previous six hours is skipped, and each workspace holds a five-minute lease so a second scheduler cannot enter it while the first is still calling connectors. The sweep stops after twenty seconds and reports the remaining workspaces as `deferred`, so it fits inside a serverless function limit; the next run picks them up. The response reports `{ workspaces, skipped, deferred, scanned, proposed, executed, drafted, blocked, failed, digests, digest_failed, pruned_events, pruned_runs }`. Local development keeps sweeps manual so a demo only moves when you press the button; point a scheduler at the route hourly in production.

When `EMAIL_WEBHOOK_URL` is set, the same call sends a daily digest to every confirmed email address in each swept workspace: obligations due in the next seven days and approvals waiting on a decision, with a link back to `/today`. It is sent at most once per UTC day per workspace, so replays are harmless, and it is capped at ten recipients and fifteen lines per section. Sends run in parallel; failures are counted in `digest_failed` and do not stop the sweep, and the digest is retried on the next call if every send failed. Each digest carries a signed one-click unsubscribe link; `GET /api/digest/unsubscribe?token=…` needs no session, is signed per recipient with a per-workspace secret in workspace meta, and the opt-out is honoured by later sends. The confirmation page links back with the same token so the mailbox can turn the digest on again.

Set `RETENTION_DAYS` to prune `events` and `runs` older than that many days from each swept workspace. Retention is off by default, workspaces without obligations are not visited, and receipts, escrows, obligations and user records are never pruned. A failed prune never fails the sweep.

Without a connector the agent is draft-only: sweeps produce plans, approvals are recorded but nothing runs, and nothing is marked complete. Executor URLs are resolved and checked for a public address, and that address is pinned for the send, so a second DNS answer cannot bounce the call inward. Redirects are refused. `EXECUTOR_ALLOW_LOCAL=1` permits `http://localhost` for local development only. The signing secret is stored server-side, stripped from state, exports and API responses, and rotated whenever you reconnect.

---

## Architecture

```
src/                 React 19 + Vite + TypeScript (no UI framework)
  views/             Today, Obligations, Capture, Agents, Market, Activity, Trust, Access
  landing/           public story, pricing, security, about, legal and auth pages
  auth.tsx           session context, email/Google flows, 401 handling
  lib/router.ts      hash routing for public and authenticated surfaces
  components/        drawers, modals, command palette, icons, shared UI
  styles/            custom warm-editorial design system (Instrument Sans/Serif, JetBrains Mono)
server/
  index.mjs          shared HTTP handler for Node and Vercel, plus static serving
  auth.mjs           scrypt passwords, hashed sessions, Google OAuth
  db.mjs             database facade: SQLite locally, Postgres on Vercel
  db-sqlite.mjs      node:sqlite store (JSON row documents, WAL), auth tables
  db-postgres.mjs    request-scoped Postgres snapshot, auth tables, advisory lock
  seed.mjs           rich demo workspace: 19 obligations, 10 agents, 11 providers, events, keys
  engine.mjs         risk scoring, recurrence, approvals, sweep, autopilot, virtual clock
  parse.mjs          Gemini capture (structured output) with deterministic fallback
  audit.mjs          proof auditor: Gemini text/image/PDF, deterministic fallback
  trust.mjs          HMAC proof receipts, proof auditor gate, PayPal holds/capture/payout
  dev.mjs            runs API + Vite together
api/[...path].js     Vercel serverless entrypoint for /api/*
vercel.json          Vercel build and function configuration
mcp/server.mjs       zero-dependency MCP stdio server (tools + structured content)
data/                local SQLite database (created on first run)
public/fonts/        self-hosted fonts
```

- **State is server-authoritative.** The client polls `/api/state` every 12s and after every action.
- **Risk** = `severity × 15 × urgency(days) × autonomyFactor × confidenceFactor`, clamped to 2–97 and banded critical/high/guarded/low.
- **Recurrence** advances from the current due date, preserving the original day-of-month where possible.
- **Virtual clock** is a persisted offset (`clock_offset_days`), so time-machine demos are consistent across API, UI and seeded relative dates.
- **No card data, no document upload, no tracking.** Capture and the proof auditor send text or an attached evidence file to Gemini 2.5 Flash only when `GEMINI_API_KEY` is set; otherwise both run locally and the deterministic checks are covered by `npm test`. Text-based PDFs are read in the browser; images and scanned PDFs stay on the device until you attach them as proof, and only that artifact is sent for audit. Authentication is the only place the product stores identity data.

### Data

**Local development and Docker** use SQLite at `data/remindify.db`. Use **Reset demo** (clock chip, after time travel) or `POST /api/demo/reset` to restore the seeded workspace. Export everything with `GET /api/export`. Point the store elsewhere with `REMINDIFY_DATA_DIR` or `REMINDIFY_DB`.

**Vercel** uses Postgres. Set `DATABASE_URL` (or one of Vercel's `POSTGRES_*` variables) and the server switches stores automatically. The Postgres store creates its tables on first use, loads a request-scoped snapshot inside a transaction, and flushes it before the response ends. Writes are serialized with a Postgres advisory lock so requests from every workspace stay consistent across serverless instances.

Accounts and sessions live in separate `users`, `auth_sessions`, `auth_challenges` and `auth_tokens` tables in both stores. A demo reset never deletes users or signs anyone out.

To run against a local Postgres instead of SQLite:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/remindify \
DATABASE_SSL=false \
npm run dev
```

The Postgres tests use an embedded PGlite database and need no external service:

```bash
npm test
```

---

## Public site and authentication

The public site is story-first rather than a feature grid. It explains the product through a leak, a letter, a desk, a proof receipt and a day line, then moves into product, trust, pricing and FAQ sections.

Public pages use real paths, so each one is a crawlable URL with its own metadata:

| Route | Page |
| --- | --- |
| `/` | Story landing page |
| `/pricing` | Plans and the preview promise |
| `/security` | Security and trust model |
| `/about` | Why Remindify exists |
| `/privacy`, `/terms` | Legal preview |
| `/login`, `/signup` | Account access |

App routes (`/today`, `/obligations`, `/capture`, `/agents`, `/market`, `/activity`, `/trust`, `/access`) require a session. Visiting one while signed out opens the auth page with a `next` target, so email and Google sign-in return to the requested surface. Old `#/route` links are still accepted and rewritten to the clean path.

### Sign-in methods

- **Email and password** — scrypt hashes with a per-user salt. Passwords are never stored in plain text.
- **Google OAuth** — authorization code flow with a one-time state cookie and verified profile email. If credentials are absent, the button shows a short configuration notice and email/password remain available.

Sessions last 30 days. The cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` when served over HTTPS. Only a SHA-256 hash of the session token is stored. An email-only account can use the full register, capture, agents, proof and export.

### Auth configuration

Defaults work locally with no third-party credentials:

```bash
cp .env.example .env
npm run dev
```

For a public deployment, set the canonical origin and secure cookies:

```bash
PUBLIC_ORIGIN=https://your-domain.example
COOKIE_SECURE=true
```

For Google sign-in, create an OAuth web client and register this exact redirect URI:

```
https://your-domain.example/api/auth/google/callback
```

Then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Use `GOOGLE_REDIRECT_URI` if the callback differs from `${PUBLIC_ORIGIN}/api/auth/google/callback`. Without credentials, the Google button shows a short configuration notice and email/password remain available.

### Password reset

`POST /api/auth/reset/request` accepts `{ "email" }` and always answers `202` with the same message, so it never reveals whether an account exists. For a real account it stores a SHA-256 digest of a 32-byte token with a 30-minute expiry and emails a link to `/login?reset=…`. `POST /api/auth/reset/confirm` accepts `{ "token", "password" }`, consumes the token once (expired, reused or wrong-purpose tokens fail with `400`), updates the scrypt hash and deletes every existing session for that account.

Reset email goes through a single HTTPS webhook, so the app holds no SMTP credentials. Point `EMAIL_WEBHOOK_URL` at an adapter that accepts `{ to, subject, text }`, and set `EMAIL_WEBHOOK_SECRET` to sign it. Signed requests carry `x-remindify-timestamp` and `x-remindify-signature: sha256=<HMAC of "<timestamp>.<raw body>">`. Without `EMAIL_WEBHOOK_URL` the endpoints return `503 email_not_configured` and the “Forgot password?” link stays hidden. Following a reset link also marks the mailbox as confirmed.

### Email confirmation

Signup sends a confirmation link to `/login?verify=…` when email is configured. The token is hashed, single-use and valid for 24 hours; a resend replaces the previous link. `POST /api/auth/verify/request` (signed in) sends or resends it, and `POST /api/auth/verify/confirm` with `{ "token" }` records `email_verified_at`. Google sign-ins and password resets count as confirmed because both prove control of the address. Confirmation is soft for the register: unverified accounts keep full access and only see an in-app banner with a Resend button.

Plan changes are stricter once `EMAIL_WEBHOOK_URL` is set: `POST /api/billing/plan` answers `403 {"error":"email_unverified"}` when an email account asks for a paid plan without confirming first. Downgrades to Free stay open, and without an email provider nobody could confirm, so the gate stays open in that preview configuration.

### Account deletion

“Delete account…” in the account menu calls `POST /api/account/delete` with `{ "confirm": "delete" }`. Password accounts must also send the current password; wrong or missing credentials return `401` and change nothing. A successful call deletes that account's sessions and single-use tokens, purges its private workspace (`items` and `meta`), removes the user row and clears the session cookie. Accounts that share the demo workspace lose the account but not the shared register, which stays available to other demo accounts. There is no soft-delete window, so the dialog links to `GET /api/export` first. The endpoint is rate limited per IP.

### Region gating

Set `BLOCKED_COUNTRIES` to a comma-separated list of ISO 3166-1 alpha-2 codes (`KP,IR,SY,CU`) to refuse account creation and escrow money movement for visitors geolocated there. The default is empty: Remindify does not decide on its own which jurisdictions its operator may serve. When configured, these calls answer `451 {"error":"region_blocked"}`:

- `POST /api/auth/signup`, `GET /api/auth/google` (and its callback, which redirects to `/login?notice=region_blocked`);
- `POST /api/trust/escrows`, `/hold` and `/release`.

Sign-in for an existing account still works, so someone who moves or travels keeps access to their register; only new accounts and new money movement are refused.

The country comes from `x-vercel-ip-country`, `cf-ipcountry` or `x-country-code`, in that order. Requests with no usable header are allowed so local development and self-hosted installs without a geo proxy keep working. These headers are only trustworthy behind a proxy you control: a client that reaches the Node server directly can send any value, so terminate traffic at Vercel or Cloudflare, or have your own proxy set the header from a source you trust. This is coarse geolocation, not a sanctions screening service; combine it with a provider check if you are required to screen individuals.

### API protection

`/api/auth/*` and `/api/health` are public. The machine API under `/api/v1/*` still authenticates with `Authorization: Bearer rfy_live_...`. Every app endpoint (`/api/state`, `/api/capture`, `/api/obligations`, `/api/approvals/*`, `/api/agents`, `/api/hire`, `/api/keys`, `/api/trust/*`, `/api/demo/*`, `/api/account/delete`) returns `401 {"error":"unauthorized"}` without a valid session cookie.

The server partitions obligations, agents, runs, receipts, escrows, API keys and meta keys by workspace. A session cookie resolves to that account's workspace; a machine API key resolves to the workspace that issued it. New accounts get a seeded copy of the demo register in their own workspace, and `POST /api/demo/reset` only clears the caller's workspace. Auth rows (users, sessions, auth challenges) live outside any workspace, so a reset never signs anyone out or touches another account.

Every API response carries `x-content-type-options: nosniff`, `x-frame-options: DENY` with `content-security-policy: frame-ancestors 'none'`, `referrer-policy: strict-origin-when-cross-origin` and a `permissions-policy` that turns off camera, microphone, geolocation and payment. `strict-transport-security` is added when the request arrives over TLS. Static pages served straight from the Vercel CDN never reach the Node handler, so they carry only the platform's HSTS header; the same values belong in `vercel.json` once the current worktree changes land.

`POST /api/cron/outbox` and `POST /api/cron/sweep` are machine-only: they require a Bearer secret and return `404` when none is configured, so no session can reach them. See [Execution connectors](#execution-connectors) for the retry contract and [Scheduled sweeps](#scheduled-sweeps) for the sweep contract. The other public `/api/` routes are `GET /api/digest/unsubscribe` and `GET /api/digest/subscribe`, which only accept a recipient-signed token.

Existing single-workspace databases are migrated in place: rows that predate this change are assigned to the `ws_demo` workspace.

### Status hints

- Google: requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and a registered redirect URI.
- PayPal: requires `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`; `PAYPAL_ENV` defaults to `sandbox`.
- Contacts: `liyusoftwaresolution@gmail.com` (product and security).

### Search and AI discovery

The production build prerenders the six public pages to static HTML, so search engines and AI crawlers receive the full story, pricing, security, about and legal copy without executing JavaScript. Login, signup and the workspace ship as noindex shells.

The build also generates:

| File | Purpose |
| --- | --- |
| `sitemap.xml` | Canonical URLs for the six indexable pages |
| `robots.txt` | Allows public pages, blocks `/api/`, `/login`, `/signup` and the workspace |
| `llms.txt` | Short, structured summary for AI crawlers |
| `llms-full.txt` | Longer product, pricing, trust and FAQ reference |
| `og.png` | 1200×630 social card |
| `favicon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Icons |
| `404.html` | Static not-found page |

Every public page carries a canonical link, Open Graph and Twitter metadata, and a JSON-LD graph (Organization, WebSite, SoftwareApplication, WebPage, plus FAQPage on the home page and BreadcrumbList elsewhere). Navigation, footer, product cards and CTAs are real `<a href>` links.

Set the canonical origin and optional verification values at build time:

```bash
PUBLIC_ORIGIN=https://your-domain.example
GOOGLE_SITE_VERIFICATION=...   # Search Console HTML-tag value
BING_SITE_VERIFICATION=...     # Bing Webmaster msvalidate.01 value
```

After deploying, submit `https://your-domain.example/sitemap.xml` in Google Search Console and Bing Webmaster Tools. To improve AI answers and entity confidence, keep the same name, description and URL on the site, GitHub, X, LinkedIn and any directory profile; add `llms.txt` links where a profile allows it. Do not expect AI crawlers to index pages blocked by `noindex` or `robots.txt`.

---

## Trust layer

The trust layer is PayPal-only and proof-first. It exists for the moment when a provider, auditor or counterparty needs to verify that work happened without trusting Remindify's database, and for the moment when money should move only after that proof is verified.

There is **no token**. The platform fee is deducted from the captured amount at release, and the provider receives the net. Remindify never holds a balance or a card.

### The receipt lifecycle

1. **File** — completing an obligation writes a receipt with `status: filed`. The evidence text is stored with its SHA-256 hash, and the server signs a canonical payload with HMAC-SHA256.
2. **Audit** — the proof auditor scores the evidence against the obligation's amount, reference and date. A pass moves the receipt to `verified`; a fail moves it to `rejected` and keeps the reasons.
3. **Settle** — a PayPal escrow release captures the authorization and pays the provider. The receipt becomes `settled` and stores the capture, payout, fee and net.

A receipt can stay `filed` forever. Verification is only required when money is going to move against it.

### PayPal rail

| Item | Value |
| --- | --- |
| Settlement | PayPal Orders v2 (`intent=AUTHORIZE`), capture, Payouts v1 |
| Asset | USD |
| Hold | Up to 29 days (`HOLD_DAYS=29`) |
| Fee | `PAYPAL_PLATFORM_FEE_PERCENT`, default 10 |
| Auditor | Gemini 2.5 Flash (`AI_MODEL_ID`) with deterministic fallback |

A hold reserves the payer's funds without moving them. On release the server captures the authorization with `POST /v2/payments/authorizations/{id}/capture` and sends a Payout to the provider's PayPal email for the net. A payout failure leaves the escrow in `captured_awaiting_payout` so it is never reported as settled.

### Sandbox and live

`PAYPAL_ENV=sandbox` is the default. It uses the PayPal sandbox APIs and checkout host, so orders, holds and payouts can be exercised without real money. `live` uses the production APIs and moves real funds with separate credentials. Never mix the two.

Without `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`, every escrow hold and release fails closed with `paypal_not_configured`. Receipts and the auditor keep working.

### Proof auditor

The auditor uses Gemini 2.5 Flash with structured JSON output and returns `verified`, `confidence`, a matching verdict and discrepancies. The release threshold is `AUDIT_MIN_CONFIDENCE` (default `0.8`). Without `GEMINI_API_KEY`, or when the Gemini call fails, it falls back to deterministic offline rules and labels the result `deterministic_fallback`.

A release runs the auditor first if the receipt is not already verified. A rejected proof returns `proof_rejected` and leaves the payer's hold untouched.

### Trust API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/trust` | Rail, receipts, escrows, stats and guardrails. |
| `POST` | `/api/trust/receipts` | File a receipt: `{ obligation_id, proof, artifact? }`. |
| `POST` | `/api/trust/receipts/:id/audit` | Run the proof auditor; optional `{ artifact }`. |
| `GET` | `/api/trust/receipts/:id/verify` | `{ status, valid, proof_hash, settlement }`. |
| `POST` | `/api/trust/escrows` | Open a draft with `payee_paypal_email`; `451` in a blocked region. |
| `POST` | `/api/trust/escrows/:id/hold` | Create the PayPal authorization order and return `approve_url`. |
| `GET` | `/api/trust/escrows/paypal/return?token=` | PayPal return; authorizes the hold and redirects to `/trust`. |
| `POST` | `/api/trust/escrows/:id/release` | Audit if needed, capture and pay out `{ proof_receipt_id }`. |
| `POST` | `/api/trust/escrows/:id/void` | Release an outstanding hold back to the payer. |

Machine-native agents can read trust state and file a receipt:

```bash
curl -X POST http://localhost:4178/api/v1/trust/receipts \
  -H "Authorization: Bearer rfy_live_7c2a91f4d0e8b6a3c5d2" \
  -H "content-type: application/json" \
  -d '{"obligation_id":"ob_domain","proof":"renewal confirmation","artifact":{"name":"registrar.txt","type":"text","text":"Cloudflare order CF-88213 renewed to 2027-11-15 for USD 24.00"}}'
```

`GET /api/v1/trust` returns the same snapshot for agents.

### Guardrails

- **Proof before money.** A hold is captured only after the auditor verifies the artifact. A rejection leaves the payer's funds in place.
- **Operator-managed region list.** `BLOCKED_COUNTRIES` refuses new accounts and escrow movement from listed countries. It is empty unless the operator sets it, and it reads edge-proxy geolocation, not a sanctions list.
- **No token.** No points, no airdrop, no speculative asset.
- **No custody.** Remindify never holds a balance or a card; PayPal moves the money between the payer, the merchant account and the provider.
- **No secrets in receipts.** Only the proof label, evidence text and hashes are stored; no card data and no PayPal credentials.
- **Sandbox is the default.** Nothing in this preview claims live PayPal availability.

---

## API

All machine endpoints require `Authorization: Bearer rfy_live_...`. Issued keys are stored as a SHA-256 digest plus a display prefix; the full secret is returned once, in the creation response, and never again. New keys expire after 90 days by default and can be rotated in Agent access (or `POST /api/keys/:id/rotate`), which replaces the secret and resets the expiry while keeping the key's name and scopes. Expired keys fail with `401 {"error":"key_expired"}`. New workspaces start with no keys so every credential is one the operator issued. The seeded demo workspace keeps its plaintext demo keys so the public demo works out of the box. Requests outside a key's scopes fail with `403 {"error":"missing_scope"}`.

Every response carries `x-ratelimit-limit` and `x-ratelimit-remaining`; a key that exceeds its per-minute window gets `429 {"error":"rate_limited"}` with `Retry-After`. The limit is 600 requests per minute per key and can be changed with `MACHINE_RATE_LIMIT`. The counter lives in workspace meta, so it holds across instances sharing the same database.

Mutating machine calls accept an `Idempotency-Key` header. A retry with the same key and body within 24 hours replays the original response and sets `Idempotent-Replay: true`; reusing the key with a different body returns `409 {"error":"idempotency_conflict"}`. This is how a retrying agent avoids creating or completing an obligation twice.

| Method | Path | Scope | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/obligations` | `obligations:read` | Full register with risk, owner, autonomy, proof and recurrence. |
| `POST` | `/api/v1/obligations` | `obligations:write` | Create an obligation. `title` and `due_at` required. Idempotent. |
| `GET` | `/api/v1/obligations/:id` | `obligations:read` | One obligation with history and risk. |
| `POST` | `/api/v1/obligations/:id/complete` | `obligations:write` | File proof and advance the schedule. Idempotent. |
| `GET` | `/api/v1/risk` | `risk:read` | Coverage, exposure, counts and top risks. |
| `GET` | `/api/v1/agents` | `agents:read` | Roster with scopes and autonomy ceilings. |
| `GET` | `/api/v1/trust` | `risk:read` | Rail, receipts, escrows and trust stats. |
| `POST` | `/api/v1/trust/receipts` | `obligations:write` | File a proof receipt from an agent. Idempotent. |

App endpoints require a signed-in session cookie: `/api/state`, `/api/capture`, `/api/obligations`, `/api/approvals/:id/decide`, `/api/agents`, `/api/agents/:id/executor`, `/api/hire`, `/api/keys`, `/api/trust/*`, `/api/billing`, `/api/demo/{sweep,advance,reset}`. Public app endpoints are limited to `/api/auth/*`, `/api/health` and the Bearer-authenticated `/api/v1/*` machine API and `/api/cron/*` schedulers.

### Plans and usage

Each workspace has a plan and two real allowances: agent keys and machine calls per calendar month. Calls are metered in the workspace's own meta and reset on the first request of a new month; exceeding either allowance returns `402` (keys) or `429` (calls) with `error: "plan_limit"`.

| Plan | Price | Agent keys | Machine calls / month |
| --- | --- | --- | --- |
| Personal | $0 | 3 | 500 |
| Studio | $18 | 25 | 50,000 |
| Operator | $48 | 100 | 500,000 |

`GET /api/billing` returns the current plan, usage and plan catalogue. `POST /api/billing/plan` is refused with `503 billing_not_configured` until a payment provider is connected; set `BILLING_ALLOW_PLAN_SWITCH=1` for a demo or manually invoiced deployment. No card data touches this server.

```bash
curl http://localhost:4178/api/v1/risk \
  -H "Authorization: Bearer rfy_live_7c2a91f4d0e8b6a3c5d2"
```

---

## MCP

The included server exposes the register to Claude, Cursor or any MCP client. It is dependency-free and uses stdio.

```bash
npm run mcp
```

`claude_desktop_config.json` / MCP client config:

```json
{
  "mcpServers": {
    "remindify": {
      "command": "node",
      "args": ["/absolute/path/to/remindify/mcp/server.mjs"],
      "env": {
        "REMINDIFY_URL": "http://localhost:4178",
        "REMINDIFY_KEY": "rfy_live_7c2a91f4d0e8b6a3c5d2"
      }
    }
  }
}
```

Tools: `list_obligations`, `get_obligation`, `create_obligation`, `complete_obligation`, `portfolio_risk`, `list_agents`, `list_trust`, `list_escrows`, `get_proof_receipt`, `file_proof_receipt`.

The default key is the seeded demo key. Issue a fresh one in **Agent access** and set `REMINDIFY_KEY` for anything real.

---

## Scripts

```bash
npm run dev              # API + Vite with proxy
npm run build            # client + SSR prerender + sitemap/robots/llms
npm start                # serve dist + API on :4178
npm run mcp              # MCP stdio server
npm test                 # parser, trust, PayPal and workspace regression tests (node:test)
npm run typecheck        # tsc --noEmit
npm run check            # typecheck + production build
```

Requires **Node 22.5+** for `node:sqlite` (tested on Node 24). No native modules.

---

## Deploy a public demo

The included `Dockerfile` builds the Vite client and serves it from the Node API. SQLite lives under `/app/data`, so mount a volume to keep the workspace across restarts:

```bash
docker build -t remindify .
docker run --rm -p 4178:4178 \
  -e PUBLIC_ORIGIN=http://localhost:4178 \
  -v remindify-data:/app/data remindify
```

Open `http://localhost:4178`. The database is created, seeded and protected by the auth gate on first boot.

For Render, Fly.io or Railway, use the Dockerfile, expose port `4178`, and mount a persistent volume at `/app/data`. Set `PORT` only if the platform requires it, and set `PUBLIC_ORIGIN=https://your-domain.example` plus `COOKIE_SECURE=true` behind HTTPS. Public demos should use a fresh API key and should not expose the seeded demo key.

Accounts get separate workspaces, but this is still a prototype. Do not run it as a public multi-tenant service until email confirmation is enforced rather than advisory.

---

## Production notes / honest limits

This is a complete product prototype, not a hardened multi-tenant service. Before charging money:

- add Postgres row-level security and per-workspace connection limits as defence in depth (the application already scopes every query by workspace);
- add a durable job runner for machine API writes (keys are hashed, scoped, expiring and rate-limited, mutating calls accept idempotency keys, connector retries persist in an outbox, and scheduled sweeps are replay-safe);
- build shared workspaces and membership; paid plan changes are already gated on a confirmed email, but there is no sharing surface yet;
- move proof evidence to encrypted object storage with per-file deletion; today a receipt keeps the evidence text or media inline (plus its SHA-256 hash) so the auditor can read it, and activity retention is `RETENTION_DAYS` with account deletion purging the workspace;
- add a per-workspace budget and retention policy for evidence and capture text sent to Gemini;
- add plan billing on top of the existing usage metering (PayPal Orders is already wired for obligations, payouts and invoices);
- confirm or replace the placeholder `liyusoftwaresolution@gmail.com` inbox.

The design decisions that matter — autonomy ceilings, proof requirements, audit trail, human/agent parity — are already in the data model.

---

## License

MIT. See [LICENSE](./LICENSE).
