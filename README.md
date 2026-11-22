# DAANA — Pakistani Lentils, Elevated

A scroll-driven storytelling website for DAANA, a premium Pakistani
lentils brand. One hero pouch carries the whole story: it is revealed,
rotates a full 360°, and pours its lentils into a bowl — all driven by
the reader's scroll.

Live: https://rehzan-dev.github.io/daana/

## Chapters

1. **Origin** — hero, "The pulse of home."
2. **The Reveal** — the Lal Masoor pouch fades in.
3. **In Motion** — the pouch rotates 360°, scrubbed by scroll.
4. **The Burst** — three raw lentils, floating particles speed up.
5. **The Pour** — the pouch pours lentils into a bowl, scrubbed by scroll.
6. **The Collection** — three pouches + a selector (Masoor / Moong / Chana).
7. **Our Table** — full-bleed cooked-daal photograph, "Har daana, ghar ki kahani."
8. **DAANA** — call to action + footer.

## How the scrub works

Both video sections scrub pre-rendered JPEG frame-sheets drawn on a
`<canvas>` (10 fps, 100 frames each). Drawing a frame is instant, so
scrolling stays smooth on any connection — no video seeking, no stalls,
and scrolling up reverses the motion exactly. Desktop uses 960×540
cells (`frames-hd/`), touch devices use lighter 480×270 cells (`frames/`).
The `<video>` elements only supply poster stills until the first sheet
loads. Audio was stripped at encode time; the videos are muted.

## Fixes vs the reference video

The site follows the DAANA reference video's concept, with its flaws fixed:

- Real generated pack photography instead of a flat CG box.
- A real pour video with gravity — no floating lentils, no rod through the pack.
- Copy sits in its own column (desktop) or above the video (mobile) — text
  never overlaps the pack.
- The bowl is part of the pour footage — nothing pops in.
- The collection shows three real pack photographs, not flat cards.
- No CG particles over the real food photograph.
- The pack never hangs over the footer.
- The "Now tasting" chapter label swaps only while faded out — no glitch.

## Files

- `index.html`, `styles.css`, `script.js` — the site.
- `vendor/` — GSAP, ScrollTrigger, Lenis (self-hosted).
- `videos/` — encoded clips (reference only; the page scrubs sheets).
- `posters/` — start frames shown until sheets load.
- `frames-hd/`, `frames/` — canvas frame-sheets.
- `assets/` — pack photographs, raw-lentil bowls, cooked daal photo, favicon.

## Credits

- Pack photographs and video clips: AI-generated for this concept brand.
- Cooked daal photograph: Vecteezy free photo (steaming bowl of lentil dish).
- Raw-lentil bowls photograph: AI-generated for this concept brand.
