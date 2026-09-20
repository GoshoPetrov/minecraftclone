import type { SaveData } from './SaveData';
import { PersistenceError, type WorldRepository } from './WorldRepository';

/**
 * In-memory `WorldRepository` used by tests and by the fallback when browser
 * storage is unavailable. It stores deep copies so callers can never mutate
 * persisted data through a shared reference.
 */
export class InMemoryWorldRepository implements WorldRepository {
  private record: unknown | null = null;
  private readonly backups: unknown[] = [];
  private saveCount = 0;

  /** When set, the next `load` throws this error once. */
  failNextLoad: PersistenceError | null = null;
  /** When set, the next `save` throws this error once. */
  failNextSave: PersistenceError | null = null;
  /** When set, the next `backup` throws this error once. */
  failNextBackup: PersistenceError | null = null;

  async load(): Promise<unknown | null> {
    if (this.failNextLoad !== null) {
      const error = this.failNextLoad;
      this.failNextLoad = null;
      throw error;
    }
    return this.record === null ? null : structuredClone(this.record);
  }

  async save(data: SaveData): Promise<void> {
    if (this.failNextSave !== null) {
      const error = this.failNextSave;
      this.failNextSave = null;
      throw error;
    }
    this.record = structuredClone(data);
    this.saveCount += 1;
  }

  async backup(raw: unknown): Promise<void> {
    if (this.failNextBackup !== null) {
      const error = this.failNextBackup;
      this.failNextBackup = null;
      throw error;
    }
    this.backups.push(structuredClone(raw));
  }

  async clear(): Promise<void> {
    this.record = null;
    this.backups.length = 0;
  }

  /** The current record, as a copy; `null` when nothing is stored. */
  peek(): unknown | null {
    return this.record === null ? null : structuredClone(this.record);
  }

  /** Copies of every record written through `backup`. */
  peekBackups(): readonly unknown[] {
    return this.backups.map((backup) => structuredClone(backup));
  }

  /** How many times `save` has succeeded. */
  get saves(): number {
    return this.saveCount;
  }
}
