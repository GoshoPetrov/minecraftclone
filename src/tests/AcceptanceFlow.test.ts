import { describe, expect, it } from 'vitest';

import { config } from '../config/Config';
import { BlockInteractor } from '../interaction/BlockInteractor';
import { raycastBlock, type BlockHit } from '../interaction/BlockRaycaster';
import { InMemoryWorldRepository } from '../persistence/InMemoryWorldRepository';
import { SAVE_VERSION, worldMetadataFrom, type SaveData } from '../persistence/SaveData';
import { loadWorld } from '../persistence/WorldPersistence';
import {
  createPlayerState,
  idleIntent,
  playerAabb,
  type PlayerIntent,
  type PlayerState,
} from '../player/Player';
import { PlayerController } from '../player/PlayerController';
import { step } from '../player/PlayerPhysics';
import { createVitals, isDead, updateVitals, type VitalsState } from '../player/Vitals';
import { findSpawn } from '../player/Spawn';
import { BlockIds } from '../world/Block';
import { createDefaultBlockRegistry } from '../world/BlockRegistry';
import { World } from '../world/World';

/**
 * End-to-end acceptance coverage for the MVP playable flow.
 *
 * These tests drive the same domain systems the game wires together in
 * `Game` — persistence, spawn, physics, look, raycasting, interaction — but
 * without a WebGL context, so the whole flow is exercised headlessly. The
 * parts that genuinely need a browser (pointer lock, context-menu
 * suppression, real rendering, the real IndexedDB adapter) stay covered by
 * the manual runbook in `docs/acceptance-001-voxel-sandbox-mvp.md`.
 */

const registry = createDefaultBlockRegistry();
const METADATA = worldMetadataFrom(config.world.sizeInChunks, config.generation);
const RANGE = config.interaction.range;
const BASIC = registry.get(BlockIds.basic);

/** The `loadWorld` options the browser game would use, with a fake store. */
function loadOptions(repository: InMemoryWorldRepository, storageAvailable = true) {
  return {
    repository,
    registry,
    fallbackMetadata: METADATA,
    debounceMs: config.persistence.saveDebounceMs,
    storageAvailable,
  } as const;
}

/** Load a fresh generated world through the real persistence path. */
function freshWorld(
  repository: InMemoryWorldRepository = new InMemoryWorldRepository(),
  storageAvailable = true,
) {
  return loadWorld(loadOptions(repository, storageAvailable));
}

/**
 * A flat 16×64×16 test world: bedrock floor, three layers of basic blocks,
 * air above. Used for physics and rejection cases that need controlled
 * geometry rather than terrain.
 */
function flatWorld(): World {
  const world = new World({ sizeInChunks: { x: 1, y: 1, z: 1 } }, registry);
  for (let z = 0; z < world.size.z; z += 1) {
    for (let x = 0; x < world.size.x; x += 1) {
      world.setBlock(x, 0, z, BlockIds.bedrock);
      for (let y = 1; y <= 3; y += 1) {
        world.setBlock(x, y, z, BlockIds.basic);
      }
    }
  }
  world.beginTrackingEdits();
  return world;
}

/** Advance the simulation for `seconds` at a fixed frame delta. */
function simulate(
  state: PlayerState,
  intent: PlayerIntent,
  world: World,
  dt: number,
  seconds: number,
): PlayerState {
  let next = state;
  const frames = Math.max(1, Math.round(seconds / dt));
  for (let i = 0; i < frames; i += 1) {
    next = step(next, intent, world, dt);
  }
  return next;
}

/**
 * Advance the real `step` and the real `updateVitals` together, passing the
 * exact previous and next states the game wires together each frame.
 */
function simulateVitals(
  state: PlayerState,
  vitals: VitalsState,
  intent: PlayerIntent,
  world: World,
  dt: number,
  seconds: number,
): { readonly state: PlayerState; readonly vitals: VitalsState } {
  let nextState = state;
  let nextVitals = vitals;
  const frames = Math.max(1, Math.round(seconds / dt));
  for (let i = 0; i < frames; i += 1) {
    const previous = nextState;
    nextState = step(previous, intent, world, dt);
    nextVitals = updateVitals(nextVitals, previous, nextState, dt);
  }
  return { state: nextState, vitals: nextVitals };
}

/** The highest solid block Y in a column. */
function topSolidAt(world: World, x: number, z: number): number {
  for (let y = world.size.y - 1; y >= 0; y -= 1) {
    if (world.isSolid(x, y, z)) {
      return y;
    }
  }
  throw new Error(`No solid block in column (${x}, ${z}).`);
}

/** Every block id in the world, in a stable chunk order, for comparisons. */
function blockData(world: World): readonly number[] {
  const blocks: number[] = [];
  for (const chunk of world.chunks()) {
    blocks.push(...chunk.data);
  }
  return blocks;
}

describe('acceptance: world generation and spawn', () => {
  it('generates a fresh multi-layer, 3D world when no save exists', async () => {
    const loaded = await freshWorld();

    expect(loaded.status).toBe('new');
    expect(loaded.messages).toEqual([]);
    expect(loaded.world.sizeInChunks).toEqual(config.world.sizeInChunks);

    // A solid floor with many solid layers and air above it.
    const x = 4;
    const z = 4;
    expect(loaded.world.getBlock(x, 0, z)).toBe(BlockIds.bedrock);
    const top = topSolidAt(loaded.world, x, z);
    expect(top).toBeGreaterThan(1);
    expect(loaded.world.getBlock(x, top + 1, z)).toBe(BlockIds.air);
  });

  it('spawns above the terrain, never inside a block, with headroom', async () => {
    const loaded = await freshWorld();
    const spawn = findSpawn(loaded.world);
    const bx = Math.floor(spawn.x);
    const bz = Math.floor(spawn.z);
    const by = Math.floor(spawn.y);

    // Standing on ground, with two clear blocks above the feet.
    expect(loaded.world.isSolid(bx, by - 1, bz)).toBe(true);
    expect(loaded.world.isSolid(bx, by, bz)).toBe(false);
    expect(loaded.world.isSolid(bx, by + 1, bz)).toBe(false);

    // The player's collision box overlaps no solid block.
    const bounds = playerAabb(spawn);
    for (let x = Math.floor(bounds.minX); x <= Math.floor(bounds.maxX - 1e-9); x += 1) {
      for (let y = Math.floor(bounds.minY); y <= Math.floor(bounds.maxY - 1e-9); y += 1) {
        for (let z = Math.floor(bounds.minZ); z <= Math.floor(bounds.maxZ - 1e-9); z += 1) {
          expect(loaded.world.isSolid(x, y, z)).toBe(false);
        }
      }
    }
  });

  it('is deterministic for a fixed seed', async () => {
    const first = await freshWorld();
    const second = await freshWorld();

    expect(blockData(first.world)).toEqual(blockData(second.world));
  });
});

describe('acceptance: gravity, collision, and jumping', () => {
  it('falls under gravity and lands on solid ground', () => {
    const world = flatWorld();
    const start = createPlayerState({ x: 8.5, y: 10, z: 8.5 });

    const landed = simulate(start, idleIntent(), world, 1 / 60, 3);

    expect(landed.grounded).toBe(true);
    expect(landed.position.y).toBeCloseTo(4, 3);
  });

  it('jumps while grounded but cannot jump again in mid-air', () => {
    const world = flatWorld();
    const grounded = simulate(
      createPlayerState({ x: 8.5, y: 10, z: 8.5 }),
      idleIntent(),
      world,
      1 / 60,
      2,
    );
    expect(grounded.grounded).toBe(true);

    const jump: PlayerIntent = { move: { x: 0, z: 0 }, jump: true, sprint: false, crouch: false };
    const rising = step(grounded, jump, world, 1 / 60);
    expect(rising.grounded).toBe(false);
    expect(rising.velocity.y).toBeGreaterThan(0);

    // Holding jump while airborne only applies gravity: no second impulse.
    const falling = step(rising, jump, world, 1 / 60);
    expect(falling.velocity.y).toBeLessThan(rising.velocity.y);
    expect(falling.velocity.y).toBeLessThan(config.player.jumpVelocity);

    const backDown = simulate(falling, idleIntent(), world, 1 / 60, 3);
    expect(backDown.grounded).toBe(true);
    expect(backDown.position.y).toBeCloseTo(4, 3);
  });

  it('cannot walk through a solid wall', () => {
    const world = flatWorld();
    for (let y = 4; y <= 5; y += 1) {
      world.setBlock(10, y, 8, BlockIds.basic);
    }

    const player = simulate(
      createPlayerState({ x: 2.5, y: 4, z: 8.5 }),
      { move: { x: 1, z: 0 }, jump: false, sprint: false, crouch: false },
      world,
      1 / 60,
      5,
    );

    // Stopped at the wall's face, never inside it.
    expect(player.position.x).toBeLessThanOrEqual(10 - config.player.width / 2 + 1e-6);
    expect(world.isSolid(Math.floor(player.position.x) + 1, 4, 8)).toBe(true);
  });

  it('cannot tunnel through terrain at a large or varying frame delta', () => {
    const world = flatWorld();

    const fastFall = simulate(
      createPlayerState({ x: 8.5, y: 60, z: 8.5 }),
      idleIntent(),
      world,
      0.05,
      6,
    );

    expect(fastFall.grounded).toBe(true);
    expect(fastFall.position.y).toBeCloseTo(4, 3);
  });

  it('moves consistently at different frame rates', () => {
    const world = flatWorld();
    const dts = [1 / 120, 1 / 60, 1 / 30, 0.05];
    const results = dts.map((dt) =>
      simulate(
        createPlayerState({ x: 2.5, y: 4, z: 8.5 }),
        { move: { x: 1, z: 0 }, jump: false, sprint: false, crouch: false },
        world,
        dt,
        2,
      ),
    );

    for (const result of results) {
      expect(result.grounded).toBe(true);
      expect(result.position.y).toBeCloseTo(4, 5);
    }
    const xs = results.map((result) => result.position.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.2);
  });
});

describe('acceptance: first-person look', () => {
  it('turns horizontally without limit and clamps vertical look', () => {
    const controller = new PlayerController();

    controller.applyLook({ dx: 10_000, dy: 0 });
    expect(controller.orientation.yaw).toBeGreaterThan(-Math.PI);
    expect(controller.orientation.yaw).toBeLessThanOrEqual(Math.PI);

    controller.applyLook({ dx: 0, dy: 10_000 });
    expect(controller.orientation.pitch).toBeCloseTo(-config.camera.maxPitchRadians);

    controller.applyLook({ dx: 0, dy: -20_000 });
    expect(controller.orientation.pitch).toBeCloseTo(config.camera.maxPitchRadians);

    const direction = controller.lookDirection;
    expect(Math.hypot(direction.x, direction.y, direction.z)).toBeCloseTo(1);
  });
});

describe('acceptance: targeting, editing, saving, and reloading', () => {
  it('runs the required flow from generation through restore', async () => {
    const repository = new InMemoryWorldRepository();
    const loaded = await freshWorld(repository);
    expect(loaded.status).toBe('new');
    const world = loaded.world;

    // Settle the player on the terrain near the centre.
    const spawn = findSpawn(world);
    const bx = Math.floor(spawn.x);
    const bz = Math.floor(spawn.z);
    let player = simulate(
      createPlayerState({ x: spawn.x, y: spawn.y + 3, z: spawn.z }),
      idleIntent(),
      world,
      1 / 60,
      3,
    );
    expect(player.grounded).toBe(true);

    // Raycast from directly above the central column: the screen centre hits
    // the top face of the highest solid block.
    const surfaceY = topSolidAt(world, bx, bz);
    const eye = { x: bx + 0.5, y: surfaceY + 3, z: bz + 0.5 };
    const target = raycastBlock(world, eye, { x: 0, y: -1, z: 0 }, RANGE);
    expect(target).not.toBeNull();
    expect(target?.blockPos).toEqual({ x: bx, y: surfaceY, z: bz });
    expect(target?.faceNormal).toEqual({ x: 0, y: 1, z: 0 });
    expect(target?.distance).toBeGreaterThan(0);
    expect(target?.distance).toBeLessThanOrEqual(RANGE);

    // The same aim beyond range finds nothing.
    expect(raycastBlock(world, eye, { x: 0, y: -1, z: 0 }, 1)).toBeNull();

    const interactor = new BlockInteractor(world, registry);

    // Left click breaks the target.
    expect(interactor.breakBlock(target, RANGE)).toBe(true);
    expect(world.getBlock(bx, surfaceY, bz)).toBe(BlockIds.air);

    // Right click places against another column's top face.
    const px = (bx + 5) % world.size.x;
    const pz = (bz + 7) % world.size.z;
    const placementBaseY = topSolidAt(world, px, pz);
    const placementEye = { x: px + 0.5, y: placementBaseY + 3, z: pz + 0.5 };
    const placementTarget = raycastBlock(
      world,
      placementEye,
      { x: 0, y: -1, z: 0 },
      RANGE,
    );
    expect(placementTarget).not.toBeNull();

    const playerBounds = playerAabb(player.position);
    expect(interactor.placeBlock(placementTarget, playerBounds, BASIC, RANGE)).toBe(true);
    expect(world.getBlock(px, placementBaseY + 1, pz)).toBe(BlockIds.basic);

    // A second placement into the now-occupied cell changes nothing.
    const beforeRejected = world.modifications();
    expect(interactor.placeBlock(placementTarget, playerBounds, BASIC, RANGE)).toBe(false);
    expect(world.modifications()).toEqual(beforeRejected);

    // Both edits are tracked as deltas from generated terrain.
    const modifications = world.modifications();
    expect(modifications).toHaveLength(2);
    expect(modifications).toContainEqual({ x: bx, y: surfaceY, z: bz, id: BlockIds.air });
    expect(modifications).toContainEqual({
      x: px,
      y: placementBaseY + 1,
      z: pz,
      id: BlockIds.basic,
    });

    // An edit schedules persistence; flushing writes it.
    loaded.persistence.markDirty();
    await loaded.persistence.flush();
    expect(repository.saves).toBe(1);

    // Reloading restores every modification exactly.
    const restored = await loadWorld(loadOptions(repository));
    expect(restored.status).toBe('restored');
    expect(restored.messages).toEqual([]);
    expect(restored.world.modifications()).toEqual(modifications);
    expect(blockData(restored.world)).toEqual(blockData(world));
  });

  it('backs up a corrupt save and starts fresh with a dismissible notice', async () => {
    const repository = new InMemoryWorldRepository();
    const corrupt = { version: SAVE_VERSION, seed: 'not-a-number', modifications: [] };
    await repository.save(corrupt as unknown as SaveData);

    const recovered = await loadWorld(loadOptions(repository));

    expect(recovered.status).toBe('recovered');
    expect(recovered.messages).toHaveLength(1);
    const notice = recovered.messages[0];
    expect(notice?.dismissible).toBe(true);
    expect(notice?.message).toMatch(/backup/i);
    // The bad record is preserved, not overwritten, and never applied.
    expect(repository.peek()).toEqual(corrupt);
    expect(repository.peekBackups()).toEqual([corrupt]);
    expect(recovered.world.modifications()).toEqual([]);
  });

  it('runs in memory with a persistent notice when storage is unavailable', async () => {
    const loaded = await freshWorld(new InMemoryWorldRepository(), false);

    expect(loaded.status).toBe('storage-unavailable');
    expect(loaded.persistence.autoSaveEnabled).toBe(false);
    expect(loaded.messages).toHaveLength(1);
    expect(loaded.messages[0]?.persistent).toBe(true);
  });
});

describe('acceptance: rejected interactions do nothing', () => {
  function setup(): { world: World; interactor: BlockInteractor; playerBounds: ReturnType<typeof playerAabb> } {
    const world = flatWorld();
    return {
      world,
      interactor: new BlockInteractor(world, registry),
      // A player standing on the flat ground at (8.5, 4, 8.5).
      playerBounds: playerAabb({ x: 8.5, y: 4, z: 8.5 }),
    };
  }

  it('rejects placement inside the player', () => {
    const { world, interactor, playerBounds } = setup();
    // The supporting block's top face would place into the player's feet.
    const target: BlockHit = {
      blockPos: { x: 8, y: 3, z: 8 },
      faceNormal: { x: 0, y: 1, z: 0 },
      distance: 1,
    };

    expect(interactor.canPlaceBlock(target, playerBounds, BASIC, RANGE)).toBe(false);
    expect(interactor.placeBlock(target, playerBounds, BASIC, RANGE)).toBe(false);
    expect(world.getBlock(8, 4, 8)).toBe(BlockIds.air);
    expect(world.modifications()).toEqual([]);
  });

  it('rejects placement into an occupied cell', () => {
    const { world, interactor, playerBounds } = setup();
    const target: BlockHit = {
      blockPos: { x: 8, y: 3, z: 8 },
      faceNormal: { x: 0, y: -1, z: 0 },
      distance: 1,
    };

    const before = world.modifications();
    expect(interactor.placeBlock(target, playerBounds, BASIC, RANGE)).toBe(false);
    expect(world.getBlock(8, 2, 8)).toBe(BlockIds.basic);
    expect(world.modifications()).toEqual(before);
  });

  it('rejects placement outside the world bounds', () => {
    const { world, interactor, playerBounds } = setup();
    const target: BlockHit = {
      blockPos: { x: 0, y: 3, z: 0 },
      faceNormal: { x: -1, y: 0, z: 0 },
      distance: 1,
    };

    expect(interactor.placeBlock(target, playerBounds, BASIC, RANGE)).toBe(false);
    expect(world.modifications()).toEqual([]);
  });

  it('rejects break and place beyond the interaction range', () => {
    const { world, interactor, playerBounds } = setup();
    const target: BlockHit = {
      blockPos: { x: 8, y: 3, z: 8 },
      faceNormal: { x: 0, y: 1, z: 0 },
      distance: RANGE + 0.5,
    };

    expect(interactor.breakBlock(target, RANGE)).toBe(false);
    expect(interactor.placeBlock(target, playerBounds, BASIC, RANGE)).toBe(false);
    expect(world.getBlock(8, 3, 8)).toBe(BlockIds.basic);
    expect(world.modifications()).toEqual([]);
  });

  it('rejects breaking the unbreakable floor and acting without a target', () => {
    const { world, interactor, playerBounds } = setup();
    const bedrock: BlockHit = {
      blockPos: { x: 8, y: 0, z: 8 },
      faceNormal: { x: 0, y: 1, z: 0 },
      distance: 1,
    };

    expect(interactor.breakBlock(bedrock, RANGE)).toBe(false);
    expect(world.getBlock(8, 0, 8)).toBe(BlockIds.bedrock);

    expect(interactor.breakBlock(null, RANGE)).toBe(false);
    expect(interactor.placeBlock(null, playerBounds, BASIC, RANGE)).toBe(false);
    expect(world.modifications()).toEqual([]);
  });
});

describe('acceptance: fall damage', () => {
  it('a controlled drop from a lethal height ends dead', () => {
    const world = flatWorld();
    const start = createPlayerState({ x: 8.5, y: 30, z: 8.5 });

    const result = simulateVitals(start, createVitals(), idleIntent(), world, 1 / 60, 6);

    expect(result.state.grounded).toBe(true);
    expect(result.state.position.y).toBeCloseTo(4, 3);
    expect(isDead(result.vitals)).toBe(true);
  });

  it('a plain jump on flat ground never deals damage', () => {
    const world = flatWorld();
    const grounded = simulate(
      createPlayerState({ x: 8.5, y: 10, z: 8.5 }),
      idleIntent(),
      world,
      1 / 60,
      3,
    );
    expect(grounded.grounded).toBe(true);

    const jump: PlayerIntent = { move: { x: 0, z: 0 }, jump: true, sprint: false, crouch: false };
    const previous = grounded;
    const rising = step(previous, jump, world, 1 / 60);
    const afterJump = updateVitals(createVitals(), previous, rising, 1 / 60);
    const result = simulateVitals(rising, afterJump, idleIntent(), world, 1 / 60, 4);

    expect(result.state.grounded).toBe(true);
    expect(result.vitals.health).toBe(config.player.maxHealth);
  });

  it('landing on a block placed mid-fall prevents the lethal full-fall damage', () => {
    const world = flatWorld();
    // A platform in the fall path, four blocks up. Without it the same drop
    // is lethal; landing on it shortens the fall enough to survive.
    for (let x = 7; x <= 9; x += 1) {
      for (let z = 7; z <= 9; z += 1) {
        world.setBlock(x, 15, z, BlockIds.basic);
      }
    }
    const start = createPlayerState({ x: 8.5, y: 30, z: 8.5 });

    const result = simulateVitals(start, createVitals(), idleIntent(), world, 1 / 60, 6);

    expect(result.state.grounded).toBe(true);
    expect(result.state.position.y).toBeCloseTo(16, 3);
    expect(isDead(result.vitals)).toBe(false);
    // It still costs health: the fall is beyond the safe distance.
    expect(result.vitals.health).toBeLessThan(config.player.maxHealth);
  });
});

describe('acceptance: death and respawn', () => {
  /**
   * The avatar dies when a lethal drop lands. Respawn then builds a fresh
   * player from the deterministic spawn search (the same call the game makes),
   * which lands under gravity with full health and no fall residue.
   */
  it('a lethal fall ends dead and respawn recovers a fresh avatar', () => {
    const world = flatWorld();
    const start = createPlayerState({ x: 8.5, y: 30, z: 8.5 });

    const died = simulateVitals(start, createVitals(), idleIntent(), world, 1 / 60, 6);
    expect(died.state.grounded).toBe(true);
    expect(isDead(died.vitals)).toBe(true);

    // Respawn: a fresh state at the spawn search's feet position, plus fresh
    // vitals. Velocity and the fall accumulator are back to zero.
    const respawned = createPlayerState(findSpawn(world));
    const vitals = createVitals();
    expect(respawned.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(respawned.grounded).toBe(false);
    expect(isDead(vitals)).toBe(false);
    expect(vitals.health).toBe(config.player.maxHealth);
    expect(vitals.fallDistance).toBe(0);

    // The spawn sits on the surface, so the avatar settles immediately and
    // the negligible drop still costs nothing.
    const settled = simulateVitals(respawned, vitals, idleIntent(), world, 1 / 60, 1);
    expect(settled.state.grounded).toBe(true);
    expect(settled.state.position.y).toBeCloseTo(4, 3);
    expect(settled.vitals.health).toBe(config.player.maxHealth);
    expect(isDead(settled.vitals)).toBe(false);
  });

  /**
   * The void is the case the freeze protects: a walk off the world edge ends
   * dead below the threshold, and respawn recovers to the surface.
   */
  it('a void fall ends dead and respawn recovers a fresh avatar', () => {
    const world = flatWorld();
    const start = createPlayerState({ x: 2.5, y: 4, z: 8.5 });
    const walkOff: PlayerIntent = {
      move: { x: 1, z: 0 },
      jump: false,
      sprint: false,
      crouch: false,
    };

    const grounded = simulateVitals(start, createVitals(), walkOff, world, 1 / 60, 3);
    const died = simulateVitals(grounded.state, grounded.vitals, walkOff, world, 1 / 60, 10);
    expect(died.state.position.y).toBeLessThan(config.player.voidY);
    expect(died.vitals.inVoid).toBe(true);
    expect(isDead(died.vitals)).toBe(true);

    const respawned = createPlayerState(findSpawn(world));
    const vitals = createVitals();
    expect(isDead(vitals)).toBe(false);
    expect(vitals.health).toBe(config.player.maxHealth);
    expect(vitals.fallDistance).toBe(0);
    expect(vitals.inVoid).toBe(false);

    const settled = simulateVitals(respawned, vitals, idleIntent(), world, 1 / 60, 1);
    expect(settled.state.grounded).toBe(true);
    expect(settled.state.position.y).toBeGreaterThan(config.player.voidY);
    expect(settled.vitals.health).toBe(config.player.maxHealth);
    expect(isDead(settled.vitals)).toBe(false);
  });

  it('respawn from the spawn search respects player edits to the world', () => {
    const world = flatWorld();
    // Dig out the surface block the search would otherwise stand on. The
    // search re-reads the world, so it must place the avatar on the new top.
    world.removeBlock(8, 3, 8);

    const respawned = createPlayerState(findSpawn(world));
    const bx = Math.floor(respawned.position.x);
    const bz = Math.floor(respawned.position.z);
    expect(world.isSolid(bx, Math.floor(respawned.position.y) - 1, bz)).toBe(true);
    expect(world.getBlock(8, 3, 8)).toBe(BlockIds.air);
  });
});

describe('acceptance: void damage', () => {
  it('walking off the world edge kills via the void within the expected time', () => {
    const world = flatWorld();
    // Start grounded near the +x edge and walk straight off it. Out past the
    // last block the world is air at every height, so physics lets the avatar
    // fall freely below the void threshold.
    const start = createPlayerState({ x: 2.5, y: 4, z: 8.5 });
    const walkOff: PlayerIntent = {
      move: { x: 1, z: 0 },
      jump: false,
      sprint: false,
      crouch: false,
    };

    // Three seconds in the avatar is still on the ground with full health.
    const grounded = simulateVitals(start, createVitals(), walkOff, world, 1 / 60, 3);
    expect(grounded.state.position.x).toBeLessThan(16);
    expect(grounded.vitals.health).toBe(config.player.maxHealth);
    expect(isDead(grounded.vitals)).toBe(false);

    // Long enough to cross the edge, fall out of the world, and take the
    // void ticks that drain the full bar.
    const result = simulateVitals(grounded.state, grounded.vitals, walkOff, world, 1 / 60, 10);

    expect(result.state.position.y).toBeLessThan(config.player.voidY);
    expect(result.vitals.inVoid).toBe(true);
    expect(isDead(result.vitals)).toBe(true);
    expect(result.vitals.health).toBe(0);
  });
});
