import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "remindify-stats-"));
process.env.REMINDIFY_DATA_DIR = dataDir;

const { loadAll, put, seedDatabase } = await import("../server/db.mjs");
const { buildState } = await import("../server/engine.mjs");

test.after(() => rmSync(dataDir, { recursive: true, force: true }));

const DAY = 86400000;

function run(id, agentId, status, { proof = null, ageDays = 0 } = {}) {
  return {
    id,
    agent_id: agentId,
    obligation_id: null,
    action: `test ${id}`,
    detail: "",
    status,
    proof,
    duration_ms: 100,
    cost: 0,
    created_at: new Date(Date.now() - ageDays * DAY).toISOString(),
  };
}

test("agent stats are derived from runs, never stored claims", () => {
  seedDatabase();
  const state = buildState();
  const runs = loadAll().runs;
  const since = Date.now() - 30 * DAY;
  const recent = runs.filter((r) => new Date(r.created_at).getTime() >= since);

  assert.equal(state.stats.agent_runs_30d, recent.length);
  assert.equal(state.stats.agent_done_30d, recent.filter((r) => r.status === "done").length);
  assert.equal(state.stats.agent_failed_30d, 0);
  assert.equal(
    state.stats.agent_proofs_30d,
    recent.filter((r) => r.status === "done" && r.proof).length
  );
  assert.equal(
    state.stats.agent_runs_30d,
    state.agents.reduce((sum, agent) => sum + agent.runs_30d, 0)
  );

  const ledger = state.agents.find((agent) => agent.id === "ag_ledger");
  const ledgerRuns = recent.filter((r) => r.agent_id === "ag_ledger");
  const ledgerDone = ledgerRuns.filter((r) => r.status === "done");
  assert.equal(ledger.runs_30d, ledgerRuns.length);
  assert.equal(ledger.proofs_30d, ledgerDone.filter((r) => r.proof).length);
  assert.equal(ledger.success_rate, 100);

  const idle = state.agents.find((agent) => agent.id === "ag_renew");
  const idleRuns = recent.filter((r) => r.agent_id === "ag_renew");
  if (idleRuns.every((r) => !["done", "failed"].includes(r.status))) {
    assert.equal(idle.success_rate, null);
  }
});

test("failures and runs outside the 30-day window change the numbers", () => {
  put("runs", run("run_test_failed", "ag_trim", "failed", { ageDays: 1 }));
  put("runs", run("run_test_old", "ag_trim", "done", { proof: "old.pdf", ageDays: 31 }));

  const state = buildState();
  const trim = state.agents.find((agent) => agent.id === "ag_trim");
  const runs = loadAll().runs.filter((r) => r.agent_id === "ag_trim");
  const recent = runs.filter((r) => new Date(r.created_at).getTime() >= Date.now() - 30 * DAY);
  const done = recent.filter((r) => r.status === "done").length;
  const failed = recent.filter((r) => r.status === "failed").length;

  assert.equal(trim.runs_30d, recent.length);
  assert.equal(state.stats.agent_failed_30d, failed);
  assert.equal(trim.success_rate, done + failed ? Math.round((done / (done + failed)) * 1000) / 10 : null);
  assert.ok(trim.success_rate < 100);

  const old = buildState().runs.find((r) => r.id === "run_test_old");
  assert.equal(old.status, "done");
  assert.ok(trim.runs_30d < runs.length);
});
