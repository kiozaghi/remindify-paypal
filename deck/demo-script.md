# Demo video — 3:00

The Devpost entry needs one public video, three minutes or less. This is the record plan for
`public/demo/remindify-demo.mp4`, and the source for the chapter markers on `/demo`.

Everything on screen is the live product against a seeded workspace. PayPal runs in the
**sandbox** and the video says so out loud. No staged success: if a beat cannot be recorded
honestly, the fallback below is used instead.

---

## Pre-flight (do once, before the camera rolls)

1. **Build and start.**
   ```bash
   npm run build
   npm start            # http://localhost:4178
   ```
   PayPal credentials are not read from `.env.local` by `npm start`. Export only the
   PayPal variables, never `DATABASE_URL` — the same file carries the production database
   and a local run must not write to it:
   ```bash
   while IFS='=' read -r key value; do case "$key" in PAYPAL_*) export "$key=$value";; esac; done < .env.local
   export GEMINI_API_KEY=...     # paste locally; never commit it
   ```
   Without `GEMINI_API_KEY`, Capture and the auditor fall back to the deterministic engine.
   The video can still be recorded, but say "local parser" instead of "Gemini" on camera.

2. **Fresh account.** Sign up with a new email so the workspace seeds itself. Do not reuse an
   account that has been time-travelled; the register would already be shifted.

3. **Window.** 1440×900, 100% zoom, bookmarks bar hidden, notifications off. The UI is
   designed for this width and the captions sit below the fold.

4. **Stage the $180 hold (not on camera).**
   - Obligations → **Q4 withholding tax filing — Delaware** → **Open escrow**.
   - Payee `sb-apex@business.example.com`, amount `180` → **Create escrow** → **Create hold**.
   - Approve in the PayPal sandbox buyer account and return to Trust.
   - The newest escrow reads **Authorized**. This is a real sandbox authorization with a real
     `AUTH-…` id. The older `DEMO-AUTH-APEX-180` row is a seeded rehearsal; it now refuses
     release with an explanation instead of pretending to capture.
   - If the clock was advanced earlier, reset it before recording.

5. **Proofs on the desktop.** Copy these next to the recording window:
   - `public/demo/proofs/unverified-wrong-amount.pdf` — a draft for **$1,800**, ten times the obligation.
   - `public/demo/proofs/delaware-tax-receipt-verified.pdf` — the stamped **$180** receipt, confirmation `DL-2026-8841`.
   - `public/demo/proofs/delaware-tax-notice.pdf` — optional for the Capture beat if you paste instead of using the sample.

6. **Dry run.** Run the five beats once without recording. Reset the workspace afterwards
   (`POST /api/demo/reset`, or the clock chip → Reset demo) and re-stage the hold.

---

## The five beats

| Time | Screen | What you do | Voice-over |
| --- | --- | --- | --- |
| 0:00 | Today | Scroll the greeting, the escrow strip (`$180` hold), the approvals rail, the closest-to-the-edge rows. Do not click yet. | "Every business runs a back office nobody put on the org chart: a $180 filing hold waiting on proof, a contractor deliverable needing a W-9, a payroll filing due in four days. This is the work that comes back — and the work agents should carry." |
| 0:25 | Capture | Choose **Delaware withholding notice** → **Parse & structure**. Let the draft cards land. Point at the amount, the due date and the proof requirement, then **Import** one draft. | "Capture is AI-first. Gemini reads the notice and returns the obligation, the amount, the due date and the proof that counts. Nothing is scheduled until I accept it." |
| 0:37 | Obligations → Agent Studio | Flip the register to **Agent Studio**. Hover the risk meter, inline autonomy, the agent passport and the PayPal escrow state. | "The register is AG Grid: risk, inline autonomy, the agent's passport and spend cap, and the PayPal escrow state — one governed surface." |
| 1:05 | Today → Time machine | **Run agent sweep**. Read the summary. Open the clock chip, advance **+7 days**, run the sweep again. Open the Northwind retainer drawer. | "Time moves. The sweep runs every agent: those with a connector act, those without one draft, and overdue work escalates to its named backup." |
| 1:22 | Retainer drawer | Scroll to the invoice panel. If PayPal is configured, press **Send invoice** (payer `sb-northwind@business.example.com`, amount 2,400) and show the created-and-sent state. If not, show the seeded `INV2-DEMO-2401` row and say it is a sample. | "@ar-collector sends the Northwind retainer as a PayPal invoice — created, then sent, never left as a draft. The payer URL comes back as proof." |
| 1:50 | Trust → the authorized $180 hold | **Release** → attach `unverified-wrong-amount.pdf` → **Audit**. The verdict is rejected; the hold stays locked. Cancel, then attach `delaware-tax-receipt-verified.pdf` → **Audit** → verified → **Release**. | "The hold is already authorized, so the only question is proof. The wrong PDF fails the auditor on the amount — $1,800 against a $180 filing. The stamped receipt clears it." |
| 2:20 | Trust ledger | Hold on the capture, the 10% fee, the net payout and the PayPal reference. Scroll the ledger rows. | "PayPal captures $180, the 10% fee is $18, and $162 pays out through Payouts. The ledger keeps every PayPal reference next to the proof." |
| 2:40 | Agent access → terminal → today | Show the scoped key and the endpoint reference, cut to `curl /api/v1/obligations`, back to the register. | "Agents and humans share the same surface — over REST and MCP, with scopes, ceilings and a full audit trail. Agents prepare. You approve. Money moves on proof." |

Hard stop at **3:00**. If a beat runs long, shorten 0:37 (Agent Studio) and 2:40 (MCP);
never shorten 1:50 or 2:20.

---

## Fallbacks

- **No PayPal credentials.** Record beats 1–3 and the two audits in beat 4. The release
  returns `paypal_not_configured`; cut to the ledger rows from a previous sandbox run and
  say on camera: "The capture below was performed in the PayPal sandbox; this build has no
  merchant credentials, so it does not pretend to move money now."
- **Guest card checkout.** Use the sandbox **buyer** account for approvals. The guest card form
  does not accept test cards on this merchant.
- **Payout refused.** The escrow parks as `Captured · payout failed` with the reason and a
  retry action. Show that state; it is more credible than a perfect run.
- **Gemini unavailable.** The auditor answers with `deterministic_fallback` and a note. Keep
  the take if the verdicts are still correct; mention the fallback.

---

## Post-production

- Burn captions. Gumroad/YouTube auto-captions miss "PayPal", "W-9" and "AG Grid".
- Keep a **PayPal sandbox · test money** lower third over the money beats.
- Export 1080p H.264, loudness around −16 LUFS, no music under the voice.
- Confirm the runtime is ≤ 3:00 before uploading. Trim, don't speed up.
- Upload to YouTube as **Unlisted** (or Vimeo with a public link), name it
  `Remindify — proof-gated agent payments (PayPal sandbox)`.
- Copy the link into Devpost, `public/demo/index.html` (the `<video>` source or its caption),
  and the README demo section. Update the `/demo` chapter markers if the final cut moves.
