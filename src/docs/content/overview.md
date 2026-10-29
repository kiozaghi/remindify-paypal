# Developer docs

Remindify is a register for recurring obligations: rent, filings, renewals, inspections, birthdays. Each row has an owner, a backup, a due date, a risk score, an autonomy ceiling and a proof requirement. Your software can read and complete those rows.

These docs cover three audiences:

- **Agent builders** who want a model or automation to list, create and complete obligations through REST or MCP.
- **Connector authors** who want an agent to execute real work through a signed HTTPS endpoint.
- **Sellers and human workers** who take work from the marketplace and get paid when proof is accepted.

## Start here

| If you want to... | Read |
| --- | --- |
| Make your first call in ten minutes | [Quickstart](/docs/quickstart) |
| Understand the record you are reading and writing | [Obligations](/docs/concepts/obligations) |
| Give an agent a scoped identity | [Agents and passports](/docs/concepts/agents) |
| Understand proof, signatures and escrow | [Proof and escrow](/docs/concepts/proof-and-escrow) |
| Connect an agent to a real executor | [Execution connectors](/docs/guides/executors) |
| Use Claude, Cursor or another agent tool | [Agent tools and models](/docs/guides/agent-tools) |
| Sign with a wallet | [Wallets and signing](/docs/guides/wallets) |
| Sell work on the marketplace | [Sell on Remindify](/docs/guides/sellers) |
| Look up an endpoint or an error | [REST API](/docs/reference/api) · [Errors](/docs/reference/errors) |
| Configure a deployment | [Environment variables](/docs/reference/environment) |

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
| Proof receipts, EIP-712 signing, optional anchoring | Available; anchoring needs deployed contracts |
| Escrow intents | Available; onchain funding needs deployed contracts and a funded wallet |
| Billing | Preview: plans and metering work, payment provider is not connected |
| Proof file uploads | Not yet: proof is a reference string, not a stored file |
| Seller workspace, earnings and payouts | In progress; see [Sell on Remindify](/docs/guides/sellers) |

Remindify does not hold private keys or custody funds. Escrow is non-custodial and releases only against a valid proof receipt.

## Conventions

- Requests and responses are JSON. Send `content-type: application/json`.
- Timestamps are ISO 8601 strings. Dates in machine responses are UTC.
- Money is a number in the obligation's `currency`; the demo register uses USD. Onchain amounts are USDC.
- Mutating machine calls accept `Idempotency-Key`. Reuse it when retrying.
- Every response includes `x-ratelimit-limit` and `x-ratelimit-remaining`.
- Errors are `{ "error": "code", "message": "..." }`, with extra fields when useful. See [Errors](/docs/reference/errors).

## Getting help

These docs are generated from the same repository as the server. When an endpoint changes, the reference is expected to change with it. If you find a mismatch, report the request path, the response body and the approximate time; never include a live key.
