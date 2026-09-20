import * as THREE from 'three';

import type { ChunkMeshData } from './ChunkMeshBuilder';

/** Geometry with no vertices, used until a chunk's first real build. */
const EMPTY_MESH_DATA: ChunkMeshData = {
  positions: new Float32Array(0),
  normals: new Float32Array(0),
  colors: new Float32Array(0),
  indices: new Uint32Array(0),
};

/**
 * Turn renderer-independent chunk geometry into a Three.js `BufferGeometry`.
 *
 * This is the seam where plain typed arrays become GPU attributes. Block
 * colours are authored as sRGB integers, but Three.js works in linear space,
 * so they are converted here rather than in the renderer-independent mesh
 * builder: colour space is purely a rendering concern.
 */
export function createChunkGeometry(data: ChunkMeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(toLinearRgb(data.colors), 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Owns the single Three.js mesh for one chunk and keeps its geometry in sync
 * with the latest `ChunkMeshData`. One instance exists per chunk coordinate,
 * never per block, and the same object is reused across rebuilds.
 */
export class ChunkMesh {
  readonly object3d: THREE.Mesh;

  constructor(material: THREE.Material) {
    this.object3d = new THREE.Mesh(createChunkGeometry(EMPTY_MESH_DATA), material);
    this.object3d.visible = false;
  }

  /** Replace the mesh's geometry; the mesh object and material are kept. */
  update(data: ChunkMeshData): void {
    const previous = this.object3d.geometry;
    this.object3d.geometry = createChunkGeometry(data);
    previous.dispose();
    this.object3d.visible = data.indices.length > 0;
  }

  dispose(): void {
    this.object3d.geometry.dispose();
  }
}

/** Copy sRGB `[0, 1]` channels into Three.js' linear working colour space. */
function toLinearRgb(srgb: Float32Array): Float32Array {
  const linear = new Float32Array(srgb.length);
  const color = new THREE.Color();
  for (let i = 0; i < srgb.length; i += 3) {
    color.setRGB(srgb[i] ?? 0, srgb[i + 1] ?? 0, srgb[i + 2] ?? 0, THREE.SRGBColorSpace);
    linear[i] = color.r;
    linear[i + 1] = color.g;
    linear[i + 2] = color.b;
  }
  return linear;
}
