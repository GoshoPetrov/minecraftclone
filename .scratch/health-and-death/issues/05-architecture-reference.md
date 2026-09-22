# 05 — Architecture reference refresh

**What to build:** Refresh the architecture reference so the next change to health, damage, or death starts from an accurate map rather than re-deriving the vitals, HUD, and orchestration seams from source. Documentation only — no application behaviour changes.

**Blocked by:** 04 — Death, freeze, and respawn.

**Status:** ready-for-agent

- [ ] The vitals module is documented as a pure, DOM-free and renderer-free seam: the vitals value, the fall-distance accumulator, the void timer, the damage rules, the dead condition, and the full/half/empty hearts mapping.
- [ ] Every new tuning constant (`player.maxHealth`, `player.safeFallDistance`, `player.fallDamagePerBlock`, `player.voidY`, `player.voidDamage`, `player.voidDamageIntervalSeconds`) is listed in the configuration section.
- [ ] The contractual per-frame order is updated to place the vitals stage immediately after the physics stage, with the reason, and records that physics is skipped while dead.
- [ ] The HUD section documents the hearts presenter and element and the death overlay presenter and element, including that both are optional game elements and that Respawn reaches orchestration through an explicit callback.
- [ ] The file-by-feature map includes the new vitals module and HUD presenters.
- [ ] No application code or behaviour changes as part of this ticket.
- [ ] `npm test`, `npm run typecheck`, and `npm run build` pass.
