import { IndexedDbWorldRepository } from './IndexedDbWorldRepository';
import { InMemoryWorldRepository } from './InMemoryWorldRepository';
import type { WorldRepository } from './WorldRepository';

/** A repository plus whether real persistence is actually available. */
export interface RepositorySetup {
  readonly repository: WorldRepository;
  readonly storageAvailable: boolean;
}

/**
 * Choose the storage backend for the browser. When IndexedDB is missing or
 * cannot be constructed, an empty in-memory repository is returned with
 * `storageAvailable: false` so the caller can run without pretending saves
 * work. Gameplay still depends only on the `WorldRepository` interface.
 */
export function createBrowserWorldRepository(): RepositorySetup {
  if (typeof indexedDB === 'undefined') {
    return { repository: new InMemoryWorldRepository(), storageAvailable: false };
  }
  try {
    return { repository: new IndexedDbWorldRepository(indexedDB), storageAvailable: true };
  } catch {
    return { repository: new InMemoryWorldRepository(), storageAvailable: false };
  }
}
