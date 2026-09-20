import { config } from '../config/Config';
import { playerAabb, type Aabb, type PlayerIntent, type PlayerState } from './Player';

/**
 * The slice of the world physics needs: whether a world block coordinate is
 * solid. `World` satisfies this structurally, and tests can substitute a
 * simple stub without constructing a whole world.
 */
export interface SolidWorld {
  isSolid(x: number, y: number, z: number): boolean;
}

/**
 * Tolerance for treating a box that merely touches a block face as touching
 * rather than overlapping. Kept tiny so it can never hide a real penetration.
 */
const EPSILON = 1e-9;

interface MutablePlayer {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
}

/**
 * Advance the player simulation by `dt` seconds and return the next state.
 *
 * The function is pure: it never mutates `state`, `intent`, or `world`, and
 * the same inputs always produce the same output. It owns position, velocity,
 * the axis-aligned collision box, grounded state, and movement state, and has
 * no dependency on Three.js or a camera.
 *
 * Collision is resolved one axis at a time (X, then Y, then Z). Resolving an
 * axis independently is what lets the player slide along a wall or around a
 * corner instead of sticking. A large `dt` is clamped and then split into
 * fixed-size sub-steps so fast motion cannot tunnel through a solid block.
 */
export function step(
  state: PlayerState,
  intent: PlayerIntent,
  world: SolidWorld,
  dt: number,
): PlayerState {
  const clampedDt = clampDelta(dt);
  if (clampedDt <= 0) {
    return copyState(state);
  }

  const subStepCount = Math.max(1, Math.ceil(clampedDt / config.player.physicsStepSeconds));
  const subDt = clampedDt / subStepCount;
  const wish = normalizeWish(intent.move);

  const player: MutablePlayer = {
    x: state.position.x,
    y: state.position.y,
    z: state.position.z,
    vx: state.velocity.x,
    vy: state.velocity.y,
    vz: state.velocity.z,
    grounded: state.grounded,
  };

  for (let i = 0; i < subStepCount; i += 1) {
    // A jump uses the grounded state left by the previous slice, so holding
    // jump cannot fire again once the player has left the ground.
    if (intent.jump && player.grounded) {
      player.vy = config.player.jumpVelocity;
    }
    // Grounded is re-derived from contact during this slice.
    player.grounded = false;

    player.vy -= config.player.gravity * subDt;
    if (player.vy < -config.player.maxFallSpeed) {
      player.vy = -config.player.maxFallSpeed;
    }

    player.vx = wish.x * config.player.moveSpeed;
    player.vz = wish.z * config.player.moveSpeed;

    player.x += player.vx * subDt;
    resolveX(player, world);

    player.y += player.vy * subDt;
    resolveY(player, world);

    player.z += player.vz * subDt;
    resolveZ(player, world);
  }

  const horizontalSpeed = Math.hypot(player.vx, player.vz);
  const movement = !player.grounded
    ? 'airborne'
    : horizontalSpeed > 0
      ? 'walking'
      : 'idle';

  return {
    position: { x: player.x, y: player.y, z: player.z },
    velocity: { x: player.vx, y: player.vy, z: player.vz },
    grounded: player.grounded,
    movement,
  };
}

/** Resolve a move along X against solid blocks, zeroing blocked velocity. */
function resolveX(player: MutablePlayer, world: SolidWorld): void {
  if (player.vx === 0) {
    return;
  }
  const halfWidth = config.player.width / 2;
  const bounds = playerAabb(player);
  const movingPositive = player.vx > 0;

  let resolvedX = player.x;
  let hit = false;
  forEachSolidBlock(world, bounds, (bx) => {
    hit = true;
    resolvedX = movingPositive
      ? Math.min(resolvedX, bx - halfWidth)
      : Math.max(resolvedX, bx + 1 + halfWidth);
  });
  if (hit) {
    player.x = resolvedX;
    player.vx = 0;
  }
}

/**
 * Resolve a move along Y against solid blocks. Landing from above marks the
 * player grounded; hitting a ceiling stops upward motion without doing so.
 */
function resolveY(player: MutablePlayer, world: SolidWorld): void {
  if (player.vy === 0) {
    return;
  }
  const height = config.player.height;
  const bounds = playerAabb(player);
  const movingDown = player.vy < 0;

  let resolvedY = player.y;
  let hit = false;
  forEachSolidBlock(world, bounds, (_bx, by) => {
    hit = true;
    resolvedY = movingDown
      ? Math.max(resolvedY, by + 1)
      : Math.min(resolvedY, by - height);
  });
  if (hit) {
    player.y = resolvedY;
    player.vy = 0;
    if (movingDown) {
      player.grounded = true;
    }
  }
}

/** Resolve a move along Z against solid blocks, zeroing blocked velocity. */
function resolveZ(player: MutablePlayer, world: SolidWorld): void {
  if (player.vz === 0) {
    return;
  }
  const halfWidth = config.player.width / 2;
  const bounds = playerAabb(player);
  const movingPositive = player.vz > 0;

  let resolvedZ = player.z;
  let hit = false;
  forEachSolidBlock(world, bounds, (_bx, _by, bz) => {
    hit = true;
    resolvedZ = movingPositive
      ? Math.min(resolvedZ, bz - halfWidth)
      : Math.max(resolvedZ, bz + 1 + halfWidth);
  });
  if (hit) {
    player.z = resolvedZ;
    player.vz = 0;
  }
}

/**
 * Visit every solid block whose cell overlaps `bounds`. Block cells that the
 * box only touches (rather than enters) are excluded via `EPSILON`.
 */
function forEachSolidBlock(
  world: SolidWorld,
  bounds: Aabb,
  visit: (blockX: number, blockY: number, blockZ: number) => void,
): void {
  for (let bx = Math.floor(bounds.minX); bx <= Math.floor(bounds.maxX - EPSILON); bx += 1) {
    for (let by = Math.floor(bounds.minY); by <= Math.floor(bounds.maxY - EPSILON); by += 1) {
      for (let bz = Math.floor(bounds.minZ); bz <= Math.floor(bounds.maxZ - EPSILON); bz += 1) {
        if (world.isSolid(bx, by, bz)) {
          visit(bx, by, bz);
        }
      }
    }
  }
}

/** Clamp a raw frame delta into the range physics is allowed to simulate. */
function clampDelta(dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) {
    return 0;
  }
  return Math.min(dt, config.maxFrameDeltaSeconds);
}

/**
 * Turn a wish direction into a unit-or-shorter vector, so diagonal input is
 * not faster than axis-aligned input. Non-finite components are ignored.
 */
function normalizeWish(move: { readonly x: number; readonly z: number }): {
  x: number;
  z: number;
} {
  let x = Number.isFinite(move.x) ? move.x : 0;
  let z = Number.isFinite(move.z) ? move.z : 0;
  const length = Math.hypot(x, z);
  if (length > 1) {
    x /= length;
    z /= length;
  }
  return { x, z };
}

function copyState(state: PlayerState): PlayerState {
  return {
    position: { ...state.position },
    velocity: { ...state.velocity },
    grounded: state.grounded,
    movement: state.movement,
  };
}
