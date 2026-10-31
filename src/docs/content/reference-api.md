# REST API reference

Base URL: `http://localhost:4178` locally, or your `PUBLIC_ORIGIN` in production. Machine endpoints live under `/api/v1/*`.

## Authentication

```http
Authorization: Bearer rfy_live_...
```

Keys are issued per workspace in **Agent access**. The secret is returned once; only a digest is stored. Keys expire after 90 days by default and can be rotated or revoked.

A missing or invalid key returns `401 unauthorized`. An expired key returns `401 key_expired`. A key without the required scope returns `403 missing_scope`.

## Scopes

| Scope | Grants |
| --- | --- |
| `obligations:read` | `GET /obligations`, `GET /obligations/:id` |
| `obligations:write` | `POST /obligations`, `POST /obligations/:id/complete`, `POST /trust/receipts` |
| `risk:read` | `GET /risk`, `GET /trust` |
| `agents:read` | `GET /agents` |

## Request headers

| Header | Required | Notes |
| --- | --- | --- |
| `Authorization` | Yes | `Bearer rfy_live_...` |
| `content-type` | For JSON bodies | `application/json` |
| `Idempotency-Key` | Recommended on writes | Replays the original response for 24 hours. |

## Response headers

Every machine response includes:

```http
x-ratelimit-limit: 600
x-ratelimit-remaining: 597
```

Idempotent replays add `Idempotent-Replay: true`. A `429` includes `Retry-After` in seconds.

## Endpoints

| Method | Path | Scope | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/obligations` | `obligations:read` | List obligations with risk and due date. |
| `POST` | `/api/v1/obligations` | `obligations:write` | Create an obligation. |
| `GET` | `/api/v1/obligations/:id` | `obligations:read` | Read one obligation. |
| `POST` | `/api/v1/obligations/:id/complete` | `obligations:write` | File proof and complete or reschedule. |
| `GET` | `/api/v1/risk` | `risk:read` | Coverage, exposure, counts and top risks. |
| `GET` | `/api/v1/agents` | `agents:read` | Agent roster with ceilings and scopes. |
| `GET` | `/api/v1/trust` | `risk:read` | Networks, receipts, escrows and trust stats. |
| `POST` | `/api/v1/trust/receipts` | `obligations:write` | File a proof receipt. |

## List obligations

```bash
curl "$REMINDIFY_URL/api/v1/obligations" \
  -H "Authorization: Bearer $REMINDIFY_KEY"
```

```json
{
  "count": 2,
  "clock": "2026-10-28T09:00:00.000Z",
  "obligations": [
    {
      "id": "ob_rent",
      "title": "Pay rent",
      "category": "finance",
      "provider": "Selam Properties",
      "owner": "Solomon Tigabu",
      "backup": "Hanna Bekele",
      "amount": 750,
      "currency": "USD",
      "due_at": "2026-11-01T09:00:00.000Z",
      "autonomy": "autopilot",
      "status": "active",
      "proof_required": "Landlord receipt + transfer reference",
      "risk": { "score": 62, "band": "high", "days": 4, "urgency": 1.18 }
    }
  ]
}
```

## Create an obligation

`title` is required. `due_at` defaults to 14 days from now. `autonomy` defaults to `prepare`; `severity` defaults to 3.

```bash
curl -X POST "$REMINDIFY_URL/api/v1/obligations" \
  -H "Authorization: Bearer $REMINDIFY_KEY" \
  -H "content-type: application/json" \
  -H "Idempotency-Key: create-insurance-2026" \
  -d '{
    "title": "Renew motor insurance",
    "category": "finance",
    "provider": "Awash Insurance",
    "amount": 240,
    "currency": "USD",
    "due_at": "2026-11-20T10:00:00.000Z",
    "autonomy": "approve",
    "severity": 5,
    "proof_required": "Policy certificate",
    "recurrence": { "unit": "year", "interval": 1 }
  }'
```

`201`:

```json
{
  "obligation": {
    "id": "ob_...",
    "title": "Renew motor insurance",
    "risk": { "score": 81, "band": "critical", "days": 23, "urgency": 0.98 },
    "...": "full obligation"
  }
}
```

Errors: `422 title_required`, `409 idempotency_conflict`.

## Complete an obligation

```bash
curl -X POST "$REMINDIFY_URL/api/v1/obligations/ob_.../complete" \
  -H "Authorization: Bearer $REMINDIFY_KEY" \
  -H "content-type: application/json" \
  -H "Idempotency-Key: complete-insurance-2026" \
  -d '{
    "proof": "Policy AW-77213 · renewed to 2027-11-20",
    "note": "Certificate stored in the finance folder."
  }'
```

`200` for a recurring obligation:

```json
{
  "ok": true,
  "obligation": { "...": "updated obligation" },
  "next_due": "2027-11-20T10:00:00.000Z",
  "receipt": { "id": "rcpt_...", "status": "prepared", "proof_hash": "0x..." }
}
```

A one-off obligation returns `archived: true` instead of `next_due`. A missing obligation returns `404`.

## Portfolio risk

```bash
curl "$REMINDIFY_URL/api/v1/risk" \
  -H "Authorization: Bearer $REMINDIFY_KEY"
```

```json
{
  "clock": "2026-10-28T09:00:00.000Z",
  "coverage": 0.86,
  "exposure_usd": 4820,
  "counts": { "critical": 2, "high": 5, "pending_approvals": 3 },
  "top_risks": [
    {
      "id": "ob_payroll",
      "title": "Payroll tax filing",
      "risk": { "score": 88, "band": "critical" },
      "penalty": 240
    }
  ]
}
```

## Trust snapshot

```bash
curl "$REMINDIFY_URL/api/v1/trust" \
  -H "Authorization: Bearer $REMINDIFY_KEY"
```

Returns `networks`, `receipts`, `escrows`, `stats` and `guardrails`. Network entries include chain id, explorer and whether a contract is configured.

## File a receipt from an agent

```bash
curl -X POST "$REMINDIFY_URL/api/v1/trust/receipts" \
  -H "Authorization: Bearer $REMINDIFY_KEY" \
  -H "content-type: application/json" \
  -H "Idempotency-Key: receipt-ob-domain-2026" \
  -d '{
    "obligation_id": "ob_domain",
    "proof": "Cloudflare order CF-88213",
    "chain": "base"
  }'
```

`201` with `{ "receipt": { ... } }`. The receipt is `prepared`; signing and anchoring happen in the trust layer.

## Payments

PayPal routes are **session-cookie** routes under `/api/payments`. They are not part of `/api/v1` and a machine key cannot call them: moving money stays a human action. The full flow is in [Payments](/docs/guides/payments).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/payments` | Payment rows plus `summary` and `paypal: { configured, mode }`. |
| `POST` | `/api/payments/paypal/orders` | Create an order for `{ obligation_id }`; returns `approve_url`. |
| `POST` | `/api/payments/paypal/capture` | Capture `{ order_id }` and complete the obligation. |
| `POST` | `/api/payments/paypal/payouts` | Send a seller payout `{ payout_id }` through Payouts. |
| `GET` | `/api/payments/paypal/payouts/:batch` | Poll a payout batch and update the ledger. |
| `POST` | `/api/paypal/webhook` | PayPal callback; applied only with a verified signature. |

Amount and currency come from the stored obligation, never from the request. Orders are USD-only and capped at $10,000. Capture is idempotent: replaying an order id returns `already_captured: true`. Without `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` every route fails closed with `503 paypal_not_configured`.

## Agents

```bash
curl "$REMINDIFY_URL/api/v1/agents" \
  -H "Authorization: Bearer $REMINDIFY_KEY"
```

```json
{
  "agents": [
    {
      "id": "ag_ledger",
      "name": "Ledger",
      "role": "Money operations",
      "status": "active",
      "autonomy_ceiling": "autopilot",
      "trust": 98,
      "capabilities": ["pay", "file", "reconcile", "receipts"],
      "scopes": ["bank:read", "bank:transfer", "receipts:write"],
      "runs_30d": 24
    }
  ]
}
```

## What the machine API cannot do

- It cannot create, rotate or revoke keys. Those are human actions with a session cookie.
- It cannot change agents, approvals or billing.
- It cannot sign or anchor receipts; it can file them.
- It does not bypass the plan allowance or the per-key rate limit.

## App endpoints

`/api/state`, `/api/capture`, `/api/obligations`, `/api/approvals/*`, `/api/agents`, `/api/hire`, `/api/keys`, `/api/trust/*`, `/api/payments/*`, `/api/seller/*`, `/api/billing` and `/api/demo/*` require a signed-in session cookie. A machine key does not open them.

Public endpoints are `/api/auth/*`, `/api/health`, `/api/v1/*`, `/api/paypal/webhook` (signature-verified) and the secret-protected `/api/cron/*` schedulers.
