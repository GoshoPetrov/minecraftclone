import type { SaveData } from './SaveData';
import {
  asPersistenceError,
  StorageUnavailableError,
  type WorldRepository,
} from './WorldRepository';

const DATABASE_NAME = 'voxel-sandbox';
const DATABASE_VERSION = 1;
const STORE_NAME = 'world';
const RECORD_KEY = 'current';
const BACKUP_KEY_PREFIX = 'backup:';

/**
 * Thin IndexedDB adapter for a single world record plus timestamped backups.
 *
 * It implements only the storage mechanics of the `WorldRepository` contract;
 * validation, recovery, and scheduling live in the orchestration layer so
 * they can be tested against the in-memory fake. The database opens lazily on
 * first use, so constructing the adapter cannot fail synchronously.
 */
export class IndexedDbWorldRepository implements WorldRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly factory: IDBFactory) {}

  async load(): Promise<unknown | null> {
    const database = await this.openDatabase();
    try {
      const value = await requestToPromise(
        database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(RECORD_KEY),
      );
      return value ?? null;
    } catch (error) {
      throw asPersistenceError(error, 'Could not read the saved world');
    }
  }

  async save(data: SaveData): Promise<void> {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(data, RECORD_KEY);
      await transactionToPromise(transaction);
    } catch (error) {
      throw asPersistenceError(error, 'Could not save the world');
    }
  }

  async backup(raw: unknown): Promise<void> {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const suffix = Math.random().toString(36).slice(2, 8);
      transaction.objectStore(STORE_NAME).put(raw, `${BACKUP_KEY_PREFIX}${Date.now()}:${suffix}`);
      await transactionToPromise(transaction);
    } catch (error) {
      throw asPersistenceError(error, 'Could not back up the saved world');
    }
  }

  async clear(): Promise<void> {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).clear();
      await transactionToPromise(transaction);
    } catch (error) {
      throw asPersistenceError(error, 'Could not clear the saved world');
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    this.databasePromise ??= openDatabase(this.factory);
    return this.databasePromise;
  }
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      reject(new StorageUnavailableError('IndexedDB is not available.', { cause: error }));
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(
        new StorageUnavailableError('Could not open the world database.', {
          cause: request.error,
        }),
      );
    };
    request.onblocked = () => {
      reject(new StorageUnavailableError('The world database is blocked by another tab.'));
    };
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}
