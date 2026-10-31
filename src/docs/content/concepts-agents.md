# Agents and passports

An agent in Remindify is not a prompt. It is a record with a name, a role, a ceiling, scopes, a connector and a run history. The passport is the thing you can audit and export.

## Passport fields

| Field | Meaning |
| --- | --- |
| `id`, `name`, `handle` | Stable identity (`ag_...`). |
| `role` | What this agent is for, in human language. |
| `description` | Mandate and constraints. |
| `capabilities` | Verbs such as `pay`, `file`, `reconcile`, `book`, `call`. |
| `autonomy_ceiling` | The highest autonomy this agent may exercise: `notify`, `prepare`, `approve` or `autopilot`. |
| `scopes` | Domain permissions the connector and the agent agree on, such as `bank:read` or `orders:draft`. |
| `trust` | A 0–100 score kept for the passport and the marketplace. |
| `status` | `active`, `paused` or `archived`. |
| `executor_url` | The HTTPS endpoint that can execute work. Never returned with its secret. |
| `runs_30d`, run history | Derived from the run log, not hand-written. |

## Two kinds of scopes

Do not confuse them:

| Kind | Where it applies | Enforced by |
| --- | --- | --- |
| **Machine key scopes** | `/api/v1/*` requests | The server. A key without `obligations:write` gets `403 missing_scope`. |
| **Passport scopes** | The work an agent's connector is allowed to do | Your executor and your own policy. Remindify records them and passes them to the connector; it does not inspect your bank call. |

A reasonable passport for a filing agent:

```json
{
  "name": "Compliance",
  "role": "Regulatory filings",
  "autonomy_ceiling": "approve",
  "scopes": ["documents:read", "filings:submit", "receipts:write"],
  "capabilities": ["file", "submit", "receipts"]
}
```

Issuing a key with `obligations:write` does not grant the agent permission to move money. Only the connector can do that, and only if you built it to.

Money routes are deliberately outside the machine API. `/api/payments/*`, `/api/paypal/*` and `/api/seller/*` accept a session cookie only, so a machine key gets `401 unauthorized` even with every scope. A human signs in and pays; an agent can file the obligation that needs paying. If you want an agent to settle something, have it produce the receipt the human then releases against.

## The ceiling is a hard cap

The agent's ceiling and the obligation's autonomy are combined: the lower of the two wins.

- `autopilot` obligation + `approve` agent = approval required.
- `notify` obligation + `autopilot` agent = a reminder, not action.

This lets you keep a cautious agent on a high-autonomy register without rewriting every row.

## Execution

An agent is **draft-only** until you connect an executor. The executor is an HTTPS endpoint you control. When the agent acts, Remindify sends a signed request:

- the run id,
- the workspace and agent,
- the obligation,
- the action and detail.

Your endpoint does the work and returns a proof reference. Read the contract in [Execution connectors](/docs/guides/executors).

The connector secret is shown once, stored server-side, stripped from state and exports, and rotated when you reconnect. Executor URLs are resolved and pinned to a public address for the send; redirects are refused.

## Runs and trust

Every execution attempt becomes a run with a status (`done`, `failed`, `blocked`, `drafted`), a timestamp, a proof reference and an error when there is one. The passport's success rate and run counts are derived from these rows.

Failed connector calls do not disappear. Transient failures are retried inline, then queued in a durable outbox with backoff. A permanently failed job stays visible instead of silently retrying forever.

## Creating and exporting

- Create an agent in **Agents → Create agent** (`POST /api/agents`) with a role and ceiling.
- Edit name, role, description, ceiling, status, capabilities and scopes with `PATCH /api/agents/:id`.
- Connect or disconnect the executor with `POST /api/agents/:id/executor`.
- Export the passport as JSON from the passport drawer for review, version control or a marketplace listing.

An exported passport is a description, not a credential. It contains no signing secret and no machine key.
