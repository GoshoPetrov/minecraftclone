# 09 — Block raycast and target highlight

**What to build:** The screen centre reliably selects the block the player is looking at. A voxel ray marches through world data from the eye, stops at the first non-air block within a configured range, and reports which face was hit; a crosshair shows the aim point and an outline follows the target immediately, vanishing when nothing is targeted.

**Blocked by:** 08 — First-person camera, input, and pointer lock.

**Status:** done

- [ ] A raycast over world block data (not a Three.js raycaster) returns `null` or the hit block position, face normal, and distance.
- [ ] The ray starts at the camera eye along the view direction, stops at the first non-air block including bedrock, and is limited to the configurable interaction range.
- [ ] The correct face normal is reported for each of the six faces, and range boundaries behave correctly just inside versus just outside.
- [ ] Targeting returns no target when aiming at air, off-world, or beyond range, so clicks cannot act on distant or absent blocks.
- [ ] A visible crosshair marks the aim point.
- [ ] A block outline is recomputed each frame from the raycast and disappears when there is no target.
- [ ] The highlight is view-only state and is never stored in or read back from the world.
- [ ] Unit tests cover axis-aligned hits, all six face normals, range boundaries, misses, and hits on bedrock with deterministic distance ordering.
