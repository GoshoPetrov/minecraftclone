# 06 — Render the world

**What to build:** The generated terrain becomes visible. A thin adapter turns mesh data into renderer geometry, one mesh is kept per chunk, and edits rebuild only the chunks that were marked dirty — with a small per-frame budget so rapid building never hitches. Demonstrable by opening the game and seeing solid, clearly-lit, distinctly-coloured terrain against the sky.

**Blocked by:** 04 — Deterministic world generation; 05 — Chunk mesh building and face culling.

**Status:** ready-for-agent

- [ ] Blocks render as solid voxel cubes with distinct per-type colours and lighting that keeps edges readable.
- [ ] The world fills a simple sky-coloured background and reads clearly against it.
- [ ] The renderer builds one mesh per chunk, keyed by chunk coordinate, and never one permanent object per block.
- [ ] Dirty chunks are rebuilt before rendering with a small per-frame budget; a single block change never remeshes the whole world.
- [ ] The Three.js adapter is confined to the rendering layer, and the renderer treats world data as the authority on block existence.
- [ ] The renderer consumes dirty state from the world layer rather than tracking edits itself.
