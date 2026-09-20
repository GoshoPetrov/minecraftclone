# GAME.md

# Voxel Sandbox Game

## 1. Game Overview

Create a Minecraft-inspired voxel sandbox game.

The game takes place in a simple procedurally generated 3D voxel world. The player views the world from a first-person perspective and can:

* Move around.
* Look around.
* Jump.
* Target blocks.
* Break blocks.
* Place blocks.
* Explore the generated terrain.
* Reload the application and retain world modifications.

The initial version should be intentionally small.

The architecture must provide a clean foundation for adding additional systems later without requiring a major rewrite.

The primary priorities are:

1. Correctness.
2. Maintainability.
3. Responsive controls.
4. Reliable world interaction.
5. Separation between world data and rendering.
6. A small but complete playable experience.

---

# 2. Initial Gameplay

The first playable version must provide:

* First-person perspective.
* Procedurally generated 3D voxel terrain.
* Actual terrain depth.
* Player movement.
* Gravity.
* Jumping.
* Mouse-look camera controls.
* Collision with solid blocks.
* Block targeting.
* Block highlighting.
* Block breaking.
* Block placement.
* Persistent world modifications.
* Automatic local saving.
* Loading of previously saved worlds.

The player should be able to freely explore the generated world.

The initial game does not require:

* Inventory.
* Crafting.
* Items.
* Enemies.
* Mobs.
* Combat.
* Multiplayer.
* Complex terrain generation.
* Advanced lighting.
* Sound.
* Music.

---

# 3. Technical Architecture

The implementation should be organized into independent systems.

A suitable high-level architecture is:

```text
Game
├── Input
├── Player
│   ├── Physics
│   └── Camera
├── World
│   ├── Block Data
│   ├── Chunk Management
│   ├── World Generation
│   └── Persistence
├── Voxel Renderer
│   ├── Chunk Mesh Generation
│   └── Visible Face Culling
├── Interaction
│   └── Block Raycasting
└── UI
```

Systems should communicate through well-defined interfaces.

Avoid tightly coupling:

* World data to rendering objects.
* Player physics to the camera.
* Persistence to rendering.
* World generation to rendering.
* Block interaction to specific rendering objects.

The world should remain fully representable without a graphics context.

---

# 4. Architectural Constraints

The implementation must follow these principles:

* World state must be independent of rendering state.
* Block data must be independent of graphics objects.
* Player physics must be independent of camera rendering.
* World generation must be independent of persistence.
* Persistence must be independent of rendering.
* Block types must be data-driven.
* Rendering must not require one permanent scene object per block.
* The world representation should support chunk-based rendering.
* The world API should not fundamentally assume that the world will always remain small.
* Runtime rendering objects must never be treated as the authoritative world state.
* Saved data must contain world information rather than renderer information.
* Future block types should be addable without rewriting interaction logic.

---

# 5. Coordinate System

The game must use a consistent 3D coordinate system.

```text
X = horizontal axis
Y = vertical axis
Z = horizontal axis
```

`Y` increases upward.

Blocks exist at integer coordinates:

```text
(x, y, z)
```

Each block occupies the volume:

```text
[x, x + 1]
[y, y + 1]
[z, z + 1]
```

Block coordinates are integers.

Player coordinates use floating-point values.

The player is not itself represented as a voxel block.

All systems must use the same coordinate convention.

---

# 6. World Representation

The world consists of cubic blocks arranged on a 3D integer grid.

The authoritative world state must be represented using block data.

A conceptual block representation is:

```text
Block:
    type: BlockType
```

A block type should contain data such as:

```text
BlockType:
    id
    name
    solid
    material
```

The exact implementation is flexible.

The important requirement is that blocks are represented as data rather than as individual rendered objects.

The world should expose operations conceptually equivalent to:

```text
world.getBlock(x, y, z)

world.setBlock(x, y, z, blockType)

world.removeBlock(x, y, z)

world.isSolid(x, y, z)
```

The exact programming language/API is an implementation detail.

---

# 7. Block Types

The initial implementation requires only one placeable solid block type.

For example:

```text
basic_block
```

The implementation must nevertheless treat block types as distinct data.

Future block types may include:

* Grass.
* Dirt.
* Stone.
* Sand.
* Wood.
* Glass.
* Water.

These are not required for the initial version.

Block behavior should not be hard-coded into the player interaction system.

For example, block placement should operate on a block type rather than assuming a specific hard-coded mesh.

---

# 8. World Generation

When no persisted world exists, the game must generate a world programmatically.

Generation must support a deterministic seed.

Given the same:

```text
seed
generator version
world-generation parameters
```

the generator should produce the same initial terrain.

The initial terrain should be intentionally simple.

It should contain:

* A surface.
* Multiple layers below the surface.
* Solid blocks throughout the terrain.
* Actual 3D depth.
* A consistent structure.

The initial generator does not need sophisticated height variation.

A valid initial terrain could be:

```text
Surface
──────────────────────────────

██████████████████████████████
██████████████████████████████
██████████████████████████████
██████████████████████████████
██████████████████████████████
██████████████████████████████
██████████████████████████████
```

The exact dimensions and depth are implementation details.

The important requirement is that the player can physically dig into the terrain.

The generator must not create only a single layer of blocks.

---

# 9. World Generation Extensibility

World generation must be isolated from the rest of the game.

The initial generator can be simple, but its interface should allow future generators to introduce:

* Height variation.
* Multiple block types.
* Biomes.
* Caves.
* Ores.
* Water.
* Lava.
* Vegetation.
* Structures.
* Procedural features.

The initial implementation must not contain unnecessary systems for these features.

---

# 10. Chunk Architecture

The world should be organized into chunks even if the initial world is small.

A conceptual structure is:

```text
World
└── Chunks
    ├── Chunk (0, 0)
    ├── Chunk (1, 0)
    ├── Chunk (0, 1)
    └── Chunk (1, 1)
```

The exact chunk dimensions are implementation details.

A chunk should contain its block data and, when appropriate, its generated render mesh.

The MVP does not require infinite worlds or chunk streaming.

However, the architecture should support:

* Chunk generation.
* Chunk mesh generation.
* Chunk rebuilding.
* Loading/unloading chunks.
* Larger worlds.
* Procedural worlds.

The initial world may simply generate and load a fixed small set of chunks.

---

# 11. Voxel Rendering

Blocks should be rendered as voxel geometry.

The renderer should not create a permanent independent render object for every block.

Instead, block geometry should be combined into chunk-level meshes or an equivalent batched representation.

At minimum, visible-face culling should be used.

A block face should only be rendered when the adjacent block is empty or otherwise non-solid.

For example:

```text
Solid block next to solid block
→ shared internal face does not need to be rendered.

Solid block next to air
→ outer face should be rendered.
```

This requirement applies even to the initial version.

Advanced techniques such as:

* Greedy meshing.
* GPU instancing.
* Ambient occlusion.
* Advanced mesh compression.

are not required for the MVP.

---

# 12. Chunk Rebuilding

When a block changes, the affected rendering geometry must be updated.

Breaking or placing a block must cause the relevant chunk mesh to be rebuilt.

If the changed block lies on a chunk boundary, the neighboring chunk may also need to be rebuilt because one of its visible faces may have changed.

The renderer must not require a complete world rebuild after every block modification.

---

# 13. Player

The player must have:

* Position.
* Velocity.
* Collision bounds.
* Movement state.
* Grounded state.
* First-person camera.
* Movement controls.

The player must collide with solid blocks.

The player must not be able to move through terrain.

The player must remain in a valid physical state.

The player should spawn above the generated terrain.

The spawn position must:

* Be above solid terrain.
* Have sufficient space for the player.
* Not place the player's collision bounds inside a solid block.
* Not immediately cause the player to fall through the world.

---

# 14. Player Collision

The player should use an axis-aligned bounding box (AABB) or equivalent collision representation.

Collision must be resolved against solid voxel blocks.

The implementation should prevent:

* Walking through blocks.
* Falling through blocks.
* Becoming embedded inside blocks.
* Jumping through solid blocks in an unintended way.

Collision resolution may be implemented independently along the X, Y, and Z axes.

The exact physics implementation is an engineering detail.

---

# 15. Gravity

The player is affected by gravity.

When airborne, the player's vertical velocity should change according to gravity.

When the player lands on a solid surface:

* Vertical movement should stop.
* The player should be considered grounded.
* Jumping should become available.

The player should not continuously fall through the terrain.

Exact gravity and movement constants are implementation details and should be centralized rather than scattered throughout the codebase.

---

# 16. Jumping

The player can jump using `Space`.

Jumping should normally only be possible while grounded.

The jump should apply an upward vertical velocity.

The player must not be able to repeatedly jump in mid-air unless a future gameplay system explicitly introduces such behavior.

---

# 17. Movement

The default controls are:

| Input              | Action               |
| ------------------ | -------------------- |
| `W`                | Move forward         |
| `S`                | Move backward        |
| `A`                | Move left            |
| `D`                | Move right           |
| `Space`            | Jump                 |
| Mouse movement     | Look around          |
| Left mouse button  | Break targeted block |
| Right mouse button | Place block          |

Movement should be relative to the player's horizontal facing direction.

Movement speed should be configurable.

Movement constants should not be scattered throughout unrelated systems.

---

# 18. First-Person Camera

The game must use a first-person camera.

The camera should be aligned with the player's position.

Mouse movement controls:

* Horizontal rotation.
* Vertical rotation.

Horizontal rotation should allow continuous turning.

Vertical rotation must be clamped to a natural first-person range.

The player must not be able to rotate the camera indefinitely beyond the vertical viewing limits.

The camera should use a configurable eye height relative to the player's collision bounds.

---

# 19. Mouse Capture

Because this is a browser game, first-person mouse control should use pointer lock or an equivalent browser mechanism.

Clicking the game viewport should request mouse capture.

While mouse capture is active:

* Mouse movement controls the camera.
* The cursor should not leave the game viewport.

Pressing `Escape` should release pointer lock.

The browser's default context menu should be disabled while the game is using the right mouse button for block placement.

The game should not depend on pointer lock being permanently active.

---

# 20. Block Targeting

The center of the screen acts as the targeting point.

A ray should be cast from the player's camera into the world.

The ray should determine:

* Which block is targeted.
* Which face of the block was hit.
* The distance to the block.

The raycast must respect the interaction range.

The maximum interaction distance should be configurable.

If no block is within range:

```text
target = none
```

---

# 21. Target Visualization

The currently targeted block should be visually identifiable.

A simple outline is sufficient.

The outline should:

* Follow the selected block.
* Update immediately as the player looks around.
* Disappear when no valid block is targeted.

The targeting visualization is a rendering aid and must not be treated as world state.

---

# 22. Breaking Blocks

The left mouse button breaks the targeted block.

When a valid block is broken:

1. Determine the targeted block.
2. Verify it is within interaction range.
3. Remove the block from the world data.
4. Update affected chunk geometry.
5. Update targeting state if necessary.
6. Mark the world as modified.
7. Persist the modification.

The player must not be able to break blocks outside the interaction range.

If no valid block is targeted, left click should have no effect.

---

# 23. Unbreakable / World-Boundary Blocks

The implementation may use a bottom boundary or otherwise protect the world from being destroyed completely.

If an unbreakable layer is implemented, this behavior must be represented by block/world rules rather than by rendering logic.

The exact boundary behavior is an implementation detail.

The player must never be able to create an invalid world state by breaking a required boundary block.

---

# 24. Block Placement

The right mouse button places a block adjacent to the targeted block.

The placement position is determined by the face hit by the raycast.

For example:

```text
       new block
          ↓
    ┌─────────┐
    │         │
    └─────────┘
    ┌─────────┐
    │ target  │
    └─────────┘
```

The new block must occupy the grid cell immediately adjacent to the targeted face.

---

# 25. Placement Validation

A block must not be placed if:

* The target position is already occupied.
* The target position is outside valid world bounds.
* The new block intersects the player's collision bounds.
* The placement position is otherwise invalid.

Placement must be validated against world data and player collision state before modifying the world.

If placement fails, the world must remain unchanged.

---

# 26. Placement and Player Collision

The player must not be able to place a block inside their own body.

Before placing a block:

1. Calculate the proposed block bounds.
2. Calculate the player's current collision bounds.
3. Check for intersection.
4. Reject placement if an intersection exists.

This must be a physical collision check rather than a simple distance check.

---

# 27. World Modification

Breaking and placing blocks are world modifications.

A successful modification must:

* Update authoritative world data.
* Update affected chunk meshes.
* Update targeting state if required.
* Mark the world as dirty.
* Trigger persistence.

Rendering changes must always be derived from the updated world state.

---

# 28. World Persistence

World modifications must persist between application sessions.

The initial implementation should save the world locally in the browser.

Suitable browser persistence mechanisms may include an appropriate browser storage/database API.

The exact technology is an implementation detail.

The important requirement is that persistence survives a page reload and subsequent application startup.

---

# 29. Persistence Representation

The persisted representation must not contain rendering objects.

Do not persist:

* Meshes.
* Scene objects.
* Materials.
* GPU resources.
* Camera objects.
* Renderer objects.
* Other runtime rendering state.

The save data should contain enough information to reconstruct the world.

A conceptual save structure is:

```text
SaveData
├── version
├── seed
├── generatorVersion
├── worldParameters
└── modifications
```

For example:

```text
{
    "version": 1,
    "seed": 12345,
    "generatorVersion": 1,
    "modifications": {
        "10,5,3": 0,
        "10,6,3": 1
    }
}
```

The exact serialization format is an implementation detail.

---

# 30. Generated World + Modifications

The preferred persistence model is:

```text
world seed
    +
generator version
    +
world-generation parameters
    +
player modifications
    ↓
reconstructed world
```

The initial generated terrain does not necessarily need to be serialized block-by-block.

Instead, the generator reconstructs the original terrain and the saved modifications are applied afterward.

This makes persistence substantially more scalable for future worlds.

---

# 31. Save Versioning

Persisted data must contain a save/schema version.

The application must validate the save version before using it.

Future versions may migrate old save data.

The application must not silently interpret incompatible data as valid world state.

---

# 32. Loading

When the application starts:

```text
1. Initialize the game.
2. Attempt to load persisted world data.
3. Validate the persisted data.
4. If valid:
       restore the world seed and parameters
       generate the base world
       apply saved modifications
5. If no saved world exists:
       generate a new world
6. Initialize the player at a valid spawn position.
7. Generate the required chunk meshes.
8. Display the world.
9. Enter the main game loop.
```

---

# 33. Corrupt Save Data

Invalid or corrupted persisted data must not cause the application to enter an invalid world state.

The game should:

* Validate loaded data.
* Reject malformed data.
* Avoid applying invalid block coordinates.
* Avoid applying invalid block types.
* Avoid crashing because of malformed save data.

A failed load should have a clear recovery behavior.

For example, the application may offer to start a new world rather than silently pretending that corrupted data was successfully loaded.

A valid existing save should not be overwritten merely because a load operation failed.

---

# 34. Automatic Saving

The game should save automatically after meaningful world modifications.

At minimum:

* Block breaking.
* Block placement.

Saving may be debounced or scheduled to avoid excessive writes when multiple modifications occur rapidly.

The player must not need to manually press a save button for the MVP.

---

# 35. Save Failure Handling

Persistence failures should be handled explicitly.

Possible failures include:

* Storage quota limits.
* Browser storage errors.
* Invalid serialization.
* Corrupted existing data.
* Unsupported save versions.

A failed save must not corrupt the in-memory world state.

The authoritative runtime world remains valid even if persistence fails.

---

# 36. World Boundaries

The initial world may use finite boundaries.

If finite boundaries are used:

* The player must not move into invalid world coordinates.
* Block placement must not create blocks outside the valid world.
* Block access must safely handle out-of-bounds coordinates.

The architecture should allow the world to become substantially larger later.

The rest of the game should not be tightly coupled to a particular fixed world size.

---

# 37. Lighting

The initial scene requires enough lighting to clearly see the terrain.

A simple lighting setup is sufficient.

Prioritize:

1. Clear block visibility.
2. Readable geometry.
3. Consistent lighting.

Advanced lighting is not required.

Future versions may introduce:

* Sunlight.
* Block lighting.
* Dynamic lighting.
* Shadows.
* Day/night cycles.

---

# 38. Visual Style

The game should have a simple voxel aesthetic.

The initial version should prioritize:

1. Correct block geometry.
2. Correct visible faces.
3. Clear block boundaries.
4. Responsive controls.
5. Reliable targeting.
6. Reliable block interaction.

Textures may be simple.

A basic material or texture atlas may be used.

Sophisticated art assets are not required.

---

# 39. UI

The MVP should keep the user interface minimal.

At minimum, the player should have:

* A visible crosshair or targeting point.
* A clear game viewport.

Optional minimal UI may include:

* Interaction instructions.
* Debug information during development.

No inventory or hotbar is required for the MVP.

---

# 40. Main Game Loop

The game should have a clear update/render lifecycle.

Conceptually:

```text
Input
  ↓
Player Update
  ↓
Physics / Collision
  ↓
Interaction / Raycast
  ↓
World Updates
  ↓
Rendering
```

The exact ordering may vary where appropriate, but the implementation must avoid inconsistent state between physics, interaction, world data, and rendering.

Time-dependent movement should use frame delta time or an equivalent mechanism.

Movement and physics must not depend on a fixed rendering frame rate.

---

# 41. Input Handling

Input state should be managed centrally or through a dedicated input system.

The game should correctly handle:

* Key press.
* Key release.
* Mouse movement.
* Mouse button press.
* Pointer lock state.

Input handling should not be scattered across unrelated game systems.

The player system should consume input state rather than directly managing browser events everywhere.

---

# 42. Configuration

Important gameplay constants should be centralized.

Examples include:

```text
playerMoveSpeed
playerJumpVelocity
playerGravity
playerHeight
playerWidth
cameraEyeHeight
interactionRange
worldWidth
worldHeight
worldDepth
chunkSize
worldSeed
```

The exact values are implementation details.

Avoid hard-coding these values throughout the codebase.

---

# 43. Performance Requirements

The initial world may be small.

However, the implementation must not fundamentally depend on:

```text
one block = one permanent rendered object
```

The renderer should be capable of evolving toward:

* Chunk-based rendering.
* Visible-face culling.
* Chunk rebuilding.
* Larger worlds.
* Chunk streaming.
* Loading/unloading distant chunks.

The MVP does not require all of these optimizations.

Correctness is more important than premature optimization.

---

# 44. Chunk Update Performance

A block modification should only rebuild the geometry that is actually affected.

For a normal block modification:

```text
Changed block
    ↓
Affected chunk
    ↓
Rebuild chunk mesh
```

If the modified block is on a chunk boundary:

```text
Changed block
    ↓
Affected chunk
+
Neighboring chunk(s)
    ↓
Rebuild affected meshes
```

The entire world should not need to be remeshed after every block modification.

---

# 45. World API

The world layer should expose a small, stable API.

Conceptually:

```text
getBlock(x, y, z)
setBlock(x, y, z, type)
removeBlock(x, y, z)
isSolid(x, y, z)
isWithinBounds(x, y, z)
getChunk(...)
markDirty(...)
```

The exact API is an implementation detail.

Rendering code should query the world through this layer rather than maintaining its own authoritative copy of block state.

---

# 46. Rendering API

Rendering should consume world/chunk state rather than define it.

Conceptually:

```text
buildChunkMesh(chunk)
rebuildChunkMesh(chunk)
removeChunkMesh(chunk)
updateVisibleChunks()
```

The renderer should never be responsible for deciding whether a block actually exists.

The world remains authoritative.

---

# 47. Interaction API

Block interaction should be separated from input handling.

Conceptually:

```text
raycastBlock(origin, direction, maxDistance)

breakBlock(target)

canPlaceBlock(target, face)

placeBlock(target, face, blockType)
```

This allows interaction behavior to evolve independently from mouse and keyboard handling.

---

# 48. Determinism

World generation must be deterministic.

For a given seed and generator version:

```text
same seed
+
same generator version
+
same parameters
=
same generated world
```

This requirement should be preserved as the generator evolves.

If a future generator intentionally changes behavior, its generator version should change accordingly.

---

# 49. Initial World Contents

The initial world must NOT contain:

* Trees.
* Caves.
* Buildings.
* Structures.
* Water.
* Lava.
* Biomes.
* Ores.
* Vegetation.
* Mobs.
* NPCs.
* Generated points of interest.
* Complex terrain features.

The initial terrain should remain intentionally simple.

---

# 50. Out of Scope

The following features are explicitly outside the initial implementation:

* Multiplayer.
* Networking.
* Accounts.
* Servers.
* Server authority.
* Mobs.
* NPCs.
* Combat.
* Inventory.
* Hotbar.
* Crafting.
* Items.
* Enemies.
* Health.
* Hunger.
* Complex procedural terrain.
* Caves.
* Biomes.
* Water simulation.
* Lava simulation.
* Redstone-like systems.
* Complex lighting.
* Day/night cycles.
* Weather.
* Farming.
* Animals.
* Achievements.
* Quests.
* Sound effects.
* Music.
* Advanced graphics settings.
* Infinite-world streaming.
* Advanced optimization systems.

These may be introduced in later versions.

---

# 51. Future Direction

The architecture should support incremental expansion.

Potential future systems include:

```text
Voxel World
├── Multiple block types
├── Chunk streaming
├── Procedural terrain
├── Biomes
├── Lighting
├── World generation
├── Structures
└── Infinite/large worlds

Player
├── Inventory
├── Hotbar
├── Items
├── Health
└── Equipment

Gameplay
├── Crafting
├── Mining
├── Building
├── Farming
└── Combat

Entities
├── Animals
├── Monsters
└── NPCs

World
├── Day/night cycle
├── Weather
└── Structures

Networking
├── Multiplayer
├── Server authority
└── Persistent shared worlds
```

These systems should be added incrementally rather than being implemented as part of the initial prototype.

---

# 52. MVP Acceptance Criteria

The initial version is considered complete when all of the following work:

## World

* [ ] A new installation generates a voxel world.
* [ ] The world contains multiple layers of blocks.
* [ ] The world has actual 3D depth.
* [ ] World generation uses a seed.
* [ ] The same seed produces the same initial terrain.
* [ ] The world is represented independently from rendering.
* [ ] The world is organized so that chunk-based rendering is possible.

## Player

* [ ] The player spawns above the terrain.
* [ ] The player never spawns inside a block.
* [ ] WASD movement works.
* [ ] Movement is collision-aware.
* [ ] The player cannot walk through solid blocks.
* [ ] Gravity works.
* [ ] Jumping works.
* [ ] The player cannot repeatedly jump while airborne.
* [ ] The player cannot fall through the terrain.

## Camera

* [ ] The game uses a first-person camera.
* [ ] Mouse-look works.
* [ ] Horizontal rotation works.
* [ ] Vertical rotation is clamped.
* [ ] The camera follows the player's position.
* [ ] Pointer lock works.
* [ ] Escape releases pointer lock.

## Interaction

* [ ] The center of the screen is used for targeting.
* [ ] A raycast determines the targeted block.
* [ ] The targeting range is limited.
* [ ] The targeted block is visually highlighted.
* [ ] Left click breaks a valid targeted block.
* [ ] Right click places a block on the targeted face.
* [ ] Blocks cannot be placed inside the player.
* [ ] Blocks cannot be placed in occupied cells.
* [ ] Blocks cannot be placed outside valid world bounds.

## Rendering

* [ ] Blocks render correctly.
* [ ] Visible faces are rendered.
* [ ] Hidden internal faces are not unnecessarily rendered.
* [ ] Block modifications update visible geometry.
* [ ] Chunk boundaries are handled correctly.
* [ ] A block change does not require rebuilding the entire world.

## Persistence

* [ ] A newly generated world can be saved.
* [ ] Breaking a block is persisted.
* [ ] Placing a block is persisted.
* [ ] Reloading the application restores modifications.
* [ ] Saved data contains a version.
* [ ] Saved data contains the world seed.
* [ ] Saved data contains the required modifications.
* [ ] Rendering objects are not persisted.
* [ ] Corrupted save data is detected.
* [ ] Invalid save data does not silently produce an invalid world.

## General

* [ ] The browser context menu does not interfere with right-click placement.
* [ ] The game remains playable at varying frame rates.
* [ ] Important gameplay constants are configurable.
* [ ] World data remains independent from renderer state.
* [ ] The game can be expanded without replacing the fundamental world representation.

---

# 53. Required Playable Flow

The complete MVP flow should work as follows:

```text
Open the game
      ↓
Initialize application
      ↓
Load persisted world
      ↓
       ┌── Valid save exists ──→ Restore world
       │
       └── No valid save ──────→ Generate world
                                      ↓
                              Initialize player
                                      ↓
                              Generate chunk meshes
                                      ↓
                              Enter first-person view
                                      ↓
                                 Move around
                                      ↓
                              Look with mouse
                                      ↓
                              Target a block
                                      ↓
                              Break the block
                                      ↓
                              World updates
                                      ↓
                              Save modification
                                      ↓
                              Place a block
                                      ↓
                              World updates
                                      ↓
                              Save modification
                                      ↓
                              Exit/reload
                                      ↓
                              Load saved world
                                      ↓
                         Modified world is restored
```

---

# 54. Development Priorities

Implementation should proceed in small verified stages.

Recommended order:

```text
1. Application/window setup
2. Rendering setup
3. Basic voxel/block representation
4. World generation
5. Chunk representation
6. Chunk mesh generation
7. Visible-face culling
8. Player representation
9. Collision
10. Gravity
11. Jumping
12. First-person camera
13. Mouse/pointer lock
14. Block raycasting
15. Target highlighting
16. Block breaking
17. Block placement
18. Persistence
19. Save validation/versioning
20. MVP acceptance testing
```

Each stage should remain functional before moving to the next.

---

# 55. Testing Priorities

The implementation should be tested against actual gameplay behavior rather than only individual functions.

Important test cases include:

### Movement

* Walk into a wall.
* Walk along a wall.
* Walk against a corner.
* Walk off a ledge.
* Land on a block.
* Jump into a ceiling.
* Attempt to move through a block.

### Block Breaking

* Break a block directly in front of the player.
* Break a block at maximum range.
* Attempt to break a block beyond maximum range.
* Break a block adjacent to a chunk boundary.
* Break a block below the player.
* Break multiple blocks consecutively.

### Block Placement

* Place on each block face.
* Place at a chunk boundary.
* Attempt to place into an occupied cell.
* Attempt to place inside the player.
* Attempt to place outside the world.
* Place multiple blocks consecutively.

### Persistence

* Break a block and reload.
* Place a block and reload.
* Perform multiple modifications and reload.
* Start a fresh world.
* Load valid saved data.
* Attempt to load malformed saved data.
* Attempt to load an unsupported save version.

### Determinism

* Generate two worlds with the same seed.
* Verify their generated terrain is identical.
* Generate worlds with different seeds.
* Verify that the generator is seed-driven.

---

# 56. Code Quality Requirements

The implementation should favor clear and maintainable code over premature optimization.

Avoid:

* Global mutable state where unnecessary.
* Duplicated block logic.
* Renderer-owned world state.
* Hard-coded block behavior.
* Hard-coded world dimensions throughout the code.
* Hard-coded physics constants scattered across files.
* Direct manipulation of rendering objects from gameplay systems.
* Serialization of runtime graphics objects.

Prefer:

* Small focused modules.
* Explicit interfaces.
* Data-driven block types.
* Centralized configuration.
* Deterministic generation.
* Testable world operations.
* Clear separation between simulation and rendering.

---

# 57. Guiding Principle

Build the smallest complete playable voxel sandbox first.

Do not implement future gameplay systems prematurely.

The MVP should demonstrate that the fundamental loop is correct:

```text
Generate
   ↓
Explore
   ↓
Target
   ↓
Break
   ↓
Place
   ↓
Save
   ↓
Reload
   ↓
Continue
```

The architecture should make future expansion possible, but the initial implementation should remain deliberately small.

Correctness, maintainability, and a solid foundation are more important than the number of features implemented.

# 58. Definition of Done

The project is complete for the initial version when a user can:

```text
Open the game
      ↓
See a generated 3D voxel world
      ↓
Enter first-person control
      ↓
Walk around the terrain
      ↓
Jump
      ↓
Look around with the mouse
      ↓
Target a block
      ↓
See the targeted block highlighted
      ↓
Break the block
      ↓
See the world update
      ↓
Place a block
      ↓
See the world update
      ↓
Reload the application
      ↓
See the modified world restored
      ↓
Continue playing
```

No additional gameplay systems are required for the initial release.
