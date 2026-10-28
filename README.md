# Remindify OS

**The autonomy layer for everything that comes back.**

Remindify turns recurring obligations — renewals, filings, maintenance, birthdays, payroll — into an owned, risk-scored, proof-backed register. Humans and agents share the same work surface. Every action is scoped, every outcome needs evidence, and every decision is auditable.

The repo now includes a public, story-led site and a real account gate. Anyone can read the story, pricing, security model, legal pages and manifesto. The register itself is private: email, Google or wallet sign-in is required, while the product wallet remains optional for ordinary obligations.

Built from the original Remindify pitch, modernised for a world where agents are first-class operators, not just notifications.

**Live preview:** https://remindify-xi.vercel.app

```bash
npm install
cp .env.example .env         # optional; the defaults work locally
npm run dev                  # API on :4178, app on :5173
# or
npm run build && npm start   # production build on :4178
```

Open **http://localhost:5173** (dev) or **http://localhost:4178** (built). Create an account on the first visit. Google sign-in explains what is missing until OAuth credentials are configured; email and wallet sign-in work without Google.

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

If a CLI deployment is blocked because the latest Git commit author is not a member of the Vercel team, either add that email to the team or deploy from a clean copy without a `.git` directory. GitHub auto-deploy also requires the Vercel GitHub app to have access to this private repository.

---

## What's in the product

| Surface | What it does |
| --- | --- |
| **Public site** | Story-led landing page, pricing, security model, about, privacy, terms and auth screens, all in the same warm editorial system. |
| **Accounts** | Email/password, Google OAuth and wallet sign-in; emailed email confirmation and single-use password reset; 30-day HttpOnly sessions; every app API route is gated. |
| **Today** | Greeting, live approvals, closest-to-the-edge obligations, portfolio pulse, agent wire, failsafe policy. |
| **Obligations** | The register. Search, filter by risk/owner/autonomy, inline autonomy control, risk meters, due dates, backups. |
| **Capture** | Paste a letter, email or messy note, or drop a text-based PDF. A deterministic parser extracts obligations, dates, amounts, recurrence, provider and category — then asks you to review before scheduling. No external AI API is called; text-based PDFs are read in the browser, while scanned PDFs need OCR or a vision service. |
| **Agents** | Agent passports: role, scopes, trust, runs, success rate, autonomy ceiling, execution connector, obligations on desk, recent runs, exportable passport JSON. |
| **Marketplace** | Vetted humans and agents side by side. Fixed price, escrow on proof, scoped access, SLA. Attach a provider to an obligation or post a new job. |
| **Activity & proof** | Immutable event stream, filterable by agents/humans/system/API/proof, exportable audit log, proof vault. |
| **Trust layer** | Offchain proof receipts, EIP-712 signing, optional Base/Celo anchoring, and USDC escrow intents that release on proof. Preview mode needs no wallet or contract. |
| **Agent access** | Machine API keys, endpoint reference, webhooks, live test call, recent machine calls, guardrails. |

Plus: **⌘K command palette**, obligation drawer with autonomy + checklist + proof + timeline, agent passport drawer, create-agent / new-obligation / hire flows, toasts, and a virtual clock.

### The demo, in 90 seconds

1. **Today** — 5 approvals are waiting. Open one and **Approve**. With no executor connected, the decision is recorded and the obligation stays open for you. Connect an executor in an agent's passport, then the same button reads **Approve & run** and the agent executes.
2. **Capture** — choose “Insurance renewal letter” → **Parse & structure**. One obligation appears with due date, amount, provider, recurrence and the exact source sentence. Confirm and schedule it.
3. **Obligations** — open any row. Change autonomy from Notify to Auto and watch the risk score recalculate. Add proof to complete it.
4. **Agents** — open **Ledger**’s passport. See its ceiling, scopes, trust, work on desk, and the execution connector.
5. **Marketplace** — delegate the payroll filing to a human PA or an agent. Access is scoped to that obligation; payment releases on proof.
6. **Trust layer** — every completion files an offchain receipt. Open it, **Sign** with a wallet or copy the EIP-712 payload. With a contract configured, **Anchor** writes the proof hash to Base. Escrow intents release only against a signed or anchored receipt.
7. **Agent access** — hit **Test live call**, create a key, or run the MCP server.
8. **Time machine** — on Today, **Run agent sweep**, then **Time machine · +7 days**. Agents draft plans and escalate approvals. Autopilot obligations execute only where a connector is connected; otherwise the sweep tells you how many are waiting on one. Reset from the clock chip.

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
  auth.tsx           session context, email/Google/wallet flows, 401 handling
  lib/router.ts      hash routing for public and authenticated surfaces
  components/        drawers, modals, command palette, icons, shared UI
  styles/            custom warm-editorial design system (Instrument Sans/Serif, JetBrains Mono)
server/
  index.mjs          shared HTTP handler for Node and Vercel, plus static serving
  auth.mjs           scrypt passwords, hashed sessions, Google OAuth, wallet verification
  db.mjs             database facade: SQLite locally, Postgres on Vercel
  db-sqlite.mjs      node:sqlite store (JSON row documents, WAL), auth tables
  db-postgres.mjs    request-scoped Postgres snapshot, auth tables, advisory lock
  seed.mjs           rich demo workspace: 16 obligations, 7 agents, 8 providers, events, keys
  engine.mjs         risk scoring, recurrence, approvals, sweep, autopilot, virtual clock
  parse.mjs          deterministic capture parser (no external AI)
  trust.mjs          Base/Celo registry, EIP-712 receipts, anchoring, escrow intents
  dev.mjs            runs API + Vite together
api/[...path].js     Vercel serverless entrypoint for /api/*
vercel.json          Vercel build and function configuration
contracts/           reference Solidity: attestations registry + USDC escrow
mcp/server.mjs       zero-dependency MCP stdio server (tools + structured content)
data/                local SQLite database (created on first run)
public/fonts/        self-hosted fonts
```

- **State is server-authoritative.** The client polls `/api/state` every 12s and after every action.
- **Risk** = `severity × 15 × urgency(days) × autonomyFactor × confidenceFactor`, clamped to 2–97 and banded critical/high/guarded/low.
- **Recurrence** advances from the current due date, preserving the original day-of-month where possible.
- **Virtual clock** is a persisted offset (`clock_offset_days`), so time-machine demos are consistent across API, UI and seeded relative dates.
- **No blockchain keys, no document upload, no tracking.** The capture parser is deterministic, calls no external AI service and is covered by `npm test`. Text-based PDFs are read in the browser; only the extracted text is sent to the workspace API. Scanned PDFs need OCR or a vision service. Authentication is the only place the product stores identity data.

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

App routes (`/today`, `/obligations`, `/capture`, `/agents`, `/market`, `/activity`, `/trust`, `/access`) require a session. Visiting one while signed out opens the auth page with a `next` target, so email and wallet sign-in return to the requested surface. Old `#/route` links are still accepted and rewritten to the clean path.

### Sign-in methods

- **Email and password** — scrypt hashes with a per-user salt. Passwords are never stored in plain text.
- **Google OAuth** — authorization code flow with a one-time state cookie and verified profile email. If credentials are absent, the button shows a short configuration notice and email/wallet remain available.
- **Wallet** — `personal_sign` over a one-time, ten-minute nonce. The server verifies the signature with viem; no transaction, gas or private key is involved. The signed message names chain ID 8453 because the trust layer is Base-first, but signing in does not touch a chain.

Sessions last 30 days. The cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` when served over HTTPS. Only a SHA-256 hash of the session token is stored. The browser wallet remains optional: an email-only account can use the full register, capture, agents, proof and export. Ethiopian obligations stay offchain.

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

Then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Use `GOOGLE_REDIRECT_URI` if the callback differs from `${PUBLIC_ORIGIN}/api/auth/google/callback`. Without credentials, the Google button shows a short configuration notice and email/wallet remain available.

### Password reset

`POST /api/auth/reset/request` accepts `{ "email" }` and always answers `202` with the same message, so it never reveals whether an account exists. For a real account it stores a SHA-256 digest of a 32-byte token with a 30-minute expiry and emails a link to `/login?reset=…`. `POST /api/auth/reset/confirm` accepts `{ "token", "password" }`, consumes the token once (expired, reused or wrong-purpose tokens fail with `400`), updates the scrypt hash and deletes every existing session for that account.

Reset email goes through a single HTTPS webhook, so the app holds no SMTP credentials. Point `EMAIL_WEBHOOK_URL` at an adapter that accepts `{ to, subject, text }`, and set `EMAIL_WEBHOOK_SECRET` to sign it. Signed requests carry `x-remindify-timestamp` and `x-remindify-signature: sha256=<HMAC of "<timestamp>.<raw body>">`. Without `EMAIL_WEBHOOK_URL` the endpoints return `503 email_not_configured` and the “Forgot password?” link stays hidden. Following a reset link also marks the mailbox as confirmed.

### Email confirmation

Signup sends a confirmation link to `/login?verify=…` when email is configured. The token is hashed, single-use and valid for 24 hours; a resend replaces the previous link. `POST /api/auth/verify/request` (signed in) sends or resends it, and `POST /api/auth/verify/confirm` with `{ "token" }` records `email_verified_at`. Google sign-ins and password resets count as confirmed because both prove control of the address. Confirmation is soft for the register: unverified accounts keep full access and only see an in-app banner with a Resend button. Wallet accounts have no email and never see the banner.

Plan changes are stricter once `EMAIL_WEBHOOK_URL` is set: `POST /api/billing/plan` answers `403 {"error":"email_unverified"}` when an email account asks for a paid plan without confirming first. Downgrades to Free and wallet-only accounts stay open, and without an email provider nobody could confirm, so the gate stays open in that preview configuration.

### Account deletion

“Delete account…” in the account menu calls `POST /api/account/delete` with `{ "confirm": "delete" }`. Password accounts must also send the current password; wrong or missing credentials return `401` and change nothing. A successful call deletes that account's sessions and single-use tokens, purges its private workspace (`items` and `meta`), removes the user row and clears the session cookie. Accounts that share the demo workspace lose the account but not the shared register, which stays available to other demo accounts. There is no soft-delete window, so the dialog links to `GET /api/export` first. The endpoint is rate limited per IP.

### Region gating

Set `BLOCKED_COUNTRIES` to a comma-separated list of ISO 3166-1 alpha-2 codes (`KP,IR,SY,CU`) to refuse account creation and escrow money movement for visitors geolocated there. The default is empty: Remindify does not decide on its own which jurisdictions its operator may serve. When configured, these calls answer `451 {"error":"region_blocked"}`:

- `POST /api/auth/signup`, `GET /api/auth/google` (and its callback, which redirects to `/login?notice=region_blocked`), `POST /api/auth/wallet/challenge` and `POST /api/auth/wallet/verify`;
- `POST /api/trust/escrows`, `/fund` and `/release`.

Sign-in for an existing account still works, so someone who moves or travels keeps access to their register; only new accounts and new money movement are refused.

### Sanctions screening

Set `SANCTIONS_API_URL` to screen the signed-in account's connected wallet before escrow money moves. Remindify POSTs `{ "addresses": [...] }` and expects `{ "hits": [{ "address", "reason" }] }`; a matching address stops `POST /api/trust/escrows`, `/fund` and `/release` with `403 {"error":"sanctions_hit"}` and the hit list. `SANCTIONS_API_KEY` adds a Bearer header and `SANCTIONS_TIMEOUT_MS` bounds the call (5 seconds by default). A provider outage lets the movement through by default; set `SANCTIONS_FAIL_CLOSED=1` to answer `503 {"error":"sanctions_unavailable"}` instead.

This is a seam, not a compliance program: only wallets the account has connected are screened, escrows funded from an external wallet and marketplace provider payout addresses are not, and hits are reported as the provider returns them. Pick a provider with the coverage and record-keeping your jurisdiction requires.

The country comes from `x-vercel-ip-country`, `cf-ipcountry` or `x-country-code`, in that order. Requests with no usable header are allowed so local development and self-hosted installs without a geo proxy keep working. These headers are only trustworthy behind a proxy you control: a client that reaches the Node server directly can send any value, so terminate traffic at Vercel or Cloudflare, or have your own proxy set the header from a source you trust. This is coarse geolocation, not a sanctions screening service; combine it with a provider check if you are required to screen individuals.

### API protection

`/api/auth/*` and `/api/health` are public. The machine API under `/api/v1/*` still authenticates with `Authorization: Bearer rfy_live_...`. Every app endpoint (`/api/state`, `/api/capture`, `/api/obligations`, `/api/approvals/*`, `/api/agents`, `/api/hire`, `/api/keys`, `/api/trust/*`, `/api/demo/*`, `/api/account/delete`) returns `401 {"error":"unauthorized"}` without a valid session cookie.

The server partitions obligations, agents, runs, receipts, escrows, API keys and meta keys by workspace. A session cookie resolves to that account's workspace; a machine API key resolves to the workspace that issued it. New accounts get a seeded copy of the demo register in their own workspace, and `POST /api/demo/reset` only clears the caller's workspace. Auth rows (users, sessions, wallet challenges) live outside any workspace, so a reset never signs anyone out or touches another account.

Every response, API and static, carries `x-content-type-options: nosniff`, `x-frame-options: DENY` with `content-security-policy: frame-ancestors 'none'`, `referrer-policy: strict-origin-when-cross-origin` and a `permissions-policy` that turns off camera, microphone, geolocation and payment. `strict-transport-security` is added when the request arrives over TLS.

`POST /api/cron/outbox` and `POST /api/cron/sweep` are machine-only: they require a Bearer secret and return `404` when none is configured, so no session can reach them. See [Execution connectors](#execution-connectors) for the retry contract and [Scheduled sweeps](#scheduled-sweeps) for the sweep contract. The other public `/api/` routes are `GET /api/digest/unsubscribe` and `GET /api/digest/subscribe`, which only accept a recipient-signed token.

Existing single-workspace databases are migrated in place: rows that predate this change are assigned to the `ws_demo` workspace.

### Status hints

- Google: requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and a registered redirect URI.
- Wallet: requires a browser wallet for manual testing. The server flow is verified with viem-generated accounts.
- Contacts: `hello@remindify.app` and `security@remindify.app` are placeholders until monitored inboxes are confirmed.

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

The trust layer is **Base-first and wallet-optional**. It exists for the moment when a provider, auditor or counterparty needs to verify that work happened without trusting Remindify's database.

There is **no token**. USDC is the only asset that can move, and only when a contract is configured and the owner's wallet signs the transaction. The server never holds a private key.

### The receipt lifecycle

1. **File** — completing an obligation writes a receipt with `status: prepared`. The proof label/reference is hashed with the obligation id and a random nonce; the evidence envelope is hashed separately. Document contents are never uploaded or stored.
2. **Sign** — the trust page presents EIP-712 typed data (`ProofReceipt`) with the obligation id, proof hash, evidence hash, agent id, issued-at and nonce. The server verifies the signature with viem and stores the signer. `status: signed`.
3. **Anchor** (optional) — if an attestation contract is configured, the owner's wallet sends `anchor(...)`. The server verifies the transaction receipt and the `ReceiptAnchored` event over RPC before setting `status: anchored`.
4. **Escrow** — an escrow intent starts as `draft`. `POST /commit` records an offchain commitment; `POST /fund` records an onchain USDC funding when a contract is configured. `POST /release` requires a signed or anchored receipt for the same obligation.

A receipt can stay offchain forever. Anchoring is an escalation, not a requirement.

### Networks

| Key | Chain | ID | USDC | Role |
| --- | --- | --- | --- | --- |
| `base` | Base | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Primary |
| `base-sepolia` | Base Sepolia | 84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | Testnet |
| `celo` | Celo | 42220 | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | Grant pilot |
| `celo-sepolia` | Celo Sepolia | 11142220 | `0x01C5C0122039549AD1493B8220cABEdD739BC44E` | Testnet |

USDC addresses are the Circle-issued tokens for each network. Base is the long-term ecosystem; Celo is the near-term Prezenti pilot.

### Preview mode vs configured mode

Preview mode is the default and is deliberately useful on its own:

- receipts are created, signed and verified offchain;
- the EIP-712 domain uses the zero address as `verifyingContract`;
- anchor calldata is prepared and copyable, but no transaction is sent;
- escrow intents can be committed and released offchain.

Configure a contract when you have deployed one:

```bash
# Base
BASE_RPC_URL=https://mainnet.base.org
BASE_ATTESTATION_CONTRACT=0x...
BASE_ESCROW_CONTRACT=0x...

# Base Sepolia
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_SEPOLIA_ATTESTATION_CONTRACT=0x...
BASE_SEPOLIA_ESCROW_CONTRACT=0x...

# Celo
CELO_RPC_URL=https://forno.celo.org
CELO_ATTESTATION_CONTRACT=0x...
CELO_ESCROW_CONTRACT=0x...

# Celo Sepolia
CELO_SEPOLIA_RPC_URL=https://forno.celo-sepolia.celo-testnet.org
CELO_SEPOLIA_ATTESTATION_CONTRACT=0x...
CELO_SEPOLIA_ESCROW_CONTRACT=0x...
```

When an address is present, the server checks transaction receipts against the configured RPC and contract before recording an anchor, funding or release. The RPC URL is configurable; the default public endpoints are only for demos.

### Contracts

`contracts/RemindifyAttestations.sol` verifies the EIP-712 signature onchain and stores `anchored[receiptId]`. `contracts/RemindifyEscrow.sol` is a minimal USDC escrow that releases only when the attestation registry says the proof receipt is anchored.

Both are **reference implementations, unaudited and not deployed**. They compile with `solc 0.8.24`, which is pinned as a dev dependency:

```bash
npm run contracts:compile
```

That writes ABI and bytecode to `contracts/artifacts/` (ignored by git) so the contracts can be inspected without a full Solidity toolchain.

Deploy to a testnet first. The deploy script compiles in memory, checks the RPC chain ID, deploys the attestation registry, then deploys the escrow against the verified USDC address:

```bash
# Validate the RPC and deployer without sending a transaction
npm run contracts:deploy -- base-sepolia --dry-run

# Deploy (private key is read from the environment and never written to disk)
DEPLOYER_PRIVATE_KEY=0x... npm run contracts:deploy -- base-sepolia
```

The script prints the `*_RPC_URL`, `*_ATTESTATION_CONTRACT` and `*_ESCROW_CONTRACT` values for the server, and records the addresses and transaction hashes in `contracts/deployments/<network>.json`. Supported network keys: `base`, `base-sepolia`, `celo`, `celo-sepolia`.

Verify both contracts on Basescan or Celoscan after deployment. Use `solc 0.8.24` with the optimizer enabled at 200 runs, matching `contracts/compile.mjs`.

After deploying, set the env vars, restart the server, and rehearse the full flow: file a receipt, sign it, anchor it, then fund and release an escrow. The product works without a deployment in preview mode.

### Trust API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/trust` | Networks, receipts, escrows, stats and guardrails. |
| `POST` | `/api/trust/receipts` | File a receipt: `{ obligation_id, proof, chain }`. |
| `POST` | `/api/trust/receipts/:id/sign` | Verify and store `{ signature, signer }`. |
| `POST` | `/api/trust/receipts/:id/anchor` | Verify `{ tx_hash }` against the configured contract. |
| `GET` | `/api/trust/receipts/:id/calldata` | Prepared `anchor(...)` calldata. |
| `POST` | `/api/trust/escrows` | Open an intent. Requires `jurisdiction_ack: true`; `451` in a blocked region. |
| `POST` | `/api/trust/escrows/:id/commit` | Commit the intent offchain. |
| `POST` | `/api/trust/escrows/:id/fund` | Record `{ tx_hash }` when an escrow contract is configured. |
| `POST` | `/api/trust/escrows/:id/release` | Release against `{ proof_receipt_id }` (or the latest signed receipt). |

Machine-native agents can read trust state and file a receipt:

```bash
curl -X POST http://localhost:4178/api/v1/trust/receipts \
  -H "Authorization: Bearer rfy_live_7c2a91f4d0e8b6a3c5d2" \
  -H "content-type: application/json" \
  -d '{"obligation_id":"ob_domain","proof":"renewal confirmation","chain":"base"}'
```

`GET /api/v1/trust` returns the same snapshot for agents.

### Guardrails

- **Ethiopia stays offchain.** No wallets or USDC payments for Ethiopian obligations until the NBE authorises virtual-asset activity. Escrow creation requires an explicit `jurisdiction_ack: true` at the API boundary and a required checkbox in the UI. Celo is gated to non-Ethiopian counterparties.
- **Operator-managed region list.** `BLOCKED_COUNTRIES` refuses new accounts and escrow movement from listed countries. It is empty unless the operator sets it, and it reads edge-proxy geolocation, not a sanctions list.
- **No token.** No points, no airdrop, no speculative asset.
- **No custody.** The server never holds a key and never moves funds.
- **No forced wallet.** A receipt is useful the moment it is filed.
- **No document contents onchain or in the trust store.** Only the proof label/reference and hashes are stored.
- **Contracts are unaudited.** Treat them as a starting point for a security review, not production infrastructure.

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
| `GET` | `/api/v1/trust` | `risk:read` | Receipts, escrows, networks and trust stats. |
| `POST` | `/api/v1/trust/receipts` | `obligations:write` | File a proof receipt from an agent. Idempotent. |

App endpoints require a signed-in session cookie: `/api/state`, `/api/capture`, `/api/obligations`, `/api/approvals/:id/decide`, `/api/agents`, `/api/agents/:id/executor`, `/api/hire`, `/api/keys`, `/api/trust/*`, `/api/billing`, `/api/demo/{sweep,advance,reset}`. Public app endpoints are limited to `/api/auth/*`, `/api/health` and the Bearer-authenticated `/api/v1/*` machine API and `/api/cron/*` schedulers.

### Plans and usage

Each workspace has a plan and two real allowances: agent keys and machine calls per calendar month. Calls are metered in the workspace's own meta and reset on the first request of a new month; exceeding either allowance returns `402` (keys) or `429` (calls) with `error: "plan_limit"`.

| Plan | Price | Agent keys | Machine calls / month |
| --- | --- | --- | --- |
| Free | $0 | 3 | 500 |
| Studio | $49 | 25 | 50,000 |
| Firm | $199 | 100 | 500,000 |

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

Tools: `list_obligations`, `get_obligation`, `create_obligation`, `complete_obligation`, `portfolio_risk`, `list_agents`, `list_trust`.

The default key is the seeded demo key. Issue a fresh one in **Agent access** and set `REMINDIFY_KEY` for anything real.

---

## Scripts

```bash
npm run dev              # API + Vite with proxy
npm run build            # client + SSR prerender + sitemap/robots/llms
npm start                # serve dist + API on :4178
npm run mcp              # MCP stdio server
npm test                 # parser, trust and contract regression tests (node:test)
npm run typecheck        # tsc --noEmit
npm run check            # typecheck + production build
npm run contracts:compile # compile reference contracts to contracts/artifacts/
npm run contracts:deploy -- base-sepolia --dry-run
```

Requires **Node 22.5+** for `node:sqlite` (tested on Node 24). No native modules. `viem` is server-side only; it is not shipped to the client bundle.

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
- keep proof documents out of the database (only hashes are stored) or add encrypted file storage with per-file deletion before accepting uploads; activity retention is `RETENTION_DAYS` and account deletion purges the workspace;
- replace the deterministic parser with a hybrid local + model pipeline for PDFs and images;
- connect a payment provider (Stripe or similar) and tax handling to the existing plans and usage metering;
- take the reference contracts through an audit, add upgrade/ops procedures, and test anchor/fund/release against a deployed contract on Base Sepolia before mainnet;
- connect a real sanctions provider behind the `SANCTIONS_API_URL` seam (it screens the payer's connected wallet on escrow money movement, but external-wallet funding and provider payout addresses are out of scope);
- confirm or replace the placeholder `hello@remindify.app` and `security@remindify.app` inboxes.

The design decisions that matter — autonomy ceilings, proof requirements, audit trail, human/agent parity — are already in the data model.

---

## Funding and applications

- [FUNDING.md](./FUNDING.md) — scored shortlist, exclusions, deadlines and recommended sequencing.
- [APPLICATIONS.md](./APPLICATIONS.md) — working drafts for SXSW Pitch 2027, Base Ecosystem Fund and Celo Prezenti Frontier, plus a demo script and the missing-information checklist.

These are working documents. Verify every deadline and requirement on the official program page before submitting.

---

## License

MIT. See [LICENSE](./LICENSE).
