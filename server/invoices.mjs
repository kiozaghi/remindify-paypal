// PayPal invoicing for obligations that are owed *to* the workspace.
//
// The collector agent never types an amount: the invoice is rebuilt from the
// stored obligation, and the payer email has to be on the obligation itself so
// a run cannot redirect someone else's money.
import { put } from "./db.mjs";
import { createAndSendInvoice, remindInvoice, PayPalError } from "./paypal.mjs";

const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

export function listInvoices(data) {
  return (data?.invoices || []).map((invoice) => ({
    ...invoice,
    reminders: Number(invoice.reminders || 0),
  }));
}

export function invoiceForObligation(data, obligationId) {
  return listInvoices(data)
    .filter((invoice) => invoice.obligation_id === obligationId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
}

function invoiceAmount(obligation, invoice) {
  const amount = Number(invoice?.amount ?? obligation?.amount ?? 0);
  const currency = String(invoice?.currency || obligation?.currency || "USD").toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PayPalError("This obligation has no amount to invoice.", {
      status: 422,
      code: "nothing_to_invoice",
    });
  }
  if (currency !== "USD") {
    throw new PayPalError(`PayPal invoices in this build are USD; this obligation is ${currency}.`, {
      status: 422,
      code: "currency_unsupported",
    });
  }
  return { amount, currency };
}

export async function sendObligationInvoice({
  obligation,
  agent,
  payerEmail,
  env = process.env,
  now = Date.now(),
} = {}) {
  if (!obligation) {
    throw new PayPalError("Obligation not found.", { status: 404, code: "obligation_not_found" });
  }
  const recipient = String(payerEmail || obligation.payer_paypal_email || "").trim();
  if (!recipient) {
    throw new PayPalError("Add the payer's PayPal email to the obligation first.", {
      status: 422,
      code: "payer_required",
    });
  }
  if (["paid", "done", "cancelled"].includes(obligation.status)) {
    throw new PayPalError("This obligation is already closed.", {
      status: 409,
      code: "obligation_closed",
    });
  }

  const { amount, currency } = invoiceAmount(obligation);
  const dueDays = Math.max(1, Math.ceil((new Date(obligation.due_at).getTime() - now) / 86_400_000));
  const sent = await createAndSendInvoice(
    {
      id: obligation.id,
      title: obligation.title,
      amount,
      currency,
      recipientEmail: recipient,
      note: obligation.notes || obligation.consequence || "Remindify obligation",
      dueDays,
    },
    { env }
  );

  const row = {
    id: uid("in"),
    obligation_id: obligation.id,
    obligation_title: obligation.title,
    agent_id: agent?.id || obligation.agent_id || null,
    agent_name: agent?.name || "Remindify",
    payer_paypal_email: recipient,
    amount,
    currency,
    status: sent.status || "SENT",
    paypal_invoice_id: sent.invoiceId,
    payer_view_url: sent.payerViewUrl || null,
    due_date: sent.dueDate || null,
    reminders: 0,
    last_reminded_at: null,
    demo: false,
    created_at: new Date(now).toISOString(),
  };
  put("invoices", row);
  put("events", {
    id: uid("ev"),
    actor_type: "agent",
    actor_id: row.agent_id,
    actor: row.agent_name,
    kind: "automation",
    verb: "sent a PayPal invoice",
    object: obligation.title,
    detail: `$${amount.toFixed(2)} ${currency} invoiced to ${recipient} · ${sent.invoiceId}`,
    created_at: row.created_at,
  });
  return row;
}

export async function remindObligationInvoice({ invoice, env = process.env, now = Date.now() } = {}) {
  if (!invoice) {
    throw new PayPalError("Invoice not found.", { status: 404, code: "invoice_not_found" });
  }
  if (invoice.demo || !invoice.paypal_invoice_id) {
    throw new PayPalError("This is a sample invoice; send a live one to remind it.", {
      status: 409,
      code: "invoice_not_live",
    });
  }
  await remindInvoice(invoice.paypal_invoice_id, { env });
  const next = {
    ...invoice,
    reminders: Number(invoice.reminders || 0) + 1,
    last_reminded_at: new Date(now).toISOString(),
  };
  put("invoices", next);
  put("events", {
    id: uid("ev"),
    actor_type: "agent",
    actor_id: invoice.agent_id || null,
    actor: invoice.agent_name || "Remindify",
    kind: "automation",
    verb: "sent an invoice reminder",
    object: invoice.obligation_title,
    detail: `Reminder ${next.reminders} to ${invoice.payer_paypal_email}`,
    created_at: next.last_reminded_at,
  });
  return next;
}
