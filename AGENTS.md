# AGENTS.md

## Technology Requirements

* **Language:** TypeScript
* **3D rendering:** Three.js
* **Build tool / dev server:** Vite
* **Unit testing:** Vitest
* **Persistence:** IndexedDB
* **Package manager:** Use the package manager already configured by the repository. Do not introduce another package manager.

### Required TypeScript Practices

* Use TypeScript for all application code.
* Enable strict TypeScript checking.
* Avoid `any` unless there is a documented technical reason.
* Prefer `unknown` with explicit validation when handling external data.
* Keep domain/game logic independent of Three.js where practical.
* Do not use Three.js objects as the application's persistent/domain data model.

### Additional Libraries

Additional libraries may be introduced when there is a concrete need.

Potential libraries include:

* **Rapier 3D** — physics and collision if custom collision handling becomes insufficient.
* **Zod** — validation of persisted or externally supplied data.
* **lil-gui** — development/debugging controls.

Do not add dependencies for functionality that can be implemented simply with the existing stack.

---

## Folder Structure

Use the following structure as the default:

```text
src/
├── app/
│   ├── Game.ts
│   └── GameLoop.ts
│
├── world/
│   ├── Block.ts
│   ├── BlockType.ts
│   ├── Chunk.ts
│   ├── World.ts
│   └── WorldGenerator.ts
│
├── player/
│   ├── Player.ts
│   ├── PlayerController.ts
│   └── PlayerPhysics.ts
│
├── interaction/
│   ├── BlockInteractor.ts
│   └── BlockRaycaster.ts
│
├── rendering/
│   ├── WorldRenderer.ts
│   ├── ChunkRenderer.ts
│   └── ...
│
├── persistence/
│   ├── WorldRepository.ts
│   └── IndexedDbWorldRepository.ts
│
├── input/
│   └── InputManager.ts
│
├── ui/
│   └── ...
│
└── tests/
    └── ...
```

The structure may evolve as the project grows, but keep responsibilities separated.

### Architecture Rules

* `world/` contains world/domain logic and should not depend on Three.js where possible.
* `player/` contains player state, movement, and physics.
* `interaction/` contains block interaction logic.
* `rendering/` contains Three.js-specific code.
* `persistence/` contains storage implementations and persistence abstractions.
* `input/` contains keyboard, mouse, and other input handling.
* `app/` contains application/game initialization and orchestration.
* `ui/` contains user-interface code.
* `tests/` contains unit and integration tests.

Do not put application logic directly into rendering classes unless it is specifically rendering-related.

### Architecture Reference

Before modifying application behavior, read `ARCHITECTURE.md`. It is the compact, source-verified map of the current architecture, extension points, lifecycle, and feature-to-file locations.

Keep `ARCHITECTURE.md` updated after major architectural or feature changes.

---

## Development Commands

The project should provide the following npm scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

### Start the Development Server

```bash
npm run dev
```

Open the URL reported by Vite, normally:

```text
http://localhost:5173
```

### Run Unit Tests

```bash
npm test
```

or:

```bash
npm run test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Type Check

```bash
npm run typecheck
```

### Create a Production Build

```bash
npm run build
```

### Preview the Production Build

```bash
npm run preview
```

---

## Testing Requirements

Unit tests are mandatory for application/domain logic.

When implementing or modifying functionality:

1. Add or update appropriate tests.
2. Run the test suite.
3. Run the TypeScript type checker.
4. Run the production build when appropriate.

Tests should preferably test game/domain logic without requiring a WebGL renderer.

Do not rely on real browser rendering for ordinary unit tests.

---

## Development Workflow

Before completing a change:

```bash
npm test
npm run typecheck
npm run build
```

All commands should pass.

Keep changes focused on the requested task. Do not perform unrelated refactoring.

When adding a dependency, update the appropriate package manifest and lockfile.

---

## Documentation

`AGENTS.md` is only concerned with:

* Technology requirements.
* Development architecture.
* Repository structure.
* Development commands.
* Testing requirements.

