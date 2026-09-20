# Spec 002 — World Size 128 × 128

**Status:** ready-for-agent
**Source:** product conversation (world-size request + grilling session)
**Scope:** widen the horizontally generated world from 32 × 32 blocks to 128 × 128 blocks

---

## Problem Statement

A player exploring the sandbox runs out of world almost immediately. The current
world spans only 32 × 32 blocks horizontally (2 × 2 chunks), so the terrain edge
is always close by and there is very little room to wander, build, or test the
block-editing systems against a real landscape. The world feels like a small
platform rather than a place.

The problem is purely one of extent: the chunk shape, terrain generator, physics,
rendering, and persistence all work, but the default world they are applied to is
too small to be satisfying.

## Solution

Raise the configured world extent to **128 × 128 blocks horizontally**, which the
existing chunk model expresses as an **8 × 8 grid of chunks**. The world stays
**64 blocks tall**, so terrain shaping, physics feel, and rendering setup are
unchanged.

No new systems are introduced. The world size is already declared in exactly one
place and every subsystem receives it from the `World`, so widening the world is a
change to that single tuning value plus a regression test that locks the new
dimension in. Worlds created from this point on are 128 × 128; existing saved
worlds keep the dimensions recorded in their own save metadata, so no work is
lost.

## User Stories

1. As a player, I want a 128 × 128 block world to explore, so that the environment feels expansive instead of cramped.
2. As a player, I want the world to remain 64 blocks tall, so that terrain height and movement feel are unchanged.
3. As a player, I want to spawn near the centre of the enlarged world, so that I have room to explore in every direction.
4. As a player, I want to break and place blocks across the full extent, so that every part of the larger world is usable.
5. As a player, I want the enlarged world to appear progressively rather than after a long freeze, so that entering the game feels responsive.
6. As a player, I want the terrain generator to fill all 64 chunks with hills, so that the whole larger world is varied rather than blank.
7. As a player, I want the new world edges to behave exactly as before, so that nothing surprising happens when I reach them.
8. As a player, I want the larger world to be traversable with the existing movement speed, so that I do not need to relearn the controls.
9. As a player, I want the sky, lighting, and shading to look unchanged over the larger world, so that only the extent changes.
10. As a returning player with an existing save, I want my saved world and edits to keep working, so that widening the default does not destroy my work.
11. As a returning player, I want my saved world to keep the dimensions it was created with, so that the terrain I built against does not shift.
12. As a returning player, I want a clear path to the new size, so that starting fresh gives me the enlarged world.
13. As a developer, I want the world size declared in exactly one place, so that changing it requires a single edit.
14. As a developer, I want every subsystem to keep receiving the size from the `World` rather than a hard-coded constant, so that no other module needs to change.
15. As a developer, I want the chunk shape to remain 16 × 64 × 16, so that mesh building, collision, and coordinate mapping are unaffected.
16. As a developer, I want the world origin and half-open coordinate bounds to remain unchanged, so that all existing coordinate code stays correct.
17. As a developer, I want the chunk-count safety caps to still hold for the new size, so that a corrupt save can never allocate unbounded memory.
18. As a developer, I want no save schema change, so that existing saves remain loadable without migration.
19. As a developer, I want the save metadata to record the dimensions actually used, so that each save always describes the world it came from.
20. As a developer, I want the configured size to serve only as the fallback for a fresh world, so that loading a save stays authoritative about the loaded world.
21. As a developer, I want terrain generation to remain deterministic for a given seed and generation parameters, so that a save reconstructs identically after the change.
22. As a developer, I want no new runtime dependency, so that the change stays within the existing stack.
23. As a developer, I want the per-frame chunk rebuild budget to remain a separate tuning value, so that rendering smoothness stays tunable.
24. As a developer, I want the change to touch only the tuning configuration and its test, so that the blast radius stays tiny.
25. As a developer, I want a regression test that locks the new dimensions, so that a future change cannot silently revert the world size.
26. As a developer, I want the existing acceptance flow to exercise world construction from the configured size, so that the value is proven to flow end-to-end.
27. As a developer, I want the type checker and production build to pass, so that the change is safe to ship.
28. As a developer, I want documentation to stay accurate without duplicating the dimension, so that there is a single source of truth.
29. As a tester, I want a headless test for the dimension, so that I do not need a browser or WebGL to verify it.
30. As a tester, I want per-system tests that construct their own explicit small worlds to keep working, so that the change does not disturb their isolation.
31. As a developer, I want memory and cell counts to stay modest, so that the larger world does not meaningfully increase the game's footprint.
32. As a developer, I want the larger world to remain fully resident, so that no streaming or unloading work is pulled in prematurely.

## Implementation Decisions

### Modules modified

- **The central tuning configuration module.** The world extent constant changes
  from a 2 × 2 chunk footprint to an 8 × 8 chunk footprint, height unchanged at
  one chunk. This is the only production change.
- **The world-configuration test.** Gains one assertion that locks the horizontal
  extent at 128 × 128 blocks. This is the only test change.

No other module changes. The world domain, generator, renderer, physics,
interaction, input, UI, and persistence layers already read their extent from the
`World`/metadata rather than hard-coding it.

### World geometry

- **New world extent: `sizeInChunks = { x: 8, y: 1, z: 8 }`**, i.e.
  **128 (X) × 64 (Y) × 128 (Z) blocks**.
- **Chunk shape is unchanged** at 16 (X) × 64 (Y) × 16 (Z); world height stays 64
  and the single-chunk vertical slice is preserved.
- **64 chunks total, 1,048,576 block cells.** Chunk data is a flat `Uint8Array`,
  so the resident block data grows from ~64 KB to ~1 MB — negligible.
- **World origin stays at `(0,0,0)`** with non-negative, half-open coordinates
  (`x ∈ [0,128)`, `y ∈ [0,64)`, `z ∈ [0,128)`). No negative-coordinate support is
  added by this change.
- **The 3D-chunk / vertical-slicing question is untouched**; the world stays one
  chunk tall.

### Configuration as the single source of truth

- The world extent is declared once in the central tuning configuration and every
  subsystem receives it from the `World`. This change must not introduce a second
  copy of the dimension anywhere.
- The configured extent is the **fallback metadata for a fresh world only**. When
  a save exists, its own `worldParameters.sizeInChunks` is authoritative and the
  loaded world keeps those dimensions.

### Persistence and save compatibility

- **No `saveVersion` bump and no migration.** The save shape is unchanged; an
  existing save remains valid.
- **Existing saves keep their stored dimensions** (typically 2 × 2 chunks). Only a
  brand-new world — no record in storage — picks up the configured 128 × 128
  extent.
- **The new extent is well within the existing safety caps** (max 64 chunks per
  axis, max 4096 total chunks): 8 × 1 × 8 = 64 chunks. The caps are not changed.
- The save metadata continues to record the dimensions actually used, so a save
  always reproduces the world it came from.
- Terrain generation remains deterministic from `seed`, `generatorVersion`, and
  the generation parameters; nothing about the generator's algorithm changes.

### Rendering and performance

- **The per-frame dirty-chunk rebuild budget stays at 2.** With 64 chunks starting
  dirty, the world fills in over roughly 32 frames (about half a second at 60 fps)
  with no long startup stall. This is accepted; the budget remains an independent
  tuning value and is not changed by this spec.
- No fog, view-distance, far-plane, or lighting changes are made; those are not
  required by "make the world 128 by 128".
- The larger world remains fully resident. No chunk streaming or unloading is
  introduced.

### Documentation

- **No documentation changes.** The architecture reference describes the *mechanism*
  (`sizeInChunks`, chunk shape) and not the concrete value, so it stays accurate.
  Duplicating the dimension into prose would create a second source of truth that
  can drift.

## Testing Decisions

**What makes a good test here:** assert the observable, external behaviour of a
module's public API without a WebGL renderer, DOM, or real IndexedDB. For a tuning
constant, the observable behaviour is the value exposed by the configuration
module, so the test asserts the resulting world dimensions rather than inspecting
internals.

**Seam (one, existing):** the central tuning configuration module's exported
`config` object is the highest point at which world extent is observable. The
assertion converts the configured chunk footprint into blocks using the chunk
dimensions and checks that the horizontal extent is 128 × 128 and that the world
stays one chunk tall. No new seam or test file is introduced.

**Module tested:** the central tuning configuration module, via the existing
world-configuration test. **Prior art:** the existing assertions in that test that
already validate generation parameters against the world height.

**Propagation is already covered:** the acceptance flow derives its save metadata
from the configured world size and constructs a world from it, so the configured
value is already exercised end-to-end through metadata → world construction. The
new assertion complements that by pinning the concrete number so a silent revert
is caught.

**Not tested here:** rendering, physics, interaction, and the IndexedDB adapter —
none are affected by an extent change, and per-system tests construct their own
explicit small worlds, so they remain valid and isolated.

**Required commands after the change:** `npm test`, `npm run typecheck`,
`npm run build`. All must pass.

## Out of Scope

- Migrating or rewriting existing saves to the new size; no `saveVersion` bump.
- Expanding the world vertically, or moving to 3D (vertically sliced) chunks.
- A user-facing world-size selector, world list, or seed-entry UI.
- Infinite-world streaming, chunk loading/unloading at distance, and chunk
  eviction.
- Retuning movement speed, interaction range, camera far plane, fog, or view
  distance for the larger world.
- Raising the per-frame rebuild budget or adding eager whole-world meshing.
- Greedy meshing, GPU instancing, ambient occlusion, or other mesh optimisation.
- Updating the historical MVP spec or the architecture reference; the dimension
  remains config-only.

## Further Notes

- **Why no migration:** save data already carries its own dimensions, so widening
  the configured fallback cannot invalidate an existing save. Migrating would
  rewrite worlds the player built against, which is a larger behavioural change
  than the request calls for. A returning player keeps their world; a fresh start
  gets the larger one.
- **Why the config is the right seam:** the project treats the central tuning
  configuration as the tuning surface and makes the world the single source of
  truth for its own extent. Any change that made a subsystem compute its own
  world size would violate that boundary and is explicitly avoided here.
- **Reference for the original dimensions:** the v1 spec recorded a 4 × 4 chunk
  (64 × 64 block) horizontal world; the codebase currently ships 2 × 2 chunks.
  This spec supersedes both for freshly created worlds.
