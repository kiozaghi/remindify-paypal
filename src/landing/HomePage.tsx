import { Icon } from "../components/Icon";
import type { AuthUser } from "../types";
import { appHref, routeHref, type Route } from "../lib/router";
import {
  ArrowLink, PublicFooter, PublicNav, SectionTag, spaClick, type Navigate,
} from "./Chrome";
import { CHAPTERS, FAQS, PLANS, PRODUCTS } from "./data";
import {
  CarryingSection, DelegationPaths, DeveloperSection, PacksSection, TwoSidesSection,
} from "./Sections";
import { scrollToId, useActiveSection, useReveal, useScrollProgress } from "./hooks";

const CHAPTER_IDS = CHAPTERS.map((chapter) => chapter.id);

export default function HomePage({
  onNavigate, user,
}: { onNavigate: Navigate; user?: AuthUser | null }) {
  useReveal([]);
  const progress = useScrollProgress();
  const active = useActiveSection(CHAPTER_IDS);
  const primary: Route = user ? "today" : "signup";
  const openPrimary = () => onNavigate(primary);

  return (
    <div className="landing home-page">
      <PublicNav page="home" onNavigate={onNavigate} user={user} />
      <div className="read-progress" aria-hidden="true"><span style={{ width: `${progress * 100}%` }} /></div>

      <aside className="story-rail" aria-label="The story">
        {CHAPTERS.map((chapter, index) => (
          <a
            key={chapter.id}
            href={`#${chapter.id}`}
            className={active === chapter.id ? "on" : ""}
            onClick={(event) => {
              event.preventDefault();
              scrollToId(chapter.id);
            }}
            aria-label={`Go to ${chapter.label}`}
          >
            <i>{String(index + 1).padStart(2, "0")}</i>
            <span>{chapter.label}</span>
          </a>
        ))}
      </aside>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="hero-story" id="top">
          <div className="hero-story-glow" aria-hidden="true" />
          <div className="hero-story-grid">
            <div className="hero-story-copy" data-reveal>
              <SectionTag>For everything that comes back</SectionTag>
              <h1>
                Your back office<br />
                <em>never clocks out.</em>
              </h1>
              <p className="hero-lede">
                Vendor renewals, compliance filings, contractor milestones, overdue invoices.
                The work that keeps a business alive never stops arriving — and it never fits
                in one inbox. Remindify is one governed register for all of it, with agents
                that carry a spending ceiling, humans who sign off, and proof before any
                money moves.
              </p>
              <div className="hero-story-actions">
                <a
                  className="btn btn-ink btn-lg"
                  href={routeHref(primary)}
                  onClick={spaClick(openPrimary)}
                >
                  {user ? "Open your register" : "Start your register"}
                  <Icon name="arrowRight" size={16} />
                </a>
                <a
                  className="btn btn-quiet btn-lg"
                  href="#story"
                  onClick={(event) => { event.preventDefault(); scrollToId("story"); }}
                >
                  Walk through the story <Icon name="chevronDown" size={15} />
                </a>
              </div>
              <div className="hero-trustline">
                <span><i className="dot dot-teal" /> Email or Google</span>
                <span><i className="dot dot-lime" /> PayPal only</span>
                <span><i className="dot dot-violet" /> 10% on settled work</span>
              </div>
            </div>

            <div className="hero-desk" data-reveal aria-label="A preview of the Remindify register">
              <div className="desk-top">
                <span className="desk-dot" />
                <span>Tuesday, 8:42pm</span>
                <em>the studio desk</em>
              </div>
              <div className="desk-paper">
                <div className="desk-paper-head">
                  <span className="eyebrow">The register</span>
                  <span className="desk-live"><i /> 12 live</span>
                </div>
                <div className="desk-item desk-critical">
                  <span className="desk-item-check" />
                  <div>
                    <strong>Warehouse insurance</strong>
                    <em>Renewal · $1,840 · annual</em>
                  </div>
                  <span className="desk-due">12d</span>
                </div>
                <div className="desk-item">
                  <span className="desk-item-check" />
                  <div>
                    <strong>Company tax filing</strong>
                    <em>Payroll · with Ledger</em>
                  </div>
                  <span className="desk-due soft">21d</span>
                </div>
                <div className="desk-item">
                  <span className="desk-item-check" />
                  <div>
                    <strong>Kestrel pen-test sign-off</strong>
                    <em>Vendor · $350 held · proof required</em>
                  </div>
                  <span className="desk-due soft">6d</span>
                </div>
                <div className="desk-agent">
                  <span className="desk-agent-mark">R</span>
                  <div>
                    <strong>Remy is preparing a plan</strong>
                    <em>Waiting for your yes · 2 min ago</em>
                  </div>
                  <Icon name="chevronRight" size={13} />
                </div>
              </div>

              <div className="desk-note">
                did anyone<br />pay this?
                <i />
              </div>
              <div className="desk-receipt">
                <span className="eyebrow">Proof filed</span>
                <strong>RF-0291</strong>
                <em>HMAC-SHA256 · verified</em>
                <Icon name="checkCircle" size={18} />
              </div>
              <div className="desk-stamp">handled</div>
              <div className="desk-orbit orbit-one" aria-hidden="true" />
              <div className="desk-orbit orbit-two" aria-hidden="true" />
            </div>
          </div>

          <div className="hero-story-foot">
            <span className="hero-foot-label">Built for the operator who remembers everything for everyone</span>
            <div className="hero-marquee" aria-hidden="true">
              <span>RENEWALS</span><i />
              <span>CONTRACTORS</span><i />
              <span>FILINGS</span><i />
              <span>INVOICES</span><i />
              <span>PAYROLL</span><i />
              <span>THE VENDORS YOU PAY</span><i />
              <span>THE WORK THAT COMES BACK</span><i />
              <span>RENEWALS</span><i />
            </div>
            <a
              className="hero-scroll"
              href="#story"
              onClick={(event) => { event.preventDefault(); scrollToId("story"); }}
              aria-label="Scroll to the story"
            >
              <span>Scroll</span><Icon name="chevronDown" size={14} />
            </a>
          </div>
        </section>

        {/* ---------- Story intro ---------- */}
        <section className="story-intro section-wrap" id="story">
          <div className="story-intro-grid">
            <div data-reveal>
              <SectionTag>The leak</SectionTag>
              <h2>Nothing breaks all at once.<br /><em>It leaks.</em></h2>
            </div>
            <div className="story-intro-copy" data-reveal>
              <p>
                A vendor email arrives on a Tuesday. It joins a contract renewal, a tax
                deadline and an unsigned invoice in the same tired corner of your mind.
                Nothing is on fire. But something is always about to be.
              </p>
              <p>
                The problem was never memory. It was <strong>ownership</strong>. The moment a
                recurring thing has no owner, no backup and no proof, it becomes a small debt
                against your attention. Remindify is where those debts get paid.
              </p>
              <div className="story-equation">
                <div><span>01</span><strong>A letter</strong><em>arrives</em></div>
                <i>+</i>
                <div><span>02</span><strong>A decision</strong><em>waits</em></div>
                <i>+</i>
                <div><span>03</span><strong>A person</strong><em>almost remembers</em></div>
                <i>=</i>
                <div className="story-equation-result"><span>04</span><strong>A small</strong><em>emergency</em></div>
              </div>
            </div>
          </div>
          <div className="story-strip" data-reveal>
            <div><strong>One</strong><span>register for everything that returns</span></div>
            <div><strong>Two</strong><span>kinds of weight: duty and money</span></div>
            <div><strong>Three</strong><span>layers of calm: own it, do it, prove it</span></div>
            <div><strong>Zero</strong><span>balances held · PayPal settles direct</span></div>
          </div>
        </section>

        <TwoSidesSection onNavigate={onNavigate} user={user} />

        {/* ---------- Chapter one ---------- */}
        <section className="chapter chapter-one" id="chapter-one">
          <div className="section-wrap chapter-grid">
            <div className="chapter-copy" data-reveal>
              <span className="chapter-number">01</span>
              <SectionTag>Tuesday, 8:42pm</SectionTag>
              <h2>The letter arrives.<br /><em>Nobody owns it.</em></h2>
              <p>
                It is not that you forgot. It is that the letter landed in a life already
                full of things that need a decision. It sat on the counter. Then under a
                mug. Then somewhere in the space between “I’ll deal with it” and a fee.
              </p>
              <ul className="chapter-list">
                <li><span>01</span> Paste the letter, email or note. No forms.</li>
                <li><span>02</span> The model reads the date, amount, counterparty and recurrence.</li>
                <li><span>03</span> You confirm the owner, the backup and what proof counts.</li>
              </ul>
              <ArrowLink
                href={appHref("capture", user)}
                onClick={() => onNavigate(user ? "capture" : "login", user ? undefined : { next: "capture" })}
              >
                Try capture
              </ArrowLink>
            </div>

            <div className="chapter-visual letter-scene" data-reveal>
              <div className="paper letter-paper">
                <div className="letter-brand">NORTHLINE <span>INSURANCE</span></div>
                <div className="letter-meta">Policy renewal · 12 November 2026</div>
                <div className="letter-lines">
                  <i /><i /><i /><i /><i /><i /><i /><i />
                </div>
                <div className="letter-amount">$1,840.00</div>
                <div className="letter-stamp">FINAL NOTICE</div>
              </div>
              <div className="paper sticky-note">
                was this<br />paid??
                <i />
              </div>
              <svg className="hand-arrow" viewBox="0 0 140 90" aria-hidden="true">
                <path d="M6 8c28 2 54 17 68 36 8 12 10 24 9 34" />
                <path d="M72 68l12 12 14-9" />
              </svg>
              <div className="paper parsed-card">
                <div className="parsed-top">
                  <span className="eyebrow">Captured</span>
                  <span className="mini-live"><i /> structured</span>
                </div>
                <strong>Warehouse insurance</strong>
                <em>Northline · annual · $1,840</em>
                <div className="parsed-fields">
                  <span>Due <b>12 Nov</b></span>
                  <span>Owner <b>You</b></span>
                  <span>Backup <b>Remy</b></span>
                  <span>Proof <b>Broker confirmation</b></span>
                </div>
                <div className="parsed-confirm"><Icon name="check" size={13} /> Ready to schedule</div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Chapter two ---------- */}
        <section className="chapter chapter-two" id="chapter-two">
          <div className="section-wrap chapter-grid flip">
            <div className="chapter-copy" data-reveal>
              <span className="chapter-number">02</span>
              <SectionTag>The owner</SectionTag>
              <h2>A kept promise<br /><em>has anatomy.</em></h2>
              <p>
                “I’ll handle it” is not a system. An obligation needs one owner and one backup.
                It needs a risk score that knows the difference between a newsletter renewal
                and a filing deadline. It needs a proof requirement so “done” is not a feeling.
              </p>
              <ul className="chapter-list">
                <li><span>01</span> One owner, one backup. Never a group chat.</li>
                <li><span>02</span> Autonomy from notify to prepare to approve to autopilot.</li>
                <li><span>03</span> Evidence required before anything counts as complete.</li>
              </ul>
              <ArrowLink
                href={appHref("obligations", user)}
                onClick={() => onNavigate(user ? "obligations" : "login", user ? undefined : { next: "obligations" })}
              >
                See the register
              </ArrowLink>
            </div>

            <div className="chapter-visual anatomy-scene" data-reveal>
              <div className="anatomy-card">
                <div className="anatomy-top">
                  <span className="eyebrow">Obligation · ob_8f2</span>
                  <span className="status-pill"><i /> Active</span>
                </div>
                <h3>Warehouse insurance</h3>
                <div className="anatomy-meta">
                  <span>Due <b>12 Nov</b></span>
                  <span>Amount <b>$1,840</b></span>
                  <span>Cycle <b>Annual</b></span>
                </div>
                <div className="anatomy-row">
                  <span>Owner</span>
                  <strong>Solomon</strong>
                  <em>human</em>
                </div>
                <div className="anatomy-row">
                  <span>Backup</span>
                  <strong>Remy</strong>
                  <em>agent</em>
                </div>
                <div className="anatomy-row">
                  <span>Autonomy</span>
                  <div className="mini-seg">
                    <i className="on">Prepare</i><i>Approve</i><i>Auto</i>
                  </div>
                </div>
                <div className="anatomy-risk">
                  <span>Risk</span>
                  <div className="mini-risk"><i style={{ width: "72%" }} /></div>
                  <strong>72</strong>
                </div>
                <div className="anatomy-proof">
                  <Icon name="receipt" size={16} />
                  <div><span>Proof required</span><strong>Broker confirmation</strong></div>
                  <span className="anatomy-proof-state">pending</span>
                </div>
              </div>
              <div className="anatomy-callout callout-a"><span>One owner</span><i /></div>
              <div className="anatomy-callout callout-b"><span>Risk, not vibes</span><i /></div>
              <div className="anatomy-callout callout-c"><span>Proof before done</span><i /></div>
              <div className="anatomy-callout callout-d"><span>A real backup</span><i /></div>
            </div>
          </div>
        </section>

        {/* ---------- Chapter three ---------- */}
        <section className="chapter chapter-three" id="chapter-three">
          <div className="section-wrap chapter-grid">
            <div className="chapter-copy" data-reveal>
              <span className="chapter-number">03</span>
              <SectionTag>Remind, then do</SectionTag>
              <h2>The nudge is not<br /><em>the point.</em></h2>
              <p>
                Some things need a human. Some need software. Most need one of each.
                Build an agent for your own recurring work, or borrow one someone else
                already built. Either way it carries a passport: role, scopes, trust,
                an autonomy ceiling and a record of every run.
              </p>
              <ul className="chapter-list">
                <li><span>01</span> Do it yourself, with the next step and proof in one place.</li>
                <li><span>02</span> Delegate inside a ceiling you can read and change.</li>
                <li><span>03</span> Hire a specialist for one obligation, not your whole life.</li>
              </ul>
              <ArrowLink
                href={appHref("agents", user)}
                onClick={() => onNavigate(user ? "agents" : "login", user ? undefined : { next: "agents" })}
              >
                Meet the bench
              </ArrowLink>
            </div>

            <div className="chapter-visual bench-scene" data-reveal>
              <div className="bench-head">
                <span className="eyebrow">The bench · today</span>
                <span className="bench-status"><i /> 3 on shift</span>
              </div>
              <div className="passport passport-remy">
                <div className="passport-top"><span className="passport-mark">R</span><span className="passport-live"><i /> active</span></div>
                <strong>Remy</strong>
                <em>Operations agent</em>
                <div className="passport-stats">
                  <span>Trust <b>94</b></span>
                  <span>Runs <b>128</b></span>
                  <span>Ceiling <b>Approve</b></span>
                </div>
                <div className="passport-scopes"><i>obligations:read</i><i>drafts:write</i></div>
              </div>
              <div className="passport passport-ledger">
                <div className="passport-top"><span className="passport-mark">L</span><span className="passport-live"><i /> active</span></div>
                <strong>Ledger</strong>
                <em>Finance agent</em>
                <div className="passport-stats">
                  <span>Trust <b>91</b></span>
                  <span>Runs <b>76</b></span>
                  <span>Ceiling <b>Prepare</b></span>
                </div>
                <div className="passport-scopes"><i>payroll:read</i><i>filings:draft</i></div>
              </div>
              <div className="market-ticket">
                <div className="market-ticket-top">
                  <span className="eyebrow">Marketplace</span>
                  <span>$180</span>
                </div>
                <strong>Payroll filing</strong>
                <em>Human PA · within 48h · scoped access</em>
                <div className="market-ticket-foot"><span>Releases on proof</span><Icon name="arrowRight" size={14} /></div>
              </div>
              <div className="bench-line" aria-hidden="true" />
            </div>
          </div>

          <DelegationPaths onNavigate={onNavigate} user={user} />
        </section>

        <PacksSection onNavigate={onNavigate} user={user} />

        {/* ---------- Chapter four ---------- */}
        <section className="chapter chapter-four chapter-dark" id="chapter-four">
          <div className="section-wrap chapter-grid">
            <div className="chapter-copy light" data-reveal>
              <span className="chapter-number">04</span>
              <SectionTag light>The proof</SectionTag>
              <h2>The database can be wrong.<br /><em>The receipt can be checked.</em></h2>
              <p>
                Every completed obligation files a proof receipt: an HMAC-SHA256 signature
                by the server over the obligation id, the actor, the proof hash and the
                completion time. Before any money moves, the AI proof auditor reads the
                evidence and scores it against the amount, reference and date. Below 80%,
                it does not pass.
              </p>
              <p>
                A verified proof releases the payer's PayPal authorization hold. PayPal
                captures the hold, the 10% platform fee comes off the top, and the provider
                is paid the net to their PayPal email. A rejected proof leaves the hold
                untouched.
              </p>
              <div className="trust-pills">
                <span><Icon name="fingerprint" size={13} /> HMAC-SHA256 signed</span>
                <span><Icon name="shield" size={13} /> No custody</span>
                <span><Icon name="send" size={13} /> PayPal holds</span>
                <span><Icon name="sparkle" size={13} /> AI proof audit</span>
                <span><Icon name="receipt" size={13} /> 10% on settled work</span>
              </div>
              <ArrowLink
                light
                href={appHref("trust", user)}
                onClick={() => onNavigate(user ? "trust" : "login", user ? undefined : { next: "trust" })}
              >
                Open the trust layer
              </ArrowLink>
            </div>

            <div className="proof-scene" data-reveal>
              <div className="receipt-paper">
                <div className="receipt-head">
                  <span>PROOF RECEIPT</span>
                  <span>#RF-0291</span>
                </div>
                <h3>Warehouse insurance renewed</h3>
                <p>Obligation ob_8f2 · completed by Remy · 11 Nov 2026</p>
                <div className="receipt-rule" />
                <div className="receipt-row"><span>Proof</span><code>0x8f3a…c21b</code></div>
                <div className="receipt-row"><span>Evidence</span><code>0x41d0…8e77</code></div>
                <div className="receipt-row"><span>Auditor</span><strong>Gemini 2.5 Flash</strong></div>
                <div className="receipt-rule" />
                <div className="receipt-sign">
                  <span><Icon name="checkCircle" size={16} /> HMAC-SHA256 verified</span>
                  <code>82% confidence</code>
                </div>
                <div className="receipt-foot">remindify · proof, not promises</div>
              </div>
              <div className="chain-chip"><span>PayPal hold</span><i /><span>Proof release</span><em>10% fee</em></div>
              <div className="proof-note">The work happened.<br /><em>Here is the proof.</em></div>
              <div className="proof-orbit" aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* ---------- Chapter five ---------- */}
        <section className="chapter chapter-five" id="chapter-five">
          <div className="section-wrap chapter-grid">
            <div className="chapter-copy" data-reveal>
              <span className="chapter-number">05</span>
              <SectionTag>The other side</SectionTag>
              <h2>A quieter Monday.<br /><em>Not a busier dashboard.</em></h2>
              <p>
                The goal is not to check another app. It is to open one place, see that
                every vendor, filing and contractor handoff has an owner and a proof trail,
                and close the laptop. The agents keep working. The holds keep waiting on
                evidence. You get the part of your mind back.
              </p>
              <blockquote>
                “The point isn’t to do more.<br /><em>It’s to carry less.”</em>
              </blockquote>
              <ArrowLink href={routeHref(primary)} onClick={openPrimary}>
                {user ? "Open your register" : "Make your register"}
              </ArrowLink>
            </div>

            <div className="day-line" data-reveal>
              <div className="day-line-head"><span className="eyebrow">One ordinary Monday</span><span>after Remindify</span></div>
              <div className="day-event">
                <span className="day-time">07:15</span>
                <div><strong>Coffee. One glance.</strong><em>Three things need you. Not thirty.</em></div>
                <span className="day-icon tone-lime"><Icon name="today" size={16} /></span>
              </div>
              <div className="day-event">
                <span className="day-time">09:40</span>
                <div><strong>You approve a plan</strong><em>Remy drafts the broker email. Scope: read + draft.</em></div>
                <span className="day-icon tone-teal"><Icon name="bot" size={16} /></span>
              </div>
              <div className="day-event">
                <span className="day-time">11:05</span>
                <div><strong>It gets done</strong><em>Confirmation received. Proof requirement satisfied.</em></div>
                <span className="day-icon tone-amber"><Icon name="check" size={16} /></span>
              </div>
              <div className="day-event">
                <span className="day-time">14:20</span>
                <div><strong>A receipt is filed</strong><em>Signed with HMAC, filed with a proof hash. The auditor scored it.</em></div>
                <span className="day-icon tone-violet"><Icon name="receipt" size={16} /></span>
              </div>
              <div className="day-event">
                <span className="day-time">18:30</span>
                <div><strong>Laptop closed</strong><em>Next due item: 6 days away. It has a backup.</em></div>
                <span className="day-icon tone-ink"><Icon name="lock" size={16} /></span>
              </div>
              <div className="day-line-foot"><span><i /> 0 missed deadlines</span><span>0 apps checked after 6pm</span></div>
            </div>
          </div>
        </section>

        {/* ---------- Product ---------- */}
        <section className="product-section section-wrap" id="product">
          <div className="section-heading" data-reveal>
            <SectionTag>Inside the register</SectionTag>
            <h2>One calm surface for<br /><em>everything that returns.</em></h2>
            <p>
              Eight rooms. Two kinds of weight. One source of truth. Every action is
              attributed, every outcome has evidence, and nothing depends on somebody
              remembering.
            </p>
          </div>
          <div className="product-grid">
            {PRODUCTS.map((product, index) => (
              <a
                key={product.route}
                className="product-card"
                href={appHref(product.route, user)}
                data-reveal
                style={{ transitionDelay: `${index * 45}ms` }}
                onClick={spaClick(() => onNavigate(user ? product.route : "login", user ? undefined : { next: product.route }))}
              >
                <div className="product-card-top">
                  <span className={`product-icon tone-${product.tone}`}><Icon name={product.icon} size={18} /></span>
                  <span className="product-badge">{product.badge}</span>
                </div>
                <h3>{product.title}</h3>
                <p>{product.copy}</p>
                <span className="product-open">Open <Icon name="arrowUpRight" size={13} /></span>
              </a>
            ))}
          </div>
        </section>

        {/* ---------- Trust band ---------- */}
        <section className="trust-band" id="trust">
          <div className="section-wrap trust-band-grid">
            <div className="trust-band-copy" data-reveal>
              <SectionTag light>The trust layer</SectionTag>
              <h2>Proof is a feature.<br /><em>Not a promise.</em></h2>
              <p>
                PayPal in, PayPal out, and a proof gate in between. Remindify never holds a
                balance, a card or a key. A payer approves an authorization hold of up to
                29 days; a verified proof captures it, the 10% fee comes off, and the
                provider is paid the net to their PayPal email.
              </p>
              <ArrowLink light href={routeHref("security")} onClick={() => onNavigate("security")}>
                Read the security model
              </ArrowLink>
            </div>
            <div className="trust-cards" data-reveal>
              <article>
                <span className="trust-card-icon tone-violet"><Icon name="fingerprint" size={18} /></span>
                <strong>HMAC receipts</strong>
                <p>The server signs the obligation id, actor, proof hash and completion time. The receipt can be checked without trusting the screen.</p>
                <span className="trust-card-foot">every completion</span>
              </article>
              <article>
                <span className="trust-card-icon tone-lime"><Icon name="sparkle" size={18} /></span>
                <strong>AI proof audit</strong>
                <p>Gemini 2.5 Flash reads the evidence and scores it against amount, reference and date. Below 80% is not verified.</p>
                <span className="trust-card-foot">80% threshold</span>
              </article>
              <article>
                <span className="trust-card-icon tone-teal"><Icon name="send" size={18} /></span>
                <strong>PayPal holds</strong>
                <p>The payer approves a hold for up to 29 days. It is captured only when a proof is verified.</p>
                <span className="trust-card-foot">up to 29 days</span>
              </article>
              <article>
                <span className="trust-card-icon tone-amber"><Icon name="lock" size={18} /></span>
                <strong>No custody</strong>
                <p>Remindify never holds a balance, a card or a private key. PayPal settles between your account and the provider's.</p>
                <span className="trust-card-foot">non-custodial</span>
              </article>
            </div>
          </div>
        </section>

        <DeveloperSection onNavigate={onNavigate} user={user} />

        {/* ---------- Pricing preview ---------- */}
        <section className="pricing-preview section-wrap" id="pricing">
          <div className="section-heading split" data-reveal>
            <div>
              <SectionTag>Pricing, honestly</SectionTag>
              <h2>Start free.<br /><em>Grow when it earns it.</em></h2>
            </div>
            <p>
              No usage trap. No card to start. The platform fee is 10%, taken only when a
              verified proof lets the money settle. The register should feel cheap compared
              with the thing it stops you from missing.
            </p>
          </div>
          <div className="plan-row">
            {PLANS.map((plan) => (
              <article key={plan.id} className={`plan-card plan-${plan.tone}`} data-reveal>
                {plan.featured && <span className="plan-flag">Most useful</span>}
                <span className="eyebrow">{plan.name}</span>
                <div className="plan-price"><strong>{plan.price}</strong><em>{plan.cadence}</em></div>
                <p className="plan-line">{plan.line}</p>
                <ul>
                  {plan.features.slice(0, 4).map((feature) => <li key={feature}><Icon name="check" size={12} /> {feature}</li>)}
                </ul>
                <a
                  className={`btn ${plan.featured ? "btn-lime" : "btn-ghost"} btn-sm`}
                  href={routeHref(primary)}
                  onClick={spaClick(openPrimary)}
                >
                  {plan.cta} <Icon name="arrowRight" size={13} />
                </a>
              </article>
            ))}
          </div>
          <div className="pricing-preview-foot" data-reveal>
            <span>Preview pricing · billing opens after the private beta</span>
            <a href={routeHref("pricing")} onClick={spaClick(() => onNavigate("pricing"))}>
              Compare plans <Icon name="arrowRight" size={13} />
            </a>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="faq-section section-wrap" id="faq">
          <div className="faq-grid">
            <div className="faq-intro" data-reveal>
              <SectionTag>Questions</SectionTag>
              <h2>The short<br /><em>answers.</em></h2>
              <p>Still curious? Start the preview and ask us inside.</p>
              <a className="link-btn" href={routeHref("about")} onClick={spaClick(() => onNavigate("about"))}>
                Why we built this <Icon name="arrowRight" size={13} />
              </a>
            </div>
            <div className="faq-list" data-reveal>
              {FAQS.map((faq, index) => (
                <details key={faq.q} className="faq-item" open={index === 0}>
                  <summary>{faq.q}<Icon name="plus" size={15} /></summary>
                  <p>{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <CarryingSection onNavigate={onNavigate} user={user} />

        {/* ---------- Ending ---------- */}
        <section className="ending">
          <div className="ending-inner" data-reveal>
            <span className="ending-mark" aria-hidden="true">R</span>
            <SectionTag light>Your turn</SectionTag>
            <h2>You have enough to run.<br /><em>Let this run the remembering.</em></h2>
            <p>
              Open a register, put in the first thing that comes back — a vendor renewal,
              a filing, a contractor milestone — and give it an owner. It takes about
              ninety seconds. The relief lasts longer.
            </p>
            <div className="ending-actions">
              <a
                className="btn btn-lime btn-lg"
                href={routeHref(primary)}
                onClick={spaClick(openPrimary)}
              >
                {user ? "Open your register" : "Start your register"} <Icon name="arrowRight" size={16} />
              </a>
              <a
                className="btn btn-ghost-light btn-lg"
                href="#story"
                onClick={(event) => { event.preventDefault(); scrollToId("story"); }}
              >
                Read the story again
              </a>
            </div>
            <span className="ending-small">Free while in preview · PayPal only · 10% on settled work</span>
          </div>
        </section>
      </main>

      <PublicFooter onNavigate={onNavigate} user={user} />
    </div>
  );
}
