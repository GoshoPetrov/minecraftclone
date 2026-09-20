import { describe, expect, it } from 'vitest';

import { config } from '../config/Config';
import { CHUNK_SIZE_Y } from '../world/Chunk';

describe('config', () => {
  it('exposes a single source of tuning constants', () => {
    expect(config.maxFrameDeltaSeconds).toBeGreaterThan(0);
    expect(config.skyColor).toBeGreaterThanOrEqual(0);
    expect(config.skyColor).toBeLessThanOrEqual(0xffffff);
    expect(config.camera.fovDegrees).toBeGreaterThan(0);
    expect(config.camera.fovDegrees).toBeLessThan(180);
    expect(config.maxPixelRatio).toBeGreaterThanOrEqual(1);
  });

  it('exposes a valid rendering budget and lighting setup', () => {
    const rendering = config.rendering;

    expect(Number.isInteger(rendering.chunkRebuildBudgetPerFrame)).toBe(true);
    expect(rendering.chunkRebuildBudgetPerFrame).toBeGreaterThanOrEqual(1);
    expect(rendering.ambientLightIntensity).toBeGreaterThan(0);
    expect(rendering.directionalLightIntensity).toBeGreaterThan(0);
    expect(
      Math.hypot(
        rendering.sunDirection.x,
        rendering.sunDirection.y,
        rendering.sunDirection.z,
      ),
    ).toBeGreaterThan(0);
  });

  it('exposes valid deterministic generation parameters', () => {
    const generation = config.generation;

    expect(Number.isInteger(generation.seed)).toBe(true);
    expect(generation.seed).toBeGreaterThanOrEqual(0);
    expect(generation.seed).toBeLessThanOrEqual(0xffffffff);
    expect(generation.generatorVersion).toBeGreaterThanOrEqual(1);
    expect(generation.bedrockLayers).toBeGreaterThanOrEqual(1);
    expect(generation.amplitude).toBeGreaterThanOrEqual(0);
    expect(generation.featureSize).toBeGreaterThanOrEqual(1);
    expect(generation.baseSurfaceHeight).toBeGreaterThan(generation.bedrockLayers);
    expect(generation.baseSurfaceHeight + generation.amplitude).toBeLessThan(
      config.world.sizeInChunks.y * CHUNK_SIZE_Y,
    );
  });
});
