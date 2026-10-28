# Obligations

An obligation is the unit of work in Remindify. It replaces the loose reminder with a record that has an owner, a backup, a deadline, a risk score and a proof requirement.

## Anatomy

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Server-assigned (`ob_...`). |
| `title` | string | Required. Trimmed to 140 characters. |
| `category` | string | `people`, `health`, `identity`, `finance`, `work`, `home` or `other`. |
| `provider` | string | Who the work is with. Defaults to `Unassigned`. |
| `owner`, `backup` | string | The person responsible and the person who notices when they don't. |
| `amount`, `currency` | number, string | Money at stake. Defaults to `0` and `USD`. |
| `due_at` | ISO 8601 | Defaults to 14 days from creation when omitted. |
| `recurrence` | object or `null` | `{ "unit": "day" \| "week" \| "month" \| "quarter" \| "year", "interval": 1 }`. |
| `autonomy` | string | `notify`, `prepare`, `approve` or `autopilot`. Defaults to `prepare`. |
| `severity` | 1–5 | Consequence if it slips. Defaults to 3. |
| `confidence` | 0.4–1 | How certain the due date and scope are. Defaults to 0.8. |
| `proof_required` | string | What must be filed before completion counts. Defaults to `Confirmation`. |
| `grace_days` | number | Slack before lateness is real. Defaults to 0. |
| `checklist` | string[] | Optional steps shown in the drawer. |
| `status` | string | `active` until completed; one-off obligations become `done`. |

Completion also records `last_completed_at`, `completions`, `last_proof` and `last_note`, which are returned on the next read.

## Risk

Risk is computed when an obligation is read, not stored. The current model multiplies:

- **severity** (1–5),
- **urgency** derived from days until due,
- the **autonomy factor** — less human oversight means more residual risk,
- and a **confidence adjustment**.

The result is clamped to 2–97 and mapped to a band:

| Score | Band |
| --- | --- |
| 75–97 | `critical` |
| 50–74 | `high` |
| 28–49 | `guarded` |
| 2–27 | `low` |

Changing autonomy changes the score immediately. That is intentional: moving from `notify` to `autopilot` should look like a decision, not a setting.

Agents can read the portfolio view at `GET /api/v1/risk`:

```json
{
  "coverage": 0.86,
  "exposure_usd": 4820,
  "counts": { "critical": 2, "high": 5, "pending_approvals": 3 },
  "top_risks": [
    { "id": "ob_payroll", "title": "Payroll tax filing", "risk": { "score": 88, "band": "critical" }, "penalty": 240 }
  ]
}
```

## Autonomy

The ladder is ordered:

| Level | Behaviour |
| --- | --- |
| `notify` | Remind the owner. Nothing else. |
| `prepare` | Draft the plan, checklist and message. Wait. |
| `approve` | Do the work after a human approves the specific run. |
| `autopilot` | Do the work automatically, within the connector and ceiling. |

An obligation's autonomy is capped by the agent's `autonomy_ceiling`. A `prepare` agent cannot run an `autopilot` obligation, even if a human sets it.

Autonomy also changes the risk score. Use `approve` or `autopilot` only when the proof requirement and the connector make the result checkable.

## Completion

`POST /api/v1/obligations/:id/complete` with `{ "proof": "...", "note": "..." }`:

1. Files a proof receipt in the trust layer, hashed and unsigned.
2. For a recurring obligation, advances `due_at` by the recurrence and increments `completions`.
3. For a one-off, sets `status: "done"` and returns `archived: true`.
4. Records a `proof` event attributed to the caller.

Completion without proof is possible for a human in the app, but agents should always send a reference: what was filed, where it lives, and the identifier a human could check.

## Creating obligations well

- **One obligation, one outcome.** "Renew the domain" is an obligation. "Do the website" is a project.
- **Set the proof before delegating.** A connector that returns a receipt reference is more useful than one that says "done".
- **Prefer `approve` for irreversible work.** Payments, filings and anything sent to a regulator deserve a human yes.
- **Use recurrence instead of duplicates.** Monthly rent is one row with `interval: 1`, not twelve rows.
- **Keep `due_at` honest.** The parser and the risk score both depend on it.
