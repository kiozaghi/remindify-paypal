import { useMemo, useState } from "react";
import { useApp } from "../store";
import { Icon } from "../components/Icon";
import { Monogram, Segmented } from "../components/ui";
import { money, timeAgo } from "../lib/format";

export default function Market() {
  const { state, openHire, nowMs } = useApp();
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState("rating");
  if (!state) return null;

  const providers = useMemo(() => {
    let list = [...state.providers];
    if (kind !== "all") list = list.filter((p) => p.kind === kind);
    list.sort((a, b) =>
      sort === "price" ? a.price - b.price : sort === "speed" ? a.response_min - b.response_min : b.rating - a.rating
    );
    return list;
  }, [state.providers, kind, sort]);

  const bookings = state.obligations.filter((o) => o.marketplace);

  return (
    <div className="view market-view">
      <header className="view-head">
        <div>
          <span className="eyebrow">The bench, extended</span>
          <h1>Marketplace</h1>
          <p>Hire a human or an agent for the thing you keep not doing. Fixed price. Proof of done.</p>
        </div>
        <div className="view-head-actions">
          <button className="btn btn-ghost" onClick={() => document.getElementById("providers")?.scrollIntoView({ behavior: "smooth" })}>
            <Icon name="search" size={16} /> Browse the bench
          </button>
        </div>
      </header>

      <section className="market-hero">
        <div className="market-hero-copy">
          <span className="eyebrow light">Humans &amp; agents, side by side</span>
          <h2>The right hands, <em>not just more hands.</em></h2>
          <p>
            Some jobs need a person in a queue. Some need an API at 2am. Remindify routes each obligation to
            whichever is cheaper, faster and safer — then holds both to the same proof standard.
          </p>
        </div>
        <div className="market-hero-stats">
          <div><strong>{state.providers.length}</strong><span>vetted providers</span></div>
          <div><strong>4.8</strong><span>average rating</span></div>
          <div><strong>98.1%</strong><span>proof accepted</span></div>
        </div>
      </section>

      <div className="market-compare">
        <div className="compare-card">
          <span className="compare-icon tone-violet"><Icon name="bot" size={18} /></span>
          <div>
            <h3>Pick an agent when…</h3>
            <p>It's digital, repeatable and well-defined. Filings, renewals, cancellations, monitoring. Agents are instant, cheap and never forget.</p>
          </div>
        </div>
        <div className="compare-card">
          <span className="compare-icon tone-coral"><Icon name="users" size={18} /></span>
          <div>
            <h3>Pick a human when…</h3>
            <p>It needs a body, a signature or a judgement call. Immigration queues, notaries, negotiations, things that break.</p>
          </div>
        </div>
      </div>

      {bookings.length > 0 && (
        <section className="bookings">
          <header className="section-head compact">
            <div><span className="eyebrow">Your bookings</span><h2>Work in motion</h2></div>
          </header>
          <div className="booking-list">
            {bookings.map((b) => (
              <div className="booking-row" key={b.id}>
                <Monogram name={b.marketplace.provider_name} tone={b.marketplace.kind === "agent" ? "violet" : "coral"} kind={b.marketplace.kind} size="sm" />
                <div className="booking-main">
                  <strong>{b.title}</strong>
                  <span>{b.marketplace.provider_name} · booked {timeAgo(b.marketplace.booked_at, nowMs)}</span>
                </div>
                <span className="booking-price">{money(b.marketplace.price)}</span>
                <span className="booking-status"><i /> {b.marketplace.status}</span>
                <span className="booking-proof"><Icon name="receipt" size={12} /> proof required</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="market-toolbar" id="providers">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: `All ${state.providers.length}` },
            { value: "agent", label: "Agents" },
            { value: "human", label: "Humans" },
          ]}
        />
        <label className="sort-select">
          <Icon name="filter" size={14} />
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="rating">Sort · rating</option>
            <option value="price">Sort · price</option>
            <option value="speed">Sort · response time</option>
          </select>
        </label>
      </div>

      <div className="provider-grid">
        {providers.map((p) => (
          <article className="provider-card" key={p.id}>
            <div className="provider-top">
              <Monogram name={p.name} tone={p.tone} kind={p.kind} size="md" />
              <div className="provider-id">
                <div className="provider-name">
                  <h3>{p.name}</h3>
                  {p.verified && <span className="verified"><Icon name="check" size={9} /> verified</span>}
                </div>
                <span>{p.specialty}</span>
              </div>
              <span className={`provider-kind ${p.kind}`}>
                <Icon name={p.kind === "agent" ? "bot" : "users"} size={11} /> {p.kind}
              </span>
            </div>

            <p className="provider-desc">{p.description}</p>

            <div className="provider-caps">
              {p.capabilities.map((c) => <span key={c}>{c}</span>)}
            </div>

            <div className="provider-meta">
              <span><Icon name="target" size={13} /> {p.rating} <em>({p.jobs.toLocaleString()})</em></span>
              <span><Icon name="clock" size={13} /> {p.sla}</span>
              <span><Icon name="bolt" size={13} /> ~{p.response_min}m reply</span>
            </div>

            <footer className="provider-foot">
              <div className="provider-price">
                <strong>${p.price}</strong><em>{p.price_unit}</em>
              </div>
              <button className="btn btn-ink btn-sm" onClick={() => openHire(p.id)}>
                Delegate <Icon name="arrowRight" size={14} />
              </button>
            </footer>
          </article>
        ))}
      </div>

      <section className="market-footnote">
        <div>
          <span className="eyebrow">Trust layer</span>
          <h3>Escrowed. Scoped. Reversible.</h3>
        </div>
        <div className="trust-points">
          <span><Icon name="lock" size={14} /> Funds release on accepted proof</span>
          <span><Icon name="shield" size={14} /> Scoped, time-boxed access</span>
          <span><Icon name="refresh" size={14} /> Dispute + replacement bench</span>
          <span><Icon name="file" size={14} /> Everything in the audit log</span>
        </div>
      </section>
    </div>
  );
}
