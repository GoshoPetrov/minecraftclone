import { describe, expect, it } from 'vitest';

import { config } from '../config/Config';
import { createDefaultBlockRegistry } from '../world/BlockRegistry';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../world/Chunk';

describe('config', () => {
  it('exposes a single source of tuning constants', () => {
    expect(config.maxFrameDeltaSeconds).toBeGreaterThan(0);
    expect(config.skyColor).toBeGreaterThanOrEqual(0);
    expect(config.skyColor).toBeLessThanOrEqual(0xffffff);
    expect(config.camera.fovDegrees).toBeGreaterThan(0);
    expect(config.camera.fovDegrees).toBeLessThan(180);
    expect(config.camera.eyeHeight).toBeGreaterThan(0);
    expect(config.camera.eyeHeight).toBeLessThan(config.player.height);
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

  it('exposes valid player physics constants', () => {
    const player = config.player;

    expect(player.width).toBeGreaterThan(0);
    expect(player.height).toBeGreaterThan(0);
    // Hearts are whole 2 HP hearts, so full health must be a positive even
    // number of hit points.
    expect(Number.isInteger(player.maxHealth)).toBe(true);
    expect(player.maxHealth).toBeGreaterThan(0);
    expect(player.maxHealth % 2).toBe(0);
    expect(player.moveSpeed).toBeGreaterThan(0);
    expect(player.gravity).toBeGreaterThan(0);
    expect(player.jumpVelocity).toBeGreaterThan(0);
    expect(player.maxFallSpeed).toBeGreaterThan(0);
    expect(player.physicsStepSeconds).toBeGreaterThan(0);
    expect(player.physicsStepSeconds).toBeLessThanOrEqual(config.maxFrameDeltaSeconds);
    expect(player.sprintSpeedMultiplier).toBeGreaterThan(0);
    expect(player.crouchSpeedMultiplier).toBeGreaterThan(0);
    // The crouched eye stays inside the crouched box, which stays shorter
    // than the standing box, so standing up always raises the eye and the
    // crouched box can fit spaces the standing one cannot.
    expect(config.camera.crouchEyeHeight).toBeLessThan(player.crouchHeight);
    expect(player.crouchHeight).toBeLessThan(player.height);
    // A sub-step can never move further than the collision box, so a solid
    // block cannot be skipped between two positions.
    expect(player.maxFallSpeed * player.physicsStepSeconds).toBeLessThan(player.height);
    expect(player.maxFallSpeed * player.physicsStepSeconds).toBeLessThan(player.width);
  });

  it('exposes valid camera look and input binding constants', () => {
    expect(config.camera.lookSensitivity).toBeGreaterThan(0);
    expect(config.camera.maxPitchRadians).toBeGreaterThan(0);
    expect(config.camera.maxPitchRadians).toBeLessThan(Math.PI / 2);
    expect(config.camera.sprintFovMultiplier).toBeGreaterThan(0);
    expect(config.camera.fovTransitionSeconds).toBeGreaterThan(0);
    expect(config.camera.crouchEyeHeight).toBeGreaterThan(0);

    const bindings = config.input.bindings;
    const codes = Object.values(bindings);
    expect(codes.every((code) => code.length > 0)).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
    expect(config.player.spawnHeadroomBlocks).toBeGreaterThanOrEqual(1);
  });

  it('exposes a positive interaction range and a placeable default block', () => {
    expect(config.interaction.range).toBeGreaterThan(0);
    expect(Number.isFinite(config.interaction.range)).toBe(true);
    expect(
      createDefaultBlockRegistry().isPlaceable(config.interaction.defaultPlaceableBlock),
    ).toBe(true);
  });

  it('exposes a positive save debounce interval', () => {
    expect(Number.isFinite(config.persistence.saveDebounceMs)).toBe(true);
    expect(config.persistence.saveDebounceMs).toBeGreaterThan(0);
  });

  it('locks the default world extent at 128 × 128 blocks and one chunk tall', () => {
    const { sizeInChunks } = config.world;

    expect(sizeInChunks.x * CHUNK_SIZE_X).toBe(128);
    expect(sizeInChunks.z * CHUNK_SIZE_Z).toBe(128);
    expect(sizeInChunks.y).toBe(1);
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
