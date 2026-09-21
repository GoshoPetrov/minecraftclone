# 02 — Crouch pose, speed, and safe stand-up

**What to build:** Hold C to crouch — the collision box and eye height drop, horizontal movement slows to 70% slower, and crouch composes with sprint as the product of the two multipliers while the movement state and field of view follow crouch. Releasing C stands the player back up, unless a block is overhead, in which case the player stays crouched until there is headroom. Placement validation uses the crouched box, so a crouched player can place a block in the space their standing head would occupy.

**Blocked by:** 01 — Sprint mode (crouch composes with sprint's speed multiplier and owns the combined label/field-of-view precedence).

**Status:** ready-for-agent

- [ ] `input.bindings.crouch = 'KeyC'` is added, and both `crouch` and `sprint` are required fields on the player intent; idle factories and every construction site supply them explicitly.
- [ ] Player state gains a `crouching` flag, and the collision-box derivation is crouch-aware (height `player.crouchHeight` while crouching, `player.height` otherwise), spans from the feet upward, and leaves the width unchanged.
- [ ] Horizontal speed is the composed rule `moveSpeed × (crouching ? crouchSpeedMultiplier : 1) × (sprinting ? sprintSpeedMultiplier : 1)`, applied whether grounded or airborne; a fixed simulated time covers exactly the crouch ratio (0.3×) and the composed ratio (0.39×).
- [ ] The composed rule is commented at the configuration as deliberate, so a future reader does not "simplify" crouch to win.
- [ ] Movement-label precedence is `airborne` → `sneaking` → `sprinting` → `walking` → `idle`; holding sprint and crouch together reports `'sneaking'`.
- [ ] While the movement label is `'sneaking'`, the camera target field of view is the base field of view (no sprint widening).
- [ ] Releasing crouch while the standing collision box overlaps a solid block keeps `crouching` true; once the player moves into clear space the physics step stands them up.
- [ ] The camera and the raycast origin both use the crouch-aware eye height (`camera.crouchEyeHeight` while crouching, `camera.eyeHeight` otherwise) immediately, with no easing, so aim and view never diverge.
- [ ] The player collision box used for placement validation reflects crouching, so a crouched player may place a block in the space their standing head would occupy.
- [ ] `player.crouchSpeedMultiplier`, `player.crouchHeight`, and `camera.crouchEyeHeight` are added to the central tuning configuration; config guard tests assert `crouchEyeHeight < crouchHeight < height` and the crouch multiplier is positive.
- [ ] The forced-stand-up rule and the crouch-aware bounds are pinned by tests through the pure physics seam with a stub or small world; no WebGL or DOM is used.
- [ ] No save-schema or persistence change is made; crouch is transient and never persisted.
- [ ] `npm test`, `npm run typecheck`, and `npm run build` pass.
