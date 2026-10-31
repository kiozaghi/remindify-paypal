# Workspaces and machine keys

Every account gets its own workspace. A workspace owns obligations, agents, runs, receipts, escrows, machine keys and plan usage. Auth rows — users, sessions, wallet challenges, reset tokens — live outside any workspace.

## Two ways to authenticate

| Caller | Credential | Workspace resolved from |
| --- | --- | --- |
| Browser | `remindify_session` HttpOnly cookie | The session's user |
| Machine | `Authorization: Bearer rfy_live_...` | The key's workspace |

The machine key is the only way into `/api/v1/*`. An app endpoint such as `/api/state` or `/api/trust/*` requires a session cookie; a machine key is not a substitute.

New accounts receive a seeded copy of the demo register inside their own workspace. Resetting the demo clears only that workspace.

## Key lifecycle

- **Issue.** `POST /api/keys` from a signed-in session. The response contains `key.secret` once; only a SHA-256 digest and a display prefix are stored.
- **Scope.** `obligations:read`, `obligations:write`, `risk:read`, `agents:read`. Omit `scopes` to receive all four.
- **Expire.** Default 90 days; `expires_in_days` accepts 1–365. Expired keys return `401 key_expired`.
- **Rotate.** `POST /api/keys/:id/rotate` issues a new secret and resets expiry; the old secret stops working immediately.
- **Revoke.** `DELETE /api/keys/:id` locks out every client using it.

A key is a workspace credential, not a user. It does not inherit a person's permissions, and it cannot create another key.

## Rate limits and metering

Two independent limits apply:

| Limit | Default | Scope | Response |
| --- | --- | --- | --- |
| Requests per minute | 600 | Per key | `429 rate_limited` + `Retry-After` |
| Machine calls per month | Plan allowance | Per workspace | `429 plan_limit` |
| Agent keys | Plan allowance | Per workspace | `402 plan_limit` on creation |

Every machine response carries `x-ratelimit-limit` and `x-ratelimit-remaining`. The per-minute counter lives in workspace meta, so it holds across instances sharing the database.

| Plan | Keys | Calls / month |
| --- | --- | --- |
| Personal | 3 | 500 |
| Studio | 25 | 50,000 |
| Operator | 100 | 500,000 |

Usage resets on the first request of a new calendar month. Billing is not connected during the preview; the allowances are still enforced.

## Idempotency

Mutating machine calls accept an `Idempotency-Key` header. For 24 hours:

- the same key and body replays the original response with `Idempotent-Replay: true`;
- the same key with a different body returns `409 idempotency_conflict`.

Use a key derived from the business operation, not a random value per attempt:

```http
Idempotency-Key: complete-payroll-2026-10
```

Without it, a timeout retry can create or complete the same obligation twice.

## Region gating

When the operator configures `BLOCKED_COUNTRIES`, account creation and escrow movement from those countries return `451 region_blocked`. Sign-in for an existing account still works, so travel or relocation does not lock someone out of their register.

The country comes from the edge proxy headers `x-vercel-ip-country`, `cf-ipcountry` or `x-country-code`. Requests with no usable header are allowed; this is coarse geolocation, not identity screening.

## Isolation guarantees and limits

- Every query is scoped to the request's workspace.
- A session cannot read another account's register, receipts or keys.
- Account deletion purges only that account's private workspace; the shared demo workspace is left intact for other demo accounts.
- This is still a prototype. Before charging money, add Postgres row-level security and per-workspace connection limits as defence in depth. Do not treat application-level scoping as the only boundary.
