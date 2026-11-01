# Security policy

Report a vulnerability by email to **liyusoftwaresolution@gmail.com**.

## What to send

- Which surface is affected (app, `/api/*`, machine API, trust endpoints, public site).
- Steps to reproduce, with the request or the code path if you have it.
- What an attacker gains — and whether you needed an account, a machine key or a PayPal approval to get there.

A short proof of concept beats a long description. Logs, HAR files and a screenshot all help.

## What happens next

We aim to acknowledge within 3 business days and to keep telling you what we find. If the report is valid we will fix it before publishing anything about it.

Please give us that window: no public issue, post or disclosure until we have shipped a fix or 30 days have passed, whichever comes first. We will not pursue research done in good faith against this repository and its own preview deployment.

## Good to know before you file

These are known and intentional, so they are not vulnerabilities:

- **The seeded machine key is shared on purpose.** `rfy_live_7c2a91f4d0e8b6a3c5d2` is the shared demo workspace's key, published in the README and the MCP server default so the API can be tried without signup. Real workspaces are seeded with no keys, and keys issued through the app are stored as a SHA-256 digest only.
- **The trust layer is a preview, not a settlement guarantee.** Proof receipts are signed with HMAC-SHA256 using `TRUST_RECEIPT_SECRET` or a generated per-workspace secret. PayPal runs in sandbox by default; nothing in this repository should be treated as a claim of live PayPal availability.
- **A receipt is evidence, not settlement.** A verified or settled receipt records what the auditor saw and what PayPal did; it does not prove the underlying document is true.
- **Escrow and payout paths are region-gated** by request country header behind the proxy. Tightening the list is a product decision, not a bug.

If you think you have found something in that last group — for example a way around the region gate, or a workspace that can read another workspace's rows — that *is* in scope, and we want to hear about it.
