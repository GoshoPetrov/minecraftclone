import { describe, expect, it } from 'vitest';

import { raycastBlock } from '../interaction/BlockRaycaster';
import { BlockIds } from '../world/Block';
import { createDefaultBlockRegistry } from '../world/BlockRegistry';
import { World } from '../world/World';
import type { Vec3 } from '../player/Player';

const registry = createDefaultBlockRegistry();

function createWorld(): World {
  return new World({ sizeInChunks: { x: 2, y: 1, z: 2 } }, registry);
}

function place(world: World, x: number, y: number, z: number, id: number = BlockIds.basic): void {
  expect(world.setBlock(x, y, z, id)).toBe(true);
}

function direction(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

describe('raycastBlock axis-aligned hits', () => {
  const origin: Vec3 = { x: 8.5, y: 10.5, z: 8.5 };

  const cases: readonly {
    readonly name: string;
    readonly block: Vec3;
    readonly dir: Vec3;
    readonly normal: Vec3;
    readonly distance: number;
  }[] = [
    { name: '+X faces -X', block: { x: 10, y: 10, z: 8 }, dir: direction(1, 0, 0), normal: { x: -1, y: 0, z: 0 }, distance: 1.5 },
    { name: '-X faces +X', block: { x: 5, y: 10, z: 8 }, dir: direction(-1, 0, 0), normal: { x: 1, y: 0, z: 0 }, distance: 2.5 },
    { name: '+Y faces -Y', block: { x: 8, y: 13, z: 8 }, dir: direction(0, 1, 0), normal: { x: 0, y: -1, z: 0 }, distance: 2.5 },
    { name: '-Y faces +Y', block: { x: 8, y: 7, z: 8 }, dir: direction(0, -1, 0), normal: { x: 0, y: 1, z: 0 }, distance: 2.5 },
    { name: '+Z faces -Z', block: { x: 8, y: 10, z: 12 }, dir: direction(0, 0, 1), normal: { x: 0, y: 0, z: -1 }, distance: 3.5 },
    { name: '-Z faces +Z', block: { x: 8, y: 10, z: 4 }, dir: direction(0, 0, -1), normal: { x: 0, y: 0, z: 1 }, distance: 3.5 },
  ];

  for (const testCase of cases) {
    it(`reports the ${testCase.name}`, () => {
      const world = createWorld();
      place(world, testCase.block.x, testCase.block.y, testCase.block.z);

      const hit = raycastBlock(world, origin, testCase.dir, 10);

      expect(hit).not.toBeNull();
      expect(hit?.blockPos).toEqual(testCase.block);
      expect(hit?.faceNormal).toEqual(testCase.normal);
      expect(hit?.distance).toBeCloseTo(testCase.distance, 9);
    });
  }

  it('does not depend on the direction being unit length', () => {
    const world = createWorld();
    place(world, 5, 10, 8);

    const hit = raycastBlock(world, origin, direction(-10, 0, 0), 10);

    expect(hit?.blockPos).toEqual({ x: 5, y: 10, z: 8 });
    expect(hit?.distance).toBeCloseTo(2.5, 9);
  });
});

describe('raycastBlock nearest block', () => {
  it('returns the first block along the ray', () => {
    const world = createWorld();
    place(world, 5, 10, 8);
    place(world, 7, 10, 8);

    const hit = raycastBlock(world, { x: 8.5, y: 10.5, z: 8.5 }, direction(-1, 0, 0), 10);

    expect(hit?.blockPos).toEqual({ x: 7, y: 10, z: 8 });
    expect(hit?.faceNormal).toEqual({ x: 1, y: 0, z: 0 });
    expect(hit?.distance).toBeCloseTo(0.5, 9);
  });

  it('stops at the first non-air block when several are in line', () => {
    const world = createWorld();
    place(world, 6, 10, 8, BlockIds.basic);
    place(world, 4, 10, 8, BlockIds.bedrock);

    const hit = raycastBlock(world, { x: 8.5, y: 10.5, z: 8.5 }, direction(-1, 0, 0), 10);

    expect(hit?.blockPos).toEqual({ x: 6, y: 10, z: 8 });
    expect(hit?.distance).toBeCloseTo(1.5, 9);
  });
});

describe('raycastBlock range', () => {
  it('includes a block exactly at the range and rejects just past it', () => {
    const world = createWorld();
    place(world, 5, 0, 0);
    const origin: Vec3 = { x: 0, y: 0.5, z: 0.5 };

    const atRange = raycastBlock(world, origin, direction(1, 0, 0), 5);
    expect(atRange?.blockPos).toEqual({ x: 5, y: 0, z: 0 });
    expect(atRange?.distance).toBeCloseTo(5, 9);

    expect(raycastBlock(world, origin, direction(1, 0, 0), 4.9)).toBeNull();
    expect(raycastBlock(world, origin, direction(1, 0, 0), 5.1)).not.toBeNull();
  });
});

describe('raycastBlock misses', () => {
  it('returns null when the ray only crosses air', () => {
    const world = createWorld();

    const hit = raycastBlock(world, { x: 8.5, y: 10.5, z: 8.5 }, direction(1, 0, 0), 5);

    expect(hit).toBeNull();
  });

  it('returns null when the ray leaves the world without hitting a block', () => {
    const world = createWorld();

    const hit = raycastBlock(world, { x: 31.5, y: 10.5, z: 8.5 }, direction(1, 0, 0), 5);

    expect(hit).toBeNull();
  });

  it('returns null for a zero or non-finite direction and non-positive range', () => {
    const world = createWorld();
    const origin: Vec3 = { x: 8.5, y: 10.5, z: 8.5 };

    expect(raycastBlock(world, origin, direction(0, 0, 0), 5)).toBeNull();
    expect(raycastBlock(world, origin, direction(Number.NaN, 0, 0), 5)).toBeNull();
    expect(raycastBlock(world, origin, direction(1, 0, 0), 0)).toBeNull();
    expect(raycastBlock(world, origin, direction(1, 0, 0), -1)).toBeNull();
  });
});

describe('raycastBlock bedrock', () => {
  it('hits unbreakable bedrock like any other non-air block', () => {
    const world = createWorld();
    place(world, 5, 10, 8, BlockIds.bedrock);

    const hit = raycastBlock(world, { x: 8.5, y: 10.5, z: 8.5 }, direction(-1, 0, 0), 10);

    expect(hit?.blockPos).toEqual({ x: 5, y: 10, z: 8 });
    expect(hit?.faceNormal).toEqual({ x: 1, y: 0, z: 0 });
    expect(hit?.distance).toBeCloseTo(2.5, 9);
  });
});
