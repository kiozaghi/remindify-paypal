# Remindify — application kit

**Working draft · October 29, 2026.** Nothing here has been submitted. Anything in
`[FILL]` is missing and must be supplied by the founder before an application is
sent. Anything marked **BLOCKED** is a real eligibility gap, not a writing
problem.

The short version: the product and the public demo are ready. The Celo
application is still blocked on a Celo mainnet deployment and the required
identity integrations. Base is the nearest application: the contracts are live
on Base Sepolia and the full anchor + escrow rehearsal is recorded with
verifiable transactions, so only founder-supplied fields remain.

---

## 1. Submission status

| Program | Status | Deadline | What is missing | Recommendation |
| --- | --- | --- | --- | --- |
| **SXSW Pitch 2027** | Draft ready, demo live | **Nov 13, 2026** (official page also says Nov 11 at 11:59pm PT — treat Nov 11 as the real deadline) | X URL, founder links, $225 fee, eligibility confirmation | Apply now. The public demo exists; the remaining gaps are founder-supplied. |
| **Base Ecosystem Fund** | Draft ready, rehearsal recorded | Rolling | X URL, founder links, runway, deck URL | Apply now. The testnet lifecycle is proven end to end; mainnet would strengthen it but is not required for the thesis. |
| **Celo Prezenti Frontier** | **BLOCKED** | **Dec 29, 2026** | Celo mainnet deployment, ERC-8004 registration, Self Agent ID, KarmaGAP profile, KYC, public repo decision | Do not submit until the four onchain/identity items are real. A paper integration will be rejected. |

---

## 2. Facts we can defend

Use these numbers; do not inflate them.

- Working React 19 + TypeScript product with a zero-framework Node API, SQLite locally and Postgres on Vercel.
- Public demo live at **https://remindify-xi.vercel.app**, with a developer docs hub at **/docs**.
- Per-account workspaces: sign-up, email verification, password reset, account deletion, region gating and sanctions screening are implemented.
- Seeded demo workspace: **16 obligations, 7 agents, 8 marketplace providers, 2 API keys**.
- Nine product surfaces: Today, Obligations, Capture, Agents, Marketplace, Seller desk, Activity/Proof, Trust, and Agent Access.
- Agent-native access over **REST** and **MCP**; every call is attributed, audited, metered and scope-limited.
- Proof receipts use **EIP-712** typed data; proof and evidence are hashed with keccak-256; raw documents are never uploaded.
- Base-first trust module with verified USDC addresses for **Base, Base Sepolia, Celo, and Celo Sepolia**.
- Two reference Solidity contracts, **RemindifyAttestations** and **RemindifyEscrow**, compile with solc 0.8.24 and are **deployed to Base Sepolia only**:
  - Attestations: `0x22C9241F34107D829DC67Df530aEbD7aC14eF7f9`
  - Escrow: `0x647F30587B925F1aFb71D3C9CE25CfbDA17872db`
  - Both are source-verified on Basescan and **unaudited**. No mainnet deployment.
- The full trust lifecycle is **rehearsed on Base Sepolia** and the transaction hashes are recorded in `contracts/deployments/base-sepolia.json`:
  - anchor `0x8bc6…4288` (block 51679748), approve `0x5f17…f532`, fund `0xa935…cc66`, release `0x6ca7…70db` (block 51679782). All four returned `status: success`.
  - Read back from the contracts: `anchored(receipt) = true`, and the escrow shows `funded = true`, `released = true` with the proof receipt bound to it.
  - It ran against a local server with the deployed addresses configured, with 1 test USDC and a real EIP-712 signature from the deployer wallet.
  - The base-sepolia deployment record now carries the receipt id, escrow id, every tx hash and the state checks.
- **41 automated tests** pass; `npm run check` (TypeScript + production build) passes.
- MIT license is in the repo, which is public at **https://github.com/kiozaghi/remindify-paypal**.
- **No paying users, no mainnet deployment, no Celo integration, no ERC-8004 registration, no Self Agent ID, no KarmaGAP profile.**

If an application asks for traction, lead with what is built and be explicit about
what is not. “Working prototype, pre-revenue” is credible. Pretending otherwise
is not.

---

## 3. The reusable answers

### One line

**Remindify is the obligation register for humans and agents — risk-scored,
proof-backed, and built to be handed over.**

### The problem

Everyone has a second job they never applied for: running their life and their
compliance. Renewals, filings, insurance, payroll, maintenance and family
obligations are recurring, high-consequence and low-glamour. They fail because
there is no owner, no backup, no proof and no safe way to delegate.

Existing tools solve fragments. Calendars remember dates. Task apps list items.
Accountants file after the fact. Marketplaces match one-off jobs. None of them
hold the obligation itself — owner, backup, deadline, consequence, autonomy,
evidence — as one object.

### The product

Remindify is an obligation register with an autonomy layer. Every obligation
carries:

- an owner and a backup, with escalation if the owner goes quiet;
- a risk score based on severity, urgency, confidence and autonomy;
- an autonomy level: `notify` → `prepare` → `approve` → `autopilot`, capped by the agent’s passport;
- a proof requirement: receipt, confirmation, certificate, photo or signed document;
- an audit trail of every read, write, approval, run and proof.

Humans and agents share the same work surface. Agents have passports with
scopes, trust, success rate and autonomy ceilings. The same register is available
over REST and MCP. A completion without proof is rejected.

### Why now

Agents can now read a renewal letter, compare quotes, fill a form, book a slot,
pay within a mandate and file a receipt. The bottleneck is no longer capability.
It is trust, ownership and proof. Agent commerce needs a system of record for
what was promised, who did it, and what evidence exists.

### Why Base

Base is the primary long-term ecosystem for this trust layer because:

- USDC is native to the product’s payment and escrow story;
- Base’s low fees make small proof anchors and escrow releases practical;
- the Base ecosystem explicitly funds AI agents and stablecoin distribution in emerging markets;
- a Base-first EVM module can be reused on Celo without a second architecture.

The Base module is **deployed to Base Sepolia and source-verified**, with the
full anchor + escrow lifecycle rehearsed onchain. It is not yet on mainnet.
That distinction matters.

### Why Celo

Celo Prezenti Frontier’s criteria map directly to Remindify’s trust layer:
agent identity and discovery, agent-to-agent escrow, verification and
accountability infrastructure. Celo is the near-term grant pilot; Base is the
long-term ecosystem. The same contracts and receipt format are reused.

### Traction, honestly

> Remindify is a working prototype, pre-revenue. The public demo is live at
> https://remindify-xi.vercel.app. The demo workspace contains 16 obligations, 7
> agents and 8 providers. The product has per-account workspaces, Postgres in
> production, REST and MCP access, EIP-712 proof receipts, and two Solidity
> reference contracts deployed to Base Sepolia, where the full anchor + escrow
> lifecycle has been rehearsed with recorded, verifiable transactions. The
> contracts are unaudited and testnet-only.
> There are no paying users yet. The next milestone is the first 10 design
> partners.

### Business model

| Stream | Price | Why it works |
| --- | --- | --- |
| Free | $0 | 10 active obligations, 1 agent, local capture. Creates the habit. |
| Plus | $8/mo | Unlimited obligations, 3 agents, proof vault, calendar sync. |
| Studio | $24/seat/mo | Shared register, approvals, agent passports, audit export, API keys. |
| Marketplace | 15% take | Human and agent providers are paid on accepted proof. |
| Enterprise | from $12/seat/mo | SSO, retention, custom agents, private deployment. |
| Agent platform | usage-based | MCP/REST access, webhook events, verified proof receipts. |

### Use of funds

The current pitch is **$400k for 10%** over an 18-month runway:

- 50% engineering — auth, multi-tenant backend, mobile, document ingestion;
- 25% design/product — review experience and agent trust surfaces;
- 15% marketplace supply — onboarding and verification of the first 100 providers;
- 10% GTM — Addis/diaspora wedge, content, partnerships.

The first Base-specific milestones are: a mainnet deployment, a security review
of the reference contracts, 10 design partners, and 100 anchored proof receipts.

### Team

**Solomon Tigabu** — software engineer, designer and operator based in Addis
Ababa. CTO and Master Trainer at Exopya Incubation Center; 600+ designs and 8
brand builds. Sole founder. The product comes from lived experience of missed
renewals and informal coordination.

### Guardrails

- **Ethiopia stays offchain.** No wallets or USDC payments for Ethiopian obligations until the NBE authorises virtual-asset activity.
- Escrow creation requires an explicit `jurisdiction_ack: true` at the API boundary and a required checkbox in the UI.
- Celo is gated to non-Ethiopian counterparties.
- No token. No points. No airdrop.
- No custody. The server never holds a private key and never moves funds.
- No document contents onchain or in the trust store; only hashes and proof labels.
- The contracts are unaudited. A security review is a funded milestone, not a claim.

---

## 4. Base Ecosystem Fund — form answers

**The submission pack is [`BASE-APPLICATION.md`](./BASE-APPLICATION.md).** It was
built by walking the live form on October 29, 2026 and contains the exact fields,
order, select options and copy-paste answers. This section is the earlier draft and
is kept for the reasoning behind it.

The form has five steps: Company, Team, Idea, Funding, Why Base.

Two corrections found by walking the form: there is **no company-registration or
KYC field**, and the pitch deck is an **optional URL on the Why Base step**, not a
required funding field.

### Company

| Field | Draft |
| --- | --- |
| **Company Name** | Remindify |
| **What are you building?** | Remindify is an obligation register for humans and agents. It turns recurring obligations — renewals, filings, maintenance, payroll, family admin — into risk-scored objects with an owner, a backup, an autonomy level and a proof requirement. Agents get passports with scopes and ceilings; every completion files an EIP-712 proof receipt. A Base-first trust layer anchors those receipts and releases USDC escrow only against proof. |
| **Website URL** | https://remindify-xi.vercel.app |
| **X URL** | `[FILL]` |

### Team

| Field | Draft |
| --- | --- |
| **Founder name** | Solomon Tigabu |
| **Role** | Founder / CEO |
| **Previous experience** | Software engineer, designer and operator; CTO and Master Trainer at Exopya Incubation Center; 600+ designs and 8 brand builds for early-stage teams. |
| **Telegram** | `[FILL]` |
| **X** | `[FILL]` |
| **LinkedIn** | `[FILL]` |
| **Team Size** | 1–5 |
| **Location** | Addis Ababa, Ethiopia |

### Idea

| Field | Draft |
| --- | --- |
| **What is the problem you are solving?** | Recurring obligations fail silently. A lapsed insurance policy, a late payroll filing or a missed licence renewal costs far more than a reminder app. The people who carry this load — founders, freelancers, caregivers, small teams and diaspora families — have no single system of record for the obligation, the owner, the backup, the consequence and the evidence. Existing tools store dates, not accountability. |
| **Why are you working on this idea?** | I built the first Remindify deck from lived experience of missed renewals and informal coordination. The 2026 version exists because agents can now do the work, not just remind you about it. The missing layer is trust: who acted, under what scope, and what proof exists. That is the product I want to exist. |
| **How long have you been working on this company idea?** | 1–3 years |
| **What’s your current traction?** | Working prototype, pre-revenue. Public demo at https://remindify-xi.vercel.app, 16 seeded obligations, 7 agents, 8 providers, per-account workspaces, REST and MCP access, EIP-712 proof receipts, 35 automated tests and a production build. Two Solidity contracts are deployed to Base Sepolia and source-verified, and the anchor → fund → release lifecycle has been rehearsed onchain with four recorded transactions. The contracts are unaudited and testnet-only. No paying users yet. The next milestone is the first 10 design partners. |

### Funding

| Field | Draft |
| --- | --- |
| **Have you raised capital before?** | No. Bootstrapped to date. `[FILL if there is any prior grant, friends-and-family or accelerator funding]` |
| **What’s your current runway?** | `[FILL: e.g. 6 months, 12 months]` |
| **What are your current fundraising goals?** | Raising a $400k pre-seed for an 18-month runway: 50% engineering, 25% design/product, 15% marketplace supply, 10% GTM. The first Base milestones are a mainnet deployment, a security review, 10 design partners and 100 anchored proof receipts. |

### Why Base

| Field | Draft |
| --- | --- |
| **What aspects of your company / product are on Base?** | The Base-first trust layer: an EIP-712 attestation registry for proof receipts and a USDC escrow that releases only when the registry says the proof is anchored. The product is wallet-optional; a receipt is useful offchain, and a wallet only enters when the owner signs or anchors. Base is the first deployment target because USDC and low fees make proof anchoring and small escrow releases practical. |
| **Why are you interested in BEF / Base?** | Base is the best long-term home for an agent-facing trust and settlement layer: USDC, low fees, a strong agent ecosystem and a fund that explicitly backs AI agents and stablecoin distribution in emerging markets. Remindify’s wedge is recurring obligations in underserved markets; Base gives that wedge a credible settlement rail without forcing Ethiopian users into wallets before the regulator allows it. |
| **Pitch Deck URL** | `[FILL: Google Drive or DocSend link]` |

---

## 5. Celo Prezenti Frontier — form answers

**Do not submit until the four blocked items are real.** The form asks for a Celo
mainnet deployment, ERC-8004 registration, Self Agent ID and KarmaGAP profile.
A plan is not a deployment.

### Identity

| Field | Draft |
| --- | --- |
| **Product name** | Remindify |
| **Team name** | Remindify |
| **Website** | https://remindify-xi.vercel.app |
| **X Handle** | `[FILL]` |
| **KarmaGAP profile** | **BLOCKED** — create the profile and paste the URL. |
| **Github** | `https://github.com/kiozaghi/remindify-paypal` (public; MIT license) |
| **ERC-8004 registration** | **BLOCKED** — register the Remindify agent/project under ERC-8004 on Celo mainnet and paste the registration. |
| **Is your project fully open source** | Yes. MIT licensed and public at https://github.com/kiozaghi/remindify-paypal. |
| **Deployed on Celo mainnet** | **BLOCKED** — no mainnet deployment yet. The deploy script is ready; it needs a funded wallet and a security review. |
| **Self Agent ID** | **BLOCKED** — no Self Protocol Agent ID yet. |

### Project

| Field | Draft |
| --- | --- |
| **Describe your project** | Remindify is an obligation register for humans and agents. Each obligation has an owner, a backup, a risk score, an autonomy ceiling and a proof requirement. Agents act through scoped passports; every completion files an EIP-712 proof receipt. The trust layer anchors the proof hash to an EVM registry and releases USDC escrow only when the anchored receipt matches the obligation. The product is wallet-optional: a receipt exists offchain immediately, and a wallet is only needed to sign, anchor or fund. |
| **Infrastructure focus** | Remindify is infrastructure other agents and builders can use, not only an end-user app. The register is exposed over REST and MCP; agent passports are machine-readable; proof receipts are a standard EIP-712 payload; the attestation registry and escrow contracts are reusable primitives. A marketplace operator, an accountant network or another agent platform can use the proof layer without adopting Remindify’s UI. |
| **Verifiable onchain activity** | **BLOCKED** — no Celo mainnet activity yet. After deployment, the application will include the attestation and escrow contract addresses, 10+ anchor transactions, 3 complete escrow fund/release cycles, and a public page that links each transaction to its obligation and proof receipt. |
| **Demo** | https://remindify-xi.vercel.app — the walkthrough is in section 7. `[FILL: 2-minute Loom/YouTube recording]` |

### Go-to-market

| Field | Draft |
| --- | --- |
| **How do you plan on getting agents to use your product, and what is the activation path for the first 10 to 100 users?** | Start with the humans who already carry recurring obligations: founders, freelancers, small studios and diaspora families. The activation path is: import 10 obligations, add one backup, run one agent, file one proof receipt. For agents, publish the MCP server and a typed REST API, list the agent passport schema, and give the first 10 design partners a scoped key and a sandbox workspace. The first 100 agents come from MCP directories, accountant/insurer partners and the Exopya Incubation Center network, not from a generic waitlist. |
| **What is your distribution strategy, and what examples can you point to from this project or prior work where you have actually done it?** | The wedge is local-first: paper letters, PDFs and mobile review, not just email. I have shipped 8 brand builds and worked with early-stage teams through Exopya Incubation Center, which gives a direct pipeline of founders and small studios in Addis. The diaspora channel is content-led: a free “renewal audit” that turns a folder of letters into a risk-scored register. The product then spreads through backups and collaborators, because an obligation is shared by design. |
| **Who have you worked with before with the Celo ecosystem?** | None of the above. No formal Celo engagement yet. `[FILL if this changes]` |

### Fit

| Field | Draft |
| --- | --- |
| **Clear contribution to the ecosystem** | Celo’s agent economy needs a neutral answer to “did the agent actually do the work?” Remindify contributes an open proof-receipt format, an attestation registry, a proof-gated USDC escrow and an MCP/REST surface that other Celo agent projects can depend on. It is accountability infrastructure, not another consumer app. |
| **Technical credibility** | The product is built and tested: React 19 + TypeScript client, zero-framework Node API, SQLite locally and Postgres in production, REST and MCP access, EIP-712 receipts verified with viem, keccak-256 proof/evidence hashes, two Solidity contracts compiled with solc 0.8.24 and deployed to Base Sepolia, and 35 automated tests. The contracts are unaudited; a security review is part of the grant budget. The architecture is Base-first and Celo-reusable, not a fork. |
| **Additional information** | Ethiopia’s NBE has not authorised virtual-asset activity, so Ethiopian obligations stay offchain and the Celo module is geo-fenced to non-Ethiopian counterparties. Escrow creation requires an explicit jurisdiction acknowledgment. There is no token and no custody. The repo is MIT licensed. |

### Grant delivery

| Field | Draft |
| --- | --- |
| **Grant policies** | `[FILL: read the Prezenti legal documents and confirm]` |
| **Lead applicant name** | Solomon Tigabu |
| **Lead applicant email** | `[FILL]` |
| **Country company is registered** | `[FILL: Ethiopia or the actual registered jurisdiction]` |
| **Tech category** | AI / agent infrastructure — verification, trust and escrow |
| **Logo** | `[FILL: upload SVG/PNG]` |
| **Grant L2 delivery address** | `[FILL: Celo address controlled by the team]` |

### Suggested Celo budget

Use this only if the form asks for a budget. Adjust the amount before submitting.

| Line | What it funds |
| --- | --- |
| Celo mainnet deployment + security review | Contract review, deployment, verification, monitoring |
| ERC-8004 + Self Agent ID + KarmaGAP | Registration, integration work, public profile |
| 10 pilot agents | Scoped keys, onboarding, support, proof-receipt instrumentation |
| 3 escrow pilots | USDC escrow cycles with non-Ethiopian counterparties |
| Public demo + documentation | Hosted demo, MCP listing, integration guide |

---

## 6. SXSW Pitch 2027 — narrative

### Eligibility check

- Product/service must not have launched before **January 1, 2024**. The original Remindify deck is from 2024; confirm the current product was not commercially launched before that date.
- The company must be legally registered and compliant. `[FILL: registration status]`
- The company must not have raised more than **$10M** in combined funding. `[FILL: confirm]`
- Apply by **Nov 11, 2026** (the page says Nov 13 in one place and Nov 11 at 11:59pm PT in the FAQ; use Nov 11).
- Fee: **$225**, non-refundable.
- Recommended category: **SaaS, Enterprise & Developer Platforms**. The category explicitly includes workflow automation, project management, AI infrastructure and intelligent automation. The fintech/security category is a secondary option if the trust layer becomes the lead story.

### 60-second pitch

> Everyone has a second job they never applied for: running their life. Renewals, filings, insurance, payroll, the things that come back every month or every year. They slip because nobody owns them, nobody has a backup, and “I paid it” is not proof.
>
> Remindify is the obligation register for humans and agents. Every obligation gets an owner, a backup, a risk score, an autonomy level and a proof requirement. Agents get passports with scopes and ceilings. When an agent completes a task, it files an EIP-712 proof receipt. The receipt can stay offchain, or it can be anchored to Base. USDC escrow releases only when the proof matches the obligation.
>
> The product is live at remindify-xi.vercel.app: 16 seeded obligations, 7 agents,
> 8 providers, per-account workspaces, REST and MCP access, 35 tests. The trust
> contracts are deployed on Base Sepolia and unaudited; the anchor → fund →
> release flow is rehearsed onchain with recorded transactions. We are
> pre-revenue, and the next target is 10 design partners on Base.
>
> The wedge is founders, freelancers and small studios in Addis and the diaspora — people with high obligation density and no back office. The moat is the obligation graph plus the proof graph. Remindify is the system of record for work that comes back.

### 5-minute structure

1. **The problem** — recurring obligations fail silently; the cost is penalty, not inconvenience.
2. **The insight** — agents can do the work now; the bottleneck is trust, ownership and proof.
3. **The product** — obligation register, agent passports, proof-of-done, marketplace, audit trail.
4. **The trust layer** — EIP-712 receipts, optional Base anchoring, USDC escrow that releases on proof; no token, no custody.
5. **Demo** — Today → approve & run → proof receipt → Trust page → escrow intent.
6. **Market** — 400M knowledge workers, 40M small teams, marketplace take, agent/API access.
7. **Business model** — free, Plus, Studio, marketplace, enterprise, agent platform.
8. **Traction** — live public demo, 35 tests, Base Sepolia contracts deployed; pre-revenue and honest about it.
9. **Go-to-market** — Addis/diaspora wedge, Exopya network, renewal audit, backups as distribution.
10. **Team + ask** — Solomon Tigabu; $400k pre-seed for 18 months.

### Q&A prep

- **Why won’t calendars or task apps do this?** They store dates and items, not consequences, ownership, proof or mandates. The obligation graph is a different object.
- **Why blockchain?** Only for verification and settlement that a counterparty cannot verify inside Remindify’s database. A receipt is useful without a chain; anchoring is an escalation.
- **Why not a token?** A token would add speculation and regulatory surface without solving the trust problem. USDC and hashed attestations are enough.
- **What about Ethiopia?** Ethiopian obligations stay offchain until the NBE authorises virtual-asset activity. The EVM module is geo-fenced to non-Ethiopian counterparties.
- **What is the moat?** The obligation graph, the proof graph, marketplace liquidity and MCP/REST distribution. A competitor can copy a screen; it cannot copy the history.
- **What is the biggest risk?** Distribution and trust. The first 10 design partners are the real validation, not the demo.

---

## 7. Two-minute demo script

Record at 1440×900 or larger. Use the seeded workspace. Reset the demo before
recording so the numbers are stable.

| Time | Screen | Action | Narration |
| --- | --- | --- | --- |
| 0:00–0:15 | Today | Show the greeting, the two-ledger strip and the approvals. | “Everyone has a second job they never applied for — half of it is people, half of it is money. Remindify turns both into one owned, auditable system.” |
| 0:15–0:35 | Today | Show the People side and Money side counts, then open one approval with its owner, backup, risk and proof requirement. | “Every obligation has an owner, a backup, a risk score and a proof requirement. Nothing counts without evidence.” |
| 0:35–0:55 | Obligations | Switch the People/Money lens, then open a community pack and import it. | “The register carries both sides of a life, and a pack gives you a year someone else already mapped.” |
| 0:55–1:10 | Obligation drawer | Approve & run. Show the agent run and the proof receipt. | “The agent executes inside its passport. The completion files an EIP-712 proof receipt automatically.” |
| 1:10–1:30 | Trust | Open the receipt. Show the hashes, typed data and sign action. | “The receipt is verifiable offchain. A wallet can sign it, and the signature is checked server-side with viem.” |
| 1:30–1:45 | Trust | Show the Base Sepolia network card and the anchor payload. | “With a contract configured, the proof hash anchors to Base. The chain verifies that work happened without trusting our database.” |
| 1:45–1:55 | Trust | Open an escrow intent, check the jurisdiction acknowledgment, show release-on-proof. | “USDC escrow releases only against a signed or anchored receipt for the same obligation. No token, no custody, no server-held keys.” |
| 1:55–2:00 | Agent Access / MCP | Show the API key and the MCP tool list. | “The same register is available to agents over REST and MCP. Remindify is the system of record for work that comes back.” |

Do not record the Celo mainnet claim. It is not deployed. If the demo shows the
Celo card, label it “planned pilot.”

---

## 8. What must be true before submitting

### Before SXSW (Nov 11)

- [x] Public demo URL that a judge can open without a local install: **https://remindify-xi.vercel.app**
- [ ] X URL and founder links.
- [ ] Confirm the product was not commercially launched before Jan 1, 2024.
- [ ] Confirm legal registration and <$10M raised.
- [ ] Record the 2-minute demo.
- [ ] Pay the $225 fee and submit.

### Before Base Ecosystem Fund (rolling)

- [x] Deploy both contracts to Base Sepolia.
- [x] Rehearse anchor + fund + release and record the transaction hashes. Done on 2026-10-29: anchor `0x8bc6…4288`, approve `0x5f17…f532`, fund `0xa935…cc66`, release `0x6ca7…70db`. Full hashes and block numbers are in `contracts/deployments/base-sepolia.json`; `anchored`, `funded` and `released` were read back from the contracts as `true`.
- [ ] Deploy to Base mainnet, or state clearly that the module is testnet-only.
- [x] Public demo URL: **https://remindify-xi.vercel.app**
- [ ] Pitch deck URL.
- [ ] Founder Telegram, X and LinkedIn.
- [ ] Confirm runway and prior funding.
- [ ] Decide whether the repo becomes public.

### Before Celo Prezenti (Dec 29)

- [ ] Deploy both contracts to Celo mainnet.
- [ ] Produce 10+ verifiable Celo mainnet anchor transactions.
- [ ] Complete 3 escrow fund/release cycles with non-Ethiopian counterparties.
- [ ] Register under **ERC-8004** and paste the registration.
- [ ] Integrate **Self Protocol Agent ID** and paste the ID.
- [ ] Create the **KarmaGAP** profile.
- [ ] Complete KYC and confirm the registered country.
- [x] Made the repo public with the MIT license in place: https://github.com/kiozaghi/remindify-paypal.
- [ ] Record a Celo-specific demo that does not imply Ethiopian users can use wallets.
- [ ] Read and agree to the Prezenti legal documents.

---

## 9. Decisions only the founder can make

1. **Public demo hosting.** Done: the app is live on Vercel at **https://remindify-xi.vercel.app** against Neon Postgres. Keep a reset path for the demo and confirm the seeded workspace is intact before recording.
2. **Repo visibility.** Done: MIT licensed and public at https://github.com/kiozaghi/remindify-paypal, after the Base Sepolia rehearsal and before any Celo submission.
3. **Registered entity and KYC country.** Celo asks for the country of registration and a lead applicant for KYC. This must be accurate.
4. **Fundraising number.** The pitch says $400k for 10%. Base Ecosystem Fund may invest a different amount. Confirm the number before submitting.
5. **Celo grant amount.** The form does not ask for a number in the fields above, but the budget should be ready. Do not anchor on a number until the deployment and security-review quotes are known.
6. **Public claims.** Do not claim a mainnet deployment, Celo integration, ERC-8004 registration, Self Agent ID, paying users or audited contracts until each is true.
