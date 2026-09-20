import { describe, expect, it } from 'vitest';

import { BlockIds } from '../world/Block';
import { createDefaultBlockRegistry } from '../world/BlockRegistry';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../world/Chunk';
import { World, type WorldSize } from '../world/World';
import { HeightmapWorldGenerator, type GenerationParams } from '../world/WorldGenerator';

const registry = createDefaultBlockRegistry();
const DEFAULT_SIZE: WorldSize = { x: 2, y: 1, z: 2 };
const KNOWN_IDS = new Set<number>([BlockIds.air, BlockIds.basic, BlockIds.bedrock]);

function makeWorld(sizeInChunks: WorldSize = DEFAULT_SIZE): World {
  return new World({ sizeInChunks }, registry);
}

function makeParams(overrides: Partial<GenerationParams> = {}): GenerationParams {
  return {
    seed: 1234,
    generatorVersion: 1,
    baseSurfaceHeight: 24,
    amplitude: 3,
    bedrockLayers: 1,
    featureSize: 8,
    ...overrides,
  };
}

function generate(params: GenerationParams, world: World = makeWorld()): World {
  new HeightmapWorldGenerator(params).generate(world);
  return world;
}

/** Every block id, in a fixed order, for bit-for-bit comparison. */
function worldBlocks(world: World): number[] {
  const blocks: number[] = [];
  for (let y = 0; y < world.size.y; y += 1) {
    for (let z = 0; z < world.size.z; z += 1) {
      for (let x = 0; x < world.size.x; x += 1) {
        blocks.push(world.getBlock(x, y, z));
      }
    }
  }
  return blocks;
}

function surfaceHeight(world: World, x: number, z: number): number {
  for (let y = world.size.y - 1; y >= 0; y -= 1) {
    if (world.isSolid(x, y, z)) {
      return y;
    }
  }
  return -1;
}

function everyColumn(world: World, visit: (x: number, z: number) => void): void {
  for (let z = 0; z < world.size.z; z += 1) {
    for (let x = 0; x < world.size.x; x += 1) {
      visit(x, z);
    }
  }
}

describe('HeightmapWorldGenerator determinism', () => {
  it('generates identical terrain for the same seed, version, and parameters', () => {
    const params = makeParams();
    const first = generate(params);
    const second = generate({ ...params });

    expect(worldBlocks(first)).toEqual(worldBlocks(second));

    for (const chunk of first.chunks()) {
      const mirror = second.getChunk(chunk.coord);
      expect(mirror).toBeDefined();
      expect(Array.from(chunk.data)).toEqual(Array.from(mirror?.data ?? []));
    }
  });

  it('is idempotent, so regenerating the same world leaves it unchanged', () => {
    const params = makeParams();
    const world = generate(params);
    const before = worldBlocks(world);

    new HeightmapWorldGenerator({ ...params }).generate(world);

    expect(worldBlocks(world)).toEqual(before);
  });

  it('varies terrain when the seed changes', () => {
    const first = generate(makeParams({ seed: 1234 }));
    const second = generate(makeParams({ seed: 5678 }));

    expect(worldBlocks(first)).not.toEqual(worldBlocks(second));
  });

  it('varies terrain when the generator version changes', () => {
    const first = generate(makeParams({ generatorVersion: 1 }));
    const second = generate(makeParams({ generatorVersion: 2 }));

    expect(worldBlocks(first)).not.toEqual(worldBlocks(second));
  });

  it('varies terrain when generation parameters change', () => {
    const lowAmplitude = generate(makeParams({ amplitude: 1 }));
    const highAmplitude = generate(makeParams({ amplitude: 6 }));
    expect(worldBlocks(lowAmplitude)).not.toEqual(worldBlocks(highAmplitude));

    const lowSurface = generate(makeParams({ baseSurfaceHeight: 18 }));
    const highSurface = generate(makeParams({ baseSurfaceHeight: 30 }));
    expect(worldBlocks(lowSurface)).not.toEqual(worldBlocks(highSurface));
  });
});

describe('HeightmapWorldGenerator terrain shape', () => {
  it('lays an unbreakable bedrock floor under every column', () => {
    const params = makeParams({ bedrockLayers: 3 });
    const world = generate(params);

    everyColumn(world, (x, z) => {
      for (let y = 0; y < params.bedrockLayers; y += 1) {
        expect(world.getBlock(x, y, z)).toBe(BlockIds.bedrock);
      }
    });
    expect(registry.isBreakable(BlockIds.bedrock)).toBe(false);
    expect(registry.isSolid(BlockIds.bedrock)).toBe(true);
  });

  it('layers bedrock, then basic blocks up to the surface, then air', () => {
    const params = makeParams({ bedrockLayers: 2 });
    const world = generate(params);

    everyColumn(world, (x, z) => {
      const surface = surfaceHeight(world, x, z);
      expect(surface).toBeGreaterThanOrEqual(params.bedrockLayers);

      for (let y = 0; y < world.size.y; y += 1) {
        const expected =
          y < params.bedrockLayers
            ? BlockIds.bedrock
            : y <= surface
              ? BlockIds.basic
              : BlockIds.air;
        expect(world.getBlock(x, y, z)).toBe(expected);
      }
    });
  });

  it('produces a surface with multiple solid layers everywhere', () => {
    const params = makeParams({ bedrockLayers: 2 });
    const world = generate(params);

    everyColumn(world, (x, z) => {
      let solidLayers = 0;
      for (let y = 0; y < world.size.y; y += 1) {
        if (world.isSolid(x, y, z)) {
          solidLayers += 1;
        }
      }
      expect(solidLayers).toBeGreaterThanOrEqual(params.bedrockLayers + 1);
    });
  });

  it('leaves no caves or floating islands beneath the surface', () => {
    const world = generate(makeParams());

    everyColumn(world, (x, z) => {
      let reachedAir = false;
      for (let y = 0; y < world.size.y; y += 1) {
        const solid = world.isSolid(x, y, z);
        if (reachedAir && solid) {
          throw new Error(`Solid block above air at ${x},${y},${z}.`);
        }
        if (!solid) {
          reachedAir = true;
        }
      }
    });
  });

  it('generates only air, basic_block, and bedrock', () => {
    const world = generate(makeParams());

    for (const id of worldBlocks(world)) {
      expect(KNOWN_IDS.has(id)).toBe(true);
    }
  });
});

describe('HeightmapWorldGenerator bounds and coverage', () => {
  it('covers every chunk in the world', () => {
    const world = generate(makeParams());
    const { x, y, z } = world.sizeInChunks;
    const chunks = [...world.chunks()];

    expect(chunks).toHaveLength(x * y * z);
    for (const chunk of chunks) {
      expect(world.hasChunk(chunk.coord)).toBe(true);
      for (let localZ = 0; localZ < CHUNK_SIZE_Z; localZ += 1) {
        for (let localX = 0; localX < CHUNK_SIZE_X; localX += 1) {
          expect(chunk.getBlock(localX, 0, localZ)).toBe(BlockIds.bedrock);
        }
      }
    }
  });

  it('fills empty chunks above the terrain so every chunk is covered vertically', () => {
    const world = generate(makeParams(), makeWorld({ x: 1, y: 2, z: 1 }));
    const upperChunk = world.getChunk({ x: 0, y: 1, z: 0 });

    expect(upperChunk).toBeDefined();
    if (upperChunk === undefined) {
      return;
    }
    for (const id of upperChunk.data) {
      expect(id).toBe(BlockIds.air);
    }
  });

  it('keeps every surface between the bedrock floor and the world ceiling', () => {
    const world = generate(makeParams());

    everyColumn(world, (x, z) => {
      const surface = surfaceHeight(world, x, z);
      expect(surface).toBeGreaterThanOrEqual(1);
      expect(surface).toBeLessThanOrEqual(world.size.y - 1);
    });
  });

  it('clamps terrain to the world ceiling instead of overflowing it', () => {
    const world = generate(makeParams({ baseSurfaceHeight: 100, amplitude: 5 }));

    everyColumn(world, (x, z) => {
      expect(surfaceHeight(world, x, z)).toBe(world.size.y - 1);
    });
    expect(world.size.y).toBe(CHUNK_SIZE_Y);
  });

  it('clamps terrain to the bedrock floor instead of dropping below it', () => {
    const params = makeParams({ baseSurfaceHeight: 1, amplitude: 5, bedrockLayers: 2 });
    const world = generate(params);
    const surfaces: number[] = [];

    everyColumn(world, (x, z) => {
      const surface = surfaceHeight(world, x, z);
      expect(surface).toBeGreaterThanOrEqual(params.bedrockLayers);
      surfaces.push(surface);
    });
    expect(Math.min(...surfaces)).toBe(params.bedrockLayers);
    expect(world.getBlock(0, 0, 0)).toBe(BlockIds.bedrock);
    expect(world.getBlock(0, 1, 0)).toBe(BlockIds.bedrock);
  });

  it('respects world bounds with an arbitrary non-square world size', () => {
    const world = generate(makeParams(), makeWorld({ x: 3, y: 1, z: 1 }));

    expect(world.size).toEqual({ x: 3 * CHUNK_SIZE_X, y: CHUNK_SIZE_Y, z: CHUNK_SIZE_Z });
    expect(world.getBlock(3 * CHUNK_SIZE_X - 1, 0, 0)).toBe(BlockIds.bedrock);
  });
});

describe('HeightmapWorldGenerator validation', () => {
  it('rejects invalid generation parameters', () => {
    for (const params of [
      makeParams({ seed: -1 }),
      makeParams({ seed: 1.5 }),
      makeParams({ seed: 0x1_0000_0000 }),
      makeParams({ generatorVersion: 0 }),
      makeParams({ baseSurfaceHeight: 0 }),
      makeParams({ amplitude: -1 }),
      makeParams({ amplitude: 1.5 }),
      makeParams({ bedrockLayers: 0 }),
      makeParams({ featureSize: 0 }),
    ]) {
      expect(() => new HeightmapWorldGenerator(params)).toThrow();
    }
  });

  it('rejects a world with no room above the bedrock', () => {
    const world = makeWorld({ x: 1, y: 1, z: 1 });
    const generator = new HeightmapWorldGenerator(makeParams({ bedrockLayers: world.size.y }));

    expect(() => generator.generate(world)).toThrow();
  });
});
