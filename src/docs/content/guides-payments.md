# Payments: PayPal and escrow

Money can move against an obligation in two ways, and they are deliberately separate. A **PayPal payment** settles an obligation in USD through the payer's own PayPal account and touches no chain. A **USDC escrow** holds funds on Base or Celo and releases only against a proof receipt. Both attach to the same obligation and leave the same audit trail.

| Rail | Asset | Started by | Chain |
| --- | --- | --- | --- |
| PayPal Orders | USD | A signed-in human, from the obligation | None |
| PayPal Payouts | USD | A signed-in human, from the seller desk | None |
| USDC escrow | USDC on Base or Celo | A signed-in human with a wallet | Base or Celo |

Every route on this page is a **session-cookie** route. A machine key cannot start a payment, capture one or send a payout. An agent that needs to move money has to do it through its execution connector, under the ceiling you gave it.

## Paying an obligation with PayPal

1. `POST /api/payments/paypal/orders` with `{ "obligation_id": "ob_rent" }`.
2. The server reads amount and currency from the stored obligation — never from the request — and creates an Orders v2 order.
3. The response is `201` with `payment`, `approve_url` and `mode` (`sandbox` or `live`). Send the browser to `approve_url`; PayPal appends `?token=<order>&PayerID=<payer>` to the return URL you configured (`/obligations?paypal=return` by default).
4. `POST /api/payments/paypal/capture` with `{ "order_id": "..." }`. The server captures the order, verifies the captured amount and currency against the stored row, records the capture id and completes the obligation with proof `PayPal capture <id>`.

```bash
curl -X POST "$REMINDIFY_URL/api/payments/paypal/orders" \
  -H "cookie: remindify_session=..." \
  -H "content-type: application/json" \
  -d '{ "obligation_id": "ob_rent" }'
```

Limits are deliberate: USD only, at most $10,000 per payment. A non-USD obligation returns `currency_unsupported`, and an amount of zero returns `nothing_to_pay`. Starting a new order supersedes any earlier uncaptured order for the same obligation, so a double click cannot leave two payable orders behind.

Capture is idempotent. Replaying the same `order_id` returns `200` with `already_captured: true` instead of charging again.

## Sending a seller payout

Sellers request a payout from cleared earnings in the seller desk, then send it to the PayPal email on file.

1. `POST /api/seller/payouts` moves every `available` earning into `processing` and records a payout.
2. `POST /api/payments/paypal/payouts` with `{ "payout_id": "po_..." }` calls Payouts v1 and records the batch id.
3. `GET /api/payments/paypal/payouts/:batch` polls the batch. `SUCCESS` marks the payment paid and closes the payout; a returned or failed item marks it failed.

Without a PayPal email on the seller profile the route returns `409 paypal_email_required`. The email is set in **Seller desk → Storefront → Payout account**.

## Webhooks

PayPal posts to `/api/paypal/webhook`. Events are applied only when PayPal confirms the signature for the configured `PAYPAL_WEBHOOK_ID`. Without that variable the endpoint acknowledges with `202` and applies nothing, so a forged call cannot complete an obligation or close a payout.

Handled events:

- `PAYMENT.CAPTURE.COMPLETED` — marks the payment captured and completes the obligation.
- `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REVERSED`, `CHECKOUT.ORDER.VOIDED` — marks the payment failed.
- `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` — marks the batch paid and closes the payout.
- Any other `PAYMENT.PAYOUTS-ITEM.*` — marks the batch failed.

Delivery is at-least-once, so handlers update by order id or batch id rather than appending.

## Reading the ledger

`GET /api/payments` returns every payment row in the workspace plus a summary:

```json
{
  "payments": [{ "kind": "obligation", "rail": "paypal", "status": "captured", "amount": 612, "currency": "USD", "order_id": "...", "capture_id": "..." }],
  "summary": { "captured_count": 1, "captured_total": 612, "payouts_sent": 1, "failed": 0 },
  "paypal": { "configured": true, "mode": "sandbox" }
}
```

A payment row is one of `created`, `captured`, `failed` or `superseded`. `state.payments` inside `GET /api/state` carries the same rows for the signed-in app.

## When to use which

- **PayPal** when the payee wants fiat and nothing needs to be verifiable by a third party beyond Remindify's own event log.
- **USDC escrow** when the release condition itself has to be checkable — an outsider can verify the receipt signature and the anchor transaction. See [Proof and escrow](/docs/concepts/proof-and-escrow) and [Wallets and signing](/docs/guides/wallets).

## What this does not do

- No card checkout, subscriptions or stored payment methods. PayPal is the only connected payment provider.
- No refunds or disputes from inside Remindify. A failed or reversed capture is recorded; resolving it is a manual process.
- No multi-currency. Amounts are USD.
- No machine-key access. Payments are human actions, on purpose.
