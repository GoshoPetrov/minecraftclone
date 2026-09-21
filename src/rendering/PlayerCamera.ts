import * as THREE from 'three';

import { config } from '../config/Config';
import type { Vec3 } from '../player/Player';

/**
 * The first-person camera. It is a thin Three.js adapter: players and
 * rendering code hand it a feet position and yaw/pitch, and it places the
 * camera at eye height with a `YXZ` rotation so yaw is applied before pitch
 * and the horizon never rolls.
 *
 * Eye height comes from config, so the camera can be retuned without touching
 * physics or the player's collision box. It also owns the field-of-view
 * easing toward an explicit target, keeping that visual smoothing out of
 * gameplay logic.
 */
export class PlayerCamera {
  readonly camera: THREE.PerspectiveCamera;

  private currentFov: number = config.camera.fovDegrees;
  private targetFov: number = config.camera.fovDegrees;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      this.currentFov,
      1,
      config.camera.near,
      config.camera.far,
    );
    this.camera.rotation.order = 'YXZ';
  }

  /** Match the projection to a viewport aspect ratio. */
  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Place the camera above the player's feet and point it along yaw/pitch. */
  setPose(feetPosition: Vec3, yaw: number, pitch: number): void {
    this.camera.position.set(
      feetPosition.x,
      feetPosition.y + config.camera.eyeHeight,
      feetPosition.z,
    );
    this.camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  /**
   * Set the field of view the camera eases toward. Only projection changes;
   * the camera's orientation (and therefore the aim direction) is untouched.
   */
  setTargetFov(fovDegrees: number): void {
    if (Number.isFinite(fovDegrees) && fovDegrees > 0) {
      this.targetFov = fovDegrees;
    }
  }

  /**
   * Ease the rendered field of view toward the target with a frame-rate
   * independent exponential approach over `fovTransitionSeconds`. The blend
   * factor is bounded to `[0, 1]`, so a long frame cannot overshoot.
   */
  easeFov(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return;
    }
    const blend = 1 - Math.exp(-deltaSeconds / config.camera.fovTransitionSeconds);
    const boundedBlend = Math.min(1, Math.max(0, blend));
    this.currentFov += (this.targetFov - this.currentFov) * boundedBlend;
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();
  }
}
