import * as THREE from 'three';

import { config } from '../config/Config';
import type { World } from '../world/World';
import type { BlockSampler } from './ChunkMeshBuilder';
import { ChunkMeshManager } from './ChunkMeshManager';

/**
 * Owns every Three.js object and keeps the renderer confined to the
 * rendering layer. Callers only ever see `render()`, `flushDirtyChunks()`,
 * and `dispose()`; the scene, camera, lights, and meshes never leak into
 * domain code.
 *
 * The renderer never owns block state. It reads chunk geometry through the
 * `World` via the mesh manager, which consumes the world's dirty flags.
 */
export class WorldRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly resizeObserver: ResizeObserver;
  private readonly chunkMeshes: ChunkMeshManager;

  constructor(canvas: HTMLCanvasElement, world: World, blockAt: BlockSampler) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, config.maxPixelRatio));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(config.skyColor);

    this.camera = new THREE.PerspectiveCamera(
      config.camera.fovDegrees,
      1,
      config.camera.near,
      config.camera.far,
    );
    this.frameWorld(world);

    this.chunkMeshes = new ChunkMeshManager(world, blockAt);
    this.scene.add(this.chunkMeshes.group);
    this.addLights();

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();
  }

  /**
   * Build geometry for the world's dirty chunks, at most `budget` this call.
   * Returns the number rebuilt; leftover chunks stay dirty for the next frame.
   */
  flushDirtyChunks(budget: number): number {
    return this.chunkMeshes.flushDirty(budget);
  }

  /**
   * Match the drawing buffer and camera aspect to the canvas's CSS size.
   * Uses the element's own CSS dimensions so the view never distorts.
   */
  resize(): void {
    const width = Math.max(1, this.renderer.domElement.clientWidth);
    const height = Math.max(1, this.renderer.domElement.clientHeight);

    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.chunkMeshes.dispose();
    this.renderer.dispose();
  }

  /**
   * A vantage point derived from the world's own dimensions, so the terrain
   * is visible whatever size the world is. Later systems that drive the
   * camera each frame simply replace this initial framing.
   */
  private frameWorld(world: World): void {
    const center = new THREE.Vector3(world.size.x / 2, world.size.y * 0.4, world.size.z / 2);
    const radius = Math.max(world.size.x, world.size.z) * 0.9;
    this.camera.position.set(center.x - radius, world.size.y * 0.55, center.z + radius);
    this.camera.lookAt(center);
  }

  /** Fill light plus a sun, so faces differ in brightness and edges read. */
  private addLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, config.rendering.ambientLightIntensity);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(
      0xffffff,
      config.rendering.directionalLightIntensity,
    );
    const { x, y, z } = config.rendering.sunDirection;
    sun.position.set(x, y, z);
    this.scene.add(sun);
  }
}
