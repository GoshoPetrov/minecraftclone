import { config } from '../config/Config';
import {
  playerAabb,
  type Aabb,
  type PlayerIntent,
  type PlayerState,
  type Vec3,
} from './Player';

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
  crouching: boolean;
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
  // Crouch is resolved once per step: a released crouch only stands the
  // player up when there is headroom for the full-height box.
  const crouching = resolveCrouch(state, intent, world);
  // Crouch and sprint compose as a product rather than one replacing the
  // other, so crouch-sprinting is 0.39x a walk (0.3 x 1.3). This applies in
  // any direction and while grounded or airborne, so a jump preserves it.
  const speedMultiplier =
    (crouching ? config.player.crouchSpeedMultiplier : 1) *
    (intent.sprint ? config.player.sprintSpeedMultiplier : 1);

  const player: MutablePlayer = {
    x: state.position.x,
    y: state.position.y,
    z: state.position.z,
    vx: state.velocity.x,
    vy: state.velocity.y,
    vz: state.velocity.z,
    grounded: state.grounded,
    crouching,
  };

  for (let i = 0; i < subStepCount; i += 1) {
    // Grounded at the start of the slice drives both the jump and the crouch
    // ledge guard. Capturing it here, before contact re-derives it, keeps the
    // X and Z guard passes symmetric within a slice.
    const wasGrounded = player.grounded;
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

    player.vx = wish.x * config.player.moveSpeed * speedMultiplier;
    player.vz = wish.z * config.player.moveSpeed * speedMultiplier;

    // Crouch ledge guard. While crouching on the ground, a horizontal move
    // that would leave the whole footprint with nothing beneath it is
    // cancelled on that axis alone, so the player stops at the edge and can
    // still slide along it. Each axis is judged independently against the
    // layer directly below the feet, and vertical motion is untouched. The
    // guard only engages when the slice starts supported, so removing the
    // floor beneath a crouched player still lets gravity pull them down.
    const guarding = player.crouching && wasGrounded;
    const supportY = Math.ceil(player.y - EPSILON) - 1;
    const startedSupported =
      guarding && hasGroundSupport(world, playerAabb(player, player.crouching), supportY);

    const previousX = player.x;
    player.x += player.vx * subDt;
    resolveX(player, world);
    if (
      startedSupported &&
      !hasGroundSupport(world, playerAabb(player, player.crouching), supportY)
    ) {
      player.x = previousX;
      player.vx = 0;
    }

    player.y += player.vy * subDt;
    resolveY(player, world);

    const previousZ = player.z;
    player.z += player.vz * subDt;
    resolveZ(player, world);
    if (
      startedSupported &&
      !hasGroundSupport(world, playerAabb(player, player.crouching), supportY)
    ) {
      player.z = previousZ;
      player.vz = 0;
    }
  }

  const horizontalSpeed = Math.hypot(player.vx, player.vz);
  const movement = !player.grounded
    ? 'airborne'
    : player.crouching
      ? 'sneaking'
      : horizontalSpeed > 0
        ? intent.sprint
          ? 'sprinting'
          : 'walking'
        : 'idle';

  return {
    position: { x: player.x, y: player.y, z: player.z },
    velocity: { x: player.vx, y: player.vy, z: player.vz },
    grounded: player.grounded,
    crouching: player.crouching,
    movement,
  };
}

/** Resolve a move along X against solid blocks, zeroing blocked velocity. */
function resolveX(player: MutablePlayer, world: SolidWorld): void {
  if (player.vx === 0) {
    return;
  }
  const halfWidth = config.player.width / 2;
  const bounds = playerAabb(player, player.crouching);
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
  const bounds = playerAabb(player, player.crouching);
  // The box height is derived once in `playerAabb`, so ceiling resolution
  // cannot drift from the crouch-aware collision box.
  const height = bounds.maxY - bounds.minY;
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
  const bounds = playerAabb(player, player.crouching);
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
 * Whether the player should be crouching for this step. Crouch is held while
 * requested; releasing it only stands the player up when the full-height
 * standing box has headroom, so a block overhead keeps them crouched until
 * they move into clear space.
 */
function resolveCrouch(
  state: PlayerState,
  intent: PlayerIntent,
  world: SolidWorld,
): boolean {
  if (intent.crouch) {
    return true;
  }
  if (!state.crouching) {
    return false;
  }
  return !hasStandingHeadroom(state.position, world);
}

/** Whether the full-height standing box at `position` clears every solid. */
function hasStandingHeadroom(position: Vec3, world: SolidWorld): boolean {
  return !overlapsSolid(world, playerAabb(position, false));
}

/**
 * Whether the block layer `layerY` has at least one solid block under the
 * horizontal footprint. The crouch ledge guard uses this so it can consider
 * the whole footprint rather than the player's centre: the player may lean
 * out over the edge until nothing at all remains beneath them, and a
 * one-block step-down (the layer directly below the feet being empty) counts
 * as an edge.
 */
function hasGroundSupport(world: SolidWorld, bounds: Aabb, layerY: number): boolean {
  for (let bx = Math.floor(bounds.minX); bx <= Math.floor(bounds.maxX - EPSILON); bx += 1) {
    for (let bz = Math.floor(bounds.minZ); bz <= Math.floor(bounds.maxZ - EPSILON); bz += 1) {
      if (world.isSolid(bx, layerY, bz)) {
        return true;
      }
    }
  }
  return false;
}

/** Whether any solid block overlaps `bounds`. */
function overlapsSolid(world: SolidWorld, bounds: Aabb): boolean {
  let solid = false;
  forEachSolidBlock(world, bounds, () => {
    solid = true;
  });
  return solid;
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
    crouching: state.crouching,
    movement: state.movement,
  };
}
