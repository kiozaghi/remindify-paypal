# Error reference

Errors are JSON:

```json
{ "error": "code", "message": "A sentence a human can act on." }
```

Some add fields such as `scope`, `plan`, `limit` or `retry_after`. The HTTP status is the first signal; the `error` code is the contract.

## Authentication and accounts

| Status | Code | Cause | Fix |
| --- | --- | --- | --- |
| `401` | `unauthorized` | No session cookie or a machine key on an app route. | Sign in, or use `/api/v1/*` with a bearer key. |
| `401` | `invalid_credentials` | Wrong email or password. | Retry; reset the password if needed. |
| `401` | `key_expired` | Machine key past `expires_at`. | Rotate the key and deploy the new secret. |
| `403` | `missing_scope` | Key lacks the scope for this endpoint. | Issue a key with the scope, or use a different key. |
| `403` | `email_unverified` | A paid plan change needs a confirmed address. | Confirm the email, then retry. |
| `409` | `email_taken` | Signup for an existing address. | Sign in instead. |
| `422` | `invalid_email` | Malformed address or longer than 254 characters. | Send a valid address. |
| `422` | `weak_password` | Password outside 8–256 characters. | Use a longer password. |
| `429` | `rate_limited` | Too many auth attempts. | Wait for `Retry-After` or a minute. |
| `451` | `region_blocked` | New account, escrow movement or a payment route from a blocked country. | Only the operator can change `BLOCKED_COUNTRIES`. |

## Machine API

| Status | Code | Cause | Fix |
| --- | --- | --- | --- |
| `401` | `unauthorized` | Missing, malformed or unknown bearer key. | Check `Authorization: Bearer rfy_live_...`. |
| `403` | `missing_scope` | The key does not include the needed scope. | Issue a scoped key. |
| `404` | `not_found` | Unknown path or obligation. | Check the id and path. |
| `409` | `idempotency_conflict` | Same `Idempotency-Key`, different body, within 24 hours. | Use a new key for a different operation. |
| `422` | `title_required` | Creating an obligation without a title. | Send `title`. |
| `422` | `obligation_id_required` | Filing a receipt without `obligation_id`. | Send the id. |
| `429` | `rate_limited` | Per-key request window exceeded. | Back off using `Retry-After`. |
| `429` | `plan_limit` | Monthly machine calls exhausted. | Upgrade the plan or wait for the next month. |
| `402` | `plan_limit` | Agent key allowance exhausted. | Remove a key or upgrade. |
| `500` | `server_error` | Unhandled server failure. | Retry if idempotent; report with the path and response. |

## Trust and escrow

| Status | Code | Cause | Fix |
| --- | --- | --- | --- |
| `404` | `receipt_not_found` | Unknown receipt id. | Read `/api/trust` for current ids. |
| `404` | `escrow_not_found` | Unknown escrow id. | Read `/api/trust` for current ids. |
| `422` | `obligation_not_found` | Escrow or receipt references an unknown obligation. | Check the id in the same workspace. |
| `422` | `amount_required` | Escrow amount is zero or not a number. | Send a positive `amount`. |
| `422` | `payee_required` | Escrow opened without a PayPal email for the provider. | Add `payee_paypal_email` or set it on the provider profile. |
| `422` | `paypal_not_configured` | A hold or release without PayPal credentials. | Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. |
| `422` | `escrow_not_releasable` | Release on a draft, voided or already released escrow. | Place the PayPal hold first, then release. |
| `422` | `escrow_already_held` | A second hold on an authorized escrow. | Read the escrow; reuse the existing authorization. |
| `422` | `escrow_already_released` | Void or release on a released escrow. | Read the escrow instead. |
| `422` | `escrow_voided` | Release on a voided escrow. | Open a new escrow. |
| `422` | `proof_required` | Release without any receipt for the obligation. | File proof for this obligation first. |
| `422` | `proof_wrong_obligation` | Receipt belongs to a different obligation. | File a receipt for this obligation. |
| `422` | `proof_rejected` | The auditor rejected the evidence. | Fix the evidence, re-audit, then release. The hold is untouched. |
| `422` | `payout_failed` | Capture succeeded but PayPal refused the payout. | Retry the payout; the escrow stays `captured_awaiting_payout`. |
| `451` | `region_blocked` | Escrow movement from a blocked country. | Only the operator can change `BLOCKED_COUNTRIES`. |

## Payments

Payment routes are session-cookie routes; a machine key gets `401 unauthorized` on them.

| Status | Code | Cause | Fix |
| --- | --- | --- | --- |
| `404` | `payment_not_found` | Unknown order id on capture. | Capture the order id from the approval redirect. |
| `404` | `payout_not_found` | Unknown payout or batch id. | Read `GET /api/payments` for current ids. |
| `409` | `obligation_not_payable` | The obligation is already settled or archived. | Refresh the register; pay a live obligation. |
| `409` | `payout_state` | Paying a payout that is not `processing`. | Request a new payout from cleared earnings. |
| `409` | `paypal_email_required` | A seller payout without a PayPal email on the profile. | Set one under Seller desk → Payout account. |
| `422` | `nothing_to_pay` | The obligation has no amount. | Set an `amount` above zero. |
| `422` | `currency_unsupported` | Obligation currency is not USD. | PayPal settles USD only here. |
| `422` | `amount_too_large` | Above $10,000 per payment. | Split the obligation into smaller payments. |
| `422` | `amount_mismatch` / `currency_mismatch` | PayPal returned a different total than the stored row. | Do not retry blindly; the payment is marked failed. |
| `502` | `paypal_unreachable` | Network failure or timeout to PayPal. | Retry; the order is idempotent on capture. |
| `503` | `paypal_not_configured` | Missing `PAYPAL_CLIENT_ID` or `PAYPAL_CLIENT_SECRET`. | Configure the rail or hide the pay control. |

## Connection and execution

| Symptom | Cause | Fix |
| --- | --- | --- |
| Connector never runs | No executor connected, or the obligation is below `approve`. | Connect an executor in the passport; raise autonomy. |
| `connector_<status>` proof | The executor returned `2xx` without a proof reference. | Return `{"proof": "..."}`. |
| Run `failed`, no retry | The executor returned a non-transient `4xx`. | Fix the request contract; the server treats it as final. |
| Repeated retries | `408`, `429`, `5xx`, timeout or network failure. | Fix availability; the outbox retries with backoff. |
| `executor_url_invalid` | Not HTTPS, local address without opt-in, or a redirect. | Use a public HTTPS endpoint; `EXECUTOR_ALLOW_LOCAL=1` locally. |
| Duplicate side effects | At-least-once delivery. | Dedupe on `x-remindify-run`. |
| Job stuck `pending` | Scheduler not running on serverless. | Call `/api/cron/outbox` with the secret. |

## Cron routes

| Status | Code | Cause | Fix |
| --- | --- | --- | --- |
| `404` | `not_found` | No secret configured, so the route is hidden. | Set `OUTBOX_SECRET` or `CRON_SECRET`. |
| `401` | `unauthorized` | Missing or wrong bearer secret. | Send the exact secret. |

## Reporting a problem

Include:

- the time and timezone,
- the method and path,
- the HTTP status and full JSON body,
- the key prefix (the first 13 characters), never the secret,
- the run id for connector issues.

Do not include the signing secret, session cookie, machine key or PayPal credentials.
