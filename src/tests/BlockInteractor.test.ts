import { describe, expect, it } from 'vitest';

import { BlockInteractor } from '../interaction/BlockInteractor';
import type { BlockHit } from '../interaction/BlockRaycaster';
import { playerAabb, type Vec3 } from '../player/Player';
import { AIR, BASIC_BLOCK, BEDROCK, BlockIds } from '../world/Block';
import { createDefaultBlockRegistry } from '../world/BlockRegistry';
import type { BlockType } from '../world/BlockType';
import { World } from '../world/World';

const registry = createDefaultBlockRegistry();
const RANGE = 5;

function pos(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function hit(blockPos: Vec3, faceNormal: Vec3, distance = 1): BlockHit {
  return { blockPos, faceNormal, distance };
}

function createWorld(): World {
  return new World({ sizeInChunks: { x: 2, y: 1, z: 2 } }, registry);
}

function interactorFor(world: World): BlockInteractor {
  return new BlockInteractor(world, registry);
}

/** A player box far from any test block, so placement is never blocked by it. */
const FAR_PLAYER = playerAabb(pos(0.5, 20, 0.5));

function clearDirty(world: World): void {
  for (const chunk of world.chunks()) {
    world.clearChunkDirty(chunk.coord);
  }
}

/** A complete, comparable picture of block data plus dirty flags. */
interface WorldState {
  readonly blocks: readonly number[];
  readonly dirty: readonly string[];
}

function worldState(world: World): WorldState {
  const blocks: number[] = [];
  for (const chunk of world.chunks()) {
    for (const value of chunk.data) {
      blocks.push(value);
    }
  }
  const dirty = world
    .dirtyChunks()
    .map((chunk) => `${chunk.coord.x},${chunk.coord.y},${chunk.coord.z}`)
    .sort();
  return { blocks, dirty };
}

describe('BlockInteractor.breakBlock', () => {
  it('removes the targeted block and marks its chunk dirty', () => {
    const world = createWorld();
    world.setBlock(5, 10, 8, BlockIds.basic);
    clearDirty(world);

    const changed = interactorFor(world).breakBlock(hit(pos(5, 10, 8), pos(1, 0, 0)), RANGE);

    expect(changed).toBe(true);
    expect(world.getBlock(5, 10, 8)).toBe(BlockIds.air);
    expect(world.isChunkDirty({ x: 0, y: 0, z: 0 })).toBe(true);
  });

  it('marks the neighbouring chunk dirty when breaking on a chunk boundary', () => {
    const world = createWorld();
    // x = 16 is the first block of chunk 1, on the face shared with chunk 0.
    world.setBlock(16, 10, 8, BlockIds.basic);
    clearDirty(world);

    expect(interactorFor(world).breakBlock(hit(pos(16, 10, 8), pos(1, 0, 0)), RANGE)).toBe(
      true,
    );

    expect(world.isChunkDirty({ x: 1, y: 0, z: 0 })).toBe(true);
    expect(world.isChunkDirty({ x: 0, y: 0, z: 0 })).toBe(true);
  });

  it('accepts a target exactly at the range boundary', () => {
    const world = createWorld();
    world.setBlock(5, 10, 8, BlockIds.basic);

    expect(
      interactorFor(world).breakBlock(hit(pos(5, 10, 8), pos(1, 0, 0), RANGE), RANGE),
    ).toBe(true);
    expect(world.getBlock(5, 10, 8)).toBe(BlockIds.air);
  });

  it('rejects a missing target without changing the world', () => {
    const world = createWorld();
    world.setBlock(5, 10, 8, BlockIds.basic);
    const before = worldState(world);

    expect(interactorFor(world).breakBlock(null, RANGE)).toBe(false);

    expect(worldState(world)).toEqual(before);
  });

  it('rejects a target beyond range without changing the world', () => {
    const world = createWorld();
    world.setBlock(5, 10, 8, BlockIds.basic);
    const before = worldState(world);

    const beyond = hit(pos(5, 10, 8), pos(1, 0, 0), RANGE + 0.01);
    expect(interactorFor(world).breakBlock(beyond, RANGE)).toBe(false);

    expect(worldState(world)).toEqual(before);
  });

  it('rejects the unbreakable floor without changing the world', () => {
    const world = createWorld();
    world.setBlock(5, 10, 8, BlockIds.bedrock);
    const before = worldState(world);

    expect(interactorFor(world).breakBlock(hit(pos(5, 10, 8), pos(1, 0, 0)), RANGE)).toBe(
      false,
    );

    expect(world.getBlock(5, 10, 8)).toBe(BlockIds.bedrock);
    expect(worldState(world)).toEqual(before);
  });

  it('rejects air, which is not breakable, without changing the world', () => {
    const world = createWorld();
    const before = worldState(world);

    expect(interactorFor(world).breakBlock(hit(pos(5, 10, 8), pos(1, 0, 0)), RANGE)).toBe(
      false,
    );

    expect(worldState(world)).toEqual(before);
  });
});

describe('BlockInteractor.placeBlock adjacent cell', () => {
  const faces: readonly {
    readonly name: string;
    readonly normal: Vec3;
    readonly cell: Vec3;
  }[] = [
    { name: '+X', normal: pos(1, 0, 0), cell: pos(6, 10, 8) },
    { name: '-X', normal: pos(-1, 0, 0), cell: pos(4, 10, 8) },
    { name: '+Y', normal: pos(0, 1, 0), cell: pos(5, 11, 8) },
    { name: '-Y', normal: pos(0, -1, 0), cell: pos(5, 9, 8) },
    { name: '+Z', normal: pos(0, 0, 1), cell: pos(5, 10, 9) },
    { name: '-Z', normal: pos(0, 0, -1), cell: pos(5, 10, 7) },
  ];

  for (const face of faces) {
    it(`places in the cell adjacent to the ${face.name} face`, () => {
      const world = createWorld();
      world.setBlock(5, 10, 8, BlockIds.basic);

      const placed = interactorFor(world).placeBlock(
        hit(pos(5, 10, 8), face.normal),
        FAR_PLAYER,
        BASIC_BLOCK,
        RANGE,
      );

      expect(placed).toBe(true);
      expect(world.getBlock(face.cell.x, face.cell.y, face.cell.z)).toBe(BlockIds.basic);
      // The targeted block itself is untouched.
      expect(world.getBlock(5, 10, 8)).toBe(BlockIds.basic);
    });
  }
});

describe('BlockInteractor.placeBlock dirty marking', () => {
  it('marks the affected chunk dirty on placement', () => {
    const world = createWorld();
    world.setBlock(5, 10, 8, BlockIds.basic);
    clearDirty(world);

    expect(
      interactorFor(world).placeBlock(
        hit(pos(5, 10, 8), pos(0, 1, 0)),
        FAR_PLAYER,
        BASIC_BLOCK,
        RANGE,
      ),
    ).toBe(true);

    expect(world.isChunkDirty({ x: 0, y: 0, z: 0 })).toBe(true);
  });

  it('marks the neighbouring chunk dirty when placing on a chunk boundary', () => {
    const world = createWorld();
    // Target x = 15 sits on chunk 0's +X boundary; the new block lands in chunk 1.
    world.setBlock(15, 10, 8, BlockIds.basic);
    clearDirty(world);

    expect(
      interactorFor(world).placeBlock(
        hit(pos(15, 10, 8), pos(1, 0, 0)),
        FAR_PLAYER,
        BASIC_BLOCK,
        RANGE,
      ),
    ).toBe(true);

    expect(world.getBlock(16, 10, 8)).toBe(BlockIds.basic);
    expect(world.isChunkDirty({ x: 0, y: 0, z: 0 })).toBe(true);
    expect(world.isChunkDirty({ x: 1, y: 0, z: 0 })).toBe(true);
  });
});

describe('BlockInteractor.placeBlock rejection', () => {
  it('rejects a missing target without changing the world', () => {
    const world = createWorld();
    world.setBlock(5, 10, 8, BlockIds.basic);
    const before = worldState(world);

    expect(
      interactorFor(world).placeBlock(null, FAR_PLAYER, BASIC_BLOCK, RANGE),
    ).toBe(false);

    expect(worldState(world)).toEqual(before);
  });

  it('rejects a target beyond range without changing the world', () => {
    const world = createWorld();
    world.setBlock(5, 10, 8, BlockIds.basic);
    const before = worldState(world);

    const beyond = hit(pos(5, 10, 8), pos(0, 1, 0), RANGE + 0.01);
    expect(interactorFor(world).placeBlock(beyond, FAR_PLAYER, BASIC_BLOCK, RANGE)).toBe(
      false,
    );

    expect(worldState(world)).toEqual(before);
  });

  it('rejects an occupied target cell without changing the world', () => {
    const world = createWorld();
    world.setBlock(5, 10, 8, BlockIds.basic);
    world.setBlock(5, 11, 8, BlockIds.bedrock);
    const before = worldState(world);

    expect(
      interactorFor(world).placeBlock(
        hit(pos(5, 10, 8), pos(0, 1, 0)),
        FAR_PLAYER,
        BASIC_BLOCK,
        RANGE,
      ),
    ).toBe(false);

    expect(world.getBlock(5, 11, 8)).toBe(BlockIds.bedrock);
    expect(worldState(world)).toEqual(before);
  });

  it('rejects a placement outside the world bounds without changing the world', () => {
    const world = createWorld();
    world.setBlock(0, 0, 0, BlockIds.basic);
    const before = worldState(world);

    // The -X face of the block at the origin points to x = -1, off-world.
    expect(
      interactorFor(world).placeBlock(
        hit(pos(0, 0, 0), pos(-1, 0, 0)),
        FAR_PLAYER,
        BASIC_BLOCK,
        RANGE,
      ),
    ).toBe(false);

    expect(worldState(world)).toEqual(before);
  });

  it('rejects a placement inside the player without changing the world', () => {
    const world = createWorld();
    // The +X face of this block points at cell (5, 10, 8), where the player stands.
    world.setBlock(4, 10, 8, BlockIds.basic);
    const before = worldState(world);

    const player = playerAabb(pos(5.5, 10, 8.5));
    expect(
      interactorFor(world).placeBlock(
        hit(pos(4, 10, 8), pos(1, 0, 0)),
        player,
        BASIC_BLOCK,
        RANGE,
      ),
    ).toBe(false);

    expect(world.getBlock(5, 10, 8)).toBe(BlockIds.air);
    expect(worldState(world)).toEqual(before);
  });

  it('allows a block that only touches the player box, so blocks can go underfoot', () => {
    const world = createWorld();
    world.setBlock(4, 10, 8, BlockIds.basic);

    // Feet exactly on top of cell (5, 10, 8): the boxes touch but do not overlap.
    const player = playerAabb(pos(5.5, 11, 8.5));
    expect(
      interactorFor(world).placeBlock(
        hit(pos(4, 10, 8), pos(1, 0, 0)),
        player,
        BASIC_BLOCK,
        RANGE,
      ),
    ).toBe(true);

    expect(world.getBlock(5, 10, 8)).toBe(BlockIds.basic);
  });

  it('rejects an unplaceable block type without changing the world', () => {
    const world = createWorld();
    world.setBlock(5, 10, 8, BlockIds.basic);
    const before = worldState(world);

    for (const type of [BEDROCK, AIR]) {
      expect(
        interactorFor(world).placeBlock(
          hit(pos(5, 10, 8), pos(0, 1, 0)),
          FAR_PLAYER,
          type,
          RANGE,
        ),
      ).toBe(false);
    }

    expect(worldState(world)).toEqual(before);
  });

  it('rejects a type the registry does not know, even if it claims to be placeable', () => {
    const world = createWorld();
    world.setBlock(5, 10, 8, BlockIds.basic);
    const before = worldState(world);
    const unknown: BlockType = {
      id: 42,
      name: 'unknown',
      solid: true,
      breakable: true,
      placeable: true,
      material: { kind: 'color', color: 0x000000 },
    };

    expect(
      interactorFor(world).placeBlock(
        hit(pos(5, 10, 8), pos(0, 1, 0)),
        FAR_PLAYER,
        unknown,
        RANGE,
      ),
    ).toBe(false);

    expect(worldState(world)).toEqual(before);
  });
});

describe('BlockInteractor.canPlaceBlock', () => {
  it('accepts a valid placement without modifying the world', () => {
    const world = createWorld();
    world.setBlock(5, 10, 8, BlockIds.basic);
    const before = worldState(world);

    const canPlace = interactorFor(world).canPlaceBlock(
      hit(pos(5, 10, 8), pos(0, 1, 0)),
      FAR_PLAYER,
      BASIC_BLOCK,
      RANGE,
    );

    expect(canPlace).toBe(true);
    expect(worldState(world)).toEqual(before);
  });

  it('mirrors the rejection reasons of placeBlock', () => {
    const world = createWorld();
    world.setBlock(5, 10, 8, BlockIds.basic);
    world.setBlock(5, 11, 8, BlockIds.bedrock);
    const interactor = interactorFor(world);

    expect(interactor.canPlaceBlock(null, FAR_PLAYER, BASIC_BLOCK, RANGE)).toBe(false);
    expect(
      interactor.canPlaceBlock(
        hit(pos(5, 10, 8), pos(0, 1, 0), RANGE + 1),
        FAR_PLAYER,
        BASIC_BLOCK,
        RANGE,
      ),
    ).toBe(false);
    // Occupied.
    expect(
      interactor.canPlaceBlock(
        hit(pos(5, 10, 8), pos(0, 1, 0)),
        FAR_PLAYER,
        BASIC_BLOCK,
        RANGE,
      ),
    ).toBe(false);
    // Unplaceable type.
    expect(
      interactor.canPlaceBlock(
        hit(pos(5, 10, 8), pos(0, -1, 0)),
        FAR_PLAYER,
        BEDROCK,
        RANGE,
      ),
    ).toBe(false);
  });
});
