# Developer docs

Remindify is a register for recurring business obligations: vendor renewals, compliance filings, contractor deliverables and invoice collections. Each row has an owner, a backup, a due date, a risk score, an autonomy ceiling and a proof requirement. Your software can read and complete those rows.

These docs cover three audiences:

- **Agent builders** who want a model or automation to list, create and complete obligations through REST or MCP.
- **Connector authors** who want an agent to execute real work through a signed HTTPS endpoint.
- **Sellers and human workers** who take work from the marketplace and get paid when proof is accepted.

## Start here

Pick the path that matches what you are building.

<div id="docs-entry-points"></div>

## The mental model

A reminder is a notification. An obligation is a record with consequences:

1. It belongs to one **workspace**.
2. It has one **owner** and one **backup**.
3. It has a **due date**, an optional recurrence and a **risk score**.
4. It has an **autonomy ceiling** that limits what an agent may do without a human.
5. It cannot be closed without the **proof** you defined.
6. Every action against it is attributed in the **event log**.

Machine access is scoped, expiring and metered. Agents do not receive a shared root key; each key is issued by a workspace, limited to four scopes and revoked or rotated independently.

## Base URL and authentication

| Environment | Base URL |
| --- | --- |
| Local | `http://localhost:4178` |
| Production | your `PUBLIC_ORIGIN` |

Machine endpoints live under `/api/v1/*` and use a bearer key:

```http
Authorization: Bearer rfy_live_...
```

Create keys in **Agent access** in the app or with `POST /api/keys` from a signed-in session. The full secret is shown once. Keys expire after 90 days by default and can be rotated.

The REST API and the included MCP server are two views of the same register. See [MCP and agent tools](/docs/guides/agent-tools).

## What is stable, and what is in preview

| Area | Status |
| --- | --- |
| REST `/api/v1/*`, MCP server, machine keys | Available |
| Execution connectors with signed requests and durable retries | Available |
| Proof receipts and the AI proof auditor | Available; Gemini 2.5 Flash when `GEMINI_API_KEY` is set, deterministic fallback otherwise |
| PayPal payments, escrow holds and seller payouts | Available; needs `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`, sandbox by default |
| Billing | Preview: plans and metering work, subscription billing is not connected |
| Proof file uploads | Not yet: proof is a reference string, not a stored file |
| Seller workspace, earnings and payouts | Live in preview; PayPal Payouts is the only connected payout rail |

Remindify does not hold funds, cards or credentials. A proof receipt is a server-signed HMAC record; the auditor scores its evidence against the obligation. A PayPal escrow authorizes a hold for up to 29 days and captures it only after the auditor verifies the receipt, then pays the provider net of the platform fee. A direct PayPal payment moves between the payer's and payee's own PayPal accounts; Remindify records the capture and files it as proof.

## Conventions

- Requests and responses are JSON. Send `content-type: application/json`.
- Timestamps are ISO 8601 strings. Dates in machine responses are UTC.
- Money is a number in the obligation's `currency`; the demo register uses USD. PayPal settles USD only. Escrow holds, captures and payouts are USD.
- Mutating machine calls accept `Idempotency-Key`. Reuse it when retrying.
- Every response includes `x-ratelimit-limit` and `x-ratelimit-remaining`.
- Errors are `{ "error": "code", "message": "..." }`, with extra fields when useful. See [Errors](/docs/reference/errors).

## Getting help

These docs are generated from the same repository as the server. When an endpoint changes, the reference is expected to change with it. If you find a mismatch, report the request path, the response body and the approximate time; never include a live key.
