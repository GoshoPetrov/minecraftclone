import type { BlockRegistry } from '../world/BlockRegistry';
import type { World } from '../world/World';
import {
  SAVE_VERSION,
  validateSaveData,
  type SaveData,
  type WorldMetadata,
} from './SaveData';
import { createGeneratedWorld, reconstructWorld } from './WorldFactory';
import {
  asPersistenceError,
  StorageUnavailableError,
  type PersistenceError,
  type WorldRepository,
} from './WorldRepository';

/** Scheduled callback handle; opaque to callers. */
export type TimerHandle = number;

/** Minimal timer seam so debounce behaviour is testable without real time. */
export interface SaveScheduler {
  setTimeout(callback: () => void, delayMs: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export const defaultSaveScheduler: SaveScheduler = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs) as unknown as TimerHandle,
  clearTimeout: (handle) => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>),
};

/** A non-fatal, player-facing persistence message. */
export interface PersistenceMessage {
  readonly level: 'info' | 'warning' | 'error';
  readonly message: string;
  readonly dismissible: boolean;
  readonly persistent: boolean;
}

/** Receives persistence messages while the game is running. */
export interface PersistenceObserver {
  notify(message: PersistenceMessage): void;
}

/** An observer that drops messages, for when none is supplied. */
export const NOOP_OBSERVER: PersistenceObserver = { notify: () => undefined };

export interface WorldPersistenceOptions {
  readonly world: World;
  readonly repository: WorldRepository;
  readonly metadata: WorldMetadata;
  readonly debounceMs: number;
  readonly autoSaveEnabled: boolean;
  readonly scheduler?: SaveScheduler;
  readonly observer?: PersistenceObserver;
}

/**
 * Owns automatic saving for one world.
 *
 * A successful edit calls `markDirty`, which arms a debounced write; a burst
 * of edits coalesces into one save. `flush` forces a write now and is used on
 * page-hide. Saves are never awaited by gameplay, and a failed save keeps the
 * in-memory world and the dirty flag intact so a later attempt can retry.
 */
export class WorldPersistence {
  private readonly world: World;
  private readonly repository: WorldRepository;
  private readonly metadata: WorldMetadata;
  private readonly debounceMs: number;
  private readonly scheduler: SaveScheduler;
  private readonly observer: PersistenceObserver;

  private enabled: boolean;
  private dirty = false;
  private editVersion = 0;
  private timer: TimerHandle | null = null;
  private activeSave: Promise<void> | null = null;
  private flushRequested = false;

  constructor(options: WorldPersistenceOptions) {
    this.world = options.world;
    this.repository = options.repository;
    this.metadata = options.metadata;
    this.debounceMs = options.debounceMs;
    this.enabled = options.autoSaveEnabled;
    this.scheduler = options.scheduler ?? defaultSaveScheduler;
    this.observer = options.observer ?? NOOP_OBSERVER;
  }

  /** Whether automatic saving is currently active. */
  get autoSaveEnabled(): boolean {
    return this.enabled;
  }

  /** Record that the world changed and schedule a debounced write. */
  markDirty(): void {
    this.dirty = true;
    this.editVersion += 1;
    if (!this.enabled) {
      return;
    }
    this.armTimer();
  }

  /**
   * Write the world now. Resolves once any in-flight save completes; a
   * failure is reported through the observer and leaves `dirty` set. Safe to
   * call when clean or when saving is disabled.
   */
  flush(): Promise<void> {
    if (!this.enabled || !this.dirty) {
      return Promise.resolve();
    }
    if (this.activeSave !== null) {
      this.flushRequested = true;
      return this.activeSave;
    }
    this.activeSave = this.saveLoop();
    return this.activeSave;
  }

  /** Cancel any pending debounce. Does not save. */
  dispose(): void {
    this.clearTimer();
  }

  private armTimer(): void {
    this.clearTimer();
    this.timer = this.scheduler.setTimeout(() => {
      this.timer = null;
      void this.flush().catch(() => undefined);
    }, this.debounceMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      this.scheduler.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async saveLoop(): Promise<void> {
    try {
      do {
        this.flushRequested = false;
        if (!this.enabled || !this.dirty) {
          break;
        }
        const version = this.editVersion;
        try {
          await this.repository.save(this.toSaveData());
          if (this.editVersion === version) {
            this.dirty = false;
          } else {
            // Edits arrived while saving; those must be written too.
            this.flushRequested = true;
          }
        } catch (error) {
          this.handleSaveFailure(asPersistenceError(error, 'Could not save the world'));
          break;
        }
      } while (this.flushRequested);
    } finally {
      this.activeSave = null;
    }
  }

  private toSaveData(): SaveData {
    return {
      version: SAVE_VERSION,
      seed: this.metadata.seed,
      generatorVersion: this.metadata.generatorVersion,
      worldParameters: this.metadata.worldParameters,
      modifications: this.world.modifications(),
    };
  }

  private handleSaveFailure(error: PersistenceError): void {
    // The in-memory world and the dirty flag are deliberately left untouched:
    // a storage problem must never be mistaken for a world change.
    if (error instanceof StorageUnavailableError) {
      this.enabled = false;
      this.clearTimer();
      this.observer.notify({
        level: 'error',
        message:
          'Browser storage became unavailable, so saving is disabled. Recent changes may be lost on reload.',
        dismissible: false,
        persistent: true,
      });
      return;
    }
    this.observer.notify({
      level: 'warning',
      message: `The world could not be saved (${error.message}). Your changes are still in memory.`,
      dismissible: true,
      persistent: false,
    });
  }
}

export interface LoadWorldOptions {
  readonly repository: WorldRepository;
  readonly registry: BlockRegistry;
  readonly fallbackMetadata: WorldMetadata;
  readonly debounceMs: number;
  readonly storageAvailable: boolean;
  readonly scheduler?: SaveScheduler;
  readonly observer?: PersistenceObserver;
}

export type WorldLoadStatus = 'new' | 'restored' | 'recovered' | 'storage-unavailable';

export interface LoadedWorld {
  readonly world: World;
  readonly persistence: WorldPersistence;
  readonly messages: readonly PersistenceMessage[];
  readonly status: WorldLoadStatus;
}

/**
 * Load, validate, and reconstruct the saved world, or start a fresh one.
 *
 * A missing save is normal and silent. An unreadable save is backed up before
 * a new world starts, so a corrupt record is never overwritten. When storage
 * is unavailable the game runs in memory with auto-save disabled and a
 * persistent notice; persistence is never faked.
 */
export async function loadWorld(options: LoadWorldOptions): Promise<LoadedWorld> {
  if (!options.storageAvailable) {
    return startFreshWorld(options, false, 'storage-unavailable', [
      {
        level: 'warning',
        message:
          'Browser storage is unavailable, so saving is disabled. Changes will be lost on reload.',
        dismissible: false,
        persistent: true,
      },
    ]);
  }

  let raw: unknown;
  try {
    raw = await options.repository.load();
  } catch (error) {
    const reason = asPersistenceError(error, 'Could not read the saved world').message;
    return startFreshWorld(options, false, 'storage-unavailable', [
      {
        level: 'error',
        message: `${reason}. Saving is disabled.`,
        dismissible: false,
        persistent: true,
      },
    ]);
  }

  if (raw === null || raw === undefined) {
    return startFreshWorld(options, true, 'new', []);
  }

  const validation = validateSaveData(raw, options.registry);
  if (validation.ok) {
    const world = reconstructWorld(validation.data, options.registry);
    const persistence = createPersistence(
      options,
      world,
      {
        seed: validation.data.seed,
        generatorVersion: validation.data.generatorVersion,
        worldParameters: validation.data.worldParameters,
      },
      true,
    );
    return { world, persistence, messages: [], status: 'restored' };
  }

  // The record is unusable: preserve it first, then start over. If the backup
  // itself fails, disable saving so the new world cannot overwrite it.
  let backedUp = true;
  try {
    await options.repository.backup(raw);
  } catch {
    backedUp = false;
  }

  const messages: PersistenceMessage[] = backedUp
    ? [
        {
          level: 'warning',
          message: `The saved world could not be read (${validation.reason}). A backup was kept and a new world was started.`,
          dismissible: true,
          persistent: false,
        },
      ]
    : [
        {
          level: 'error',
          message: `The saved world could not be read (${validation.reason}) and could not be backed up. Saving is disabled to avoid overwriting it.`,
          dismissible: false,
          persistent: true,
        },
      ];

  return startFreshWorld(options, backedUp, 'recovered', messages);
}

function startFreshWorld(
  options: LoadWorldOptions,
  autoSaveEnabled: boolean,
  status: WorldLoadStatus,
  messages: readonly PersistenceMessage[],
): LoadedWorld {
  const world = createGeneratedWorld(options.fallbackMetadata, options.registry);
  const persistence = createPersistence(
    options,
    world,
    options.fallbackMetadata,
    autoSaveEnabled,
  );
  return { world, persistence, messages, status };
}

function createPersistence(
  options: LoadWorldOptions,
  world: World,
  metadata: WorldMetadata,
  autoSaveEnabled: boolean,
): WorldPersistence {
  return new WorldPersistence({
    world,
    repository: options.repository,
    metadata,
    debounceMs: options.debounceMs,
    autoSaveEnabled,
    scheduler: options.scheduler ?? defaultSaveScheduler,
    observer: options.observer ?? NOOP_OBSERVER,
  });
}
