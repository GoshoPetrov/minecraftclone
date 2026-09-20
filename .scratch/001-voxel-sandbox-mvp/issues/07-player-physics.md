# 07 — Player physics

**What to build:** A deterministic, camera-free simulation of the player as an axis-aligned box: gravity pulls it down, solid blocks stop it, it slides along walls and corners, it can jump only while grounded, and it cannot tunnel through geometry at large frame deltas. Given the same state, intent, world, and delta time, it always produces the same result.

**Blocked by:** 03 — World and chunk representation.

**Status:** done

- [ ] A pure `step(state, intent, world, dt) → state` owns position, velocity, AABB bounds, grounded state, and movement state, with no Three.js or camera dependency.
- [ ] Collision is resolved axis-by-axis (X, then Y, then Z) so sliding along walls, landing on ground, and hitting ceilings all resolve correctly.
- [ ] Gravity is applied and the player lands on solid blocks and stops falling; walking or falling into solid blocks is impossible.
- [ ] Diagonal movement against walls and corners slides correctly rather than sticking or clipping.
- [ ] Jumping is allowed only while grounded and clears grounded immediately, so the player cannot double-jump or fly.
- [ ] Large frame deltas are clamped and movement is sub-stepped so fast motion cannot tunnel through blocks.
- [ ] Gameplay constants (speed, gravity, jump velocity, dimensions, max delta) come from one central config module.
- [ ] Unit tests cover wall/corner sliding, ledge falls, landing/grounded, grounded-only jumping, long-fall safety, tunnelling at large deltas, and a headroom/ceiling case — all headless and with time passed explicitly.
