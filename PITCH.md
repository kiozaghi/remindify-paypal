# Remindify — the autonomy layer for everything that comes back

**Pitch v2 · 2026 · Solomon Tigabu**

> Every operator has a second job they never applied for: running the back office. Remindify turns that job into an owned, auditable system — and hands the repeatable parts to agents you can actually trust.

---

## 1. The original insight still holds

The 2024 deck named a real, unglamorous problem: **recurring obligations slip**. Insurance lapses, licences expire, payroll filings are late, contractor handoffs go unsigned, subscriptions quietly compound, and the back office nobody put on the org chart carries the mental load of remembering.

The deck’s solution was an intuitive recurring-task app linked to Google/Apple, with templates, collaborators/backups and paid professional help. That was the right shape for 2024.

What changed since: **software can now do the work, not just remind you about it.** Agents can read a renewal letter, compare quotes, fill the form, book the slot, pay within a mandate and file the receipt. The bottleneck is no longer capability. It is **trust, ownership and proof**.

Remindify is built for that gap.

---

## 2. The problem, restated for an agent economy

Recurring operations and compliance are **high-consequence and low-glamour**. They fail for four reasons:

1. **Forgetting** — the default human failure mode.
2. **No owner** — “we should renew that” is not an owner.
3. **No proof** — “I paid it” is not a receipt.
4. **No safe delegation** — you would not give a chatbot your bank mandate, and you should not have to.

Existing tools solve fragments: calendars remember, task apps list, accountants file, marketplaces match. None of them hold the **obligation** — owner, backup, deadline, consequence, autonomy, evidence — as one object.

The result is a tax on attention that falls hardest on people with the least slack: founders, freelancers, small studios and teams managing obligations across borders.

---

## 3. The product

**Remindify OS is an obligation register with an autonomy layer.**

Every obligation carries:

- **Owner + backup** — a person, an agent, or a team, with escalation if the owner goes quiet.
- **Risk** — severity × urgency × confidence × autonomy, with money exposure and a plain-language consequence.
- **Autonomy** — `notify` → `prepare` → `approve` → `autopilot`, capped by the agent’s passport.
- **Proof** — receipt, confirmation, certificate, photo or signed document. No proof, no completion.
- **Audit** — every read, write, approval, run and proof, attributed and exportable.

### Nine surfaces, one graph

| Surface | Job |
| --- | --- |
| **Today** | What needs a human now: approvals, both ledgers, closest-to-the-edge, agent activity. |
| **Register** | The full obligation graph, searchable and risk-ranked, with Duty/Money lenses and community packs. |
| **Capture** | Turn a letter, email or note into structured obligations — locally, with review. |
| **Bench** | Agent passports: scopes, trust, ceilings, work on desk. |
| **Marketplace** | Hire a human or an agent by the job. Escrow releases on proof. |
| **Seller desk** | Provider storefront: requests, active work, proof, hold ledger and payouts. |
| **Proof** | The audit trail and evidence vault. |
| **Trust layer** | HMAC-signed proof receipts, Gemini proof audit, PayPal authorization holds and release on verified proof. |
| **Agent access** | REST + MCP, scoped keys, webhooks, guardrails. |

### The 2026 difference: agents are first-class, not features

- **Agent passports.** Scopes, trust score, success rate, autonomy ceiling, machine-readable export. An agent earns autonomy by filing accepted proof — not by asking for it.
- **Human/agent parity.** The marketplace lists a chartered accountant and a tax-filing agent on the same bench, with the same proof standard.
- **Agent-native protocol.** The register is available over REST and MCP. Claude/Cursor can read the portfolio, create an obligation or complete one with proof. Every call is attributed and audited.
- **Autonomy ceilings.** An agent cannot exceed its ceiling even if a user sets a higher obligation autonomy. Above the ceiling, a human still approves each run.
- **Proof-of-done.** The unit of trust is evidence, not a status toggle.

---

## 4. Why now

1. **Agents can execute.** Browser use, document understanding, payments via mandates and tool APIs turned “remind me” into “handle it”.
2. **Trust infrastructure arrived.** Scoped credentials, human-in-the-loop approvals, audit logs and escrow are now expected primitives, not enterprise luxuries.
3. **The market is being re-bundled.** Calendars, tasks, notes and inboxes are all adding AI, but they are built around *content*, not *consequences*. The obligation graph is still unowned.
4. **Agent commerce needs a trust layer.** Marketplaces will list agents alongside humans. Whoever holds the proof and the mandate holds the relationship.

The window is to become the **system of record for recurring obligations** before calendars or horizontal agent platforms collapse it into a feature.

---

## 5. Market

The original deck: **TAM 1B people, SAM 100M, SOM 1M**. That framing is still useful, but the buyer set has expanded:

- **Founders and solo operators** — vendor admin, filings, contractor paperwork.
- **Small studios and teams** — licences, payroll, deliverables, collections.
- **Agencies and back offices** — recurring client filings as a service.
- **Agent platforms** — a register and proof layer they can plug into via API/MCP.

A more defensible bottoms-up view:

| Segment | Estimate | ARPU | Annual value |
| --- | --- | --- | --- |
| Knowledge workers with recurring admin (global) | ~400M | $60/yr | ~$24B |
| Small teams / studios needing compliance | ~40M orgs | $300/yr | ~$12B |
| Application fee on captured escrow | — | 10% of GMV | Services upside |
| Agent/API access | — | usage + platform | Infra upside |

**Beachhead:** founders, freelancers and small studios in Addis Ababa and the diaspora — high obligation density, low back-office support, mobile-first, underserved by US-centric task apps. Then English-speaking solo operators globally, then teams.

---

## 6. Business model

| Stream | Price | Why it works |
| --- | --- | --- |
| **Free** | $0 | 10 active obligations, 1 agent, local capture. Creates the habit. |
| **Plus** | $8/mo | Unlimited obligations, 3 agents, proof vault, calendar sync. |
| **Studio** | $24/seat/mo | Shared register, approvals, agent passports, audit export, API keys. |
| **Marketplace** | 10% application fee | Human/agent providers are paid on accepted proof. |
| **Enterprise** | from $12/seat/mo | SSO, retention, custom agents, on-prem/private deployment. |
| **Agent platform** | usage-based | MCP/REST access, webhook events, verified proof receipts. |

The original deck’s partnership and licensing lines remain valid: insurers, banks, telcos and professional firms can embed Remindify’s renewal/obligation layer, and providers can license the bench.

**Why people pay:** a missed payroll filing or lapsed insurance costs far more than $8–24/month. The product is priced against the penalty, not against a to-do list.

---

## 7. Competition and moat

| Category | Examples | What they miss |
| --- | --- | --- |
| Reminders / tasks | Apple Reminders, Google Tasks, Todoist | No consequence, proof, backup or autonomy. |
| Calendars | Google/Apple Calendar | Stores dates, not obligations. |
| Docs / notes | Notion, Amplenote | Flexible, but you build the system yourself. |
| Concierge / back-office services | TaskRabbit, virtual assistants | Human-only, transactional, no recurring graph. |
| Horizontal agents | Claude, ChatGPT, Copilot | Powerful, but no persistent obligation ownership, proof vault or marketplace. |

**The moat compounds in four loops:**

1. **Obligation graph** — the longer you use it, the more of your operation’s recurring surface it holds. Switching means rebuilding your second brain.
2. **Proof graph** — accepted evidence trains trust and autonomy. Agents that have filed 200 clean proofs are more valuable than agents that have not.
3. **Marketplace liquidity** — demand for specific obligations attracts verified providers; proof history makes matching safer.
4. **Protocol distribution** — MCP/REST puts Remindify inside other agents’ workflows. The register becomes infrastructure, not an app.

Reminders are a feature. **An obligation graph with proof and mandates is a system of record.**

---

## 8. Go to market

**Phase 1 — wedge (0–6 months).** Addis + diaspora founders and small studios. Concierge onboarding: import 10 obligations, set backups, run one agent. Content: “the renewal audit” — a free teardown of the recurring obligations a small business is carrying.

**Phase 2 — product-led (6–18 months).** Free capture → invite a backup → upgrade for agents/proof. Partnerships with accountants, insurers and incubators. Marketplace supply seeded with vetted local providers.

**Phase 3 — agent-native (18–36 months).** MCP directory, agent provider onboarding, API for platforms. “Remindify inside” for banks/insurers who want renewal touchpoints without building a task system.

**Distribution advantages:** local-first capture (works with paper letters and PDFs, not just email), mobile-friendly review, and a marketplace that can start with humans before agents are trustworthy.

---

## 9. Roadmap

| Now (this prototype) | Next 90 days | Next 12 months |
| --- | --- | --- |
| Working register, risk engine, autonomy, proof, audit | PayPal live-mode operations, fee and payout tooling | Mobile apps, calendar/email sync, more settlement rails |
| Deterministic capture parser | Hybrid PDF/image extraction + review | Inbox and document vault ingestion |
| Human + agent marketplace, seller desk, proof-gated payouts | Provider onboarding, ratings, disputes | Agent SDK, verified provider badges |
| REST + MCP with scoped keys, metering and idempotency | Signed webhooks, usage plans, sandbox keys | Usage billing, agent commerce protocol |
| Per-account Postgres workspaces, auth, digests, time machine | First 10 design partners and real onboarding | Team approvals, SSO, enterprise retention |

---

## 10. The ask

**$400k for 10%** (continuing the original deck’s round), to fund an 18-month runway:

- **50% engineering** — auth, multi-tenant backend, mobile, document ingestion.
- **25% design/product** — the review experience and agent trust surfaces.
- **15% marketplace supply** — onboarding and verification of the first 100 providers.
- **10% GTM** — Addis/diaspora wedge, content, partnerships.

**Milestones for the round:** 10,000 activated users, 25% monthly paid conversion among teams, 1,000 marketplace jobs with 95% proof acceptance, and three design partners embedding the API.

---

## 11. Why this team

Solomon Tigabu is a software engineer, designer and operator based in Addis Ababa — CTO and Master Trainer at Exopya Incubation Center, with 600+ designs and 8 brand builds. He has shipped products for the same ecosystem Remindify starts in: small teams with global obligations and local infrastructure.

The original deck was built from lived experience of missed renewals and informal coordination. This version is built from the same experience, with the conviction that the next decade of software will be judged by **what it takes off your plate — and what it can prove it did**.

---

### One line

**Remindify is the obligation register for humans and agents — risk-scored, proof-backed, and built to be handed over.**
