import { describe, expect, it } from 'vitest';

import { BlockIds } from '../world/Block';
import { createDefaultBlockRegistry } from '../world/BlockRegistry';
import { HeightmapWorldGenerator, type GenerationParams } from '../world/WorldGenerator';
import { World } from '../world/World';

const registry = createDefaultBlockRegistry();
const generation: GenerationParams = {
  seed: 1337,
  generatorVersion: 1,
  baseSurfaceHeight: 24,
  amplitude: 3,
  bedrockLayers: 1,
  featureSize: 8,
};

/** A generated world with edit tracking enabled, as the game uses it. */
function trackedWorld(): World {
  const world = new World({ sizeInChunks: { x: 1, y: 1, z: 1 } }, registry);
  new HeightmapWorldGenerator(generation).generate(world);
  world.beginTrackingEdits();
  return world;
}

/** A column coordinate guaranteed to be air, well above the surface. */
function airCell(): { x: number; y: number; z: number } {
  return { x: 5, y: 60, z: 5 };
}

describe('World edit tracking', () => {
  it('records nothing for generated terrain', () => {
    expect(trackedWorld().modifications()).toEqual([]);
  });

  it('ignores writes made before tracking begins', () => {
    const world = new World({ sizeInChunks: { x: 1, y: 1, z: 1 } }, registry);
    new HeightmapWorldGenerator(generation).generate(world);
    world.setBlock(1, 60, 1, BlockIds.basic);
    world.beginTrackingEdits();

    expect(world.modifications()).toEqual([]);
  });

  it('records a placed block as a delta with the placed id', () => {
    const world = trackedWorld();
    const cell = airCell();

    expect(world.getBlock(cell.x, cell.y, cell.z)).toBe(BlockIds.air);
    world.setBlock(cell.x, cell.y, cell.z, BlockIds.basic);

    expect(world.modifications()).toEqual([{ ...cell, id: BlockIds.basic }]);
  });

  it('records a broken block as a modification to air', () => {
    const world = trackedWorld();

    expect(world.getBlock(3, 1, 3)).toBe(BlockIds.basic);
    world.removeBlock(3, 1, 3);

    expect(world.modifications()).toEqual([{ x: 3, y: 1, z: 3, id: BlockIds.air }]);
  });

  it('drops a coordinate edited back to its generated value', () => {
    const world = trackedWorld();
    const cell = airCell();

    world.setBlock(cell.x, cell.y, cell.z, BlockIds.basic);
    expect(world.modifications()).toHaveLength(1);

    world.removeBlock(cell.x, cell.y, cell.z);
    expect(world.modifications()).toEqual([]);
  });

  it('keeps only the final value after repeated edits', () => {
    const world = trackedWorld();
    const cell = airCell();

    world.setBlock(cell.x, cell.y, cell.z, BlockIds.basic);
    world.setBlock(cell.x, cell.y, cell.z, BlockIds.bedrock);

    expect(world.modifications()).toEqual([{ ...cell, id: BlockIds.bedrock }]);
  });

  it('orders modifications by coordinate so saves are stable', () => {
    const world = trackedWorld();

    world.setBlock(9, 60, 9, BlockIds.basic);
    world.setBlock(2, 61, 2, BlockIds.basic);
    world.setBlock(2, 60, 8, BlockIds.basic);

    expect(world.modifications()).toEqual([
      { x: 2, y: 60, z: 8, id: BlockIds.basic },
      { x: 2, y: 61, z: 2, id: BlockIds.basic },
      { x: 9, y: 60, z: 9, id: BlockIds.basic },
    ]);
  });
});
