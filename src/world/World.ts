import { BlockIds } from './Block';
import type { BlockRegistry } from './BlockRegistry';
import {
  blockToChunkCoord,
  blockToLocalCoord,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  Chunk,
  chunkKey,
  type ChunkCoord,
} from './Chunk';

/**
 * World extent, in chunks or in blocks depending on the field it describes.
 * A size is an extent, not a coordinate, so it gets its own type.
 */
export interface WorldSize {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * A single player edit, expressed as a delta from the generated terrain.
 * `id` is the block that now occupies the coordinate; removals use air.
 * Only the current value is persisted, never the block that was replaced.
 */
export interface BlockModification {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly id: number;
}

/** A tracked edit while it is being coalesced: generated value plus current value. */
interface TrackedEdit {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly baseline: number;
  readonly id: number;
}

/**
 * World dimensions, expressed as a count of chunks per axis. Chunk size is
 * fixed, so this is the one place a world's extent is declared. Nothing else
 * in the codebase should assume a particular world size.
 */
export interface WorldConfig {
  readonly sizeInChunks: WorldSize;
}

/**
 * The authoritative, renderer-independent voxel world.
 *
 * The world owns chunk data and is the only system that decides whether a
 * block exists. Rendering, physics, raycasting, and interaction all query it
 * through this API rather than keeping their own copy of block state. It has
 * no dependency on Three.js, the DOM, or storage.
 *
 * Coordinates are integer world block coordinates. Reads outside the world
 * return air (non-solid) instead of throwing; writes outside the world are
 * rejected. A block edit marks the chunk that contains it dirty, plus any
 * neighbouring chunk whose visible faces could change.
 */
export class World {
  /** The world extent in chunks. */
  readonly sizeInChunks: WorldSize;
  /** The world extent in blocks. */
  readonly size: WorldSize;

  private readonly registry: BlockRegistry;
  private readonly chunksByKey = new Map<string, Chunk>();
  private readonly dirtyChunkKeys = new Set<string>();
  private readonly editsByKey = new Map<string, TrackedEdit>();
  private trackingEdits = false;

  constructor(config: WorldConfig, registry: BlockRegistry) {
    assertPositiveInteger(config.sizeInChunks.x, 'World size in chunks (x)');
    assertPositiveInteger(config.sizeInChunks.y, 'World size in chunks (y)');
    assertPositiveInteger(config.sizeInChunks.z, 'World size in chunks (z)');

    this.registry = registry;
    this.sizeInChunks = { ...config.sizeInChunks };
    this.size = {
      x: config.sizeInChunks.x * CHUNK_SIZE_X,
      y: config.sizeInChunks.y * CHUNK_SIZE_Y,
      z: config.sizeInChunks.z * CHUNK_SIZE_Z,
    };

    for (let z = 0; z < this.sizeInChunks.z; z += 1) {
      for (let y = 0; y < this.sizeInChunks.y; y += 1) {
        for (let x = 0; x < this.sizeInChunks.x; x += 1) {
          const coord: ChunkCoord = { x, y, z };
          const key = chunkKey(coord);
          this.chunksByKey.set(key, new Chunk(coord));
          // Every chunk starts dirty so the renderer builds it on first use.
          this.dirtyChunkKeys.add(key);
        }
      }
    }
  }

  /** Whether an integer block coordinate lies inside the world. */
  isWithinBounds(x: number, y: number, z: number): boolean {
    return (
      Number.isInteger(x) &&
      x >= 0 &&
      x < this.size.x &&
      Number.isInteger(y) &&
      y >= 0 &&
      y < this.size.y &&
      Number.isInteger(z) &&
      z >= 0 &&
      z < this.size.z
    );
  }

  /** The block id at a world coordinate, or air outside the world. */
  getBlock(x: number, y: number, z: number): number {
    if (!this.isWithinBounds(x, y, z)) {
      return BlockIds.air;
    }
    const chunk = this.getChunk(blockToChunkCoord(x, y, z));
    if (chunk === undefined) {
      return BlockIds.air;
    }
    const local = blockToLocalCoord(x, y, z);
    return chunk.getBlock(local.x, local.y, local.z);
  }

  /**
   * Write a block id at a world coordinate. Returns false when the coordinate
   * is outside the world; a successful write marks the affected chunks dirty.
   */
  setBlock(x: number, y: number, z: number, id: number): boolean {
    if (!this.isWithinBounds(x, y, z)) {
      return false;
    }
    const chunk = this.getChunk(blockToChunkCoord(x, y, z));
    if (chunk === undefined) {
      return false;
    }
    const local = blockToLocalCoord(x, y, z);
    const previous = chunk.getBlock(local.x, local.y, local.z);
    if (!chunk.setBlock(local.x, local.y, local.z, id)) {
      return false;
    }
    if (this.trackingEdits && previous !== id) {
      this.recordEdit(x, y, z, previous, id);
    }
    this.markDirty(x, y, z);
    return true;
  }

  /** Set a world coordinate back to air; returns false when out of bounds. */
  removeBlock(x: number, y: number, z: number): boolean {
    return this.setBlock(x, y, z, BlockIds.air);
  }

  /** Whether the block at a world coordinate is solid (air outside the world). */
  isSolid(x: number, y: number, z: number): boolean {
    return this.registry.isSolid(this.getBlock(x, y, z));
  }

  /** The chunk at a chunk coordinate, or undefined when it does not exist. */
  getChunk(coord: ChunkCoord): Chunk | undefined {
    return this.chunksByKey.get(chunkKey(coord));
  }

  /** Whether a chunk coordinate is generated and loaded. */
  hasChunk(coord: ChunkCoord): boolean {
    return this.chunksByKey.has(chunkKey(coord));
  }

  /** Iterate every loaded chunk. */
  chunks(): IterableIterator<Chunk> {
    return this.chunksByKey.values();
  }

  /**
   * Start recording player edits as deltas from the terrain already in the
   * world. Generation writes before this call are the baseline and are never
   * recorded, so only player modifications are captured. Safe to call more
   * than once; later calls are ignored.
   */
  beginTrackingEdits(): void {
    this.trackingEdits = true;
  }

  /**
   * The player modifications that distinguish the world from its generated
   * terrain, ordered by coordinate for a stable save. A coordinate edited
   * back to its generated value is omitted, so the set only grows with net
   * edits. Before `beginTrackingEdits` this is always empty.
   */
  modifications(): readonly BlockModification[] {
    const modifications: BlockModification[] = [];
    for (const edit of this.editsByKey.values()) {
      modifications.push({ x: edit.x, y: edit.y, z: edit.z, id: edit.id });
    }
    modifications.sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z);
    return modifications;
  }

  /**
   * Fold one tracked write into the delta set. The first write to a
   * coordinate captures the generated value as the baseline; a later write
   * that returns the block to that baseline drops the entry entirely.
   */
  private recordEdit(x: number, y: number, z: number, previous: number, id: number): void {
    const key = `${x},${y},${z}`;
    const existing = this.editsByKey.get(key);
    const baseline = existing === undefined ? previous : existing.baseline;
    if (id === baseline) {
      this.editsByKey.delete(key);
      return;
    }
    this.editsByKey.set(key, { x, y, z, baseline, id });
  }

  /**
   * Mark the chunks affected by an edit at a world coordinate: the containing
   * chunk, plus each existing neighbour across a chunk face when the block
   * sits on that boundary. Diagonal and out-of-world neighbours are skipped.
   */
  markDirty(x: number, y: number, z: number): void {
    if (!this.isWithinBounds(x, y, z)) {
      return;
    }
    const chunk = blockToChunkCoord(x, y, z);
    const local = blockToLocalCoord(x, y, z);

    this.markChunkDirty(chunk);
    if (local.x === 0) {
      this.markChunkDirty({ ...chunk, x: chunk.x - 1 });
    }
    if (local.x === CHUNK_SIZE_X - 1) {
      this.markChunkDirty({ ...chunk, x: chunk.x + 1 });
    }
    if (local.y === 0) {
      this.markChunkDirty({ ...chunk, y: chunk.y - 1 });
    }
    if (local.y === CHUNK_SIZE_Y - 1) {
      this.markChunkDirty({ ...chunk, y: chunk.y + 1 });
    }
    if (local.z === 0) {
      this.markChunkDirty({ ...chunk, z: chunk.z - 1 });
    }
    if (local.z === CHUNK_SIZE_Z - 1) {
      this.markChunkDirty({ ...chunk, z: chunk.z + 1 });
    }
  }

  /** Whether a chunk is marked for rebuild. */
  isChunkDirty(coord: ChunkCoord): boolean {
    return this.dirtyChunkKeys.has(chunkKey(coord));
  }

  /** Clear the dirty flag for one chunk, for example after rebuilding it. */
  clearChunkDirty(coord: ChunkCoord): void {
    this.dirtyChunkKeys.delete(chunkKey(coord));
  }

  /** Every chunk whose geometry may be stale, for the renderer to rebuild. */
  dirtyChunks(): readonly Chunk[] {
    const chunks: Chunk[] = [];
    for (const key of this.dirtyChunkKeys) {
      const chunk = this.chunksByKey.get(key);
      if (chunk !== undefined) {
        chunks.push(chunk);
      }
    }
    return chunks;
  }

  private markChunkDirty(coord: ChunkCoord): void {
    const key = chunkKey(coord);
    if (this.chunksByKey.has(key)) {
      this.dirtyChunkKeys.add(key);
    }
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer, received ${value}.`);
  }
}
