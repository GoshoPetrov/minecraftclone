# 11 — Persistence and save validation

**What to build:** Building and mining survive a reload. The world is reconstructed from its seed, generator version, parameters, and a list of block deltas, saved automatically shortly after edits. A missing save generates a fresh world; a corrupt or unsupported save is backed up and recovered from explicitly rather than silently interpreted or overwritten; storage failures never crash or corrupt live gameplay. Demonstrable by editing blocks, reloading, and finding the world exactly as left.

**Blocked by:** 10 — Break and place blocks.

**Status:** done

- [ ] Saved data contains a schema version, seed, generator version, world parameters, and a list of modifications (removals stored as air) — and never meshes, materials, camera, renderer, or GPU state.
- [ ] The original generated terrain is reconstructed by the generator and only player modifications are stored, so saves grow only with edits.
- [ ] A `WorldRepository` contract (`load`, `save`, `clear`, all async) is defined; an in-memory fake backs contract tests and a thin IndexedDB adapter implements it.
- [ ] Each successful edit schedules a debounced write (~500 ms) plus a flush attempt on page-hide/visibility change; gameplay never blocks on storage.
- [ ] No save present → a new world is generated silently (not an error).
- [ ] A valid save restores seed/parameters, regenerates base terrain, then applies modifications so the loaded world matches the saved one exactly, including both broken and placed blocks.
- [ ] Invalid or unsupported-version data is rejected without throwing, never interpreted as valid world state, and never overwritten; the raw record is copied to a backup and a fresh world starts with a clear, dismissible notice.
- [ ] When storage is unavailable, the game runs in memory with auto-save disabled and a persistent notice — persistence is never faked.
- [ ] A failed save leaves the in-memory world untouched, retains the dirty state for retry, surfaces a non-fatal notice, and is caught as a typed error without a crash or world reset.
- [ ] Persistence is hidden behind the repository interface so gameplay code never depends on IndexedDB directly.
- [ ] Unit tests (against the fake repository) cover save→load round-trips, empty-store `null`, modification round-tripping including removals, clear, valid/invalid payload validation, and that a rejected load neither mutates world state nor overwrites the existing record.
