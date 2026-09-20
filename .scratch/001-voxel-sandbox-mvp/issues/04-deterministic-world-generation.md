# 04 — Deterministic world generation

**What to build:** A pure, seeded generator that fills the world with gentle rolling terrain: an unbreakable floor at the bottom, multiple solid layers above it, and real 3D depth. The same seed, generator version, and parameters always produce bit-for-bit identical terrain, so a world can be reconstructed rather than stored.

**Blocked by:** 03 — World and chunk representation.

**Status:** ready-for-agent

- [ ] A single seeded 32-bit PRNG is created per world, and every generated value derives from it.
- [ ] Generation depends only on seed, generator version, and generation parameters.
- [ ] Terrain is a low-amplitude heightmap around the configured base surface height, clamped between the floor and the world ceiling.
- [ ] Columns are layered bottom-to-top as `bedrock`, `basic_block` fill up to the sampled surface, then air.
- [ ] The output respects world bounds and covers every chunk; no caves, ores, water, biomes, vegetation, or structures are produced.
- [ ] The generator is a pure module with no dependency on persistence or rendering.
- [ ] Unit tests prove same-seed determinism, different-seed variation, presence of a surface with multiple solid layers and a floor, and bounds/chunk coverage — with no WebGL, DOM, or storage.
