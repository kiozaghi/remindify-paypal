# Remindify OS

**The autonomy layer for everything that comes back.**

Remindify turns recurring obligations — renewals, filings, maintenance, birthdays, payroll — into an owned, risk-scored, proof-backed register. Humans and agents share the same work surface. Every action is scoped, every outcome needs evidence, and every decision is auditable.

Built from the original Remindify pitch, modernised for a world where agents are first-class operators, not just notifications.

```bash
npm install
npm run dev          # API on :4178, app on :5173
# or
npm run build && npm start   # production build on :4178
```

Open **http://localhost:5173** (dev) or **http://localhost:4178** (built).

---

## What's in the product

| Surface | What it does |
| --- | --- |
| **Today** | Greeting, live approvals, closest-to-the-edge obligations, portfolio pulse, agent wire, failsafe policy. |
| **Obligations** | The register. Search, filter by risk/owner/autonomy, inline autonomy control, risk meters, due dates, backups. |
| **Capture** | Paste a letter, email or messy note. A deterministic on-device parser extracts obligations, dates, amounts, recurrence, provider and category — then asks you to review before scheduling. |
| **Agents** | Agent passports: role, scopes, trust, runs, success rate, autonomy ceiling, obligations on desk, recent runs, exportable passport JSON. |
| **Marketplace** | Vetted humans and agents side by side. Fixed price, escrow on proof, scoped access, SLA. Attach a provider to an obligation or post a new job. |
| **Activity & proof** | Immutable event stream, filterable by agents/humans/system/API/proof, exportable audit log, proof vault. |
| **Agent access** | Machine API keys, endpoint reference, webhooks, live test call, recent machine calls, guardrails. |

Plus: **⌘K command palette**, obligation drawer with autonomy + checklist + proof + timeline, agent passport drawer, create-agent / new-obligation / hire flows, toasts, and a virtual clock.

### The demo, in 90 seconds

1. **Today** — 5 approvals are waiting. Open one, then **Approve & run**. The agent executes, files proof, and the obligation advances to its next cycle.
2. **Capture** — choose “Insurance renewal letter” → **Parse & structure**. One obligation appears with due date, amount, provider, recurrence and the exact source sentence. Confirm and schedule it.
3. **Obligations** — open any row. Change autonomy from Notify to Auto and watch the risk score recalculate. Add proof to complete it.
4. **Agents** — open **Ledger**’s passport. See its ceiling, scopes, trust and work on desk.
5. **Marketplace** — delegate the payroll filing to a human PA or an agent. Access is scoped to that obligation; payment releases on proof.
6. **Agent access** — hit **Test live call**, create a key, or run the MCP server.
7. **Time machine** — on Today, **Run agent sweep**, then **Time machine · +7 days**. Autopilot obligations execute and reschedule, approvals escalate, risk moves. Reset from the clock chip.

Nothing here is a static mock: every button writes to SQLite and re-renders from the API.

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
- Machine calls are attributed to a key, logged in the same event stream as human actions, and rate-limited by scope in production.
- Agents can read, create and complete obligations — but completion without proof is rejected by the MCP tool contract.
- Autonomy above an agent’s ceiling still requires a human approval.

---

## Architecture

```
src/                 React 19 + Vite + TypeScript (no UI framework)
  views/             Today, Obligations, Capture, Agents, Market, Activity, Access
  components/        drawers, modals, command palette, icons, shared UI
  styles/            custom warm-editorial design system (Instrument Sans/Serif, JetBrains Mono)
server/
  index.mjs          zero-dependency HTTP API + static serving
  db.mjs             node:sqlite store (JSON row documents, WAL)
  seed.mjs           rich demo workspace: 16 obligations, 7 agents, 8 providers, events, keys
  engine.mjs         risk scoring, recurrence, approvals, sweep, autopilot, virtual clock
  parse.mjs          deterministic on-device capture parser
  dev.mjs            runs API + Vite together
mcp/server.mjs       zero-dependency MCP stdio server (tools + structured content)
data/                SQLite database (created on first run)
public/fonts/        self-hosted fonts
```

- **State is server-authoritative.** The client polls `/api/state` every 12s and after every action.
- **Risk** = `severity × 15 × urgency(days) × autonomyFactor × confidenceFactor`, clamped to 2–97 and banded critical/high/guarded/low.
- **Recurrence** advances from the current due date, preserving the original day-of-month where possible.
- **Virtual clock** is a persisted offset (`clock_offset_days`), so time-machine demos are consistent across API, UI and seeded relative dates.
- **No cloud, no keys, no tracking.** The capture parser runs locally and is covered by `npm test`.

### Data

SQLite lives at `data/remindify.db`. Use **Reset demo** (clock chip, after time travel) or `POST /api/demo/reset` to restore the seeded workspace. Export everything with `GET /api/export`.

---

## API

All machine endpoints require `Authorization: Bearer rfy_live_...`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/obligations` | Full register with risk, owner, autonomy, proof and recurrence. |
| `POST` | `/api/v1/obligations` | Create an obligation. `title` and `due_at` required. |
| `GET` | `/api/v1/obligations/:id` | One obligation with history and risk. |
| `POST` | `/api/v1/obligations/:id/complete` | File proof and advance the schedule. |
| `GET` | `/api/v1/risk` | Coverage, exposure, counts and top risks. |
| `GET` | `/api/v1/agents` | Roster with scopes and autonomy ceilings. |

App endpoints (no auth, local demo only): `/api/state`, `/api/capture`, `/api/obligations`, `/api/approvals/:id/decide`, `/api/agents`, `/api/hire`, `/api/keys`, `/api/demo/{sweep,advance,reset}`.

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

Tools: `list_obligations`, `get_obligation`, `create_obligation`, `complete_obligation`, `portfolio_risk`, `list_agents`.

The default key is the seeded demo key. Issue a fresh one in **Agent access** and set `REMINDIFY_KEY` for anything real.

---

## Scripts

```bash
npm run dev        # API + Vite with proxy
npm run build      # production bundle
npm start          # serve dist + API on :4178
npm run mcp        # MCP stdio server
npm test           # parser regression tests (node:test)
npm run typecheck  # tsc --noEmit
npm run check      # typecheck + production build
```

Requires **Node 22.5+** for `node:sqlite` (tested on Node 24). No native modules.

---

## Production notes / honest limits

This is a complete product prototype, not a hardened multi-tenant service. Before charging money:

- add authentication, per-workspace data isolation and key hashing (only prefixes are shown now);
- move the JSON-per-row store to Postgres with row-level security;
- make webhooks signed and retryable, and add an outbox;
- add rate limits, idempotency keys and per-scope enforcement on the machine API;
- encrypt proof documents at rest and add retention/deletion controls;
- replace the deterministic parser with a hybrid local + model pipeline for PDFs and images;
- add billing, tax handling and marketplace escrow.

The design decisions that matter — autonomy ceilings, proof requirements, audit trail, human/agent parity — are already in the data model.
