# Manual Acceptance Run — Voxel Sandbox MVP

**Spec:** `docs/001-voxel-sandbox-mvp.md`
**Criteria:** `IDEA.md` §52 (Acceptance Criteria), §53 (Required Playable Flow)
**Automated coverage:** `src/tests/AcceptanceFlow.test.ts` and the per-system unit tests

This runbook is the in-browser pass that verifies the criteria a headless test
cannot: real rendering, pointer lock, the context menu, the IndexedDB adapter,
and perceived smoothness. Automated tests already cover the domain behaviour
behind each criterion; the "Automated" column below names the test that backs
it so the manual step can focus on the browser-only part.

## Preconditions

```bash
npm install
npm test        # all suites pass
npm run typecheck
npm run build
npm run dev     # open http://localhost:5173
```

For a clean first run, open DevTools → Application → IndexedDB → `voxel-sandbox`
→ `world` → delete the `current` record (and any `backup:*` records).

## Playable flow (IDEA.md §53)

1. Open the game. The click-to-play overlay shows the control hint.
2. Click the viewport. The pointer is captured and the overlay disappears.
3. The world shows terrain with depth; the first-person camera sits at eye height.
4. `W/A/S/D` moves relative to facing; `Space` jumps; gravity pulls the player
   down and landing stops the fall. Holding `Space` in mid-air does not re-jump.
5. Move the mouse to look around. Horizontal look is unlimited; vertical look
   stops just short of straight up/down. `Escape` releases the pointer and the
   overlay returns.
6. Aim at a block. The center-screen crosshair marks a highlighted outline on
   the targeted block.
7. Left click breaks it; the outline and geometry update. Right click places a
   block on the targeted face.
8. Break and place a few blocks in different chunks.
9. Reload the page. The world returns with every break and placement intact.
10. Corrupt the save (below), reload, and confirm the recovery notice.

## Corrupt-save recovery

In DevTools → Application → IndexedDB → `voxel-sandbox` → `world`, overwrite the
`current` record with invalid data, for example:

```js
// DevTools console
const db = await new Promise((res, rej) => {
  const r = indexedDB.open('voxel-sandbox', 1);
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const tx = db.transaction('world', 'readwrite');
tx.objectStore('world').put({ version: 1, seed: 'corrupt', modifications: [] }, 'current');
await new Promise((res) => (tx.oncomplete = res));
```

Reload. Expected: a dismissible warning notice says the save could not be read,
a backup was kept, and a new world was started. The bad record is still present
as `current` (not overwritten) and a `backup:*` record exists.

## Storage unavailable

In a browser profile that blocks IndexedDB (or by overriding
`window.indexedDB = undefined` before the bundle runs), reload. Expected: a
persistent notice says saving is disabled, and the game still plays in memory
for the session.

## Varying frame rates

Reload and then slow the CPU 6×/20× from the DevTools Performance panel or
Rendering FPS meter. Walking, falling, and jumping should stay consistent, and a
long pause (switch tabs and back) should not fling the player or drop them
through the floor.

## §52 criterion checklist

Legend: **A** = covered by an automated test; **M** = browser-only, verified by
the steps above.

### World

| Criterion | A/M | Where |
| --- | --- | --- |
| New installation generates a voxel world | A | `AcceptanceFlow` “generates a fresh multi-layer, 3D world” |
| World contains multiple layers of blocks | A | same test |
| World has actual 3D depth | A | same test; `WorldGenerator.test.ts` |
| World generation uses a seed | A | `WorldGenerator.test.ts`; `AcceptanceFlow` determinism |
| Same seed produces the same terrain | A | `AcceptanceFlow` “is deterministic for a fixed seed” |
| World represented independently from rendering | A | `World.test.ts`; `world/` imports no Three.js |
| Organised so chunk-based rendering is possible | A | `Chunk.test.ts`; `ChunkMeshBuilder.test.ts` |

### Player

| Criterion | A/M | Where |
| --- | --- | --- |
| Player spawns above the terrain | A | `AcceptanceFlow` spawn test; `Spawn.test.ts` |
| Player never spawns inside a block | A | same test |
| WASD movement works | A | `PlayerController.test.ts`; `AcceptanceFlow` frame-rate |
| Movement is collision-aware | A | `PlayerPhysics.test.ts`; `AcceptanceFlow` wall |
| Player cannot walk through solid blocks | A | `AcceptanceFlow` “cannot walk through a solid wall” |
| Gravity works | A | `AcceptanceFlow` “falls under gravity” |
| Jumping works | A | `AcceptanceFlow` jump test |
| Cannot repeatedly jump while airborne | A | same test |
| Cannot fall through the terrain | A | `AcceptanceFlow` “cannot tunnel through terrain” |

### Camera

| Criterion | A/M | Where |
| --- | --- | --- |
| First-person camera | M | Step 3; `PlayerCamera` places the view at the player |
| Mouse-look works | A | `PlayerController.test.ts`; `AcceptanceFlow` look |
| Horizontal rotation works | A | `AcceptanceFlow` look test |
| Vertical rotation is clamped | A | same test |
| Camera follows the player’s position | M | Step 4–5; eye height is fixed to the player |
| Pointer lock works | M | Steps 2 and 5 |
| Escape releases pointer lock | M | Step 5 |

### Interaction

| Criterion | A/M | Where |
| --- | --- | --- |
| Screen center is used for targeting | A | `AcceptanceFlow` raycast from the view axis |
| A raycast determines the targeted block | A | `BlockRaycaster.test.ts`; `AcceptanceFlow` |
| Targeting range is limited | A | `AcceptanceFlow` out-of-range raycast |
| Targeted block is visually highlighted | M | Step 6; `BlockHighlight` |
| Left click breaks a valid targeted block | A | `AcceptanceFlow` break |
| Right click places a block on the targeted face | A | `AcceptanceFlow` place |
| Blocks cannot be placed inside the player | A | `AcceptanceFlow` rejected interactions |
| Blocks cannot be placed in occupied cells | A | same suite |
| Blocks cannot be placed outside world bounds | A | same suite |
| Rejected actions leave the world unchanged | A | same suite asserts modifications unchanged |

### Rendering

| Criterion | A/M | Where |
| --- | --- | --- |
| Blocks render correctly | M | Steps 3 and 7 |
| Visible faces are rendered | A | `ChunkMeshBuilder.test.ts` |
| Hidden internal faces are not rendered | A | same test |
| Block modifications update visible geometry | A | `ChunkMeshManager.test.ts`; `World` dirty tests |
| Chunk boundaries are handled correctly | A | `ChunkMeshBuilder.test.ts` |
| A block change does not rebuild the whole world | A | `World` dirty marking + `ChunkMeshManager.test.ts` |

### Persistence

| Criterion | A/M | Where |
| --- | --- | --- |
| A newly generated world can be saved | A | `AcceptanceFlow` save/reload; `WorldPersistence.test.ts` |
| Breaking a block is persisted | A | `AcceptanceFlow` save/reload |
| Placing a block is persisted | A | same test |
| Reloading restores modifications | A | same test |
| Saved data contains a version | A | `SaveData.test.ts` |
| Saved data contains the world seed | A | `SaveData.test.ts` |
| Saved data contains the required modifications | A | `SaveData.test.ts`; `WorldPersistence.test.ts` |
| Rendering objects are not persisted | A | `SaveData` shape; `WorldPersistence.test.ts` |
| Corrupted save data is detected | A | `AcceptanceFlow` recovery; `SaveData.test.ts` |
| Invalid save does not silently produce an invalid world | A | `AcceptanceFlow` recovery asserts a fresh world |

### General

| Criterion | A/M | Where |
| --- | --- | --- |
| Context menu does not interfere with right click | M | Step 7 (no menu appears) |
| Game remains playable at varying frame rates | A | `AcceptanceFlow` frame-rate/tunnel tests; `GameLoop.test.ts` |
| Important gameplay constants are configurable | A | `Config.test.ts`; `src/config/Config.ts` |
| World data remains independent from renderer state | A | `world/` imports no Three.js |
| Game can be expanded without replacing world representation | A | chunk + registry seams, covered by the above |

## Sign-off

- [ ] Playable flow steps 1–10 pass in the browser.
- [ ] Corrupt-save recovery backs up and starts fresh with a notice.
- [ ] Storage-unavailable notice is persistent and play continues.
- [ ] Varying frame rates keep movement consistent and safe.
- [ ] `npm test`, `npm run typecheck`, and `npm run build` all pass.
