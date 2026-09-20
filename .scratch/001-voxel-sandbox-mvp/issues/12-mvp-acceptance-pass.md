# 12 — MVP acceptance pass

**What to build:** The finished MVP: a short control hint and consolidated non-fatal in-game notices, plus a complete manual acceptance run proving the whole playable flow — generate or restore a world, explore with gravity and jumping, look with clamped pitch and pointer lock, target and highlight, break and place (including every rejected case), reload to restore edits, and recover from a corrupt save — works at varying frame rates. Also confirms the quality gates.

**Blocked by:** 11 — Persistence and save validation.

**Status:** done

- [ ] A concise control hint is visible so a new player knows how to play.
- [ ] Save/recovery/storage notices are shown in-game, are non-fatal, and do not interrupt play.
- [ ] Every `IDEA.md` §52 acceptance criterion is verified through a manual in-browser pass, mapped to the required playable flow.
- [ ] Rejected interactions (inside self, occupied, out of bounds, out of range) are confirmed to do nothing.
- [ ] Reload restores all modifications, and corrupt-save recovery is confirmed to back up and start fresh with a notice.
- [ ] The game remains playable at varying frame rates.
- [ ] `npm test`, `npm run typecheck`, and `npm run build` all pass.
