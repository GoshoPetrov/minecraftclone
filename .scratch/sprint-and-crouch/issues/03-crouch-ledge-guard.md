# 03 — Crouch ledge guard

**What to build:** While crouched and on the ground, crouch-walking cannot carry the player off a ledge: the player stops while still able to lean their body out over the edge, and can slide sideways along the ledge on the unblocked axis. Protection applies only to walking, not to jumping or to time in the air; removing the block beneath a crouched player still drops them.

**Blocked by:** 02 — Crouch pose, speed, and safe stand-up.

**Status:** ready-for-agent

- [ ] On a platform, crouch-walking toward the edge stops with the player still supported, while identical input without crouch walks off and falls.
- [ ] The guard tests the whole player footprint (not the centre) in the layer directly beneath the feet, so the player may lean out until the entire footprint clears the block and a one-block step-down is treated as an edge.
- [ ] The guard is evaluated per horizontal axis, independently, per sub-step: a blocked axis is cancelled (position unchanged, that axis's velocity zeroed) while the other axis still translates, so the player slides along an edge instead of sticking.
- [ ] The guard applies only when the state is both crouching and grounded, and it never alters vertical motion — removing the block beneath the crouched player still makes them fall.
- [ ] The X and Z axes are treated identically within a sub-step (the guard does not depend on the grounded flag being reset before the horizontal passes).
- [ ] A crouch-jump lifts the player off the ground, disengages the guard for the airborne period, and can still carry the player off the ledge.
- [ ] Every case above is pinned by tests through the pure physics seam; no WebGL or DOM is used.
- [ ] `npm test`, `npm run typecheck`, and `npm run build` pass.
