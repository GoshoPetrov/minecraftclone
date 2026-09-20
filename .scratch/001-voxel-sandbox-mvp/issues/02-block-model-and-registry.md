# 02 — Block model and registry

**What to build:** A data-driven block model with one registry that is the single source of truth for what every block id means. Air is an explicit non-solid type, `basic_block` is the solid breakable default, and `bedrock` is solid but unbreakable. Physics, raycasting, and interaction can all ask the same place "is this solid / breakable?" without hard-coded id checks.

**Blocked by:** 01 — Project scaffold and render loop.

**Status:** done

- [ ] `BlockType` carries `id`, `name`, `solid`, `breakable`, and a typed `material` descriptor.
- [ ] Air is a real block type and is non-solid, so block queries never return a null/optional.
- [ ] `basic_block` is solid and breakable; `bedrock` is solid and unbreakable.
- [ ] A single registry maps ids to types and handles unknown ids deterministically without throwing.
- [ ] The material descriptor is open to a future atlas kind without changing block data.
- [ ] Unit tests cover id→type lookups and the solid/breakable invariants above.
