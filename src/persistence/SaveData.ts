import type { BlockRegistry } from '../world/BlockRegistry';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../world/Chunk';
import type { WorldSize } from '../world/World';
import type { GenerationParams } from '../world/WorldGenerator';

/**
 * Save schema version. This is independent of the generator version: bump it
 * only when the persisted shape changes incompatibly, so an older build
 * rejects a newer save instead of misreading it.
 */
export const SAVE_VERSION = 1;

/**
 * Conservative guard on persisted world dimensions. A malformed or hostile
 * save must never be able to allocate an unbounded amount of memory before it
 * is rejected. v1 worlds are a handful of chunks; the cap exists purely so a
 * corrupt record can be recovered from safely.
 */
export const MAX_CHUNKS_PER_AXIS = 64;
export const MAX_TOTAL_CHUNKS = 4096;

/**
 * The world parameters needed to regenerate the base terrain: dimensions,
 * chunk shape, and the generator inputs that are not the seed or version.
 */
export interface WorldParameters {
  readonly sizeInChunks: WorldSize;
  readonly chunkSize: WorldSize;
  readonly baseSurfaceHeight: number;
  readonly amplitude: number;
  readonly bedrockLayers: number;
  readonly featureSize: number;
}

/**
 * A player edit as stored on disk. Coordinates are world block coordinates;
 * `id` is the block that now occupies the cell, with removals stored as air.
 */
export interface SaveModification {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly id: number;
}

/**
 * Everything needed to rebuild a world: a schema version, the generator
 * inputs, and the deltas from the generated terrain. This is plain data only;
 * no meshes, materials, camera, renderer, or GPU state is ever persisted.
 */
export interface SaveData {
  readonly version: number;
  readonly seed: number;
  readonly generatorVersion: number;
  readonly worldParameters: WorldParameters;
  readonly modifications: readonly SaveModification[];
}

/** The subset of a save that describes which world to build. */
export interface WorldMetadata {
  readonly seed: number;
  readonly generatorVersion: number;
  readonly worldParameters: WorldParameters;
}

/** A validation outcome: either the parsed data or a human-readable reason. */
export type SaveValidationResult =
  | { readonly ok: true; readonly data: SaveData }
  | { readonly ok: false; readonly reason: string };

/** Raised internally when a payload does not describe a valid save. */
export class SaveValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveValidationError';
  }
}

/**
 * Validate an untrusted payload and return either the typed save or a reason
 * it was rejected. This never throws, so callers can treat a bad save as a
 * recoverable outcome rather than an exception.
 */
export function validateSaveData(
  raw: unknown,
  registry: BlockRegistry,
): SaveValidationResult {
  try {
    return { ok: true, data: parseSaveData(raw, registry) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown validation error.';
    return { ok: false, reason };
  }
}

/**
 * Build the metadata for a freshly configured world. The generator's seed and
 * version are hoisted to the save's top level; the rest of the generation
 * inputs live under `worldParameters`.
 */
export function worldMetadataFrom(
  sizeInChunks: WorldSize,
  generation: GenerationParams,
): WorldMetadata {
  return {
    seed: generation.seed,
    generatorVersion: generation.generatorVersion,
    worldParameters: {
      sizeInChunks: { ...sizeInChunks },
      chunkSize: { x: CHUNK_SIZE_X, y: CHUNK_SIZE_Y, z: CHUNK_SIZE_Z },
      baseSurfaceHeight: generation.baseSurfaceHeight,
      amplitude: generation.amplitude,
      bedrockLayers: generation.bedrockLayers,
      featureSize: generation.featureSize,
    },
  };
}

/** Recombine metadata into the flat generator input the generator expects. */
export function generationParamsFrom(metadata: WorldMetadata): GenerationParams {
  const parameters = metadata.worldParameters;
  return {
    seed: metadata.seed,
    generatorVersion: metadata.generatorVersion,
    baseSurfaceHeight: parameters.baseSurfaceHeight,
    amplitude: parameters.amplitude,
    bedrockLayers: parameters.bedrockLayers,
    featureSize: parameters.featureSize,
  };
}

function parseSaveData(raw: unknown, registry: BlockRegistry): SaveData {
  const record = asRecord(raw, 'save data');
  const version = readInteger(record, 'version');
  if (version !== SAVE_VERSION) {
    throw new SaveValidationError(
      `Unsupported save version ${version}; this build expects ${SAVE_VERSION}.`,
    );
  }

  const seed = readUint32(record, 'seed');
  const generatorVersion = readPositiveInteger(record, 'generatorVersion');
  const worldParameters = parseWorldParameters(record['worldParameters']);
  const modifications = parseModifications(record['modifications'], worldParameters, registry);

  return { version, seed, generatorVersion, worldParameters, modifications };
}

function parseWorldParameters(raw: unknown): WorldParameters {
  const record = asRecord(raw, 'worldParameters');
  const sizeInChunks = parseSizeInChunks(record['sizeInChunks'], 'worldParameters.sizeInChunks');
  const chunkSize = parseChunkSize(record['chunkSize'], 'worldParameters.chunkSize');

  if (chunkSize.x !== CHUNK_SIZE_X || chunkSize.y !== CHUNK_SIZE_Y || chunkSize.z !== CHUNK_SIZE_Z) {
    throw new SaveValidationError(
      `Unsupported chunk size ${chunkSize.x}x${chunkSize.y}x${chunkSize.z}; ` +
        `this build expects ${CHUNK_SIZE_X}x${CHUNK_SIZE_Y}x${CHUNK_SIZE_Z}.`,
    );
  }

  const baseSurfaceHeight = readPositiveInteger(record, 'baseSurfaceHeight');
  const amplitude = readNonNegativeInteger(record, 'amplitude');
  const bedrockLayers = readPositiveInteger(record, 'bedrockLayers');
  const featureSize = readPositiveInteger(record, 'featureSize');

  // The generator throws when there is no room above the bedrock floor, so a
  // save that would do that must be rejected before it is ever generated.
  const worldHeight = sizeInChunks.y * chunkSize.y;
  if (bedrockLayers >= worldHeight) {
    throw new SaveValidationError(
      `baseSurfaceHeight/bedrockLayers leave no world above ${bedrockLayers} bedrock layer(s).`,
    );
  }

  return {
    sizeInChunks,
    chunkSize,
    baseSurfaceHeight,
    amplitude,
    bedrockLayers,
    featureSize,
  };
}

function parseSizeInChunks(raw: unknown, label: string): WorldSize {
  const record = asRecord(raw, label);
  const x = readPositiveInteger(record, 'x');
  const y = readPositiveInteger(record, 'y');
  const z = readPositiveInteger(record, 'z');
  if (x > MAX_CHUNKS_PER_AXIS || y > MAX_CHUNKS_PER_AXIS || z > MAX_CHUNKS_PER_AXIS) {
    throw new SaveValidationError(
      `${label} exceeds the maximum of ${MAX_CHUNKS_PER_AXIS} chunks per axis.`,
    );
  }
  if (x * y * z > MAX_TOTAL_CHUNKS) {
    throw new SaveValidationError(
      `${label} exceeds the maximum of ${MAX_TOTAL_CHUNKS} total chunks.`,
    );
  }
  return { x, y, z };
}

function parseChunkSize(raw: unknown, label: string): WorldSize {
  const record = asRecord(raw, label);
  return {
    x: readPositiveInteger(record, 'x'),
    y: readPositiveInteger(record, 'y'),
    z: readPositiveInteger(record, 'z'),
  };
}

function parseModifications(
  raw: unknown,
  parameters: WorldParameters,
  registry: BlockRegistry,
): readonly SaveModification[] {
  if (!Array.isArray(raw)) {
    throw new SaveValidationError('modifications must be an array.');
  }

  const sizeBlocks = {
    x: parameters.sizeInChunks.x * parameters.chunkSize.x,
    y: parameters.sizeInChunks.y * parameters.chunkSize.y,
    z: parameters.sizeInChunks.z * parameters.chunkSize.z,
  };
  const seen = new Set<string>();
  const modifications: SaveModification[] = [];

  for (const [index, entry] of raw.entries()) {
    const label = `modifications[${index}]`;
    const record = asRecord(entry, label);
    const x = readInteger(record, 'x');
    const y = readInteger(record, 'y');
    const z = readInteger(record, 'z');
    const id = readInteger(record, 'id');

    if (x < 0 || x >= sizeBlocks.x || y < 0 || y >= sizeBlocks.y || z < 0 || z >= sizeBlocks.z) {
      throw new SaveValidationError(
        `${label} coordinate (${x},${y},${z}) is outside the world.`,
      );
    }
    if (!registry.has(id)) {
      throw new SaveValidationError(`${label} uses unknown block id ${id}.`);
    }

    const key = `${x},${y},${z}`;
    if (seen.has(key)) {
      throw new SaveValidationError(`${label} duplicates coordinate (${x},${y},${z}).`);
    }
    seen.add(key);
    modifications.push({ x, y, z, id });
  }

  return modifications;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SaveValidationError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function readInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new SaveValidationError(`${key} must be an integer.`);
  }
  return value;
}

function readPositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = readInteger(record, key);
  if (value < 1) {
    throw new SaveValidationError(`${key} must be a positive integer.`);
  }
  return value;
}

function readNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = readInteger(record, key);
  if (value < 0) {
    throw new SaveValidationError(`${key} must be a non-negative integer.`);
  }
  return value;
}

function readUint32(record: Record<string, unknown>, key: string): number {
  const value = readInteger(record, key);
  if (value < 0 || value > 0xffffffff) {
    throw new SaveValidationError(`${key} must be a 32-bit unsigned integer.`);
  }
  return value;
}
