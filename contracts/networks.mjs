// Deployment metadata for the reference contracts. Keep the USDC addresses in
// sync with server/trust.mjs; the test suite checks the two registries agree.

import { base, baseSepolia, celo, celoSepolia } from "viem/chains";

export const NETWORKS = {
  base: {
    key: "base",
    label: "Base",
    chain: base,
    chain_id: 8453,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    explorer: "https://basescan.org",
    rpc_env: "BASE_RPC_URL",
    rpc_default: "https://mainnet.base.org",
    attestation_env: "BASE_ATTESTATION_CONTRACT",
    escrow_env: "BASE_ESCROW_CONTRACT",
    testnet: false,
  },
  "base-sepolia": {
    key: "base-sepolia",
    label: "Base Sepolia",
    chain: baseSepolia,
    chain_id: 84532,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    explorer: "https://sepolia.basescan.org",
    rpc_env: "BASE_SEPOLIA_RPC_URL",
    rpc_default: "https://sepolia.base.org",
    attestation_env: "BASE_SEPOLIA_ATTESTATION_CONTRACT",
    escrow_env: "BASE_SEPOLIA_ESCROW_CONTRACT",
    testnet: true,
  },
  celo: {
    key: "celo",
    label: "Celo",
    chain: celo,
    chain_id: 42220,
    usdc: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    explorer: "https://celoscan.io",
    rpc_env: "CELO_RPC_URL",
    rpc_default: "https://forno.celo.org",
    attestation_env: "CELO_ATTESTATION_CONTRACT",
    escrow_env: "CELO_ESCROW_CONTRACT",
    testnet: false,
  },
  "celo-sepolia": {
    key: "celo-sepolia",
    label: "Celo Sepolia",
    chain: celoSepolia,
    chain_id: 11142220,
    usdc: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
    explorer: "https://celo-sepolia.blockscout.com",
    rpc_env: "CELO_SEPOLIA_RPC_URL",
    rpc_default: "https://forno.celo-sepolia.celo-testnet.org",
    attestation_env: "CELO_SEPOLIA_ATTESTATION_CONTRACT",
    escrow_env: "CELO_SEPOLIA_ESCROW_CONTRACT",
    testnet: true,
  },
};

export function networkByKey(key) {
  return NETWORKS[key] || null;
}
