import { describe, expect, it } from 'vitest';

import { config } from '../config/Config';
import { BlockIds } from '../world/Block';
import { createDefaultBlockRegistry, type BlockRegistry } from '../world/BlockRegistry';
import { CHUNK_SIZE_X, CHUNK_SIZE_Z } from '../world/Chunk';
import { World } from '../world/World';
import {
  createPlayerState,
  idleIntent,
  playerAabb,
  type PlayerIntent,
  type PlayerState,
} from '../player/Player';
import { step } from '../player/PlayerPhysics';

const registry: BlockRegistry = createDefaultBlockRegistry();
const EPSILON = 1e-9;

/** A single-chunk world with a solid floor at y = 0 (its top surface is y = 1). */
function createPhysicsWorld(): World {
  const world = new World({ sizeInChunks: { x: 1, y: 1, z: 1 } }, registry);
  for (let x = 0; x < CHUNK_SIZE_X; x += 1) {
    for (let z = 0; z < CHUNK_SIZE_Z; z += 1) {
      world.setBlock(x, 0, z, BlockIds.basic);
    }
  }
  return world;
}

function fillLayer(world: World, y: number): void {
  for (let x = 0; x < CHUNK_SIZE_X; x += 1) {
    for (let z = 0; z < CHUNK_SIZE_Z; z += 1) {
      world.setBlock(x, y, z, BlockIds.basic);
    }
  }
}

function moveIntent(x: number, z: number): PlayerIntent {
  return { move: { x, z }, jump: false, sprint: false };
}

function sprintIntent(x: number, z: number): PlayerIntent {
  return { move: { x, z }, jump: false, sprint: true };
}

function runSteps(
  state: PlayerState,
  intent: PlayerIntent,
  world: World,
  steps: number,
  dt = 1 / 60,
): PlayerState {
  let current = state;
  for (let i = 0; i < steps; i += 1) {
    current = step(current, intent, world, dt);
  }
  return current;
}

/** Whether a player's collision box overlaps any solid world block. */
function overlapsSolid(world: World, state: PlayerState): boolean {
  const bounds = playerAabb(state.position);
  for (let bx = Math.floor(bounds.minX); bx <= Math.floor(bounds.maxX - EPSILON); bx += 1) {
    for (let by = Math.floor(bounds.minY); by <= Math.floor(bounds.maxY - EPSILON); by += 1) {
      for (let bz = Math.floor(bounds.minZ); bz <= Math.floor(bounds.maxZ - EPSILON); bz += 1) {
        if (world.isSolid(bx, by, bz)) {
          return true;
        }
      }
    }
  }
  return false;
}

describe('player gravity and landing', () => {
  it('pulls a falling player down and lands it on the floor', () => {
    const world = createPhysicsWorld();
    const state = createPlayerState({ x: 8, y: 6, z: 8 });

    const landed = runSteps(state, idleIntent(), world, 120);

    expect(landed.grounded).toBe(true);
    expect(landed.position.y).toBeCloseTo(1, 5);
    expect(landed.velocity.y).toBe(0);
    expect(landed.movement).toBe('idle');
  });

  it('reports walking while moving on solid ground', () => {
    const world = createPhysicsWorld();
    const settled = runSteps(createPlayerState({ x: 8, y: 1, z: 8 }), idleIntent(), world, 10);

    const walked = runSteps(settled, moveIntent(1, 0), world, 30);

    expect(walked.grounded).toBe(true);
    expect(walked.movement).toBe('walking');
  });
});

describe('player wall and corner sliding', () => {
  it('stops at a wall and cannot be pushed into it', () => {
    const world = createPhysicsWorld();
    world.setBlock(10, 1, 8, BlockIds.basic);
    world.setBlock(10, 2, 8, BlockIds.basic);
    const state = createPlayerState({ x: 8, y: 1, z: 8 });

    let current = state;
    for (let i = 0; i < 180; i += 1) {
      current = step(current, moveIntent(1, 0), world, 1 / 60);
      expect(overlapsSolid(world, current)).toBe(false);
    }

    expect(playerAabb(current.position).maxX).toBeLessThanOrEqual(10 + EPSILON);
    expect(current.position.x).toBeCloseTo(10 - config.player.width / 2, 5);
  });

  it('slides along a wall on the unblocked axis instead of sticking', () => {
    const world = createPhysicsWorld();
    for (let z = 0; z < CHUNK_SIZE_Z; z += 1) {
      world.setBlock(10, 1, z, BlockIds.basic);
      world.setBlock(10, 2, z, BlockIds.basic);
    }
    const state = createPlayerState({ x: 8, y: 1, z: 8 });

    const slid = runSteps(state, moveIntent(1, 1), world, 60);

    expect(slid.position.x).toBeCloseTo(10 - config.player.width / 2, 5);
    expect(slid.position.z).toBeGreaterThan(10);
    expect(overlapsSolid(world, slid)).toBe(false);
  });

  it('slides around a lone corner block rather than clipping through it', () => {
    const world = createPhysicsWorld();
    world.setBlock(10, 1, 10, BlockIds.basic);
    world.setBlock(10, 2, 10, BlockIds.basic);
    const state = createPlayerState({ x: 8, y: 1, z: 8 });

    let current = state;
    for (let i = 0; i < 180; i += 1) {
      current = step(current, moveIntent(1, 1), world, 1 / 60);
      expect(overlapsSolid(world, current)).toBe(false);
    }

    expect(current.position.z).toBeGreaterThan(11);
    expect(current.position.x).toBeGreaterThan(10.5);
  });

  it('does not let diagonal input move faster than axis-aligned input', () => {
    const world = createPhysicsWorld();
    const seconds = 0.5;
    const steps = Math.round(seconds * 60);

    const straight = runSteps(createPlayerState({ x: 4, y: 1, z: 4 }), moveIntent(1, 0), world, steps);
    const diagonal = runSteps(createPlayerState({ x: 4, y: 1, z: 4 }), moveIntent(1, 1), world, steps);

    const straightDistance = Math.hypot(straight.position.x - 4, straight.position.z - 4);
    const diagonalDistance = Math.hypot(diagonal.position.x - 4, diagonal.position.z - 4);

    expect(diagonalDistance).toBeCloseTo(straightDistance, 5);
    expect(straightDistance).toBeLessThanOrEqual(config.player.moveSpeed * seconds + EPSILON);
  });
});

describe('player sprint', () => {
  const seconds = 0.5;
  const steps = Math.round(seconds * 60);

  function travel(intent: PlayerIntent): { state: PlayerState; distance: number } {
    const world = createPhysicsWorld();
    const start = { x: 2, y: 1, z: 8 };
    const state = runSteps(createPlayerState(start), intent, world, steps);
    return {
      state,
      distance: Math.hypot(state.position.x - start.x, state.position.z - start.z),
    };
  }

  it('moves exactly the sprint multiplier further than a walk', () => {
    const walked = travel(moveIntent(1, 0));
    const sprinted = travel(sprintIntent(1, 0));

    expect(walked.state.grounded).toBe(true);
    expect(sprinted.state.grounded).toBe(true);
    expect(sprinted.distance / walked.distance).toBeCloseTo(
      config.player.sprintSpeedMultiplier,
      5,
    );
    expect(sprinted.distance).toBeCloseTo(
      config.player.moveSpeed * config.player.sprintSpeedMultiplier * seconds,
      5,
    );
  });

  it('does not move faster diagonally than along an axis', () => {
    const straight = travel(sprintIntent(1, 0));
    const diagonal = travel(sprintIntent(1, 1));

    expect(diagonal.distance).toBeCloseTo(straight.distance, 5);
  });

  it('does nothing while standing still', () => {
    const world = createPhysicsWorld();
    const settled = runSteps(createPlayerState({ x: 8, y: 1, z: 8 }), idleIntent(), world, 10);
    const still: PlayerIntent = { move: { x: 0, z: 0 }, jump: false, sprint: true };

    const held = runSteps(settled, still, world, 30);

    expect(held.position.x).toBe(settled.position.x);
    expect(held.position.z).toBe(settled.position.z);
    expect(held.velocity.x).toBe(0);
    expect(held.velocity.z).toBe(0);
    expect(held.movement).toBe('idle');
  });

  it('applies the sprint speed while airborne and through a jump', () => {
    const world = createPhysicsWorld();
    // Falling from height keeps the player airborne for the whole interval.
    const start = { x: 2, y: 40, z: 8 };
    const air = runSteps(createPlayerState(start), sprintIntent(1, 0), world, steps);
    const sprintSpeed = config.player.moveSpeed * config.player.sprintSpeedMultiplier;

    expect(air.grounded).toBe(false);
    expect(air.velocity.x).toBeCloseTo(sprintSpeed, 5);
    expect(air.position.x - start.x).toBeCloseTo(sprintSpeed * seconds, 5);

    // A sprint-jump keeps the boosted horizontal speed for the whole arc.
    const grounded = runSteps(createPlayerState({ x: 2, y: 1, z: 8 }), idleIntent(), world, 10);
    const airborneIntent: PlayerIntent = { move: { x: 1, z: 0 }, jump: false, sprint: true };
    let current = step(
      grounded,
      { move: { x: 1, z: 0 }, jump: true, sprint: true },
      world,
      1 / 60,
    );
    expect(current.grounded).toBe(false);
    for (let i = 0; i < 20; i += 1) {
      current = step(current, airborneIntent, world, 1 / 60);
      expect(current.velocity.x).toBeCloseTo(sprintSpeed, 5);
    }
  });

  it('reports the movement label for each mode', () => {
    const world = createPhysicsWorld();
    const still = runSteps(createPlayerState({ x: 8, y: 1, z: 8 }), idleIntent(), world, 10);
    expect(still.movement).toBe('idle');

    expect(runSteps(still, moveIntent(1, 0), world, 5).movement).toBe('walking');
    expect(runSteps(still, sprintIntent(1, 0), world, 5).movement).toBe('sprinting');

    const airborne = step(
      still,
      { move: { x: 0, z: 0 }, jump: true, sprint: true },
      world,
      1 / 60,
    );
    expect(airborne.movement).toBe('airborne');
  });
});

describe('player ledge falls', () => {
  it('becomes airborne and falls when walking off the edge of the floor', () => {
    const world = createPhysicsWorld();
    // Remove the floor beyond x = 9 so there is a ledge at x = 10.
    for (let x = 10; x < CHUNK_SIZE_X; x += 1) {
      for (let z = 0; z < CHUNK_SIZE_Z; z += 1) {
        world.removeBlock(x, 0, z);
      }
    }
    const state = createPlayerState({ x: 8, y: 1, z: 8 });

    const falling = runSteps(state, moveIntent(1, 0), world, 120);

    expect(falling.grounded).toBe(false);
    expect(falling.movement).toBe('airborne');
    expect(falling.position.y).toBeLessThan(1);
  });
});

describe('player jumping', () => {
  const jumpIntent: PlayerIntent = { move: { x: 0, z: 0 }, jump: true, sprint: false };

  it('jumps only while grounded and clears grounded immediately', () => {
    const world = createPhysicsWorld();
    const grounded = runSteps(createPlayerState({ x: 8, y: 1, z: 8 }), idleIntent(), world, 10);
    expect(grounded.grounded).toBe(true);

    const jumped = step(grounded, jumpIntent, world, 1 / 60);

    expect(jumped.grounded).toBe(false);
    expect(jumped.velocity.y).toBeGreaterThan(0);
  });

  it('cannot double-jump while airborne', () => {
    const world = createPhysicsWorld();
    const grounded = runSteps(createPlayerState({ x: 8, y: 1, z: 8 }), idleIntent(), world, 10);

    const jumped = step(grounded, jumpIntent, world, 1 / 60);
    const heldJump = step(jumped, jumpIntent, world, 1 / 60);

    // Only gravity acts on the second step; no second upward impulse appears.
    expect(heldJump.velocity.y).toBeLessThan(jumped.velocity.y);
  });
});

describe('player long falls and tunnelling', () => {
  it('bounds falling speed across a long fall and lands safely', () => {
    const world = createPhysicsWorld();
    let current = createPlayerState({ x: 8, y: 60, z: 8 });

    for (let i = 0; i < 600; i += 1) {
      current = step(current, idleIntent(), world, 1 / 60);
      expect(current.velocity.y).toBeGreaterThanOrEqual(-config.player.maxFallSpeed - EPSILON);
    }

    expect(current.grounded).toBe(true);
    expect(current.position.y).toBeCloseTo(1, 5);
  });

  it('does not tunnel through the floor from a huge downward velocity', () => {
    const world = createPhysicsWorld();
    const state: PlayerState = {
      ...createPlayerState({ x: 8, y: 2.5, z: 8 }),
      velocity: { x: 0, y: -1000, z: 0 },
    };

    const landed = step(state, idleIntent(), world, 100);

    expect(landed.position.y).toBeGreaterThanOrEqual(1 - EPSILON);
    expect(landed.grounded).toBe(true);
  });

  it('clamps a large frame delta so one step cannot cross a wall', () => {
    const world = createPhysicsWorld();
    for (let y = 1; y <= 2; y += 1) {
      for (let z = 0; z < CHUNK_SIZE_Z; z += 1) {
        world.setBlock(10, y, z, BlockIds.basic);
      }
    }
    const state = createPlayerState({ x: 9.5, y: 1, z: 8 });

    let current = state;
    for (let i = 0; i < 5; i += 1) {
      current = step(current, moveIntent(1, 0), world, 1000);
    }

    expect(playerAabb(current.position).maxX).toBeLessThanOrEqual(10 + EPSILON);
  });
});

describe('player ceilings and headroom', () => {
  it('stops at a ceiling instead of passing through it, then lands again', () => {
    const world = createPhysicsWorld();
    fillLayer(world, 3);
    const grounded = runSteps(createPlayerState({ x: 8, y: 1, z: 8 }), idleIntent(), world, 10);
    const jumpIntent: PlayerIntent = { move: { x: 0, z: 0 }, jump: true, sprint: false };

    let current = step(grounded, jumpIntent, world, 1 / 60);
    let highest = playerAabb(current.position).maxY;
    for (let i = 0; i < 120; i += 1) {
      current = step(current, idleIntent(), world, 1 / 60);
      highest = Math.max(highest, playerAabb(current.position).maxY);
    }

    expect(highest).toBeLessThanOrEqual(3 + EPSILON);
    expect(highest).toBeGreaterThan(2.8);
    expect(current.grounded).toBe(true);
    expect(current.position.y).toBeCloseTo(1, 5);
  });
});

describe('player physics purity', () => {
  it('does not mutate its inputs and is deterministic', () => {
    const world = createPhysicsWorld();
    const state = createPlayerState({ x: 8, y: 5, z: 8 });
    const intent = moveIntent(1, 1);
    const stateBefore = structuredClone(state);
    const intentBefore = structuredClone(intent);

    const first = step(state, intent, world, 1 / 60);
    const second = step(state, intent, world, 1 / 60);

    expect(state).toEqual(stateBefore);
    expect(intent).toEqual(intentBefore);
    expect(first).toEqual(second);
    expect(first).not.toBe(state);
    expect(first.position).not.toBe(state.position);
  });

  it('returns the same grounded state unchanged for a non-positive delta', () => {
    const world = createPhysicsWorld();
    const grounded = runSteps(createPlayerState({ x: 8, y: 1, z: 8 }), idleIntent(), world, 10);

    const idle = step(grounded, idleIntent(), world, 0);

    expect(idle).toEqual(grounded);
    expect(idle).not.toBe(grounded);
  });
});
