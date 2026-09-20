import { describe, expect, it } from 'vitest';

import { AIR, BASIC_BLOCK, BEDROCK, BlockIds } from '../world/Block';
import { BlockRegistry, createDefaultBlockRegistry } from '../world/BlockRegistry';
import type { BlockType } from '../world/BlockType';

describe('BlockRegistry', () => {
  it('resolves every default id to its declared type', () => {
    const registry = createDefaultBlockRegistry();

    expect(registry.get(BlockIds.air)).toBe(AIR);
    expect(registry.get(BlockIds.basic)).toBe(BASIC_BLOCK);
    expect(registry.get(BlockIds.bedrock)).toBe(BEDROCK);
  });

  it('keeps numeric ids stable', () => {
    expect(BlockIds.air).toBe(0);
    expect(BlockIds.basic).toBe(1);
    expect(BlockIds.bedrock).toBe(2);
  });

  it('treats air as a real, non-solid, unbreakable type', () => {
    const air = createDefaultBlockRegistry().get(BlockIds.air);

    expect(air).toBe(AIR);
    expect(air.solid).toBe(false);
    expect(air.breakable).toBe(false);
  });

  it('treats basic_block as solid and breakable', () => {
    const basic = createDefaultBlockRegistry().get(BlockIds.basic);

    expect(basic.name).toBe('basic_block');
    expect(basic.solid).toBe(true);
    expect(basic.breakable).toBe(true);
  });

  it('treats bedrock as solid and unbreakable', () => {
    const bedrock = createDefaultBlockRegistry().get(BlockIds.bedrock);

    expect(bedrock.name).toBe('bedrock');
    expect(bedrock.solid).toBe(true);
    expect(bedrock.breakable).toBe(false);
  });

  it('resolves unknown ids to air without throwing', () => {
    const registry = createDefaultBlockRegistry();

    for (const id of [-1, 3, 255, Number.NaN]) {
      expect(() => registry.get(id)).not.toThrow();
      expect(registry.get(id)).toBe(AIR);
      expect(registry.get(id).solid).toBe(false);
      expect(registry.has(id)).toBe(false);
      expect(registry.tryGet(id)).toBeUndefined();
    }
  });

  it('reports registered ids and names', () => {
    const registry = createDefaultBlockRegistry();

    expect(registry.has(BlockIds.basic)).toBe(true);
    expect(registry.tryGet(BlockIds.basic)).toBe(BASIC_BLOCK);
    expect(registry.getByName('basic_block')).toBe(BASIC_BLOCK);
    expect(registry.getByName('missing')).toBeUndefined();
  });

  it('exposes solidity and breakability queries backed by the same data', () => {
    const registry = createDefaultBlockRegistry();

    expect(registry.isSolid(BlockIds.air)).toBe(false);
    expect(registry.isSolid(BlockIds.basic)).toBe(true);
    expect(registry.isSolid(BlockIds.bedrock)).toBe(true);
    expect(registry.isSolid(999)).toBe(false);

    expect(registry.isBreakable(BlockIds.basic)).toBe(true);
    expect(registry.isBreakable(BlockIds.bedrock)).toBe(false);
  });

  it('describes materials with a typed, extensible descriptor', () => {
    const material = createDefaultBlockRegistry().get(BlockIds.basic).material;

    expect(material.kind).toBe('color');
    if (material.kind === 'color') {
      expect(material.color).toBeGreaterThanOrEqual(0);
      expect(material.color).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('is data-driven: custom types resolve while unregistered ids fall back to air', () => {
    const glass: BlockType = {
      id: 7,
      name: 'glass',
      solid: true,
      breakable: true,
      material: { kind: 'color', color: 0x88ccff },
    };
    const registry = new BlockRegistry([AIR, glass]);

    expect(registry.get(7)).toBe(glass);
    expect(registry.get(BlockIds.basic)).toBe(AIR);
  });

  it('rejects duplicate ids and names at construction', () => {
    expect(() => new BlockRegistry([AIR, { ...BASIC_BLOCK, id: AIR.id }])).toThrow();
    expect(() => new BlockRegistry([AIR, { ...BASIC_BLOCK, name: AIR.name }])).toThrow();
  });
});
