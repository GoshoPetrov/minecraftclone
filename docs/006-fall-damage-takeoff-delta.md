# Spec 006 — Fall Damage from the Takeoff-to-Landing Delta

**Status:** ready-for-agent
**Source:** product conversation (fall-damage delta request + grilling session)
**Scope:** change how fall distance is measured so landing damage uses the net drop from the height the avatar left the ground to the height it lands, instead of the drop below the jump apex

---

## Problem Statement

Fall damage does not match what the player did. Today the fall-distance accumulator
sums downward movement only while airborne, so a jump's rise is discarded and the
measurement effectively starts at the **apex of the arc**. When the player jumps off a
ledge, the jump's own height is silently added to the drop: a six-block ledge with an
ordinary jump apex of about 1.3 blocks is charged as a 7.3-block fall. The player fell
six blocks, not seven, and the extra heart of damage feels arbitrary and unearned.

The player expects the damage to reflect the height they actually fell — the difference
between the ground they left and the ground they hit. Jumping off a ledge and walking
off the same ledge should cost the same, because the player ends up at the same place.

## Solution

Measure fall damage from the **takeoff height**: the avatar's feet position on the last
grounded frame before it became airborne. On landing, the fall delta is
`max(0, takeoffY − landingY)`, and the existing damage formula is applied to that delta
unchanged. The upward arc of a jump contributes nothing because the fall is anchored at
the ground the avatar left, not at the top of its arc.

This makes a jump off a ledge and a walk off the same ledge cost identical damage, keeps
an ordinary jump on flat ground free, and leaves every other fall rule — the three-block
safe distance, whole-block damage, landing reset, block-placed-mid-fall rescue, and the
void — exactly as it is.

## User Stories

### Measuring the fall

1. As a player, I want fall damage to be based on how far I actually fell, so that the cost matches the drop I took.
2. As a player, I want the fall to be measured from the ground I left, so that the height is the height I recognise.
3. As a player, I want the upward arc of a jump not to count toward the fall, so that jumping does not inflate my damage.
4. As a player, I want jumping off a ledge and walking off the same ledge to cost the same, so that the rule is predictable and fair.
5. As a player, I want fall damage to be measured at the moment I hit the ground, so that the number reflects the landing that actually happened.
6. As a player, I want landing on higher ground than I took off from to cost nothing, so that climbing and upward boosts are never punished.
7. As a player, I want landing exactly level with my takeoff to cost nothing, so that a hop on flat ground is always free.
8. As a player, I want the fall to include the final slice of the landing frame, so that a drop that crosses the safe threshold on the last frame is still charged.
9. As a player, I want the delta to be measured from my feet, so that it is consistent with every other position in the game.

### Jumping and ledges

10. As a player, I want an ordinary jump on flat ground to never hurt me, so that moving around is not accidentally self-damaging.
11. As a player, I want a jump off a three-block ledge to be safe, so that small ledges do not punish jumping.
12. As a player, I want a jump off a six-block ledge to cost exactly what walking off a six-block ledge costs, so that my movement choice does not change the price.
13. As a player, I want the jump's rise to contribute nothing even if the apex is high, so that a boosted jump does not multiply my fall damage.
14. As a player, I want a fall that begins off a ledge without jumping to be measured from the ledge, so that walking off is not accidentally free.

### Distance, damage, and the safe threshold

15. As a player, I want a fall of exactly three blocks to be safe, so that ordinary drops never punish me.
16. As a player, I want a fall of more than three blocks to cost health, so that height carries real risk.
17. As a player, I want the damage to grow with the distance fallen, so that a slightly-too-high drop stings and a long drop is genuinely dangerous.
18. As a player, I want a fall from a lethal height to kill me, so that the world has real stakes.
19. As a player, I want any drop past exactly three blocks to cost at least one hit point, so that a 3.9-block fall is not free.
20. As a player, I want fall damage to be whole numbers of hit points, so that the hearts HUD always reads cleanly.
21. As a player, I want the safe distance and the per-block cost to be unchanged, so that this fix does not retune the game.

### Resetting and repeating

22. As a player, I want the fall to reset when I land, so that a series of short hops never adds up into a phantom long fall.
23. As a player, I want the fall to reset while I am grounded, so that a walk off a ledge starts fresh from the ledge.
24. As a player, I want landing on a block I placed mid-fall to save me, so that building under myself remains a valid escape.
25. As a player, I want the second fall after a rescue to start from the rescue block, so that I am charged only for the drop that follows.
26. As a player, I want taking damage to clear the fall, so that I am not charged twice for the same drop.
27. As a player, I want repeated landings from different heights to each be measured independently, so that the damage history never compounds.

### Spawning, loading, and death

28. As a player, I want spawn to start with no fall recorded, so that arriving in the world never costs health.
29. As a player, I want a spawn or load that begins in mid-air to still measure the fall, so that an unusual start does not become a free drop.
30. As a player, I want respawn to clear the fall start, so that I do not inherit the drop that killed me.
31. As a player, I want the fall state to be transient and never saved, so that reloading always starts clean.
32. As a player, I want the void to keep working exactly as before, so that falling out of the world still drains my health over time.
33. As a player, I want a plunge into the void to apply only void damage, so that a fall that never lands is not double-charged.

### Predictability and presentation

34. As a player, I want crouching, sprinting, or the movement label to not change fall damage, so that the rule stays predictable.
35. As a player, I want the hearts HUD to update from the landing damage exactly as it does today, so that I can read what the fall cost.
36. As a player, I want the death and respawn flow to be unaffected, so that a lethal fall still ends in the recognisable death overlay.

### Developer and systemic guarantees

37. As a developer, I want the fall rule to stay in the pure, renderer-independent vitals module, so that it can be simulated and tested headlessly.
38. As a developer, I want the vitals state to carry a fall **start height** rather than a running distance, so that the model directly expresses where the fall began.
39. As a developer, I want the landing damage computed from a single subtraction, so that there is no per-frame accumulation drift or apex ambiguity.
40. As a developer, I want the vitals update to remain total for any previous/next pair, so that an airborne start without a grounded transition cannot produce a non-finite or undefined result.
41. As a developer, I want the player physics, player state, and `step` function to stay untouched, so that this change cannot destabilise movement, crouch, or the ledge guard.
42. As a developer, I want the vitals function signature to stay the same, so that application orchestration needs no change.
43. As a developer, I want no new tuning constants, so that balancing is not part of this fix.
44. As a developer, I want no persistence or save-schema change, so that the blast radius stays inside the vitals module.
45. As a developer, I want the architecture reference and the health spec amended, so that the next agent does not read an apex rule the code no longer follows.

### Verification

46. As a tester, I want a regression test that a jump off a ledge is measured from takeoff rather than the apex, so that the core behaviour cannot silently revert.
47. As a tester, I want the leap-off-a-ledge damage pinned by an exact expected value, so that the difference from the old apex rule is unambiguous.
48. As a tester, I want the safe distance, scaling, landing reset, and lethal clamp still pinned, so that the measurement change does not disturb the formula.
49. As a tester, I want the negative and zero delta cases pinned, so that landing at or above takeoff is provably free.
50. As a tester, I want an airborne start without a grounded transition pinned, so that the seeding rule is enforced.
51. As a tester, I want the existing headless acceptance flow updated to the new field and, where cheap, an end-to-end jump-off-a-ledge case, so that the real physics and the real vitals agree.

## Implementation Decisions

### Modules modified

- **The pure vitals module** — the only gameplay module that changes. It owns the
  takeoff-height state, the seeding rule, the landing transition, and the damage
  arithmetic.
- **The vitals unit suite and the headless acceptance flow** — updated for the renamed
  state field and the new expectations, with the apex assertion replaced by a takeoff
  assertion.
- **The health spec and the architecture reference** — amended so the documented fall
  rule matches the code. The old spec's damage-rules section and the one story that pins
  the apex behaviour are rewritten; the implementation notes that explain the apex are
  corrected.

**Unchanged:** player physics, player state, the `step` function, the player controller,
the central tuning configuration, the world, interaction, rendering, the HUD presenters,
the death overlay, and persistence. The vitals function's signature is unchanged, so
application orchestration is untouched.

### Vitals state shape

`fallDistance` (a running sum) is replaced by a fall **start height** that is `null` when
no fall is in progress. The field is renamed to say what it holds. From the grilling
session:

```ts
interface VitalsState {
  readonly health: number;            // clamped to [0, maxHealth]
  readonly fallStartY: number | null; // feet Y on the last grounded frame; null when grounded
  readonly inVoid: boolean;           // below the void threshold on the last update
  readonly voidDamageTimer: number;   // seconds until the next void tick
}

createVitals(): VitalsState          // fallStartY starts null
updateVitals(vitals, previous: PlayerState, next: PlayerState, dt: number): VitalsState
```

### Fall measurement

- **Takeoff anchor.** The fall is anchored at the feet Y of the avatar on its last
  grounded frame. When the avatar is airborne and `fallStartY` is `null`, the update
  records `previous.position.y`. This covers both the ordinary grounded-to-airborne
  transition and an update that observes the avatar already airborne (a spawn or load in
  mid-air), so the update is total.
- **Landing.** On the airborne-to-grounded transition, the delta is
  `max(0, fallStartY − next.position.y)`. The landing frame's own descent is included by
  construction because the anchor is the takeoff height, not the previous frame's height.
  Damage is applied, then `fallStartY` is set to `null`.
- **Grounded.** Any frame that ends grounded clears `fallStartY` to `null`, so a walk
  off a ledge starts from zero and repeated short hops never add up.
- **Negative and zero delta.** Landing at or above the takeoff height clamps to zero
  damage and still resets the fall.
- **No apex.** The upward arc is never an anchor. A jump's first airborne frame records
  the last grounded height, so the rise cannot inflate the drop.
- **Void.** The void rule is untouched and independent. The fall anchor is updated
  normally while below the threshold, but a plunge that never lands never reaches the
  landing branch, so only void damage applies.

### Damage formula

Unchanged. Hit points lost by a landing are
`max(0, ceil(delta) − safeFallDistance) × fallDamagePerBlock`, with the existing
`safeFallDistance = 3` and `fallDamagePerBlock = 1`. The `ceil` is retained so any drop
past exactly three blocks costs at least one hit point, and the non-finite guard is
retained so the result is always a whole, finite number.

### Docs and comments

The health spec's fall-distance and fall-damage rules, the one story that pins the apex,
and the architecture reference's fall-rule paragraph are rewritten to describe the
takeoff anchor. The vitals module's comments lose the apex language and describe the
start-height model.

## Testing Decisions

**What makes a good test here:** assert observable external behaviour through the
vitals module's public API, with no WebGL, DOM, or real IndexedDB. The feature's branchy
logic is the damage arithmetic and the airborne transition, so tests supply plain
previous/next `PlayerState` values and assert the resulting health and fall state, never
private helpers. Pure functions that take value in and return value out are the target.

**Seam 1 (existing, primary): the pure vitals module.** `updateVitals` is the highest
point at which takeoff, landing, and damage behaviour is observable without a browser.
One function plus the unchanged hearts mapping covers every rule. This is the same seam
the health feature already uses, so the fix stays inside one module.

**Seam 2 (existing, integration): the headless acceptance flow.** The real `step` and
the real `updateVitals` are chained so a genuine jump off a ledge produces the
takeoff-based damage, proving the rule holds through real physics and not only for
hand-built states. This reuses the established acceptance seam.

**Modules tested and what is pinned:**

- **Vitals module:**
  - a jump off a ledge is measured from takeoff, not the apex (the regression test);
  - the leap-off-a-ledge damage is an exact expected value;
  - a fall of exactly 3.0 blocks is safe, and 3.1 and 4.0 blocks each cost at least 1 HP;
  - damage scales with the distance (`ceil(delta) − 3`);
  - a plain jump that rises and lands back at the same height is safe;
  - landing at or above the takeoff height is free and resets the fall;
  - the landing frame's final descent is included;
  - the fall resets on landing and while grounded, so repeated hops never add up;
  - an airborne update with no start clears the fall on landing (seeding rule);
  - crouching and the movement label do not change the damage;
  - health is clamped to `[0, maxHealth]` and the lethal clamp still reports death;
  - the void cadence, immediate first tick, and timer reset are unchanged.
- **Acceptance flow:** the existing drop, void death, and respawn assertions are updated
  for the renamed state field; where it fits cheaply, a real-physics jump-off-a-ledge
  case asserts the takeoff-based damage.

**Prior art:** the existing focused pure-logic suites (the physics `step` tests that
assert exact derived values, the configuration guard, and the coordinate formatter) and
the headless acceptance flow that composes real domain systems.

**Not unit-tested (consistent with the existing boundary):** the hearts presenter, the
death overlay, pointer-lock release, and the freeze. They need a browser and are covered
by the existing manual acceptance pass; no new test seam or jsdom dependency is added.

**Required commands after the change:** `npm test`, `npm run typecheck`,
`npm run build`. All must pass.

## Out of Scope

- Any change to the damage formula, the safe distance, the per-block cost, or the
  `ceil` rounding.
- Any change to the void rule, its threshold, its damage, or its cadence.
- Lowering the fall start to the apex, to the first frame of negative vertical velocity,
  or to any point other than the last grounded frame.
- Melee, projectile, explosion, lava, fire, drowning, or any non-fall, non-void damage.
- Slow falling, feather falling, water, hay bales, beds, or any landing softener.
- Fall-damage feedback: screen shake, red flash, hurt sound, knockback, or
  invulnerability frames.
- Carrying a fall across a respawn, a dimension change, or a save/load.
- New HUD elements or a numeric fall readout.
- Any new tuning constant, save-schema change, persistence change, or dependency.
- Any change to player physics, `PlayerState`, `step`, the controller, the world, the
  renderer, interaction, or application orchestration.

## Further Notes

- **Why takeoff rather than the apex.** "The fall" is the height the player lost between
  the ground they left and the ground they hit. Anchoring at the last grounded frame
  makes a jump off a ledge cost the same as a walk off it, which is the property the
  player expects and the property the apex rule violated.
- **Why a start height rather than a running sum.** A single stored anchor makes the
  landing arithmetic one subtraction, removes per-frame floating-point accumulation, and
  states the model directly. A signed running sum would telescope to the same number but
  would keep the misleading "distance" shape.
- **Why seed on any airborne frame.** The update only sees a previous and a next state.
  After spawn, load, or respawn the avatar can already be airborne, so seeding whenever
  the anchor is `null` keeps the function total and stops an unusual start from becoming
  a free fall. The common case — spawn on the ground, land on the first frame — yields a
  near-zero delta and is free anyway.
- **Known edge, currently unreachable.** A fall that dips and returns to exactly the
  takeoff height nets to zero. No mechanic can lift the avatar back up without landing,
  so the case cannot occur today; it is noted so a future lift or wind mechanic knows to
  revisit the model.
- **One-frame falls.** A fall that begins and lands within a single update has no
  grounded-to-airborne frame to observe and is not measured. This matches the existing
  behaviour, and the frame delta is clamped and sub-stepped so a full drop cannot occur
  in one frame at the configured speeds.
- **Relationship to the health feature.** This is a focused correction to an existing
  rule, not a new system. It changes the meaning of one piece of vitals state, the code
  that maintains it, the tests that pin it, and the docs that describe it — nothing else
  crosses the seam.
