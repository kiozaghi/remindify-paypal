# Pitch deck

Single-file HTML, 15 slides at 1600×900 (16:9). No build step, no dependencies — the brand fonts are the ones already in `public/fonts/`.

## Files

- `deck.html` — the source. Edit copy directly in the markup.
- `remindify-deck.pdf` — rendered export (15 pages, one slide per page). Re-render after every edit.
- `speaker-notes.md` — per-slide script, timings, Q&A prep, delivery notes.
- `demo-script.md` — the 3:00 product-video shot list, pre-flight staging and fallbacks.

## Preview one slide

Open `deck.html#7` in a browser to see only slide 7 at full size. Plain `deck.html` shows the whole deck stacked.

## Re-render the PDF

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="deck/remindify-deck.pdf" \
  --virtual-time-budget=6000 \
  "file://$PWD/deck/deck.html"
```

Check the page count:

```bash
node -e "const b=require('fs').readFileSync('deck/remindify-deck.pdf','latin1');console.log((b.match(/\/Type\s*\/Page[^s]/g)||[]).length)"
```

## Rules of the deck

- Every number is real and checkable. No mainnet, audit or user claims.
- PayPal runs in the **sandbox**; say so on the slide and out loud.
- Pricing matches the live site: Solo $0, Studio $18/mo, Operator $48/mo, 10% application fee on captured escrow.
- Keep the light/dark rhythm: light for product and market, dark for trust, agents and the ask.
