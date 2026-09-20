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
 * physics or the player's collision box.
 */
export class PlayerCamera {
  readonly camera: THREE.PerspectiveCamera;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      config.camera.fovDegrees,
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
}
