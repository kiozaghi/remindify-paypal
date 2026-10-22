// Deploy RemindifyAttestations and RemindifyEscrow to a supported EVM chain.
//
// Usage:
//   DEPLOYER_PRIVATE_KEY=0x... npm run contracts:deploy -- base-sepolia
//   npm run contracts:deploy -- base-sepolia --dry-run
//
// The private key is read from the environment, used to create an in-memory
// account, and never written to disk or printed. Deploy to a testnet first.
// The contracts are reference implementations and have not been audited.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  getAddress,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { compileContracts } from "./compile.mjs";
import { NETWORKS } from "./networks.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const positional = args.filter((arg) => !arg.startsWith("--"));
const networkKey = positional[0] || "base-sepolia";
const network = NETWORKS[networkKey];
const dryRun = flags.has("--dry-run");

if (!network) {
  console.error(
    `Unknown network "${networkKey}". Choose one of: ${Object.keys(NETWORKS).join(", ")}`
  );
  process.exit(1);
}

const rpcConfigured = Boolean((process.env[network.rpc_env] || "").trim());
const rpc = rpcConfigured
  ? process.env[network.rpc_env].trim()
  : network.rpc_default;
const rpcDisplay = rpcConfigured ? "<configured>" : rpc;
const usdc = getAddress(network.usdc);
const rawKey = (process.env.DEPLOYER_PRIVATE_KEY || "").trim();
const privateKey = rawKey
  ? rawKey.startsWith("0x")
    ? rawKey
    : `0x${rawKey}`
  : null;

if (!dryRun && !privateKey) {
  console.error(
    "DEPLOYER_PRIVATE_KEY is required. Set it in the shell for this command only; never commit it."
  );
  process.exit(1);
}

let account = null;
if (privateKey) {
  try {
    account = privateKeyToAccount(privateKey);
  } catch {
    console.error("DEPLOYER_PRIVATE_KEY is not a valid 32-byte private key.");
    process.exit(1);
  }
}

const publicClient = createPublicClient({
  chain: network.chain,
  transport: http(rpc),
});

async function main() {
  // Ask the RPC for its chain ID rather than trusting the configured network.
  const rpcChainId = Number(await publicClient.request({ method: "eth_chainId" }));
  if (rpcChainId !== network.chain_id) {
    throw new Error(
      `RPC chain ${rpcChainId} does not match ${network.key} (${network.chain_id}).`
    );
  }

  const deployment = {
    network: network.key,
    label: network.label,
    chain_id: network.chain_id,
    rpc: rpcDisplay,
    rpc_env: network.rpc_env,
    usdc,
    testnet: network.testnet,
    dry_run: dryRun,
    created_at: new Date().toISOString(),
  };

  if (account) {
    const balance = await publicClient.getBalance({ address: account.address });
    deployment.deployer = account.address;
    deployment.balance_native = formatEther(balance);
    if (balance === 0n) {
      console.warn(
        `Warning: ${account.address} has no native gas balance on ${network.label}.`
      );
    }
  }

  console.log(JSON.stringify(deployment, null, 2));

  if (dryRun) {
    console.log("Dry run complete. No transaction was sent.");
    return;
  }

  if (!account) throw new Error("A deployer account is required.");

  const artifacts = compileContracts();
  const attestation = artifacts.RemindifyAttestations;
  const escrow = artifacts.RemindifyEscrow;
  if (!attestation || !escrow) {
    throw new Error("Compiled artifacts are missing RemindifyAttestations or RemindifyEscrow.");
  }

  const usdcCode = await publicClient.getCode({ address: usdc });
  if (!usdcCode || usdcCode === "0x") {
    throw new Error(`No USDC contract at ${usdc} on ${network.label}.`);
  }

  const wallet = createWalletClient({
    account,
    chain: network.chain,
    transport: http(rpc),
  });

  console.log("Deploying RemindifyAttestations...");
  const attestationHash = await wallet.deployContract({
    abi: attestation.abi,
    bytecode: attestation.bytecode,
    args: [],
  });
  console.log(`  ${network.explorer}/tx/${attestationHash}`);
  const attestationReceipt = await publicClient.waitForTransactionReceipt({
    hash: attestationHash,
  });
  if (
    attestationReceipt.status !== "success" ||
    !attestationReceipt.contractAddress
  ) {
    throw new Error("RemindifyAttestations deployment failed.");
  }
  const attestationAddress = getAddress(attestationReceipt.contractAddress);

  const attestationCode = await publicClient.getCode({
    address: attestationAddress,
  });
  if (!attestationCode || attestationCode === "0x") {
    throw new Error("RemindifyAttestations has no code after deployment.");
  }

  console.log("Deploying RemindifyEscrow...");
  const escrowHash = await wallet.deployContract({
    abi: escrow.abi,
    bytecode: escrow.bytecode,
    args: [usdc, attestationAddress],
  });
  console.log(`  ${network.explorer}/tx/${escrowHash}`);
  const escrowReceipt = await publicClient.waitForTransactionReceipt({
    hash: escrowHash,
  });
  if (escrowReceipt.status !== "success" || !escrowReceipt.contractAddress) {
    throw new Error("RemindifyEscrow deployment failed.");
  }
  const escrowAddress = getAddress(escrowReceipt.contractAddress);

  const escrowCode = await publicClient.getCode({ address: escrowAddress });
  if (!escrowCode || escrowCode === "0x") {
    throw new Error("RemindifyEscrow has no code after deployment.");
  }

  deployment.attestation = {
    address: attestationAddress,
    tx_hash: attestationHash,
    block_number: Number(attestationReceipt.blockNumber),
  };
  deployment.escrow = {
    address: escrowAddress,
    tx_hash: escrowHash,
    block_number: Number(escrowReceipt.blockNumber),
  };
  deployment.env = {
    [network.rpc_env]: rpcDisplay,
    [network.attestation_env]: attestationAddress,
    [network.escrow_env]: escrowAddress,
  };

  const outDir = join(here, "deployments");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${network.key}.json`);
  writeFileSync(outFile, `${JSON.stringify(deployment, null, 2)}\n`);

  console.log("\nDeployment complete.");
  console.log(JSON.stringify(deployment, null, 2));
  console.log(`\nWrote ${outFile}`);
  console.log("\nSet these for the Remindify server:");
  for (const [key, value] of Object.entries(deployment.env)) {
    console.log(`${key}=${value}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
