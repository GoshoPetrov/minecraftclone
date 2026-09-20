import * as THREE from 'three';

import { config } from '../config/Config';
import type { World } from '../world/World';
import type { Vec3 } from '../player/Player';
import type { BlockSampler } from './ChunkMeshBuilder';
import { ChunkMeshManager } from './ChunkMeshManager';
import { PlayerCamera } from './PlayerCamera';

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
  private readonly playerCamera: PlayerCamera;
  private readonly resizeObserver: ResizeObserver;
  private readonly chunkMeshes: ChunkMeshManager;

  constructor(canvas: HTMLCanvasElement, world: World, blockAt: BlockSampler) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, config.maxPixelRatio));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(config.skyColor);

    this.playerCamera = new PlayerCamera();

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
   * Follow the player at eye height, pointing along yaw/pitch. Called once
   * per frame after physics so the view matches the simulated body.
   */
  setCameraPose(feetPosition: Vec3, yaw: number, pitch: number): void {
    this.playerCamera.setPose(feetPosition, yaw, pitch);
  }

  /**
   * Match the drawing buffer and camera aspect to the canvas's CSS size.
   * Uses the element's own CSS dimensions so the view never distorts.
   */
  resize(): void {
    const width = Math.max(1, this.renderer.domElement.clientWidth);
    const height = Math.max(1, this.renderer.domElement.clientHeight);

    this.renderer.setSize(width, height, false);
    this.playerCamera.setAspect(width / height);
  }

  render(): void {
    this.renderer.render(this.scene, this.playerCamera.camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.chunkMeshes.dispose();
    this.renderer.dispose();
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
