import { AIR, defaultBlockTypes } from './Block';
import type { BlockType } from './BlockType';

/**
 * Single source of truth for block id → type lookups.
 *
 * Lookups are total: an unknown id deterministically resolves to air instead
 * of throwing, so physics, raycasting, and interaction never have to
 * special-case bad data. Callers that must detect an unknown id (for example
 * save validation) use `has` or `tryGet`.
 */
export class BlockRegistry {
  private readonly byId: ReadonlyMap<number, BlockType>;
  private readonly byName: ReadonlyMap<string, BlockType>;

  constructor(types: readonly BlockType[]) {
    const byId = new Map<number, BlockType>();
    const byName = new Map<string, BlockType>();
    for (const type of types) {
      if (byId.has(type.id)) {
        throw new Error(`Duplicate block id ${type.id} for "${type.name}".`);
      }
      if (byName.has(type.name)) {
        throw new Error(`Duplicate block name "${type.name}".`);
      }
      byId.set(type.id, type);
      byName.set(type.name, type);
    }
    this.byId = byId;
    this.byName = byName;
  }

  /** The registered block types, in registration order. */
  get types(): readonly BlockType[] {
    return [...this.byId.values()];
  }

  /** Resolve `id`, falling back to air for any value that is not registered. */
  get(id: number): BlockType {
    return this.byId.get(id) ?? AIR;
  }

  /** Resolve `id`, returning `undefined` when it is not registered. */
  tryGet(id: number): BlockType | undefined {
    return this.byId.get(id);
  }

  /** Whether `id` is a registered block type. */
  has(id: number): boolean {
    return this.byId.has(id);
  }

  /** Resolve a block type by its unique name. */
  getByName(name: string): BlockType | undefined {
    return this.byName.get(name);
  }

  /** Whether the block with `id` stops movement (unknown ids are not solid). */
  isSolid(id: number): boolean {
    return this.get(id).solid;
  }

  /** Whether the block with `id` can be broken (unknown ids cannot). */
  isBreakable(id: number): boolean {
    return this.get(id).breakable;
  }
}

/** Build the registry for the v1 block set (air, basic_block, bedrock). */
export function createDefaultBlockRegistry(): BlockRegistry {
  return new BlockRegistry(defaultBlockTypes);
}
