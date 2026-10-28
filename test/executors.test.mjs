import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "remindify-executors-"));
process.env.REMINDIFY_DATA_DIR = dataDir;
process.env.EXECUTOR_ALLOW_LOCAL = "1";
process.env.EXECUTOR_RETRY_BASE_MS = "1";
process.env.EXECUTOR_ATTEMPTS = "3";

const { executeWithConnector, isPrivateAddress, publicAgent, signExecutorRequest, validateExecutorUrl } =
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

test("connectors retry transient failures, stop on permanent ones and never follow redirects", async () => {
  let mode = "flaky";
  let requests = 0;
  const server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      requests++;
      if (mode === "flaky" && requests < 3) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "warming up" }));
        return;
      }
      if (mode === "permanent") {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "bad_request" }));
        return;
      }
      if (mode === "redirect") {
        res.writeHead(302, { location: "http://127.0.0.1:1/inward" });
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ proof: "retry_proof" }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const agent = {
    id: "ag_test",
    name: "Trim",
    handle: "trim",
    executor_url: `http://127.0.0.1:${server.address().port}/execute`,
    executor_secret: "rfy_exec_secret",
  };
  const obligation = { id: "ob_1", title: "Renewal", autonomy: "autopilot" };
  const args = { agent, obligation, action: "Run", detail: "Do it" };

  try {
    const flaky = await executeWithConnector({ ...args, runId: "run_1" });
    assert.equal(flaky.ok, true);
    assert.equal(flaky.attempts, 3);
    assert.equal(flaky.proof, "retry_proof");
    assert.equal(requests, 3);

    mode = "permanent";
    requests = 0;
    const permanent = await executeWithConnector({ ...args, runId: "run_2" });
    assert.equal(permanent.ok, false);
    assert.equal(permanent.attempts, 1);
    assert.equal(permanent.status, 400);
    assert.equal(requests, 1);

    mode = "redirect";
    requests = 0;
    const redirected = await executeWithConnector({ ...args, runId: "run_3" });
    assert.equal(redirected.ok, false);
    assert.equal(redirected.status, 302);
    assert.equal(redirected.attempts, 1);
    assert.equal(requests, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
