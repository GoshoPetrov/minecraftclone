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
import { step, type SolidWorld } from '../player/PlayerPhysics';

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
  return { move: { x, z }, jump: false, sprint: false, crouch: false };
}

function sprintIntent(x: number, z: number): PlayerIntent {
  return { move: { x, z }, jump: false, sprint: true, crouch: false };
}

function crouchIntent(x: number, z: number, sprint = false): PlayerIntent {
  return { move: { x, z }, jump: false, sprint, crouch: true };
}

function runSteps(
  state: PlayerState,
  intent: PlayerIntent,
  world: SolidWorld,
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
  const bounds = playerAabb(state.position, state.crouching);
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
    const still: PlayerIntent = { move: { x: 0, z: 0 }, jump: false, sprint: true, crouch: false };

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
    const airborneIntent: PlayerIntent = { move: { x: 1, z: 0 }, jump: false, sprint: true, crouch: false };
    let current = step(
      grounded,
      { move: { x: 1, z: 0 }, jump: true, sprint: true, crouch: false },
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
      { move: { x: 0, z: 0 }, jump: true, sprint: true, crouch: false },
      world,
      1 / 60,
    );
    expect(airborne.movement).toBe('airborne');
  });
});

describe('player crouch', () => {
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

  it('slows to exactly the crouch multiplier while grounded', () => {
    const walked = travel(moveIntent(1, 0));
    const crouched = travel(crouchIntent(1, 0));

    expect(crouched.state.grounded).toBe(true);
    expect(crouched.distance / walked.distance).toBeCloseTo(
      config.player.crouchSpeedMultiplier,
      5,
    );
    expect(crouched.distance).toBeCloseTo(
      config.player.moveSpeed * config.player.crouchSpeedMultiplier * seconds,
      5,
    );
  });

  it('composes crouch and sprint as the product of both multipliers', () => {
    const walked = travel(moveIntent(1, 0));
    const composed = travel(crouchIntent(1, 0, true));

    expect(composed.distance).toBeCloseTo(walked.distance * 0.39, 5);
    expect(composed.distance / walked.distance).toBeCloseTo(
      config.player.crouchSpeedMultiplier * config.player.sprintSpeedMultiplier,
      5,
    );
    expect(composed.distance).toBeCloseTo(
      config.player.moveSpeed *
        config.player.crouchSpeedMultiplier *
        config.player.sprintSpeedMultiplier *
        seconds,
      5,
    );
  });

  it('applies the crouch speed while airborne', () => {
    const world = createPhysicsWorld();
    const start = { x: 2, y: 40, z: 8 };
    const air = runSteps(createPlayerState(start), crouchIntent(1, 0), world, steps);
    const crouchSpeed = config.player.moveSpeed * config.player.crouchSpeedMultiplier;

    expect(air.grounded).toBe(false);
    expect(air.velocity.x).toBeCloseTo(crouchSpeed, 5);
    expect(air.position.x - start.x).toBeCloseTo(crouchSpeed * seconds, 5);
  });

  it('reports sneaking while grounded and crouched, taking precedence over sprint', () => {
    const world = createPhysicsWorld();
    const still = runSteps(createPlayerState({ x: 8, y: 1, z: 8 }), idleIntent(), world, 10);

    const stillCrouched = runSteps(still, crouchIntent(0, 0), world, 5);
    expect(stillCrouched.crouching).toBe(true);
    expect(stillCrouched.movement).toBe('sneaking');
    expect(runSteps(still, crouchIntent(1, 0), world, 5).movement).toBe('sneaking');
    expect(runSteps(still, crouchIntent(1, 0, true), world, 5).movement).toBe('sneaking');
  });

  it('reports airborne ahead of sneaking', () => {
    const world = createPhysicsWorld();
    const air = runSteps(createPlayerState({ x: 2, y: 40, z: 8 }), crouchIntent(0, 0), world, 5);

    expect(air.grounded).toBe(false);
    expect(air.crouching).toBe(true);
    expect(air.movement).toBe('airborne');
  });

  it('derives a shorter but equally wide collision box while crouching', () => {
    const standing = playerAabb({ x: 0, y: 0, z: 0 }, false);
    const crouched = playerAabb({ x: 0, y: 0, z: 0 }, true);

    expect(crouched.maxY).toBeCloseTo(config.player.crouchHeight, 9);
    expect(standing.maxY).toBeCloseTo(config.player.height, 9);
    expect(crouched.minY).toBe(standing.minY);
    expect(crouched.maxX - crouched.minX).toBeCloseTo(standing.maxX - standing.minX, 9);
    expect(crouched.maxZ - crouched.minZ).toBeCloseTo(standing.maxZ - standing.minZ, 9);
  });
});

describe('player crouch stand-up', () => {
  /**
   * A stub world with a solid floor and an optional ceiling over one column.
   * The player is placed at a fractional height so a ceiling can clear the
   * crouched box while blocking the standing box; full-block terrain cannot
   * express that gap, so the stub world is the right seam.
   */
  function stubWorld(withCeiling: boolean): SolidWorld {
    return {
      isSolid: (x, y) => y === 0 || (withCeiling && y === 3 && x === 8),
    };
  }

  /** A crouched player at a height where the ceiling blocks standing only. */
  function crouchedUnderCeiling(): PlayerState {
    return {
      ...createPlayerState({ x: 8, y: 1.4, z: 8 }),
      crouching: true,
    };
  }

  it('stays crouched when a released crouch has no headroom', () => {
    const world = stubWorld(true);
    const released = crouchedUnderCeiling();

    const next = runSteps(released, idleIntent(), world, 3);

    expect(next.crouching).toBe(true);
  });

  it('stands up on the next step once the body is in clear space', () => {
    const world = stubWorld(true);
    const underCeiling = crouchedUnderCeiling();
    // Releasing crouch while blocked keeps the player crouched...
    expect(step(underCeiling, idleIntent(), world, 1 / 60).crouching).toBe(true);

    // ...but the same state moved out from under the ceiling stands up.
    const clearOfCeiling: PlayerState = {
      ...underCeiling,
      position: { x: 10, y: 1.4, z: 8 },
    };
    const stood = step(clearOfCeiling, idleIntent(), world, 1 / 60);

    expect(stood.crouching).toBe(false);
  });

  it('stands up when the same position has headroom', () => {
    const world = stubWorld(false);

    const stood = step(crouchedUnderCeiling(), idleIntent(), world, 1 / 60);

    expect(stood.crouching).toBe(false);
  });
});

describe('player crouch ledge guard', () => {
  const CROUCH_START = { x: 8, y: 1, z: 8 };

  /** The default floor with every block at `y = 0` at or beyond `edgeStart` removed. */
  function createLedgeWorld(edgeStart: number, axis: 'x' | 'z' = 'x'): World {
    const world = createPhysicsWorld();
    for (let x = 0; x < CHUNK_SIZE_X; x += 1) {
      for (let z = 0; z < CHUNK_SIZE_Z; z += 1) {
        if ((axis === 'x' ? x : z) >= edgeStart) {
          world.removeBlock(x, 0, z);
        }
      }
    }
    return world;
  }

  it('stops a crouch-walk at the edge while the same walk without crouch falls', () => {
    const world = createLedgeWorld(10);

    const crouched = runSteps(createPlayerState(CROUCH_START), crouchIntent(1, 0), world, 180);
    expect(crouched.crouching).toBe(true);
    expect(crouched.grounded).toBe(true);
    expect(crouched.position.y).toBeCloseTo(1, 5);
    // The guard uses the whole footprint, so the centre may lean out past the
    // last solid block (whose far face is at x = 10).
    expect(crouched.position.x).toBeGreaterThan(9.7);
    expect(crouched.position.x).toBeLessThan(10.4);
    expect(overlapsSolid(world, crouched)).toBe(false);

    const walked = runSteps(createPlayerState(CROUCH_START), moveIntent(1, 0), world, 180);
    expect(walked.grounded).toBe(false);
    expect(walked.position.y).toBeLessThan(1);
  });

  it('guards the Z axis just like the X axis', () => {
    const world = createLedgeWorld(10, 'z');

    const crouched = runSteps(createPlayerState(CROUCH_START), crouchIntent(0, 1), world, 180);

    expect(crouched.crouching).toBe(true);
    expect(crouched.grounded).toBe(true);
    expect(crouched.position.y).toBeCloseTo(1, 5);
    expect(crouched.position.z).toBeGreaterThan(9.7);
    expect(crouched.position.z).toBeLessThan(10.4);
  });

  it('treats a one-block step-down as an edge', () => {
    const world = createPhysicsWorld();
    // Raise the floor to y = 1 for x < 10, leaving a one-block step down there.
    for (let x = 0; x < 10; x += 1) {
      for (let z = 0; z < CHUNK_SIZE_Z; z += 1) {
        world.setBlock(x, 1, z, BlockIds.basic);
      }
    }
    const upperStart = { x: 8, y: 2, z: 8 };

    const crouched = runSteps(createPlayerState(upperStart), crouchIntent(1, 0), world, 180);
    expect(crouched.grounded).toBe(true);
    // The guard refuses to drop onto the lower level and stops on the upper one.
    expect(crouched.position.y).toBeCloseTo(2, 5);
    expect(crouched.position.x).toBeLessThan(10.4);

    // Without crouch the same input walks off and steps down to the lower
    // level. Only 60 steps, so the walker has not yet run off the far edge of
    // the 16-block-wide test world.
    const walked = runSteps(createPlayerState(upperStart), moveIntent(1, 0), world, 60);
    expect(walked.grounded).toBe(true);
    expect(walked.position.y).toBeCloseTo(1, 5);
  });

  it('slides along the unguarded axis instead of sticking', () => {
    const world = createLedgeWorld(10);

    const slid = runSteps(createPlayerState(CROUCH_START), crouchIntent(1, 1), world, 180);

    expect(slid.grounded).toBe(true);
    // X is blocked at the ledge...
    expect(slid.position.x).toBeLessThan(10.4);
    // ...while Z keeps translating along it. Diagonal input is normalised, so
    // the crouch speed is split across the two axes.
    expect(slid.position.z).toBeGreaterThan(10.5);
    expect(overlapsSolid(world, slid)).toBe(false);
  });

  it('leaves an airborne crouch unguarded', () => {
    const world = createLedgeWorld(10);
    const start = { x: 2, y: 40, z: 8 };
    const seconds = 0.5;

    const air = runSteps(createPlayerState(start), crouchIntent(1, 0), world, seconds * 60);
    const crouchSpeed = config.player.moveSpeed * config.player.crouchSpeedMultiplier;

    expect(air.grounded).toBe(false);
    expect(air.position.x - start.x).toBeCloseTo(crouchSpeed * seconds, 5);
  });

  it('still falls when the supporting block is removed', () => {
    const world = createPhysicsWorld();
    const grounded = runSteps(createPlayerState(CROUCH_START), crouchIntent(0, 0), world, 10);
    expect(grounded.grounded).toBe(true);

    // Remove every floor cell under the crouched player's footprint.
    for (let x = 7; x <= 8; x += 1) {
      for (let z = 7; z <= 8; z += 1) {
        world.removeBlock(x, 0, z);
      }
    }

    const falling = runSteps(grounded, crouchIntent(0, 0), world, 60);
    expect(falling.grounded).toBe(false);
    expect(falling.position.y).toBeLessThan(1);
  });

  it('disengages on a crouch-jump so the jump can still carry off the ledge', () => {
    const world = createLedgeWorld(10);
    // Start already leaning over the edge, still supported by the last block.
    const grounded = runSteps(
      createPlayerState({ x: 10.2, y: 1, z: 8 }),
      crouchIntent(0, 0),
      world,
      10,
    );
    expect(grounded.grounded).toBe(true);

    let current = step(
      grounded,
      { move: { x: 1, z: 0 }, jump: true, sprint: false, crouch: true },
      world,
      1 / 60,
    );
    expect(current.grounded).toBe(false);

    const airborneCrouchJump: PlayerIntent = {
      move: { x: 1, z: 0 },
      jump: false,
      sprint: false,
      crouch: true,
    };
    for (let i = 0; i < 60; i += 1) {
      current = step(current, airborneCrouchJump, world, 1 / 60);
    }

    expect(current.grounded).toBe(false);
    expect(current.position.x).toBeGreaterThan(10.3);
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
  const jumpIntent: PlayerIntent = { move: { x: 0, z: 0 }, jump: true, sprint: false, crouch: false };

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
    const jumpIntent: PlayerIntent = { move: { x: 0, z: 0 }, jump: true, sprint: false, crouch: false };

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
