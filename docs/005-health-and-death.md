# Spec 005 — Health, Fall Damage, the Void, and Death

**Status:** ready-for-agent
**Source:** product conversation (health + death request + grilling session)
**Scope:** give the avatar hit points, damage it on hard landings and while falling through the void, show the value as hearts, and add a death overlay with a respawn flow

---

## Problem Statement

The avatar is currently invulnerable. It can fall any distance and land unharmed,
and it can walk off the edge of the 128 × 128 world and fall forever with no
consequence other than a strange view. Nothing the player does can ever go wrong in a
way the game acknowledges, so risk, height, and the world boundary all carry zero
weight.

There is also no way to read the avatar's condition. The HUD is a crosshair, the
click-to-play overlay, and persistence notices; there is no health indicator, no
damage feedback, and no way to die or recover. Falling into the void in particular is
a silent, permanent soft-lock: the player keeps falling, the camera follows, and the
only way out is to reload the page.

A voxel sandbox needs a cost to falling and a floor you cannot survive past, and it
needs to show the player where they stand and let them get back into the game.

## Solution

Give the avatar **20 hit points (10 hearts of 2 HP)** and two sources of damage:

- **Fall damage** — landing after a fall of more than **3 blocks** costs
  **1 HP per whole block beyond the safe distance**. A plain jump or a short step
  down is free; a long drop hurts in proportion; a lethal drop kills.
- **The void** — falling below the world (`y < −8`, e.g. after walking off the
  horizontal edge, where the world is air at every height) deals **4 HP every
  half second**, starting immediately, so the void is a slow, visible death rather
  than an instant disappearance.

Health is shown as a row of **10 hearts** (full / half / empty) in the HUD, always
visible while playing.

When health reaches zero the avatar **dies**: the game freezes the avatar in place,
releases pointer lock, and shows a **death overlay** with a **Respawn** button.
Respawn returns the avatar to the deterministic world spawn with full health and
re-locks the pointer. The world, including every block the player edited, is
untouched.

Health is transient: it is never written to the save file, and a reload starts the
avatar at full health at spawn, exactly like the position is not persisted today.

## User Stories

### Taking fall damage

1. As a player, I want a fall of three blocks or less to be safe, so that ordinary jumps and small drops never punish me.
2. As a player, I want a fall of more than three blocks to cost health, so that height carries real risk.
3. As a player, I want the damage to grow with the distance fallen, so that a slightly-too-high drop stings and a long drop is genuinely dangerous.
4. As a player, I want a fall from a lethal height to kill me, so that the world has real stakes.
5. As a player, I want a normal jump on flat ground to never hurt me, so that moving around is not accidentally self-damaging.
6. As a player, I want the fall to be measured from the ground I left, so that the upward arc of a jump does not inflate the drop and jumping off a ledge costs the same as walking off it.
7. As a player, I want fall distance to reset when I land, so that a series of short hops does not add up into a phantom long fall.
8. As a player, I want landing on a block I placed mid-fall to save me, so that building under myself is a valid escape.
9. As a player, I want crouching, sprinting, or being airborne to not change how fall damage is calculated, so that the rule is predictable.
10. As a player, I want fall damage to be whole numbers of hearts, so that the HUD always reads cleanly.

### The void

11. As a player, I want walking off the edge of the world to be punished, so that the world boundary is meaningful.
12. As a player, I want falling into the void to drain my health over a short time, so that I see it happening rather than vanishing instantly.
13. As a player, I want the first void damage tick to land immediately on crossing the threshold, so that the danger is unmistakable.
14. As a player, I want the void to kill me after a few seconds of falling, so that an accidental edge step is recoverable only by immediate action, not indefinitely.
15. As a player, I want the void threshold to sit below the world floor, so that I visibly fall out of the world before I die.
16. As a player, I want void damage to stop and reset if I somehow return above the threshold, so that the timer does not carry over.
17. As a player, I want the void to be lethal regardless of how much health I have, so that no amount of health makes it survivable.

### Dying and respawning

18. As a player, I want to die when my health reaches zero, so that damage has a clear consequence.
19. As a player, I want the game to freeze when I die, so that I do not keep falling through the void behind the death screen.
20. As a player, I want pointer lock released on death, so that I can use the mouse to click Respawn.
21. As a player, I want a clear "You died!" overlay, so that I understand what happened.
22. As a player, I want a Respawn button, so that returning to the game is a deliberate action.
23. As a player, I want respawn to return me to the world spawn, so that I am placed somewhere safe and known.
24. As a player, I want respawn to restore full health, so that death is a clean reset of my condition.
25. As a player, I want respawn to clear my velocity and fall state, so that I do not inherit the momentum that killed me.
26. As a player, I want respawn to keep my view direction, so that returning to the game is not disorienting.
27. As a player, I want my block edits to survive death and respawn, so that dying never costs me my builds.
28. As a player, I want the click-to-play overlay suppressed while dead, so that I never see two overlays fighting each other.
29. As a player, I want respawn to re-capture the pointer, so that I can keep playing immediately without an extra click.
30. As a player, I want break and place actions ignored while dead, so that a stray click on the death screen cannot edit the world.

### Reading my health

31. As a player, I want a row of hearts in the HUD, so that I can read my health at a glance.
32. As a player, I want each heart to represent two hit points, so that the scale is familiar.
33. As a player, I want full, half, and empty hearts, so that odd hit-point values are shown exactly.
34. As a player, I want the hearts always visible while playing, so that I do not have to toggle a panel to see my condition.
35. As a player, I want the hearts to update as I take damage, so that I always see the current value.
36. As a player, I want the hearts to sit clear of the crosshair, so that they do not obstruct aiming.
37. As a player, I want the hearts to not intercept my clicks, so that they never block block interaction.

### Procedural and systemic guarantees

38. As a developer, I want health and damage rules to live in a pure, renderer-independent module, so that they can be simulated and tested headlessly.
39. As a developer, I want the existing movement physics to stay untouched, so that this feature does not destabilise movement, crouch, or the ledge guard.
40. As a developer, I want the pure damage function to consume a previous and a next player state, so that it needs no world, camera, or renderer.
41. As a developer, I want the vitals to live alongside the player state in application orchestration, so that no gameplay state leaks into the UI.
42. As a developer, I want the void timing and fall accumulation owned by the pure vitals function, so that orchestration contains no damage arithmetic.
43. As a developer, I want health to be transient and never persisted, so that the save schema and version do not change.
44. As a developer, I want all new tuning values in the central configuration, so that balancing does not require code changes.
45. As a developer, I want the hearts markup to be driven by a pure mapping function, so that the DOM presenter stays dumb and the mapping is testable.
46. As a developer, I want the death overlay to be an optional game element, so that the game still constructs and runs headless in tests.
47. As a developer, I want the input manager to remain the only owner of pointer-lock calls, so that releasing the pointer follows the existing architecture.
48. As a developer, I want the death overlay's Respawn action to notify orchestration through an explicit callback, so that the UI never reads game systems.
49. As a developer, I want a strict, total damage rule, so that health can never go negative or become non-finite.
50. As a developer, I want the architecture reference kept current, so that the next feature starts from an accurate map of the vitals, HUD, and death seams.

### Verification

51. As a tester, I want the fall-damage threshold and formula pinned by unit tests, so that the safe distance and per-block cost cannot drift silently.
52. As a tester, I want takeoff anchoring, reset, and jump behaviour pinned, so that the "measured from the ground I left" rule is enforced.
53. As a tester, I want the void cadence and immediate first tick pinned, so that the void's lethality and timing are exact.
54. As a tester, I want the health floor and the dead condition pinned, so that death always triggers at zero and never below.
55. As a tester, I want an end-to-end headless flow that drops the avatar and confirms death and respawn, so that the real physics and vitals work together.
56. As a tester, I want the hearts mapping pinned, so that full/half/empty rendering cannot regress.
57. As a tester, I want a manual acceptance pass for the overlays, pointer lock, and hearts, so that the browser-only wiring is still checked.

## Implementation Decisions

### Modules modified

- **New pure vitals module** — owns the vitals value, the fall takeoff anchor, the
  void timer, the damage rules, the dead condition, and the hearts mapping. DOM-free
  and renderer-free.
- **Central tuning configuration** — gains the health, fall, and void constants. No
  existing constant changes.
- **Application orchestration** — owns the vitals value and a `dead` flag; adds a
  vitals update stage after physics; performs death (release pointer lock, show the
  overlay) and respawn (fresh player state, reset vitals, re-lock pointer); suppresses
  the click-to-play overlay while dead; updates the hearts presenter.
- **Game options** — gain optional health and death-overlay elements, spread-guarded so
  the game still runs with no UI.
- **Input manager** — gains a `releasePointerLock` operation. It remains the only
  place that calls the Pointer Lock API.
- **New UI presenters** — a hearts presenter over one element (dumb: reads plain
  numbers, writes DOM), and a death overlay presenter (show/hide plus a Respawn button
  wired to an injected callback).
- **HUD markup and styling** — new hearts and death-overlay elements in the page and
  their stylesheet rules.
- **Entry point** — queries the new elements and passes them to the game when present.
- **Architecture reference** — updated for the vitals module, the config table, the
  update order, the HUD, and the file-by-feature map.

The **player physics, player state, controller, world, interaction, rendering, and
persistence modules do not change.** In particular `step` stays a pure
movement/collision function and `PlayerState` gains no fields.

### Vitals model

Health is **not** added to `PlayerState`. It lives in its own transient value owned by
orchestration, beside the player state. This keeps movement physics single-purpose and
keeps cross-frame damage state (the takeoff anchor, void cadence) out of the pure step
function. The vitals shape (decision-rich, from the grilling session):

```ts
interface VitalsState {
  readonly health: number;            // clamped to [0, maxHealth]
  readonly fallStartY: number | null; // feet Y on the last grounded frame; null when grounded
  readonly inVoid: boolean;           // below the threshold on the last update
  readonly voidDamageTimer: number;   // seconds until the next void damage tick
}

createVitals(): VitalsState
updateVitals(vitals, previous: PlayerState, next: PlayerState, dt: number): VitalsState
isDead(vitals): boolean              // health <= 0
```

The module exposes both a pure `heartStates(health, maxHealth)` mapping returning one
of `full` / `half` / `empty` per heart, so the presenter only renders.

### Damage rules

- **Maximum health:** 20 (10 hearts × 2 HP).
- **Fall measurement:** anchor the fall at the feet Y of the last grounded frame.
  The first frame the avatar is airborne stores `fallStartY = previous.position.y`,
  which covers both the ordinary grounded-to-airborne transition and an update that
  observes the avatar already airborne (a spawn or load in mid-air). The upward arc of
  a jump contributes nothing because the anchor is the ground the avatar left, not the
  apex. While grounded (and on landing) `fallStartY` is `null`, so a walk off a ledge
  starts from the ledge and repeated short hops never add up.
- **Fall damage on landing:** when the transition is airborne → grounded, apply
  `max(0, ceil(max(0, fallStartY − next.position.y)) − safeFallDistance) ×
  fallDamagePerBlock`. The landing frame's own descent is included by construction
  because the anchor is the takeoff height, not the previous frame's height. `ceil` is
  deliberate: any drop past exactly 3 blocks costs at least 1 HP (a 3.9-block fall is
  not free). Landing at or above the takeoff height clamps to zero damage, and
  `fallStartY` is cleared afterwards.
- **Void threshold:** `next.position.y < voidY`. This covers both the horizontal edge
  of the world and any future bottomless world, because out-of-bounds reads are air at
  every height.
- **Void damage:** while below the threshold, deal `voidDamage` immediately on the
  first frame and then every `voidDamageIntervalSeconds`, decrementing the carried
  timer by `dt` and applying a tick whenever it reaches zero. Leaving the threshold
  resets the timer so a later re-entry ticks immediately.
- **Health floor:** health is clamped to `[0, maxHealth]`; it can never go negative or
  become non-finite. `isDead` is `health <= 0`.
- **Attribution:** a fall that kills and a void that kills both simply reduce health;
  there is no separate death cause carried forward. Void damage and fall damage are
  independent (a void fall never lands, so only the void applies).

### Configuration

New `player` constants, all in the central tuning surface:

| Constant | Value | Meaning |
| --- | --- | --- |
| `maxHealth` | `20` | Full health in hit points (10 hearts). |
| `safeFallDistance` | `3` | Whole blocks a fall can cover without damage. |
| `fallDamagePerBlock` | `1` | HP lost per whole block beyond the safe distance. |
| `voidY` | `-8` | Feet height below which void damage begins. |
| `voidDamage` | `4` | HP removed per void tick. |
| `voidDamageIntervalSeconds` | `0.5` | Seconds between void ticks after the first. |

### Death and respawn flow

- Death is detected after the vitals update each frame. On the frame it first becomes
  true, orchestration sets `dead`, releases pointer lock through the input manager,
  and shows the death overlay. The click-to-play overlay is shown only when the
  pointer is unlocked **and** the avatar is not dead.
- While dead, the physics stage is **skipped** so the avatar freezes at the death
  location and no further fall or void damage accrues. Rendering, camera, and the HUD
  continue so the frozen world stays visible behind the overlay; the camera simply
  stops moving.
- The death overlay owns a Respawn button connected to an explicit callback supplied by
  orchestration. The callback builds a fresh player state from the deterministic spawn
  search (`findSpawn(world)`, which reads the current world and therefore respects
  player edits), creates fresh vitals, clears `dead`, hides the overlay, and requests
  pointer lock from the user gesture of the click.
- Camera yaw and pitch are **kept** across respawn; no orientation is persisted or
  reset.
- Break/place actions are already discarded while the pointer is unlocked, so the death
  screen cannot edit the world; this is kept as a guarantee, not re-implemented.

### HUD and presenters

- **Hearts:** a row of 10 hearts, each full / half / empty from `heartStates`. The
  hearts are always visible, positioned clear of the crosshair, and ignore pointer
  events so clicks reach the canvas.
- **Hearts presenter:** dumb over one element; it never reads gameplay state, takes
  only the plain health number, ignores redundant updates, and renders whatever the
  pure mapping returns.
- **Death overlay:** dumb over one element; show/hide plus the Respawn callback. It
  attaches a listener only for the button and holds no game state, keeping the
  click-to-play overlay's "no listeners, no game state" spirit while allowing the one
  required action.
- Both presenters are optional to the game so tests can construct it headless.

### Update order

The vitals stage runs **immediately after the physics stage**, so it observes the exact
grounded transition and position the frame produced, and death is known before
targeting, actions, and the HUD are handled. The debug and health HUD updates stay at
the end of the frame. New order:

```
consumeInput → applyLook → stepPhysics → updateVitals → updateTargeting →
applyActions → flushDirtyMeshes → updateCamera → updateHealthHud → updateDebugReadout
```

The vitals stage replaces physics when dead: physics is skipped, so the same stage
simply does nothing that frame.

### Persistence

- Health, the dead flag, the fall anchor, and the void timer are **transient** and never
  persisted. The save schema, its version, validation, and reconstruction are
  unchanged. A reload always starts at full health at spawn, matching the fact that
  player position is not persisted either.

## Testing Decisions

**What makes a good test here:** assert observable external behaviour through a
module's public API, with no WebGL, DOM, or real IndexedDB. The feature's branchy logic
is the damage arithmetic and the hearts mapping, so tests feed plain values in and
assert the resulting health / heart states, never private helpers or presenter
internals. Pure functions that take value in and return value out are the target.

**Seam 1 (new, the primary seam): the pure vitals module.** It is the highest point at
which fall, void, and death behaviour is observable without a browser, and it is
DOM-free by design. One function plus the hearts mapping covers every rule; the death
overlay, pointer-lock release, freeze, and HUD placement are presentation/orchestration
glue with no branching worth a second seam. This mirrors the repo's precedent of
testing pure `step`, `raycastBlock`, and `validateSaveData`.

**Seam 2 (existing, integration): the headless acceptance flow.** The real `step` and
the real `updateVitals` are chained to prove a genuine fall and a genuine walk off the
world edge produce damage and death, and that a respawn from `findSpawn` recovers. This
reuses the established acceptance seam rather than inventing one.

**Modules tested and what is pinned:**

- **Vitals module** (new test, node environment):
  - a fall of exactly 3.0 blocks is safe, and 3.1 and 4.0 blocks each cost at least 1 HP;
  - damage scales with distance (`ceil(delta) − 3`);
  - a jump off a ledge is measured from the takeoff height, not the apex;
  - a jump off a ledge and a walk off it cost the same;
  - `fallStartY` is seeded by the first airborne frame and cleared on landing;
  - a plain jump (rise then land) is safe;
  - landing at or above the takeoff height is free and resets the fall;
  - the void ticks immediately on entry and then at the configured cadence;
  - leaving the void resets the timer;
  - health is clamped to `[0, maxHealth]`;
  - `isDead` is true exactly at zero;
  - the hearts mapping returns 10 hearts with the correct full/half/empty split for
    even and odd health.
- **Acceptance flow** (extended, existing file):
  - a controlled drop from a lethal height through repeated `step` + `updateVitals`
    ends dead;
  - stepping repeatedly off the world edge kills via the void within the expected time;
  - respawn from `findSpawn` yields a fresh, full-health, grounded-able state.

**Prior art:** the existing focused pure-logic suites (physics `step` tests that assert
exact derived values, the configuration guard, and the coordinate formatter test) and
the headless acceptance flow that composes real domain systems.

**Not unit-tested (consistent with the existing rendering/UI boundary):** the death
overlay, its Respawn button, pointer-lock release, the freeze, the hearts presenter,
and on-screen placement. These need a browser and are covered by the manual acceptance
pass below; no jsdom dependency or new test seam is introduced for them.

**Manual acceptance pass (in-browser):** confirm 10 hearts render and update; jump from
flat ground repeatedly and confirm no damage; fall from a known height and confirm the
expected hearts are lost; walk off the world edge and confirm health drains in visible
steps and death follows; confirm the death overlay appears with the play overlay
suppressed and the avatar frozen; click Respawn and confirm the avatar returns to spawn
at full health, the pointer re-locks, and world edits remain; confirm a stray click
while dead does not break or place a block.

**Required commands after the change:** `npm test`, `npm run typecheck`,
`npm run build`. All must pass.

## Out of Scope

- Regeneration or healing over time, food, hunger, potions, or any way to restore
  health other than respawning.
- Other damage sources: mobs, combat, fire, lava, drowning, suffocation, falling
  blocks, cactus, explosions, or player-versus-player.
- Armor, damage reduction, enchantments, or difficulty settings.
- Damage feedback beyond the hearts: screen shake, red flash, hurt sound, knockback, or
  invulnerability frames.
- Death drops, an inventory, item loss, or a death location/gravestone.
- A death message cause ("fell from a high place", "fell out of the world"), a death
  counter, or a score.
- Persisting health, death state, or a respawn point; any save-schema or version change.
- Respawning at a bed, checkpoint, or last-safe-position rather than the world spawn.
- Changing the world, spawn search, or terrain so the void is reachable other than at
  the horizontal edge (for example digging below bedrock).
- A general damage/effect system, damage types, or resistance.
- Additional HUD elements: hunger, armor, air/bubbles, XP, or a numeric health readout.
- Pausing the whole game world (only the avatar's simulation is frozen on death).
- Mobile/touch equivalents, on-screen respawn gestures, or a key binding for respawn.
- Any new runtime or test dependency.

## Further Notes

- **Why vitals are separate from `PlayerState`.** `PlayerState` is documented as the
  movement/collision state that `step` reads and produces, and `step` is deliberately
  pure and single-purpose. Fall damage needs cross-frame state (a takeoff anchor and a
  landing transition); putting it in `step` would couple collision to health.
  A separate transient value beside the player state keeps `step` unchanged and the
  damage rules fully testable with plain previous/next states.
- **Why `ceil`, not `floor`.** With `floor`, a 3.9-block fall would be free and only a
  full 4.0-block drop would hurt, which is inconsistent with "3 blocks is safe". `ceil`
  makes any drop past exactly three blocks cost at least one HP and matches the
  reference feel.
- **Why the fall is anchored at takeoff rather than the apex.** `step` applies gravity
  and resolves the ground each slice, so the height the avatar actually lost is the
  difference between the ground it left and the ground it hit. Anchoring at the last
  grounded frame makes a jump off a ledge cost the same as a walk off it — the
  property the apex rule violated — while a plain jump on flat ground still nets to
  zero. The first airborne frame records the anchor, so the rise of a jump can never
  inflate the drop.
- **Why the void threshold is below the world.** Bedrock at the world floor is
  unbreakable, so the only practical void is walking off the horizontal edge, where the
  world is air at every height. A threshold a few blocks below the floor lets the
  player visibly fall out of the world before the damage accumulates, instead of dying
  the instant their feet pass y = 0.
- **Why damage over time for the void.** An instant kill at the threshold is abrupt and
  gives no chance to react; a slow drain is the recognisable void behaviour, is visible
  in the hearts, and still guarantees death. The immediate first tick keeps it from
  feeling toothless.
- **Why the world edits survive.** The world is the single source of truth and is
  persisted as deltas independently of the avatar. Respawn only resets the avatar, so
  dying never costs the player their build; `findSpawn` re-reads the current world so
  the respawn respects those edits.
- **Why freeze rather than keep simulating.** Leaving physics running behind the death
  overlay would let the corpse keep falling through the void, and would keep draining
  health that no longer matters. Freezing makes death a clear end state and keeps the
  overlay's view stable.
- **Relationship to existing systems.** This is a clean exercise of the layers: pure
  vitals logic, tuning in config, orchestration in `Game`, dumb presenters in `ui`, and
  static markup. The world, renderer, interaction, and persistence modules are
  untouched, so the blast radius is small and the architecture's dependency direction
  is preserved.
