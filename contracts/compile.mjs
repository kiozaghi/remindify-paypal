// Compile the reference contracts with the same solc version documented in the
// README. Artifacts are written to contracts/artifacts for inspection; the
// deploy script compiles in memory and does not depend on them.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCES = ["RemindifyAttestations.sol", "RemindifyEscrow.sol"];
const DEPLOYABLE = ["RemindifyAttestations", "RemindifyEscrow"];

export function compileContracts() {
  const sources = {};
  for (const file of SOURCES) {
    sources[file] = { content: readFileSync(join(here, file), "utf8") };
  }

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((entry) => entry.severity === "error");
  if (errors.length) {
    throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));
  }

  const artifacts = {};
  for (const contracts of Object.values(output.contracts || {})) {
    for (const [name, contract] of Object.entries(contracts)) {
      const bytecode = contract.evm?.bytecode?.object || "";
      const deployed = contract.evm?.deployedBytecode?.object || "";
      artifacts[name] = {
        contract: name,
        abi: contract.abi,
        bytecode: bytecode ? `0x${bytecode}` : "0x",
        deployed_bytecode: deployed ? `0x${deployed}` : "0x",
      };
    }
  }

  return artifacts;
}

export function writeArtifacts(artifacts = compileContracts()) {
  const outDir = join(here, "artifacts");
  mkdirSync(outDir, { recursive: true });
  for (const name of DEPLOYABLE) {
    if (!artifacts[name]) throw new Error(`Missing compiled artifact: ${name}`);
    writeFileSync(
      join(outDir, `${name}.json`),
      `${JSON.stringify(artifacts[name], null, 2)}\n`
    );
  }
  return outDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const artifacts = compileContracts();
  const outDir = writeArtifacts(artifacts);
  console.log(`Compiled ${DEPLOYABLE.join(", ")} with solc 0.8.24`);
  console.log(`Artifacts: ${outDir}`);
}
