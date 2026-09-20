import { describe, expect, it } from 'vitest';

import { BlockIds } from '../world/Block';
import {
  blockIndex,
  blockToChunkCoord,
  blockToLocalCoord,
  CHUNK_SIZE_X,
  CHUNK_SIZE_Y,
  CHUNK_SIZE_Z,
  CHUNK_VOLUME,
  Chunk,
  chunkKey,
  isLocalInBounds,
} from '../world/Chunk';

describe('Chunk storage', () => {
  it('stores blocks in a flat typed array sized to the chunk volume', () => {
    const chunk = new Chunk({ x: 0, y: 0, z: 0 });

    expect(chunk.coord).toEqual({ x: 0, y: 0, z: 0 });
    expect(chunk.data).toBeInstanceOf(Uint8Array);
    expect(chunk.data.length).toBe(CHUNK_VOLUME);
    expect(CHUNK_VOLUME).toBe(CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z);
  });

  it('round-trips local block writes and defaults untouched cells to air', () => {
    const chunk = new Chunk({ x: 0, y: 0, z: 0 });

    expect(chunk.getBlock(0, 0, 0)).toBe(BlockIds.air);
    expect(chunk.setBlock(3, 4, 5, BlockIds.basic)).toBe(true);
    expect(chunk.getBlock(3, 4, 5)).toBe(BlockIds.basic);
    expect(chunk.getBlock(5, 4, 3)).toBe(BlockIds.air);

    expect(chunk.setBlock(3, 4, 5, BlockIds.air)).toBe(true);
    expect(chunk.getBlock(3, 4, 5)).toBe(BlockIds.air);
  });

  it('writes at the far local corner and reads it back', () => {
    const chunk = new Chunk({ x: 1, y: 2, z: 3 });
    const corner = { x: CHUNK_SIZE_X - 1, y: CHUNK_SIZE_Y - 1, z: CHUNK_SIZE_Z - 1 };

    expect(chunk.setBlock(corner.x, corner.y, corner.z, BlockIds.bedrock)).toBe(true);
    expect(chunk.getBlock(corner.x, corner.y, corner.z)).toBe(BlockIds.bedrock);
  });

  it('refuses out-of-range local writes and reads air for them', () => {
    const chunk = new Chunk({ x: 0, y: 0, z: 0 });

    for (const [x, y, z] of [
      [-1, 0, 0],
      [CHUNK_SIZE_X, 0, 0],
      [0, -1, 0],
      [0, CHUNK_SIZE_Y, 0],
      [0, 0, -1],
      [0, 0, CHUNK_SIZE_Z],
      [1.5, 0, 0],
      [Number.NaN, 0, 0],
    ]) {
      expect(chunk.setBlock(x as number, y as number, z as number, BlockIds.basic)).toBe(false);
      expect(chunk.getBlock(x as number, y as number, z as number)).toBe(BlockIds.air);
      expect(isLocalInBounds(x as number, y as number, z as number)).toBe(false);
    }
  });
});

describe('chunk coordinate mapping', () => {
  it('maps world block coordinates to chunk coordinates', () => {
    expect(blockToChunkCoord(0, 0, 0)).toEqual({ x: 0, y: 0, z: 0 });
    expect(blockToChunkCoord(CHUNK_SIZE_X - 1, CHUNK_SIZE_Y - 1, CHUNK_SIZE_Z - 1)).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
    expect(blockToChunkCoord(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z)).toEqual({
      x: 1,
      y: 1,
      z: 1,
    });
    expect(blockToChunkCoord(2 * CHUNK_SIZE_X + 1, 5, 3 * CHUNK_SIZE_Z + 7)).toEqual({
      x: 2,
      y: 0,
      z: 3,
    });
  });

  it('maps world block coordinates to local coordinates within the chunk', () => {
    expect(blockToLocalCoord(0, 0, 0)).toEqual({ x: 0, y: 0, z: 0 });
    expect(blockToLocalCoord(2 * CHUNK_SIZE_X + 1, 5, 3 * CHUNK_SIZE_Z + 7)).toEqual({
      x: 1,
      y: 5,
      z: 7,
    });
  });

  it('derives one stable, distinct key per chunk coordinate', () => {
    expect(chunkKey({ x: 1, y: 2, z: 3 })).toBe('1,2,3');
    expect(chunkKey({ x: 1, y: 2, z: 3 })).toBe(chunkKey({ x: 1, y: 2, z: 3 }));
    expect(chunkKey({ x: 1, y: 2, z: 3 })).not.toBe(chunkKey({ x: 3, y: 2, z: 1 }));
    expect(chunkKey({ x: -1, y: 0, z: 0 })).not.toBe(chunkKey({ x: 0, y: -1, z: 0 }));
  });

  it('lays out flat indices without collisions across axes', () => {
    expect(blockIndex(0, 0, 0)).toBe(0);
    expect(blockIndex(1, 0, 0)).toBe(1);
    expect(blockIndex(0, 0, 1)).toBe(CHUNK_SIZE_X);
    expect(blockIndex(0, 1, 0)).toBe(CHUNK_SIZE_X * CHUNK_SIZE_Z);

    const seen = new Set<number>();
    for (let y = 0; y < CHUNK_SIZE_Y; y += 1) {
      for (let z = 0; z < CHUNK_SIZE_Z; z += 1) {
        for (let x = 0; x < CHUNK_SIZE_X; x += 1) {
          const index = blockIndex(x, y, z);
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(CHUNK_VOLUME);
          expect(seen.has(index)).toBe(false);
          seen.add(index);
        }
      }
    }
    expect(seen.size).toBe(CHUNK_VOLUME);
  });
});
