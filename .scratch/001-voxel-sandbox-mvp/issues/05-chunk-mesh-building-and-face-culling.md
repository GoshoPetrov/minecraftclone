# 05 — Chunk mesh building and face culling

**What to build:** A pure function that turns a chunk's block data into plain geometry arrays, emitting a quad only when the block across that face is non-solid. Because it samples blocks through a world-coordinate callback, faces on chunk boundaries correctly test the neighbouring chunk. This is the single visibility rule the whole renderer depends on, and it is testable with no WebGL.

**Blocked by:** 03 — World and chunk representation.

**Status:** done

- [ ] A pure `buildChunkMesh(chunk, blockAt)` produces `ChunkMeshData` containing only plain `positions`, `normals`, `colors`, and `indices` typed arrays — no Three.js types cross the seam.
- [ ] A face is emitted only when the neighbouring cell is non-solid; internal faces between two solid blocks are culled.
- [ ] Faces on a chunk boundary are culled or emitted based on the neighbouring chunk's blocks, so seams are neither missing nor duplicated.
- [ ] The returned arrays are internally consistent: index counts match emitted quads and each quad's colour comes from its block type.
- [ ] Rebuilding after a block change yields exactly the expected visible-face set.
- [ ] Unit tests cover culling, exposed faces, boundary cases, and array consistency without a browser.
