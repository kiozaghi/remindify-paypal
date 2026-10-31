# Wallets, networks and signing

A wallet is optional. Email and Google sign-in work without one, and paying an obligation with PayPal needs no wallet at all. Wallets matter for two things only: signing proof receipts and funding USDC escrow. Remindify never holds a private key.

If you are here to take money rather than prove work, read [Payments](/docs/guides/payments) instead: PayPal Orders and Payouts are the fiat rails, and they never touch a chain.

## Sign in with a wallet

The flow is a challenge and a signature. No transaction, no gas.

```bash
curl -X POST http://localhost:4178/api/auth/wallet/challenge \
  -H "content-type: application/json" \
  -d '{"address":"0x..."}'
```

Response:

```json
{
  "address": "0x...",
  "nonce": "6f1c...",
  "message": "Remindify wants you to sign in with your Ethereum account:\n...",
  "expires_at": "2026-10-28T09:10:00.000Z"
}
```

Sign the exact `message` with `personal_sign`, then:

```bash
curl -X POST http://localhost:4178/api/auth/wallet/verify \
  -H "content-type: application/json" \
  -d '{
    "address": "0x...",
    "nonce": "6f1c...",
    "signature": "0x..."
  }'
```

The challenge expires after ten minutes and is consumed once.

In a browser with an injected wallet:

```js
const challenge = await fetch("/api/auth/wallet/challenge", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ address }),
}).then((response) => response.json());

const signature = await window.ethereum.request({
  method: "personal_sign",
  params: [challenge.message, address],
});

await fetch("/api/auth/wallet/verify", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ address, nonce: challenge.nonce, signature }),
});
```

## Networks

| Network | Chain ID | Use |
| --- | --- | --- |
| Base | 8453 | Primary ecosystem; USDC receipts and escrow |
| Base Sepolia | 84532 | Testnet for development |
| Celo | 42220 | Mobile-first pilot |
| Celo Sepolia | 11142220 | Testnet for Celo |

Add Base to an injected wallet with:

```text
Network name: Base
RPC URL: https://mainnet.base.org
Chain ID: 8453
Currency symbol: ETH
Block explorer: https://basescan.org
```

For Base Sepolia, chain ID `84532` and RPC `https://sepolia.base.org`.

USDC contract addresses used by the trust layer:

| Network | USDC |
| --- | --- |
| Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Celo | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |

Always read the address from `GET /api/trust` or the escrow record rather than a message you were sent. Contract addresses can change between deployments.

## Sign a proof receipt

A receipt is EIP-712 typed data. Fetch the receipt, then sign its `wallet_payload` exactly as returned:

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

If the recovered address does not match `signer`, the server returns `signature_invalid` and the receipt stays `prepared`.

You can also copy the typed data into a hardware wallet or another signer. The payload is portable; there is no Remindify-specific wallet.

## Escrow

Escrow moves USDC only after proof. The flow is:

1. Open an escrow intent in **Trust layer** and acknowledge the jurisdiction boundary.
2. If an escrow contract is configured, fund it from your wallet and submit the transaction hash.
3. The server verifies the receipt: status, contract address and chain.
4. Release requires a signed or anchored proof receipt for the same obligation.

On Base Sepolia, test the whole loop with test USDC before touching mainnet. On mainnet, start with an amount you would be willing to lose if a wallet is compromised.

## Safety checklist

- **Never share a seed phrase.** Remindify will never ask for one.
- **Verify the chain and contract.** A signature for the wrong chain is still a valid signature.
- **Read before you sign.** `personal_sign` of a login message is not the same as a transaction. Typed data is not a transfer, but a malicious site can ask for a different payload.
- **Approve exact amounts.** Do not grant unlimited USDC allowances to an address you cannot verify.
- **Use a dedicated wallet.** A wallet used for Remindify receipts does not need to hold your savings.
- **Expect no token.** There is no Remindify token, airdrop or presale. Treat any claim otherwise as fraud.
- **Wallet features are optional.** If a wallet is not available, complete obligations and file proof labels without one.

## Region notes

Wallet and payment features stay offchain where the operator's region rules require it. When `BLOCKED_COUNTRIES` is configured, account creation and escrow movement from those countries return `451 region_blocked`; existing accounts can still sign in.
