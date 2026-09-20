/**
 * Visual material descriptors for block types.
 *
 * A material is a tagged union rather than a raw colour or texture handle.
 * Chunk block data stores only block ids, so a future `atlas` variant can be
 * added without changing how blocks are stored or how the world is queried.
 */

/** A flat, per-type RGB colour. */
export interface ColorBlockMaterial {
  readonly kind: 'color';
  /** 24-bit RGB integer (`0xRRGGBB`). */
  readonly color: number;
}

/** A single face's UV rectangle within a texture atlas, in `[0, 1]` space. */
export interface AtlasFaceUvs {
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

/**
 * A texture-atlas material. No v1 block uses it, but it is declared so the
 * material union is open to atlas rendering without touching block data.
 */
export interface AtlasBlockMaterial {
  readonly kind: 'atlas';
  readonly faceUvs: readonly AtlasFaceUvs[];
}

export type BlockMaterial = ColorBlockMaterial | AtlasBlockMaterial;

/**
 * The complete, immutable definition of a block type. Behaviour such as
 * solidity, breakability, and placeability is declared as data here rather
 * than hard-coded at the call sites of physics, raycasting, and interaction.
 */
export interface BlockType {
  readonly id: number;
  readonly name: string;
  readonly solid: boolean;
  readonly breakable: boolean;
  readonly placeable: boolean;
  readonly material: BlockMaterial;
}
