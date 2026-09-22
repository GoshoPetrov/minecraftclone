/**
 * Central tuning configuration for the game.
 *
 * Gameplay and rendering systems read their constants from here so that
 * tuning does not require hunting through unrelated modules. Values are
 * plain data and must not depend on Three.js or the DOM.
 */
import { BlockIds } from '../world/Block';

export const config = {
  /** Background colour used for the sky, as a 24-bit RGB integer. */
  skyColor: 0x87ceeb,

  /**
   * Upper bound applied to a single frame's delta time, in seconds.
   * Protects physics and camera motion from hitches and tab-switches.
   */
  maxFrameDeltaSeconds: 0.05,

  camera: {
    fovDegrees: 75,
    near: 0.1,
    far: 1000,
    /** Camera height above the player's feet, in blocks. */
    eyeHeight: 1.62,
    /**
     * Camera height above the feet while crouching, in blocks. Lower than
     * `eyeHeight` so the view drops with the crouched body; it must stay
     * below `player.crouchHeight` so the eye never leaves the collision box.
     */
    crouchEyeHeight: 1.2,
    /** Look sensitivity, in radians of rotation per pixel of mouse motion. */
    lookSensitivity: 0.0022,
    /**
     * Maximum upward or downward pitch, in radians. Just short of vertical so
     * the view can never flip over the top or bottom.
     */
    maxPitchRadians: Math.PI / 2 - 0.01,
    /**
     * Field-of-view multiplier applied as the target while the movement label
     * is `sprinting`. Below 1 would narrow the view; this widens it.
     */
    sprintFovMultiplier: 1.15,
    /**
     * Time constant, in seconds, for the camera's exponential approach to its
     * target field of view. Larger values ease more slowly.
     */
    fovTransitionSeconds: 0.2,
  },

  /**
   * Player physics constants. Movement, gravity, jumping, and the collision
   * box all read from here, so tuning the feel of the player never requires
   * editing the physics implementation.
   */
  player: {
    /**
     * Full health in hit points. Shown as `maxHealth / 2` hearts of 2 HP
     * each, so it must be a positive even number.
     */
    maxHealth: 20,
    /**
     * Whole blocks a fall can cover without dealing damage. A fall of exactly
     * this distance is safe; any drop past it costs at least one hit point.
     */
    safeFallDistance: 3,
    /** Hit points lost per whole block fallen beyond `safeFallDistance`. */
    fallDamagePerBlock: 1,
    /**
     * Feet height below which the avatar is in the void. It sits below the
     * world floor so the avatar visibly falls out of the world before the
     * first tick, and applies everywhere the world is air at every height
     * (notably past the horizontal edge).
     */
    voidY: -8,
    /** Hit points removed by each void damage tick. */
    voidDamage: 4,
    /**
     * Seconds between void damage ticks after the immediate first tick. The
     * first tick lands on the frame the avatar crosses `voidY`, then a carried
     * timer consumes this interval per tick.
     */
    voidDamageIntervalSeconds: 0.5,
    /** Collision box width, used for both the x and z axes, in blocks. */
    width: 0.6,
    /** Collision box height, from the feet upwards, in blocks. */
    height: 1.8,
    /**
     * Collision box height while crouching, from the feet upwards, in blocks.
     * Lower than `height` and higher than `camera.crouchEyeHeight`.
     */
    crouchHeight: 1.5,
    /** Horizontal movement speed in blocks per second. */
    moveSpeed: 4.317,
    /**
     * Horizontal speed multiplier while sprinting is held and the player is
     * moving, applied on top of `moveSpeed` and in any horizontal direction.
     */
    sprintSpeedMultiplier: 1.3,
    /**
     * Horizontal speed multiplier while crouching, applied on top of
     * `moveSpeed`. The two multipliers compose as a product rather than one
     * replacing the other, so crouch-sprinting is `0.3 × 1.3 = 0.39` of a
     * walk: crouch wins for speed, sprint still counts for a little, and the
     * crouch multiplier is never ignored when sprint is also held. This is
     * deliberate — do not "simplify" it to a single multiplier.
     */
    crouchSpeedMultiplier: 0.3,
    /** Downward acceleration in blocks per second squared. */
    gravity: 28,
    /** Upward velocity applied by a jump, in blocks per second. */
    jumpVelocity: 8.5,
    /**
     * Terminal falling speed in blocks per second. Bounds how far a single
     * sub-step can move, so a very long fall cannot outrun collision checks.
     */
    maxFallSpeed: 60,
    /**
     * Longest simulation slice for one physics sub-step, in seconds. A frame
     * is split into slices no longer than this so a large delta cannot move
     * the player through a block in one jump.
     */
    physicsStepSeconds: 0.005,
    /** Whole air blocks required above the feet for a spawn to be valid. */
    spawnHeadroomBlocks: 2,
  },

  /**
   * Block interaction tuning. The reach and, later, the default block to
   * place live here so targeting and editing share one source of truth.
   */
  interaction: {
    /**
     * Maximum distance from the camera eye to a targeted block, in blocks.
     * A ray stops here, so blocks beyond this reach cannot be targeted or
     * edited.
     */
    range: 5,
    /**
     * The block type placed by a right click. v1 has no inventory or block
     * selection, so this one configured type is the only placeable block.
     */
    defaultPlaceableBlock: BlockIds.basic,
  },

  /**
   * Physical key codes (`KeyboardEvent.code`) bound to game actions. Binding
   * by physical position keeps controls usable on non-QWERTY layouts.
   */
  input: {
    bindings: {
      forward: 'KeyW',
      backward: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      jump: 'Space',
      sprint: 'ShiftLeft',
      crouch: 'KeyC',
      debug: 'KeyL',
    },
  },

  /**
   * Rendering tuning: how much geometry is uploaded per frame and how the
   * scene is lit. Kept here so visual tuning never reaches into a system.
   */
  rendering: {
    /**
     * Maximum number of dirty chunk meshes rebuilt in one frame. A burst of
     * block edits is spread over several frames instead of stalling one.
     */
    chunkRebuildBudgetPerFrame: 2,
    /** Strength of the uniform fill light, so no face is ever black. */
    ambientLightIntensity: 0.65,
    /**
     * Strength of the sun. Directional shading is what makes the edges of
     * same-coloured cubes readable against each other.
     */
    directionalLightIntensity: 1.1,
    /** World-space direction the sunlight arrives from. */
    sunDirection: { x: 0.6, y: 1, z: 0.4 },
  },

  /** Cap on the device pixel ratio used for the drawing buffer. */
  maxPixelRatio: 2,

  /**
   * World persistence tuning. The schema version lives with the save shape in
   * `persistence/SaveData`; only runtime cadence is configured here.
   */
  persistence: {
    /**
     * How long an edit waits before it is written, in milliseconds. Rapid
     * edits within this window collapse into a single save.
     */
    saveDebounceMs: 500,
  },

  /**
   * World extent in chunks. This is the single place the world size is
   * declared; every system receives it from the `World` rather than
   * hard-coding a size.
   */
  world: {
    sizeInChunks: { x: 8, y: 1, z: 8 },
  },

  /**
   * Deterministic terrain parameters. Together with the world dimensions
   * these are the only inputs to world generation, so a stored seed plus
   * version reconstructs the same terrain.
   */
  generation: {
    seed: 1337,
    generatorVersion: 1,
    baseSurfaceHeight: 24,
    amplitude: 3,
    bedrockLayers: 1,
    featureSize: 8,
  },
} as const;
