# Security policy

Report a vulnerability by email to **liyusoftwaresolution@gmail.com**.

## What to send

- Which surface is affected (app, `/api/*`, machine API, contracts, public site).
- Steps to reproduce, with the request or the code path if you have it.
- What an attacker gains — and whether you needed an account, a key or a wallet to get there.

A short proof of concept beats a long description. Logs, HAR files and a screenshot all help.

## What happens next

We aim to acknowledge within 3 business days and to keep telling you what we find. If the report is valid we will fix it before publishing anything about it.

Please give us that window: no public issue, post or disclosure until we have shipped a fix or 30 days have passed, whichever comes first. We will not pursue research done in good faith against this repository and its own preview deployment.

## Good to know before you file

These are known and intentional, so they are not vulnerabilities:

- **The seeded machine key is shared on purpose.** `rfy_live_7c2a91f4d0e8b6a3c5d2` is the shared demo workspace's key, published in the README and the MCP server default so the API can be tried without signup. Real workspaces are seeded with no keys, and keys issued through the app are stored as a SHA-256 digest only.
- **The trust contracts are unaudited reference implementations**, deployed on Base Sepolia. Nothing in this repository should be treated as mainnet-safe, and no production funds are held by it.
- **Proof receipts are anchored on a testnet.** Anchoring demonstrates the flow; it is not yet a claim of settlement-final evidence.
- **Escrow and payout paths are region-gated** by request country header behind the proxy, and sanctions-screening failures fail open unless `SANCTIONS_FAIL_CLOSED=1`. Tightening either is a product decision, not a bug.

If you think you have found something in that last group — for example a way around the region gate, or a workspace that can read another workspace's rows — that *is* in scope, and we want to hear about it.
