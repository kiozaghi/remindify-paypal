import type { ReactNode } from "react";
import { Icon } from "../components/Icon";
import type { AuthUser } from "../types";
import { appHref, routeHref, type PublicRoute } from "../lib/router";
import {
  ArrowLink, PublicFooter, PublicNav, SectionTag, spaClick, type Navigate,
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
        lede="Start free while Remindify is in preview. Upgrade when the register is carrying real work. No usage trap, no card to begin, and a 10% fee only when work settles."
        actions={
          <>
            <a
              className="btn btn-ink btn-lg"
              href={routeHref(user ? "today" : "signup")}
              onClick={spaClick(start)}
            >
              {user ? "Open your register" : "Start free"} <Icon name="arrowRight" size={16} />
            </a>
            <a
              className="btn btn-quiet btn-lg"
              href={routeHref("security")}
              onClick={spaClick(() => onNavigate("security"))}
            >
              Read the trust model
            </a>
          </>
        }
        aside={
          <div className="price-aside-card">
            <span className="eyebrow">Preview promise</span>
            <strong>No card. No lock-in.<br />A fair fee.</strong>
            <ul>
              <li><Icon name="check" size={13} /> Email and Google sign-in</li>
              <li><Icon name="check" size={13} /> PayPal holds and payouts</li>
              <li><Icon name="check" size={13} /> Export your register</li>
              <li><Icon name="check" size={13} /> Cancel whenever</li>
            </ul>
            <span className="price-aside-note">Plan billing is not switched on during the private preview. PayPal payments for obligations run in sandbox.</span>
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
              <a
                className={`btn ${plan.featured ? "btn-lime" : plan.tone === "lime" ? "btn-ink" : "btn-ghost"} btn-sm`}
                href={routeHref(user ? "today" : "signup")}
                onClick={spaClick(start)}
              >
                {plan.cta} <Icon name="arrowRight" size={13} />
              </a>
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
            { icon: "receipt", title: "Proof when it matters", copy: "Receipts are included. The auditor checks the evidence, the PayPal hold releases, and the 10% fee is taken only on settled work." },
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
        <a
          className="btn btn-lime btn-lg"
          href={routeHref(user ? "today" : "signup")}
          onClick={spaClick(start)}
        >
          {user ? "Open your register" : "Start free"} <Icon name="arrowRight" size={16} />
        </a>
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
        lede="Remindify is built around a simple rule: the parts that matter should be inspectable, and money should move only with the payer's approval. Here is the model, including the parts that are still preview."
        actions={
          <>
            <a
              className="btn btn-ink btn-lg"
              href={routeHref(user ? "today" : "signup")}
              onClick={spaClick(start)}
            >
              {user ? "Open your register" : "Start free"} <Icon name="arrowRight" size={16} />
            </a>
            <a
              className="btn btn-quiet btn-lg"
              href={appHref("trust", user)}
              onClick={spaClick(() => onNavigate(user ? "trust" : "login", user ? undefined : { next: "trust" }))}
            >
              Open the trust layer
            </a>
          </>
        }
        aside={
          <div className="security-aside">
            <div className="security-aside-row"><span>Custody</span><strong>None</strong></div>
            <div className="security-aside-row"><span>Payments</span><strong>PayPal</strong></div>
            <div className="security-aside-row"><span>Escrow</span><strong>PayPal hold</strong></div>
            <div className="security-aside-row"><span>Proof receipts</span><strong>HMAC-SHA256</strong></div>
            <div className="security-aside-row"><span>Proof audit</span><strong>Gemini 2.5 Flash</strong></div>
            <div className="security-aside-row"><span>Fee</span><strong>10% on settled</strong></div>
          </div>
        }
      />

      <section className="security-principles section-wrap">
        <div className="security-grid">
          {[
            { icon: "fingerprint", title: "Your account is yours", copy: "Passwords are salted and hashed with scrypt. Sessions are random strings, stored as hashes and carried in HttpOnly, SameSite cookies. Google sign-in is optional." },
            { icon: "receipt", title: "Proof is a hash, not a document", copy: "Proof references and evidence envelopes are hashed with SHA-256 and bound into the receipt. The receipt contains the hashes, not the documents. Your evidence stays in your workspace." },
            { icon: "lock", title: "Money moves with your approval", copy: "A payer approves a PayPal authorization hold in their own account. The server can request a capture and a payout, but it never holds a balance, a card or a private key, and it cannot move money without that approval." },
            { icon: "scale", title: "Not a bank, not a balance", copy: "Remindify is not a bank and holds no customer funds. PayPal is a third-party processor: it holds the authorization, captures it and pays the provider. Remindify records the result. The platform fee is 10%, deducted on settlement." },
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
            <h2>Proof first.<br /><em>Money second.</em></h2>
            <p>
              Every obligation follows the same order: the work happens, the evidence is
              filed, the auditor scores it, and only then can money move. A filing or a
              compliance check can stop at the receipt. Work that is paid continues to the
              payer's PayPal authorization hold.
            </p>
            <p>
              Receipts begin as <code>filed</code>, become <code>verified</code> when the
              auditor clears the 80% threshold, and are <code>settled</code> once PayPal
              captures the hold and pays the provider. A <code>rejected</code> receipt
              leaves the payer's hold untouched, and the provider can file again.
            </p>
          </div>
          <div className="security-diagram" data-reveal>
            <div className="security-step">
              <span>01</span><div><strong>Work happens</strong><em>An owner or agent completes the obligation.</em></div>
            </div>
            <i className="security-connector" />
            <div className="security-step">
              <span>02</span><div><strong>Evidence is filed</strong><em>References and hashes are attached to the obligation.</em></div>
            </div>
            <i className="security-connector" />
            <div className="security-step">
              <span>03</span><div><strong>Auditor scores</strong><em>Gemini 2.5 Flash checks amount, reference and date. 80% to pass.</em></div>
            </div>
            <i className="security-connector" />
            <div className="security-step">
              <span>04</span><div><strong>Hold releases</strong><em>PayPal captures the payer's authorization.</em></div>
            </div>
            <i className="security-connector" />
            <div className="security-step">
              <span>05</span><div><strong>Provider is paid</strong><em>Net of the 10% fee, to their PayPal email.</em></div>
            </div>
          </div>
        </div>
      </section>

      <section className="security-networks section-wrap">
        <div className="section-heading" data-reveal>
          <SectionTag>The money path</SectionTag>
          <h2>One rail.<br /><em>Three moves.</em></h2>
          <p>PayPal holds, captures and pays out. Remindify asks for each step and records the proof; it never holds the money.</p>
        </div>
        <div className="network-grid">
          {[
            {
              key: "Authorization hold",
              role: "Step 01",
              tone: "lime",
              rows: [["Window", "Up to 29 days"], ["Approved by", "The payer"]],
            },
            {
              key: "Capture",
              role: "Step 02",
              tone: "amber",
              rows: [["Trigger", "Verified proof"], ["Fee", "10%, deducted first"]],
            },
            {
              key: "Payout",
              role: "Step 03",
              tone: "teal",
              rows: [["Destination", "Provider's PayPal email"], ["Amount", "Net of the fee"]],
            },
          ].map((network) => (
            <article key={network.key} className={`network-card tone-${network.tone}`} data-reveal>
              <div className="network-top"><span className="network-dot"><i /></span><span>{network.role}</span></div>
              <h3>{network.key}</h3>
              {network.rows.map(([label, value]) => (
                <div className="network-row" key={label}><span>{label}</span><code>{value}</code></div>
              ))}
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
              Remindify is a functional preview, not a finished financial service. PayPal
              payments, holds and payouts run against the sandbox. The AI proof auditor
              falls back to deterministic rules when no model key is configured. Remindify
              holds no customer funds at any point. We will publish audit and availability
              details before asking anyone to rely on them.
            </p>
          </div>
        </div>
        <div className="security-contact">
          <div>
            <span className="eyebrow">Report a vulnerability</span>
            <p>If you find a security issue, please tell us before disclosing it publicly.</p>
          </div>
          <a className="btn btn-ghost btn-sm" href="mailto:liyusoftwaresolution@gmail.com">
            liyusoftwaresolution@gmail.com <Icon name="external" size={13} />
          </a>
        </div>
      </section>

      <section className="page-cta section-wrap" data-reveal>
        <div>
          <SectionTag light>Ready when you are</SectionTag>
          <h2>Start with proof.<br /><em>Add money later.</em></h2>
        </div>
        <a
          className="btn btn-lime btn-lg"
          href={routeHref(user ? "today" : "signup")}
          onClick={spaClick(start)}
        >
          {user ? "Open your register" : "Start free"} <Icon name="arrowRight" size={16} />
        </a>
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
        lede="Remindify started with an uncomfortable observation: the people who keep a business running are rarely the ones with the most time. They are the ones who notice. This is a product for them."
        actions={
          <>
            <a
              className="btn btn-ink btn-lg"
              href={routeHref(user ? "today" : "signup")}
              onClick={spaClick(start)}
            >
              {user ? "Open your register" : "Start your register"} <Icon name="arrowRight" size={16} />
            </a>
            <a
              className="btn btn-quiet btn-lg"
              href={routeHref("home")}
              onClick={spaClick(() => onNavigate("home"))}
            >
              Read the story
            </a>
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
              The renewal email. The payroll filing. The contractor handoff. The domain that
              expires quietly. None of these are hard individually. Together, they form a
              back office that nobody put on the org chart.
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
              remembers. Payments are PayPal-only: the payer approves a hold, a verified
              proof releases it, and the provider is paid the net. An AI auditor reads the
              evidence before any money moves, and the fee is 10%, taken only when work
              settles. Remindify holds no funds.
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
            { n: "04", title: "Fair, not extractive", copy: "No custody. Proof before money. A fair 10% fee, and only on settled work. Export always." },
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
            <p>Built close to the problem: small businesses, growing studios and teams navigating a fast-moving, mobile-first economy.</p>
          </div>
          <div className="about-place-card" data-reveal>
            <span className="about-place-icon tone-violet"><Icon name="send" size={20} /></span>
            <span className="eyebrow">Where money settles</span>
            <h3>PayPal, then proof</h3>
            <p>Payments and payouts run through the payer's and provider's own PayPal accounts. A verified proof releases the hold, and the 10% fee is deducted before the net is paid out.</p>
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
        <a
          className="btn btn-ink btn-lg"
          href={routeHref(user ? "today" : "signup")}
          onClick={spaClick(start)}
        >
          {user ? "Open your register" : "Start free"} <Icon name="arrowRight" size={16} />
        </a>
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
            ? "What Remindify collects, why, and what stays yours. The short version: your register is yours, and payments run through PayPal."
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
            <a href="mailto:liyusoftwaresolution@gmail.com">liyusoftwaresolution@gmail.com <Icon name="external" size={11} /></a>
          </div>
        </aside>
        <div className="legal-body" data-reveal>
          <div className="legal-callout">
            <Icon name="info" size={16} />
            <p>
              This is a plain-language preview, not legal advice. We will publish a reviewed
              version before paid availability and before any payment feature is offered as a
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
            <a href={routeHref("home")} onClick={spaClick(() => onNavigate("home"))}>
              Back to the story <Icon name="arrowRight" size={13} />
            </a>
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
      "When you create an account we collect the details you give us: your name and email address, or the profile information Google returns if you choose Google sign-in. We store a salted password hash if you use email and password; we never store the password itself.",
      "If you pay or receive money, PayPal returns the email address and payment identifiers needed to create the order, authorization hold or payout. We never see your PayPal password.",
      "Inside the workspace we store the obligations, owners, backups, risk inputs, proof references, receipts and audit events you create. If you paste text into Capture, it is parsed to produce draft obligations. Raw pasted text is not added to your register unless it becomes part of a saved obligation.",
    ],
  },
  {
    title: "What we do not collect",
    body: [
      "We do not sell personal data. We do not use advertising cookies. We do not publish your source documents. Proof receipts contain hashes and references, not the underlying evidence. We never ask for a card number, a PayPal password or a private key, and we cannot move money without the payer's approval.",
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
      "If you choose Google sign-in, Google processes the authentication request under its own privacy terms. If you pay or receive a payout, PayPal processes the transaction under its own terms, including the authorization hold, capture and payout. When the proof auditor runs, the evidence you file is sent to Google's Gemini API for scoring under Google's terms; if no model key is configured, those checks run on our server instead.",
      "We may use infrastructure providers to host the service and store the database. We will name material subprocessors before paid availability.",
    ],
  },
  {
    title: "Payment data",
    body: [
      "PayPal holds the authorization, moves the money and pays the provider. Remindify stores the identifiers needed to match a payment to an obligation, plus the receipt and audit events. We do not store card numbers, bank credentials or PayPal passwords, and we do not hold a balance on your behalf.",
      "Payment records held by PayPal are governed by PayPal's own retention and privacy terms.",
    ],
  },
  {
    title: "Retention",
    body: [
      "We keep account and workspace data while your account is active. Production workspaces live in a managed Postgres database; local development uses SQLite. If you ask us to delete an account, we will remove the account and its sessions. Records that PayPal holds for a payment are governed by PayPal's terms.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You can export your register from the product. You can sign out at any time. You can ask us for access, correction or deletion of your account data by contacting us. If you signed in with Google, you can revoke Remindify's access from your Google account settings. PayPal payment records are handled through your PayPal account.",
    ],
  },
  {
    title: "Changes and contact",
    body: [
      "We will update this page as the product moves from preview to paid service. Material changes will be announced in the product or by email. Questions about privacy can be sent to liyusoftwaresolution@gmail.com.",
    ],
  },
];

const TERMS: LegalSection[] = [
  {
    title: "The preview",
    body: [
      "Remindify is currently a preview. The core register is functional, but hosted availability, billing and integrations may change. Do not use the preview as the only safeguard for a legal deadline, a regulated filing, payroll or money you cannot afford to lose. Keep an independent backup of anything critical.",
    ],
  },
  {
    title: "Your account",
    body: [
      "You are responsible for the activity under your account and for keeping your sign-in method secure. Use a real email address you control and keep your PayPal account secure. Tell us promptly if you believe someone else has access to your account.",
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
    title: "Payments and holds",
    body: [
      "Remindify is not a bank and does not hold customer funds. PayPal is a third-party payment processor: the payer approves an authorization hold of up to 29 days in their own PayPal account, and a verified proof allows Remindify to request capture. PayPal captures the hold, the 10% platform fee is deducted, and the provider is paid the net to their PayPal email.",
      "A rejected proof leaves the hold untouched. Holds, captures and payouts are subject to PayPal's rules, limits and availability in your region. You are responsible for the PayPal account you use and for complying with PayPal's terms.",
    ],
  },
  {
    title: "Third-party services",
    body: [
      "Google sign-in, PayPal and Gemini are third-party services with their own terms. We are not responsible for their availability or conduct. Links to third-party sites are provided for convenience and do not imply endorsement.",
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
      "The final governing law and dispute process will be confirmed before paid availability. Until then, these terms are a preview and are not a substitute for a reviewed agreement. Questions can be sent to liyusoftwaresolution@gmail.com.",
    ],
  },
];
