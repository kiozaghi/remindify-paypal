import test from "node:test";
import assert from "node:assert/strict";
import { parseCapture } from "../server/parse.mjs";

const NOW = Date.UTC(2026, 9, 21, 10, 0, 0); // 21 Oct 2026

test("insurance prose collapses into one renewal with the earliest deadline", () => {
  const { items } = parseCapture(
    `Subject: Your motor insurance renewal — Awash Insurance
Dear Solomon,
Your comprehensive motor policy for vehicle 3-A12345 expires on November 28, 2026.
The renewal premium is USD 486. Renew before November 24 to keep your 4% loyalty discount.
Please confirm payment by bank transfer.`,
    NOW
  );
  assert.equal(items.length, 1);
  const [item] = items;
  assert.equal(item.category, "finance");
  assert.equal(item.provider, "Awash Insurance");
  assert.equal(item.amount, 486);
  assert.equal(item.due_at.slice(0, 10), "2026-11-24");
  assert.equal(item.recurrence?.unit, "year");
  assert.match(item.title, /Motor insurance renewal/);
});

test("garage email yields service and inspection, merged sub-deadline", () => {
  const { items } = parseCapture(
    `Dawit Auto — service reminder
Your vehicle is due for its 10,000 km service in 3 weeks.
Slot held: Saturday 09:00. Cost estimate USD 140.
Please confirm by October 30 so we can keep the bay.
Annual roadworthiness inspection is also due in 2 months.`,
    NOW
  );
  assert.equal(items.length, 2);
  assert.match(items[0].title, /Vehicle service/);
  assert.equal(items[0].due_at.slice(0, 10), "2026-10-30");
  assert.equal(items[0].amount, 140);
  assert.match(items[1].title, /roadworthiness/i);
});

test("bullet notes produce one obligation per bullet", () => {
  const { items } = parseCapture(
    `Reminder: Q4 compliance pack
- Business licence renewal is due on 15 December 2026. Fee ETB 17,100.
- ISO 27001 surveillance audit scheduled 12 January 2027.
- Renew 3 staff contracts before 30 November 2026.
- Payroll tax filing is monthly — due on the 25th.`,
    NOW
  );
  assert.equal(items.length, 4);
  assert.deepEqual(
    items.map((i) => i.due_at.slice(0, 10)),
    ["2026-12-15", "2027-01-12", "2026-11-30", "2026-10-25"]
  );
  const licence = items.find((i) => /licence/i.test(i.title));
  assert.equal(licence.amount, 300); // ETB converted for display
  assert.equal(items.find((i) => /Payroll/i.test(i.title))?.recurrence?.unit, "month");
});

test("relationship notes keep people distinct and infer recurrence", () => {
  const { items } = parseCapture(
    `Mum's birthday is on 5 March. She mentioned the ceramic tea set from Ada Ceramics.
Anniversary dinner — book a table at Juniper every year on 14 February.
Call Grandma every week. Last call was 12 days ago.`,
    NOW
  );
  assert.equal(items.length, 3);
  assert.match(items[0].title, /birthday/i);
  assert.equal(items[0].due_at.slice(0, 10), "2027-03-05");
  assert.equal(items[0].provider, "Unassigned"); // a gift shop is not the obligation owner
  assert.equal(items[1].recurrence?.unit, "year");
  assert.equal(items[2].recurrence?.unit, "week");
  assert.match(items[2].title, /Grandma/);
});

test("empty or greeting-only input yields nothing", () => {
  assert.equal(parseCapture("Dear Solomon,\nThanks,\nHanna", NOW).items.length, 0);
});
