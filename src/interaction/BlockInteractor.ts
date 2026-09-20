import type { Aabb, Vec3 } from '../player/Player';
import { BlockIds } from '../world/Block';
import type { BlockRegistry } from '../world/BlockRegistry';
import type { BlockType } from '../world/BlockType';
import type { World } from '../world/World';
import type { BlockHit } from './BlockRaycaster';

/**
 * Owns the rules for breaking and placing blocks, and nothing else.
 *
 * Every edit is validated against the raycast target, the interaction range,
 * world bounds, existing world data, the player's collision box, and the
 * block registry before anything is written, so a rejected action cannot
 * change the world. The interactor never touches input or the target
 * highlight: a caller hands it a raycast result and it reports whether the
 * edit happened.
 */
export class BlockInteractor {
  constructor(
    private readonly world: World,
    private readonly registry: BlockRegistry,
  ) {}

  /**
   * Break the targeted block, removing it from world data and marking the
   * affected chunk(s) dirty. Returns false without touching the world when
   * there is no target, the target is beyond `range`, or the block is not
   * breakable (for example the unbreakable world floor).
   */
  breakBlock(target: BlockHit | null, range: number): boolean {
    if (!isTargetInRange(target, range)) {
      return false;
    }
    const { x, y, z } = target.blockPos;
    if (!this.registry.isBreakable(this.world.getBlock(x, y, z))) {
      return false;
    }
    return this.world.removeBlock(x, y, z);
  }

  /**
   * Whether a block of `blockType` may be placed against the targeted face.
   *
   * Validation is centralised and applied in order: a target exists within
   * range, the adjacent cell (`blockPos + faceNormal`) is inside the world,
   * the cell is air, the cell's box does not intersect the player's box, and
   * the type is placeable. Any failure rejects the placement.
   */
  canPlaceBlock(
    target: BlockHit | null,
    playerBounds: Aabb,
    blockType: BlockType,
    range: number,
  ): boolean {
    if (!isTargetInRange(target, range)) {
      return false;
    }
    const cell = placementCell(target);
    if (!this.world.isWithinBounds(cell.x, cell.y, cell.z)) {
      return false;
    }
    if (this.world.getBlock(cell.x, cell.y, cell.z) !== BlockIds.air) {
      return false;
    }
    if (aabbIntersects(blockCellBounds(cell), playerBounds)) {
      return false;
    }
    return this.registry.isPlaceable(blockType.id);
  }

  /**
   * Place `blockType` in the cell adjacent to the targeted face. Validates
   * with `canPlaceBlock` first, so a rejected placement leaves world data
   * completely unchanged. A successful write marks the affected chunk(s)
   * dirty for the renderer.
   */
  placeBlock(
    target: BlockHit | null,
    playerBounds: Aabb,
    blockType: BlockType,
    range: number,
  ): boolean {
    if (target === null) {
      return false;
    }
    if (!this.canPlaceBlock(target, playerBounds, blockType, range)) {
      return false;
    }
    const cell = placementCell(target);
    return this.world.setBlock(cell.x, cell.y, cell.z, blockType.id);
  }
}

/**
 * Whether a hit is present and no farther than `range`. Acting as a type
 * predicate lets callers use the target without a redundant null check.
 */
function isTargetInRange(target: BlockHit | null, range: number): target is BlockHit {
  return target !== null && target.distance <= range;
}

/** The empty cell against the hit face: `blockPos + faceNormal`. */
function placementCell(target: BlockHit): Vec3 {
  return {
    x: target.blockPos.x + target.faceNormal.x,
    y: target.blockPos.y + target.faceNormal.y,
    z: target.blockPos.z + target.faceNormal.z,
  };
}

/** The unit box occupied by a block cell. */
function blockCellBounds(cell: Vec3): Aabb {
  return {
    minX: cell.x,
    minY: cell.y,
    minZ: cell.z,
    maxX: cell.x + 1,
    maxY: cell.y + 1,
    maxZ: cell.z + 1,
  };
}

/**
 * Whether two axis-aligned boxes overlap in all three axes. Faces that merely
 * touch (a player standing exactly on a block's top face) do not count, so a
 * block can still be placed directly beneath the player's feet.
 */
function aabbIntersects(a: Aabb, b: Aabb): boolean {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY &&
    a.minZ < b.maxZ &&
    a.maxZ > b.minZ
  );
}
