import { describe, expect, it } from 'vitest';

import { BlockIds } from '../world/Block';
import { createDefaultBlockRegistry } from '../world/BlockRegistry';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../world/Chunk';
import {
  MAX_CHUNKS_PER_AXIS,
  SAVE_VERSION,
  validateSaveData,
  worldMetadataFrom,
  generationParamsFrom,
  type SaveData,
} from '../persistence/SaveData';

const registry = createDefaultBlockRegistry();

function validSave(): SaveData {
  return {
    version: SAVE_VERSION,
    seed: 1337,
    generatorVersion: 1,
    worldParameters: {
      sizeInChunks: { x: 1, y: 1, z: 1 },
      chunkSize: { x: CHUNK_SIZE_X, y: CHUNK_SIZE_Y, z: CHUNK_SIZE_Z },
      baseSurfaceHeight: 24,
      amplitude: 3,
      bedrockLayers: 1,
      featureSize: 8,
    },
    modifications: [{ x: 1, y: 24, z: 1, id: BlockIds.air }],
  };
}

/** A structurally deep copy so each test can mutate without touching others. */
function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Mutable view of a save, used only to build payloads that are then rejected. */
interface MutableSave {
  version: number;
  seed: number;
  generatorVersion: number;
  worldParameters: {
    sizeInChunks: { x: number; y: number; z: number };
    chunkSize: { x: number; y: number; z: number };
    baseSurfaceHeight: number;
    amplitude: number;
    bedrockLayers: number;
    featureSize: number;
  };
  modifications: Array<{ x: number; y: number; z: number; id: number }>;
}

function mutableSave(): MutableSave {
  return clone(validSave()) as MutableSave;
}

describe('validateSaveData', () => {
  it('accepts a well-formed save and preserves its fields', () => {
    const save = validSave();
    const result = validateSaveData(save, registry);

    expect(result).toEqual({ ok: true, data: save });
  });

  it('accepts removals stored as air', () => {
    const save = mutableSave();
    save.modifications = [{ x: 0, y: 0, z: 0, id: BlockIds.air }];

    const result = validateSaveData(save, registry);
    expect(result.ok).toBe(true);
  });

  it('survives a JSON round-trip', () => {
    const save = validSave();
    const parsed: unknown = JSON.parse(JSON.stringify(save));

    expect(validateSaveData(parsed, registry)).toEqual({ ok: true, data: save });
  });

  it('rejects an unsupported save version', () => {
    const save = mutableSave();
    save.version = SAVE_VERSION + 1;

    const result = validateSaveData(save, registry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/version/i);
    }
  });

  it('rejects non-object payloads', () => {
    for (const raw of [null, undefined, 42, 'save', [], true]) {
      expect(validateSaveData(raw, registry).ok).toBe(false);
    }
  });

  it('rejects missing or malformed scalar fields', () => {
    for (const mutate of [
      (save: Record<string, unknown>) => delete save['seed'],
      (save: Record<string, unknown>) => {
        save['seed'] = -1;
      },
      (save: Record<string, unknown>) => {
        save['seed'] = 1.5;
      },
      (save: Record<string, unknown>) => {
        save['generatorVersion'] = 0;
      },
      (save: Record<string, unknown>) => {
        save['worldParameters'] = null;
      },
      (save: Record<string, unknown>) => {
        save['modifications'] = 'none';
      },
    ]) {
      const save = clone(validSave()) as unknown as Record<string, unknown>;
      mutate(save);
      expect(validateSaveData(save, registry).ok).toBe(false);
    }
  });

  it('rejects an unsupported chunk size', () => {
    const save = mutableSave();
    save.worldParameters.chunkSize = { x: 8, y: 8, z: 8 };

    expect(validateSaveData(save, registry).ok).toBe(false);
  });

  it('rejects generation parameters that cannot produce a world', () => {
    const save = mutableSave();
    save.worldParameters.bedrockLayers = save.worldParameters.sizeInChunks.y * CHUNK_SIZE_Y;

    expect(validateSaveData(save, registry).ok).toBe(false);
  });

  it('rejects dimensions above the safety cap', () => {
    const save = mutableSave();
    save.worldParameters.sizeInChunks = { x: MAX_CHUNKS_PER_AXIS + 1, y: 1, z: 1 };

    expect(validateSaveData(save, registry).ok).toBe(false);
  });

  it('rejects modifications outside the world bounds', () => {
    for (const modification of [
      { x: -1, y: 1, z: 1, id: BlockIds.basic },
      { x: CHUNK_SIZE_X, y: 1, z: 1, id: BlockIds.basic },
      { x: 1, y: CHUNK_SIZE_Y, z: 1, id: BlockIds.basic },
      { x: 1, y: 1, z: CHUNK_SIZE_Z, id: BlockIds.basic },
      { x: 1.5, y: 1, z: 1, id: BlockIds.basic },
    ]) {
      const save = mutableSave();
      save.modifications = [modification];
      expect(validateSaveData(save, registry).ok).toBe(false);
    }
  });

  it('rejects unknown block ids', () => {
    const save = mutableSave();
    save.modifications = [{ x: 1, y: 1, z: 1, id: 99 }];

    expect(validateSaveData(save, registry).ok).toBe(false);
  });

  it('rejects duplicate modification coordinates', () => {
    const save = mutableSave();
    save.modifications = [
      { x: 1, y: 1, z: 1, id: BlockIds.basic },
      { x: 1, y: 1, z: 1, id: BlockIds.air },
    ];

    expect(validateSaveData(save, registry).ok).toBe(false);
  });

  it('never throws, whatever the payload', () => {
    const nasty: unknown[] = [
      { version: SAVE_VERSION, seed: Number.NaN },
      { version: SAVE_VERSION, seed: 1, generatorVersion: 1, worldParameters: {}, modifications: [] },
      new Map(),
      Symbol('save'),
      () => undefined,
    ];

    for (const raw of nasty) {
      expect(() => validateSaveData(raw, registry)).not.toThrow();
      expect(validateSaveData(raw, registry).ok).toBe(false);
    }
  });
});

describe('worldMetadataFrom and generationParamsFrom', () => {
  it('round-trips generation inputs', () => {
    const metadata = worldMetadataFrom(
      { x: 2, y: 1, z: 3 },
      {
        seed: 42,
        generatorVersion: 7,
        baseSurfaceHeight: 20,
        amplitude: 5,
        bedrockLayers: 2,
        featureSize: 6,
      },
    );

    expect(metadata.seed).toBe(42);
    expect(metadata.generatorVersion).toBe(7);
    expect(metadata.worldParameters.sizeInChunks).toEqual({ x: 2, y: 1, z: 3 });
    expect(metadata.worldParameters.chunkSize).toEqual({
      x: CHUNK_SIZE_X,
      y: CHUNK_SIZE_Y,
      z: CHUNK_SIZE_Z,
    });
    expect(generationParamsFrom(metadata)).toEqual({
      seed: 42,
      generatorVersion: 7,
      baseSurfaceHeight: 20,
      amplitude: 5,
      bedrockLayers: 2,
      featureSize: 6,
    });
  });
});
