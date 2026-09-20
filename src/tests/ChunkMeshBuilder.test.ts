import { describe, expect, it } from 'vitest';

import { AIR, BASIC_BLOCK, BEDROCK } from '../world/Block';
import type { BlockType } from '../world/BlockType';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, Chunk } from '../world/Chunk';
import {
  buildChunkMesh,
  type BlockSampler,
  type ChunkMeshData,
} from '../rendering/ChunkMeshBuilder';

/** A non-solid type with a colour, to prove culling keys on solidity, not id. */
const LIQUID: BlockType = {
  id: 99,
  name: 'liquid',
  solid: false,
  breakable: false,
  placeable: false,
  material: { kind: 'color', color: 0x0000ff },
};

type BlockEntry = readonly [x: number, y: number, z: number, type: BlockType];

function blockKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

/** A sampler over an explicit set of world coordinates; everything else is air. */
function samplerFrom(entries: readonly BlockEntry[]): BlockSampler {
  const blocks = new Map<string, BlockType>();
  for (const [x, y, z, type] of entries) {
    blocks.set(blockKey(x, y, z), type);
  }
  return (x, y, z) => blocks.get(blockKey(x, y, z)) ?? AIR;
}

function quadCount(mesh: ChunkMeshData): number {
  return mesh.positions.length / 12;
}

function vertexCount(mesh: ChunkMeshData): number {
  return mesh.positions.length / 3;
}

/** The distinct normals present in a mesh. */
function normalsOf(mesh: ChunkMeshData): string[] {
  const seen = new Set<string>();
  for (let i = 0; i < mesh.normals.length; i += 3) {
    seen.add(`${mesh.normals[i]},${mesh.normals[i + 1]},${mesh.normals[i + 2]}`);
  }
  return [...seen].sort();
}

function axisOf(positions: Float32Array, axisOffset: number): Set<number> {
  const values = new Set<number>();
  for (let i = axisOffset; i < positions.length; i += 3) {
    values.add(positions[i] as number);
  }
  return values;
}

/** How many quads face the given direction. */
function quadsWithNormal(mesh: ChunkMeshData, nx: number, ny: number, nz: number): number {
  let vertices = 0;
  for (let i = 0; i < mesh.normals.length; i += 3) {
    if (mesh.normals[i] === nx && mesh.normals[i + 1] === ny && mesh.normals[i + 2] === nz) {
      vertices += 1;
    }
  }
  return vertices / 4;
}

describe('buildChunkMesh face culling', () => {
  it('emits no geometry for an all-air chunk', () => {
    const mesh = buildChunkMesh(new Chunk({ x: 0, y: 0, z: 0 }), samplerFrom([]));

    expect(mesh.positions).toHaveLength(0);
    expect(mesh.normals).toHaveLength(0);
    expect(mesh.colors).toHaveLength(0);
    expect(mesh.indices).toHaveLength(0);
  });

  it('emits exactly six faces for an isolated solid block', () => {
    const mesh = buildChunkMesh(
      new Chunk({ x: 0, y: 0, z: 0 }),
      samplerFrom([[2, 3, 4, BASIC_BLOCK]]),
    );

    expect(quadCount(mesh)).toBe(6);
    expect(vertexCount(mesh)).toBe(24);
    expect(normalsOf(mesh)).toEqual(['-1,0,0', '0,-1,0', '0,0,-1', '0,0,1', '0,1,0', '1,0,0']);
  });

  it('culls the shared face between two adjacent solid blocks', () => {
    const mesh = buildChunkMesh(
      new Chunk({ x: 0, y: 0, z: 0 }),
      samplerFrom([
        [5, 5, 5, BASIC_BLOCK],
        [6, 5, 5, BASIC_BLOCK],
      ]),
    );

    // Two isolated blocks would be 12 faces; the touching pair loses two.
    expect(quadCount(mesh)).toBe(10);
  });

  it('culls every face of a block fully surrounded by solid blocks', () => {
    const entries: BlockEntry[] = [];
    for (let x = 4; x <= 6; x += 1) {
      for (let y = 4; y <= 6; y += 1) {
        for (let z = 4; z <= 6; z += 1) {
          entries.push([x, y, z, BASIC_BLOCK]);
        }
      }
    }

    const mesh = buildChunkMesh(new Chunk({ x: 0, y: 0, z: 0 }), samplerFrom(entries));

    // A 3x3x3 cube exposes only its shell: 6 faces x 9 quads. The buried
    // centre block would add 6 more if interior faces were not culled.
    expect(quadCount(mesh)).toBe(54);
  });

  it('does not emit geometry for a non-solid block type', () => {
    const mesh = buildChunkMesh(
      new Chunk({ x: 0, y: 0, z: 0 }),
      samplerFrom([[5, 5, 5, LIQUID]]),
    );

    expect(quadCount(mesh)).toBe(0);
  });
});

describe('buildChunkMesh chunk boundaries', () => {
  it('culls a boundary face when the neighbouring chunk holds a solid block', () => {
    const mesh = buildChunkMesh(
      new Chunk({ x: 0, y: 0, z: 0 }),
      samplerFrom([
        [CHUNK_SIZE_X - 1, 5, 5, BASIC_BLOCK],
        [CHUNK_SIZE_X, 5, 5, BASIC_BLOCK],
      ]),
    );

    expect(quadCount(mesh)).toBe(5);
    // The +X seam face is gone, but the block's other faces remain.
    expect(quadsWithNormal(mesh, 1, 0, 0)).toBe(0);
    expect(quadsWithNormal(mesh, -1, 0, 0)).toBe(1);
  });

  it('emits a boundary face when the neighbouring cell is air', () => {
    const mesh = buildChunkMesh(
      new Chunk({ x: 0, y: 0, z: 0 }),
      samplerFrom([[CHUNK_SIZE_X - 1, 5, 5, BASIC_BLOCK]]),
    );

    expect(quadCount(mesh)).toBe(6);
    expect(quadsWithNormal(mesh, 1, 0, 0)).toBe(1);
  });

  it('reads neighbours in world coordinates for a non-origin chunk', () => {
    const sampler = samplerFrom([
      [CHUNK_SIZE_X - 1, 5, 5, BASIC_BLOCK],
      [CHUNK_SIZE_X, 5, 5, BASIC_BLOCK],
    ]);

    const originMesh = buildChunkMesh(new Chunk({ x: 0, y: 0, z: 0 }), sampler);
    const neighbourMesh = buildChunkMesh(new Chunk({ x: 1, y: 0, z: 0 }), sampler);

    expect(quadCount(originMesh)).toBe(5);
    expect(quadCount(neighbourMesh)).toBe(5);
    // Neither chunk emits the seam quad, and neither misses its outer face.
    expect(quadsWithNormal(originMesh, 1, 0, 0)).toBe(0);
    expect(quadsWithNormal(neighbourMesh, -1, 0, 0)).toBe(0);
    expect(quadsWithNormal(neighbourMesh, 1, 0, 0)).toBe(1);
  });

  it('applies the same rule across a vertical chunk boundary', () => {
    const sampler = samplerFrom([
      [5, CHUNK_SIZE_Y - 1, 5, BASIC_BLOCK],
      [5, CHUNK_SIZE_Y, 5, BASIC_BLOCK],
    ]);

    const lower = buildChunkMesh(new Chunk({ x: 0, y: 0, z: 0 }), sampler);
    const upper = buildChunkMesh(new Chunk({ x: 0, y: 1, z: 0 }), sampler);

    expect(quadCount(lower)).toBe(5);
    expect(quadCount(upper)).toBe(5);
    expect(quadsWithNormal(lower, 0, 1, 0)).toBe(0);
    expect(quadsWithNormal(upper, 0, -1, 0)).toBe(0);
  });

  it('treats out-of-world neighbours as air, so world-edge faces remain', () => {
    const mesh = buildChunkMesh(
      new Chunk({ x: 0, y: 0, z: 0 }),
      samplerFrom([[0, 5, 5, BASIC_BLOCK]]),
    );

    // The -X face looks out of the world, which is air, so it is kept.
    expect(quadCount(mesh)).toBe(6);
    expect(quadsWithNormal(mesh, -1, 0, 0)).toBe(1);
  });
});

describe('buildChunkMesh output consistency', () => {
  it('takes each quad colour from its block type', () => {
    const basic = buildChunkMesh(
      new Chunk({ x: 0, y: 0, z: 0 }),
      samplerFrom([[2, 3, 4, BASIC_BLOCK]]),
    );
    const bedrock = buildChunkMesh(
      new Chunk({ x: 0, y: 0, z: 0 }),
      samplerFrom([[2, 3, 4, BEDROCK]]),
    );

    for (let i = 0; i < basic.colors.length; i += 1) {
      expect(basic.colors[i]).toBeCloseTo(0x9e / 255);
    }
    for (let i = 0; i < bedrock.colors.length; i += 1) {
      expect(bedrock.colors[i]).toBeCloseTo(0x3c / 255);
    }
  });

  it('keeps positions, normals, colours, and indices internally consistent', () => {
    const mesh = buildChunkMesh(
      new Chunk({ x: 0, y: 0, z: 0 }),
      samplerFrom([
        [1, 1, 1, BASIC_BLOCK],
        [2, 1, 1, BASIC_BLOCK],
        [1, 2, 1, BEDROCK],
      ]),
    );

    expect(mesh.positions.length % 3).toBe(0);
    expect(mesh.positions.length).toBe(vertexCount(mesh) * 3);
    expect(mesh.normals.length).toBe(mesh.positions.length);
    expect(mesh.colors.length).toBe(mesh.positions.length);
    expect(mesh.indices.length).toBe(quadCount(mesh) * 6);

    for (const index of mesh.indices) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(vertexCount(mesh));
    }
  });

  it('emits each quad on the plane its normal points away from', () => {
    const mesh = buildChunkMesh(
      new Chunk({ x: 0, y: 0, z: 0 }),
      samplerFrom([[2, 3, 4, BASIC_BLOCK]]),
    );

    // The isolated block spans world [2,3] x [3,4] x [4,5].
    const xValues = axisOf(mesh.positions, 0);
    const yValues = axisOf(mesh.positions, 1);
    const zValues = axisOf(mesh.positions, 2);
    expect([...xValues].sort()).toEqual([2, 3]);
    expect([...yValues].sort()).toEqual([3, 4]);
    expect([...zValues].sort()).toEqual([4, 5]);
  });

  it('is deterministic for the same world state', () => {
    const sampler = samplerFrom([
      [2, 3, 4, BASIC_BLOCK],
      [3, 3, 4, BEDROCK],
    ]);
    const chunk = new Chunk({ x: 0, y: 0, z: 0 });

    const first = buildChunkMesh(chunk, sampler);
    const second = buildChunkMesh(chunk, sampler);

    expect(Array.from(first.positions)).toEqual(Array.from(second.positions));
    expect(Array.from(first.normals)).toEqual(Array.from(second.normals));
    expect(Array.from(first.colors)).toEqual(Array.from(second.colors));
    expect(Array.from(first.indices)).toEqual(Array.from(second.indices));
  });

  it('yields exactly the expected visible faces after a block change', () => {
    const blocks = new Map<string, BlockType>([[blockKey(5, 5, 5), BASIC_BLOCK]]);
    const sampler: BlockSampler = (x, y, z) => blocks.get(blockKey(x, y, z)) ?? AIR;
    const chunk = new Chunk({ x: 0, y: 0, z: 0 });

    const isolated = buildChunkMesh(chunk, sampler);
    expect(quadCount(isolated)).toBe(6);

    blocks.set(blockKey(6, 5, 5), BASIC_BLOCK);
    const joined = buildChunkMesh(chunk, sampler);
    expect(quadCount(joined)).toBe(10);

    blocks.delete(blockKey(6, 5, 5));
    const rebuilt = buildChunkMesh(chunk, sampler);
    expect(quadCount(rebuilt)).toBe(6);
    expect(Array.from(rebuilt.positions)).toEqual(Array.from(isolated.positions));
    expect(Array.from(rebuilt.indices)).toEqual(Array.from(isolated.indices));
  });
});
