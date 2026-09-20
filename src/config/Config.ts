/**
 * Central tuning configuration for the game.
 *
 * Gameplay and rendering systems read their constants from here so that
 * tuning does not require hunting through unrelated modules. Values are
 * plain data and must not depend on Three.js or the DOM.
 */
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
    /** Look sensitivity, in radians of rotation per pixel of mouse motion. */
    lookSensitivity: 0.0022,
    /**
     * Maximum upward or downward pitch, in radians. Just short of vertical so
     * the view can never flip over the top or bottom.
     */
    maxPitchRadians: Math.PI / 2 - 0.01,
  },

  /**
   * Player physics constants. Movement, gravity, jumping, and the collision
   * box all read from here, so tuning the feel of the player never requires
   * editing the physics implementation.
   */
  player: {
    /** Collision box width, used for both the x and z axes, in blocks. */
    width: 0.6,
    /** Collision box height, from the feet upwards, in blocks. */
    height: 1.8,
    /** Horizontal movement speed in blocks per second. */
    moveSpeed: 4.317,
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
   * World extent in chunks. This is the single place the world size is
   * declared; every system receives it from the `World` rather than
   * hard-coding a size.
   */
  world: {
    sizeInChunks: { x: 2, y: 1, z: 2 },
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
