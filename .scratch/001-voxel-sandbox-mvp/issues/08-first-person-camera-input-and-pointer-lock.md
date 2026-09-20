# 08 — First-person camera, input, and pointer lock

**What to build:** The player can actually play: click the viewport to capture the mouse, look around with the mouse, walk with WASD relative to where they face, and jump — all in first person, with the camera tracking the player at eye height. All keyboard, mouse, and pointer-lock handling lives in one input system. The player spawns safely above the terrain with headroom.

**Blocked by:** 06 — Render the world; 07 — Player physics.

**Status:** ready-for-agent

- [ ] Clicking the canvas captures the mouse; the cursor is locked while playing; `Escape` releases it; the context menu is suppressed on the game view.
- [ ] Mouse movement rotates the view, with unlimited horizontal rotation and vertical look clamped so the camera never flips.
- [ ] WASD moves relative to the player's facing direction, and `Space` jumps, both frame-rate independently.
- [ ] The camera follows the player's position at the configured eye height and reflects yaw/pitch.
- [ ] While the mouse is unlocked, player input is paused (no movement, look, or actions) while rendering and world/persistence keep running; a click-to-play hint is shown.
- [ ] The player spawns above the terrain with two blocks of headroom, never inside a block or in the void, scanning outward if the centre column is blocked.
- [ ] All listeners are centralised in one input system; keys are identified by physical key code; accumulated mouse delta is consumed once per frame; mouse presses are queued and consumed one action each; game systems never touch DOM events directly.
