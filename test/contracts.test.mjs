import test from "node:test";
import assert from "node:assert/strict";
import { compileContracts } from "../contracts/compile.mjs";
import { NETWORKS } from "../contracts/networks.mjs";

test("reference contracts compile with the documented solc version", () => {
  const artifacts = compileContracts();

  for (const name of ["RemindifyAttestations", "RemindifyEscrow"]) {
    const artifact = artifacts[name];
    assert.ok(artifact, `${name} artifact should exist`);
    assert.ok(Array.isArray(artifact.abi), `${name} should expose an ABI`);
    assert.match(artifact.bytecode, /^0x[0-9a-f]+$/, `${name} should have bytecode`);
  }
});

test("deployment networks use the verified USDC addresses", () => {
  assert.equal(
    NETWORKS.base.usdc,
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  );
  assert.equal(
    NETWORKS["base-sepolia"].usdc,
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  );
  assert.equal(
    NETWORKS.celo.usdc,
    "0xcebA9300f2b948710d2653dD7B07f33A8B32118C"
  );
  assert.equal(
    NETWORKS["celo-sepolia"].usdc,
    "0x01C5C0122039549AD1493B8220cABEdD739BC44E"
  );
});
