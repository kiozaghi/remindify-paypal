import { useState } from "react";
import { Icon } from "../components/Icon";
import type { AuthUser } from "../types";
import { routeHref } from "../lib/router";
import { ArrowLink, SectionTag, spaClick, type Navigate } from "./Chrome";
import { CARRYING, COMMUNITY_PACKS, DELEGATION, DEV_DOCS, SIDES } from "./data";

type SectionProps = {
  onNavigate: Navigate;
  user?: AuthUser | null;
};

/** The two kinds of weight: duty and money, side by side. */
export function TwoSidesSection({ onNavigate, user }: SectionProps) {
  const openRegister = () => onNavigate(user ? "obligations" : "login", user ? undefined : { next: "obligations" });

  return (
    <section className="two-sides section-wrap" id="two-sides">
      <div className="section-heading split" data-reveal>
        <div>
          <SectionTag>Two books, one operator</SectionTag>
          <h2>Some of it is vendors.<br /><em>Some of it is compliance.</em></h2>
        </div>
        <p>
          Most tools pick one. A finance app forgets the contractor handoff. A project
          board forgets the tax filing. The work is both, and it lands on the same
          operator: you.
        </p>
      </div>

      <div className="sides-grid">
        {SIDES.map((side) => (
          <article className={`side-card side-${side.key}`} key={side.key} data-reveal>
            <div className="side-head">
              <span className={`side-icon tone-${side.tone}`}><Icon name={side.icon} size={18} /></span>
              <span className="eyebrow">{side.eyebrow}</span>
            </div>
            <h3>{side.title}</h3>
            <p className="side-lede">{side.lede}</p>
            <div className="side-items">
              {side.items.map((item) => (
                <div className="side-item" key={item.title}>
                  <div>
                    <strong>{item.title}</strong>
                    <em>{item.meta}</em>
                  </div>
                  <span className={`side-due ${item.due === "auto" ? "auto" : ""}`}>{item.due}</span>
                </div>
              ))}
            </div>
            <p className="side-cost">{side.cost}</p>
          </article>
        ))}
      </div>

      <div className="sides-foot" data-reveal>
        <div>
          <strong>Two books of work.</strong>
          <span>One register, one owner, one proof trail.</span>
        </div>
        <ArrowLink href={user ? "/obligations" : routeHref("login", { next: "obligations" })} onClick={openRegister}>
          Open both books
        </ArrowLink>
      </div>
    </section>
  );
}

/** Three ways the work leaves your desk. Rendered inside the bench chapter. */
export function DelegationPaths({ onNavigate, user }: SectionProps) {
  const hire = () => onNavigate(user ? "market" : "login", user ? undefined : { next: "market" });
  const agent = () => onNavigate(user ? "agents" : "login", user ? undefined : { next: "agents" });

  return (
    <div className="do-paths section-wrap" data-reveal>
      <div className="do-paths-head">
        <SectionTag>Remind, then do</SectionTag>
        <h3>Three ways to get it off your desk.</h3>
        <p>
          A notification ends with you. The register can end with the thing being done —
          by you, by an agent you own, or by someone in the community.
        </p>
      </div>
      <div className="do-grid">
        {DELEGATION.map((path) => (
          <article className="do-card" key={path.step}>
            <div className="do-card-top">
              <span className={`do-icon tone-${path.tone}`}><Icon name={path.icon} size={17} /></span>
              <span className="do-step">{path.step}</span>
            </div>
            <h4>{path.title}</h4>
            <p>{path.copy}</p>
            <span className="do-tag">{path.tag}</span>
          </article>
        ))}
      </div>
      <div className="do-actions">
        <a
          className="btn btn-ink btn-sm"
          href={user ? "/market" : routeHref("login", { next: "market" })}
          onClick={spaClick(hire)}
        >
          Browse the marketplace <Icon name="arrowRight" size={14} />
        </a>
        <a
          className="btn btn-ghost btn-sm"
          href={user ? "/agents" : routeHref("login", { next: "agents" })}
          onClick={spaClick(agent)}
        >
          Build your own agent
        </a>
        <span className="do-note">Payment and escrow release only against accepted proof.</span>
      </div>
    </div>
  );
}

/** Community packs: a year of someone else's hard-won calendar. */
export function PacksSection({ onNavigate, user }: SectionProps) {
  const packsHref = user ? "/obligations?templates=1" : routeHref("login", { next: "obligations" });
  const openPacks = () =>
    onNavigate(user ? "obligations" : "login", user ? { templates: "1" } : { next: "obligations" });

  return (
    <section className="packs-section section-wrap" id="packs">
      <div className="section-heading split" data-reveal>
        <div>
          <SectionTag>Community packs</SectionTag>
          <h2>Somebody already mapped<br /><em>your kind of year.</em></h2>
        </div>
        <p>
          Tax filings. Vendor onboarding. Contractor milestones. Facilities inspections.
          Cross-border registrations. Import a pack built by someone who has already run
          that playbook, edit it, and make it yours. Every item arrives with an owner,
          a due date and a proof requirement.
        </p>
      </div>

      <div className="pack-grid">
        {COMMUNITY_PACKS.map((pack) => (
          <a
            className="pack-card"
            key={pack.id}
            href={packsHref}
            onClick={spaClick(openPacks)}
            data-reveal
          >
            <div className="pack-top">
              <span className={`pack-icon tone-${pack.tone}`}><Icon name={pack.icon} size={17} /></span>
              <span className={`pack-lens lens-${pack.lens}`}>{pack.lens === "life" ? "Duty" : "Money"}</span>
            </div>
            <h3>{pack.name}</h3>
            <p>{pack.tagline}</p>
            <div className="pack-meta">
              <span>{pack.count} obligations</span>
              <span>{pack.uses.toLocaleString("en-US")} imports</span>
            </div>
            <div className="pack-foot">
              <span>{pack.curator}</span>
              <span className="pack-proof"><Icon name="receipt" size={12} /> proof required</span>
            </div>
          </a>
        ))}
      </div>

      <div className="packs-foot" data-reveal>
        <div>
          <Icon name="layers" size={16} />
          <span>
            Packs are starting points, not lock-in. Remove what doesn’t fit, add what does,
            and publish your own for the next person.
          </span>
        </div>
        <a className="btn btn-ink btn-sm" href={packsHref} onClick={spaClick(openPacks)}>
          Browse the packs <Icon name="arrowRight" size={14} />
        </a>
      </div>
    </section>
  );
}

/** A small self-audit. The emotional payoff is the count. */
export function CarryingSection({ onNavigate, user }: SectionProps) {
  const [checked, setChecked] = useState<string[]>([]);
  const count = checked.length;
  const lifeCount = CARRYING.filter((item) => checked.includes(item.label) && item.side === "life").length;
  const moneyCount = count - lifeCount;

  const verdict =
    count === 0
      ? "Start with the ones you already know. Everyone has a few."
      : count <= 2
        ? "Two things. That’s already somebody’s full-time job, done for free."
        : count <= 5
          ? "That’s a second job. You’re just not being paid for it."
          : "That’s not forgetfulness. That’s too much surface area for one person.";

  const primary = user ? "today" : "signup";

  return (
    <section className="carrying-section" id="carrying">
      <div className="section-wrap carrying-grid">
        <div className="carrying-copy" data-reveal>
          <SectionTag>Before you start</SectionTag>
          <h2>How much are you<br /><em>already carrying?</em></h2>
          <p>
            Not a personality quiz. A tally. Tick the things you are the only person
            holding, and watch what it adds up to.
          </p>
          <div className="carrying-count">
            <strong>{String(count).padStart(2, "0")}</strong>
            <span>{count === 1 ? "thing your operation is holding" : "things your operation is holding"}</span>
          </div>
          {count > 0 && (
            <div className="carrying-split">
              <span className="life">{lifeCount} duty</span>
              <span className="money">{moneyCount} money</span>
            </div>
          )}
          <p className="carrying-verdict">{verdict}</p>
          <a
            className="btn btn-ink btn-lg"
            href={routeHref(primary)}
            onClick={spaClick(() => onNavigate(primary))}
          >
            Put it down here <Icon name="arrowRight" size={16} />
          </a>
          <span className="carrying-small">Free while in preview · no card · about ninety seconds</span>
        </div>

        <div className="carrying-list" data-reveal role="group" aria-label="Things you might be carrying">
          {CARRYING.map((item) => {
            const on = checked.includes(item.label);
            return (
              <label className={`carrying-item ${on ? "on" : ""}`} key={item.label}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    setChecked((current) =>
                      current.includes(item.label)
                        ? current.filter((label) => label !== item.label)
                        : [...current, item.label]
                    )
                  }
                />
                <span className="carrying-box"><Icon name="check" size={11} /></span>
                <span className="carrying-label">{item.label}</span>
                <i className={`carrying-side ${item.side}`} aria-hidden="true" />
              </label>
            );
          })}
          <div className="carrying-legend" aria-hidden="true">
            <span><i className="life" /> duty</span>
            <span><i className="money" /> money</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The register as a surface builders can call, with the docs as the next step. */
export function DeveloperSection({ onNavigate }: SectionProps) {
  const open = (slug?: string) => onNavigate("docs", slug ? { slug } : undefined);

  return (
    <section className="dev-section section-wrap" id="developers">
      <div className="dev-grid">
        <div className="dev-copy" data-reveal>
          <SectionTag>For developers</SectionTag>
          <h2>The register is<br /><em>addressable.</em></h2>
          <p>
            Issue a scoped machine key and read or complete obligations over REST or MCP.
            Agents act through an HTTPS endpoint you control, with signed requests and
            durable retries. Money stays human: PayPal routes accept a session, never a
            machine key.
          </p>
          <div className="dev-actions">
            <a className="btn btn-ink btn-sm" href="/docs" onClick={spaClick(() => open())}>
              Open the docs <Icon name="arrowRight" size={14} />
            </a>
            <a className="link-btn" href="/docs/quickstart" onClick={spaClick(() => open("quickstart"))}>
              Quickstart <Icon name="arrowRight" size={12} />
            </a>
          </div>
        </div>

        <div className="dev-links" data-reveal>
          {DEV_DOCS.map((doc) => (
            <a
              key={doc.slug}
              className="dev-link"
              href={`/docs/${doc.slug}`}
              onClick={spaClick(() => open(doc.slug))}
            >
              <span className={`dev-link-icon tone-${doc.tone}`}><Icon name={doc.icon} size={16} /></span>
              <span className="dev-link-text">
                <span className="dev-link-kind">{doc.kind}</span>
                <strong>{doc.title}</strong>
                <em>{doc.copy}</em>
              </span>
              <Icon name="arrowRight" size={13} className="dev-link-arrow" />
            </a>
          ))}
          <div className="dev-links-foot">
            <Icon name="lock" size={13} />
            <span>Keys are scoped, expiring and metered. Payment routes stay session-only by design.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
