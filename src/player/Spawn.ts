import { config } from '../config/Config';
import type { Vec3 } from './Player';

/** The slice of the world the spawn search reads. */
export interface SpawnWorld {
  readonly size: { readonly x: number; readonly y: number; readonly z: number };
  isSolid(x: number, y: number, z: number): boolean;
}

/**
 * Find a safe feet position for the player: standing on top of solid ground
 * with enough air above the head.
 *
 * The search starts at the world-centre column and expands outward one ring
 * at a time, so the player spawns near the middle when possible. For each
 * column the highest solid block is found by scanning down from the ceiling;
 * feet go one block above it. A column is rejected when it is all air (the
 * player would be in the void) or when there is not enough headroom above the
 * highest block. If no column qualifies, the world is genuinely unplayable
 * and an error is thrown rather than spawning inside geometry.
 */
export function findSpawn(world: SpawnWorld): Vec3 {
  const centerX = Math.floor(world.size.x / 2);
  const centerZ = Math.floor(world.size.z / 2);
  const maxRadius = Math.max(
    centerX,
    centerZ,
    world.size.x - 1 - centerX,
    world.size.z - 1 - centerZ,
  );

  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (const cell of ringCells(centerX, centerZ, radius)) {
      if (!isWithinColumnBounds(world, cell.x, cell.z)) {
        continue;
      }
      const feetY = findFeetY(world, cell.x, cell.z);
      if (feetY !== null) {
        // Centre the player horizontally in the block cell.
        return { x: cell.x + 0.5, y: feetY, z: cell.z + 0.5 };
      }
    }
  }

  throw new Error('Could not find a valid spawn position with headroom.');
}

function isWithinColumnBounds(world: SpawnWorld, x: number, z: number): boolean {
  return x >= 0 && x < world.size.x && z >= 0 && z < world.size.z;
}

/**
 * The feet height for one column, or `null` when the column is unusable.
 * Everything above the highest solid block is air by definition, so only the
 * headroom fitting inside the world needs checking.
 */
function findFeetY(world: SpawnWorld, x: number, z: number): number | null {
  for (let y = world.size.y - 1; y >= 0; y -= 1) {
    if (!world.isSolid(x, y, z)) {
      continue;
    }
    const feetY = y + 1;
    return feetY + config.player.spawnHeadroomBlocks <= world.size.y ? feetY : null;
  }
  return null;
}

/**
 * The cell coordinates on the square ring at Chebyshev distance `radius`
 * around a centre, in a fixed order so the search is deterministic.
 */
function* ringCells(
  centerX: number,
  centerZ: number,
  radius: number,
): Generator<{ readonly x: number; readonly z: number }> {
  if (radius === 0) {
    yield { x: centerX, z: centerZ };
    return;
  }

  for (let dx = -radius; dx <= radius; dx += 1) {
    yield { x: centerX + dx, z: centerZ - radius };
    yield { x: centerX + dx, z: centerZ + radius };
  }
  for (let dz = -radius + 1; dz <= radius - 1; dz += 1) {
    yield { x: centerX - radius, z: centerZ + dz };
    yield { x: centerX + radius, z: centerZ + dz };
  }
}
