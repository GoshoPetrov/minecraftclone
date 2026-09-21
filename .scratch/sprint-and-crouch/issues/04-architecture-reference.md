# 04 — Architecture reference refresh

**What to build:** Refresh the architecture reference so the next change to player movement starts from an accurate map rather than re-deriving the new modes from source.

**Blocked by:** 03 — Crouch ledge guard.

**Status:** ready-for-agent

- [ ] The player section documents the required `crouch`/`sprint` intent flags, the `crouching` state, the crouch-aware bounds derivation, the movement-state precedence, the composed speed rule, and the crouch-only rule that forces the player to stay crouched under a low ceiling.
- [ ] The crouch ledge guard is documented as a pure-physics rule with its grounded-only, per-axis, whole-footprint behaviour.
- [ ] The input and configuration guidance documents `input.bindings.sprint`, `input.bindings.crouch`, and every new tuning constant, and the keybinding recipe remains accurate (adding a binding needs no input-manager change).
- [ ] The rationale that crouch wins the movement/field-of-view label while the speed remains the product of both multipliers is recorded.
- [ ] No application code or behaviour changes as part of this ticket.
- [ ] `npm test`, `npm run typecheck`, and `npm run build` pass.
