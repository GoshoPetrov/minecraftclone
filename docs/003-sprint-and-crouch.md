# Spec 003 — Sprint and Crouch

**Status:** ready-for-agent
**Source:** product conversation (sprint + crouch request, grilling session)
**Scope:** add a sprint movement mode (Left Shift) and a crouch/sneak mode (C) with ledge protection, to the existing first-person player

---

## Problem Statement

A player navigating the voxel world has exactly one gear: a single walking speed, a
single standing pose, and no way to protect themselves near an edge. Crossing a wide
world is slow, and working on a raised structure is risky — a small overshoot while
walking toward a ledge sends the player over the side, and every fall is a full
re-climb.

The player cannot move faster over open ground, cannot slow down and lower their
profile for precise work, and cannot walk up to a drop without the game trying to
punt them off it. Minecraft-style traversal relies on exactly these two modes, and
their absence makes the existing movement feel flat and the building system
frustrating to use near height.

## Solution

Add two first-class movement modes to the player:

- **Sprint** — while **Left Shift** is held and the player is moving, horizontal
  speed is **30% faster**. A subtle, eased field-of-view increase communicates the
  state, and the mode is preserved through a jump.
- **Crouch / sneak** — while **C** is held, the player's collision box and eye
  height are both lowered, horizontal speed is **70% slower**, and the player
  **cannot walk off a ledge**: crouching holds the player to the last supported
  block. Releasing C restores the standing pose, unless a block is in the way, in
  which case the player stays crouched until there is headroom.

The two modes compose: holding both moves at `0.3 × 1.3 = 0.39×` walking speed with
ledge protection still active. Jumping while crouched still works and can still carry
the player off a ledge — crouch protects *walking* off an edge, not *jumping* off it.

All behaviour is renderer-independent: sprint and crouch are expressed as intent
flags fed to the existing pure physics step, the world remains the sole authority on
what is solid, and the camera is the only place where the new modes become visual.
Both modes are transient input state and are never persisted.

## User Stories

### Sprint

1. As a player, I want to hold Left Shift to move faster, so that crossing open ground takes less time.
2. As a player, I want sprinting to be 30% faster than walking, so that it feels meaningfully quicker without becoming uncontrollable.
3. As a player, I want sprinting to work in any horizontal direction, so that I am not forced to face forward to use it.
4. As a player, I want sprinting to require movement, so that holding Shift while standing still does nothing.
5. As a player, I want sprinting to persist through a jump, so that jumping while running does not suddenly slow me down.
6. As a player, I want a subtle widening of my view while sprinting, so that I have immediate visual feedback that the mode is active.
7. As a player, I want the field-of-view change to ease in and out, so that it feels smooth rather than snapping.
8. As a player, I want the field-of-view change to never affect where I am aiming, so that sprinting does not make my crosshair lie to me.
9. As a player, I want diagonal sprinting to be the same speed as straight sprinting, so that no direction is secretly faster.
10. As a player, I want sprinting to stop cleanly when I hit a wall, so that I do not stick or clip.

### Crouch / sneak

11. As a player, I want to hold C to crouch, so that I can enter a low, careful mode.
12. As a player, I want to release C to stand back up, so that crouching is a temporary state, not a toggle I can forget.
13. As a player, I want my collision box to become shorter while crouching, so that I can duck under a 1.5-block-high gap.
14. As a player, I want my camera to drop while crouching, so that I visually feel lower.
15. As a player, I want crouch movement to be 70% slower, so that I can stop precisely where I intend to.
16. As a player, I want crouch speed to apply in the air too, so that the movement rule is consistent and predictable.
17. As a player, I want my crosshair to keep matching my camera while crouching, so that aiming stays truthful at both eye heights.

### Ledge protection (the core of crouch)

18. As a player, I want crouching to stop me walking off a ledge, so that I can work at height without falling.
19. As a player, I want to be able to lean out over the edge, so that I can still look down and reach blocks near the drop.
20. As a player, I want to stop only when my whole body has cleared the block, so that an invisible wall does not stop me short of the visual edge.
21. As a player, I want to keep sliding along the edge on the unblocked axis, so that I can shuffle sideways along a ledge without getting stuck.
22. As a player, I want crouch to also stop me stepping down a one-block drop, so that sneaking at a low ledge is safe too.
23. As a player, I want ledge protection only while I am on the ground, so that it does not behave strangely mid-air.
24. As a player, I want to still fall if the block beneath me is removed, so that crouching is not a floating exploit.
25. As a player, I want to still be able to jump while crouched, so that crouching is not a trap I cannot leave.
26. As a player, I want a crouch-jump to still be able to carry me off a ledge, so that I can deliberately leave the edge when I want to.

### Standing up safely

27. As a player, I want to stay crouched if I release C under a low ceiling, so that I do not clip into the block above me.
28. As a player, I want to pop up automatically once I have walked into a clear space, so that I do not have to think about the ceiling.

### Combining the modes

29. As a player, I want holding both Shift and C to compose the two speed modifiers, so that the behaviour is a predictable product of the two modes.
30. As a player, I want crouch to take visual and movement-state precedence when both are held, so that I always feel like I am sneaking when I am.
31. As a player, I want no sprint field-of-view kick while crouched, so that the visual state matches the crouch.

### Procedural and systemic guarantees

32. As a developer, I want sprint and crouch expressed as fields on the player intent, so that the pure physics step stays the single place movement is decided.
33. As a developer, I want the physics step to remain pure and stateless, so that the same inputs always produce the same result and it stays trivially testable.
34. As a developer, I want the crouch state to live on the player state, so that the camera and collision box read one authoritative value rather than re-deriving it.
35. As a developer, I want the player collision-box bounds to remain derived from position and crouch state, so that bounds can never drift from the player.
36. As a developer, I want the collision box used for placement validation to reflect crouching too, so that a crouched player can place a block in the space their standing head would occupy.
37. As a developer, I want every new speed and dimension constant to live in the central tuning configuration, so that tuning never requires editing a system.
38. As a developer, I want the new key codes to be ordinary entries in the configured bindings, so that the input manager needs no new code.
39. As a developer, I want the camera to own the field-of-view easing, so that visual smoothing never leaks into gameplay logic.
40. As a developer, I want no change to the save schema, so that existing saves remain loadable and transient movement modes are never persisted.
41. As a developer, I want no new runtime dependency, so that the change stays within the existing stack.
42. As a developer, I want strict type checking to catch every construction site of the changed intent and input shapes, so that no caller silently forgets a flag.
43. As a developer, I want the movement-state label to carry the new modes, so that future animation and HUD work has one derived source to read.
44. As a developer, I want the architecture reference kept current, so that the next change to player movement starts from an accurate map.

### Verification

45. As a tester, I want sprint, crouch, and their composition verified as exact speed ratios, so that the tuning cannot silently drift.
46. As a tester, I want the ledge guard, forced stand-up, and crouch-jump edge cases each pinned by a test, so that a future edit cannot quietly break the feel.
47. As a tester, I want to verify all of this headlessly without a browser or WebGL, so that the suite stays fast and reliable.

## Implementation Decisions

### Modules modified

- **Central tuning configuration** — gains the new speed multipliers, crouch
  dimensions, sprint field-of-view multiplier and easing time, and the two new key
  bindings.
- **Player domain (state + intent + bounds)** — gains a `crouching` flag on the
  player state, `crouch`/`sprint` flags on the intent, the two new movement-state
  labels, and a crouch-aware collision-box derivation.
- **Player controller** — maps the new held buttons onto the intent.
- **Player physics** — applies the composed speed, the crouch hitbox, the forced
  stand-up rule, and the ledge guard.
- **Application orchestration** — polls the new bindings, forwards the crouch eye
  height and the target field of view to the camera, and uses the crouch-aware eye
  position for targeting.
- **Renderer / camera adapter** — accepts an explicit eye height and a target field
  of view, and eases the field of view toward the target.
- **Architecture reference** — updated for the player, input, and configuration
  sections and the keybinding recipe.

The input manager itself does **not** change: it already tracks exactly the codes
listed in the configured bindings, so adding two bindings is sufficient.

### Configuration values (the tuning surface)

- `player.sprintSpeedMultiplier = 1.3` — 30% faster than walking.
- `player.crouchSpeedMultiplier = 0.3` — 70% slower than walking.
- `player.crouchHeight = 1.5` — crouched collision-box height, from the feet.
- `camera.crouchEyeHeight = 1.2` — crouched camera height, from the feet.
- `camera.sprintFovMultiplier = 1.15` — 15% wider field of view while sprinting.
- `camera.fovTransitionSeconds = 0.2` — time constant for the easing.
- `input.bindings.sprint = 'ShiftLeft'`, `input.bindings.crouch = 'KeyC'` —
  physical key codes, so the bindings remain layout-independent.

The composed horizontal speed rule is, verbatim:

```
speed = playerMoveSpeed
      × (crouching ? crouchSpeedMultiplier : 1)
      × (sprinting ? sprintSpeedMultiplier : 1)
```

Walking `4.317`, sprint `5.612`, crouch `1.295`, crouch+sprint `1.684` blocks per
second. This composition is deliberate and must be commented as such at the config,
because it is unusual and a future reader will otherwise "simplify" crouch to win.

### Player intent and state (the type shapes)

The changed shapes (for reference; treat as the decision-rich contract):

```ts
type PlayerMovementState =
  | 'idle' | 'walking' | 'sprinting' | 'sneaking' | 'airborne';

interface PlayerIntent {
  move: { x: number; z: number };
  jump: boolean;
  crouch: boolean;   // required
  sprint: boolean;   // required
}

interface PlayerState {
  position: Vec3;
  velocity: Vec3;
  grounded: boolean;
  movement: PlayerMovementState;
  crouching: boolean; // required
}
```

- Both new intent flags and the two new movement-input flags are **required**, not
  optional. Strict typing then forces every construction site to state them
  explicitly. The idle factories set both to `false`.
- `crouching` lives on the **state**, not only the intent, because the physics step
  can *force* it to remain true (forced stand-up) and because the camera and
  collision box must read one authoritative value.
- Movement-state precedence, highest first:
  `airborne` → `sneaking` → `sprinting` → `walking` → `idle`.

### Collision box

- The collision-box derivation becomes crouch-aware: the height is
  `crouchHeight` while crouching and `height` otherwise; width is unchanged.
- The box still spans from the feet upward, so crouching lowers the head, not the
  feet.
- The placement-validation call site passes the current crouch state, so a crouched
  player may place a block in the space their *standing* head would occupy. If they
  then try to stand, the forced stand-up rule keeps them crouched — the two rules
  agree.

### Physics: speed

- The horizontal speed for a sub-step is the composed value above, applied whether
  the player is grounded or airborne. Crouch is intentionally **not** ground-gated
  for speed; only the ledge guard is.
- Wish-direction normalisation is unchanged, so diagonal input is still not faster
  than axis-aligned input in any mode.

### Physics: forced stand-up

- If the state is crouching and the intent is not crouching, the physics step tests
  the **standing** box at the current position against the world.
- If that box overlaps a solid block, the step keeps `crouching = true` and the
  player stays down. Otherwise the player stands.
- The test is evaluated within the pure step, so it is deterministic and testable
  with a stub world.

### Physics: ledge guard

- The guard applies only when `crouching` **and** `grounded`, and only to horizontal
  movement. Vertical motion is never altered, so destroying the block beneath a
  crouched player still drops them.
- The guard is evaluated **per horizontal axis, independently, per sub-step**, so the
  player can slide along an edge on the unblocked axis rather than sticking.
- For a candidate axis position, the player is **supported** when *any* solid world
  block exists in the layer directly beneath the feet, where the shifted player
  footprint overlaps that block. If the candidate is unsupported, the axis move is
  cancelled — position unchanged, that axis's velocity zeroed — and the other axis
  still proceeds.
- The whole-footprint test (rather than the centre point) is what allows the player
  to lean out until the *entire* footprint clears the block, and it is what makes a
  one-block step-down behave like an edge. This matches the reference game's
  "clamp unless there is ground within a small step below" rule.
- The guard must not depend on the grounded flag being reset before the horizontal
  passes in the current step order; the implementation threads a per-sub-step
  "was grounded" value (or tests current support at the feet) so the X and Z axes
  are treated identically.
- Jumping is unaffected. A crouch-jump lifts the player off the ground, the guard
  disengages for that airborne period, and the player can therefore leave the ledge
  deliberately.

### Camera and targeting

- The eye height is **not eased**: the camera and the raycast origin both use the
  logical crouch eye height immediately, so aim and view never diverge. Crouching
  pops the view by design in this change.
- The camera adapter accepts the eye height and the target field of view explicitly
  rather than reading the camera config statically, so the renderer stays a thin
  adapter over plain values.
- Targeting uses the same state-derived eye height as the camera.
- The target field of view is the configured base field of view multiplied by the
  sprint multiplier when the movement state is `sprinting`, and the base otherwise.
  Because Shift+C reports `sneaking`, there is no sprint field-of-view kick while
  crouched.
- The adapter eases its actual field of view toward the target with a
  frame-rate-independent exponential approach using the frame delta and the
  configured time constant, clamped so a long frame cannot overshoot. Field of view
  affects projection only and therefore can never change the raycast direction.

### Input and orchestration

- The two new bindings are polled once per frame alongside the existing movement
  buttons and folded into the movement input.
- Player input remains paused while the pointer is unlocked, as today.
- No persistence is scheduled by either mode. Transient movement state is not saved
  and the save schema is unchanged.

## Testing Decisions

**What makes a good test here:** assert observable behaviour through a module's
public API, with no WebGL, DOM, or real IndexedDB. For this feature the observable
behaviour is the next player state produced by the pure physics step (position,
velocity, grounded flag, crouch flag, movement label) and the intent produced by the
controller. Assert on those outcomes, not on private helpers or the internal order
of collision resolution. Time is always passed explicitly.

**Seam (primary, existing): the pure physics step.** The step function is the highest
point at which every gameplay decision of this feature is observable, and it already
takes a `SolidWorld`, so tests can use a small stub world or a tiny real world with a
single platform. This is the one seam that matters; the remaining tests are input
mapping and a configuration guard.

**Modules tested and what is pinned:**

- **Player physics** (extend the existing physics test file):
  - sprint moves exactly `sprintSpeedMultiplier` times as far as walking in the same
    simulated time;
  - crouch moves exactly `crouchSpeedMultiplier` times as far;
  - holding both moves exactly `crouchSpeedMultiplier × sprintSpeedMultiplier` times
    as far;
  - the crouched collision box is `crouchHeight` tall and the standing box is
    `height` tall, via the public bounds derivation;
  - releasing crouch under a low ceiling keeps `crouching` true, and the player
    stands once moved into clear space;
  - on a small platform, crouch-walking toward the edge stops with the player still
    supported, while the same input without crouch walks off and falls;
  - crouch-walking along an edge still translates on the unblocked axis;
  - a crouch-jump can still leave the ledge;
  - the crouch speed multiplier applies while airborne;
  - the movement label follows the documented precedence.
- **Player controller** (extend the existing controller test file): the held crouch
  and sprint buttons map onto the intent flags, and the idle input maps to both
  `false`. The existing test helper already spreads the idle input, so it absorbs the
  new required fields.
- **Configuration guard** (extend the existing config test file): the new multipliers
  are positive, `crouchEyeHeight` is less than `crouchHeight`, the crouch height is
  less than the standing height, and the new bindings are present and the full set of
  key codes remains unique.

**Prior art:** the existing `PlayerPhysics.test.ts` (stub/floor world setup,
`moveIntent`/`runSteps`/`overlapsSolid` helpers), the "movement intent" block in
`PlayerController.test.ts`, and the "valid player physics constants" and "input
binding constants" assertions in `Config.test.ts`. A shared intent helper will be
added so the required flags are supplied in one place.

**Not unit-tested (consistent with the existing rendering boundary):** the sprint
field-of-view easing and the crouch eye height in the Three.js camera adapter. The
project deliberately does not unit-test the rendering layer; these are covered by the
in-browser acceptance pass. No new seam is introduced for this low-value math.

**Manual acceptance pass (in-browser):** walk, sprint, and crouch on flat ground and
confirm the three speeds and the field-of-view kick; crouch-walk to a ledge and
confirm the player stops while still leaning over the edge; slide along the edge;
crouch under a low gap and stand up; crouch-jump off a ledge; confirm the crosshair
still matches the visible eye at both heights; confirm no regressions to jumping,
wall sliding, placing, or breaking.

**Required commands after the change:** `npm test`, `npm run typecheck`,
`npm run build`. All must pass.

## Out of Scope

- A toggle-crouch mode or a settings UI for it; crouch is hold-only.
- Double-tap-to-sprint or any sprint binding other than Left Shift.
- Blocking jump while crouched, and any "crouch disables jump" behaviour.
- A crouch field-of-view change (sneaking does not narrow the view).
- Easing or smoothing the crouch eye height; the camera snaps in this change.
- Sprinting only while moving forward, or sprinting that stops when air control is
  lost; the mode is direction-agnostic and air-preserved as specified.
- Sprint particles, footsteps, sound effects, or a sprint/sneak HUD indicator.
- Third-person animation, character models, or idle/walk/sneak animation states.
- Persisting sprint or crouch state; both are transient input state.
- Any change to the save schema, persistence cadence, or world generation.
- Changes to interaction range, block placement rules (beyond reflecting the crouch
  hitbox), or the world size.
- Any new runtime dependency.

## Further Notes

- **Why crouch wins the state label but not the speed.** When both keys are held the
  speed is the product of both multipliers (`0.39×`), but the movement label and the
  field-of-view target follow crouch. The stance is "sneaking"; the number is the
  product. This split is intentional and should be documented at the config and in
  the architecture reference.
- **Why the whole footprint, not the centre.** A centre-point check stops the player
  roughly half a block before the visible edge, which reads as an invisible wall. A
  footprint check lets the player hang the body out over the drop and matches the
  reference game's feel.
- **Why the ledge guard is grounded-only.** Gating on being on the ground keeps one
  coherent rule — crouch blocks *walking* off an edge, not *jumping* off it — and
  avoids a mid-air "hover" exploit. It also makes crouch-jump a deliberate escape
  hatch rather than a trap.
- **Why crouch lives on state.** Forced stand-up means the state can disagree with
  the intent; the camera and collision box must read the state, not the raw input.
  Keeping the derivation on state is what prevents the camera and the hitbox from
  disagreeing during a stand-up frame.
- **Layering.** This feature is a clean exercise of the existing layers: intent and
  state in the player domain, speed and guard in the pure physics step, input polled
  through the one input manager, and the only Three.js touch is the camera adapter.
  No world, interaction, persistence, or generator code changes.
- **Relationship to the movement-state label.** The architecture reference documents
  the movement label as derived state for animation and UI; this feature is its first
  real consumer, and the new labels are added now so future animation work has a
  single derived source rather than reconstructing "am I sprinting" from raw speed.
