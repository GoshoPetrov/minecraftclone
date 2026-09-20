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
