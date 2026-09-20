import { describe, expect, it } from 'vitest';

import { BlockIds } from '../world/Block';
import { createDefaultBlockRegistry } from '../world/BlockRegistry';
import { World } from '../world/World';
import { InMemoryWorldRepository } from '../persistence/InMemoryWorldRepository';
import {
  SAVE_VERSION,
  worldMetadataFrom,
  type SaveData,
  type WorldMetadata,
} from '../persistence/SaveData';
import {
  createGeneratedWorld,
  reconstructWorld,
} from '../persistence/WorldFactory';
import {
  loadWorld,
  WorldPersistence,
  type PersistenceMessage,
  type PersistenceObserver,
  type SaveScheduler,
  type TimerHandle,
} from '../persistence/WorldPersistence';
import {
  PersistenceError,
  StorageUnavailableError,
  type WorldRepository,
} from '../persistence/WorldRepository';

const registry = createDefaultBlockRegistry();
const GENERATION = {
  seed: 1337,
  generatorVersion: 1,
  baseSurfaceHeight: 24,
  amplitude: 3,
  bedrockLayers: 1,
  featureSize: 8,
} as const;
const SIZE = { x: 1, y: 1, z: 1 } as const;
const METADATA: WorldMetadata = worldMetadataFrom(SIZE, GENERATION);
const DEBOUNCE_MS = 500;

/** Deterministic scheduler that runs queued timers only when asked. */
class ManualScheduler implements SaveScheduler {
  private nextHandle = 1;
  private readonly pending = new Map<TimerHandle, () => void>();

  setTimeout(callback: () => void, _delayMs: number): TimerHandle {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.pending.set(handle, callback);
    return handle;
  }

  clearTimeout(handle: TimerHandle): void {
    this.pending.delete(handle);
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  runAll(): void {
    const callbacks = [...this.pending.values()];
    this.pending.clear();
    for (const callback of callbacks) {
      callback();
    }
  }
}

function recordingObserver(): { observer: PersistenceObserver; messages: PersistenceMessage[] } {
  const messages: PersistenceMessage[] = [];
  return {
    messages,
    observer: { notify: (message) => messages.push(message) },
  };
}

function makePersistence(
  world: World,
  repository: WorldRepository,
  scheduler: SaveScheduler,
  observer: PersistenceObserver = { notify: () => undefined },
): WorldPersistence {
  return new WorldPersistence({
    world,
    repository,
    metadata: METADATA,
    debounceMs: DEBOUNCE_MS,
    autoSaveEnabled: true,
    scheduler,
    observer,
  });
}

/** Flat list of every chunk's block ids, for whole-world comparisons. */
function blockData(world: World): readonly number[] {
  const blocks: number[] = [];
  for (const chunk of world.chunks()) {
    for (const value of chunk.data) {
      blocks.push(value);
    }
  }
  return blocks;
}

/** A place high above the generated surface, guaranteed to be air. */
const AIR_CELL = { x: 5, y: 60, z: 5 };
/** A generated solid block that can be broken. */
const SOLID_CELL = { x: 3, y: 1, z: 3 };

describe('InMemoryWorldRepository', () => {
  it('returns null when empty', async () => {
    expect(await new InMemoryWorldRepository().load()).toBeNull();
  });

  it('round-trips a saved record', async () => {
    const repository = new InMemoryWorldRepository();
    const world = createGeneratedWorld(METADATA, registry);
    world.setBlock(AIR_CELL.x, AIR_CELL.y, AIR_CELL.z, BlockIds.basic);

    const save = saveDataFor(world);
    await repository.save(save);

    expect(await repository.load()).toEqual(save);
    expect(repository.saves).toBe(1);
  });

  it('clears the stored record', async () => {
    const repository = new InMemoryWorldRepository();
    await repository.save(saveDataFor(createGeneratedWorld(METADATA, registry)));

    await repository.clear();

    expect(await repository.load()).toBeNull();
  });

  it('keeps backups without touching the current record', async () => {
    const repository = new InMemoryWorldRepository();
    const corrupt = { version: 999, nonsense: true };
    await repository.save(corrupt as unknown as SaveData);

    await repository.backup(corrupt);

    expect(repository.peekBackups()).toEqual([corrupt]);
    expect(repository.peek()).toEqual(corrupt);
  });
});

describe('loadWorld', () => {
  it('generates a fresh world silently when no save exists', async () => {
    const loaded = await loadWorld({
      repository: new InMemoryWorldRepository(),
      registry,
      fallbackMetadata: METADATA,
      debounceMs: DEBOUNCE_MS,
      storageAvailable: true,
    });

    expect(loaded.status).toBe('new');
    expect(loaded.messages).toEqual([]);
    expect(loaded.persistence.autoSaveEnabled).toBe(true);
    expect(loaded.world.modifications()).toEqual([]);
  });

  it('restores broken and placed blocks so the loaded world matches exactly', async () => {
    const repository = new InMemoryWorldRepository();
    const original = createGeneratedWorld(METADATA, registry);
    const persistence = makePersistence(original, repository, new ManualScheduler());

    original.removeBlock(SOLID_CELL.x, SOLID_CELL.y, SOLID_CELL.z);
    original.setBlock(AIR_CELL.x, AIR_CELL.y, AIR_CELL.z, BlockIds.basic);
    persistence.markDirty();
    await persistence.flush();

    const loaded = await loadWorld({
      repository,
      registry,
      fallbackMetadata: METADATA,
      debounceMs: DEBOUNCE_MS,
      storageAvailable: true,
    });

    expect(loaded.status).toBe('restored');
    expect(loaded.messages).toEqual([]);
    expect(loaded.world.getBlock(SOLID_CELL.x, SOLID_CELL.y, SOLID_CELL.z)).toBe(BlockIds.air);
    expect(loaded.world.getBlock(AIR_CELL.x, AIR_CELL.y, AIR_CELL.z)).toBe(BlockIds.basic);
    expect(blockData(loaded.world)).toEqual(blockData(original));
    expect(loaded.world.modifications()).toEqual(original.modifications());
  });

  it('backs up an unreadable record before starting fresh, without overwriting it', async () => {
    const repository = new InMemoryWorldRepository();
    const corrupt = { version: SAVE_VERSION, seed: 'not-a-number', modifications: [] };
    await repository.save(corrupt as unknown as SaveData);

    const loaded = await loadWorld({
      repository,
      registry,
      fallbackMetadata: METADATA,
      debounceMs: DEBOUNCE_MS,
      storageAvailable: true,
    });

    expect(loaded.status).toBe('recovered');
    expect(loaded.persistence.autoSaveEnabled).toBe(true);
    expect(loaded.messages).toHaveLength(1);
    expect(loaded.messages[0]?.dismissible).toBe(true);
    expect(repository.peek()).toEqual(corrupt);
    expect(repository.peekBackups()).toEqual([corrupt]);
    // The rejected modifications were never applied to the new world.
    expect(loaded.world.modifications()).toEqual([]);
  });

  it('disables saving when an unreadable record cannot be backed up', async () => {
    const repository = new InMemoryWorldRepository();
    const corrupt = { version: SAVE_VERSION, seed: 1.5 };
    await repository.save(corrupt as unknown as SaveData);
    repository.failNextBackup = new PersistenceError('disk full');

    const loaded = await loadWorld({
      repository,
      registry,
      fallbackMetadata: METADATA,
      debounceMs: DEBOUNCE_MS,
      storageAvailable: true,
    });

    expect(loaded.status).toBe('recovered');
    expect(loaded.persistence.autoSaveEnabled).toBe(false);
    expect(loaded.messages[0]?.persistent).toBe(true);
    expect(repository.peek()).toEqual(corrupt);
  });

  it('runs in memory with saving disabled when storage is unavailable', async () => {
    const loaded = await loadWorld({
      repository: new InMemoryWorldRepository(),
      registry,
      fallbackMetadata: METADATA,
      debounceMs: DEBOUNCE_MS,
      storageAvailable: false,
    });

    expect(loaded.status).toBe('storage-unavailable');
    expect(loaded.persistence.autoSaveEnabled).toBe(false);
    expect(loaded.messages[0]?.persistent).toBe(true);
    expect(loaded.world.modifications()).toEqual([]);
  });

  it('disables saving when reading storage fails', async () => {
    const repository = new InMemoryWorldRepository();
    repository.failNextLoad = new StorageUnavailableError('blocked');

    const loaded = await loadWorld({
      repository,
      registry,
      fallbackMetadata: METADATA,
      debounceMs: DEBOUNCE_MS,
      storageAvailable: true,
    });

    expect(loaded.status).toBe('storage-unavailable');
    expect(loaded.persistence.autoSaveEnabled).toBe(false);
  });
});

describe('WorldPersistence automatic saving', () => {
  it('coalesces rapid edits into one debounced write', async () => {
    const repository = new InMemoryWorldRepository();
    const scheduler = new ManualScheduler();
    const world = createGeneratedWorld(METADATA, registry);
    const persistence = makePersistence(world, repository, scheduler);

    world.setBlock(AIR_CELL.x, AIR_CELL.y, AIR_CELL.z, BlockIds.basic);
    world.setBlock(6, 60, 6, BlockIds.basic);
    persistence.markDirty();
    persistence.markDirty();

    expect(scheduler.pendingCount).toBe(1);
    expect(repository.saves).toBe(0);

    scheduler.runAll();
    await persistence.flush();

    expect(repository.saves).toBe(1);
    expect((repository.peek() as SaveData).modifications).toHaveLength(2);
  });

  it('does not schedule a write when automatic saving is disabled', () => {
    const scheduler = new ManualScheduler();
    const world = createGeneratedWorld(METADATA, registry);
    const persistence = new WorldPersistence({
      world,
      repository: new InMemoryWorldRepository(),
      metadata: METADATA,
      debounceMs: DEBOUNCE_MS,
      autoSaveEnabled: false,
      scheduler,
    });

    persistence.markDirty();

    expect(scheduler.pendingCount).toBe(0);
    expect(persistence.autoSaveEnabled).toBe(false);
  });

  it('keeps the world and dirty state when a save fails, then retries', async () => {
    const repository = new InMemoryWorldRepository();
    const scheduler = new ManualScheduler();
    const world = createGeneratedWorld(METADATA, registry);
    const { observer, messages } = recordingObserver();
    const persistence = makePersistence(world, repository, scheduler, observer);

    world.setBlock(AIR_CELL.x, AIR_CELL.y, AIR_CELL.z, BlockIds.basic);
    const before = blockData(world);
    repository.failNextSave = new PersistenceError('quota exceeded');

    persistence.markDirty();
    await persistence.flush();

    expect(messages).toHaveLength(1);
    expect(messages[0]?.level).toBe('warning');
    expect(persistence.autoSaveEnabled).toBe(true);
    expect(blockData(world)).toEqual(before);

    await persistence.flush();

    expect(repository.saves).toBe(1);
    expect((repository.peek() as SaveData).modifications).toHaveLength(1);
  });

  it('disables saving permanently when storage becomes unavailable', async () => {
    const repository = new InMemoryWorldRepository();
    const scheduler = new ManualScheduler();
    const world = createGeneratedWorld(METADATA, registry);
    const { observer, messages } = recordingObserver();
    const persistence = makePersistence(world, repository, scheduler, observer);

    repository.failNextSave = new StorageUnavailableError('gone');
    persistence.markDirty();
    await persistence.flush();

    expect(persistence.autoSaveEnabled).toBe(false);
    expect(messages.at(-1)?.persistent).toBe(true);

    persistence.markDirty();
    expect(scheduler.pendingCount).toBe(0);
  });

  it('saves edits made while an earlier save is in flight', async () => {
    const repository = new ControllableRepository();
    const world = createGeneratedWorld(METADATA, registry);
    const persistence = makePersistence(world, repository, new ManualScheduler());

    world.setBlock(AIR_CELL.x, AIR_CELL.y, AIR_CELL.z, BlockIds.basic);
    persistence.markDirty();
    const flush = persistence.flush();

    expect(repository.saved).toHaveLength(1);

    world.setBlock(6, 60, 6, BlockIds.basic);
    persistence.markDirty();
    repository.release();
    await until(() => repository.saved.length === 2);

    expect(repository.saved[1]?.modifications).toHaveLength(2);

    repository.release();
    await flush;

    await persistence.flush();
    expect(repository.saved).toHaveLength(2);
  });
});

describe('reconstructWorld', () => {
  it('reproduces a world that was never modified', () => {
    const original = createGeneratedWorld(METADATA, registry);
    const reconstructed = reconstructWorld(saveDataFor(original), registry);

    expect(blockData(reconstructed)).toEqual(blockData(original));
  });
});

function saveDataFor(world: World): SaveData {
  return {
    version: SAVE_VERSION,
    seed: METADATA.seed,
    generatorVersion: METADATA.generatorVersion,
    worldParameters: METADATA.worldParameters,
    modifications: world.modifications(),
  };
}

/** Resolves after a save is recorded, waiting through pending microtasks. */
async function until(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt += 1) {
    await Promise.resolve();
  }
}

/** Repository whose `save` resolves only when the test releases it. */
class ControllableRepository implements WorldRepository {
  readonly saved: SaveData[] = [];
  private readonly releases: Array<() => void> = [];
  private record: unknown | null = null;

  async load(): Promise<unknown | null> {
    return this.record;
  }

  save(data: SaveData): Promise<void> {
    this.saved.push(data);
    return new Promise<void>((resolve) => {
      this.releases.push(resolve);
    });
  }

  async backup(): Promise<void> {
    // No-op: these tests never exercise the recovery path.
  }

  async clear(): Promise<void> {
    this.record = null;
  }

  release(): void {
    const resolve = this.releases.shift();
    resolve?.();
  }
}
