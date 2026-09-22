# 03 — Void damage

**What to build:** Walking off the horizontal edge of the world and falling below the void threshold drains the avatar's health in visible steps: 4 HP immediately on crossing the threshold, then 4 HP every half second, until death. Returning above the threshold stops the damage and resets the timer; the void is lethal no matter how much health remains.

**Blocked by:** 01 — Hearts HUD shows the avatar's health; 02 — Fall damage (extends the same pure `updateVitals` function and vitals stage).

**Status:** done

- [ ] Below `player.voidY`, the first damage tick lands immediately on the frame the avatar crosses the threshold.
- [ ] Subsequent ticks deal `player.voidDamage` every `player.voidDamageIntervalSeconds`, by decrementing a carried timer by `dt` and applying a tick whenever it reaches zero.
- [ ] Leaving the threshold resets the timer, so a later re-entry ticks immediately rather than carrying over.
- [ ] The threshold sits below the world floor, so the avatar visibly falls out of the world before taking damage.
- [ ] The void is lethal regardless of the avatar's remaining health.
- [ ] Fall damage and void damage are independent: a void fall never lands, so only the void applies.
- [ ] The `VitalsState` gains `inVoid` and `voidDamageTimer`, and the void timing and cadence are owned by the pure vitals function rather than orchestration.
- [ ] `player.voidY`, `player.voidDamage`, and `player.voidDamageIntervalSeconds` are added to the central tuning configuration with guard tests.
- [ ] Unit tests pin the immediate first tick, the configured cadence, the reset on leaving the void, and the guaranteed lethality.
- [ ] A headless acceptance test chains the real `step` and `updateVitals` to prove that stepping off the world edge ends dead via the void within the expected time.
- [ ] The save schema and persistence are unchanged; the void state is transient and never written.
- [ ] `npm test`, `npm run typecheck`, and `npm run build` pass.
