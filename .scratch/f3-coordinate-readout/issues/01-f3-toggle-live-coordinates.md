# 01 — F3 toggles a live coordinate readout

**What to build:** While playing in the browser, pressing F3 shows a small readout in the top-left of the screen with the avatar's current coordinates, and pressing F3 again hides it. The readout starts hidden. It displays the avatar's feet-centre position as a single labelled line, `XYZ: 12.5 / 24.0 / -3.5` (one decimal per component), and updates live as the avatar moves. It stays visible when the pointer is unlocked and over the click-to-play overlay, and it never intercepts mouse clicks. The toggle is edge-detected so holding F3 does not flip it repeatedly, and F3 is captured by the game so it does not open the browser's find bar. The game still constructs and runs when the readout element is absent (headless). `ARCHITECTURE.md` is not touched by this ticket.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Pressing F3 shows the readout; pressing F3 again hides it; it starts hidden on load.
- [ ] The readout shows `XYZ:` followed by the X, Y, Z components to one decimal place, e.g. `XYZ: 12.5 / 24.0 / -3.5`.
- [ ] The values update continuously as the avatar moves and reflect the feet-centre position (unchanged when crouching).
- [ ] The readout sits in the top-left, is legible over any terrain, and does not intercept mouse clicks.
- [ ] The readout stays visible while the pointer is unlocked and the click-to-play overlay is up.
- [ ] Holding F3 down (key repeat) does not toggle the readout more than once.
- [ ] F3 is bound through the central tuning configuration; the input manager is unchanged.
- [ ] The game still constructs and runs with no debug element supplied (headless).
- [ ] A pure, DOM-free formatter is unit-tested in the node environment: label present, X/Y/Z order, ` / ` separators, one-decimal rounding for integers, and negative components.
- [ ] `npm test`, `npm run typecheck`, and `npm run build` all pass.
