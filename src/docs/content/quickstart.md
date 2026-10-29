# Quickstart

This walkthrough creates an agent key and completes a full loop: read the register, create an obligation, file proof, then connect something that can act on it.

## Before you start

- A workspace. Sign up at [remindify-xi.vercel.app/signup](https://remindify-xi.vercel.app/signup), or run Remindify locally.
- Node.js 22 or newer only if you run Remindify locally.
- About ten minutes.

## 1. Pick a base URL

| Where | Base URL | Setup |
| --- | --- | --- |
| Hosted preview | `https://remindify-xi.vercel.app` | Sign up in the browser; nothing to install |
| Local | `http://localhost:4178` | `npm install && npm run dev` |

The hosted preview is a real deployment, not a mock: accounts, machine keys and the REST API work over HTTPS. Two conveniences are switched off there because it has no OAuth client or email webhook — Google sign-in and password reset. Use email and password, keep the password safe, and treat the workspace as demo data. [Environment variables](/docs/reference/environment) lists what a full deployment configures.

```bash
export REMINDIFY_URL=https://remindify-xi.vercel.app
# or: export REMINDIFY_URL=http://localhost:4178
```

### Run locally instead

```bash
npm install
npm run dev
```

Vite serves the app on `http://localhost:5173` and proxies `/api` to the server on `4178`. To serve the built app from one port:

```bash
npm run build
npm start
```

## 2. Create an agent

Open **Agents** and choose **Create agent**. Give it a focus, a role and an autonomy ceiling:

| Ceiling | What the agent may do |
| --- | --- |
| `notify` | Suggest work; never act |
| `prepare` | Draft a plan and checklist |
| `approve` | Act only after a human approval |
| `autopilot` | Act automatically, within its scopes and connector |

The ceiling caps the obligation's own autonomy. An agent with a `prepare` ceiling cannot execute an `autopilot` obligation.

## 3. Issue a machine key

Open **Agent access**, choose **Create key**, and copy the secret immediately. It is shown once.

The four scopes are:

| Scope | What it allows |
| --- | --- |
| `obligations:read` | List and read obligations |
| `obligations:write` | Create obligations, complete them, file receipts |
| `risk:read` | Portfolio risk and trust snapshots |
| `agents:read` | Read the agent roster |

New keys default to all four if you omit `scopes`:

```bash
curl -X POST "$REMINDIFY_URL/api/keys" \
  -H "content-type: application/json" \
  -H "cookie: remindify_session=..." \
  -d '{"name":"registrar","scopes":["obligations:read","obligations:write"],"expires_in_days":90}'
```

The response contains `key.secret` exactly once.

## 4. Read the register

```bash
export REMINDIFY_KEY=rfy_live_...

curl "$REMINDIFY_URL/api/v1/obligations" \
  -H "Authorization: Bearer $REMINDIFY_KEY"
```

Response:

```json
{
  "count": 12,
  "clock": "2026-10-28T09:00:00.000Z",
  "obligations": [
    {
      "id": "ob_rent",
      "title": "Pay rent",
      "category": "finance",
      "provider": "Selam Properties",
      "amount": 750,
      "currency": "USD",
      "due_at": "2026-11-01T09:00:00.000Z",
      "autonomy": "autopilot",
      "proof_required": "Landlord receipt + transfer reference",
      "status": "active",
      "risk": { "score": 62, "band": "high", "days": 4, "urgency": 1.18 }
    }
  ]
}
```

## 5. Create an obligation

`title` is required. `due_at` defaults to 14 days from now if omitted.

```bash
curl -X POST "$REMINDIFY_URL/api/v1/obligations" \
  -H "Authorization: Bearer $REMINDIFY_KEY" \
  -H "content-type: application/json" \
  -H "Idempotency-Key: create-domain-renewal-2026-10" \
  -d '{
    "title": "Renew the studio domain",
    "category": "work",
    "provider": "Cloudflare",
    "amount": 24,
    "currency": "USD",
    "due_at": "2026-11-15T10:00:00.000Z",
    "autonomy": "approve",
    "severity": 4,
    "proof_required": "Registrar confirmation email",
    "recurrence": { "unit": "year", "interval": 1 }
  }'
```

The response is `201` with `{ "obligation": { ... } }`.

If the request times out, retry with the same `Idempotency-Key` and body. The original response is replayed for 24 hours; reusing the key with a different body returns `409 idempotency_conflict`.

## 6. Complete it with proof

```bash
curl -X POST "$REMINDIFY_URL/api/v1/obligations/ob_.../complete" \
  -H "Authorization: Bearer $REMINDIFY_KEY" \
  -H "content-type: application/json" \
  -H "Idempotency-Key: complete-domain-2026-10" \
  -d '{
    "proof": "Cloudflare order CF-88213 · renewed to 2027-11-15",
    "note": "Auto-renew was off; paid by card ending 4412."
  }'
```

A successful completion:

- advances a recurring obligation to its next due date, or archives a one-off;
- files a proof receipt in the trust layer;
- records an attributed `proof` event.

The response includes `next_due` for recurring obligations, or `archived: true` for one-off ones.

## 7. Let the agent act

The REST API records what an agent did. To let it **do** the work, connect an execution connector in the agent's passport:

1. Run an HTTPS endpoint you control.
2. Paste the URL in the passport and copy the signing secret once.
3. On approve or autopilot, Remindify sends a signed `POST` with the obligation, action and run id.
4. Return `2xx` with `{"proof": "..."}` to file evidence.

Read the full contract in [Execution connectors](/docs/guides/executors). Without a connector, the agent is draft-only: it can plan and request approval, but nothing executes.

## 8. Or use MCP

If your client is Claude Desktop, Cursor or another MCP host, skip the HTTP client:

```json
{
  "mcpServers": {
    "remindify": {
      "command": "node",
      "args": ["/absolute/path/to/remindify/mcp/server.mjs"],
      "env": {
        "REMINDIFY_URL": "http://localhost:4178",
        "REMINDIFY_KEY": "rfy_live_..."
      }
    }
  }
}
```

The MCP server is a local stdio process in this repository, so the `args` path is always local. Set `REMINDIFY_URL` to the hosted base URL to drive the hosted workspace, or to `http://localhost:4178` for a local one.

Tools: `list_obligations`, `get_obligation`, `create_obligation`, `complete_obligation`, `portfolio_risk`, `list_agents`, `list_trust`.

## Next steps

- [Obligations](/docs/concepts/obligations) for the full field and risk model.
- [Agent tools and models](/docs/guides/agent-tools) for framework recipes.
- [Errors](/docs/reference/errors) before you ship a retry loop.
- Keep keys server-side. Never ship a machine key in a browser bundle or a public repository.
