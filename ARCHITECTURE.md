# Architecture

A fast-reference guide to the major components of the voxel sandbox and the
extension points for new features. Read this before adding a system: it
explains which layer owns what, the APIs to mutate the world, drive the player
avatar, and render the HUD.

- **Stack:** TypeScript (strict) · Three.js · Vite · Vitest · IndexedDB.
- **Canonical rules:** `AGENTS.md` owns coding standards and folder rules.
  This document only describes the *current* architecture and how to extend it.
- **Specs / tickets:** `docs/` (specs) and `.scratch/` (task files).

---

## 1. Guiding Principles

1. **The world is the single source of truth.** Block data lives in
   `world/`, which depends on no browser, DOM, Three.js, or storage API.
   Rendering, physics, raycasting, and interaction all *query* it; none of
   them keep their own copy of block state.
2. **Rendering is a thin adapter.** All Three.js objects are confined to
   `rendering/`. Domain code passes plain values (numbers, `Vec3`,
   `ChunkMeshData`) across that seam.
3. **Persistence stores deltas, not snapshots.** A save is a seed + generator
   parameters + the list of player edits. The terrain is regenerated
   deterministically; only edits are written.
4. **Config is the tuning surface.** Gameplay and rendering constants live in
   `src/config/Config.ts`; systems read from it instead of hard-coding values.
5. **Dependencies point inward.** Nothing in `world/`/`player/`/`interaction/`
   imports from `rendering/`, `app/`, or the DOM.

---

## 2. Layer Map

```text
                    main.ts
                       │  (constructs Game)
                       ▼
      app/Game ─────────────────────────────────────────────┐
        │  owns frame order, player state, target           │
        │                                                   │
        ├── input/InputManager      (DOM → plain polled state)
        ├── player/PlayerController (look + intent)
        ├── player/PlayerPhysics    (pure step())
        ├── interaction/BlockRaycaster  (pure raycast)
        ├── interaction/BlockInteractor (validated edits)
        ├── rendering/WorldRenderer (all Three.js)
        │      └── ChunkMeshManager → ChunkMeshBuilder
        ├── ui/PlayOverlay, ui/Notices
        └── persistence/WorldPersistence ── WorldRepository
                                             └── IndexedDb / InMemory

  world/World ◄── queried by physics, raycast, interactor, meshes
      └── Chunk, BlockRegistry, BlockType, WorldGenerator, Prng
```

Dependency direction: `app` → everything; `rendering`, `persistence`, `ui`,
`input`, `interaction`, `player` → `world`; **never** the reverse.

---

## 3. Component Reference

### 3.1 World & blocks (`src/world/`)

| File | Responsibility |
| --- | --- |
| `Block.ts` | Numeric block ids (`BlockIds`) and the default `BlockType` definitions (`AIR`, `BASIC_BLOCK`, `BEDROCK`). Ids are stored in chunk data and **must never be renumbered**, only appended. |
| `BlockType.ts` | The `BlockType` interface + `BlockMaterial` tagged union (`color` \| `atlas`). Behaviour (`solid`, `breakable`, `placeable`) is declared as data. |
| `BlockRegistry.ts` | Total id/name → `BlockType` lookup. Unknown ids resolve to air instead of throwing. `createDefaultBlockRegistry()` builds the v1 set. |
| `Chunk.ts` | One `16 × 64 × 16` fixed-size column backed by a flat `Uint8Array`. Coordinate helpers: `chunkKey`, `blockIndex`, `blockToChunkCoord`, `blockToLocalCoord`. |
| `World.ts` | Authoritative voxel world: chunk storage, bounds, dirty tracking, and edit tracking. See the API below. |
| `WorldGenerator.ts` | `WorldGenerator` interface + `HeightmapWorldGenerator` (seeded value noise). Pure, deterministic, renderer-independent. |
| `Prng.ts` | mulberry32 seeded PRNG used by generation. Never use `Math.random` for terrain. |

#### The World API — how to read and modify the world

All coordinates are **integer world block coordinates**. Out-of-bounds reads
return air; out-of-bounds writes are rejected (`false`) and never throw.

```ts
// Reads
world.size:             { x; y; z }        // world extent in blocks
world.sizeInChunks:     { x; y; z }
world.getBlock(x, y, z): number            // block id (air outside world)
world.isSolid(x, y, z): boolean            // registry-backed
world.isWithinBounds(x, y, z): boolean

// Writes  ✅ the only correct way to change blocks
world.setBlock(x, y, z, id): boolean       // false when out of bounds
world.removeBlock(x, y, z): boolean        // set to air
// A successful write marks the containing chunk AND any existing neighbour
// whose visible faces change as dirty, so the renderer rebuilds them.

// Chunks
world.getChunk(coord): Chunk | undefined
world.hasChunk(coord): boolean
world.chunks(): IterableIterator<Chunk>

// Dirty-geometry tracking (used by rendering)
world.isChunkDirty(coord): boolean
world.clearChunkDirty(coord): void
world.dirtyChunks(): readonly Chunk[]
world.markDirty(x, y, z): void

// Player-edit tracking (used by persistence)
world.beginTrackingEdits(): void           // generation writes become the baseline
world.modifications(): readonly BlockModification[]  // sorted, coalesced deltas
```

> **Extending a world edit.** `World.setBlock` updates data and marks chunks
> dirty, but it does **not** schedule a save. Any new system that edits the
> world must call `persistence.markDirty()` after a successful write (this is
> exactly what `Game.applyActions` does). See §3.7.

**Chunk contract:** `Chunk.data` exposes the raw `Uint8Array` for fast mesh
building. Treat it as read-only and always route edits through
`World.setBlock`, otherwise the world cannot mark geometry dirty or record the
edit for saving.

### 3.2 Application orchestration (`src/app/`)

| File | Responsibility |
| --- | --- |
| `Game.ts` | Wires persistence → world → renderer/input/player/interactor. Owns the per-frame update order, the current `PlayerState`, and the current raycast target. |
| `GameLoop.ts` | `requestAnimationFrame` driver with delta clamping (`maxFrameDeltaSeconds`). Scheduler is injectable for tests. |
| `main.ts` | Entry point: finds the canvas/overlay/notices elements, `await Game.create(...)`, `game.start()`. |

**Contractual per-frame order** (`Game.update`) — each stage sees state left
consistent by the previous one; render happens only after all stages:

```text
1. consumeInput      poll keys, drain mouse delta + queued presses
2. applyLook         yaw/pitch from mouse delta (only while pointer-locked)
3. stepPhysics       pure step() → next PlayerState
4. updateTargeting   raycast from eye → renderer.setTarget()
5. applyActions      queued break/place via BlockInteractor → persistence.markDirty()
6. flushDirtyMeshes  budgeted chunk rebuild
7. updateCamera      renderer.setCameraPose(feet, yaw, pitch)
```

To add a system, insert a stage in `Game.update` **in the right position** and
document why there. Do not add DOM listeners or drive the camera elsewhere —
`Game` is the only orchestrator, `InputManager` the only input owner.

### 3.3 Player / avatar (`src/player/`)

| File | Responsibility |
| --- | --- |
| `Player.ts` | Renderer-independent state: `PlayerState` (`position`, `velocity`, `grounded`, `movement`), `Vec3`, `PlayerIntent`, `createPlayerState`, `idleIntent`, `playerAabb`. `position` is the **centre of the feet**. |
| `PlayerPhysics.ts` | Pure `step(state, intent, world, dt): PlayerState`. Axis-separated AABB collision, gravity, jump, sub-stepping to prevent tunnelling. Never mutates inputs. |
| `PlayerController.ts` | Owns yaw/pitch (wrap/clamp), `applyLook(delta)`, `intent(movementInput)` (rotates input by yaw), and `lookDirection`. |
| `Spawn.ts` | `findSpawn(world): Vec3` — deterministic search for a feet position with headroom. |

**Interacting with the avatar.**

```ts
// Advance the simulation (pure; returns a new state)
const next: PlayerState = step(state, intent, world, dtSeconds);

// Build an intent from held buttons
const intent = controller.intent({ forward, backward, left, right, jump });
// or idleIntent() to stand still

// Read/derive
playerAabb(state.position): Aabb          // collision box from config
controller.lookDirection: Vec3            // unit view vector
controller.orientation: { yaw, pitch }
state.movement: 'idle' | 'walking' | 'airborne'
```

`step` takes a `SolidWorld` (`{ isSolid(x,y,z): boolean }`), so it is testable
without a real `World` or a renderer. `PlayerState` is a plain value, so a
future feature (teleport, knockback, flight) should produce a new state rather
than mutate the existing one.

> `Game.playerState` is currently private and the avatar is not exposed as a
> public API. To add an avatar-facing feature, do it **inside `Game`** (a new
> update stage), or promote a deliberate accessor rather than reaching into the
> field from another module.

### 3.4 Interaction (`src/interaction/`)

| File | Responsibility |
| --- | --- |
| `BlockRaycaster.ts` | Pure Amanatides–Woo voxel raycast over `World`. `raycastBlock(world, origin, direction, maxDistance): BlockHit \| null`. Not a Three.js raycaster. |
| `BlockInteractor.ts` | Owns the *rules* for breaking/placing. Validates target-in-range, world bounds, air cell, player-box overlap, and the registry's breakable/placeable flags before any write. |

```ts
interface BlockHit { blockPos: Vec3; faceNormal: Vec3; distance: number }

interactor.breakBlock(target, range): boolean
interactor.canPlaceBlock(target, playerBounds, blockType, range): boolean
interactor.placeBlock(target, playerBounds, blockType, range): boolean
```

`placementCell = blockPos + faceNormal`. Rejected edits leave the world
untouched. `range` comes from `config.interaction.range`.

### 3.5 Rendering (`src/rendering/`)

| File | Responsibility |
| --- | --- |
| `WorldRenderer.ts` | Public renderer facade: owns the `THREE.WebGLRenderer`, scene, lights, camera, highlight, and mesh manager. API: `render()`, `flushDirtyChunks(budget)`, `setCameraPose(feet,yaw,pitch)`, `setTarget(hit)`, `resize()`, `dispose()`. |
| `ChunkMeshBuilder.ts` | Pure `buildChunkMesh(chunk, blockAt): ChunkMeshData`. Emits a quad only when a solid block faces a non-solid neighbour (face culling across chunk boundaries). Output is plain typed arrays. |
| `ChunkMeshManager.ts` | One mesh per chunk. Reads `world.dirtyChunks()`, rebuilds up to a budget, then `world.clearChunkDirty(coord)`. |
| `ChunkMesh.ts` | The Three.js seam: `ChunkMeshData` → `BufferGeometry`, including sRGB→linear colour conversion. Reuses the mesh object across rebuilds. |
| `PlayerCamera.ts` | First-person `PerspectiveCamera` (eye height, `YXZ` rotation). |
| `BlockHighlight.ts` | Reused `LineSegments` outline for the targeted block (view state only). |

The renderer **never** owns block state: it reads through the `BlockSampler`
callback `(x, y, z) => registry.get(world.getBlock(x, y, z))`, installed by
`Game`. Geometry rebuilds are budgeted by
`config.rendering.chunkRebuildBudgetPerFrame`.

### 3.6 Input (`src/input/`)

| File | Responsibility |
| --- | --- |
| `InputManager.ts` | The only place DOM listeners live. Exposes polled state: `isPointerLocked`, `isKeyDown(code)`, `consumeMouseDelta()`, `consumeMousePresses()`, `requestPointerLock()`, `dispose()`. Handles pointer lock, `contextmenu` suppression, and clearing input on blur / lock loss. |

Mouse look and presses only register while the canvas holds pointer lock. Key
bindings are `KeyboardEvent.code` values from `config.input.bindings`
(physical position, layout-independent).

### 3.7 Persistence (`src/persistence/`)

| File | Responsibility |
| --- | --- |
| `WorldRepository.ts` | Storage interface (`load`, `save`, `backup`, `clear`) + typed errors. Gameplay depends only on this. |
| `IndexedDbWorldRepository.ts` | IndexedDB adapter: one `current` record plus timestamped `backup:` records. Lazy open. |
| `InMemoryWorldRepository.ts` | Test/fallback repository with fault injection (`failNextLoad/Save/Backup`). |
| `RepositoryFactory.ts` | Picks IndexedDB or the in-memory fallback and reports `storageAvailable`. |
| `SaveData.ts` | Save schema (`SAVE_VERSION`), `validateSaveData`, `worldMetadataFrom`, `generationParamsFrom`. All persisted values are `unknown` and validated. |
| `WorldFactory.ts` | `createGeneratedWorld` and `reconstructWorld` (regenerate terrain then replay deltas). |
| `WorldPersistence.ts` | Debounced auto-save. `markDirty()` arms a timer; `flush()` writes now; failures are reported via a `PersistenceObserver` and never block a frame. `loadWorld()` handles new / restored / recovered / storage-unavailable. |

**Save shape** (deltas from generated terrain — no meshes or GPU state):

```ts
interface SaveData {
  version: number;              // SAVE_VERSION
  seed: number;
  generatorVersion: number;
  worldParameters: { sizeInChunks; chunkSize; baseSurfaceHeight;
                     amplitude; bedrockLayers; featureSize };
  modifications: { x; y; z; id }[];   // removals stored as air
}
```

To persist new state: extend `SaveData`, bump `SAVE_VERSION`, extend
`validateSaveData`, and update `WorldFactory` reconstruction. Keep validation
total — bad data is a recoverable outcome, never an exception.

### 3.8 UI / HUD (`src/ui/`)

| File | Responsibility |
| --- | --- |
| `Notices.ts` | `NoticeOverlay`: appends/dismisses non-fatal notices (save failures, recovery, disabled storage) over the canvas. `show(message, { level, dismissible, persistent })`. |
| `PlayOverlay.ts` | `PlayOverlay`: shows/hides the click-to-play panel (`setVisible`). No listeners, no game state. |
| `styles.css` | All HUD styling, including the pure-CSS crosshair (`#crosshair`). |
| `index.html` (repo root) | Static HUD markup: `#game-canvas`, `#crosshair`, `#notices`, `#play-overlay`. |

**The HUD today** = crosshair (CSS) + play overlay + notices. There is no
inventory/hotbar.

**Adding a HUD element:**

1. Add the element to `index.html` (reuse `#notices` if it is a transient
   message — no code needed beyond `NoticeOverlay.show`).
2. Add styling to `src/ui/styles.css` and position it with `pointer-events`
   handled so clicks still reach the canvas.
3. If it needs live data, add a small presenter class in `src/ui/` that
   **reads plain values** and is updated from a `Game.update` stage (mirror
   `NoticeOverlay`). Never let UI code read the world, Three.js, or input
   directly, and never let it hold gameplay state.

`Game` accepts optional `overlay` and `notices` elements in `GameOptions`, so
the game can run headless (tests) with the UI omitted.

### 3.9 Configuration (`src/config/`)

`Config.ts` is the single tuning surface, grouped by concern:
`skyColor`, `maxFrameDeltaSeconds`, `camera`, `player`, `interaction`,
`input.bindings`, `rendering`, `maxPixelRatio`, `persistence`, `world`,
`generation`. Systems read constants from here; do not hard-code tuning.

---

## 4. How to Extend (recipes)

**Add a block type**

1. Append a numeric id to `BlockIds` in `world/Block.ts` (never renumber).
2. Define its `BlockType` (behaviour + `material`) and add it to
   `defaultBlockTypes`.
3. It is then automatically handled by physics, raycasting, mesh building
   (face culling), interaction validation, and save validation. To let players
   place it, set `config.interaction.defaultPlaceableBlock` (a hotbar/selection
   feature would feed the configured id from a new `Game` stage).

**Add a block-atlas material**

Extend `BlockMaterial` usage in `ChunkMeshBuilder`/`ChunkMesh`; the `atlas`
variant already exists in `BlockType.ts`, and block data stores only ids, so no
storage change is needed.

**Mutate the world from a new system**

Call `world.setBlock` / `world.removeBlock`, then `persistence.markDirty()` on
success. Route it through `BlockInteractor` (or a sibling) if it needs
validation. Never mutate `Chunk.data` directly.

**React to the targeted block**

The raycast result for the frame is cached in `Game`'s private `target` field
(`BlockHit | null`) after the targeting stage. Add a stage in `Game.update`
that consumes it, and pass the `BlockHit` value into your system rather than
re-raycasting it.

**Add a keybinding / action**

Add the code to `config.input.bindings`, read it via `input.isKeyDown(...)` in
`Game.consumeInput`, and act in the appropriate stage.

**Add an avatar effect (teleport, knockback, fly)**

Produce a new `PlayerState` and assign it in a new `Game` stage. Keep
`PlayerPhysics.step` pure.

**Add persisted state**

See §3.7 (extend `SaveData`, bump `SAVE_VERSION`, extend validation +
reconstruction).

**Add a HUD overlay**

See §3.8.

---

## 5. Testing

- Logic in `world/`, `player/`, `interaction/`, `persistence/`, and
  `rendering/ChunkMeshBuilder` is renderer-independent and unit-tested with
  Vitest (`src/tests/*.test.ts`). No WebGL or real browser is used.
- Pure functions (`step`, `raycastBlock`, `buildChunkMesh`, `validateSaveData`)
  are the easiest things to test — prefer adding behaviour there.
- `GameLoop` takes an injectable `FrameScheduler`; `WorldPersistence` takes an
  injectable `SaveScheduler`; `InMemoryWorldRepository` supports fault
  injection. Reuse these seams.

Commands: `npm test`, `npm run typecheck`, `npm run build`.

---

## 6. File Map by Feature

| Feature | Files |
| --- | --- |
| **World / voxel data** | `world/World.ts`, `world/Chunk.ts`, `world/Block.ts`, `world/BlockType.ts`, `world/BlockRegistry.ts` |
| **Terrain generation** | `world/WorldGenerator.ts`, `world/Prng.ts`, `config/Config.ts` (`generation`) |
| **Player avatar** | `player/Player.ts`, `player/PlayerPhysics.ts`, `player/PlayerController.ts`, `player/Spawn.ts` |
| **Block interaction** | `interaction/BlockRaycaster.ts`, `interaction/BlockInteractor.ts` |
| **Rendering** | `rendering/WorldRenderer.ts`, `rendering/ChunkMeshBuilder.ts`, `rendering/ChunkMeshManager.ts`, `rendering/ChunkMesh.ts`, `rendering/PlayerCamera.ts`, `rendering/BlockHighlight.ts` |
| **Input** | `input/InputManager.ts`, `config/Config.ts` (`input.bindings`) |
| **Persistence** | `persistence/WorldRepository.ts`, `persistence/IndexedDbWorldRepository.ts`, `persistence/InMemoryWorldRepository.ts`, `persistence/RepositoryFactory.ts`, `persistence/SaveData.ts`, `persistence/WorldFactory.ts`, `persistence/WorldPersistence.ts` |
| **HUD / UI** | `ui/Notices.ts`, `ui/PlayOverlay.ts`, `ui/styles.css`, `index.html` |
| **Orchestration** | `app/Game.ts`, `app/GameLoop.ts`, `src/main.ts` |
| **Configuration** | `config/Config.ts` |
| **Tests** | `src/tests/*.test.ts` |
