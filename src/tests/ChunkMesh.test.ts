import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { AIR, BASIC_BLOCK } from '../world/Block';
import { Chunk } from '../world/Chunk';
import { buildChunkMesh, type BlockSampler, type ChunkMeshData } from '../rendering/ChunkMeshBuilder';
import { ChunkMesh, createChunkGeometry } from '../rendering/ChunkMesh';

/** Mesh data for a single solid block at the chunk origin: six quads. */
function oneBlockMeshData(): ChunkMeshData {
  const blockAt: BlockSampler = (x, y, z) =>
    x === 0 && y === 0 && z === 0 ? BASIC_BLOCK : AIR;
  return buildChunkMesh(new Chunk({ x: 0, y: 0, z: 0 }), blockAt);
}

/** A single quad whose four vertices all carry the same sRGB colour. */
function quadWithSrgb(r: number, g: number, b: number): ChunkMeshData {
  const colors = new Float32Array(4 * 3);
  for (let vertex = 0; vertex < 4; vertex += 1) {
    colors[vertex * 3] = r;
    colors[vertex * 3 + 1] = g;
    colors[vertex * 3 + 2] = b;
  }
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    colors,
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };
}

const EMPTY_MESH_DATA: ChunkMeshData = {
  positions: new Float32Array(0),
  normals: new Float32Array(0),
  colors: new Float32Array(0),
  indices: new Uint32Array(0),
};

describe('createChunkGeometry', () => {
  it('maps chunk mesh arrays onto geometry attributes', () => {
    const geometry = createChunkGeometry(oneBlockMeshData());

    expect(geometry.getAttribute('position').count).toBe(24);
    expect(geometry.getAttribute('position').itemSize).toBe(3);
    expect(geometry.getAttribute('normal').count).toBe(24);
    expect(geometry.getAttribute('color').count).toBe(24);
    expect(geometry.getIndex()?.count).toBe(36);
    expect(geometry.boundingSphere).not.toBeNull();

    geometry.dispose();
  });

  it('converts authored sRGB colours into linear working space', () => {
    const geometry = createChunkGeometry(quadWithSrgb(0.5, 0.25, 1));
    const color = geometry.getAttribute('color');

    expect(color.getX(0)).toBeCloseTo(0.214041, 5);
    expect(color.getY(0)).toBeCloseTo(0.050876, 5);
    expect(color.getZ(0)).toBeCloseTo(1, 5);

    geometry.dispose();
  });

  it('produces an empty but valid geometry for an empty mesh', () => {
    const geometry = createChunkGeometry(EMPTY_MESH_DATA);

    expect(geometry.getAttribute('position').count).toBe(0);
    expect(geometry.getIndex()?.count).toBe(0);

    geometry.dispose();
  });
});

describe('ChunkMesh', () => {
  it('starts empty and invisible', () => {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new ChunkMesh(material);

    expect(mesh.object3d.visible).toBe(false);
    expect(mesh.object3d.geometry.getAttribute('position').count).toBe(0);

    mesh.dispose();
    material.dispose();
  });

  it('reuses the mesh object while swapping geometry and visibility', () => {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new ChunkMesh(material);
    const initialGeometry = mesh.object3d.geometry;

    mesh.update(oneBlockMeshData());
    expect(mesh.object3d.visible).toBe(true);
    expect(mesh.object3d.geometry).not.toBe(initialGeometry);
    expect(mesh.object3d.geometry.getAttribute('position').count).toBe(24);

    const solidGeometry = mesh.object3d.geometry;
    mesh.update(EMPTY_MESH_DATA);
    expect(mesh.object3d.visible).toBe(false);
    expect(mesh.object3d.geometry).not.toBe(solidGeometry);

    mesh.dispose();
    material.dispose();
  });

  it('disposes the geometry it replaces', () => {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new ChunkMesh(material);
    const dispose = vi.spyOn(mesh.object3d.geometry, 'dispose');

    mesh.update(oneBlockMeshData());

    expect(dispose).toHaveBeenCalledTimes(1);

    mesh.dispose();
    material.dispose();
  });
});
