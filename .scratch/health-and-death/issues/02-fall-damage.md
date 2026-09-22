# 02 — Fall damage

**What to build:** Landing after a fall of more than three blocks costs health in proportion to the distance fallen, shown as hearts lost in the HUD. A plain jump or a short step down is free; a slightly-too-high drop stings; a long drop is lethal. Fall distance accumulates only while airborne and only for downward motion, so jumping does not count its rise, and the accumulator resets on landing so a series of short hops never adds up. Landing on a block placed mid-fall saves the player.

**Blocked by:** 01 — Hearts HUD shows the avatar's health (needs the vitals value and the hearts HUD to make the loss visible).

**Status:** done

- [ ] A fall of exactly 3.0 blocks is safe; falls of 3.1 and 4.0 blocks each cost at least 1 HP.
- [ ] Damage on landing is `max(0, ceil(fallDistance) − safeFallDistance) × fallDamagePerBlock`, always a whole number of hit points.
- [ ] Fall distance accumulates only when the previous state was airborne and only for downward displacement `max(0, previous.y − next.y)`; the upward arc of a jump contributes nothing.
- [ ] The accumulator resets to zero on landing and while grounded, so a walk off a ledge starts from zero and repeated short hops do not accumulate.
- [ ] A normal jump on flat ground never deals damage, and a jump off a ledge is measured from the apex of the jump.
- [ ] Crouching, sprinting, and being airborne do not change how fall damage is calculated.
- [ ] Landing on a block placed mid-fall prevents the damage that the full fall would have caused.
- [ ] The airborne → grounded transition applies the final slice of downward movement before the total is measured, then resets the accumulator.
- [ ] The pure `updateVitals(vitals, previous, next, dt)` owns the fall accumulation and damage rules; orchestration contains no damage arithmetic.
- [ ] The game runs the vitals stage immediately after the physics stage, so the frame's exact grounded transition and position are observed before targeting, actions, and the HUD.
- [ ] `player.safeFallDistance` and `player.fallDamagePerBlock` are added to the central tuning configuration with guard tests; no existing constant changes.
- [ ] Unit tests pin the safe threshold, the damage formula, downward-only accumulation, jump safety, and the landing reset.
- [ ] A headless acceptance test chains the real `step` and `updateVitals` to prove a controlled drop from a lethal height ends dead.
- [ ] No change is made to `PlayerPhysics.step`, `PlayerState`, the world, interaction, rendering, or persistence; health is never persisted.
- [ ] `npm test`, `npm run typecheck`, and `npm run build` pass.
