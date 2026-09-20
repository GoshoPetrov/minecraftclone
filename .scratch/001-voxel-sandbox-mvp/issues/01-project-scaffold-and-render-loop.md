# 01 — Project scaffold and render loop

**What to build:** The repository becomes a runnable, strictly-typed game project: `npm run dev` opens a full-viewport canvas that renders a sky-coloured background at the correct aspect ratio, driven by a `requestAnimationFrame` loop with clamped delta time. This is the verification harness every later ticket builds on.

**Blocked by:** None — can start immediately.

**Status:** done

- [ ] Vite, Three.js, Vitest and strict TypeScript are wired in, with the `AGENTS.md` scripts (`dev`, `build`, `preview`, `test`, `test:watch`, `typecheck`) present and passing.
- [ ] Strict type checking is enabled and no `any` is used.
- [ ] A canvas fills the viewport, shows a sky-coloured background, and updates on resize without distortion.
- [ ] A render loop derives movement from delta time and clamps it for hitch/tab-switch protection.
- [ ] A documented fixed update order is established (input → look → physics → raycast/highlight → actions → mesh flush → render) even where stages are empty.
- [ ] Three.js is confined to the rendering layer; the app layer orchestrates without leaking renderer objects into domain code.
