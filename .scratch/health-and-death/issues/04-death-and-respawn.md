# 04 — Death, freeze, and respawn

**What to build:** When the avatar's health reaches zero it dies: the avatar freezes in place, pointer lock is released, and a "You died!" overlay appears with a Respawn button. The click-to-play overlay is suppressed while dead, and a stray click on the death screen cannot break or place a block. Clicking Respawn returns the avatar to the deterministic world spawn at full health, keeps the current view direction, re-captures the pointer, and leaves every block the player edited untouched.

**Blocked by:** 02 — Fall damage; 03 — Void damage (lethal damage is needed to die, and the void is the case the freeze protects).

**Status:** ready-for-agent

- [ ] On the frame health first reaches zero, orchestration marks the avatar dead, releases pointer lock, and shows the death overlay.
- [ ] The game freezes the avatar while dead by skipping the physics stage, so it neither keeps falling through the void nor accrues further damage; rendering, camera, and HUD continue behind the overlay.
- [ ] The click-to-play overlay is shown only when the pointer is unlocked and the avatar is not dead, so the two overlays never compete.
- [ ] The death overlay shows a clear "You died!" message and a Respawn button, and is shown/hidden without holding any game state.
- [ ] The Respawn action reaches orchestration through an explicit callback from the overlay; the UI never reads game systems.
- [ ] Respawn builds a fresh player state from the deterministic spawn search (which re-reads the current world and therefore respects player edits), creates fresh vitals, clears the dead flag, hides the overlay, and clears velocity and fall state.
- [ ] Respawn keeps the camera yaw and pitch, and requests pointer lock from the Respawn click's user gesture so play resumes immediately.
- [ ] Break and place actions stay ignored while the pointer is unlocked, so a click on the death screen cannot edit the world.
- [ ] The input manager gains a `releasePointerLock` operation and remains the only place that calls the Pointer Lock API.
- [ ] `GameOptions` gains an optional death-overlay element so the game still constructs and runs headless when it is absent.
- [ ] The page markup and stylesheet provide the death overlay, and the entry point queries it and passes it to the game only when present.
- [ ] A headless acceptance test proves a lethal drop and a void fall both end dead, and that a respawn from the spawn search yields a fresh, full-health, grounded-able state.
- [ ] A manual browser pass confirms the overlay appears with the play overlay suppressed, the avatar is frozen, pointer lock releases and re-locks, a stray click is ignored while dead, and world edits survive death and respawn.
- [ ] No change is made to `PlayerPhysics.step`, `PlayerState`, the world, interaction, rendering, or the save schema; health and death state are transient.
- [ ] `npm test`, `npm run typecheck`, and `npm run build` pass.
