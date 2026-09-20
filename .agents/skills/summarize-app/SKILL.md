---

name: summarize-app

description: Create or refresh a compact ARCHITECTURE.md that gives future agents a verified map of the application's components, extension points, lifecycle, APIs, and feature-to-file locations. Also update AGENTS.md so agents know to read ARCHITECTURE.md before modifying the application. Use after major features or when the user asks to "summarize the app", "document the architecture", "update ARCHITECTURE.md", "map the components and APIs", or "how do I extend this app".

---

# Summarize App

Produce a **compact, source-verified architecture reference** for this repository.

The primary output is:

* `ARCHITECTURE.md` at the repository root, created or refreshed.
* `AGENTS.md`, updated minimally so agents are instructed to read `ARCHITECTURE.md` when working on the application.

This skill is intended to be run **repeatedly after major features**. Optimize for high information density and future feature development, not exhaustive documentation.

The document should answer, quickly:

1. **Where does this behavior live?**
2. **What real API should I use or extend?**
3. **What lifecycle/update order matters?**
4. **What invariants or cross-cutting obligations must I preserve?**
5. **Which files are involved in this feature?**

Do not turn the document into a tutorial or a description of every implementation detail.

## Accuracy bar

Treat accuracy as a hard requirement.

### 1. Verify APIs from source

Every identifier, function, method, type, interface, class, config key, and lifecycle claim in `ARCHITECTURE.md` must be verified against the source.

Never infer a signature from a name.

If uncertain:

* search for the definition;
* read the surrounding implementation;
* inspect its callers when behavior or lifecycle matters.

Prefer real signatures over prose.

### 2. Describe actual extension surfaces

Distinguish between:

* an existing public API;
* an exported type used as an extension seam;
* an internal/private implementation detail;
* a place where new code must be added because no API currently exists.

Never imply that a private field, local variable, or implementation detail is a supported API.

If the only practical extension point is internal, say so explicitly, for example:

> `Game.update()` owns this stage; there is no public registration API. Add the new system at this stage.

### 3. Capture obligations, not trivia

Document behavior that a future feature can accidentally break:

* update ordering;
* ownership;
* dirty-state tracking;
* save scheduling;
* validation;
* event dispatch;
* cache invalidation;
* coordinate/state transformations;
* initialization requirements;
* cleanup/disposal;
* dependency direction.

Do not document incidental implementation details that do not affect extension.

### 4. State important absences

If an expected subsystem does not exist, say so briefly when that absence affects extension.

Examples:

* `No inventory subsystem exists.`
* `World state is not persisted as snapshots.`
* `There is no generic system/plugin registry.`
* `Physics is implemented directly in the movement code; no physics engine is used.`

Do not invent abstractions that the project does not have.

### 5. Use repository vocabulary

Use terminology from:

* `AGENTS.md`;
* `README.md`;
* `docs/`;
* domain types;
* exported APIs.

Do not introduce alternative terminology unless necessary for clarification.

### 6. Avoid volatile detail

Do not include:

* line numbers;
* commit hashes;
* timestamps;
* generated IDs;
* temporary implementation details;
* exact counts of files unless useful.

Use stable file paths and identifiers.

---

# Process

## 1. Determine scope

Default scope: the whole application.

If the user explicitly names a subsystem, focus the architecture summary on that subsystem and state the scope in the document.

Before investigating the repository:

1. Read the existing `ARCHITECTURE.md`, if present.
2. Read `AGENTS.md`.
3. Read `README.md`.
4. Read relevant `docs/`.
5. Identify the project/package structure.

If `ARCHITECTURE.md` already exists:

* update it in place;
* preserve useful existing structure;
* remove stale claims;
* add newly introduced extension surfaces;
* do not rewrite sections that remain accurate merely for stylistic reasons.

The goal is **incremental maintenance**, not regeneration for its own sake.

---

## 2. Build a focused repository inventory

Inspect the files that establish project structure and execution:

* `package.json` or equivalent manifest;
* lockfile/package-manager configuration when relevant;
* `AGENTS.md`;
* `README.md`;
* relevant `docs/`;
* TypeScript/compiler configuration such as `tsconfig.json`;
* application entry points;
* source directories;
* test directories;
* central configuration.

Determine:

* language/framework/runtime;
* application entry points;
* major source folders;
* test strategy;
* build/typecheck/test commands;
* dependency boundaries;
* central configuration;
* persistence mechanism;
* application lifecycle.

Do not blindly expand into generated/vendor/build directories.

---

## 3. Read source by architectural responsibility

Read the relevant source files, not just filenames.

Group files into meaningful subsystems such as:

* domain/state;
* world/model;
* player/avatar;
* interaction;
* rendering;
* UI/HUD;
* input;
* persistence;
* configuration;
* application lifecycle;
* infrastructure;
* tests.

For each important subsystem, determine only what a future feature developer needs:

* responsibility;
* important files;
* exported/usable APIs;
* extension seams;
* ownership/invariants;
* dependencies;
* lifecycle position.

Do not list every exported symbol. Include symbols that are useful for extending or understanding the subsystem.

---

## 4. Identify extension seams

Prioritize the places where future features are expected to connect.

Look for:

* interfaces with implementations;
* factories;
* registries;
* dependency injection;
* repositories;
* schedulers;
* event systems;
* command/action systems;
* rendering/material registries;
* controllers;
* application lifecycle hooks;
* central configuration;
* serialization/schema boundaries.

For each meaningful seam, answer:

> **If I need to add X, where does X plug in?**

If there is no reusable seam, document the actual location where the code must be changed.

---

## 5. Identify feature-critical surfaces

Document only surfaces that actually exist in the repository.

Potential surfaces include:

### World/state

* read/write/query APIs;
* mutation ownership;
* dirty tracking;
* edit tracking;
* validation;
* persistence implications.

### Player/avatar

* state type;
* spawn/initialization;
* controller/input;
* update/step;
* state transitions;
* interaction with world state.

### Interaction

* targeting/raycasting;
* hit validation;
* action/command dispatch;
* mutation entry points.

### Rendering

* renderer entry points;
* scene/object/material registration;
* render state;
* resource ownership;
* lifecycle.

### HUD/UI

* component/overlay/presenter;
* static markup;
* styling;
* live data flow;
* event/state subscription.

### Persistence

* repository/storage interface;
* save/load entry points;
* serialization;
* schema/validation;
* versioning/migrations;
* save scheduling.

### Configuration

* configuration source;
* schema/types;
* environment/runtime loading;
* tuning keys;
* extension procedure.

### Application lifecycle

Document the actual high-level order, for example:

```text
input → simulation → world mutation → persistence scheduling → rendering → UI
```

Only include stages that actually exist, and use the repository's terminology.

---

## 6. Keep the architecture compact

`ARCHITECTURE.md` is a **fast-reference document**, not a source-code index.

Prefer:

* tables;
* short bullets;
* concise API blocks;
* one-line invariants;
* one-line dependency rules;
* feature-to-file mappings.

Avoid:

* long explanations;
* tutorials;
* duplicated README content;
* exhaustive symbol inventories;
* implementation walkthroughs;
* speculative future architecture.

A future agent should be able to scan the document in a few minutes and know where to start.

---

# ARCHITECTURE.md structure

Use this structure unless the repository clearly requires a small adaptation.

# Architecture

One short paragraph covering:

* what the application is;
* stack/runtime;
* major architectural boundary;
* where canonical project rules live;
* purpose of this document.

Reference `AGENTS.md`, `README.md`, and relevant `docs/`.

State that the document describes the **current source architecture and verified extension points**.

## 1. Guiding Principles

Only include principles that materially affect feature development.

Examples:

* domain state is the source of truth;
* persistence stores deltas;
* rendering does not own domain state;
* dependencies point inward;
* configuration is the tuning surface;
* mutations must go through a particular API.

Use the repository's actual rules.

## 2. Layer / Dependency Map

Use a compact ASCII diagram.

Example shape:

```text
Input
  ↓
Application / Game Loop
  ↓
Domain State ←→ Persistence
  ↓
Rendering
  ↓
HUD
```

Follow it with the actual dependency rule:

> `X` may import `Y`; `Y` must not import `X`.

Only document dependency relationships verified from imports.

## 3. Lifecycle / Update Order

If lifecycle ordering matters, give it its own compact section.

Example:

```text
1. Input
2. Player update
3. World/system updates
4. Persistence scheduling
5. Rendering
6. HUD update
```

Each stage should link to the relevant file/component.

Do not invent an order from architectural convention; verify it from the code.

## 4. Component Reference

Organize by subsystem.

For each significant subsystem:

````text
### World

| File | Responsibility |
|---|---|
| src/world/... | ... |
| src/... | ... |

Key API:

```ts
// real signatures only
...
````

Extension notes:

* ...
* ...

````

Only include APIs that future feature work is likely to use.

Cover applicable subsystems such as:

- application/lifecycle;
- domain/state;
- world;
- player/avatar;
- interaction;
- rendering;
- input;
- HUD/UI;
- persistence;
- configuration.

Omit empty or irrelevant subsections.

## 5. Extension Recipes

This is the highest-value section.

Include only recipes supported by actual extension seams in the repository.

Examples:

### Add a world mutation

1. Call/extend `...`.
2. Preserve `...` invariant.
3. Mark/schedule `...` if required.
4. Update `...` if the mutation affects rendering/UI.

### Add a player behavior

1. Extend `...`.
2. Update state through `...`.
3. Hook the behavior into `...`.
4. Preserve `...` lifecycle ordering.

### Add persisted state

1. Extend `...`.
2. Update serialization/schema at `...`.
3. Update load/default handling at `...`.
4. Ensure save scheduling occurs through `...`.
5. Update validation/tests at `...`.

Recipes must reference real files and APIs.

Do not provide generic framework advice.

## 6. Testing / Verification

Document:

- test locations;
- relevant test patterns;
- headless/testable boundaries;
- injectable seams;
- repository/scheduler doubles;
- typecheck/lint/test commands.

Only include commands verified from the repository.

If no meaningful test infrastructure exists, say so briefly.

## 7. File Map by Feature

Use a compact table:

| Feature | Files |
|---|---|
| World mutation | `...`, `...` |
| Player movement | `...`, `...` |
| Interaction | `...`, `...` |
| Persistence | `...`, `...` |
| HUD | `...`, `...` |

Include the features that are actually present and likely to be extended.

---

# AGENTS.md update

`AGENTS.md` is a separate concern from `ARCHITECTURE.md`.

Do not copy the architecture into `AGENTS.md`.

Instead, ensure the relevant application-development instructions contain a short directive equivalent to:

```md
## Architecture reference

Before modifying application behavior, read `ARCHITECTURE.md`.
It is the compact, source-verified map of the current architecture,
extension points, lifecycle, and feature-to-file locations.

Keep `ARCHITECTURE.md` updated after major architectural or feature changes.
````

### AGENTS.md rules

* Preserve existing `AGENTS.md` structure and instructions.
* Add the reference in the most appropriate existing section.
* If an equivalent instruction already exists, update it rather than adding a duplicate.
* Keep the addition short.
* Do not make `AGENTS.md` depend on details that belong in `ARCHITECTURE.md`.
* Do not overwrite unrelated agent instructions.

If no `AGENTS.md` exists, create one only if that is consistent with the repository's conventions; otherwise report that the architecture reference could not be wired into an existing agent-instruction file.

---

# Incremental refresh behavior

This skill will be run repeatedly.

When `ARCHITECTURE.md` exists, treat the previous document as a **cache of architectural knowledge**, not as authoritative truth.

For every refresh:

1. Read the existing document.
2. Identify sections affected by recent source changes.
3. Re-verify existing claims that are retained.
4. Remove stale APIs/files/invariants.
5. Add new extension points.
6. Update lifecycle/dependency information when changed.
7. Update feature-to-file mappings.
8. Keep unaffected sections concise and stable.

Do not expand the document merely because more source code exists.

A major feature should result in a document that tells the next agent:

> "This is the new thing, this is where it lives, this is the API, this is what it touches, and these existing rules still apply."

---

# Verification

Before finishing:

### Source verification

For every cited API:

* verify its definition;
* verify exported/public visibility;
* verify the signature;
* verify relevant callers when lifecycle/ownership is described.

### Dependency verification

Check that documented dependency direction matches actual imports.

### Lifecycle verification

Trace the relevant entry point and confirm the documented execution order.

### Persistence verification

For state-changing features, verify whether:

* dirty state is tracked;
* a save is scheduled;
* serialization changes;
* schema validation changes;
* migration/default handling is required.

### Documentation verification

Check that:

* all referenced files exist;
* all important identifiers exist;
* no stale feature is described as present;
* no unsupported API is presented as public;
* no line numbers or volatile details were introduced;
* terminology matches the repository.

Do not run tests/typecheck solely because this skill changes documentation. Run them only when needed to validate a documentation claim or when the repository's verification workflow requires it.

---

# Report

After updating the files, report briefly:

1. `ARCHITECTURE.md` created or updated.
2. `AGENTS.md` created or updated, including the architecture-reference instruction.
3. The major architectural/features changes reflected.
4. Any claims, APIs, or subsystem behavior that could not be confirmed.

Do not reproduce the architecture document in the response.
