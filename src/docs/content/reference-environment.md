# Environment variables

Copy `.env.example` to `.env` for local runs. Everything here is optional except where noted; the app boots without it and degrades to a local-only configuration.

Never commit a real `.env`. On Vercel, set variables in Project Settings → Environment Variables and redeploy; build-time values are read by `scripts/seo.mjs`.

## Server

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4178` | HTTP port for the Node server |

Local `npm run dev` runs two processes: Vite on `5173` and the API on `4178`, with `/api` proxied. `npm start` after `npm run build` serves everything from `PORT`.

## Database

Local development uses SQLite through `node:sqlite`. Vercel has no persistent disk, so production must use Postgres.

| Variable | Default | Purpose |
| --- | --- | --- |
| `REMINDIFY_DATA_DIR` | `./data` | Directory for the SQLite file |
| `REMINDIFY_DB` | `./data/remindify.db` | Full path to the SQLite database |
| `DATABASE_URL` | — | Postgres connection string; when set, SQLite is ignored |
| `POSTGRES_URL` | — | Accepted alias for `DATABASE_URL` |
| `POSTGRES_PRISMA_URL` | — | Accepted alias, useful on Vercel/Neon |
| `POSTGRES_URL_NON_POOLING` | — | Accepted alias for direct connections |
| `DATABASE_SSL` | `true` when a URL is set | Set `false` only for local Postgres without TLS |
| `PG_POOL_MAX` | `2` | Connection pool ceiling per instance |
| `PG_NO_LOCK` | — | `1` disables the workspace advisory lock; tests only |

Use exactly one Postgres URL. The server picks the first one it finds in that order, and every instance that shares a database must share the same secret and origin configuration.

## Origin and cookies

| Variable | Default | Purpose |
| --- | --- | --- |
| `PUBLIC_ORIGIN` | `http://localhost:4178` | Canonical origin for OAuth redirects, PayPal return URLs, canonicals and sitemap |
| `COOKIE_SECURE` | inferred from `x-forwarded-proto` | Force `Secure` cookies on or off |

Set `PUBLIC_ORIGIN` to the real HTTPS URL before going live. A wrong origin breaks Google OAuth redirect matching, sends PayPal returns to the wrong host and writes the wrong canonical URLs into the build.

## Search and AI discovery

| Variable | Default | Purpose |
| --- | --- | --- |
| `GOOGLE_SITE_VERIFICATION` | — | Emits the Google verification meta tag at build time |
| `BING_SITE_VERIFICATION` | — | Emits the Bing verification meta tag at build time |

These are read by `scripts/seo.mjs`, not at runtime, so they only apply to prerendered HTML. `PUBLIC_ORIGIN` feeds the sitemap, canonicals and JSON-LD.

## Google OAuth

Optional. Without it, email and password sign-in still works.

| Variable | Default | Purpose |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | — | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | OAuth client secret |
| `GOOGLE_REDIRECT_URI` | `${PUBLIC_ORIGIN}/api/auth/google/callback` | Must match Google Cloud Console exactly |

Register the redirect URI in Google Cloud Console. `http://localhost` redirects are only accepted for local development.

## Billing

Plans, metering and key limits work without a payment provider. Plan switching is disabled until a provider is connected or you explicitly opt in.

| Variable | Default | Purpose |
| --- | --- | --- |
| `BILLING_ALLOW_PLAN_SWITCH` | — | `1` allows plan changes without a provider, for demos or manual invoicing |
| `BILLING_MODE` | — | `demo` presents preview billing behaviour |
| `STRIPE_SECRET_KEY` | — | Reserved for the payment provider integration |

When `EMAIL_WEBHOOK_URL` is set, an email account must confirm its address before switching to a paid plan.

## Payments (PayPal)

Optional. Without credentials every payment route fails closed with `503 paypal_not_configured`, and `state.paypal.configured` is `false` so the app hides the pay control. Amounts are rebuilt from the stored obligation and must be USD.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PAYPAL_ENV` | `sandbox` | `sandbox` or `live`; picks the API base and the checkout host |
| `PAYPAL_CLIENT_ID` | — | REST app client id |
| `PAYPAL_CLIENT_SECRET` | — | REST app secret |
| `PAYPAL_PLATFORM_FEE_PERCENT` | `10` | Platform fee deducted from the captured escrow amount at release; the provider receives the net |
| `PAYPAL_WEBHOOK_ID` | — | Webhook id used to verify signatures at `/api/paypal/webhook`; without it events are acknowledged but not applied |
| `PAYPAL_ALLOW_WEBHOOK_SIMULATOR` | `false` | Accept Developer Dashboard simulator transmissions (tagged `sandbox_simulator`); never enable in production |
| `PAYPAL_SDK` | `on` | `on` uses the APIMatic server SDK for orders and authorize/capture; `off` forces REST |
| `PAYPAL_BASE_URL` | derived from `PAYPAL_ENV` | Override the API base; tests only |
| `PAYPAL_TIMEOUT_MS` | `15000` | Per-request timeout for PayPal calls |

`sandbox` points at the PayPal sandbox APIs and checkout host. It is the default and the only mode this preview is exercised in. `live` uses the production APIs and moves real money; use separate credentials. Never mix sandbox and live credentials.

`npm run dev` copies only the `PAYPAL_*` lines from `.env.local` into the server process. The rest of that file is left alone, so a pulled production `.env.local` does not point local runs at the cloud database. Subscribe the webhook to `PAYMENT.CAPTURE.*` and `PAYMENT.PAYOUTS-ITEM.*` events.

## Machine API

| Variable | Default | Purpose |
| --- | --- | --- |
| `MACHINE_RATE_LIMIT` | `600` | Requests per minute per machine key |

Counters live in workspace metadata, so the limit holds across instances sharing one database. Response headers `x-ratelimit-limit` and `x-ratelimit-remaining` report the state.

## Marketplace and seller desk

Bookings, receipts and the earnings ledger are stored per workspace. Payouts start as ledger entries; with PayPal configured, a seller payout is sent through Payouts to the email on file and tracked by batch id.

| Variable | Default | Purpose |
| --- | --- | --- |
| `MARKETPLACE_FEE_BPS` | `800` | Platform fee in basis points (800 = 8%) recorded on each receipt and ledger entry |
| `SELLER_HOLD_DAYS` | `3` | Days a filed proof stays in `held` before the earning becomes `available` |

The fee is clamped to 0–3000 bps and the hold to 0–30 days. Payout requests also respect `BLOCKED_COUNTRIES`.

## Region gating

| Variable | Default | Purpose |
| --- | --- | --- |
| `BLOCKED_COUNTRIES` | — | Comma-separated ISO 3166-1 alpha-2 codes denied new accounts, escrow movement and PayPal routes |

The country is read from `x-vercel-ip-country`, `cf-ipcountry` or `x-country-code`, in that order. Only set these behind a proxy you control: a client that reaches the server directly can forge them. Blocked requests receive `451 region_blocked`.

## Transactional email

Password reset and email confirmation go through one HTTPS webhook that accepts `{ "to", "subject", "text" }`. Point it at a Resend, Postmark or SES adapter.

| Variable | Default | Purpose |
| --- | --- | --- |
| `EMAIL_WEBHOOK_URL` | — | Mail delivery endpoint; without it, reset and verify return `503` |
| `EMAIL_WEBHOOK_SECRET` | — | Signs requests as `x-remindify-signature: sha256=HMAC(secret, "<timestamp>.<raw body>")` |

The signature format matches execution connectors, so one verification helper works for both.

## Execution connectors

No variables are required to connect an executor; the URL and signing secret live in the agent passport. These tune the dispatcher.

| Variable | Default | Purpose |
| --- | --- | --- |
| `EXECUTOR_TIMEOUT_MS` | `8000` | Per-attempt timeout |
| `EXECUTOR_ATTEMPTS` | `3` | Inline attempts per connector call, 1–5 |
| `EXECUTOR_RETRY_BASE_MS` | `300` | First backoff delay; later attempts back off from there |
| `EXECUTOR_ALLOW_LOCAL` | — | `1` permits `http://localhost` executor URLs; development and tests only |

Executor URLs must be HTTPS in production. Redirects are refused and DNS is pinned to the resolved address to reduce rebinding risk.

## Durable retries and schedulers

Transient failures that survive the inline attempts become durable outbox jobs. The local server sweeps them; serverless deployments must call the cron routes.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OUTBOX_MAX_ATTEMPTS` | `5` | Total delivery attempts before a job is marked failed |
| `OUTBOX_RETRY_BASE_MS` | `60000` | Backoff base for outbox retries |
| `OUTBOX_INTERVAL_MS` | `30000` | Local sweep interval |
| `OUTBOX_SECRET` | — | Bearer secret for `GET/POST /api/cron/outbox` |
| `CRON_SECRET` | falls back to `OUTBOX_SECRET` | Bearer secret for `GET/POST /api/cron/sweep` |

```bash
curl -X POST https://your-app.example.com/api/cron/outbox \
  -H "Authorization: Bearer $OUTBOX_SECRET"

curl -X POST https://your-app.example.com/api/cron/sweep \
  -H "Authorization: Bearer $CRON_SECRET"
```

Configure both on a schedule (Vercel Cron or any external scheduler). `sweep` walks every workspace; it takes a per-workspace lease so overlapping runs skip rather than duplicate, skips runs from the previous six hours and has a 20-second budget.

## Trust layer

Proof receipts work without any configuration: the server signs them with a receipt secret it generates and stores in workspace metadata. Set these to control the auditor and to keep the signing secret stable across deployments.

| Variable | Default | Purpose |
| --- | --- | --- |
| `TRUST_RECEIPT_SECRET` | generated per workspace | HMAC-SHA256 key for receipt signatures; set the same value on every instance that shares a database |
| `GEMINI_API_KEY` | — | Enables AI capture and the Gemini proof auditor; without it both fall back to deterministic server-side rules |
| `AI_MODEL_ID` | `gemini-2.5-flash` | Gemini model used for capture extraction and structured proof scoring |
| `AUDIT_MIN_CONFIDENCE` | `0.8` | Minimum confidence for an auditor verdict to count as verified |
| `CAPTURE_TIMEOUT_MS` | `15000` | A capture call slower than this falls back to the deterministic parser |

The auditor runs when a receipt is audited directly or when a release finds a receipt that is not yet `verified`. Without `GEMINI_API_KEY`, or when the Gemini call fails, the deterministic engine still checks the obligation amount, a confirmation or reference number, a date and the proof requirement. A provider failure is labelled `deterministic_fallback` so the receipt shows which engine decided. Capture uses the same key and falls back to the deterministic parser when the model is unavailable.

Escrow holds, capture and payouts use the PayPal variables above. Without `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`, a hold or release fails closed with `paypal_not_configured`; receipts and the auditor keep working.

## Minimal configurations

**Local development** — nothing required:

```bash
npm install
npm run dev
```

**Local with a stable origin for OAuth and PayPal returns:**

```bash
PUBLIC_ORIGIN=http://localhost:4178
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:4178/api/auth/google/callback
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
```

**Serverless production:**

```bash
DATABASE_URL=postgres://...
PUBLIC_ORIGIN=https://your-app.example.com
EMAIL_WEBHOOK_URL=https://mailer.example.com/remindify
EMAIL_WEBHOOK_SECRET=...
OUTBOX_SECRET=...
CRON_SECRET=...
BLOCKED_COUNTRIES=KP,IR,SY,CU
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_PLATFORM_FEE_PERCENT=10
PAYPAL_WEBHOOK_ID=...
GEMINI_API_KEY=...
AI_MODEL_ID=gemini-2.5-flash
AUDIT_MIN_CONFIDENCE=0.8
TRUST_RECEIPT_SECRET=...
```

Then schedule `/api/cron/outbox` and `/api/cron/sweep`. Without a scheduler, executions still happen inline and retries queue but do not drain on their own.

## Checking configuration

`GET /api/trust` reports the active rail (PayPal mode, configured flag, hold days and fee percent) and the auditor (model, configured flag and threshold). `GET /api/billing` reports the current plan and usage. Never expose secret values in a health endpoint, a log line or an error message.
