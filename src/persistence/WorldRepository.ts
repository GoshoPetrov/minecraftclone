import type { SaveData } from './SaveData';

/**
 * Storage abstraction for the single saved world.
 *
 * Gameplay and orchestration depend only on this interface, never on
 * IndexedDB. `load` returns the raw stored value so the caller can validate it
 * and back up anything unreadable; `save` accepts already-validated data.
 */
export interface WorldRepository {
  /** The stored raw record, or `null` when no world has been saved. */
  load(): Promise<unknown | null>;
  /** Persist a validated save, replacing the current record. */
  save(data: SaveData): Promise<void>;
  /** Copy an unreadable raw record aside before any new world is written. */
  backup(raw: unknown): Promise<void>;
  /** Remove all stored records, including backups. */
  clear(): Promise<void>;
}

/** Base class for storage failures the orchestrator is expected to catch. */
export class PersistenceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PersistenceError';
  }
}

/** Storage cannot be read or written at all (blocked, missing, or gone). */
export class StorageUnavailableError extends PersistenceError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StorageUnavailableError';
  }
}

/** Normalise any thrown value into a typed persistence error. */
export function asPersistenceError(error: unknown, context: string): PersistenceError {
  if (error instanceof PersistenceError) {
    return error;
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new PersistenceError(`${context}: ${detail}`);
}
