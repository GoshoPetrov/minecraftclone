import { config } from '../config/Config';
import type { PlayerIntent, Vec3 } from './Player';

/** Buttons the player is holding, in intent space rather than key codes. */
export interface MovementInput {
  readonly forward: boolean;
  readonly backward: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly jump: boolean;
  readonly sprint: boolean;
}

/** Relative mouse motion for one frame, in pixels. */
export interface LookDelta {
  readonly dx: number;
  readonly dy: number;
}

/** The camera's horizontal and vertical angles, in radians. */
export interface CameraOrientation {
  readonly yaw: number;
  readonly pitch: number;
}

/** A movement input with nothing held. */
export function idleMovementInput(): MovementInput {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
  };
}

/**
 * Turns raw input into camera orientation and a world-space movement intent.
 *
 * It owns yaw and pitch only: `yaw` is unbounded and wrapped into `(-π, π]`
 * so it never drifts, while `pitch` is clamped to keep the camera short of
 * vertical. Movement is rotated by yaw so W always walks where the player
 * faces, and the result is handed to the renderer-independent physics step.
 */
export class PlayerController {
  private yaw = 0;
  private pitch = 0;

  /** The current camera angles. */
  get orientation(): CameraOrientation {
    return { yaw: this.yaw, pitch: this.pitch };
  }

  /**
   * The unit vector the camera looks along, derived from yaw and pitch the
   * same way `PlayerCamera` orients the view. Raycasting and any other system
   * that needs the aim direction read it here rather than recomputing the
   * trigonometry independently.
   */
  get lookDirection(): Vec3 {
    const cosPitch = Math.cos(this.pitch);
    return {
      x: -Math.sin(this.yaw) * cosPitch,
      y: Math.sin(this.pitch),
      z: -Math.cos(this.yaw) * cosPitch,
    };
  }

  /**
   * Rotate the view by one frame's accumulated mouse motion. Horizontal
   * motion is unbounded; vertical motion is clamped to the configured range.
   * Non-finite input is ignored so a bad event cannot poison the angles.
   */
  applyLook(delta: LookDelta): void {
    const dx = Number.isFinite(delta.dx) ? delta.dx : 0;
    const dy = Number.isFinite(delta.dy) ? delta.dy : 0;
    const sensitivity = config.camera.lookSensitivity;

    // Moving the mouse right turns the view right, which is a negative
    // rotation about the Y axis in the camera's coordinate frame.
    this.yaw = wrapAngle(this.yaw - dx * sensitivity);
    this.pitch = clampPitch(this.pitch - dy * sensitivity);
  }

  /** Build the physics intent for this frame's held buttons. */
  intent(input: MovementInput): PlayerIntent {
    const forwardAmount = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
    const strafeAmount = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    // At yaw 0 the camera looks down -Z and its right is +X.
    return {
      move: {
        x: -sinYaw * forwardAmount + cosYaw * strafeAmount,
        z: -cosYaw * forwardAmount - sinYaw * strafeAmount,
      },
      jump: input.jump,
      sprint: input.sprint,
    };
  }
}

/** Wrap an angle into `(-π, π]`; a full turn is invisible to the camera. */
function wrapAngle(angle: number): number {
  if (!Number.isFinite(angle)) {
    return 0;
  }
  const wrapped = angle % (Math.PI * 2);
  if (wrapped > Math.PI) {
    return wrapped - Math.PI * 2;
  }
  if (wrapped <= -Math.PI) {
    return wrapped + Math.PI * 2;
  }
  return wrapped;
}

function clampPitch(pitch: number): number {
  const limit = config.camera.maxPitchRadians;
  return Math.min(Math.max(pitch, -limit), limit);
}
