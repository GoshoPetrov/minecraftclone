# 03 — World and chunk representation

**What to build:** The authoritative, renderer-independent world. Block data lives in column chunks of `16 (X) × 64 (Y) × 16 (Z)` stored as flat typed arrays, exposed through a small stable API that every other system uses. Out-of-world access is safe, and edits mark exactly the chunks whose geometry could change.

**Blocked by:** 02 — Block model and registry.

**Status:** ready-for-agent

- [ ] Blocks are stored per chunk in flat typed arrays; chunks are addressed by chunk coordinate with a single derived key.
- [ ] The world exposes block get/set/remove, a solidity query, a bounds query, chunk access by chunk coordinate, and dirty marking.
- [ ] Reading outside the world returns empty/not-solid rather than throwing; writing outside the world is rejected.
- [ ] A block edit marks its own chunk dirty, and an edit on a chunk boundary also marks the neighbouring chunk dirty.
- [ ] The API does not assume a permanently small world (world size is not scattered through the codebase).
- [ ] Unit tests cover get/set/remove round-trips, solidity, bounds and safe out-of-bounds reads, chunk-coordinate mapping, and neighbor-aware dirty marking — all without Three.js, a generator, or a browser.
