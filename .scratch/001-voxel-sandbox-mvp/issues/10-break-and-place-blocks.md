# 10 — Break and place blocks

**What to build:** The core build-and-mine loop. Left click breaks the targeted breakable block and it disappears; right click places a block against the targeted face in the adjacent empty cell and it appears immediately. Every placement is validated before anything changes, so rejected actions are harmless. The unbreakable floor, world bounds, occupied cells, and the player's own body are all respected.

**Blocked by:** 09 — Block raycast and target highlight.

**Status:** done

- [ ] Left click breaks the targeted block, removing it from world data and updating visible geometry; one press produces exactly one action.
- [ ] The unbreakable floor cannot be broken, and breaking is rejected for out-of-range or missing targets.
- [ ] Right click places the configured default placeable block in the cell directly adjacent to the hit face (`blockPos + faceNormal`) on every face, giving instant visual feedback.
- [ ] Placement validation is centralised and applied in order: target cell within bounds → target cell is air → target AABB does not intersect the player AABB → block type is placeable. The world never has conflicting or invalid blocks.
- [ ] A rejected break or place leaves world data completely unchanged.
- [ ] A successful edit marks the affected chunk dirty and, on a boundary, the neighbouring chunk too, so geometry updates only where it must.
- [ ] Interaction logic is separated from input handling, and the target highlight is never treated as world state.
- [ ] Unit tests cover breaking, unbreakable/out-of-range/no-target rejection, correct adjacent cell per face, and rejection when occupied, out of bounds, inside the player, or unplaceable — asserting the world is untouched on rejection.
