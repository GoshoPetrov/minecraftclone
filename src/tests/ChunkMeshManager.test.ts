import { describe, expect, it } from 'vitest';

import { BlockIds } from '../world/Block';
import { createDefaultBlockRegistry } from '../world/BlockRegistry';
import { CHUNK_SIZE_X, type ChunkCoord } from '../world/Chunk';
import { World, type WorldSize } from '../world/World';
import type { BlockSampler } from '../rendering/ChunkMeshBuilder';
import { ChunkMeshManager } from '../rendering/ChunkMeshManager';

const registry = createDefaultBlockRegistry();

function createWorld(sizeInChunks: WorldSize = { x: 2, y: 1, z: 2 }): World {
  return new World({ sizeInChunks }, registry);
}

/** A sampler that resolves block types through the given world. */
function samplerFor(world: World): BlockSampler {
  return (x, y, z) => registry.get(world.getBlock(x, y, z));
}

function createManager(world: World): ChunkMeshManager {
  return new ChunkMeshManager(world, samplerFor(world));
}

const ORIGIN: ChunkCoord = { x: 0, y: 0, z: 0 };

describe('ChunkMeshManager dirty flushing', () => {
  it('builds at most one mesh per chunk and respects the frame budget', () => {
    const world = createWorld();
    const manager = createManager(world);

    expect(world.dirtyChunks()).toHaveLength(4);

    expect(manager.flushDirty(2)).toBe(2);
    expect(manager.meshCount).toBe(2);
    expect(manager.group.children).toHaveLength(2);
    expect(world.dirtyChunks()).toHaveLength(2);

    expect(manager.flushDirty(2)).toBe(2);
    expect(manager.meshCount).toBe(4);
    expect(manager.group.children).toHaveLength(4);
    expect(world.dirtyChunks()).toHaveLength(0);

    // Nothing dirty: a flush is a no-op.
    expect(manager.flushDirty(2)).toBe(0);
  });

  it('keys meshes by chunk coordinate', () => {
    const world = createWorld();
    const manager = createManager(world);

    manager.flushDirty(4);

    expect(manager.hasMesh({ x: 1, y: 0, z: 1 })).toBe(true);
    expect(manager.getMesh({ x: 1, y: 0, z: 1 })).toBeDefined();
    expect(manager.hasMesh({ x: 9, y: 9, z: 9 })).toBe(false);
  });

  it('ignores a non-positive or fractional budget', () => {
    const world = createWorld();
    const manager = createManager(world);

    expect(manager.flushDirty(0)).toBe(0);
    expect(manager.flushDirty(-3)).toBe(0);
    expect(manager.flushDirty(1.5)).toBe(0);
    expect(manager.meshCount).toBe(0);
  });

  it('builds an invisible mesh for an all-air chunk without throwing', () => {
    const world = createWorld({ x: 1, y: 1, z: 1 });
    const manager = createManager(world);

    manager.flushDirty(1);

    const mesh = manager.getMesh(ORIGIN);
    expect(mesh).toBeDefined();
    expect(mesh?.object3d.visible).toBe(false);
  });
});

describe('ChunkMeshManager incremental rebuilds', () => {
  it('rebuilds only the edited chunk and reuses its mesh object', () => {
    const world = createWorld();
    const manager = createManager(world);
    manager.flushDirty(10);

    const before = manager.getMesh(ORIGIN);
    expect(before).toBeDefined();
    expect(world.dirtyChunks()).toHaveLength(0);

    // An interior edit touches no chunk boundary, so one chunk goes dirty.
    world.setBlock(5, 5, 5, BlockIds.basic);
    expect(world.dirtyChunks()).toHaveLength(1);

    expect(manager.flushDirty(10)).toBe(1);
    expect(manager.meshCount).toBe(4);
    expect(manager.getMesh(ORIGIN)).toBe(before);
    expect(world.dirtyChunks()).toHaveLength(0);
  });

  it('rebuilds the neighbouring chunk when an edit lies on a chunk boundary', () => {
    const world = createWorld();
    const manager = createManager(world);
    manager.flushDirty(10);

    world.setBlock(CHUNK_SIZE_X - 1, 5, 5, BlockIds.basic);

    expect(world.dirtyChunks()).toHaveLength(2);
    expect(manager.flushDirty(10)).toBe(2);
    expect(manager.meshCount).toBe(4);
  });

  it('never creates one mesh per block in a filled chunk', () => {
    const world = createWorld({ x: 1, y: 1, z: 1 });
    for (let y = 0; y < 4; y += 1) {
      for (let z = 0; z < 4; z += 1) {
        for (let x = 0; x < 4; x += 1) {
          world.setBlock(x, y, z, BlockIds.basic);
        }
      }
    }

    const manager = createManager(world);
    manager.flushDirty(10);

    expect(manager.meshCount).toBe(1);
    expect(manager.group.children).toHaveLength(1);
    const mesh = manager.getMesh(ORIGIN);
    expect(mesh?.object3d.visible).toBe(true);
    expect(mesh?.object3d.geometry.getAttribute('position').count).toBeGreaterThan(0);
  });
});
