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
        ├── ui/HealthHud, ui/DeathOverlay, ui/DebugReadout
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
 1. consumeInput       poll keys, drain mouse delta + queued presses
 2. applyLook          yaw/pitch from mouse delta (only while pointer-locked)
 3. stepPhysics        pure step() → next PlayerState
 4. updateVitals       fall accumulator + landing damage + void drain
 5. updateTargeting    raycast from eye → renderer.setTarget()
 6. applyActions       queued break/place via BlockInteractor → persistence.markDirty()
 7. flushDirtyMeshes   budgeted chunk rebuild
 8. updateCamera       renderer.setCameraPose(feet, yaw, pitch, eyeHeight, targetFov, dt)
 9. updateHealthHud    presenter reads the frame's plain health number
10. updateDebugReadout presenter reads the frame's feet position
```

To add a system, insert a stage in `Game.update` **in the right position** and
document why there. Do not add DOM listeners or drive the camera elsewhere —
`Game` is the only orchestrator, `InputManager` the only input owner.

**Why vitals sit directly after physics.** `updateVitals` runs **immediately
after** `stepPhysics` so it observes the exact airborne→grounded transition and
the frame's final feet position before targeting, actions, or the HUD touch
them: fall damage must be judged on the landing frame itself, and the void
drain must see the frame's real depth. The HUD stages at the end only read
settled values. While the avatar is dead, orchestration skips **both** physics
and vitals, so the avatar freezes instead of falling further and no further
damage accrues; targeting, actions, rendering, camera, and the presenters
still run behind the death overlay. See §3.3 for the pure rules.

### 3.3 Player / avatar (`src/player/`)

| File | Responsibility |
| --- | --- |
| `Player.ts` | Renderer-independent state and shapes: `PlayerState` (`position`, `velocity`, `grounded`, `crouching`, `movement`), `Vec3`, `PlayerIntent` (`move`, `jump`, and the required `sprint`/`crouch` flags), factories (`createPlayerState`, `idleIntent`), and the derivations `playerAabb(position, crouching)` and `eyeHeightFor(crouching)`. `position` is the **centre of the feet**. |
| `PlayerPhysics.ts` | Pure `step(state, intent, world, dt): PlayerState`. Axis-separated AABB collision, gravity, jump, sub-stepping to prevent tunnelling, the composed sprint/crouch speed, the forced stand-up rule, and the crouch ledge guard. Never mutates inputs. |
| `PlayerController.ts` | Owns yaw/pitch (wrap/clamp), `applyLook(delta)`, `intent(movementInput)` (rotates input by yaw and carries the held `sprint`/`crouch` flags), and `lookDirection`. |
| `Spawn.ts` | `findSpawn(world): Vec3` — deterministic search for a feet position with headroom. |
| `Vitals.ts` | Transient avatar condition beside `PlayerState`: `VitalsState`, the pure `updateVitals`, the fall and void damage rules, `isDead`, `clampHealth`, and `heartStates`. Pure, DOM-free, and renderer-free. |

**Interacting with the avatar.**

```ts
// Advance the simulation (pure; returns a new state)
const next: PlayerState = step(state, intent, world, dtSeconds);

// Build an intent from held buttons. `sprint` and `crouch` are required flags.
const intent = controller.intent({ forward, backward, left, right, jump, sprint, crouch });
// or idleIntent() to stand still (both flags false)

// Read/derive
playerAabb(state.position, state.crouching): Aabb   // crouch-aware box from config
eyeHeightFor(state.crouching): number                // eye height above the feet
controller.lookDirection: Vec3                      // unit view vector
controller.orientation: { yaw, pitch }
state.crouching: boolean
state.movement: 'idle' | 'walking' | 'sprinting' | 'sneaking' | 'airborne'
```

`step` takes a `SolidWorld` (`{ isSolid(x,y,z): boolean }`), so it is testable
without a real `World` or a renderer. `PlayerState` is a plain value, so a
future feature (teleport, knockback, flight) should produce a new state rather
than mutate the existing one.

**Vitals — health, damage, and death.** `Vitals.ts` owns the avatar's
condition as a plain value beside the movement state:

```ts
interface VitalsState {
  health: number            // hit points, always within [0, maxHealth]
  fallDistance: number      // airborne downward blocks since last grounded
  inVoid: boolean           // feet were below player.voidY after last update
  voidDamageTimer: number   // seconds until the next void tick (while inVoid)
}

createVitals(): VitalsState                              // full, clear timers
updateVitals(vitals, previous, next, dt): VitalsState
isDead(vitals): boolean                                  // health <= 0
heartStates(health, maxHealth): readonly HeartState[]    // 'full' | 'half' | 'empty'
clampHealth(health, maxHealth): number
```

- **Not part of `PlayerState`.** Health is transient, is never written to the
  save file, and `step` neither reads nor produces it. Orchestration owns the
  value and advances it in its own stage (see §3.2).
- **Pure and total.** `updateVitals` never mutates its inputs, does no I/O,
  and returns a new state with health clamped to `[0, maxHealth]`; a
  non-finite input collapses to a bound. It can be simulated and tested with
  no DOM, renderer, or real world.
- **Fall rule.** `fallDistance` accumulates only while the *previous* state
  was airborne and only for downward displacement (`max(0, previous.y −
  next.y)`), so a jump's rise costs nothing and a jump off a ledge is measured
  from its apex. On the airborne→grounded frame the final slice is added,
  damage is `max(0, ceil(fallDistance) − safeFallDistance) ×
  fallDamagePerBlock` whole hit points, and the accumulator resets. While
  grounded it is held at zero, so short hops never add up.
- **Void rule.** Below `player.voidY`, the crossing frame takes an immediate
  `voidDamage` tick, then a carried timer is decremented by `dt` and ticks
  again every `voidDamageIntervalSeconds` (a long frame may owe several
  ticks). Rising above the threshold clears `inVoid` and the timer, so a later
  re-entry ticks immediately. The void is lethal regardless of remaining
  health, and is independent of the fall rule because a void plunge never
  lands.
- **Dead condition.** `isDead` is true exactly at zero health. Death itself is
  a transient orchestration flag (`Game.dead`) so it fires once, freezes the
  avatar, and clears on respawn.
- **Hearts mapping.** `heartStates` returns exactly `maxHealth / 2` hearts,
  each `full` at 2 HP, `half` at 1 HP, and `empty` at 0; health is clamped
  first, so an odd value yields exactly one half heart and the mapping is
  total.

**Movement modes (sprint / crouch).** Sprint and crouch are required intent
flags consumed only by `step`. They are transient and never persisted. The
rules that must hold:

- **Crouch-aware bounds.** `playerAabb(position, crouching)` derives the box
  every time: the width is unchanged, the height is `player.crouchHeight` while
  crouching and `player.height` otherwise, and the box always spans upward from
  the feet. The same derived box is used for collision and for placement
  validation, so a crouched player can place a block in the space a standing
  head would occupy.
- **Composed speed.** Horizontal speed is
  `player.moveSpeed × (crouching ? player.crouchSpeedMultiplier : 1) × (sprinting ? player.sprintSpeedMultiplier : 1)`,
  applied in any direction and while grounded **or** airborne (a jump
  preserves it). This product is deliberate: sprint still contributes a little
  even while crouching, so crouch-sprinting is `0.3 × 1.3 = 0.39` of a walk.
  Do not "simplify" it to a single multiplier.
- **Movement-label precedence.** `airborne` → `sneaking` → `sprinting` →
  `walking` → `idle`. Holding crouch and sprint together reports `'sneaking'`,
  and `'sneaking'` wins the label even though the speed is the composed
  product. The movement label — never raw input — is what drives the camera's
  target field of view, so `'sneaking'` also suppresses the sprint widening.
- **Forced stand-up (crouch-only).** Releasing crouch returns to standing only
  when the full-height standing box has headroom. Under a low ceiling the
  player stays `crouching` and stands automatically once they move into clear
  space. Crouch is resolved once per `step`, before the sub-step loop.
- **Crouch ledge guard.** While `crouching` **and** grounded, a horizontal
  move per axis per sub-step is cancelled (position unchanged, that axis's
  velocity zeroed) when the shifted footprint would have no solid block in the
  layer directly beneath the feet. It tests the whole footprint, so the player
  may lean out until the entire footprint clears the block and a one-block
  step-down counts as an edge; the unblocked axis still translates, so the
  player slides along the edge instead of sticking. The guard is pure physics,
  never alters vertical motion, and uses a per-sub-step "was grounded" value so
  the X and Z passes are symmetric. Removing the block beneath a crouched
  player still drops them, and a crouch-jump disengages the guard for the
  airborne period (so a jump can still leave the ledge).

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
| `WorldRenderer.ts` | Public renderer facade: owns the `THREE.WebGLRenderer`, scene, lights, camera, highlight, and mesh manager. API: `render()`, `flushDirtyChunks(budget)`, `setCameraPose(feet, yaw, pitch, eyeHeight, targetFovDegrees, deltaSeconds)`, `setTarget(hit)`, `resize()`, `dispose()`. |
| `ChunkMeshBuilder.ts` | Pure `buildChunkMesh(chunk, blockAt): ChunkMeshData`. Emits a quad only when a solid block faces a non-solid neighbour (face culling across chunk boundaries). Output is plain typed arrays. |
| `ChunkMeshManager.ts` | One mesh per chunk. Reads `world.dirtyChunks()`, rebuilds up to a budget, then `world.clearChunkDirty(coord)`. |
| `ChunkMesh.ts` | The Three.js seam: `ChunkMeshData` → `BufferGeometry`, including sRGB→linear colour conversion. Reuses the mesh object across rebuilds. |
| `PlayerCamera.ts` | First-person `PerspectiveCamera`: explicit eye height (so crouch drops the view immediately, with no easing), `YXZ` rotation, and a frame-rate-independent exponential easing of the rendered field of view toward an explicit target (bounded to `[0,1]` so a long frame cannot overshoot). Field of view changes projection only, never the aim direction. |
| `BlockHighlight.ts` | Reused `LineSegments` outline for the targeted block (view state only). |

The renderer **never** owns block state: it reads through the `BlockSampler`
callback `(x, y, z) => registry.get(world.getBlock(x, y, z))`, installed by
`Game`. Geometry rebuilds are budgeted by
`config.rendering.chunkRebuildBudgetPerFrame`.

### 3.6 Input (`src/input/`)

| File | Responsibility |
| --- | --- |
| `InputManager.ts` | The only place DOM listeners live. Exposes polled state: `isPointerLocked`, `isKeyDown(code)`, `consumeMouseDelta()`, `consumeMousePresses()`, `consumeKeyPresses()`, `requestPointerLock()`, `releasePointerLock()`, `dispose()`. Handles pointer lock, `contextmenu` suppression, and clearing input on blur / lock loss. |

Mouse look and presses only register while the canvas holds pointer lock. Key
bindings are `KeyboardEvent.code` values from `config.input.bindings`
(physical position, layout-independent). The movement set is
`forward`/`backward`/`left`/`right`/`jump`/`sprint`/`crouch`. Adding a binding
is a config-only change: `InputManager` tracks any code it is asked about, and
`Game.consumeInput` polls the configured code.

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
| `HealthHud.ts` | `HealthHud`: dumb presenter over the hearts element. `setHealth(health)` renders whatever the pure `heartStates` mapping returns, ignores an unchanged value, attaches no listeners, and holds no gameplay state. |
| `DeathOverlay.ts` | `DeathOverlay`: dumb presenter over the "You died!" panel. `setVisible(visible)` toggles it; the Respawn button forwards clicks to an explicit `onRespawn` callback supplied by `Game`. Reads no game systems and holds no gameplay state. |
| `DebugReadout.ts` | `DebugReadout` + the pure `formatDebugPosition`: dumb presenter over the coordinate element (`setVisible`, `setText`); ignores redundant changes. |
| `styles.css` | All HUD styling, including the pure-CSS crosshair (`#crosshair`), the hearts row, and the death panel. |
| `index.html` (repo root) | Static HUD markup: `#game-canvas`, `#crosshair`, `#hearts`, `#debug-readout`, `#notices`, `#play-overlay`, `#death-overlay`. |

**The HUD today** = crosshair (CSS) + hearts row + coordinate readout + play
overlay + death overlay + notices. There is no inventory/hotbar. The hearts
and death overlay are the health/death elements; both are **optional**
`GameOptions` (`health`, `death`), so the game still constructs and runs
headless with them absent.

**Health and death UI.** `Game.updateHealthHud` feeds `HealthHud` only the
frame's plain `vitals.health` number; the presenter never reads gameplay state
and the game never touches the DOM. `Game.syncOverlays` keeps the overlays
mutually exclusive: the click-to-play overlay only while the pointer is
unlocked **and** the avatar is alive, and the death overlay only while dead, so
they never compete. Respawn reaches orchestration through the explicit
`onRespawn` callback passed to `DeathOverlay` (wired in the `Game`
constructor) — the UI never reaches into `Game` or any system.

**Adding a HUD element:**

1. Add the element to `index.html` (reuse `#notices` if it is a transient
   message — no code needed beyond `NoticeOverlay.show`).
2. Add styling to `src/ui/styles.css` and position it with `pointer-events`
   handled so clicks still reach the canvas.
3. If it needs live data, add a small presenter class in `src/ui/` that
   **reads plain values** and is updated from a `Game.update` stage (mirror
   `NoticeOverlay`). Never let UI code read the world, Three.js, or input
   directly, and never let it hold gameplay state.

`Game` accepts optional `overlay`, `notices`, `debug`, `health`, and `death`
elements in `GameOptions`, so the game can run headless (tests) with the UI
omitted.

### 3.9 Configuration (`src/config/`)

`Config.ts` is the single tuning surface, grouped by concern:
`skyColor`, `maxFrameDeltaSeconds`, `camera`, `player`, `interaction`,
`input.bindings`, `rendering`, `maxPixelRatio`, `persistence`, `world`,
`generation`. Systems read constants from here; do not hard-code tuning.

Movement and view tuning (sprint / crouch):

| Constant | Meaning |
| --- | --- |
| `player.sprintSpeedMultiplier` | Sprint speed factor (`1.3`), composed on top of `moveSpeed`. |
| `player.crouchSpeedMultiplier` | Crouch speed factor (`0.3`); composes with sprint as a product. |
| `player.crouchHeight` | Crouched collision-box height from the feet (`1.5`; must satisfy `crouchEyeHeight < crouchHeight < height`). |
| `camera.crouchEyeHeight` | Crouched camera/raycast height above the feet (`1.2`), applied immediately and never eased. |
| `camera.sprintFovMultiplier` | Target field-of-view factor while `movement === 'sprinting'` (`1.15`). |
| `camera.fovTransitionSeconds` | Time constant of the field-of-view easing (`0.2`). |
| `input.bindings.sprint` | Sprint key (`ShiftLeft`). |
| `input.bindings.crouch` | Crouch key (`KeyC`). |

Health and damage tuning:

| Constant | Meaning |
| --- | --- |
| `player.maxHealth` | Full health in hit points (`20` = 10 hearts × 2 HP); positive and even. |
| `player.safeFallDistance` | Whole blocks a fall can cover unharmed (`3`). |
| `player.fallDamagePerBlock` | Hit points lost per whole block fallen beyond the safe distance (`1`). |
| `player.voidY` | Feet height below which the avatar is in the void (`-8`); sits below the world floor. |
| `player.voidDamage` | Hit points removed per void tick (`4`). |
| `player.voidDamageIntervalSeconds` | Seconds between void ticks after the immediate first tick (`0.5`). |

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
`Game.consumeInput`, and act in the appropriate stage. No change to
`InputManager` is needed — it tracks any code it is asked about.

**Add a movement mode (like sprint / crouch)**

Add a required flag to `PlayerIntent` and every construction site (the
controller's `intent(...)`, `idleIntent()`, and tests), fold the held button
into `MovementInput`, and apply the behaviour inside the pure
`PlayerPhysics.step` — speed, bounds, movement label, and any ledge rule.
Keep the camera a thin adapter: derive the eye height and target field of view
from `PlayerState` in `Game.updateCamera` and pass them as plain values. New
modes are transient unless a separate persistence change is made.

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
- Pure functions (`step`, `updateVitals`, `heartStates`, `raycastBlock`,
  `buildChunkMesh`, `formatDebugPosition`, `validateSaveData`) are the easiest
  things to test — prefer adding behaviour there. The pure `step` owns
  sprint/crouch speed ratios, the forced stand-up rule, the movement-label
  precedence, and the crouch ledge guard; `updateVitals` owns fall damage, the
  void cadence, and health; `heartStates` owns the full/half/empty mapping.
- `src/tests/AcceptanceFlow.test.ts` chains the real `step` and `updateVitals`
  headlessly to prove lethal drops and void falls end dead, and that respawn
  from the spawn search recovers a fresh, full-health avatar that respects
  player edits.
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
| **Player avatar** | `player/Player.ts`, `player/PlayerPhysics.ts`, `player/PlayerController.ts`, `player/Spawn.ts`, `player/Vitals.ts` |
| **Block interaction** | `interaction/BlockRaycaster.ts`, `interaction/BlockInteractor.ts` |
| **Rendering** | `rendering/WorldRenderer.ts`, `rendering/ChunkMeshBuilder.ts`, `rendering/ChunkMeshManager.ts`, `rendering/ChunkMesh.ts`, `rendering/PlayerCamera.ts`, `rendering/BlockHighlight.ts` |
| **Input** | `input/InputManager.ts`, `config/Config.ts` (`input.bindings`) |
| **Persistence** | `persistence/WorldRepository.ts`, `persistence/IndexedDbWorldRepository.ts`, `persistence/InMemoryWorldRepository.ts`, `persistence/RepositoryFactory.ts`, `persistence/SaveData.ts`, `persistence/WorldFactory.ts`, `persistence/WorldPersistence.ts` |
| **HUD / UI** | `ui/Notices.ts`, `ui/PlayOverlay.ts`, `ui/HealthHud.ts`, `ui/DeathOverlay.ts`, `ui/DebugReadout.ts`, `ui/styles.css`, `index.html` |
| **Orchestration** | `app/Game.ts`, `app/GameLoop.ts`, `src/main.ts` |
| **Configuration** | `config/Config.ts` |
| **Tests** | `src/tests/*.test.ts` |
