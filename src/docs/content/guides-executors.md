# Build an execution connector

An execution connector is the bridge between "the agent decided" and "the work happened". It is an HTTPS endpoint you control. Remindify sends a signed request; your endpoint does the work and returns a proof reference.

## Connect one

1. Deploy an HTTPS endpoint that accepts `POST`.
2. Open the agent's passport in **Agents**.
3. Paste the URL and save. Remindify shows a signing secret once.
4. Store the secret in your executor's environment.
5. Reconnecting rotates the secret and invalidates the old one.

Executor URLs must resolve to a public address. The resolved address is pinned for the send, so a second DNS answer cannot redirect the call inward. Redirects are refused. For local development, set `EXECUTOR_ALLOW_LOCAL=1` and use `http://localhost:<port>`.

## The request

```http
POST /your/execute
x-remindify-event: obligation.execute
x-remindify-run: run_ab12cd3
x-remindify-timestamp: 1761600000000
x-remindify-signature: sha256=<hmac>
x-remindify-attempt: 1
content-type: application/json
```

The body:

```json
{
  "event": "obligation.execute",
  "run_id": "run_ab12cd3",
  "issued_at": "2026-10-28T09:00:00.000Z",
  "workspace": { "id": "ws_5f2c...", "name": "Exopya Studio" },
  "agent": { "id": "ag_ledger", "name": "Ledger", "handle": "ledger" },
  "obligation": {
    "id": "ob_rent",
    "title": "Pay rent",
    "provider": "Selam Properties",
    "amount": 750,
    "currency": "USD",
    "due_at": "2026-11-01T09:00:00.000Z",
    "autonomy": "autopilot"
  },
  "action": "Executed the obligation",
  "detail": "Pay $750 to Selam Properties using the verified account, then archive the receipt."
}
```

## Verify the signature

The signature is `HMAC-SHA256(secret, "<timestamp>.<raw body>")`, hex encoded. Verify against the **raw** body, before JSON parsing.

### Node

```js
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

const secret = process.env.REMINDIFY_EXECUTOR_SECRET;
const rawBody = readFileSync(0, "utf8"); // or collect the request stream

const expected = createHmac("sha256", secret)
  .update(`${process.env.TIMESTAMP}.${rawBody}`)
  .digest("hex");
const given = String(process.env.SIGNATURE || "").replace(/^sha256=/, "");
const ok = given.length === expected.length &&
  timingSafeEqual(Buffer.from(given), Buffer.from(expected));

if (!ok) {
  console.error("bad signature");
  process.exit(401);
}
```

### Express

```js
app.post("/your/execute", express.raw({ type: "application/json" }), (req, res) => {
  const timestamp = req.get("x-remindify-timestamp");
  const given = String(req.get("x-remindify-signature") || "").replace(/^sha256=/, "");
  const expected = createHmac("sha256", process.env.REMINDIFY_EXECUTOR_SECRET)
    .update(`${timestamp}.${req.body.toString("utf8")}`)
    .digest("hex");
  const ok = given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: "bad_signature" });

  const event = JSON.parse(req.body.toString("utf8"));
  // do the work
  res.json({ proof: "transfer_ref_88213" });
});
```

### Python

```py
import hashlib, hmac, os

expected = hmac.new(
    os.environ["REMINDIFY_EXECUTOR_SECRET"].encode(),
    f"{timestamp}.{raw_body}".encode(),
    hashlib.sha256,
).hexdigest()
ok = hmac.compare_digest(expected, given.removeprefix("sha256="))
```

## Respond with proof

Return any `2xx`. Include a proof reference:

```json
{ "proof": "transfer_ref_88213" }
```

`receipt_url` is also accepted. The reference is filed on the obligation and in the run history.

| Response | What Remindify records |
| --- | --- |
| `2xx` with `proof` or `receipt_url` | Run `done`; proof filed. |
| `2xx` without either | Run `done` with `connector_<status>` as the proof, so the gap is visible. |
| `408`, `429`, `5xx`, timeout, network error | Transient: retried inline, then queued. |
| Other `4xx` | Permanent failure; no retry. |
| `2xx` but malformed JSON | Treated as a failure; nothing is marked complete. |

Never return `2xx` before the work is durably done. A green response is a promise that the proof exists.

## Retries and duplicate delivery

- Inline: up to three attempts with exponential backoff (`EXECUTOR_ATTEMPTS`, `EXECUTOR_RETRY_BASE_MS`, `EXECUTOR_TIMEOUT_MS`).
- After inline failures: the job moves to a durable outbox. It keeps the original `run_id`, retries with backoff up to `OUTBOX_MAX_ATTEMPTS`, and completes the obligation when your endpoint finally answers.
- Delivery is **at-least-once**. A crash can land between claiming a job and recording the result.
- Dedupe on `x-remindify-run`. Every attempt for the same logical execution carries the same run id, even when the timestamp and signature are fresh.
- The local server sweeps the outbox every 30 seconds. Serverless deployments call `GET` or `POST /api/cron/outbox` with `Authorization: Bearer $OUTBOX_SECRET`.
- A permanently failed or exhausted job stays visible with its last error.

Example idempotency check:

```js
const seen = new Set(); // use a database in production
if (seen.has(req.get("x-remindify-run"))) {
  return res.json({ proof: "already_done" });
}
```

## Reject stale requests

The timestamp is milliseconds since the epoch. Reject anything older than a few minutes to limit replay:

```js
const age = Date.now() - Number(req.get("x-remindify-timestamp"));
if (!Number.isFinite(age) || age > 5 * 60 * 1000) {
  return res.status(401).json({ error: "stale" });
}
```

A replay inside the window is still possible, so pair this with run-id deduplication.

## Local testing

```bash
EXECUTOR_ALLOW_LOCAL=1 npm run dev
```

Run your executor on `http://localhost:9099`, connect it in the passport, and set an obligation to `approve` or `autopilot`. Watch the run in the passport. Disconnect the executor to return the agent to draft-only.

## Do not

- Do not execute from inside the signature check. Verify first, then act.
- Do not put the signing secret in the URL query string.
- Do not return a proof reference that is not checkable by a human.
- Do not treat the obligation id as authorization for unrelated work. The connector decides what this agent may do.
