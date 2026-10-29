import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("seller desk carries a booking from request to proof, hold and payout", async () => {
  const dir = mkdtempSync(join(tmpdir(), "remindify-seller-"));
  process.env.REMINDIFY_DATA_DIR = dir;
  process.env.REMINDIFY_DB = join(dir, "remindify.db");
  process.env.VERCEL = "1";
  process.env.COOKIE_SECURE = "false";

  const { default: handle } = await import(`../server/index.mjs?test=${Date.now()}`);
  const server = createServer(handle);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const call = async (path, method = "GET", payload, cookie) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(payload ? { "content-type": "application/json" } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    return { status: response.status, data: await response.json() };
  };

  try {
    let response = await fetch(`${base}/api/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Seller Test", email: `seller-${Date.now()}@example.com`, password: "correct-horse-battery" }),
    });
    assert.equal(response.status, 201);
    const cookie = response.headers.get("set-cookie").split(";")[0];

    const anon = await call("/api/seller/bookings/bk_payroll_review/accept", "POST", {});
    assert.equal(anon.status, 401);

    let state = (await call("/api/state", "GET", undefined, cookie)).data.state;
    assert.equal(state.seller.profile.name, "Exopya Studio");
    assert.equal(state.seller.summary.requests, 2);
    assert.equal(state.seller.summary.available, 184);

    let result = await call("/api/seller/bookings/bk_payroll_review/accept", "POST", {}, cookie);
    assert.equal(result.status, 200);
    assert.equal(result.data.booking.status, "accepted");

    result = await call("/api/seller/bookings/bk_payroll_review/start", "POST", {}, cookie);
    assert.equal(result.data.booking.status, "in_progress");

    result = await call("/api/seller/bookings/bk_payroll_review/proof", "POST", {
      label: "Payroll reconciliation sheet",
      note: "October run checked against the new withholding tables.",
    }, cookie);
    assert.equal(result.status, 200);
    assert.equal(result.data.booking.status, "delivered");
    assert.equal(result.data.earning.status, "held");
    assert.equal(result.data.earning.gross, 120);
    assert.equal(result.data.earning.amount, 110.4);
    assert.match(result.data.receipt.ref, /^RC-\d{4}-\d+$/);
    assert.equal(result.data.booking.proof.hash.length, 64);

    const replay = await call("/api/seller/bookings/bk_payroll_review/proof", "POST", { label: "Again" }, cookie);
    assert.equal(replay.status, 409);

    result = await call("/api/seller/payouts", "POST", {}, cookie);
    assert.equal(result.status, 201);
    assert.equal(result.data.payout.amount, 184);
    assert.equal(result.data.payout.status, "processing");
    assert.equal(result.data.state.seller.summary.held, 276);

    const payoutId = result.data.payout.id;
    result = await call(`/api/seller/payouts/${payoutId}/receive`, "POST", {}, cookie);
    assert.equal(result.data.payout.status, "paid");

    await call("/api/demo/advance", "POST", { days: 4 }, cookie);
    state = (await call("/api/state", "GET", undefined, cookie)).data.state;
    const completed = state.seller.bookings.find((booking) => booking.id === "bk_payroll_review");
    assert.equal(completed.status, "completed");
    assert.equal(state.seller.summary.held, 0);
    assert.equal(state.seller.summary.available, 276);
    assert.equal(state.seller.summary.paid, 460);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
