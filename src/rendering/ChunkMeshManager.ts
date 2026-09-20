import * as THREE from 'three';

import { chunkKey, type Chunk, type ChunkCoord } from '../world/Chunk';
import type { World } from '../world/World';
import { buildChunkMesh, type BlockSampler } from './ChunkMeshBuilder';
import { ChunkMesh } from './ChunkMesh';

/**
 * Keeps exactly one mesh per chunk and rebuilds only the chunks the world
 * reports as dirty, up to a per-flush budget.
 *
 * The manager never decides what changed. It reads `world.dirtyChunks()` and
 * clears each chunk's flag once its geometry is rebuilt, so the world stays
 * the single authority on which geometry is stale and on which blocks exist.
 */
export class ChunkMeshManager {
  /** Scene node every chunk mesh is attached to. */
  readonly group: THREE.Group;

  private readonly material: THREE.MeshLambertMaterial;
  private readonly meshes = new Map<string, ChunkMesh>();

  constructor(
    private readonly world: World,
    private readonly blockAt: BlockSampler,
  ) {
    // One material shared by every chunk: per-type colour travels in the
    // geometry's vertex colours, so chunks do not each need their own.
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.group = new THREE.Group();
    this.group.name = 'chunk-meshes';
  }

  /** Number of chunk meshes owned; never more than one per chunk. */
  get meshCount(): number {
    return this.meshes.size;
  }

  /** The mesh for a chunk coordinate, or `undefined` if it has none yet. */
  getMesh(coord: ChunkCoord): ChunkMesh | undefined {
    return this.meshes.get(chunkKey(coord));
  }

  /** Whether a chunk already has a mesh object. */
  hasMesh(coord: ChunkCoord): boolean {
    return this.meshes.has(chunkKey(coord));
  }

  /**
   * Rebuild up to `budget` of the world's dirty chunks, clearing each chunk's
   * dirty flag as it is consumed. Returns how many chunks were rebuilt, so a
   * caller can tell whether more work remains for the next frame.
   */
  flushDirty(budget: number): number {
    if (!Number.isInteger(budget) || budget < 1) {
      return 0;
    }

    let rebuilt = 0;
    for (const chunk of this.world.dirtyChunks()) {
      if (rebuilt >= budget) {
        break;
      }
      this.rebuild(chunk);
      this.world.clearChunkDirty(chunk.coord);
      rebuilt += 1;
    }
    return rebuilt;
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      mesh.dispose();
    }
    this.meshes.clear();
    this.material.dispose();
    this.group.clear();
  }

  private rebuild(chunk: Chunk): void {
    const key = chunkKey(chunk.coord);
    let mesh = this.meshes.get(key);
    if (mesh === undefined) {
      mesh = new ChunkMesh(this.material);
      this.meshes.set(key, mesh);
      this.group.add(mesh.object3d);
    }
    mesh.update(buildChunkMesh(chunk, this.blockAt));
  }
}
