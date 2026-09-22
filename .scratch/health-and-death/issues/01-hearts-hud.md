# 01 — Hearts HUD shows the avatar's health

**What to build:** While playing, the HUD shows a row of 10 hearts that is always visible and marks the avatar's condition as full, half, or empty. At spawn every heart is full. This introduces the avatar's transient health (20 HP, clamped to `[0, maxHealth]`) as a value owned beside the player state, the pure full/half/empty heart mapping, and a dumb presenter that renders it — the foundation the later damage, void, and death tickets extend.

**Blocked by:** None — can start immediately.

**Status:** done

- [ ] The avatar has a transient health value of 20 HP (10 hearts × 2 HP) clamped to `[0, maxHealth]`; it is never written to the save file and the save schema and version are unchanged.
- [ ] Health lives in a new pure, DOM-free and renderer-free vitals module beside `PlayerState`; `PlayerState` gains no fields and player movement physics does not change.
- [ ] The module exposes `createVitals()`, `isDead(vitals)`, and a pure `heartStates(health, maxHealth)` returning one of `full` / `half` / `empty` per heart.
- [ ] `heartStates` returns exactly 10 hearts; each heart is `full` at 2 HP, `half` at 1 HP, and `empty` at 0, so an odd hit-point value renders exactly one half heart.
- [ ] `isDead` is true exactly at zero health and the health value can never go negative or become non-finite.
- [ ] The HUD renders a row of 10 hearts, always visible while playing, positioned clear of the crosshair.
- [ ] The hearts element does not intercept mouse clicks (clicks still reach the canvas), so aiming and block interaction are unaffected.
- [ ] A dumb hearts presenter over one element reads only the plain health number, ignores redundant updates, and renders whatever the pure mapping returns; it holds no gameplay state.
- [ ] The game owns the vitals value and refreshes the hearts presenter at the end of the frame; no gameplay state leaks into the UI.
- [ ] `player.maxHealth` is added to the central tuning configuration and is covered by a config guard test.
- [ ] `GameOptions` gains an optional health element so the game still constructs and runs headless when it is absent.
- [ ] The page markup and stylesheet provide the hearts element, and the entry point queries it and passes it to the game only when present.
- [ ] Unit tests pin the hearts mapping for even and odd health, the health clamp, and `isDead` true exactly at zero; no WebGL, DOM, or real IndexedDB is used.
- [ ] `npm test`, `npm run typecheck`, and `npm run build` pass.
