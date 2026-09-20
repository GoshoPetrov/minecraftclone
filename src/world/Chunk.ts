import { BlockIds } from './Block';

/**
 * Chunk dimensions and flat-array layout.
 *
 * A chunk is a fixed `16 × 64 × 16` column of blocks. These constants are the
 * single source of truth for chunk size, so world bounds and geometry never
 * hard-code them. Chunk storage is renderer-independent: it holds block ids
 * only, never meshes or Three.js objects.
 */
export const CHUNK_SIZE_X = 16;
export const CHUNK_SIZE_Y = 64;
export const CHUNK_SIZE_Z = 16;

/** Number of blocks in one chunk. */
export const CHUNK_VOLUME = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;

/** Integer chunk coordinates (each unit spans one full chunk along an axis). */
export interface ChunkCoord {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Integer block position within a chunk. */
export interface LocalCoord {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * The canonical key for a chunk coordinate. Every map/set in the world layer
 * keys chunks through this one function so coordinates can never disagree.
 */
export function chunkKey(coord: ChunkCoord): string {
  return `${coord.x},${coord.y},${coord.z}`;
}

/** Flat index of a local block coordinate within a chunk's typed array. */
export function blockIndex(localX: number, localY: number, localZ: number): number {
  return (localY * CHUNK_SIZE_Z + localZ) * CHUNK_SIZE_X + localX;
}

/** Whether a local coordinate addresses a block inside a chunk. */
export function isLocalInBounds(x: number, y: number, z: number): boolean {
  return (
    Number.isInteger(x) &&
    x >= 0 &&
    x < CHUNK_SIZE_X &&
    Number.isInteger(y) &&
    y >= 0 &&
    y < CHUNK_SIZE_Y &&
    Number.isInteger(z) &&
    z >= 0 &&
    z < CHUNK_SIZE_Z
  );
}

/** The chunk coordinate containing the given world block coordinate. */
export function blockToChunkCoord(x: number, y: number, z: number): ChunkCoord {
  return {
    x: Math.floor(x / CHUNK_SIZE_X),
    y: Math.floor(y / CHUNK_SIZE_Y),
    z: Math.floor(z / CHUNK_SIZE_Z),
  };
}

/** The local coordinate of a world block coordinate within its chunk. */
export function blockToLocalCoord(x: number, y: number, z: number): LocalCoord {
  const chunk = blockToChunkCoord(x, y, z);
  return {
    x: x - chunk.x * CHUNK_SIZE_X,
    y: y - chunk.y * CHUNK_SIZE_Y,
    z: z - chunk.z * CHUNK_SIZE_Z,
  };
}

/**
 * One column of voxel data. Blocks live in a flat `Uint8Array` indexed by
 * `blockIndex`, addressed locally; the world layer translates world block
 * coordinates into chunk plus local coordinates. Reads and writes outside the
 * chunk are safe: reads return air and writes are refused.
 */
export class Chunk {
  readonly coord: ChunkCoord;
  private readonly blocks: Uint8Array;

  constructor(coord: ChunkCoord) {
    this.coord = { ...coord };
    // Zero-filled, and block id 0 is air, so a new chunk is empty.
    this.blocks = new Uint8Array(CHUNK_VOLUME);
  }

  /**
   * The raw flat block ids, in `blockIndex` order. Exposed for efficient
   * mesh building; callers must treat it as read-only and route edits
   * through `setBlock` so the world can mark chunks dirty.
   */
  get data(): Uint8Array {
    return this.blocks;
  }

  /** The block id at a local coordinate, or air when out of range. */
  getBlock(localX: number, localY: number, localZ: number): number {
    if (!isLocalInBounds(localX, localY, localZ)) {
      return BlockIds.air;
    }
    return this.blocks[blockIndex(localX, localY, localZ)] ?? BlockIds.air;
  }

  /** Write a block id at a local coordinate; returns false when out of range. */
  setBlock(localX: number, localY: number, localZ: number, id: number): boolean {
    if (!isLocalInBounds(localX, localY, localZ)) {
      return false;
    }
    this.blocks[blockIndex(localX, localY, localZ)] = id;
    return true;
  }
}
