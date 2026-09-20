import type { BlockRegistry } from '../world/BlockRegistry';
import { World } from '../world/World';
import { HeightmapWorldGenerator } from '../world/WorldGenerator';
import { generationParamsFrom, type SaveData, type WorldMetadata } from './SaveData';

/**
 * Generate the base terrain for a world and start tracking player edits.
 * This is the fresh-world path and the first half of the restore path.
 */
export function createGeneratedWorld(metadata: WorldMetadata, registry: BlockRegistry): World {
  const world = new World({ sizeInChunks: metadata.worldParameters.sizeInChunks }, registry);
  new HeightmapWorldGenerator(generationParamsFrom(metadata)).generate(world);
  // Generation writes are the baseline; only what follows is a modification.
  world.beginTrackingEdits();
  return world;
}

/**
 * Rebuild a saved world: regenerate the terrain from the saved seed and
 * parameters, then reapply the stored deltas so the result matches the world
 * that was saved, including both broken and placed blocks.
 */
export function reconstructWorld(save: SaveData, registry: BlockRegistry): World {
  const world = createGeneratedWorld(
    {
      seed: save.seed,
      generatorVersion: save.generatorVersion,
      worldParameters: save.worldParameters,
    },
    registry,
  );
  for (const modification of save.modifications) {
    world.setBlock(modification.x, modification.y, modification.z, modification.id);
  }
  return world;
}
