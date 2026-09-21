# Spec 004 — F3 Coordinate Readout

**Status:** ready-for-agent
**Source:** product conversation (F3 coordinate request + grilling session)
**Scope:** add a toggleable debug readout, bound to F3, that shows the avatar's current coordinates in the top-left of the screen

---

## Problem Statement

A player moving through the voxel world has no way to tell *where they are*. There
is no coordinate display anywhere in the HUD, so the player cannot read off their
position, share it with someone else, confirm that a saved world restored to the
right place, or diagnose why they ended up somewhere unexpected. The world now
spans 128 × 128 blocks, which makes "I am somewhere in the terrain" an increasingly
unhelpful answer to "where am I".

Every comparable voxel sandbox exposes a debug readout on F3, and its absence makes
the world feel opaque: the player has to move around and guess rather than read a
number.

## Solution

Add a **debug toggle bound to F3**. Pressing F3 shows a small readout in the
**top-left** of the screen; pressing it again hides the readout. The readout starts
hidden every session.

The readout shows the avatar's **feet-centre position** as a single labelled line:

```
XYZ: 12.5 / 24.0 / -3.5
```

The value is the avatar's authoritative world position (the centre of the feet, as
used by physics, spawn, and collision), rendered to one decimal place. It is not the
camera eye position, so it does not change when the player crouches.

The readout is **independent of pointer lock**: once toggled on it stays visible
while the pointer is unlocked and while the click-to-play overlay is up. It is
purely a diagnostic view — it never touches the world, is never persisted, and adds
no new runtime dependency.

The F3 hint is added to the click-to-play control list so the feature is
discoverable.

## User Stories

### Reading coordinates

1. As a player, I want to press F3 to show my coordinates, so that I can tell where I am in the world.
2. As a player, I want to press F3 again to hide the readout, so that it does not clutter my view when I do not need it.
3. As a player, I want the readout to start hidden, so that a normal session is uncluttered until I ask for it.
4. As a player, I want to see my X, Y, and Z coordinates labelled, so that I know which number is which axis.
5. As a player, I want the coordinates to update continuously as I move, so that the readout reflects where I am right now.
6. As a player, I want decimal precision in the coordinates, so that I can see movement within a block rather than a frozen integer.
7. As a player, I want negative coordinates to display correctly, so that the readout stays readable at any world position.
8. As a player, I want the coordinates to be my feet position, so that the number matches where the game considers me to be standing.
9. As a player, I want the coordinates to stay stable when I crouch, so that a purely postural change does not appear to move me.
10. As a player, I want the readout in the top-left corner, so that it does not cover the crosshair or the world behind it.
11. As a player, I want the readout to be legible against any terrain, so that I can read it over sky, water, or shadow.
12. As a player, I want the readout to be unobtrusive, so that it does not dominate the view.

### Interaction and focus

13. As a player, I want to toggle the readout while playing, so that I do not have to leave pointer lock to use it.
14. As a player, I want the readout to stay visible when I unlock the pointer, so that a stray Escape does not silently hide something I asked for.
15. As a player, I want the readout to stay visible over the click-to-play overlay, so that its state is mine to control and nothing else.
16. As a player, I want pressing F3 to not open the browser's find bar, so that the key is fully captured by the game.
17. As a player, I want the readout to remain once toggled on even as I break and place blocks, so that it behaves like a stable panel rather than a transient message.
18. As a player, I want the readout to not intercept my mouse clicks, so that toggling it on never blocks aiming or block interaction.

### Discoverability

19. As a player, I want F3 listed among the controls on the click-to-play screen, so that I can discover the feature without being told.

### Procedural and systemic guarantees

20. As a developer, I want the F3 binding to be an ordinary entry in the central tuning configuration, so that the input manager needs no new code.
21. As a developer, I want the toggle to be detected from the held key each frame, so that key-repeat does not flip the readout many times per press.
22. As a developer, I want the debug visibility state to be owned by application orchestration, so that no gameplay state leaks into the UI layer.
23. As a developer, I want the UI presenter to be dumb, so that it only renders plain values it is handed and holds no game state.
24. As a developer, I want the coordinate string to be produced by a pure, DOM-free function, so that it is trivially unit-testable.
25. As a developer, I want the readout element to be optional to the game, so that the game still constructs and runs headless in tests.
26. As a developer, I want the coordinate readout to read the same authoritative player state that physics produces, so that the display can never disagree with the simulation.
27. As a developer, I want the readout updated only when its text actually changes, so that a per-frame DOM write is avoided when standing still.
28. As a developer, I want no change to the world, interaction, rendering, or persistence modules, so that the blast radius stays small.
29. As a developer, I want no change to the save schema or persistence cadence, so that existing saves remain loadable and no debug state is stored.
30. As a developer, I want no new runtime dependency, so that the change stays within the existing stack.
31. As a developer, I want strict type checking to keep the architecture's dependency direction intact, so that UI and orchestration do not reach into each other incorrectly.
32. As a developer, I want the architecture reference kept current, so that the next feature starts from an accurate map of the HUD and input seams.

### Verification

33. As a tester, I want the coordinate formatting pinned by a unit test, so that the label, separators, precision, and negative values cannot drift silently.
34. As a tester, I want to verify the formatter headlessly without a browser or WebGL, so that the suite stays fast and reliable.
35. As a tester, I want a manual acceptance pass for the toggle and its on-screen placement, so that the browser-only wiring is still checked.

## Implementation Decisions

### Modules modified

- **Central tuning configuration** — gains a single new binding entry for the debug
  toggle. No other constants change.
- **Application orchestration** — owns the debug visibility flag, detects the F3
  rising edge while polling input, and updates the presenter in a new final update
  stage after the camera has been positioned.
- **Game options** — gain an optional debug element alongside the existing optional
  overlay and notices elements, spread-guarded so the game still runs with no UI.
- **New UI presenter module** — a dumb presenter over one element, exposing
  show/hide and set-text, plus the exported pure formatter.
- **HUD markup and styling** — a new debug element in the page and its stylesheet
  rules.
- **Entry point** — queries the new element and passes it to the game when present.
- **Architecture reference** — updated for the input bindings table, the HUD
  section, and the file-by-feature map.

The **input manager does not change**: it already tracks exactly the key codes listed
in the configured bindings (and already suppresses the default action for them, which
is what stops F3 opening the browser's find bar).

The **world, interaction, rendering, and persistence modules do not change.**

### Configuration

- A new binding, `input.bindings.debug = 'F3'`, is added to the tuning surface. It is
  expressed as a physical `KeyboardEvent.code`, consistent with the existing
  movement bindings.
- No new tunable numeric constant is required by this feature.

### Input and toggle detection

- The toggle is detected by a **rising edge**, not by held state: orchestration keeps
  a "was the debug key held last frame" flag and toggles the visibility flag only on a
  `false → true` transition. Key-repeat therefore cannot toggle the readout more than
  once per physical press.
- The toggle is evaluated during the existing once-per-frame input poll. No new DOM
  listener is added anywhere; the input manager remains the only owner of DOM input.
- Because the input manager clears held keys on blur and on pointer-lock loss, an
  edge can never be manufactured by losing focus while F3 is down.

### Coordinate source and format

- The value shown is the avatar's `position` — the centre of the feet, the same
  field physics advances and the world treats as the avatar's location. It is not
  derived from the camera eye height, so crouching does not change it.
- The display string is a single labelled line in the form
  `XYZ: <x> / <y> / <z>`, with each component rendered to **one decimal place**.
- Formatting is implemented as a **pure, DOM-free function** taking the plain
  position value and returning the string. The presenter never builds the string
  itself.

The formatter's contract (decision-rich shape):

```ts
formatDebugPosition(position: Vec3): string
// e.g. { x: 12.5, y: 24, z: -3.5 } -> "XYZ: 12.5 / 24.0 / -3.5"
```

### UI presenter

- The presenter owns one element supplied by the page. It exposes:
  - show/hide, which ignores redundant changes (mirroring the existing click-to-play
    overlay presenter);
  - set-text, which writes the text only when it differs from the previous value, so
    a stationary player causes no per-frame DOM mutation.
- The presenter attaches no listeners and holds no game state. It receives plain
  values and nothing else.

### Update order

- A new stage updates the readout **after** the camera stage, so it always reads the
  position the frame has settled on. The debug stage is read-only: it observes player
  state and writes DOM text; it never mutates the world or the player.
- The visibility flag is toggled in the input-poll stage; the presenter's show/hide
  is applied in the same update so the visual change is immediate on the frame the
  key is pressed.

### HUD markup and styling

- The readout is a single element in the page, initially hidden.
- It is positioned in the **top-left**, uses a monospace font and a translucent dark
  backing with a contrasting text colour so it stays legible over any terrain, and is
  set to ignore pointer events so clicks pass through to the canvas.
- It uses only static markup for now (a single text line); no multi-row panel
  structure is pre-built.

### Discoverability

- The click-to-play control list gains a debug entry (for example `F3 coordinates`)
  so the binding is advertised.

## Testing Decisions

**What makes a good test here:** assert observable, external behaviour through a
module's public API, with no WebGL, DOM, or real IndexedDB. For this feature the only
branchy logic is the coordinate string, so the observable behaviour is the exact
string a given position produces. Tests assert on that string, not on private
helpers or the presenter's internal element handling.

**Seam (one, new): the pure position formatter.** The formatter is the highest point
at which the display output of this feature is observable, and it is DOM-free by
design. A single seam covers the searchable behaviour; the presenter, the toggle
wiring, and the placement are presentation glue with no branching worth a second
seam. Keeping the formatter pure is what allows the suite to stay headless.

**Module tested and what is pinned:**

- **Position formatter** (new test, node environment):
  - the `XYZ:` label is present;
  - the three components appear in X, Y, Z order, separated by ` / `;
  - each component is rendered to exactly one decimal place (integer input still
    yields one decimal);
  - negative components render with a leading minus sign;
  - a representative fractional position produces the exact expected string.

**Prior art:** the existing focused, single-purpose pure-logic test files (for
example the configuration guard, and the physics step tests that assert exact derived
values). The formatter test follows the same shape: construct a plain value, call the
function, assert the exact string.

**Not unit-tested (consistent with the existing rendering/UI boundary):** the DOM
presenter, the F3 rising-edge toggle, the update-stage wiring, and the on-screen
placement. These require a browser and are covered by the manual acceptance pass
below; no jsdom dependency or new test seam is introduced for them.

**Manual acceptance pass (in-browser):** press F3 and confirm the readout appears in
the top-left; press it again and confirm it disappears; confirm it starts hidden on
load; confirm it updates while walking, jumping, and falling; confirm it does not
change when crouching; press Escape and confirm the readout stays visible over the
click-to-play overlay; confirm F3 does not open the browser's find bar; confirm mouse
clicks still reach the canvas while the readout is visible; confirm no notice or
overlay is disturbed.

**Required commands after the change:** `npm test`, `npm run typecheck`,
`npm run build`. All must pass.

## Out of Scope

- Additional debug lines: FPS, chunk coordinates, block coordinates, facing
  direction, biome, light level, or any Minecraft-style multi-row debug panel.
- A configurable or remappable debug key, or a settings UI for it.
- Hold-to-show behaviour; F3 is a toggle.
- Copying coordinates to the clipboard, sharing them, or a chat/command system.
- Persisting the readout's visibility across sessions or into the save file.
- Any change to the save schema, persistence cadence, world generation, world size,
  rendering, or interaction range.
- Any new runtime dependency (including a test-only DOM environment).
- Mobile/touch equivalents, or on-screen buttons for the toggle.
- Overlaying the readout on the middle or right of the screen, or making it
  re-positionable.

## Further Notes

- **Why feet, not eye.** The eye position is derived state that dips when crouching
  (1.62 standing to 1.2 crouched). Showing it would make the coordinates jump for a
  purely postural change and would duplicate a value the avatar already exposes
  authoritatively. The feet centre is the avatar's actual location.
- **Why independent visibility.** Coupling the readout to pointer lock means a
  spontaneous lock loss (for example an Escape, or the window losing focus) would
  silently hide a panel the player explicitly asked for. The readout is a diagnostic
  the player controls; only F3 should change whether it is shown.
- **Why rising-edge detection in orchestration.** The input manager intentionally
  exposes held state and a queued-press queue for mouse buttons only. A toggle needs
  "down once", and per-frame edge detection of the held state provides exactly that
  without expanding the input manager's API or needing to reason about key-repeat
  events. It also keeps the input manager the sole owner of DOM listeners.
- **Why a pure formatter.** The repo deliberately keeps its test suite headless.
  Isolating the one piece of string logic lets it be tested in the node environment,
  so no DOM-emulation dependency is added to the project.
- **Layering.** This is a clean exercise of the existing layers: a config binding, a
  poll and a toggle in orchestration, a dumb UI presenter, and static HUD markup. The
  world stays the single source of truth for block data, the renderer is untouched,
  and nothing new is persisted.
- **Relationship to the HUD.** Before this change the HUD was the crosshair, the
  click-to-play overlay, and persistence notices. This adds the first player-toggled
  diagnostic panel; the presenter shape chosen here (show/hide plus set-text) leaves
  room to add further debug rows later without reworking the plumbing.
