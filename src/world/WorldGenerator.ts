import { BlockIds } from './Block';
import { Prng } from './Prng';
import type { World } from './World';

/**
 * Everything that influences generated terrain. Two runs with equal
 * parameters — for the same world dimensions — must produce bit-for-bit
 * identical worlds, so these values are the only inputs the generator reads.
 */
export interface GenerationParams {
  /** 32-bit unsigned world seed. */
  readonly seed: number;
  /** Bumped whenever the algorithm changes behaviour, invalidating old terrain. */
  readonly generatorVersion: number;
  /** Average surface height, as a world block Y coordinate. */
  readonly baseSurfaceHeight: number;
  /** Maximum vertical deviation from the base surface, in blocks. */
  readonly amplitude: number;
  /** Unbreakable bedrock layers at the bottom of the world. */
  readonly bedrockLayers: number;
  /** Horizontal spacing of the height lattice, in blocks; larger is smoother. */
  readonly featureSize: number;
}

/**
 * A world generator fills an existing world with terrain. The v1 generator is
 * the only implementation, but later ones (biomes, caves, structures) can
 * satisfy the same interface without the rest of the game changing.
 */
export interface WorldGenerator {
  generate(world: World): void;
}

/**
 * The v1 generator: low-amplitude rolling terrain.
 *
 * A single seeded 32-bit PRNG per world drives a small value-noise lattice.
 * The lattice is smoothly interpolated into a surface height for every
 * column, and each column is then layered bottom-to-top as bedrock, then
 * basic blocks up to the surface, then air. Generation writes block ids only,
 * so it stays independent of rendering and persistence.
 */
export class HeightmapWorldGenerator implements WorldGenerator {
  private readonly params: GenerationParams;

  constructor(params: GenerationParams) {
    assertGenerationParams(params);
    this.params = { ...params };
  }

  generate(world: World): void {
    const { bedrockLayers } = this.params;
    if (world.size.y <= bedrockLayers) {
      throw new Error(
        `World height ${world.size.y} leaves no room above ${bedrockLayers} bedrock layer(s).`,
      );
    }

    const heights = this.buildHeightmap(world);
    for (let z = 0; z < world.size.z; z += 1) {
      for (let x = 0; x < world.size.x; x += 1) {
        const surface = heights[z * world.size.x + x] ?? bedrockLayers;
        fillColumn(world, x, z, surface, bedrockLayers);
      }
    }
  }

  /**
   * Sample one surface height per column from a value-noise lattice. The
   * lattice is generated first, in a fixed order, so the whole heightmap
   * depends only on the seed/version/parameters and the world dimensions.
   */
  private buildHeightmap(world: World): Int32Array {
    const { baseSurfaceHeight, amplitude, bedrockLayers, featureSize } = this.params;
    const minSurface = bedrockLayers;
    const maxSurface = world.size.y - 1;

    const prng = new Prng(deriveSeed(this.params));
    const lattice = createLattice(prng, world.size.x, world.size.z, featureSize);

    const heights = new Int32Array(world.size.x * world.size.z);
    for (let z = 0; z < world.size.z; z += 1) {
      for (let x = 0; x < world.size.x; x += 1) {
        const noise = sampleValueNoise(lattice, x, z, featureSize);
        const offset = Math.round((noise * 2 - 1) * amplitude);
        heights[z * world.size.x + x] = clamp(baseSurfaceHeight + offset, minSurface, maxSurface);
      }
    }
    return heights;
  }
}

/** A grid of random values used to interpolate smooth terrain. */
interface HeightLattice {
  readonly values: Float64Array;
  readonly cols: number;
  readonly rows: number;
}

function createLattice(
  prng: Prng,
  sizeX: number,
  sizeZ: number,
  featureSize: number,
): HeightLattice {
  // One extra row/column so a sample at the far edge can interpolate
  // towards a lattice point just past it.
  const cols = Math.ceil(sizeX / featureSize) + 1;
  const rows = Math.ceil(sizeZ / featureSize) + 1;
  const values = new Float64Array(cols * rows);
  for (let i = 0; i < values.length; i += 1) {
    values[i] = prng.nextFloat();
  }
  return { values, cols, rows };
}

function sampleValueNoise(
  lattice: HeightLattice,
  x: number,
  z: number,
  featureSize: number,
): number {
  const gx = x / featureSize;
  const gz = z / featureSize;
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const tx = smoothstep(gx - x0);
  const tz = smoothstep(gz - z0);
  const x1 = Math.min(x0 + 1, lattice.cols - 1);
  const z1 = Math.min(z0 + 1, lattice.rows - 1);

  const top = lerp(
    lattice.values[z0 * lattice.cols + x0] ?? 0,
    lattice.values[z0 * lattice.cols + x1] ?? 0,
    tx,
  );
  const bottom = lerp(
    lattice.values[z1 * lattice.cols + x0] ?? 0,
    lattice.values[z1 * lattice.cols + x1] ?? 0,
    tx,
  );
  return lerp(top, bottom, tz);
}

/** Lay a single column bottom-to-top: bedrock, basic blocks, then air. */
function fillColumn(world: World, x: number, z: number, surface: number, bedrockLayers: number): void {
  for (let y = 0; y < world.size.y; y += 1) {
    world.setBlock(x, y, z, blockIdForY(y, surface, bedrockLayers));
  }
}

function blockIdForY(y: number, surface: number, bedrockLayers: number): number {
  if (y < bedrockLayers) {
    return BlockIds.bedrock;
  }
  return y <= surface ? BlockIds.basic : BlockIds.air;
}

/**
 * Fold the seed, generator version, and generation parameters into the 32-bit
 * value that seeds the world's PRNG (FNV-1a). Changing any input changes the
 * terrain, and equal inputs always produce the same stream.
 */
function deriveSeed(params: GenerationParams): number {
  let hash = 0x811c9dc5;
  const inputs = [
    params.seed,
    params.generatorVersion,
    params.baseSurfaceHeight,
    params.amplitude,
    params.bedrockLayers,
    params.featureSize,
  ];
  for (const input of inputs) {
    const value = input >>> 0;
    for (let byte = 0; byte < 4; byte += 1) {
      hash ^= (value >>> (byte * 8)) & 0xff;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash >>> 0;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function assertGenerationParams(params: GenerationParams): void {
  assertUint32(params.seed, 'Generation seed');
  assertPositiveInteger(params.generatorVersion, 'Generator version');
  assertPositiveInteger(params.baseSurfaceHeight, 'Base surface height');
  assertNonNegativeInteger(params.amplitude, 'Terrain amplitude');
  assertPositiveInteger(params.bedrockLayers, 'Bedrock layers');
  assertPositiveInteger(params.featureSize, 'Terrain feature size');
}

function assertUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`${label} must be a 32-bit unsigned integer, received ${value}.`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer, received ${value}.`);
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer, received ${value}.`);
  }
}
