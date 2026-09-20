import { describe, expect, it } from 'vitest';

import { BlockIds } from '../world/Block';
import { createDefaultBlockRegistry, type BlockRegistry } from '../world/BlockRegistry';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, chunkKey, type ChunkCoord } from '../world/Chunk';
import { World, type WorldSize } from '../world/World';

const registry: BlockRegistry = createDefaultBlockRegistry();

function createWorld(sizeInChunks: WorldSize = { x: 2, y: 1, z: 2 }): World {
  return new World({ sizeInChunks }, registry);
}

function clearAllDirty(world: World): void {
  for (const chunk of world.chunks()) {
    world.clearChunkDirty(chunk.coord);
  }
}

function dirtyKeys(world: World): string[] {
  return world
    .dirtyChunks()
    .map((chunk) => chunkKey(chunk.coord))
    .sort();
}

describe('World bounds', () => {
  it('derives block dimensions from the chunk count', () => {
    const world = createWorld({ x: 2, y: 1, z: 2 });

    expect(world.sizeInChunks).toEqual({ x: 2, y: 1, z: 2 });
    expect(world.size).toEqual({
      x: 2 * CHUNK_SIZE_X,
      y: CHUNK_SIZE_Y,
      z: 2 * CHUNK_SIZE_Z,
    });
  });

  it('accepts an arbitrary configured size instead of a hard-coded one', () => {
    const world = createWorld({ x: 4, y: 2, z: 3 });

    expect(world.size).toEqual({
      x: 4 * CHUNK_SIZE_X,
      y: 2 * CHUNK_SIZE_Y,
      z: 3 * CHUNK_SIZE_Z,
    });
    expect(world.isWithinBounds(4 * CHUNK_SIZE_X - 1, 2 * CHUNK_SIZE_Y - 1, 3 * CHUNK_SIZE_Z - 1)).toBe(
      true,
    );
  });

  it('reports bounds for interior and fractional coordinates', () => {
    const world = createWorld({ x: 1, y: 1, z: 1 });

    expect(world.isWithinBounds(0, 0, 0)).toBe(true);
    expect(world.isWithinBounds(CHUNK_SIZE_X - 1, CHUNK_SIZE_Y - 1, CHUNK_SIZE_Z - 1)).toBe(true);

    for (const [x, y, z] of [
      [-1, 0, 0],
      [CHUNK_SIZE_X, 0, 0],
      [0, -1, 0],
      [0, CHUNK_SIZE_Y, 0],
      [0, 0, -1],
      [0, 0, CHUNK_SIZE_Z],
      [1.5, 0, 0],
      [Number.NaN, 0, 0],
      [Number.POSITIVE_INFINITY, 0, 0],
    ]) {
      expect(world.isWithinBounds(x as number, y as number, z as number)).toBe(false);
    }
  });

  it('rejects a non-positive chunk size at construction', () => {
    expect(() => createWorld({ x: 0, y: 1, z: 1 })).toThrow();
    expect(() => createWorld({ x: -1, y: 1, z: 1 })).toThrow();
    expect(() => createWorld({ x: 1.5, y: 1, z: 1 })).toThrow();
  });
});

describe('World block access', () => {
  it('round-trips set, get, and remove', () => {
    const world = createWorld();

    expect(world.getBlock(5, 6, 7)).toBe(BlockIds.air);

    expect(world.setBlock(5, 6, 7, BlockIds.basic)).toBe(true);
    expect(world.getBlock(5, 6, 7)).toBe(BlockIds.basic);

    expect(world.removeBlock(5, 6, 7)).toBe(true);
    expect(world.getBlock(5, 6, 7)).toBe(BlockIds.air);
  });

  it('reports solidity from the block registry', () => {
    const world = createWorld();

    expect(world.isSolid(1, 1, 1)).toBe(false);

    world.setBlock(1, 1, 1, BlockIds.basic);
    expect(world.isSolid(1, 1, 1)).toBe(true);

    world.setBlock(2, 1, 1, BlockIds.bedrock);
    expect(world.isSolid(2, 1, 1)).toBe(true);

    world.removeBlock(1, 1, 1);
    expect(world.isSolid(1, 1, 1)).toBe(false);
  });

  it('reads air and not-solid outside the world instead of throwing', () => {
    const world = createWorld({ x: 1, y: 1, z: 1 });

    for (const [x, y, z] of [
      [-1, 0, 0],
      [CHUNK_SIZE_X, 0, 0],
      [0, CHUNK_SIZE_Y, 0],
      [0, 0, CHUNK_SIZE_Z],
      [1.5, 2.5, 3.5],
    ]) {
      expect(() => world.getBlock(x as number, y as number, z as number)).not.toThrow();
      expect(world.getBlock(x as number, y as number, z as number)).toBe(BlockIds.air);
      expect(world.isSolid(x as number, y as number, z as number)).toBe(false);
    }
  });

  it('rejects writes outside the world without changing anything', () => {
    const world = createWorld({ x: 1, y: 1, z: 1 });

    for (const [x, y, z] of [
      [-1, 0, 0],
      [CHUNK_SIZE_X, 0, 0],
      [0, CHUNK_SIZE_Y, 0],
      [0, 0, CHUNK_SIZE_Z],
    ]) {
      expect(world.setBlock(x as number, y as number, z as number, BlockIds.basic)).toBe(false);
      expect(world.removeBlock(x as number, y as number, z as number)).toBe(false);
    }
    expect(world.getBlock(0, 0, 0)).toBe(BlockIds.air);
  });

  it('keeps adjacent chunks independent', () => {
    const world = createWorld({ x: 2, y: 1, z: 1 });

    world.setBlock(CHUNK_SIZE_X - 1, 0, 0, BlockIds.basic);
    world.setBlock(CHUNK_SIZE_X, 0, 0, BlockIds.bedrock);

    expect(world.getBlock(CHUNK_SIZE_X - 1, 0, 0)).toBe(BlockIds.basic);
    expect(world.getBlock(CHUNK_SIZE_X, 0, 0)).toBe(BlockIds.bedrock);
  });

  it('exposes chunks by chunk coordinate', () => {
    const world = createWorld({ x: 2, y: 1, z: 1 });

    const origin = world.getChunk({ x: 0, y: 0, z: 0 });
    const neighbour = world.getChunk({ x: 1, y: 0, z: 0 });

    expect(origin).toBeDefined();
    expect(neighbour).toBeDefined();
    expect(origin).not.toBe(neighbour);
    expect(world.hasChunk({ x: 0, y: 0, z: 0 })).toBe(true);
    expect(world.hasChunk({ x: 2, y: 0, z: 0 })).toBe(false);
    expect(world.getChunk({ x: 2, y: 0, z: 0 })).toBeUndefined();

    // A block at x = CHUNK_SIZE_X belongs to the neighbouring chunk.
    world.setBlock(CHUNK_SIZE_X, 2, 3, BlockIds.basic);
    expect(neighbour?.getBlock(0, 2, 3)).toBe(BlockIds.basic);
    expect(origin?.getBlock(0, 2, 3)).toBe(BlockIds.air);
  });
});

describe('World dirty marking', () => {
  it('starts with every chunk dirty so the initial world gets built', () => {
    const world = createWorld({ x: 2, y: 1, z: 2 });

    expect(dirtyKeys(world)).toEqual(
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 1, y: 0, z: 1 },
      ]
        .map(chunkKey)
        .sort(),
    );
  });

  it('marks only the containing chunk for an interior block edit', () => {
    const world = createWorld({ x: 2, y: 1, z: 2 });
    clearAllDirty(world);

    world.setBlock(5, 6, 7, BlockIds.basic);

    expect(dirtyKeys(world)).toEqual([chunkKey({ x: 0, y: 0, z: 0 })]);
  });

  it('marks the neighbouring chunk for an edit on a chunk face', () => {
    const world = createWorld({ x: 2, y: 1, z: 2 });

    clearAllDirty(world);
    world.setBlock(CHUNK_SIZE_X, 5, 5, BlockIds.basic);
    expect(dirtyKeys(world)).toEqual(
      [chunkKey({ x: 0, y: 0, z: 0 }), chunkKey({ x: 1, y: 0, z: 0 })].sort(),
    );

    clearAllDirty(world);
    world.setBlock(CHUNK_SIZE_X - 1, 5, 5, BlockIds.basic);
    expect(dirtyKeys(world)).toEqual(
      [chunkKey({ x: 0, y: 0, z: 0 }), chunkKey({ x: 1, y: 0, z: 0 })].sort(),
    );

    clearAllDirty(world);
    world.setBlock(5, 5, CHUNK_SIZE_Z, BlockIds.basic);
    expect(dirtyKeys(world)).toEqual(
      [chunkKey({ x: 0, y: 0, z: 0 }), chunkKey({ x: 0, y: 0, z: 1 })].sort(),
    );
  });

  it('marks each face-neighbour of an edit on a chunk corner', () => {
    const world = createWorld({ x: 2, y: 1, z: 2 });
    clearAllDirty(world);

    world.setBlock(CHUNK_SIZE_X, 5, CHUNK_SIZE_Z, BlockIds.basic);

    expect(dirtyKeys(world)).toEqual(
      [
        chunkKey({ x: 1, y: 0, z: 1 }),
        chunkKey({ x: 0, y: 0, z: 1 }),
        chunkKey({ x: 1, y: 0, z: 0 }),
      ].sort(),
    );
  });

  it('does not mark a neighbour that lies outside the world', () => {
    const world = createWorld({ x: 2, y: 1, z: 2 });
    clearAllDirty(world);

    // On the x = 0 face of the world there is no chunk at x = -1.
    world.setBlock(0, 5, 5, BlockIds.basic);

    expect(dirtyKeys(world)).toEqual([chunkKey({ x: 0, y: 0, z: 0 })]);
  });

  it('marks the chunk above/below for edits on a vertical chunk boundary', () => {
    const world = createWorld({ x: 1, y: 2, z: 1 });

    clearAllDirty(world);
    world.setBlock(5, CHUNK_SIZE_Y, 5, BlockIds.basic);
    expect(dirtyKeys(world)).toEqual(
      [chunkKey({ x: 0, y: 0, z: 0 }), chunkKey({ x: 0, y: 1, z: 0 })].sort(),
    );

    clearAllDirty(world);
    world.setBlock(5, CHUNK_SIZE_Y - 1, 5, BlockIds.basic);
    expect(dirtyKeys(world)).toEqual(
      [chunkKey({ x: 0, y: 0, z: 0 }), chunkKey({ x: 0, y: 1, z: 0 })].sort(),
    );
  });

  it('marks dirty on remove as well as set', () => {
    const world = createWorld();
    world.setBlock(5, 5, 5, BlockIds.basic);
    clearAllDirty(world);

    world.removeBlock(5, 5, 5);

    expect(dirtyKeys(world)).toEqual([chunkKey({ x: 0, y: 0, z: 0 })]);
  });

  it('ignores dirty marking outside the world', () => {
    const world = createWorld({ x: 1, y: 1, z: 1 });
    clearAllDirty(world);

    world.markDirty(-1, 0, 0);
    world.markDirty(CHUNK_SIZE_X, 0, 0);

    expect(world.dirtyChunks()).toEqual([]);
  });

  it('tracks and clears the dirty flag per chunk', () => {
    const world = createWorld({ x: 1, y: 1, z: 1 });
    const coord: ChunkCoord = { x: 0, y: 0, z: 0 };

    expect(world.isChunkDirty(coord)).toBe(true);
    world.clearChunkDirty(coord);
    expect(world.isChunkDirty(coord)).toBe(false);
    expect(world.isChunkDirty({ x: 1, y: 0, z: 0 })).toBe(false);

    world.markDirty(1, 1, 1);
    expect(world.isChunkDirty(coord)).toBe(true);
  });
});
