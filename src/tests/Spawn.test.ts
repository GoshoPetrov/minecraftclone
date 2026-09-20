import { describe, expect, it } from 'vitest';

import { findSpawn, type SpawnWorld } from '../player/Spawn';

const SIZE = { x: 16, y: 64, z: 16 };

/** A world backed by a predicate, so column layouts can be stated exactly. */
function worldWith(
  solid: (x: number, y: number, z: number) => boolean,
  size = SIZE,
): SpawnWorld {
  return { size, isSolid: solid };
}

/** A flat floor at y = 0 everywhere. */
const flatFloor = (x: number, y: number, z: number): boolean => y === 0 && x >= 0 && z >= 0;

describe('findSpawn', () => {
  it('places the feet on top of the surface and centres them in the cell', () => {
    const spawn = findSpawn(worldWith(flatFloor));

    expect(spawn).toEqual({ x: 8.5, y: 1, z: 8.5 });
  });

  it('never places the player inside a block', () => {
    const world = worldWith(flatFloor);
    const spawn = findSpawn(world);
    const x = Math.floor(spawn.x);
    const z = Math.floor(spawn.z);

    expect(world.isSolid(x, Math.floor(spawn.y), z)).toBe(false);
    expect(world.isSolid(x, Math.floor(spawn.y) + 1, z)).toBe(false);
  });

  it('is deterministic', () => {
    const world = worldWith(flatFloor);

    expect(findSpawn(world)).toEqual(findSpawn(world));
  });

  it('scans outward when the centre column has no headroom', () => {
    // The centre column is solid to the ceiling; every other column has a
    // floor at y = 0 and plenty of air above it.
    const world = worldWith((x, y, z) => {
      if (x === 8 && z === 8) {
        return true;
      }
      return flatFloor(x, y, z);
    });

    const spawn = findSpawn(world);

    expect(Math.floor(spawn.x) !== 8 || Math.floor(spawn.z) !== 8).toBe(true);
    expect(spawn.y).toBe(1);
  });

  it('skips a column that is pure void', () => {
    // Centre column all air, every other column floored.
    const world = worldWith((x, y, z) => !(x === 8 && z === 8) && flatFloor(x, y, z));

    const spawn = findSpawn(world);

    expect(Math.floor(spawn.x) !== 8 || Math.floor(spawn.z) !== 8).toBe(true);
    expect(spawn.y).toBe(1);
  });

  it('requires the full headroom to fit inside the world', () => {
    // Solid tops at y = 62 leave one block below the ceiling, which is not
    // enough for two blocks of headroom; y = 61 does fit.
    const floorAt = (topY: number) => (_x: number, y: number, _z: number) => y === topY;

    expect(() =>
      findSpawn(worldWith(floorAt(SIZE.y - 2), { ...SIZE, x: 1, z: 1 })),
    ).toThrow();
    expect(
      findSpawn(worldWith(floorAt(SIZE.y - 3), { ...SIZE, x: 1, z: 1 })),
    ).toEqual({
      x: 0.5,
      y: SIZE.y - 2,
      z: 0.5,
    });
  });

  it('throws rather than spawn in the void when no column is usable', () => {
    expect(() => findSpawn(worldWith(() => false, { x: 4, y: 4, z: 4 }))).toThrow();
  });

  it('scans a non-square world without leaving its bounds', () => {
    const world = worldWith(flatFloor, { x: 7, y: 32, z: 3 });

    const spawn = findSpawn(world);

    expect(spawn.x).toBeGreaterThanOrEqual(0.5);
    expect(spawn.x).toBeLessThan(7);
    expect(spawn.z).toBeGreaterThanOrEqual(0.5);
    expect(spawn.z).toBeLessThan(3);
  });
});
