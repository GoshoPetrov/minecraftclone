# 01 — Sprint mode

**What to build:** Hold Left Shift while moving to travel 30% faster than walking in any horizontal direction, with a subtle eased field-of-view widening as feedback and no effect on where the crosshair points. Sprinting requires movement (holding Shift while still does nothing) and persists through a jump.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Holding the configured sprint binding (`input.bindings.sprint = 'ShiftLeft'`) while moving raises horizontal speed to exactly `player.moveSpeed × player.sprintSpeedMultiplier` (1.3×), so a fixed simulated time covers exactly 1.3× the distance of a walk.
- [ ] Sprint works for any horizontal direction, and diagonal sprinting is not faster than axis-aligned sprinting.
- [ ] Holding sprint while not moving produces no movement or speed change.
- [ ] Sprint speed still applies while airborne, and a sprint-jump preserves sprint speed through the jump.
- [ ] The player movement label is `'sprinting'` when grounded and moving with sprint held, `'walking'` when moving without, `'idle'` when still, and `'airborne'` in the air.
- [ ] The camera target field of view is the base field of view × `camera.sprintFovMultiplier` while the movement label is `'sprinting'`, and the base otherwise.
- [ ] The rendered field of view eases toward the target frame-rate-independently over `camera.fovTransitionSeconds`, clamped so a long frame cannot overshoot; field of view affects projection only and never changes the aim direction.
- [ ] `player.sprintSpeedMultiplier`, `camera.sprintFovMultiplier`, `camera.fovTransitionSeconds`, and `input.bindings.sprint` are added to the central tuning configuration, and `sprint` is a required field of the player intent.
- [ ] Config guard tests assert the sprint speed multiplier and field-of-view multiplier are positive, the transition time is positive, and the full binding set stays unique.
- [ ] Sprint is expressed as an intent flag consumed by the pure physics step and surfaced through the movement label, with no Three.js or DOM in the domain path.
- [ ] Sprint state is transient and never persisted; the save schema is unchanged and no new runtime dependency is added.
- [ ] `npm test`, `npm run typecheck`, and `npm run build` pass; the new behaviour is verified headlessly (no browser or WebGL).
