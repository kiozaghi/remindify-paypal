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
| **Trust layer** | Offchain proof receipts, EIP-712 signing, optional Base/Celo anchoring, and USDC escrow intents that release on proof. Preview mode needs no wallet or contract. |
| **Agent access** | Machine API keys, endpoint reference, webhooks, live test call, recent machine calls, guardrails. |

Plus: **⌘K command palette**, obligation drawer with autonomy + checklist + proof + timeline, agent passport drawer, create-agent / new-obligation / hire flows, toasts, and a virtual clock.

### The demo, in 90 seconds

1. **Today** — 5 approvals are waiting. Open one, then **Approve & run**. The agent executes, files proof, and the obligation advances to its next cycle.
2. **Capture** — choose “Insurance renewal letter” → **Parse & structure**. One obligation appears with due date, amount, provider, recurrence and the exact source sentence. Confirm and schedule it.
3. **Obligations** — open any row. Change autonomy from Notify to Auto and watch the risk score recalculate. Add proof to complete it.
4. **Agents** — open **Ledger**’s passport. See its ceiling, scopes, trust and work on desk.
5. **Marketplace** — delegate the payroll filing to a human PA or an agent. Access is scoped to that obligation; payment releases on proof.
6. **Trust layer** — every completion files an offchain receipt. Open it, **Sign** with a wallet or copy the EIP-712 payload. With a contract configured, **Anchor** writes the proof hash to Base. Escrow intents release only against a signed or anchored receipt.
7. **Agent access** — hit **Test live call**, create a key, or run the MCP server.
8. **Time machine** — on Today, **Run agent sweep**, then **Time machine · +7 days**. Autopilot obligations execute and reschedule, approvals escalate, risk moves. Reset from the clock chip.

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
  views/             Today, Obligations, Capture, Agents, Market, Activity, Trust, Access
  components/        drawers, modals, command palette, icons, shared UI
  styles/            custom warm-editorial design system (Instrument Sans/Serif, JetBrains Mono)
server/
  index.mjs          zero-framework HTTP API + static serving
  db.mjs             node:sqlite store (JSON row documents, WAL)
  seed.mjs           rich demo workspace: 16 obligations, 7 agents, 8 providers, events, keys
  engine.mjs         risk scoring, recurrence, approvals, sweep, autopilot, virtual clock
  parse.mjs          deterministic on-device capture parser
  trust.mjs          Base/Celo registry, EIP-712 receipts, anchoring, escrow intents
  dev.mjs            runs API + Vite together
contracts/           reference Solidity: attestations registry + USDC escrow
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

SQLite lives at `data/remindify.db`. Use **Reset demo** (clock chip, after time travel) or `POST /api/demo/reset` to restore the seeded workspace. Export everything with `GET /api/export`. Point the store elsewhere with `REMINDIFY_DATA_DIR` or `REMINDIFY_DB`.

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

After deploying, set the env vars, restart the server, and rehearse the full flow: file a receipt, sign it, anchor it, then fund and release an escrow. The product works without a deployment in preview mode.

### Trust API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/trust` | Networks, receipts, escrows, stats and guardrails. |
| `POST` | `/api/trust/receipts` | File a receipt: `{ obligation_id, proof, chain }`. |
| `POST` | `/api/trust/receipts/:id/sign` | Verify and store `{ signature, signer }`. |
| `POST` | `/api/trust/receipts/:id/anchor` | Verify `{ tx_hash }` against the configured contract. |
| `GET` | `/api/trust/receipts/:id/calldata` | Prepared `anchor(...)` calldata. |
| `POST` | `/api/trust/escrows` | Open an intent. Requires `jurisdiction_ack: true`. |
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
- **No token.** No points, no airdrop, no speculative asset.
- **No custody.** The server never holds a key and never moves funds.
- **No forced wallet.** A receipt is useful the moment it is filed.
- **No document contents onchain or in the trust store.** Only the proof label/reference and hashes are stored.
- **Contracts are unaudited.** Treat them as a starting point for a security review, not production infrastructure.

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
| `GET` | `/api/v1/trust` | Receipts, escrows, networks and trust stats. |
| `POST` | `/api/v1/trust/receipts` | File a proof receipt from an agent. |

App endpoints (no auth, local demo only): `/api/state`, `/api/capture`, `/api/obligations`, `/api/approvals/:id/decide`, `/api/agents`, `/api/hire`, `/api/keys`, `/api/trust/*`, `/api/demo/{sweep,advance,reset}`.

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
npm run build            # production bundle
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

## Production notes / honest limits

This is a complete product prototype, not a hardened multi-tenant service. Before charging money:

- add authentication, per-workspace data isolation and key hashing (only prefixes are shown now);
- move the JSON-per-row store to Postgres with row-level security;
- make webhooks signed and retryable, and add an outbox;
- add rate limits, idempotency keys and per-scope enforcement on the machine API;
- encrypt proof documents at rest and add retention/deletion controls;
- replace the deterministic parser with a hybrid local + model pipeline for PDFs and images;
- add billing and tax handling;
- take the reference contracts through an audit, add upgrade/ops procedures, and test anchor/fund/release against a deployed contract on Base Sepolia before mainnet;
- add sanctions/geo checks to enforcement, not just the `jurisdiction_ack` boundary.

The design decisions that matter — autonomy ceilings, proof requirements, audit trail, human/agent parity — are already in the data model.

---

## Funding and applications

- [FUNDING.md](./FUNDING.md) — scored shortlist, exclusions, deadlines and recommended sequencing.
- [APPLICATIONS.md](./APPLICATIONS.md) — working drafts for SXSW Pitch 2027, Base Ecosystem Fund and Celo Prezenti Frontier, plus a demo script and the missing-information checklist.

These are working documents. Verify every deadline and requirement on the official program page before submitting.

---

## License

MIT. See [LICENSE](./LICENSE).
