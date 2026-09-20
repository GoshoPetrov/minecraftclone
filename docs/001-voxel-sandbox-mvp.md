# Spec 001 — Voxel Sandbox MVP

**Status:** ready-for-agent
**Source:** `IDEA.md` (Voxel Sandbox Game), `AGENTS.md` (technology + architecture rules)
**Scope:** the complete first playable version (all of `IDEA.md` §52 acceptance criteria)

---

## Problem Statement

A player who wants a Minecraft-inspired sandbox cannot currently run anything: the
repository is an empty project template with no game code, no build tooling, and no
runtime. There is no voxel world to explore, no first-person control, no way to break
or place blocks, and nothing that survives a page reload. `IDEA.md` describes the
desired game in detail but leaves the load-bearing technical decisions unresolved, so
an implementer has no single agreed source of truth to build against.

The gap is not "add a feature" — it is "turn a prescriptive idea document into a small,
correct, maintainable, playable voxel game with a foundation that can grow."

## Solution

Build the smallest complete voxel sandbox: a single-browser, first-person game with a
deterministic procedurally generated 3D world, gravity and collision, mouse-look, block
targeting with a visible highlight, block breaking and placement, and automatic local
persistence that survives reload.

The world is represented as pure block data organised in chunks and is fully
representable without a graphics context. Rendering is a consumer of world state:
chunk-level meshes with visible-face culling, rebuilt only for the chunks a
modification actually affects. The player is simulated independently of the camera, the
world generator is deterministic from a seed, and persistence stores world information
(seed, generator version, parameters, modifications) rather than renderer state.

Everything is TypeScript with strict checking, Three.js for rendering, Vite for
development/build, and Vitest for domain tests. The architecture leaves clean seams for
later systems — more block types, biomes, caves, chunk streaming, inventories,
entities — without a rewrite, while deliberately excluding all of them from v1.

---

## User Stories

### World representation

1. As a player, I want the world to be made of cubic blocks on an integer 3D grid, so that the terrain behaves like a familiar voxel world.
2. As a player, I want `Y` to be the vertical axis and increase upward, so that gravity, jumping, and digging feel natural.
3. As a player, I want blocks to occupy exact unit cells at integer coordinates, so that building and mining land precisely where I aim.
4. As a developer, I want the world's authoritative state to be block data rather than rendered objects, so that gameplay logic can run without a graphics context.
5. As a developer, I want the block at any coordinate to be queryable, so that physics, raycasting, and placement can all ask the same source of truth.
6. As a developer, I want to set and remove blocks through a small stable world API, so that all modification flows go through one place.
7. As a developer, I want a solidity query on the world, so that collision and rendering can share one definition of "solid."
8. As a developer, I want a bounds query on the world, so that out-of-world access is handled safely and consistently.
9. As a developer, I want the world to be organised into chunks, so that the representation can scale beyond a single small world later.
10. As a developer, I want each chunk to own its block data, so that chunk-level operations (messhing, dirtying) have a clear unit.
11. As a developer, I want the world to expose chunk access by chunk coordinate, so that the renderer can build and rebuild meshes per chunk.
12. As a developer, I want out-of-bounds block reads to safely return "not solid / empty" rather than throwing, so that neighbours across the world edge are handled uniformly.
13. As a developer, I want the world API not to assume a permanently small world, so that future larger or streamed worlds do not force a rewrite.
14. As a developer, I want block types to be data-driven, so that future block types can be added without rewriting interaction or physics logic.
15. As a developer, I want rendering never to be the authority on whether a block exists, so that the world can be simulated, saved, and tested headlessly.

### Block types

16. As a player, I want at least one solid block type I can break and place, so that the core build-and-mine loop works.
17. As a player, I want the world floor to be unbreakable, so that I cannot destroy the world's required boundary and fall out of existence.
18. As a developer, I want air represented as an explicit block type, so that queries never have to handle a null block.
19. As a developer, I want each block type to carry its id, name, solidity, breakability, and visual material, so that behaviour is declared as data.
20. As a developer, I want a single block registry that maps ids to block types, so that solidity/breakability rules are defined once.
21. As a developer, I want physics, raycasting, and placement to consult the registry rather than hard-coded block checks, so that new types need no logic changes.
22. As a developer, I want block placement to be expressed in terms of a block type, so that placing is not tied to a hard-coded mesh.
23. As a developer, I want block data to be compact and storable in flat typed arrays, so that chunks do not allocate an object per block.

### World generation

24. As a player, I want a world to be generated automatically on first run, so that I can play without supplying anything.
25. As a player, I want the terrain to have a surface and multiple layers beneath it, so that digging reveals depth rather than a paper-thin sheet.
26. As a player, I want the terrain to be solid and collidable throughout, so that I can stand and dig anywhere sensible.
27. As a player, I want gentle elevation variation, so that exploring, ledges, and drops are meaningful.
28. As a player, I want the generated world to have real 3D depth down to a solid floor, so that I can dig into terrain rather than only rearrange the surface.
29. As a developer, I want generation to be driven by a numeric seed, so that the same seed reproduces the same terrain exactly.
30. As a developer, I want a single deterministic PRNG seeded per world, so that "same seed" implies bit-for-bit identical output.
31. As a developer, I want generation to depend only on seed, generator version, and generation parameters, so that determinism is explicit and testable.
32. As a developer, I want a generator version recorded with the world, so that an intentional generation change does not silently rewrite existing terrain.
33. As a developer, I want the generator isolated from persistence and rendering, so that generation can be tested as a pure function.
34. As a developer, I want the generator interface to leave room for height variation, multiple block types, biomes, caves, ores, water, lava, vegetation, and structures later, so that it can evolve without restructuring the game.
35. As a developer, I want the initial generator to contain no caves, structures, vegetation, water, biomes, or ores, so that the MVP stays intentionally small.

### Chunks and rendering

36. As a player, I want blocks rendered as voxel geometry, so that the world looks like solid cubes.
37. As a player, I want hidden internal block faces not to be drawn, so that the world renders efficiently and looks correct.
38. As a developer, I want block geometry combined into chunk-level meshes, so that the game does not create one permanent object per block.
39. As a developer, I want a face emitted only when its neighbour is non-solid, so that face culling is the single shared rule for visibility.
40. As a developer, I want boundary faces to test the neighbouring chunk's blocks, so that seams between chunks are not missing or duplicated.
41. As a developer, I want mesh building to produce plain typed arrays, so that the visibility logic is unit-testable without WebGL.
42. As a developer, I want a thin adapter to turn mesh data into renderer geometry, so that Three.js stays confined to the rendering layer.
43. As a developer, I want one chunk mesh per chunk, so that rebuilding is scoped to a chunk.
44. As a developer, I want a modified block to mark its chunk dirty, so that geometry updates only where it must.
45. As a developer, I want a boundary modification to also mark the adjacent chunk dirty, so that a formerly hidden face becomes visible correctly.
46. As a developer, I want dirty meshes rebuilt before rendering, with a small per-frame budget, so that rapid edits do not cause frame hitches.
47. As a developer, I want the whole world never to be remeshed for a single block change, so that the game remains scalable.
48. As a player, I want clear lighting on the terrain, so that block shapes and edges are readable.
49. As a player, I want distinct-looking block types, so that different materials are visually distinguishable.
50. As a player, I want the world to fill a simple sky-colored background, so that unbuilt areas read clearly.

### Player, physics, and camera

51. As a player, I want a first-person view, so that I explore the world from my own eyes.
52. As a player, I want to move forward, backward, left, and right, so that I can traverse the terrain.
53. As a player, I want movement relative to where I am facing horizontally, so that controls feel natural regardless of turn direction.
54. As a player, I want gravity to pull me down, so that jumping and falling behave physically.
55. As a player, I want to land on solid blocks and stop falling, so that I can stand on terrain.
56. As a player, I want to be unable to walk or fall through solid blocks, so that collision is trustworthy.
57. As a player, I want diagonal movement against walls and corners to behave correctly, so that I can slide along surfaces rather than sticking or clipping.
58. As a player, I want to jump only while grounded, so that I cannot fly by spamming jump.
59. As a player, I want jumping to stop working in mid-air, so that movement has a consistent rule set.
60. As a player, I want to move the camera with the mouse, so that I can look around freely.
61. As a player, I want unlimited horizontal rotation, so that I can turn in full circles.
62. As a player, I want vertical look clamped to a natural range, so that the camera never flips.
63. As a player, I want the camera to follow my position at eye height, so that the view matches my body.
64. As a player, I want to spawn safely above the terrain with headroom, so that I never start inside a block or in the void.
65. As a player, I want movement and physics to be frame-rate independent, so that the game behaves consistently at different frame rates.
66. As a developer, I want the player to have position, velocity, collision bounds, grounded state, and movement state, so that simulation state is explicit.
67. As a developer, I want player physics independent of the camera object, so that simulation can be tested without rendering.
68. As a developer, I want collision resolved per axis, so that sliding, landing, and ceiling hits resolve correctly.
69. As a developer, I want large frame deltas sub-stepped or clamped, so that fast movement cannot tunnel through blocks.
70. As a developer, I want gameplay constants centralised, so that tuning does not require hunting through unrelated systems.

### Mouse capture and input

71. As a player, I want clicking the game viewport to capture the mouse, so that first-person mouse-look works.
72. As a player, I want the cursor locked to the viewport while playing, so that mouse-look is not interrupted.
73. As a player, I want `Escape` to release the mouse, so that I can leave the game controls.
74. As a player, I want the browser context menu disabled on the game view, so that right-click can place blocks.
75. As a player, I want the game not to require pointer lock permanently, so that it still behaves sensibly if capture is lost.
76. As a player, I want player input paused while the mouse is unlocked, so that I do not accidentally move or place blocks.
77. As a developer, I want all keyboard, mouse, and pointer-lock handling centralised in one input system, so that input is not scattered through the codebase.
78. As a developer, I want key bindings identified by physical key code, so that controls work regardless of keyboard layout.
79. As a developer, I want mouse movement accumulated and consumed once per frame, so that look input is consistent with the update loop.
80. As a developer, I want mouse clicks queued and consumed once each, so that one press produces exactly one action.

### Targeting and interaction

81. As a player, I want the screen center to aim, so that I know what I am acting on.
82. As a player, I want a ray from my view to find the block I am looking at, so that targeting is precise.
83. As a player, I want to know which face of the targeted block I am looking at, so that placement goes on the correct side.
84. As a player, I want targeting limited to a configurable range, so that I cannot interact with distant blocks.
85. As a player, I want no target when nothing is in range, so that clicks do nothing rather than acting unpredictably.
86. As a player, I want the targeted block outlined, so that I can see exactly what I am about to break or build on.
87. As a player, I want the outline to follow my aim immediately, so that targeting feels responsive.
88. As a player, I want the outline to disappear when nothing is targeted, so that the UI reflects reality.
89. As a player, I want left click to break the targeted block, so that I can mine terrain.
90. As a player, I want right click to place a block against the targeted face, so that I can build.
91. As a player, I want a block placed in the empty cell directly adjacent to the hit face, so that building is predictable.
92. As a player, I want a broken block to disappear from the world, so that mining has an effect.
93. As a player, I want a placed block to appear immediately, so that building gives instant feedback.
94. As a player, I want clicks outside range or with no target to do nothing, so that I cannot edit the world from afar.
95. As a player, I want to be unable to break the unbreakable floor, so that the world cannot be destroyed completely.
96. As a player, I want to be unable to place a block into an occupied cell, so that the world never has conflicting blocks.
97. As a player, I want to be unable to place a block outside the world bounds, so that I cannot create invalid terrain.
98. As a player, I want to be unable to place a block inside my own body, so that I never trap myself in geometry.
99. As a player, I want a rejected placement to leave the world unchanged, so that failed actions are harmless.
100. As a developer, I want interaction separated from input handling, so that break/place behaviour can evolve independently of mouse and keyboard.
101. As a developer, I want placement validated against both world data and player collision bounds before any modification, so that validation is centralised and correct.
102. As a developer, I want the target highlight treated as view-only state, never world state, so that rendering aids cannot corrupt the world.

### Persistence

103. As a player, I want my world modifications to survive a page reload, so that my building and mining are not lost.
104. As a player, I want the world to save automatically after meaningful changes, so that I never press save.
105. As a player, I want saves to happen shortly after edits rather than on every block, so that rapid building does not stall the game.
106. As a player, I want a fresh installation with no save to generate a new world, so that I can start playing immediately.
107. As a player, I want a saved world to be restored from its seed and my modifications, so that I return to the world I left.
108. As a player, I want reloading to restore both broken and placed blocks, so that all edits round-trip.
109. As a developer, I want persisted data to contain only world information, so that no meshes, materials, camera, renderer, or GPU state is ever saved.
110. As a developer, I want saved data to include a schema version, a seed, a generator version, generation parameters, and a list of modifications, so that a world can be reconstructed.
111. As a developer, I want the original generated terrain reconstructed by the generator rather than stored block-by-block, so that saves remain small and scalable.
112. As a developer, I want modifications stored as deltas from generated terrain, so that saving grows only with player edits.
113. As a developer, I want a save/schema version validated before use, so that incompatible data is never interpreted as valid world state.
114. As a developer, I want invalid or corrupt save data rejected without crashing, so that a bad save cannot produce a broken game.
115. As a developer, I want a corrupt save preserved (not overwritten) during recovery, so that a load failure does not destroy a potentially valid world.
116. As a developer, I want the system to back up an unreadable save and start a fresh world with a clear notice, so that recovery is explicit rather than silent.
117. As a developer, I want failed saves to leave the in-memory world untouched, so that storage problems cannot corrupt live gameplay.
118. As a developer, I want failed saves surfaced to the player without crashing, so that storage quota or availability problems are understandable.
119. As a developer, I want persistence hidden behind a repository interface, so that the storage backend can change without touching gameplay.
120. As a developer, I want the browser storage adapter to be thin, so that all meaningful persistence logic is testable against an in-memory fake.
121. As a developer, I want modifications applied to the generated world at load time, so that the loaded world matches the saved one exactly.

### World boundaries and safety

122. As a player, I want the world to have finite bounds, so that behaviour at the edges is defined.
123. As a player, I want not to move into invalid world coordinates, so that I cannot leave the playable world accidentally.
124. As a developer, I want block access to handle out-of-bounds coordinates safely, so that edge neighbours and clipped queries never throw.
125. As a developer, I want the world size not hard-coded throughout the codebase, so that the world can grow later without a rewrite.

### UI, loop, and configuration

126. As a player, I want a visible crosshair, so that I know my aiming point.
127. As a player, I want a clear game viewport, so that the World is the focus of the screen.
128. As a player, I want a short control hint, so that I know how to play.
129. As a player, I want non-fatal save/recovery messages shown in-game, so that I understand what happened without losing play.
130. As a developer, I want a clear update/render lifecycle, so that physics, interaction, world data, and rendering never disagree.
131. As a developer, I want the loop to derive movement from delta time, so that it is independent of frame rate.
132. As a developer, I want the update order fixed, so that each frame acts on consistent state.
133. As a developer, I want important constants centralised in configuration, so that tuning is safe and discoverable.
134. As a developer, I want the project to build and typecheck strictly, so that type errors cannot reach runtime.
135. As a developer, I want domain logic covered by unit tests that run without a browser, so that correctness is verifiable in CI.

---

## Implementation Decisions

### Scope and milestones

- **One spec covering the entire MVP.** Delivered as a sequence of tracer-bullet tickets via `to-tickets`, following the dependency order implied here and in `IDEA.md` §54.
- **Acceptance target** is `IDEA.md` §52 in full; nothing in §50 is built.

### World geometry

- **Chunk shape: a column** of `16 (X) × worldHeight (Y) × 16 (Z)`. Chunks are horizontal-only in v1 so there is a single neighbour-rebuild axis; 3D chunk slicing is a later extension that does not change the API.
- **World size: 4×4 chunks = 64×64 blocks horizontally**, `worldHeight = 64`, world origin at `(0,0,0)`, all coordinates non-negative and half-open (`x∈[0,64)`, `y∈[0,64)`, `z∈[0,64)`). No negative-coordinate support in v1.
- **16 chunks total, 262,144 block cells.** The full set stays resident; no streaming or unloading in v1, but chunk-keyed meshes and a chunk-coordinate API keep that path open.
- **Chunk identity:** chunk coordinate `(cx, cz)`; a string key derived from it is the single addressing scheme for storage, meshes, and dirty tracking.

### Block model

- **Block ids are numeric** (`0 = air`, `1 = basic_block`, `2 = bedrock`) so chunk data is a flat `Uint8Array`.
- **Air is a real block type** with `solid: false`, so block queries never return a null/optional.
- **`BlockType` carries `{ id, name, solid, breakable, material }`.** `breakable` models the unbreakable floor as a world/block rule rather than renderer or interaction special-casing.
- **A single `BlockRegistry`** is the source of truth for id → block type. Physics, raycasting, and interaction query it; no hard-coded id checks outside the registry.
- **`material` is a typed descriptor** — v1 is `{ kind: 'color', color }`; the type is open to a future `{ kind: 'atlas', faceUvs }` without changing chunk data.
- **v1 placeable type** is a configured default (`basic_block`). There is no hotbar, inventory, or block selection UI.

### World generator

- **Terrain: gentle seeded hills.** A low-amplitude 2D value-noise heightmap around a base surface height (`≈24 ± 4`), clamped between the bedrock floor and the world ceiling. This keeps generation simple (§8) but makes exploration, ledges, and determinism tests meaningful.
- **Column layering (bottom→top):** `bedrock` at `y = 0`; `basic_block` fill from `y = 1` through the sampled surface height; air above.
- **Determinism source:** a single small seeded 32-bit PRNG (mulberry32-equivalent) created per world; every generated value derives from it, so identical seed + generator version + parameters ⇒ identical terrain.
- **`seed` is numeric**, defaulting to a fixed constant (`1337`) for first generation and persisted thereafter. No seed-entry UI in v1.
- **`generatorVersion` starts at `1`** and is incremented whenever generation output intentionally changes.
- **Generator is a pure module** with no dependency on persistence or rendering; it produces block data for the requested chunks.

### World API and chunk bookkeeping

- **World operations (conceptual, exact signatures are an implementation detail):** `getBlock`, `setBlock`, `removeBlock`, `isSolid`, `isWithinBounds`, `getChunk`, `markDirty`.
- **Out-of-bounds reads return "empty/not solid"** rather than throwing; out-of-bounds writes are rejected. This keeps boundary face culling and player clamping uniform.
- **Dirty tracking lives on the world/chunk layer**, not the renderer: `markDirty` records chunk coordinates (plus neighbours for boundary edits) for the renderer to consume.
- **Rendering queries the world; it never keeps an authoritative copy of block state.**

### Mesh building

- **`buildChunkMesh(chunk, blockAt)` is a pure function** where `blockAt` samples world coordinates, so faces on chunk boundaries test the neighbouring chunk's blocks correctly.
- **Output is `ChunkMeshData`:** plain `positions`, `normals`, `colors`, `indices` typed arrays. No Three.js types cross this seam.
- **Face culling rule:** emit a quad only when the block across that face is non-solid/air. This is the single visibility rule and the primary unit-tested rendering behaviour.
- **A thin renderer adapter** converts `ChunkMeshData` into `BufferGeometry` and manages the per-chunk `Mesh`. Three.js is confined to the rendering layer.
- **Rebuild scheduling:** edits mark affected chunks dirty; the frame loop flushes the dirty set before rendering with a small per-frame budget (≈2 chunks), so rapid edits do not hitch. The whole world is never remeshed for one block change.
- **`WorldRenderer`** orchestrates scene/camera/highlight and owns `ChunkRenderer`, which owns the per-chunk meshes keyed by chunk coordinate.

### Player and physics

- **Collision volume:** AABB, width `0.6` (half-width `0.3`), height `1.8`, feet-centred position. **Eye height** `1.62` above feet is a camera config value, not physics state.
- **Physics is a pure module:** `step(state, intent, world, dt) → state`; no Three.js, no camera. It owns position, velocity, AABB bounds, grounded flag, and movement state.
- **Collision resolution is axis-separated** (X, then Y, then Z), each axis against the voxels overlapped by the moved AABB. `grounded` is set when a downward Y resolution stops motion; jumping is allowed only when grounded and clears `grounded` immediately (no double-jump).
- **Anti-tunnelling:** clamp frame `dt` (≈`0.05 s`) and sub-step when a movement would exceed a safe fraction of a block.
- **Movement is horizontal relative to yaw only.** Spawn: scan the world-centre column from the ceiling for the highest solid block, place feet at `surface + 1`, require two air blocks of headroom, and scan outward if blocked.

### Interaction

- **Raycast: Amanatides–Woo voxel DDA** over `World` data (not a Three.js raycaster), returning `null` or `{ blockPos, faceNormal, distance }`. Origin is the camera eye; direction is camera forward.
- **Range:** configurable `≈5` blocks from the eye.
- **The ray stops at the first non-air block**, including unbreakable bedrock; breakability is a separate registry rule, so bedrock blocks the ray but rejects breaking.
- **Placement cell = `blockPos + faceNormal`**, validated in order: within bounds → target is air → target AABB does not intersect the player AABB → type is placeable. Any failure leaves the world unchanged.
- **One action per mouse press** (left break, right place); no hold-to-repeat in v1.
- **`BlockInteractor`** owns `breakBlock` / `canPlaceBlock` / `placeBlock` and all validation; input handling stays separate.
- **The highlight is view state**, recomputed each frame from the raycast result and never stored in the world.

### Persistence

- **Store: IndexedDB**, a single database with one object store and a single fixed world record. One world in v1; no world list or menu.
- **`SaveData`:** `version` (save schema), `seed`, `generatorVersion`, `worldParameters` (dimensions, chunk size, generator config), and `modifications` — a flat array of `{ x, y, z, type }` deltas from generated terrain, including removals represented as `air`. Array-of-records is chosen over a string-keyed map for compactness, unambiguous validation, and no key-order surprises.
- **`WorldRepository` contract:** `load() → SaveData | null`, `save(data) → void`, `clear() → void`, all async. The IndexedDB adapter implements it; an in-memory fake backs tests.
- **Cadence:** each successful break/place marks the world dirty and schedules a debounced write (≈500 ms), plus a flush attempt on page-hide/visibility change. Gameplay never blocks on a write.
- **Validation is hand-written** (version, seed shape, parameter ranges, coordinate bounds, known block ids). No validation library is added for the small v1 schema; a schema library remains a documented future option.
- **Load ordering:** initialise → attempt load → validate → if valid, restore seed/params, generate base terrain, apply modifications → if absent, generate new → initialise player at a valid spawn → build chunk meshes → render → loop.

### Failure handling

- **No record:** generate silently; not an error.
- **Corrupt or unsupported-version record:** do not apply and do not overwrite. Copy the raw record to a timestamped backup key, start a fresh world, and show a dismissible notice that the old world was backed up. Normal auto-save then writes the new record.
- **Storage unavailable/blocked:** start a new world in memory, disable auto-save, and show a persistent notice; never pretend persistence works.
- **Save failure (quota/IDB error):** leave the in-memory world untouched, keep the dirty flag for retry, surface a non-fatal notice, and reject with a typed error the orchestrator catches. No crash and no world reset.
- All recovery behaviour lives in the orchestration/persistence layer, never in `World`.

### Input and browser integration

- **`InputManager`** owns all listeners and exposes polled state: key-down queries, accumulated mouse delta (consumed once per frame), a queue of mouse presses (consumed once each), and pointer-lock state. Game systems never touch DOM events directly.
- **Keys are identified by physical `event.code`**; bindings live in one config map (`W/A/S/D` move, `Space` jump, mouse move look, LMB break, RMB place, `Escape` releases pointer lock).
- **Pointer lock is requested on canvas click**; `Escape` is left to the browser. Mouse-look and clicks apply only while locked.
- **While unlocked, player input is paused** (movement/look/actions), but rendering and the world/persistence keep running. The overlay reappears with a click-to-play hint.
- **`contextmenu` is prevented** on the canvas so RMB is usable for placement.

### Loop and configuration

- **`GameLoop`** uses `requestAnimationFrame`, computes `dt` from timestamps, and clamps it (`≈0.05 s`) for hitch/tab-switch protection.
- **Fixed update order:** consume input → apply look (clamped pitch) → player physics step → raycast + update highlight → apply queued break/place → flush dirty chunk meshes → render.
- **Variable timestep** in v1 (clamped + sub-stepped), not a fixed-step accumulator; a fixed step can be introduced later if cross-machine physics determinism is ever needed.
- **Persistence debounce is a timer/flag checked in the loop**, decoupled from rendering.
- **Central config module** owns at least: `playerMoveSpeed`, `playerJumpVelocity`, `playerGravity`, `playerWidth`, `playerHeight`, `cameraEyeHeight`, `interactionRange`, `worldWidth`/`worldHeight`/`worldDepth`, `chunkSize`, `worldSeed`, `generatorVersion`, `saveVersion`, `defaultPlaceableBlock`, and the save debounce interval. Values are tuning defaults, and the table below records the agreed starting points:

  | Constant | v1 value |
  | --- | --- |
  | `chunkSize` | 16 |
  | `worldChunksX` / `worldChunksZ` | 4 / 4 |
  | `worldHeight` | 64 |
  | `baseSurfaceHeight` / height amplitude | 24 / 4 |
  | `worldSeed` (default) | 1337 |
  | `generatorVersion` | 1 |
  | `saveVersion` | 1 |
  | `playerWidth` / `playerHeight` | 0.6 / 1.8 |
  | `cameraEyeHeight` | 1.62 |
  | `playerMoveSpeed` | ≈4.3 m/s |
  | `playerGravity` | ≈28 m/s² |
  | `playerJumpVelocity` | ≈8.5 m/s |
  | `interactionRange` | ≈5 blocks |
  | `saveDebounceMs` | ≈500 |
  | `maxFrameDelta` | ≈0.05 s |
  | dirty mesh budget per frame | 2 |

### Project setup

- **Stack:** TypeScript (strict) + Three.js + Vite + Vitest, all added to the existing project; the existing agent dependencies and scripts are preserved and the `AGENTS.md`-prescribed scripts are added alongside.
- **TypeScript config** is a root config with project references so `tsc -b` works (`build` script) and `tsc --noEmit` works (`typecheck`).
- **Entry point:** an HTML page hosting a canvas plus the DOM UI overlay, booted by the app layer which constructs the game.
- **No new runtime libraries** beyond Three.js: no physics engine, no validation library, no UI framework, no GUI package in v1.
- **Module boundaries follow `AGENTS.md`:** `world/` (domain, Three.js-free), `player/`, `interaction/`, `rendering/`, `persistence/`, `input/`, `app/`, `ui/`, `tests/`. Domain logic must not import Three.js.

---

## Testing Decisions

**What makes a good test here:** exercise **external behaviour through the module's public API**, with no WebGL, DOM, or real IndexedDB. Assert on observable outcomes (block contents, returned targets, resulting positions, emitted mesh data, persisted payloads) rather than private fields or internal call sequences. Time is always passed explicitly so physics is deterministic. Existing seams are preferred — and because the project is greenfield, the seams are established deliberately at the pure-logic boundaries described below.

**Seams and modules to test (all Vitest, `node` environment):**

1. **`World` / `Chunk`** — get/set/remove block round-trips; solidity queries; bounds checks and safe out-of-bounds reads; chunk-coordinate mapping; dirty marking (including neighbour marking on boundary edits).
2. **`BlockRegistry`** — id → type lookups; air is non-solid; bedrock is solid and unbreakable; unknown ids handled deterministically.
3. **`WorldGenerator`** — determinism (two runs, same seed/version/params ⇒ identical block data); different seeds ⇒ different terrain; presence of a surface, multiple solid layers below it, and bedrock floor; output respects world bounds and chunk coverage; `generatorVersion` participates in the output contract.
4. **`PlayerPhysics`** — walk into a wall (blocked and slid along); walk along a wall; walk into a corner; walk off a ledge and fall; land and become grounded; jump from grounded; jump rejected while airborne; no fall-through over a long simulated fall; no tunnelling at large clamped/sub-stepped deltas; headroom/hit-ceiling case.
5. **`BlockRaycaster`** — hit on an axis-aligned block; correct `faceNormal` for each of the six faces; range boundary (just inside vs just outside); miss when aiming at air/off-world; hit on bedrock; deterministic distance ordering.
6. **`BlockInteractor`** — break removes the block and marks the right chunk(s); break rejected for unbreakable blocks, out-of-range targets, and no-target; place on each face derives the correct adjacent cell; place rejected when occupied, out of bounds, inside the player's AABB, or no-target; rejected actions leave world data unchanged.
7. **`buildChunkMesh` (mesh data)** — internal faces between two solid blocks are culled; exposed faces are emitted; faces on chunk boundaries are culled/emitted based on the neighbouring chunk's blocks; `ChunkMeshData` arrays are internally consistent (index count matches quad count, colour per block type); rebuilding after a block change yields the expected visible-face set.
8. **`WorldRepository` contract** — tested against an in-memory fake: save→load round-trip; `null` when empty; modifications (including removals) round-trip; clear empties the store. The IndexedDB adapter is a thin implementation of this contract verified manually/in-browser.
9. **Save validation** — valid payloads accepted; wrong/missing/mismatched version rejected; malformed shapes, out-of-bounds coordinates, and unknown block ids rejected without throwing; a rejected load never mutates world state and never overwrites the existing record (asserted through the fake repository).
10. **Config** — constants are exported from a single module and consumed by the systems (smoke-level guard against hard-coded duplicates).

**Not unit-tested in v1 (deliberately):** Three.js geometry/material creation, scene/camera setup, the DOM overlay, pointer-lock behaviour, and the real IndexedDB adapter. These are covered by the **manual in-browser acceptance pass** below.

**Manual acceptance pass (maps to `IDEA.md` §52):** generate a world; spawn safely; WASD + gravity + jump + no double-jump; mouse-look with clamped pitch; pointer lock acquired and released with `Escape`; context menu suppressed; target + highlight; break and place (including rejected cases: inside self, occupied, out of bounds, out of range); reload restores edits; corrupt-save recovery notice; playable at varying frame rates.

**Required commands after any change:** `npm test`, `npm run typecheck`, `npm run build`. All must pass.

---

## Out of Scope

Everything in `IDEA.md` §50, and specifically:

- Multiplayer, networking, accounts, servers, server authority.
- Mobs, NPCs, animals, enemies, combat, health, hunger.
- Inventory, hotbar, items, crafting, farming, equipment.
- Complex procedural terrain, caves, biomes, ores, structures, vegetation, water/lava simulation, points of interest.
- Advanced lighting, dynamic lighting, shadows, day/night cycles, weather.
- Sound effects and music.
- Texture atlas / sophisticated art; v1 uses flat per-type colours.
- GPU instancing, greedy meshing, ambient occlusion, mesh compression.
- Infinite-world streaming, chunk loading/unloading at distance, and other advanced optimisation systems.
- World list / multi-world management and seed-entry UI.
- Hold-to-repeat block breaking/placing.
- Negative world coordinates and 3D (vertically sliced) chunks.
- Fixed-timestep physics determinism across machines.
- Physics engine (Rapier) and schema-validation library (Zod); both remain documented future options.

---

## Further Notes

- **Guiding principle** (`IDEA.md` §57): ship the smallest complete playable voxel sandbox; correctness, maintainability, and a solid foundation outrank feature count.
- **Renderer-independence is the load-bearing constraint.** If a change makes gameplay logic import Three.js, or makes the renderer authoritative about block existence, the change is wrong regardless of convenience.
- **Determinism has two distinct meanings** and must not be conflated: *generation* determinism is required (§48, seed + generator version + params); *physics* determinism across machines is not.
- **`generatorVersion` and `saveVersion` are independent.** Changing generation behaviour bumps the former; changing the save schema bumps the latter. Both are validated on load.
- **Deliberate v1 simplifications that are safe to revisit:** horizontal-only chunks, one resident world of 16 chunks, flat-colour blocks, single placeable type, hand-written validation. Each is isolated behind a seam so it can be upgraded without restructuring.
- **Suggested ticket order** follows `IDEA.md` §54: project/renderer setup → block model → world/generator → chunks → mesh + face culling → player/collision/gravity/jump → camera + pointer lock → raycast + highlight → break → place → persistence + validation → acceptance pass. `to-tickets` should turn this into tracer-bullet tickets with explicit blocking edges.
