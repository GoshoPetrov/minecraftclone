import * as THREE from 'three';

import { config } from '../config/Config';

/**
 * Owns every Three.js object and keeps the renderer confined to the
 * rendering layer. Callers only ever see `render()` and `dispose()`; the
 * scene, camera, and WebGL renderer never leak into domain code.
 */
export class WorldRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement) {
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

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();
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
    this.renderer.dispose();
  }
}
