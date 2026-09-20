import { BlockIds } from '../world/Block';
import type { World } from '../world/World';
import type { Vec3 } from '../player/Player';

/**
 * A block hit found by a raycast.
 *
 * `blockPos` is the integer coordinate of the first non-air block the ray
 * entered; `faceNormal` is the outward unit normal of the face it crossed to
 * get there, so `blockPos + faceNormal` is the empty cell adjacent to the hit
 * face. `distance` is measured from the ray origin in block units.
 */
export interface BlockHit {
  readonly blockPos: Vec3;
  readonly faceNormal: Vec3;
  readonly distance: number;
}

/** The six axis-aligned unit normals, as constants so a hit never allocates an invalid one. */
const POSITIVE_X: Vec3 = { x: 1, y: 0, z: 0 };
const NEGATIVE_X: Vec3 = { x: -1, y: 0, z: 0 };
const POSITIVE_Y: Vec3 = { x: 0, y: 1, z: 0 };
const NEGATIVE_Y: Vec3 = { x: 0, y: -1, z: 0 };
const POSITIVE_Z: Vec3 = { x: 0, y: 0, z: 1 };
const NEGATIVE_Z: Vec3 = { x: 0, y: 0, z: -1 };

/** Which grid axis the ray is about to cross. */
const enum Axis {
  X,
  Y,
  Z,
}

/**
 * March a ray through world voxel data and return the first non-air block it
 * hits, or `null` when nothing is hit within `maxDistance`.
 *
 * This is a pure Amanatides–Woo voxel traversal over `World` blocks — not a
 * Three.js raycaster — so it runs headlessly and the world stays the only
 * authority on which blocks exist. The ray starts at `origin` (typically the
 * camera eye) and follows `direction`, which need not be unit length; it is
 * normalized internally so `distance` is always in blocks.
 *
 * The block containing `origin` is not tested, so a ray cast from inside a
 * block leaves it before looking for a target. Blocks exactly `maxDistance`
 * away are in range; anything beyond is not. Out-of-world cells read as air,
 * so a ray that escapes the world simply travels on until it exceeds range.
 */
export function raycastBlock(
  world: World,
  origin: Vec3,
  direction: Vec3,
  maxDistance: number,
): BlockHit | null {
  if (!isFiniteVec(origin) || !isFiniteVec(direction) || !(maxDistance > 0)) {
    return null;
  }

  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (length === 0) {
    return null;
  }

  const dx = direction.x / length;
  const dy = direction.y / length;
  const dz = direction.z / length;

  // The voxel the ray is currently travelling through.
  let voxelX = Math.floor(origin.x);
  let voxelY = Math.floor(origin.y);
  let voxelZ = Math.floor(origin.z);

  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const stepZ = Math.sign(dz);

  // Distance along the ray between successive crossings of each axis' grid
  // planes. Infinite when the ray is parallel to that axis.
  const tDeltaX = dx === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dx);
  const tDeltaY = dy === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dy);
  const tDeltaZ = dz === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dz);

  // Distance to the first crossing of each axis' grid planes.
  let tMaxX = initialCrossing(origin.x, voxelX, dx);
  let tMaxY = initialCrossing(origin.y, voxelY, dy);
  let tMaxZ = initialCrossing(origin.z, voxelZ, dz);

  for (;;) {
    // Advance across whichever axis boundary comes first.
    let axis: Axis;
    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
      axis = Axis.X;
    } else if (tMaxY <= tMaxZ) {
      axis = Axis.Y;
    } else {
      axis = Axis.Z;
    }

    let distance: number;
    let faceNormal: Vec3;
    switch (axis) {
      case Axis.X:
        distance = tMaxX;
        voxelX += stepX;
        tMaxX += tDeltaX;
        faceNormal = stepX > 0 ? NEGATIVE_X : POSITIVE_X;
        break;
      case Axis.Y:
        distance = tMaxY;
        voxelY += stepY;
        tMaxY += tDeltaY;
        faceNormal = stepY > 0 ? NEGATIVE_Y : POSITIVE_Y;
        break;
      default:
        distance = tMaxZ;
        voxelZ += stepZ;
        tMaxZ += tDeltaZ;
        faceNormal = stepZ > 0 ? NEGATIVE_Z : POSITIVE_Z;
        break;
    }

    if (distance > maxDistance) {
      return null;
    }

    if (world.getBlock(voxelX, voxelY, voxelZ) !== BlockIds.air) {
      return {
        blockPos: { x: voxelX, y: voxelY, z: voxelZ },
        faceNormal,
        distance,
      };
    }
  }
}

/**
 * Distance from the ray origin to its first crossing of a grid plane on one
 * axis. `Infinity` when the ray is parallel to that axis, so the axis is
 * never selected.
 */
function initialCrossing(origin: number, voxel: number, direction: number): number {
  if (direction === 0) {
    return Number.POSITIVE_INFINITY;
  }
  const boundary = direction > 0 ? voxel + 1 : voxel;
  return Math.abs((boundary - origin) / direction);
}

function isFiniteVec(vec: Vec3): boolean {
  return Number.isFinite(vec.x) && Number.isFinite(vec.y) && Number.isFinite(vec.z);
}
