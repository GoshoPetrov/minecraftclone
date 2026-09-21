# 02 — Advertise F3 and update the architecture map

**What to build:** The click-to-play control list advertises the F3 debug readout so players can discover it, and the architecture reference records the new binding and the new HUD element so the next change starts from an accurate map. No runtime behaviour changes.

**Blocked by:** 01 — F3 toggles a live coordinate readout.

**Status:** ready-for-agent

- [ ] The click-to-play control list shows a hint for the F3 coordinate readout.
- [ ] The architecture reference lists the new F3 binding alongside the existing input bindings.
- [ ] The architecture reference documents the debug readout in the HUD section and the file-by-feature map.
- [ ] No production behaviour changes beyond copy/documentation; `npm test`, `npm run typecheck`, and `npm run build` still pass.
