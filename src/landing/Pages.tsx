import type { ReactNode } from "react";
import { Icon } from "../components/Icon";
import type { AuthUser } from "../types";
import type { PublicRoute } from "../lib/router";
import {
  ArrowLink, PublicFooter, PublicNav, SectionTag, type Navigate,
} from "./Chrome";
import { FAQS, PLANS } from "./data";
import { scrollToId, useReveal } from "./hooks";

type PageProps = { onNavigate: Navigate; user?: AuthUser | null };

function PageFrame({
  page, onNavigate, user, children, dark = false,
}: PageProps & { page: PublicRoute; children: ReactNode; dark?: boolean }) {
  return (
    <div className={`landing public-page page-${page} ${dark ? "public-page-dark" : ""}`}>
      <PublicNav page={page} onNavigate={onNavigate} user={user} />
      <main>{children}</main>
      <PublicFooter onNavigate={onNavigate} user={user} />
    </div>
  );
}

function PageHero({
  eyebrow, title, lede, actions, aside,
}: {
  eyebrow: string;
  title: ReactNode;
  lede: string;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="page-hero section-wrap">
      <div className="page-hero-copy" data-reveal>
        <SectionTag>{eyebrow}</SectionTag>
        <h1>{title}</h1>
        <p>{lede}</p>
        {actions && <div className="page-hero-actions">{actions}</div>}
      </div>
      {aside && <div className="page-hero-aside" data-reveal>{aside}</div>}
    </section>
  );
}

export function PricingPage({ onNavigate, user }: PageProps) {
  useReveal(["pricing"]);
  const start = () => onNavigate(user ? "today" : "signup");
  return (
    <PageFrame page="pricing" onNavigate={onNavigate} user={user}>
      <PageHero
        eyebrow="Pricing"
        title={<>A small price for<br /><em>the thing that didn’t slip.</em></>}
        lede="Start free while Remindify is in preview. Upgrade when the register is carrying real work. No token, no usage trap, no card to begin."
        actions={
          <>
            <button className="btn btn-ink btn-lg" onClick={start}>
              {user ? "Open your register" : "Start free"} <Icon name="arrowRight" size={16} />
            </button>
            <button className="btn btn-quiet btn-lg" onClick={() => onNavigate("security")}>Read the trust model</button>
          </>
        }
        aside={
          <div className="price-aside-card">
            <span className="eyebrow">Preview promise</span>
            <strong>No card. No token.<br />No lock-in.</strong>
            <ul>
              <li><Icon name="check" size={13} /> Email, Google or wallet sign-in</li>
              <li><Icon name="check" size={13} /> Wallet optional</li>
              <li><Icon name="check" size={13} /> Export your register</li>
              <li><Icon name="check" size={13} /> Cancel whenever</li>
            </ul>
            <span className="price-aside-note">Billing is not switched on during the private preview.</span>
          </div>
        }
      />

      <section className="pricing-page-plans section-wrap">
        <div className="plan-row">
          {PLANS.map((plan) => (
            <article key={plan.id} className={`plan-card plan-${plan.tone} plan-full`} data-reveal>
              {plan.featured && <span className="plan-flag">Most useful</span>}
              <span className="eyebrow">{plan.name}</span>
              <div className="plan-price"><strong>{plan.price}</strong><em>{plan.cadence}</em></div>
              <p className="plan-line">{plan.line}</p>
              <ul>
                {plan.features.map((feature) => <li key={feature}><Icon name="check" size={12} /> {feature}</li>)}
              </ul>
              <button className={`btn ${plan.featured ? "btn-lime" : plan.tone === "lime" ? "btn-ink" : "btn-ghost"} btn-sm`} onClick={start}>
                {plan.cta} <Icon name="arrowRight" size={13} />
              </button>
            </article>
          ))}
        </div>
        <p className="pricing-page-note" data-reveal>
          Prices are shown in USD for planning. Local payment methods and annual billing will be
          confirmed before paid availability. The free preview is not a trial that silently expires.
        </p>
      </section>

      <section className="pricing-principles section-wrap">
        <div className="section-heading" data-reveal>
          <SectionTag>What the price buys</SectionTag>
          <h2>The product is the register.<br /><em>The value is the miss you avoid.</em></h2>
        </div>
        <div className="value-grid">
          {[
            { icon: "target", title: "Coverage, not activity", copy: "Every recurring thing has an owner and a backup. You are paying for nothing to fall through." },
            { icon: "bot", title: "A bench that shows its work", copy: "Agents with scopes and ceilings, plus vetted humans when the work needs one." },
            { icon: "receipt", title: "Proof when it matters", copy: "Receipts are included. Anchoring and escrow are optional escalations, not a second product." },
            { icon: "download", title: "Portable by default", copy: "Export the register and audit trail. Your obligations are not hostage to a subscription." },
          ].map((item) => (
            <article key={item.title} className="value-card" data-reveal>
              <span className="value-icon"><Icon name={item.icon} size={18} /></span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="page-faq section-wrap">
        <div className="faq-grid">
          <div className="faq-intro" data-reveal>
            <SectionTag>Before you start</SectionTag>
            <h2>Practical<br /><em>questions.</em></h2>
          </div>
          <div className="faq-list" data-reveal>
            {FAQS.slice(1, 5).map((faq) => (
              <details key={faq.q} className="faq-item">
                <summary>{faq.q}<Icon name="plus" size={15} /></summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="page-cta section-wrap" data-reveal>
        <div>
          <SectionTag light>Start small</SectionTag>
          <h2>Put one recurring thing<br /><em>somewhere safe.</em></h2>
        </div>
        <button className="btn btn-lime btn-lg" onClick={start}>
          {user ? "Open your register" : "Start free"} <Icon name="arrowRight" size={16} />
        </button>
      </section>
    </PageFrame>
  );
}

export function SecurityPage({ onNavigate, user }: PageProps) {
  useReveal(["security"]);
  const start = () => onNavigate(user ? "today" : "signup");
  return (
    <PageFrame page="security" onNavigate={onNavigate} user={user}>
      <PageHero
        eyebrow="Security & trust"
        title={<>Trust is something<br /><em>you can check.</em></>}
        lede="Remindify is built around a simple rule: the parts that matter should be inspectable, and the parts that move money should require your signature. Here is the model, including the parts that are still preview."
        actions={
          <>
            <button className="btn btn-ink btn-lg" onClick={start}>
              {user ? "Open your register" : "Start free"} <Icon name="arrowRight" size={16} />
            </button>
            <button className="btn btn-quiet btn-lg" onClick={() => onNavigate("trust")}>Open the trust layer</button>
          </>
        }
        aside={
          <div className="security-aside">
            <div className="security-aside-row"><span>Token</span><strong>None</strong></div>
            <div className="security-aside-row"><span>Custody</span><strong>None</strong></div>
            <div className="security-aside-row"><span>Server-held keys</span><strong>None</strong></div>
            <div className="security-aside-row"><span>Default proof</span><strong>Offchain</strong></div>
            <div className="security-aside-row"><span>Primary chain</span><strong>Base</strong></div>
            <div className="security-aside-row"><span>Pilot chain</span><strong>Celo</strong></div>
          </div>
        }
      />

      <section className="security-principles section-wrap">
        <div className="security-grid">
          {[
            { icon: "fingerprint", title: "Your account is yours", copy: "Passwords are salted and hashed with scrypt. Sessions are random tokens, stored as hashes and carried in HttpOnly, SameSite cookies. Google and wallet sign-in are optional." },
            { icon: "receipt", title: "Proof is a hash, not a document", copy: "Proof references and evidence envelopes are hashed with keccak-256. The receipt contains the hashes, not the documents. You choose what, if anything, is anchored." },
            { icon: "wallet", title: "Your wallet signs", copy: "The server never holds a private key. Anchoring and escrow require your wallet to sign the transaction. The server verifies the result over RPC before updating state." },
            { icon: "scale", title: "No token, no financial product", copy: "There is no Remindify token and no custody of customer funds. USDC is the only asset the escrow module can move, and only when a contract is configured." },
          ].map((item) => (
            <article key={item.title} className="security-card" data-reveal>
              <span className="security-icon"><Icon name={item.icon} size={19} /></span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="security-detail section-wrap">
        <div className="security-detail-grid">
          <div className="security-detail-copy" data-reveal>
            <SectionTag>How it works</SectionTag>
            <h2>Offchain by default.<br /><em>Onchain by choice.</em></h2>
            <p>
              Most obligations never need a chain. A family birthday, a boiler service or a
              domain renewal belongs in a register, not in a block. The trust layer is an
              escalation path for the moments when a third party needs independent evidence
              or money needs to move.
            </p>
            <p>
              Receipts begin as <code>prepared</code>, become <code>signed</code> when a valid
              EIP-712 signature is verified, and optionally become <code>anchored</code> when
              a transaction is confirmed. Escrow releases require a signed or anchored receipt
              for the same obligation — a receipt from a different obligation is rejected.
            </p>
          </div>
          <div className="security-diagram" data-reveal>
            <div className="security-step">
              <span>01</span><div><strong>Work happens</strong><em>An owner or agent completes the obligation.</em></div>
            </div>
            <i className="security-connector" />
            <div className="security-step">
              <span>02</span><div><strong>Receipt is prepared</strong><em>Proof and evidence are hashed locally.</em></div>
            </div>
            <i className="security-connector" />
            <div className="security-step">
              <span>03</span><div><strong>Signature verifies</strong><em>EIP-712 typed data is checked with viem.</em></div>
            </div>
            <i className="security-connector" />
            <div className="security-step step-optional">
              <span>04</span><div><strong>Optional anchoring</strong><em>Base or Celo holds only the hash.</em></div>
            </div>
            <i className="security-connector" />
            <div className="security-step">
              <span>05</span><div><strong>Escrow can release</strong><em>Only against a valid receipt for this obligation.</em></div>
            </div>
          </div>
        </div>
      </section>

      <section className="security-networks section-wrap">
        <div className="section-heading" data-reveal>
          <SectionTag>Networks</SectionTag>
          <h2>One EVM module.<br /><em>Two ecosystems.</em></h2>
          <p>Base is the long-term home. Celo is the near-term pilot for mobile-first, emerging-market use.</p>
        </div>
        <div className="network-grid">
          {[
            { key: "Base", id: "8453", usdc: "0x8335…2913", role: "Primary", tone: "lime" },
            { key: "Base Sepolia", id: "84532", usdc: "0x036C…CF7e", role: "Testnet", tone: "amber" },
            { key: "Celo", id: "42220", usdc: "0xcebA…118C", role: "Grant pilot", tone: "teal" },
            { key: "Celo Sepolia", id: "11142220", usdc: "0x01C5…C44E", role: "Testnet", tone: "violet" },
          ].map((network) => (
            <article key={network.key} className={`network-card tone-${network.tone}`} data-reveal>
              <div className="network-top"><span className="network-dot"><i /></span><span>{network.role}</span></div>
              <h3>{network.key}</h3>
              <div className="network-row"><span>Chain ID</span><code>{network.id}</code></div>
              <div className="network-row"><span>USDC</span><code>{network.usdc}</code></div>
            </article>
          ))}
        </div>
      </section>

      <section className="security-honesty section-wrap" data-reveal>
        <div className="honesty-card">
          <span className="security-icon"><Icon name="info" size={19} /></span>
          <div>
            <h3>What is still preview</h3>
            <p>
              Remindify is a functional preview, not a finished financial service. The reference
              contracts in the repository are unaudited and are not automatically deployed. No
              mainnet escrow or anchoring has been verified with real funds. Wallet and payment
              features remain offchain in Ethiopia until the National Bank of Ethiopia authorises
              virtual-asset activity. We will publish audit and deployment details before asking
              anyone to rely on them.
            </p>
          </div>
        </div>
        <div className="security-contact">
          <div>
            <span className="eyebrow">Report a vulnerability</span>
            <p>If you find a security issue, please tell us before disclosing it publicly.</p>
          </div>
          <a className="btn btn-ghost btn-sm" href="mailto:security@remindify.app">
            security@remindify.app <Icon name="external" size={13} />
          </a>
        </div>
      </section>

      <section className="page-cta section-wrap" data-reveal>
        <div>
          <SectionTag light>Ready when you are</SectionTag>
          <h2>Start offchain.<br /><em>Add proof later.</em></h2>
        </div>
        <button className="btn btn-lime btn-lg" onClick={start}>
          {user ? "Open your register" : "Start free"} <Icon name="arrowRight" size={16} />
        </button>
      </section>
    </PageFrame>
  );
}

export function AboutPage({ onNavigate, user }: PageProps) {
  useReveal(["about"]);
  const start = () => onNavigate(user ? "today" : "signup");
  return (
    <PageFrame page="about" onNavigate={onNavigate} user={user}>
      <PageHero
        eyebrow="Why Remindify"
        title={<>The most reliable person<br /><em>is usually exhausted.</em></>}
        lede="Remindify started with an uncomfortable observation: the people who keep a life or a business running are rarely the ones with the most time. They are the ones who notice. This is a product for them."
        actions={
          <>
            <button className="btn btn-ink btn-lg" onClick={start}>
              {user ? "Open your register" : "Start your register"} <Icon name="arrowRight" size={16} />
            </button>
            <button className="btn btn-quiet btn-lg" onClick={() => onNavigate("home")}>Read the story</button>
          </>
        }
        aside={
          <div className="about-aside">
            <span className="about-aside-mark">R</span>
            <p>
              “A reminder is a notification.<br />
              <em>An obligation is a relationship.</em>”
            </p>
            <span className="about-aside-foot">The Remindify working definition</span>
          </div>
        }
      />

      <section className="about-manifesto section-wrap">
        <div className="about-manifesto-grid">
          <div data-reveal>
            <SectionTag>The reason</SectionTag>
            <h2>We kept watching good people<br /><em>carry invisible work.</em></h2>
          </div>
          <div className="about-body" data-reveal>
            <p className="about-lede">
              The renewal letter. The payroll filing. The school form. The domain that expires
              quietly. None of these are hard individually. Together, they form a second job
              that nobody put on the org chart.
            </p>
            <p>
              The existing tools split the problem into notifications, project boards, calendars
              and spreadsheets. None of them answer the only question that matters: <strong>who
              owns this, who is the backup, and what proof will show it was done?</strong>
            </p>
            <p>
              Remindify is our attempt to make that question structural. It is a register first,
              a workspace second, and a proof layer when trust needs to leave the room. Agents
              are welcome — not as a gimmick, but as operators with scopes, ceilings and a paper
              trail.
            </p>
            <p>
              We are building from Addis Ababa, for anyone who has ever been the person who
              remembers. The product is intentionally wallet-optional. The trust layer is
              Base-first and Celo-ready. There is no token. There is no custody. There is just
              the work that comes back, and a better place for it to live.
            </p>
          </div>
        </div>
      </section>

      <section className="about-principles section-wrap">
        <div className="section-heading" data-reveal>
          <SectionTag>What we believe</SectionTag>
          <h2>Four principles.<br /><em>No exceptions.</em></h2>
        </div>
        <div className="principle-grid">
          {[
            { n: "01", title: "Ownership over memory", copy: "A name and a backup beat a notification. If nobody owns it, it is not really scheduled." },
            { n: "02", title: "Proof over promises", copy: "“Done” is a claim. A receipt is evidence. The product should make the distinction obvious." },
            { n: "03", title: "Calm over engagement", copy: "Success is not more time in the app. It is closing the laptop because the register is covered." },
            { n: "04", title: "Optional, not extractive", copy: "No token. No custody. Wallet optional. Export always. The trust layer should earn its use." },
          ].map((principle) => (
            <article key={principle.n} className="principle-card" data-reveal>
              <span>{principle.n}</span>
              <h3>{principle.title}</h3>
              <p>{principle.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-places section-wrap">
        <div className="about-places-grid">
          <div className="about-place-card" data-reveal>
            <span className="about-place-icon tone-lime"><Icon name="mapPin" size={20} /></span>
            <span className="eyebrow">Where we start</span>
            <h3>Addis Ababa</h3>
            <p>Built close to the problem: households, small businesses and teams navigating a fast-moving, mobile-first economy.</p>
          </div>
          <div className="about-place-card" data-reveal>
            <span className="about-place-icon tone-violet"><Icon name="layers" size={20} /></span>
            <span className="eyebrow">Where trust settles</span>
            <h3>Base, then Celo</h3>
            <p>One EVM proof and escrow module. Base is the long-term home. Celo is the near-term pilot for mobile reach.</p>
          </div>
          <div className="about-place-card" data-reveal>
            <span className="about-place-icon tone-teal"><Icon name="heart" size={20} /></span>
            <span className="eyebrow">Who it is for</span>
            <h3>The person who notices</h3>
            <p>The founder, the ops lead, the parent, the one everybody calls when something is about to slip.</p>
          </div>
        </div>
      </section>

      <section className="about-invite section-wrap" data-reveal>
        <div>
          <SectionTag>Still early</SectionTag>
          <h2>If this sounds like your week,<br /><em>you are who we built it for.</em></h2>
          <p>Start with one obligation. Tell us what feels missing. The preview is meant to be shaped by the people using it.</p>
        </div>
        <button className="btn btn-ink btn-lg" onClick={start}>
          {user ? "Open your register" : "Start free"} <Icon name="arrowRight" size={16} />
        </button>
      </section>
    </PageFrame>
  );
}

export function LegalPage({ kind, onNavigate, user }: PageProps & { kind: "privacy" | "terms" }) {
  useReveal([kind]);
  const privacy = kind === "privacy";
  const sections = privacy ? PRIVACY : TERMS;
  return (
    <PageFrame page={kind} onNavigate={onNavigate} user={user}>
      <section className="legal-hero section-wrap" data-reveal>
        <SectionTag>Small print, in plain language</SectionTag>
        <h1>{privacy ? "Privacy" : "Terms"}<em>.</em></h1>
        <p>
          {privacy
            ? "What Remindify collects, why, and what stays yours. The short version: your register is yours, and the trust layer is optional."
            : "The rules for using the Remindify preview. The short version: use it honestly, keep your account safe, and do not rely on preview infrastructure for money or legal deadlines."}
        </p>
        <div className="legal-meta">
          <span>Last updated 22 October 2026</span>
          <span>Preview draft · counsel review before paid launch</span>
        </div>
      </section>

      <section className="legal-layout section-wrap">
        <aside className="legal-toc" data-reveal>
          <span className="eyebrow">On this page</span>
          {sections.map((section, index) => (
            <button key={section.title} onClick={() => scrollToId(`${kind}-${index + 1}`)}>{section.title}</button>
          ))}
          <div className="legal-toc-contact">
            <span className="eyebrow">Questions</span>
            <a href="mailto:hello@remindify.app">hello@remindify.app <Icon name="external" size={11} /></a>
          </div>
        </aside>
        <div className="legal-body" data-reveal>
          <div className="legal-callout">
            <Icon name="info" size={16} />
            <p>
              This is a plain-language preview, not legal advice. We will publish a reviewed
              version before paid availability and before any onchain feature is offered as a
              production service.
            </p>
          </div>
          {sections.map((section, index) => (
            <article key={section.title} id={`${kind}-${index + 1}`} className="legal-section">
              <span className="legal-number">{String(index + 1).padStart(2, "0")}</span>
              <h2>{section.title}</h2>
              {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets && (
                <ul>
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              )}
            </article>
          ))}
          <div className="legal-foot">
            <span>Remindify · preview terms</span>
            <button onClick={() => onNavigate("home")}>Back to the story <Icon name="arrowRight" size={13} /></button>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}

type LegalSection = {
  title: string;
  body: string[];
  bullets?: string[];
};

const PRIVACY: LegalSection[] = [
  {
    title: "What we collect",
    body: [
      "When you create an account we collect the details you give us: your name and email address, or the profile information Google returns if you choose Google sign-in, or the public address your wallet returns if you choose wallet sign-in. We store a salted password hash if you use email and password; we never store the password itself.",
      "Inside the workspace we store the obligations, owners, backups, risk inputs, proof references, receipts and audit events you create. If you paste text into Capture, it is parsed to produce draft obligations. Raw pasted text is not added to your register unless it becomes part of a saved obligation.",
    ],
  },
  {
    title: "What we do not collect",
    body: [
      "We do not sell personal data. We do not use advertising cookies. We do not upload your source documents to the trust layer. Proof receipts contain hashes and references, not the underlying document. We do not ask for a private key and we cannot sign a transaction for you.",
    ],
  },
  {
    title: "How we use it",
    body: [
      "We use account data to authenticate you and keep your workspace separate from other people's. We use workspace data to calculate risk, show your register, produce receipts and maintain the audit trail. We use limited operational logs to keep the service healthy and investigate abuse.",
    ],
  },
  {
    title: "Cookies and sessions",
    body: [
      "Remindify sets a small number of essential cookies. A session cookie keeps you signed in. A short-lived OAuth state cookie protects the Google sign-in redirect. These cookies are HttpOnly and SameSite=Lax, and the session cookie is marked Secure when the service is served over HTTPS. We do not use them for advertising.",
    ],
  },
  {
    title: "Third parties",
    body: [
      "If you choose Google sign-in, Google processes the authentication request under its own privacy terms. If you choose wallet sign-in, your wallet software handles the signature locally; the server receives only the public address, message and signature needed to verify it. If you anchor a receipt or use escrow, a public RPC provider and the relevant network will see the public transaction you signed.",
      "We may use infrastructure providers to host the service and store the database. We will name material subprocessors before paid availability.",
    ],
  },
  {
    title: "Onchain data",
    body: [
      "Blockchains are public and permanent. If you choose to anchor a receipt or fund an escrow, the transaction, your public wallet address and the proof hash become publicly visible. Do not anchor anything you are not prepared to make public. The underlying evidence is not uploaded by Remindify.",
    ],
  },
  {
    title: "Retention",
    body: [
      "We keep account and workspace data while your account is active. The preview database is local to the deployment you are using. If you ask us to delete an account, we will remove the account and its sessions; records already written to a public chain cannot be deleted by us or anyone else.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You can export your register from the product. You can sign out at any time. You can ask us for access, correction or deletion of your account data by contacting us. If you signed in with Google, you can revoke Remindify's access from your Google account settings.",
    ],
  },
  {
    title: "Changes and contact",
    body: [
      "We will update this page as the product moves from preview to paid service. Material changes will be announced in the product or by email. Questions about privacy can be sent to hello@remindify.app.",
    ],
  },
];

const TERMS: LegalSection[] = [
  {
    title: "The preview",
    body: [
      "Remindify is currently a preview. The core register is functional, but hosted availability, billing, contracts and integrations may change. Do not use the preview as the only safeguard for a legal deadline, a regulated filing, payroll or money you cannot afford to lose. Keep an independent backup of anything critical.",
    ],
  },
  {
    title: "Your account",
    body: [
      "You are responsible for the activity under your account and for keeping your sign-in method secure. Use a real email address you control. If you sign in with a wallet, you are responsible for that wallet. Tell us promptly if you believe someone else has access to your account.",
    ],
  },
  {
    title: "Your content",
    body: [
      "You keep ownership of the obligations, notes, proof references and other content you put into Remindify. You give us the limited permission needed to store it, process it and show it back to you inside the service. You are responsible for having the right to upload or reference the material you use.",
    ],
  },
  {
    title: "Acceptable use",
    body: [
      "Do not use Remindify to break the law, infringe someone else's rights, distribute malware, attempt to access another person's workspace, probe the service for vulnerabilities without permission, or use the trust layer to misrepresent work that did not happen.",
    ],
    bullets: [
      "No unlawful, fraudulent or deceptive obligations or proof.",
      "No unauthorised access, scraping or denial-of-service activity.",
      "No use of the service to launder money or evade sanctions.",
    ],
  },
  {
    title: "Not legal, financial or tax advice",
    body: [
      "Remindify helps you organise obligations and evidence. It does not provide legal, tax, accounting or investment advice. A risk score is an internal prioritisation signal, not a professional opinion. Consult a qualified professional for regulated decisions.",
    ],
  },
  {
    title: "Wallets and onchain transactions",
    body: [
      "Wallet features are optional. If you use them, you are responsible for the transaction you sign. Remindify does not custody funds, hold private keys or reverse a confirmed blockchain transaction. Gas, network conditions and counterparty behaviour are outside our control. USDC is the only asset the escrow module is designed to move.",
    ],
  },
  {
    title: "Third-party services",
    body: [
      "Google sign-in, wallet software, RPC providers and blockchains are third-party services with their own terms. We are not responsible for their availability or conduct. Links to third-party sites are provided for convenience and do not imply endorsement.",
    ],
  },
  {
    title: "Availability and changes",
    body: [
      "We may change, suspend or discontinue parts of the preview. We aim to give reasonable notice of material changes, but the preview is provided as-is. Paid availability will come with a clearer service commitment.",
    ],
  },
  {
    title: "Disclaimers and liability",
    body: [
      "To the maximum extent permitted by applicable law, the preview is provided without warranties of any kind, and Remindify is not liable for indirect, incidental, special or consequential losses, or for lost profits, data or opportunities arising from use of the preview. Nothing in these terms excludes liability that cannot lawfully be excluded.",
    ],
  },
  {
    title: "Ending use",
    body: [
      "You can stop using Remindify at any time. We may suspend or end access if these terms are breached or if continuing would create a security, legal or operational risk. Sections that by their nature should survive termination will survive.",
    ],
  },
  {
    title: "Governing law and contact",
    body: [
      "The final governing law and dispute process will be confirmed before paid availability. Until then, these terms are a preview and are not a substitute for a reviewed agreement. Questions can be sent to hello@remindify.app.",
    ],
  },
];
