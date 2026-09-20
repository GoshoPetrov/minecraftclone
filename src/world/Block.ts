import { type BlockMaterial, type BlockType } from './BlockType';

/**
 * Numeric block ids. These values are stored in chunk data, so they are
 * stable: existing ids must never be renumbered, only appended to.
 */
export const BlockIds = {
  air: 0,
  basic: 1,
  bedrock: 2,
} as const;

export type BlockId = (typeof BlockIds)[keyof typeof BlockIds];

function colorMaterial(color: number): BlockMaterial {
  return { kind: 'color', color };
}

/** The explicit "nothing here" type, so queries never return null. */
export const AIR: BlockType = {
  id: BlockIds.air,
  name: 'air',
  solid: false,
  breakable: false,
  placeable: false,
  material: colorMaterial(0x000000),
};

/** The default placeable block: solid and breakable. */
export const BASIC_BLOCK: BlockType = {
  id: BlockIds.basic,
  name: 'basic_block',
  solid: true,
  breakable: true,
  placeable: true,
  material: colorMaterial(0x9e9e9e),
};

/** The world floor: solid but unbreakable. */
export const BEDROCK: BlockType = {
  id: BlockIds.bedrock,
  name: 'bedrock',
  solid: true,
  breakable: false,
  placeable: false,
  material: colorMaterial(0x3c3c3c),
};

/** The v1 block-type definitions in a stable registration order. */
export const defaultBlockTypes: readonly BlockType[] = [AIR, BASIC_BLOCK, BEDROCK];
