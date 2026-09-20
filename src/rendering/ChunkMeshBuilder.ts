import type { BlockType } from '../world/BlockType';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, type Chunk } from '../world/Chunk';

/**
 * Samples a block by world block coordinate.
 *
 * The caller supplies this so the mesh builder never owns block state. Only
 * world coordinates are passed, so a face on a chunk boundary tests the
 * neighbouring chunk's block, and out-of-world coordinates resolve to air
 * through the same world read contract used everywhere else.
 */
export type BlockSampler = (x: number, y: number, z: number) => BlockType;

/**
 * Plain geometry for one chunk, with no Three.js types crossing the seam.
 *
 * Vertices are emitted per visible quad, so positions/normals/colours all
 * advance together. Indices form two counter-clockwise triangles per quad.
 */
export interface ChunkMeshData {
  /** Interleaved XYZ positions, three floats per vertex. */
  readonly positions: Float32Array;
  /** Interleaved XYZ face normals, three floats per vertex. */
  readonly normals: Float32Array;
  /** Interleaved RGB colours in `[0, 1]`, three floats per vertex. */
  readonly colors: Float32Array;
  /** Triangle indices, six per quad. */
  readonly indices: Uint32Array;
}

interface Face {
  readonly normal: readonly [number, number, number];
  readonly corners: readonly (readonly [number, number, number])[];
}

/** Growable vertex streams shared by every emitted quad. */
interface MeshBuffers {
  readonly positions: number[];
  readonly normals: number[];
  readonly colors: number[];
  readonly indices: number[];
}

/**
 * The six cube faces, ordered +X, -X, +Y, -Y, +Z, -Z. Each corner is an
 * offset from the block's minimum corner and the four corners wind
 * counter-clockwise as seen from outside the block, so back-face culling in
 * the renderer drops nothing visible.
 */
const FACES: readonly Face[] = [
  { normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { normal: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { normal: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { normal: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

/** Two triangles that tile a quad in the corner order above. */
const QUAD_INDICES: readonly [number, number, number, number, number, number] = [
  0, 1, 2, 0, 2, 3,
];

/**
 * Build the visible geometry for one chunk.
 *
 * A quad is emitted only for a solid block whose neighbour across that face is
 * non-solid. This single rule culls faces between two solid blocks and keeps
 * chunk boundaries consistent because neighbours are read through `blockAt`
 * in world coordinates. The result is a plain value: rebuilding is cheap and
 * repeated calls with the same world state produce identical arrays.
 */
export function buildChunkMesh(chunk: Chunk, blockAt: BlockSampler): ChunkMeshData {
  const buffers: MeshBuffers = { positions: [], normals: [], colors: [], indices: [] };

  const originX = chunk.coord.x * CHUNK_SIZE_X;
  const originY = chunk.coord.y * CHUNK_SIZE_Y;
  const originZ = chunk.coord.z * CHUNK_SIZE_Z;

  for (let y = 0; y < CHUNK_SIZE_Y; y += 1) {
    for (let z = 0; z < CHUNK_SIZE_Z; z += 1) {
      for (let x = 0; x < CHUNK_SIZE_X; x += 1) {
        const worldX = originX + x;
        const worldY = originY + y;
        const worldZ = originZ + z;

        const block = blockAt(worldX, worldY, worldZ);
        if (!block.solid) {
          continue;
        }

        const color = colorToRgb(blockColor(block));
        for (const face of FACES) {
          const [nx, ny, nz] = face.normal;
          if (blockAt(worldX + nx, worldY + ny, worldZ + nz).solid) {
            continue;
          }
          appendQuad(buffers, face, worldX, worldY, worldZ, color);
        }
      }
    }
  }

  return {
    positions: new Float32Array(buffers.positions),
    normals: new Float32Array(buffers.normals),
    colors: new Float32Array(buffers.colors),
    indices: new Uint32Array(buffers.indices),
  };
}

/** Append one face's four vertices, its normal, its colour, and two triangles. */
function appendQuad(
  buffers: MeshBuffers,
  face: Face,
  blockX: number,
  blockY: number,
  blockZ: number,
  color: readonly [number, number, number],
): void {
  const baseVertex = buffers.positions.length / 3;
  const [r, g, b] = color;

  for (const corner of face.corners) {
    const [dx, dy, dz] = corner;
    buffers.positions.push(blockX + dx, blockY + dy, blockZ + dz);
    buffers.normals.push(face.normal[0], face.normal[1], face.normal[2]);
    buffers.colors.push(r, g, b);
  }

  for (const offset of QUAD_INDICES) {
    buffers.indices.push(baseVertex + offset);
  }
}

/** The flat colour a block contributes to its quads (atlas materials default to white). */
function blockColor(block: BlockType): number {
  return block.material.kind === 'color' ? block.material.color : 0xffffff;
}

/** Split a 24-bit RGB integer into three normalised `[0, 1]` channels. */
function colorToRgb(color: number): readonly [number, number, number] {
  return [((color >> 16) & 0xff) / 255, ((color >> 8) & 0xff) / 255, (color & 0xff) / 255];
}
