import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "remindify-executors-"));
process.env.REMINDIFY_DATA_DIR = dataDir;

const { isPrivateAddress, publicAgent, signExecutorRequest, validateExecutorUrl } =
  await import("../server/executors.mjs");

test.after(() => rmSync(dataDir, { recursive: true, force: true }));

test("executor targets must be public https endpoints", async () => {
  assert.equal(isPrivateAddress("10.1.2.3"), true);
  assert.equal(isPrivateAddress("172.20.0.4"), true);
  assert.equal(isPrivateAddress("192.168.0.10"), true);
  assert.equal(isPrivateAddress("169.254.169.254"), true);
  assert.equal(isPrivateAddress("127.0.0.1"), true);
  assert.equal(isPrivateAddress("::1"), true);
  assert.equal(isPrivateAddress("8.8.8.8"), false);

  const privateTarget = await validateExecutorUrl("https://192.168.0.10/execute");
  assert.equal(privateTarget.ok, false);
  assert.match(privateTarget.error, /private/i);

  const plain = await validateExecutorUrl("http://example.com/execute");
  assert.equal(plain.ok, false);
  assert.match(plain.error, /https/i);

  const credentials = await validateExecutorUrl("https://user:pass@example.com/execute");
  assert.equal(credentials.ok, false);

  const local = await validateExecutorUrl("http://127.0.0.1:9999/execute");
  assert.equal(local.ok, process.env.EXECUTOR_ALLOW_LOCAL === "1");
});

test("connector signatures are deterministic and secrets stay server-side", () => {
  const secret = "rfy_exec_test";
  const timestamp = 1700000000000;
  const raw = JSON.stringify({ hello: "world" });
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  assert.equal(signExecutorRequest(secret, timestamp, raw), expected);

  const agent = publicAgent({
    id: "ag_1",
    executor_url: "https://hook.example/run",
    executor_secret: secret,
  });
  assert.equal(agent.executor_secret, undefined);
  assert.equal(agent.executor_configured, true);
  assert.equal(publicAgent({ id: "ag_2" }).executor_configured, false);
});
