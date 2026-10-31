# Base Builder Grant Program — submission pack

**Draft · October 30, 2026. Nothing submitted.**

- Form: <https://forms.gle/urqjBJYJjR6Vqqre6> (the link you sent; verified against
  `docs.base.org/get-started/builders`)
- This is a **different program from the Base Ecosystem Fund**. It is a grant of
  up to **$5,000**, plus GTM/product support and builder credits — not a $400k
  equity round. Do not paste the BEF answers or the deck's ask here.
- The form requires a Google sign-in and one response per account. The browser is
  not signed in yet.
- Fields marked **`[YOU]`** are facts only the founder can supply.

---

## 1. What the form actually asks

| # | Field | Type | Required |
| --- | --- | --- | --- |
| 1 | Email | text (auto when signed in) | yes |
| 2 | Full name | text | yes |
| 3 | Email | text | yes |
| 4 | X (Twitter) handle | text | yes |
| 5 | Telegram username | text | yes |
| 6 | Project name + one-line description | textarea | yes |
| 7 | Tell us about the founding team | textarea | yes |
| 8 | Link to your live product | url | yes |
| 9 | Link to a Product Demo (Loom) | url | yes |
| 10 | Contract address on Base | text | yes |
| 11 | Which track best fits | radio | yes |
| 12 | Key usage numbers | textarea | yes |
| 13 | How does your product make money today? | textarea | yes |
| 14 | GTM plan for the next 3 months | textarea | yes |
| 15 | Base Builder Code | text | yes |
| 16 | Primary challenge / bottleneck | radio | yes |
| 17 | Which credits would be most useful | textarea | yes |
| 18 | If applying a second time, what changed | textarea | no |

**Track choices:** Trading · Payments / Stable coins · Agents / Agentic Commerce ·
Lending / Yield · Tokenization · RWA · Consumer Social / App · Other.

**Bottleneck choices:** User acquisition · Go-to-market strategy · Smart contract
security/auditing · Liquidity bootstrapping · UI/UX improvements · Regulatory
compliance guidance · Other.

**Eligibility, in Base's words:** exclusively building on Base right now; past the
idea stage with a live product that is getting used; needs product, GTM and launch
help more than capital. Remindify is live and Base-only, but **not yet getting
external use** — the answers below say that plainly rather than inflate it.

---

## 2. Identity (fields 1–5)

**Full name**

```text
Solomon Tigabu
```

**Email**

```text
[YOU — the address you want Base to reply to]
```

**X (Twitter) handle**

```text
[YOU — @handle or https://x.com/handle]
```

**Telegram username**

```text
[YOU — @handle]
```

---

## 3. Product (fields 6–10)

**Project name + one-line description**

```text
Remindify — the obligation register for humans and agents. Every recurring
responsibility gets an owner, a backup, an autonomy ceiling and a proof receipt
anchored on Base, so delegated work can be verified and paid on completion.
```

**Link to your live product**

```text
https://remindify-xi.vercel.app
```

**Contract address on Base**

```text
RemindifyAttestations — 0x22C9241F34107D829DC67Df530aEbD7aC14eF7f9
RemindifyEscrow — 0x647F30587B925F1aFb71D3C9CE25CfbDA17872db

Both are on Base Sepolia, source-verified on Basescan. They are unaudited and
testnet-only; mainnet follows a contract review.
```

If the field accepts one address, use the attestations contract and put the
escrow in the team/usage answer or the GTM answer. Do not imply mainnet.

**Link to a Product Demo (Loom)**

```text
[YOU — paste the Loom or unlisted YouTube URL after uploading
`../remindify-walkthrough-narrated.mp4`.]
```

Recorded demo: 2:22, 1440×900, narrated, captioned. It walks through Today →
Register (people vs money) → one obligation (risk, autonomy ceiling, named
backup, required proof) → Capture → Agents → Marketplace → Trust layer → the
Base Sepolia anchor/approve/fund/release rehearse → outro. It states
"testnet only, unaudited" on screen and in the voice-over.

Upload title suggestion:

```text
Remindify — obligation register with agents and proof (2:22)
```

Upload description suggestion:

```text
A walkthrough of Remindify: one register for the people you look after and the
money you can't lose. Every obligation has an owner, a backup, an autonomy
ceiling and proof. Agents can prepare or execute; humans and agents can be hired
from the marketplace; escrow releases on accepted proof. The Base Sepolia
contract path is shown as a recorded testnet rehearsal — unaudited, not mainnet.
```

---

## 4. Team (field 7)

```text
Solo founder: Solomon Tigabu, Founder/CEO, Addis Ababa, Ethiopia.

Software engineer, designer and operator. CTO and Master Trainer at Exopya
Incubation Center, working hands-on with early-stage teams; 600+ designs and 8
brand builds shipped. No prior exits and no outside capital — bootstrapped to
date.

I built Remindify end to end: the product, the API, the agent passport and
autonomy model, both Solidity contracts and the Base Sepolia deployment. The
domain expertise is lived: I have been the backup for every obligation in my own
family and business, and I built the register I needed. The first users are the
same shape — founders, freelancers and small studios in Addis and the diaspora,
with global obligations and no back office.
```

---

## 5. Traction and money (fields 11–13)

**Track**

```text
Agents / Agentic Commerce
```

Reason if asked: the paid unit is delegated work — agent passports, proof
receipts, and USDC escrow that releases on accepted proof. The consumer register
is the distribution surface, not a separate product.

**Key usage numbers**

```text
No external users yet. Two internal test accounts (founder and a release-check
account), 0 DAU, 0 WAU. $0 production volume.

$1 USDC of test volume on Base Sepolia in the recorded rehearsal: anchor the
EIP-712 receipt, approve 1 USDC, fund escrow, release on proof. Four transactions,
with anchored / funded / released read back from the contracts as true.

What is live: per-account workspaces, email/password + Google + wallet sign-in,
nine surfaces, 16 seeded obligations, 7 agents, 8 providers, REST and MCP access,
35 passing tests. The product is live, but it has not yet been used by anyone
outside the build.
```

This is the weakest part of the application and the most important one to keep
honest. Base's own criteria say "a live product that's getting used." We do not
meet that yet. The application's best chance is the strength of the primitive and
the specificity of the 90-day plan, not a padded number.

**How does your product make money today?**

```text
It doesn't yet — we are pre-revenue, with pricing live but no charges.

The model: Personal is $0 during preview; Studio is $18/month; Operator is
$48/month; the marketplace takes 15% of completed human/agent work; agent
platform access is usage-based over REST/MCP.

The first revenue is expected from Studio workspaces after the design-partner
cohort, not from the grant. No revenue is claimed today.
```

---

## 6. Go to market (field 14) and support (fields 15–17)

**GTM plan for the next 3 months**

```text
Weeks 1–2 — ten design partners, hand-onboarded. Source from the Exopya founder
network and Addis/diaspora communities. Free Studio during preview. Success is
five obligations captured and one delegated with proof, not a signup.

Weeks 3–6 — remove setup friction. Ship mobile capture and calendar/inbox
ingestion so the first ten obligations take minutes. Instrument activation:
workspace → 5 obligations → 1 delegation → 1 accepted proof.

Weeks 7–10 — distribution through packs. Launch three curated packs (Ethiopia
tax filing, the school year, diaspora property) with named curators, each one a
channel rather than a feature. Publish two proof-of-done case studies.

Weeks 11–12 — convert the first paid Studio workspaces; integrate Base Builder
Codes; apply for Base regional amplification in Africa; prepare mainnet.

Targets: 10 activated workspaces, 100 obligations captured, 50 pack forks, first
3 paying workspaces. No user numbers are claimed before they exist.
```

**Base Builder Code**

```text
Not registered yet. We have not integrated ERC-8021.

Plan: register the project on Base Dashboard, append the code to every anchor and
escrow transaction, and validate attribution before the mainnet deployment. This
is the first integration task in the cohort, not a claim that it is done.
```

If the founder can register a code before submitting, replace this with the real
code and say it is integrated. Do not invent one.

**Primary challenge**

```text
User acquisition
```

The honest runner-up is smart-contract security/auditing — mainnet is gated on a
review. If the form allows only one, pick user acquisition, because the grant's
support is GTM-shaped and the first bottleneck is ten real design partners.

**Which credits would be most useful**

```text
1. Privy — embedded wallets for non-crypto users, with ERC-8021 support.
2. LLM inference credits — agent runs that prepare work and file proof.
3. Cloud/Postgres credits — production workspaces and the proof/audit store.
4. A smart-contract audit credit — the gate before Base mainnet.
```

**If applying a second time**

```text
First application.
```

---

## 7. Before pressing Submit

- [ ] Google account signed in; one response only.
- [ ] X and Telegram are real, public and reachable.
- [ ] The Loom link opens without a request-access screen.
- [ ] The live product opens and signup works.
- [ ] Contract addresses say **Base Sepolia** in the same answer.
- [ ] No claim of mainnet, audit, revenue, or external users.
- [ ] Builder Code answer is true — either a real code or "not yet".
- [ ] Save the final answers in this file after submitting.

## 8. What this grant is and is not

- It is up to **$5,000**, plus product/GTM support and credits. It is not the
  $400k round in `PITCH.md`; keep the two asks separate.
- Base says it funds very selectively and that Builder Codes are the first step
  to eligibility. Applying without one is allowed but weaker.
- The strongest angle is **agentic commerce with proof**: a reusable
  proof-plus-escrow primitive for delegated work, with a consumer surface that
  can drive real USDC transactions.
- The weakest angle is traction. Do not hide it; the 90-day plan has to carry the
  application.
