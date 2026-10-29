# Base Ecosystem Fund — submission pack

**Draft for the live form · October 29, 2026.** The form was walked end to end in a
browser on this date; the fields below are the real ones, in the real order.
Nothing has been submitted.

- Form: <https://www.base.org/ecosystem-fund/apply> (rolling)
- Copy each block under its field label. Anything marked **`[YOU]`** is a fact only
  the founder can supply — do not guess it.
- The form has no account-creation field, no company-registration field, and no
  file upload. The deck is a **URL** field on the last step and it is optional.

---

## 1. What the form actually asks

| Step | Field | Type | Required |
| --- | --- | --- | --- |
| Company | Company Name | text | yes |
| Company | What are you building? | textarea | yes |
| Company | Website URL | url | yes |
| Company | X URL | url | yes |
| Team | Founder name / role / experience | text + textarea | yes |
| Team | Founder Telegram / X / LinkedIn | text + urls | yes |
| Team | Team Size | select: 1–5, 6–10, 11–25, 26–50, 51+ | yes |
| Team | Location | text | yes |
| Idea | What is the problem you are solving? | textarea | yes |
| Idea | Why are you working on this idea? | textarea | yes |
| Idea | How long have you been working on this company idea? | select: <1 yr, 1–3, 4–5, 5+ | yes |
| Idea | What's your current traction? | textarea | yes |
| Funding | Have you raised capital before? | textarea | yes |
| Funding | What's your current runway? | text | yes |
| Funding | What are your current fundraising goals? | textarea | yes |
| Why Base | What aspects of your company / product are on Base? | textarea | yes |
| Why Base | Why are you interested in BEF / Base? | textarea | yes |
| Why Base | Pitch Deck URL | url | no |

You can add more than one founder. The form is five steps with the section names
*Company, Team, Idea, Funding, Why Base*.

---

## 2. Company

**Company Name**

```text
Remindify
```

**What are you building?**

```text
Remindify is an obligation register for humans and agents. It turns the recurring
obligations a person or small team carries — renewals, filings, payroll,
insurance, maintenance, family admin — into risk-scored objects with an owner, a
backup, an autonomy level and a proof requirement.

Agents get passports with scopes and ceilings. Every completion files an EIP-712
proof receipt; the register anchors that receipt on Base so the work is
verifiable without trusting our database. The marketplace puts humans and agents
on the same bench, and USDC escrow releases only against an anchored receipt.

The product is live at https://remindify-xi.vercel.app with per-account
workspaces, a seller desk, REST and MCP access, and nine surfaces: Today,
Obligations, Capture, Agents, Marketplace, Seller desk, Activity/Proof, Trust and
Agent Access.
```

**Website URL**

```text
https://remindify-xi.vercel.app
```

**X URL**

```text
[YOU — the company or founder X profile, e.g. https://x.com/handle]
```

---

## 3. Team

**Name**

```text
Solomon Tigabu
```

**Role**

```text
Founder / CEO
```

**Brief description of previous professional experiences**

```text
Software engineer, designer and operator based in Addis Ababa. CTO and Master
Trainer at Exopya Incubation Center, working hands-on with early-stage teams;
600+ designs and 8 brand builds. I have shipped products end to end — frontend,
backend, design, deployment and support — for the same kind of small teams
Remindify starts with: high obligation density, no back office, global
counterparties.
```

**Telegram**

```text
[YOU — @handle]
```

**X**

```text
[YOU — https://x.com/handle]
```

**LinkedIn**

```text
[YOU — https://linkedin.com/in/handle]
```

**Team Size**

```text
1–5
```

Confirm this is still accurate; a solo founder is a valid answer and better than
an inflated one.

**Location**

```text
Addis Ababa, Ethiopia
```

---

## 4. Idea

**What is the problem you are solving?**

```text
Everyone carries a second job they never applied for. Half of it is people — a
parent's medication, a child's school forms, a friend's visa deadline. Half of it
is money — rent, payroll, an insurance renewal, a tax filing, a subscription, a
domain that quietly expires.

That work lives in notes, chats and memory. It is invisible until it fails, and
the failure is expensive: a lapsed policy, a fine, a missed payroll, a
relationship that takes the hit instead.

Existing tools hold fragments. Calendars remember. Task apps list. Accountants
file. Marketplaces match. None of them hold the obligation itself — who owns it,
who backs it up, what happens if it slips, what "done" actually means, and
whether the work was really completed.

Delegation fails for the same reason: you cannot hand something over without
evidence it came back done. That gap now blocks agents too. An agent can act, but
a buyer has no scope, ceiling or proof they can check.
```

**Why are you working on this idea?**

```text
[YOU — one or two concrete sentences about the obligation you personally missed
and what it cost. This is the only answer on the form that should be yours alone;
everything after the first line below is a scaffold you can keep or cut.]

I built Remindify because I was the backup for everything in my own life and
there was no system that knew it. [YOUR ANECDOTE: the specific renewal, filing or
family obligation that slipped, and what it cost.]

The pattern is not personal. The first users are founders, freelancers and small
studios in Addis and the diaspora: people with global obligations and no back
office. They do not need another reminder. They need the obligation owned,
backed up, and provable when it is handed to someone else.
```

**How long have you been working on this company idea?**

```text
[YOU — the select has five options: Less than a year / 1–3 years / 4–5 years /
5+ years. Use the real start date, not the repo's first commit.]
```

**What's your current traction?**

```text
Working prototype, pre-revenue.

- Live public demo: https://remindify-xi.vercel.app
- Per-account workspaces with email/password, Google and wallet sign-in, email
  verification, password reset, account deletion, region gating and sanctions
  screening.
- 16 seeded obligations, 7 agents, 8 marketplace providers, nine product
  surfaces, REST and MCP access with scoped, metered, idempotent keys.
- 35 automated tests pass; TypeScript and the production build are clean.
- Two Solidity contracts — RemindifyAttestations and RemindifyEscrow — are
  deployed to Base Sepolia and source-verified on Basescan.
- The full trust lifecycle is rehearsed onchain: anchor the EIP-712 receipt,
  approve and fund 1 USDC, release on proof. Four transactions are recorded, and
  anchored / funded / released read back from the contracts as true.
- The contracts are unaudited and testnet-only. There is no Base mainnet
  deployment yet.
- No paying users yet. The next milestone is 10 design partners.
```

---

## 5. Funding

**Have you raised capital before?**

```text
[YOU — confirm. If the answer is no, use:]

No. Bootstrapped to date. [If there is any grant, friends-and-family round or
accelerator money, state the amount, the source and the terms here instead.]
```

**What's your current runway?**

```text
[YOU — e.g. "6 months" or "12 months at current burn". A number, not a range.]
```

**What are your current fundraising goals?**

```text
$400k for 10%, to fund an 18-month runway:

- 50% engineering — mobile, document ingestion, team workspaces and the agent
  runtime.
- 25% design and product — the review experience and the agent trust surfaces.
- 15% marketplace supply — onboarding and verifying the first 100 providers.
- 10% go-to-market — the Addis and diaspora wedge, content and partnerships.

Milestones for the round: 10,000 activated users, 1,000 marketplace jobs at 95%
proof acceptance, three design partners embedding the API, and a Base mainnet
deployment of the trust module after a contract review.
```

This repeats the round in `PITCH.md`. Base Ecosystem Fund may invest a different
amount and on different terms, so decide before submitting whether to keep the
"$400k for 10%" framing or state the use of funds without a price.

---

## 6. Why Base

**What aspects of your company / product are on Base?**

```text
The trust layer is on Base, not bolted on afterwards.

- RemindifyAttestations verifies an EIP-712 signature onchain and stores
  anchored[receiptId]. RemindifyEscrow is a minimal USDC escrow that releases
  only when the registry says that receipt is anchored.
- Both contracts are deployed to Base Sepolia and source-verified on Basescan.
  The full lifecycle is rehearsed with four recorded transactions: anchor,
  approve, fund, release.
- The app is Base-first: verified USDC addresses for Base and Base Sepolia, and
  the chain profile drives the Trust surface in the product.
- The module is EVM-generic, so the same contracts can serve Celo later without a
  second architecture.
- USDC is the settlement rail because the first users already move money in
  dollars, across borders, without a local card rail.

Mainnet deployment follows a contract review; until then the product says
"testnet" everywhere it says Base.
```

**Why are you interested in BEF / Base?**

```text
Base is the only ecosystem where our three requirements meet: cheap anchoring for
high-volume proof receipts, USDC settlement our users already hold, and an
explicit agent economy.

BEF's thesis — AI agents and stablecoin distribution in emerging markets — is
literally the product. Agents do real work under scoped authority, and USDC
escrow releases on proof instead of on trust. We are building it in Addis Ababa,
where obligations are global and back-office support is thin; Base gives those
users the same verifiable rail as a team in San Francisco.

What we want from BEF is a long-term partner, not only a check: a contract review
before mainnet, design-partner introductions, and a path into the Base agent
ecosystem as agent commerce matures.
```

**Pitch Deck URL** *(optional)*

```text
[YOU — DocSend or Google Drive link. There is no deck in the repo; if none exists,
leave this blank rather than linking something unfinished.]
```

---

## 7. Before pressing Submit

- [ ] X, Telegram and LinkedIn are real, public and reachable — the form asks for all three.
- [ ] Runway is a number the founder can defend in a follow-up call.
- [ ] The prior-funding answer matches the legal reality.
- [ ] `howLong` reflects the real start date.
- [ ] The demo opens, signup works, and the seeded workspace still shows 16 obligations / 7 agents / 8 providers.
- [ ] Nothing in the answers claims Base **mainnet**, an audit, or paying users.
- [ ] Decide on the repo-visibility question. Base does not require open source; MIT is already in place for the Celo submission.
- [ ] Keep a copy of exactly what was submitted (this file plus the final form values).

## 8. The honest gaps a reviewer may probe

| Question they may ask | The truthful answer |
| --- | --- |
| Is this on Base mainnet? | No. Contracts are on Base Sepolia and rehearsed; mainnet follows a review. |
| Is the escrow audited? | No. It is a reference implementation, unaudited, testnet-only. |
| Do you have users? | No paying users. A live demo and a working product, pre-revenue. |
| Why not just build on Ethereum? | Cost per anchored receipt and USDC liquidity with the exact users we serve. |
| What stops a competitor copying this? | The obligation graph plus the proof graph, and provider supply on the marketplace. The story is copyable; the accumulated proofs are not. |
