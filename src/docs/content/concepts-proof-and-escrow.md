# Proof receipts and escrow

Completion is a claim. A proof receipt is the evidence. Remindify hashes the evidence reference, signs it with EIP-712 when a wallet is available, and can anchor the hash on Base or Celo. Escrow releases only against a valid receipt.

## The receipt lifecycle

| State | Meaning |
| --- | --- |
| `prepared` | Filed by completion or by an agent. Hashes and typed data exist; no signature yet. |
| `signed` | A wallet signed the typed data and the signature verified server-side. |
| `anchored` | The proof hash was written to the configured attestation contract. |

A receipt records:

- `proof_label` — the human-readable reference, such as `Cloudflare order CF-88213`.
- `proof_hash` — `keccak256` of the proof reference plus a nonce.
- `evidence_hash` — `keccak256` of a canonical JSON summary: obligation, title, category, provider, amount, currency, proof requirement, completion time.
- `digest` — the EIP-712 digest.
- `typed_data` and `wallet_payload` — exactly what a wallet should sign.
- `status`, `signer`, `signature`, `tx_hash`, `anchor_mode`.

Proof is a **reference**, not a stored document. File uploads are not part of the current preview. Keep the original receipt in your own storage and put its identifier, URL or hash in `proof`.

## Signing

The domain is:

```json
{
  "name": "Remindify Trust",
  "version": "1",
  "chainId": 8453,
  "verifyingContract": "0x..."
}
```

The message is:

```json
{
  "obligationId": "ob_domain",
  "proofHash": "0x...",
  "evidenceHash": "0x...",
  "agentId": "ag_ledger",
  "issuedAt": 1761642000,
  "nonce": "0x..."
}
```

Sign the `wallet_payload` from the receipt with viem:

```js
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";

const wallet = createWalletClient({ chain: base, transport: custom(window.ethereum) });

const signature = await wallet.signTypedData({
  account: address,
  domain: receipt.wallet_payload.domain,
  types: receipt.wallet_payload.types,
  primaryType: receipt.wallet_payload.primaryType,
  message: receipt.wallet_payload.message,
});

await fetch(`/api/trust/receipts/${receipt.id}/sign`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ signature, signer: address }),
});
```

The server recovers the address and rejects a signature that does not match `signer` with `signature_invalid`.

## Anchoring

When an attestation contract is configured for the network, `POST /api/trust/receipts/:id/anchor` with a transaction hash verifies the receipt event onchain, then stores the block number and marks the receipt `anchored`.

Without a contract the network is in **preview**: typed data and signatures still work, but nothing is written onchain. See [Wallets and signing](/docs/guides/wallets) for network details.

## Escrow

Escrow is an intent that releases USDC against proof. It is non-custodial: Remindify never holds a private key.

| State | Reached by | Meaning |
| --- | --- | --- |
| `draft` | `POST /api/trust/escrows` | Amount, provider and chain recorded. |
| `committed` | `/commit` | Offchain intent; no funds moved. |
| `funded` | `/fund` with `tx_hash` | Onchain funding verified against the configured escrow contract. |
| `released` | `/release` with a signed or anchored receipt | The release transaction is recorded. |

Rules:

- Creating an escrow requires `jurisdiction_ack: true`. The caller confirms the payment is outside Ethiopia's virtual-asset restrictions. Ethiopian obligations stay offchain.
- Release requires a receipt for **the same obligation** with status `signed` or `anchored`. A receipt for another obligation returns `proof_wrong_obligation`.
- Funding requires the escrow contract address in the environment to match the one recorded on the escrow. A contract change mid-flight returns `escrow_contract_changed`.
- Region gating applies to creating, funding and releasing escrow.

```bash
curl -X POST http://localhost:4178/api/trust/escrows \
  -H "cookie: remindify_session=..." \
  -H "content-type: application/json" \
  -d '{
    "obligation_id": "ob_payroll",
    "provider_id": "pv_meron",
    "amount": 120,
    "chain": "base",
    "jurisdiction_ack": true
  }'
```

Escrow is a trust boundary, not a payment processor. There is no card rail, no fiat custody and no refund desk. Do not advertise it as one.

## What is verifiable

A third party can verify:

1. the signature against the typed data and signer address;
2. the digest against the canonical evidence summary;
3. the anchor transaction, when one exists;
4. the event log entry that says who filed it and when.

They cannot verify the underlying document unless you publish it. The hash proves that a document did not change after filing; it does not prove the document is true.
