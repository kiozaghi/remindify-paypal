import { useEffect, useState } from "react";
import { useApp } from "../store";
import { Icon } from "../components/Icon";
import { Field, Monogram, Pill } from "../components/ui";
import { dateShort, download, moneyExact } from "../lib/format";
import type { SellerBooking, SellerPayout, SellerProfile } from "../types";

const STATUS: Record<string, { label: string; tone: string }> = {
  requested: { label: "New request", tone: "blue" },
  accepted: { label: "Accepted", tone: "violet" },
  in_progress: { label: "In progress", tone: "amber" },
  delivered: { label: "Delivered", tone: "teal" },
  completed: { label: "Settled", tone: "ink" },
  declined: { label: "Declined", tone: "coral" },
};

const EARNING: Record<string, { label: string; tone: string }> = {
  held: { label: "In hold", tone: "amber" },
  available: { label: "Available", tone: "teal" },
  processing: { label: "Payout pending", tone: "blue" },
  paid: { label: "Paid", tone: "ink" },
};

const METHODS = [
  { value: "none", label: "Not connected" },
  { value: "bank", label: "Bank account" },
  { value: "wallet", label: "Wallet" },
  { value: "usdc", label: "USDC" },
];

function dueText(booking: SellerBooking) {
  if (booking.status === "completed") return `Settled ${dateShort(booking.completed_at || booking.due_at)}`;
  if (booking.status === "delivered") return `Delivered ${dateShort(booking.proof?.submitted_at || booking.due_at)}`;
  if (booking.status === "declined") return "Returned to the buyer";
  if (booking.days_left < -1) return `${Math.abs(Math.round(booking.days_left))}d overdue`;
  if (booking.days_left < 0) return "Due today";
  if (booking.days_left < 1) return "Due tomorrow";
  return `Due ${dateShort(booking.due_at)}`;
}

function receiptText(booking: SellerBooking, profile: SellerProfile) {
  const receipt = booking.receipt;
  if (!receipt) return "";
  return [
    "REMINDIFY — PROOF RECEIPT",
    "",
    `Receipt      ${receipt.ref}`,
    `Issued       ${new Date(receipt.issued_at).toLocaleString("en-US")}`,
    `Seller       ${profile.name}`,
    `Buyer        ${receipt.buyer_name}`,
    `Booking      ${booking.ref} · ${receipt.title}`,
    "",
    `Gross        $${receipt.gross.toFixed(2)} ${receipt.currency}`,
    `Platform fee $${receipt.fee.toFixed(2)} (${(receipt.fee_bps / 100).toFixed(2)}%)`,
    `Net          $${receipt.net.toFixed(2)} ${receipt.currency}`,
    "",
    `Proof        ${booking.proof?.label || "Filed deliverable"}`,
    `Proof hash   ${receipt.proof_hash}`,
    "",
    "The proof hash covers the booking, the label, the note and the",
    "submission time. Keep this file with the deliverable.",
  ].join("\n");
}

function BookingRow({ booking }: { booking: SellerBooking }) {
  const { state, actions } = useApp();
  const [proofOpen, setProofOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [proof, setProof] = useState({ label: "", note: "", reference: "" });
  const status = STATUS[booking.status] || STATUS.requested;

  const act = async (action: "accept" | "decline" | "start" | "proof", payload: any = {}) => {
    setBusy(action);
    await actions.bookingAction(booking.id, action, payload);
    setBusy(null);
    if (action === "proof") {
      setProofOpen(false);
      setProof({ label: "", note: "", reference: "" });
    }
  };

  const earning = booking.earning;
  const releaseLabel = earning ? dateShort(earning.release_at) : null;

  return (
    <article className={`seller-booking status-${booking.status}`}>
      <div className="seller-booking-top">
        <Monogram name={booking.buyer_name} tone={booking.buyer_kind === "agent" ? "violet" : "coral"} size="sm" />
        <div className="seller-booking-id">
          <strong>{booking.title}</strong>
          <span>{booking.ref} · {booking.buyer_name} · {booking.buyer_workspace}</span>
        </div>
        <Pill tone={status.tone}>{status.label}</Pill>
        <span className="seller-booking-amount">{moneyExact(booking.amount)}</span>
      </div>

      <p className="seller-booking-brief">{booking.brief}</p>

      {booking.proof && (
        <div className="seller-proof">
          <span className="seller-proof-icon"><Icon name="receipt" size={15} /></span>
          <div className="seller-proof-copy">
            <strong>{booking.proof.label}</strong>
            <span>{booking.proof.note}</span>
            <em>{booking.proof.hash.slice(0, 20)}… · {dateShort(booking.proof.submitted_at)}</em>
          </div>
          <button
            className="btn btn-ghost btn-xs"
            disabled={!state}
            onClick={() => state && download(`${booking.receipt?.ref || booking.ref}.txt`, receiptText(booking, state.seller.profile))}
          >
            <Icon name="download" size={12} /> Receipt
          </button>
        </div>
      )}

      <div className="seller-booking-foot">
        <span className="seller-booking-due">
          <Icon name="calendar" size={12} /> {dueText(booking)}
          {earning?.status === "held" && releaseLabel && <> · clears {releaseLabel}</>}
          {earning?.status === "available" && <> · ready to withdraw</>}
          {earning?.status === "paid" && <> · paid</>}
        </span>
        <div className="seller-booking-actions">
          {booking.status === "requested" && (
            <>
              <button className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => act("decline")}>
                Decline
              </button>
              <button className="btn btn-ink btn-sm" disabled={busy !== null} onClick={() => act("accept")}>
                {busy === "accept" ? <span className="spinner" /> : <Icon name="check" size={13} />}
                Accept
              </button>
            </>
          )}
          {booking.status === "accepted" && (
            <button className="btn btn-ink btn-sm" disabled={busy !== null} onClick={() => act("start")}>
              <Icon name="bolt" size={13} /> Start work
            </button>
          )}
          {booking.status === "in_progress" && (
            <button className="btn btn-lime btn-sm" onClick={() => setProofOpen((open) => !open)}>
              <Icon name="file" size={13} /> {proofOpen ? "Close" : "File proof"}
            </button>
          )}
          {booking.status === "delivered" && (
            <span className="seller-booking-note">
              <Icon name="shield" size={12} /> Awaiting the hold to clear
            </span>
          )}
          {booking.status === "completed" && (
            <span className="seller-booking-note">
              <Icon name="check" size={12} /> Proof accepted
            </span>
          )}
        </div>
      </div>

      {proofOpen && (
        <div className="seller-proof-form">
          <Field label="What are you handing over?" hint="Shown on the receipt">
            <input
              value={proof.label}
              onChange={(event) => setProof((current) => ({ ...current, label: event.target.value }))}
              placeholder="Redlined agreements + memo"
              maxLength={90}
            />
          </Field>
          <Field label="Note">
            <textarea
              value={proof.note}
              onChange={(event) => setProof((current) => ({ ...current, note: event.target.value }))}
              placeholder="What was delivered, and anything the buyer should check."
              rows={2}
              maxLength={500}
            />
          </Field>
          <Field label="Reference" hint="Optional link to the deliverable">
            <input
              value={proof.reference}
              onChange={(event) => setProof((current) => ({ ...current, reference: event.target.value }))}
              placeholder="https://vault.example.com/…"
              maxLength={300}
            />
          </Field>
          <div className="seller-proof-submit">
            <span>Hashing the proof issues the receipt. Earnings wait out the hold.</span>
            <button
              className="btn btn-ink btn-sm"
              disabled={busy !== null || proof.label.trim().length < 2}
              onClick={() => act("proof", proof)}
            >
              {busy === "proof" ? <span className="spinner" /> : <Icon name="lock" size={13} />}
              File proof and issue receipt
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function PayoutRow({ payout }: { payout: SellerPayout }) {
  const { actions } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <div className="seller-payout-row">
      <div>
        <strong>{payout.ref}</strong>
        <span>{dateShort(payout.created_at)} · {payout.destination}</span>
      </div>
      <span className="seller-payout-amount">{moneyExact(payout.amount)}</span>
      {payout.status === "processing" ? (
        <button
          className="btn btn-ghost btn-xs"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await actions.confirmSellerPayout(payout.id);
            setBusy(false);
          }}
        >
          Confirm received
        </button>
      ) : (
        <Pill tone="ink">Paid</Pill>
      )}
    </div>
  );
}

function formFrom(profile: SellerProfile) {
  return {
    name: profile.name,
    headline: profile.headline,
    specialty: profile.specialty,
    description: profile.description,
    price: String(profile.price || ""),
    price_unit: profile.price_unit,
    sla: profile.sla,
    response_min: String(profile.response_min || ""),
    capabilities: profile.capabilities.join(", "),
    available: profile.available,
    payout: {
      method: profile.payout.method,
      label: profile.payout.label,
      account_last4: profile.payout.account_last4,
      currency: profile.payout.currency,
      country: profile.payout.country,
    },
  };
}

export default function Seller() {
  const { state, actions } = useApp();
  const [form, setForm] = useState(() => formFrom(state!.seller.profile));
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"work" | "ledger" | "profile">("work");

  useEffect(() => {
    if (state) setForm(formFrom(state.seller.profile));
  }, [state?.seller.profile.updated_at]);

  if (!state) return null;

  const { seller } = state;
  const { profile, summary, bookings, earnings, receipts, payouts, maintenance } = seller;

  const requests = bookings.filter((booking) => booking.status === "requested");
  const active = bookings.filter((booking) => ["accepted", "in_progress", "delivered"].includes(booking.status));
  const history = bookings.filter((booking) => ["completed", "declined"].includes(booking.status));

  const save = async (patch: any, toastKey: string) => {
    setBusy(toastKey);
    await actions.saveSeller(patch);
    setBusy(null);
  };

  const saveStorefront = () =>
    save(
      {
        name: form.name,
        headline: form.headline,
        specialty: form.specialty,
        description: form.description,
        price: Number(form.price) || 0,
        price_unit: form.price_unit,
        sla: form.sla,
        response_min: Number(form.response_min) || 60,
        capabilities: form.capabilities.split(",").map((item) => item.trim()).filter(Boolean),
        available: form.available,
      },
      "storefront"
    );

  const savePayout = () => save({ payout: form.payout }, "payout");

  const requestPayout = async () => {
    setBusy("withdraw");
    await actions.requestSellerPayout();
    setBusy(null);
  };

  const payoutReady = profile.payout.connected;

  return (
    <div className="view seller-view">
      <header className="view-head">
        <div>
          <span className="eyebrow">Seller desk</span>
          <h1>Your storefront, end to end.</h1>
          <p>
            Bookings in, proof out. Every delivery issues a receipt, every receipt waits out a hold,
            and the ledger shows exactly what is earned, held and paid.
          </p>
        </div>
        <div className="view-head-actions">
          <button className="btn btn-ghost" onClick={() => setTab("profile")}>
            <Icon name="briefcase" size={15} /> Edit storefront
          </button>
          <button className="btn btn-ink" onClick={() => setTab("ledger")}>
            <Icon name="wallet" size={15} /> Open ledger
          </button>
        </div>
      </header>

      <section className="seller-stats">
        <div className="seller-stat highlight">
          <span>Available to withdraw</span>
          <strong>{moneyExact(summary.available)}</strong>
          <em>
            {summary.available > 0
              ? "Cleared the hold"
              : summary.held > 0
                ? `Next release ${summary.next_release_at ? dateShort(summary.next_release_at) : "soon"}`
                : "Nothing cleared yet"}
          </em>
        </div>
        <div className="seller-stat">
          <span>In hold</span>
          <strong>{moneyExact(summary.held)}</strong>
          <em>{summary.held > 0 ? `${summary.hold_days}-day proof hold` : "No funds waiting"}</em>
        </div>
        <div className="seller-stat">
          <span>Paid out</span>
          <strong>{moneyExact(summary.paid)}</strong>
          <em>
            {summary.processing > 0
              ? `${moneyExact(summary.processing)} in transit`
              : summary.paid > 0
                ? "Settled to your account"
                : "No payouts yet"}
          </em>
        </div>
        <div className="seller-stat">
          <span>Open bookings</span>
          <strong>{summary.open_bookings}</strong>
          <em>{summary.requests} new · {summary.in_flight} in flight</em>
        </div>
      </section>

      <div className="seller-grid">
        <div className="seller-main">
          <div className="seller-tabs" role="tablist">
            {[
              { id: "work", label: `Work${requests.length ? ` · ${requests.length}` : ""}` },
              { id: "ledger", label: "Earnings" },
              { id: "profile", label: "Storefront" },
            ].map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={tab === item.id}
                className={tab === item.id ? "on" : ""}
                onClick={() => setTab(item.id as typeof tab)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "work" && (
            <>
              <section className="seller-panel">
                <header className="seller-panel-head">
                  <div>
                    <span className="eyebrow">Needs a decision</span>
                    <h2>New requests</h2>
                  </div>
                  <span className="seller-panel-meta">{requests.length} waiting</span>
                </header>
                {requests.length ? (
                  <div className="seller-booking-list">
                    {requests.map((booking) => <BookingRow key={booking.id} booking={booking} />)}
                  </div>
                ) : (
                  <div className="seller-empty">
                    <Icon name="inbox" size={18} />
                    <div>
                      <strong>No new requests</strong>
                      <span>The storefront is {profile.available ? "open" : "closed"}. Buyers can book you from the marketplace.</span>
                    </div>
                  </div>
                )}
              </section>

              <section className="seller-panel">
                <header className="seller-panel-head">
                  <div>
                    <span className="eyebrow">In motion</span>
                    <h2>Active work</h2>
                  </div>
                  <span className="seller-panel-meta">SLA {profile.sla} · replies in ~{profile.response_min}m</span>
                </header>
                {active.length ? (
                  <div className="seller-booking-list">
                    {active.map((booking) => <BookingRow key={booking.id} booking={booking} />)}
                  </div>
                ) : (
                  <div className="seller-empty">
                    <Icon name="bolt" size={18} />
                    <div>
                      <strong>Nothing in flight</strong>
                      <span>Accept a request and it moves here.</span>
                    </div>
                  </div>
                )}
              </section>

              {history.length > 0 && (
                <section className="seller-panel">
                  <header className="seller-panel-head">
                    <div>
                      <span className="eyebrow">Paper trail</span>
                      <h2>Finished work</h2>
                    </div>
                  </header>
                  <div className="seller-history">
                    {history.map((booking) => (
                      <div className="seller-history-row" key={booking.id}>
                        <span className={`seller-history-dot status-${booking.status}`} />
                        <div>
                          <strong>{booking.title}</strong>
                          <span>{booking.ref} · {booking.buyer_name}</span>
                        </div>
                        <span>{moneyExact(booking.amount)}</span>
                        <Pill tone={(STATUS[booking.status] || STATUS.completed).tone}>
                          {(STATUS[booking.status] || STATUS.completed).label}
                        </Pill>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {tab === "ledger" && (
            <>
              <section className="seller-panel">
                <header className="seller-panel-head">
                  <div>
                    <span className="eyebrow">Earnings</span>
                    <h2>The ledger</h2>
                  </div>
                  <span className="seller-panel-meta">
                    {summary.fee_bps / 100}% marketplace fee
                  </span>
                </header>
                {earnings.length ? (
                  <div className="seller-ledger">
                    <div className="seller-ledger-head">
                      <span>Work</span>
                      <span>Gross</span>
                      <span>Fee</span>
                      <span>Net</span>
                      <span>Status</span>
                    </div>
                    {earnings.map((entry) => {
                      const meta = EARNING[entry.status] || EARNING.held;
                      return (
                        <div className="seller-ledger-row" key={entry.id}>
                          <div>
                            <strong>{entry.description}</strong>
                            <span>
                              {dateShort(entry.created_at)}
                              {entry.status === "held" && ` · releases ${dateShort(entry.release_at)}`}
                              {entry.status === "paid" && entry.paid_at && ` · paid ${dateShort(entry.paid_at)}`}
                            </span>
                          </div>
                          <span>{moneyExact(entry.gross)}</span>
                          <span>−{moneyExact(entry.fee)}</span>
                          <strong>{moneyExact(entry.amount)}</strong>
                          <Pill tone={meta.tone}>{meta.label}</Pill>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="seller-empty">
                    <Icon name="wallet" size={18} />
                    <div>
                      <strong>No earnings yet</strong>
                      <span>File proof on a booking and the first entry appears here.</span>
                    </div>
                  </div>
                )}
              </section>

              <section className="seller-panel">
                <header className="seller-panel-head">
                  <div>
                    <span className="eyebrow">Receipts</span>
                    <h2>Proof of work</h2>
                  </div>
                  <span className="seller-panel-meta">{receipts.length} issued</span>
                </header>
                {receipts.length ? (
                  <div className="seller-receipts">
                    {receipts.map((receipt) => {
                      const booking = bookings.find((item) => item.id === receipt.booking_id);
                      return (
                        <div className="seller-receipt-row" key={receipt.id}>
                          <span className="seller-receipt-icon"><Icon name="receipt" size={15} /></span>
                          <div>
                            <strong>{receipt.ref}</strong>
                            <span>{receipt.title} · {receipt.buyer_name} · {dateShort(receipt.issued_at)}</span>
                          </div>
                          <span className="seller-receipt-net">{moneyExact(receipt.net)}</span>
                          <button
                            className="btn btn-ghost btn-xs"
                            disabled={!booking}
                            onClick={() => booking && download(`${receipt.ref}.txt`, receiptText(booking, profile))}
                          >
                            <Icon name="download" size={12} /> Save
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="seller-empty">
                    <Icon name="receipt" size={18} />
                    <div>
                      <strong>No receipts yet</strong>
                      <span>A receipt is issued the moment you file proof on a delivery.</span>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}

          {tab === "profile" && (
            <section className="seller-panel">
              <header className="seller-panel-head">
                <div>
                  <span className="eyebrow">Storefront</span>
                  <h2>What buyers see</h2>
                </div>
                <button
                  className={`seller-switch ${form.available ? "on" : ""}`}
                  onClick={() => setForm((current) => ({ ...current, available: !current.available }))}
                  aria-pressed={form.available}
                >
                  <i /> {form.available ? "Open to bookings" : "Closed"}
                </button>
              </header>

              <div className="seller-profile-card">
                <Monogram name={form.name || "Your studio"} tone={profile.kind === "agent" ? "violet" : "violet"} size="lg" />
                <div>
                  <strong>{form.name || "Your studio"}</strong>
                  <span>{form.headline || "Add a headline so buyers know the shape of the work."}</span>
                  <em>
                    {profile.rating ? `${profile.rating} rating · ` : ""}
                    {profile.jobs} jobs · {profile.verified ? "Verified" : "Unverified"}
                  </em>
                </div>
                <div className="seller-profile-price">
                  <strong>{moneyExact(Number(form.price) || 0)}</strong>
                  <span>{form.price_unit}</span>
                </div>
              </div>

              <div className="seller-form">
                <div className="seller-form-grid">
                  <Field label="Display name">
                    <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={60} />
                  </Field>
                  <Field label="Specialty">
                    <input value={form.specialty} onChange={(event) => setForm((current) => ({ ...current, specialty: event.target.value }))} placeholder="Ops & compliance" maxLength={60} />
                  </Field>
                  <Field label="Headline" className="span-2">
                    <input value={form.headline} onChange={(event) => setForm((current) => ({ ...current, headline: event.target.value }))} placeholder="Fractional ops and compliance for small teams" maxLength={90} />
                  </Field>
                  <Field label="Price" hint="USD">
                    <input type="number" min={0} value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
                  </Field>
                  <Field label="Unit">
                    <input value={form.price_unit} onChange={(event) => setForm((current) => ({ ...current, price_unit: event.target.value }))} placeholder="per hour" maxLength={24} />
                  </Field>
                  <Field label="Turnaround">
                    <input value={form.sla} onChange={(event) => setForm((current) => ({ ...current, sla: event.target.value }))} placeholder="24h" maxLength={24} />
                  </Field>
                  <Field label="Reply time" hint="minutes">
                    <input type="number" min={1} value={form.response_min} onChange={(event) => setForm((current) => ({ ...current, response_min: event.target.value }))} />
                  </Field>
                  <Field label="Capabilities" hint="comma separated" className="span-2">
                    <input value={form.capabilities} onChange={(event) => setForm((current) => ({ ...current, capabilities: event.target.value }))} placeholder="Licences, Contracts, Insurance" />
                  </Field>
                  <Field label="Description" className="span-2">
                    <textarea
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      rows={4}
                      maxLength={400}
                      placeholder="Scope, turnaround and what a clean handover looks like."
                    />
                  </Field>
                </div>
                <div className="seller-form-foot">
                  <span>Saving updates the profile buyers see in the marketplace.</span>
                  <button className="btn btn-ink btn-sm" onClick={saveStorefront} disabled={busy !== null}>
                    {busy === "storefront" ? <span className="spinner" /> : <Icon name="check" size={13} />}
                    Save storefront
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="seller-side">
          <section className={`seller-side-card payout ${payoutReady ? "" : "warn"}`}>
            <span className="eyebrow">Payouts</span>
            <h3>{moneyExact(summary.available)} ready</h3>
            <p>
              {payoutReady
                ? `${profile.payout.label || profile.payout.method} · ${profile.payout.account_last4 || "on file"}`
                : "Add a payout account to request a withdrawal."}
            </p>
            {payoutReady ? (
              <button
                className="btn btn-lime btn-sm"
                disabled={summary.available <= 0 || busy !== null}
                onClick={requestPayout}
              >
                {busy === "withdraw" ? <span className="spinner" /> : <Icon name="wallet" size={13} />}
                {summary.available > 0 ? `Request ${moneyExact(summary.available)}` : "Nothing cleared yet"}
              </button>
            ) : (
              <button className="btn btn-ink btn-sm" onClick={() => setTab("profile")}>
                <Icon name="wallet" size={13} /> Add payout details
              </button>
            )}
            <em className="seller-disclosure">
              Payouts are ledger entries. No provider is connected yet, so nothing moves automatically.
            </em>
            {payouts.length > 0 && (
              <div className="seller-payouts">
                {payouts.slice(0, 3).map((payout) => <PayoutRow key={payout.id} payout={payout} />)}
              </div>
            )}
          </section>

          <section className="seller-side-card">
            <span className="eyebrow">Maintenance</span>
            <h3>Keep the desk in order</h3>
            <div className="seller-maintenance">
              {maintenance.map((item) => (
                <div className={`seller-maint-row ${item.status}`} key={item.id}>
                  <span className="seller-maint-dot">
                    <Icon
                      name={item.status === "done" ? "check" : item.status === "warn" ? "alert" : "circle"}
                      size={11}
                    />
                  </span>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="seller-side-card quiet">
            <span className="eyebrow">Seller facts</span>
            <div className="seller-facts">
              <div><span>Gross sold</span><strong>{moneyExact(summary.gross)}</strong></div>
              <div><span>Fees</span><strong>{moneyExact(summary.fees)}</strong></div>
              <div><span>Delivered</span><strong>{summary.completed}</strong></div>
              <div><span>Hold</span><strong>{summary.hold_days} days</strong></div>
            </div>
            <em className="seller-disclosure">
              Receipts hash the booking, the proof label, the note and the submission time.
            </em>
          </section>
        </aside>
      </div>
    </div>
  );
}
