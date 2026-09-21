import { config } from '../config/Config';

/**
 * Renderer-independent player state.
 *
 * The player is an axis-aligned box moving through the voxel grid. `position`
 * is the centre of the player's feet: the box is centred horizontally on
 * `x`/`z` and spans `[y, y + height]` vertically. Nothing here references
 * Three.js or a camera, so physics can be simulated and tested headlessly.
 */

/** A 3D vector in world block units. */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Coarse description of what the player is doing after a step. It is derived
 * state for animation and UI; `grounded` carries the physical truth.
 */
export type PlayerMovementState =
  | 'idle'
  | 'walking'
  | 'sprinting'
  | 'sneaking'
  | 'airborne';

/** The complete simulation state that `step` reads and produces. */
export interface PlayerState {
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly grounded: boolean;
  readonly crouching: boolean;
  readonly movement: PlayerMovementState;
}

/**
 * What the player is trying to do for one step.
 *
 * `move` is a world-space horizontal wish direction. The controller rotates
 * raw input by the camera yaw before handing it to physics, keeping the
 * simulation free of facing and camera state.
 */
export interface PlayerIntent {
  readonly move: { readonly x: number; readonly z: number };
  readonly jump: boolean;
  readonly sprint: boolean;
  readonly crouch: boolean;
}

/** An intent that neither moves, jumps, sprints, nor crouches. */
export function idleIntent(): PlayerIntent {
  return { move: { x: 0, z: 0 }, jump: false, sprint: false, crouch: false };
}

/** A player at rest at the given feet position. */
export function createPlayerState(position: Vec3): PlayerState {
  return {
    position: { ...position },
    velocity: { x: 0, y: 0, z: 0 },
    grounded: false,
    crouching: false,
    movement: 'airborne',
  };
}

/** Axis-aligned bounds of a player, in world block units. */
export interface Aabb {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}

/**
 * The collision bounds of a player at `position`, derived from the configured
 * dimensions rather than stored, so bounds can never drift from the position.
 * A crouching player is shorter but exactly as wide; the box always spans
 * from the feet upward.
 */
export function playerAabb(position: Vec3, crouching = false): Aabb {
  const halfWidth = config.player.width / 2;
  const height = crouching ? config.player.crouchHeight : config.player.height;
  return {
    minX: position.x - halfWidth,
    minY: position.y,
    minZ: position.z - halfWidth,
    maxX: position.x + halfWidth,
    maxY: position.y + height,
    maxZ: position.z + halfWidth,
  };
}

/**
 * The camera eye height above the feet for a given crouch state. Camera pose
 * and raycast origin both read this so the view and the aim never diverge.
 */
export function eyeHeightFor(crouching: boolean): number {
  return crouching ? config.camera.crouchEyeHeight : config.camera.eyeHeight;
}
