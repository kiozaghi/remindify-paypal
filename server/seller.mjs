// Seller desk.
//
// A workspace can also sell work on the marketplace. This module owns the
// storefront profile, incoming bookings, proof of delivery and the earnings
// ledger. Money is recorded, never moved: payouts stop at the ledger until a
// payout provider is connected, and every entry waits out a hold before it can
// be requested.
import { createHash, randomBytes } from "node:crypto";
import { getMeta, loadAll, put } from "./db.mjs";

const DAY = 86400000;

function envInt(name, fallback, min, max) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export const MARKETPLACE_FEE_BPS = envInt("MARKETPLACE_FEE_BPS", 800, 0, 3000);
export const SELLER_HOLD_DAYS = envInt("SELLER_HOLD_DAYS", 3, 0, 30);

const BOOKING_ORDER = {
  requested: 0,
  accepted: 1,
  in_progress: 2,
  delivered: 3,
  completed: 4,
  declined: 5,
};

const PAYOUT_METHODS = ["none", "bank", "wallet", "usdc", "paypal"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const uid = (prefix) => `${prefix}_${randomBytes(5).toString("hex")}`;
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

function text(value, max) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function noteEvent({ actor = "You", verb, object, detail, kind = "human" }) {
  put("events", {
    id: uid("ev"),
    actor_type: "human",
    actor_id: null,
    actor,
    verb,
    object,
    detail,
    kind,
    created_at: new Date().toISOString(),
  });
}

function payoutDestination(payout) {
  if (!payout?.connected) return "";
  return payout.method === "paypal"
    ? `PayPal · ${payout.paypal_email || "email on file"}`
    : `${payout.label || payout.method} · ${payout.account_last4 || "on file"}`;
}

function defaultPayout() {
  return {
    method: "none",
    label: "",
    account_last4: "",
    paypal_email: "",
    currency: "USD",
    country: getMeta("country", "ET") || "ET",
    connected: false,
    updated_at: null,
  };
}

function defaultProfile(now) {
  return {
    id: "seller_profile",
    name: getMeta("workspace", "Your studio") || "Your studio",
    headline: "",
    kind: "human",
    specialty: "",
    description: "",
    rating: null,
    jobs: 0,
    price: 0,
    price_unit: "per hour",
    sla: "48h",
    response_min: 120,
    capabilities: [],
    available: true,
    verified: false,
    payout: defaultPayout(),
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
  };
}

function loadSeller(now) {
  const data = loadAll();
  let profile = data.seller_profile[0] || null;
  if (!profile) {
    profile = defaultProfile(now);
    put("seller_profile", profile);
    data.seller_profile = [profile];
  }
  return { data, profile };
}

export function updateSellerProfile(patch, now = Date.now()) {
  const { data, profile } = loadSeller(now);
  const next = { ...profile };

  if (patch.name !== undefined) next.name = text(patch.name, 60) || next.name;
  if (patch.headline !== undefined) next.headline = text(patch.headline, 90);
  if (patch.specialty !== undefined) next.specialty = text(patch.specialty, 60);
  if (patch.kind !== undefined && ["human", "agent"].includes(patch.kind)) next.kind = patch.kind;
  if (patch.description !== undefined) next.description = text(patch.description, 400);
  if (patch.price !== undefined) next.price = Math.min(100_000, Math.max(0, Number(patch.price) || 0));
  if (patch.price_unit !== undefined) next.price_unit = text(patch.price_unit, 24) || "per hour";
  if (patch.sla !== undefined) next.sla = text(patch.sla, 24) || "48h";
  if (patch.response_min !== undefined) {
    next.response_min = Math.min(10_080, Math.max(1, Math.round(Number(patch.response_min) || 60)));
  }
  if (patch.available !== undefined) next.available = Boolean(patch.available);
  if (patch.capabilities !== undefined) {
    next.capabilities = Array.isArray(patch.capabilities)
      ? [...new Set(patch.capabilities.map((item) => text(item, 28)).filter(Boolean))].slice(0, 8)
      : next.capabilities;
  }
  if (patch.payout) {
    const method = PAYOUT_METHODS.includes(patch.payout.method) ? patch.payout.method : profile.payout.method;
    const label = text(patch.payout.label, 80);
    const last4 = String(patch.payout.account_last4 ?? "").replace(/\D/g, "").slice(-4);
    const currency = (text(patch.payout.currency, 4) || profile.payout.currency || "USD").toUpperCase();
    const country = (text(patch.payout.country, 2) || profile.payout.country || "ET").toUpperCase();
    const emailIn = text(patch.payout.paypal_email ?? patch.payout.email, 120).toLowerCase();
    const paypalEmail = EMAIL_RE.test(emailIn)
      ? emailIn
      : profile.payout.paypal_email || "";
    next.payout = {
      method,
      label,
      account_last4: last4,
      paypal_email: paypalEmail,
      currency,
      country,
      connected: method === "paypal"
        ? Boolean(paypalEmail)
        : method !== "none" && Boolean(label || last4),
      updated_at: new Date(now).toISOString(),
    };
  }

  next.updated_at = new Date(now).toISOString();
  put("seller_profile", next);
  data.seller_profile = [next];

  const changedPayout = Boolean(patch.payout);
  noteEvent({
    verb: changedPayout ? "updated payout details" : "updated the storefront",
    object: next.name,
    detail: changedPayout
      ? next.payout.connected
        ? payoutDestination(next.payout)
        : "Payout destination removed"
      : next.headline || "Profile details saved",
  });
  return next;
}

function bookingFor(data, id) {
  return data.bookings.find((booking) => booking.id === id) || null;
}

function moveBooking(id, from, to, now, patch = {}) {
  const { data } = loadSeller(now);
  const booking = bookingFor(data, id);
  if (!booking) return { ok: false, status: 404, error: "booking_not_found" };
  if (!from.includes(booking.status)) {
    return {
      ok: false,
      status: 409,
      error: "booking_state",
      message: `This booking is ${booking.status.replace("_", " ")}, not ${to.replace("_", " ")}-ready.`,
    };
  }
  const next = { ...booking, ...patch, status: to };
  put("bookings", next);
  return { ok: true, booking: next };
}

export function acceptBooking(id, now = Date.now()) {
  const result = moveBooking(id, ["requested"], "accepted", now, {
    accepted_at: new Date(now).toISOString(),
  });
  if (result.ok) {
    noteEvent({
      verb: "accepted a booking",
      object: result.booking.title,
      detail: `${result.booking.buyer_name} · ${result.booking.ref}`,
    });
  }
  return result;
}

export function declineBooking(id, reason, now = Date.now()) {
  const result = moveBooking(id, ["requested"], "declined", now, {
    decline_reason: text(reason, 200) || "Not a fit for this studio.",
    declined_at: new Date(now).toISOString(),
  });
  if (result.ok) {
    noteEvent({
      verb: "declined a booking",
      object: result.booking.title,
      detail: result.booking.decline_reason,
    });
  }
  return result;
}

export function startBooking(id, now = Date.now()) {
  const result = moveBooking(id, ["accepted"], "in_progress", now, {
    started_at: new Date(now).toISOString(),
  });
  if (result.ok) {
    noteEvent({
      verb: "started the work",
      object: result.booking.title,
      detail: `Due ${new Date(result.booking.due_at).toDateString()}`,
    });
  }
  return result;
}

export function submitBookingProof(id, input = {}, now = Date.now()) {
  const label = text(input.label, 90);
  if (label.length < 2) {
    return { ok: false, status: 422, error: "proof_label_required", message: "Name the proof you are filing." };
  }
  const { data } = loadSeller(now);
  const booking = bookingFor(data, id);
  if (!booking) return { ok: false, status: 404, error: "booking_not_found" };
  if (!["accepted", "in_progress"].includes(booking.status)) {
    return {
      ok: false,
      status: 409,
      error: "booking_state",
      message: "Proof can be filed only on an accepted or in-progress booking.",
    };
  }

  const note = text(input.note, 500);
  const reference = text(input.reference, 300);
  const submittedAt = new Date(now).toISOString();
  const proofHash = createHash("sha256")
    .update([booking.id, label, note, reference, submittedAt].join("|"))
    .digest("hex");

  const gross = round2(booking.amount);
  const fee = round2((gross * MARKETPLACE_FEE_BPS) / 10_000);
  const net = round2(gross - fee);
  const stamp = String(now).slice(-6);

  const receipt = {
    id: `rc_${stamp}`,
    ref: `RC-${new Date(now).getUTCFullYear()}-${stamp}`,
    booking_id: booking.id,
    buyer_name: booking.buyer_name,
    title: booking.title,
    gross,
    fee,
    net,
    currency: booking.currency || "USD",
    fee_bps: MARKETPLACE_FEE_BPS,
    proof_hash: proofHash,
    issued_at: submittedAt,
    status: "issued",
  };
  const earning = {
    id: `er_${stamp}`,
    booking_id: booking.id,
    receipt_id: receipt.id,
    description: booking.title,
    gross,
    fee,
    amount: net,
    currency: booking.currency || "USD",
    status: "held",
    release_at: new Date(now + SELLER_HOLD_DAYS * DAY).toISOString(),
    created_at: submittedAt,
    released_at: null,
    paid_at: null,
    payout_id: null,
  };

  const next = {
    ...booking,
    status: "delivered",
    delivered_at: submittedAt,
    proof: { label, note, reference, hash: proofHash, submitted_at: submittedAt },
    receipt_id: receipt.id,
    earning_id: earning.id,
  };

  put("bookings", next);
  put("seller_receipts", receipt);
  put("earnings", earning);
  noteEvent({
    verb: "filed proof of delivery",
    object: booking.title,
    detail: `${label} · ${proofHash.slice(0, 12)}… · $${net.toFixed(2)} after fees`,
    kind: "proof",
  });

  return { ok: true, booking: next, receipt, earning };
}

export function requestPayout(now = Date.now()) {
  const { data, profile } = loadSeller(now);
  if (!profile.payout?.connected) {
    return {
      ok: false,
      status: 409,
      error: "payout_method_required",
      message: "Add a payout account before requesting a payout.",
    };
  }
  const available = data.earnings.filter((entry) => entry.status === "available");
  if (!available.length) {
    return {
      ok: false,
      status: 422,
      error: "nothing_available",
      message: "Nothing has cleared the hold yet.",
    };
  }
  const amount = round2(available.reduce((sum, entry) => sum + entry.amount, 0));
  const stamp = String(now).slice(-6);
  const destination = payoutDestination(profile.payout);
  const payout = {
    id: `po_${stamp}`,
    ref: `PO-${new Date(now).getUTCFullYear()}-${stamp}`,
    amount,
    currency: profile.payout.currency || "USD",
    method: profile.payout.method,
    destination,
    status: "processing",
    entry_ids: available.map((entry) => entry.id),
    created_at: new Date(now).toISOString(),
    paid_at: null,
    note: profile.payout.method === "paypal"
      ? "Payout recorded in the ledger. Send it with PayPal to move funds."
      : "Payout recorded in the ledger. Connect a payout provider to move funds.",
  };

  for (const entry of available) {
    put("earnings", {
      ...entry,
      status: "processing",
      payout_id: payout.id,
      requested_at: payout.created_at,
    });
  }
  put("payouts", payout);
  noteEvent({
    verb: "requested a payout",
    object: payout.ref,
    detail: `$${amount.toFixed(2)} to ${payout.destination}`,
    kind: "money",
  });
  return { ok: true, payout };
}

export function confirmPayoutReceived(id, now = Date.now()) {
  const { data } = loadSeller(now);
  const payout = data.payouts.find((item) => item.id === id);
  if (!payout) return { ok: false, status: 404, error: "payout_not_found" };
  if (payout.status !== "processing") {
    return { ok: false, status: 409, error: "payout_state", message: "This payout is already settled." };
  }
  const paidAt = new Date(now).toISOString();
  const next = { ...payout, status: "paid", paid_at: paidAt };
  put("payouts", next);
  for (const entry of data.earnings) {
    if (entry.payout_id !== payout.id) continue;
    put("earnings", { ...entry, status: "paid", paid_at: paidAt });
  }
  noteEvent({
    verb: "confirmed a payout arrived",
    object: payout.ref,
    detail: `$${payout.amount.toFixed(2)} · ${payout.destination}`,
    kind: "money",
  });
  return { ok: true, payout: next };
}

function maintenanceFor(profile, bookings, now, hasAvailable) {
  const items = [];
  const payoutReady = Boolean(profile.payout?.connected);
  items.push({
    id: "payout",
    label: "Payout account",
    detail: payoutReady
      ? payoutDestination(profile.payout)
      : "Earnings stay in the ledger until a destination is on file.",
    status: payoutReady ? "done" : "warn",
  });
  items.push({
    id: "description",
    label: "Storefront description",
    detail: profile.description.length >= 80
      ? "Buyers can tell what you do before they book."
      : "Add a few sentences on scope, turnaround and what a handover looks like.",
    status: profile.description.length >= 80 ? "done" : "todo",
  });
  items.push({
    id: "capabilities",
    label: "Capability tags",
    detail: profile.capabilities.length >= 3
      ? profile.capabilities.join(" · ")
      : "Three tags or more is what buyers search on.",
    status: profile.capabilities.length >= 3 ? "done" : "todo",
  });
  items.push({
    id: "availability",
    label: "Storefront open",
    detail: profile.available ? "New booking requests can reach you." : "The storefront is closed to new requests.",
    status: profile.available ? "done" : "warn",
  });

  const overdue = bookings.filter(
    (booking) => ["accepted", "in_progress"].includes(booking.status) && new Date(booking.due_at).getTime() < now
  );
  if (overdue.length) {
    items.push({
      id: "overdue",
      label: `${overdue.length} ${overdue.length === 1 ? "booking is" : "bookings are"} past due`,
      detail: overdue.map((booking) => booking.title).join(" · "),
      status: "warn",
    });
  }
  if (hasAvailable) {
    items.push({
      id: "payout_ready",
      label: "Earnings ready to withdraw",
      detail: "Cleared earnings are sitting in the ledger.",
      status: "todo",
    });
  }
  return items;
}

export function sellerSnapshot(now = Date.now()) {
  const { data, profile } = loadSeller(now);

  // Holds mature on the virtual clock, which the demo advance control moves.
  const completed = new Map();
  for (const entry of data.earnings) {
    if (entry.status !== "held") continue;
    if (new Date(entry.release_at).getTime() > now) continue;
    const releasedAt = new Date(now).toISOString();
    put("earnings", { ...entry, status: "available", released_at: releasedAt });
    entry.status = "available";
    entry.released_at = releasedAt;
    completed.set(entry.booking_id, releasedAt);
  }
  for (const booking of data.bookings) {
    if (booking.status !== "delivered") continue;
    const completedAt = completed.get(booking.id);
    if (!completedAt) continue;
    const next = { ...booking, status: "completed", completed_at: completedAt };
    put("bookings", next);
    booking.status = next.status;
    booking.completed_at = completedAt;
  }

  const receiptsById = Object.fromEntries(data.seller_receipts.map((item) => [item.id, item]));
  const earningsByBooking = Object.fromEntries(data.earnings.map((item) => [item.booking_id, item]));
  const bookings = data.bookings
    .map((booking) => ({
      ...booking,
      earning: earningsByBooking[booking.id] || null,
      receipt: receiptsById[booking.receipt_id] || null,
      days_left: Math.round(((new Date(booking.due_at).getTime() - now) / DAY) * 10) / 10,
    }))
    .sort((a, b) => {
      const statusDelta = (BOOKING_ORDER[a.status] ?? 9) - (BOOKING_ORDER[b.status] ?? 9);
      if (statusDelta) return statusDelta;
      return new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime();
    });

  const sum = (status) =>
    round2(data.earnings.filter((entry) => entry.status === status).reduce((total, entry) => total + entry.amount, 0));
  const gross = round2(data.earnings.reduce((total, entry) => total + entry.gross, 0));
  const fees = round2(data.earnings.reduce((total, entry) => total + entry.fee, 0));

  const receipts = [...data.seller_receipts].sort(
    (a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime()
  );
  const payouts = [...data.payouts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const open = bookings.filter((booking) => ["requested", "accepted", "in_progress", "delivered"].includes(booking.status));
  const completedBookings = bookings.filter((booking) => booking.status === "completed");
  const declined = bookings.filter((booking) => booking.status === "declined");

  const summary = {
    currency: profile.payout?.currency || "USD",
    gross,
    fees,
    net: round2(gross - fees),
    held: sum("held"),
    available: sum("available"),
    processing: sum("processing"),
    paid: sum("paid"),
    open_bookings: open.length,
    requests: bookings.filter((booking) => booking.status === "requested").length,
    in_flight: bookings.filter((booking) => ["accepted", "in_progress"].includes(booking.status)).length,
    delivered: bookings.filter((booking) => booking.status === "delivered").length,
    completed: completedBookings.length,
    declined: declined.length,
    acceptance_rate: completedBookings.length + declined.length
      ? Math.round((completedBookings.length / (completedBookings.length + declined.length)) * 100)
      : null,
    fee_bps: MARKETPLACE_FEE_BPS,
    hold_days: SELLER_HOLD_DAYS,
    next_release_at: data.earnings
      .filter((entry) => entry.status === "held")
      .map((entry) => entry.release_at)
      .sort()[0] || null,
  };

  return {
    profile,
    bookings,
    receipts,
    payouts,
    earnings: [...data.earnings].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
    summary,
    maintenance: maintenanceFor(profile, bookings, now, summary.available > 0),
  };
}
