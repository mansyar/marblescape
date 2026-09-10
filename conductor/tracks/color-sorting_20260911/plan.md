# Implementation Plan — Color Sorting

Branch: `track/color-sorting` · Spec: [spec.md](./spec.md)

Workflow discipline: strict TDD (failing tests → green → refactor → coverage → commit + git note → plan update). Status markers: `[ ]` pending, `[~]` in progress, `[x]` complete (append commit SHA).

## Phase 1 — Domain: colors, schema v2, scripts, levels 7–9 (TDD) [checkpoint: 479bd63]

- [x] Task: Write failing tests for the color model (`src/domain/colors.ts`) and goal-piece color field [1518768]
  - [x] `MarbleColor` union derived from `MARBLE_PALETTE` (6 candy colors); cycle helper (tap order); color→hex lookup
  - [x] `PlacedPiece` gains optional `color` (goal pieces only); non-goal pieces stay color-free by type
  - [x] Tests: cycle wraps all 6; unknown color rejected
- [x] Task: Implement the color model to green; >80% coverage [1518768]
- [x] Task: Write failing tests for board schema v2 (`src/domain/board.ts`) [cf58599]
  - [x] `SCHEMA_VERSION → 2`; `toJSON`/`fromJSON` handle optional `color` with strict validation (known value, goal-only)
  - [x] v1 fixture migrates losslessly (colorless goal = classic cup); corrupt data still → null
- [x] Task: Implement schema v2 + migration to green; >80% coverage [cf58599]
- [x] Task: Write failing tests for sorting-level domain (`src/domain/levels.ts`, `src/domain/puzzle.ts`) [2782ed0]
  - [x] `LevelDef`: goals as colored cups (classic single-goal shape still validated), optional ordered `marbleColors` script, id range → 1–9
  - [x] Pure script consumption: first scripted color with unmet required count; per-color collected accounting
  - [x] `validateLevel`: sorting levels need ≥2 unique colored cups, no classic goal, non-empty script whose colors all have cups
  - [x] `isLevelSolvable`: each scripted color independently routable from spawn to its matching cup (classic check preserved)
- [x] Task: Implement sorting-level domain to green; >80% coverage [2782ed0]
- [x] Task: Write failing tests + author levels 7–9 (L7 two colors/one reroute · L8 funnel combo · L9 three-color finale); validation + solvability must pass [479bd63]
- [x] Task: Implement levels 7–9 to green; `pnpm check` clean [479bd63]
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2 — Physics: cup lids & colored collection (TDD)

- [x] Task: Write failing tests for lid colliders (`src/physics/piece-colliders.ts`): `goalWithHole` open (existing ring) vs closed (full slab + rim); rotation support unchanged [f697df4]
- [x] Task: Implement lid collider variants to green; >80% coverage [f697df4]
- [x] Task: Write failing tests for multi-goal floor sync (`src/physics/board-bodies.ts`): `syncFloorBodies(world, existing, openHoles[])` — floor skipped only under open holes; closed cups get floor [28ab0a0]
- [x] Task: Implement multi-goal floor sync to green; migrate call sites; >80% coverage [28ab0a0]
- [x] Task: Write failing tests for colored spawn & collection (`src/physics/marbles.ts`) [8dfe104]
  - [x] `spawnDrop(cellX, cellZ, color?)` — explicit color overrides the random candy sequence; `setGoalCells([{x,z,color|null}])` [8dfe104]
  - [x] Match: classic cup collects any color; colored cup only its own; `onCollected` carries the marble's color [8dfe104]
- [x] Task: Implement colored spawn & collection to green; >80% coverage [8dfe104]
- [~] Task: Write failing tests for the lid state machine (`src/game/game.ts`)
  - [ ] Open holes = cups compatible with the collectible marble (live marble in flight, else next previewed color); classic cup always open
  - [ ] Re-evaluated on spawn/collect, cup place/move/remove/cycle, level enter/exit; wired through `syncPieces`
- [ ] Task: Implement lid state machine to green; wire floor + marble goal updates together
- [ ] Task: Extend e2e reliability: 20 matching colored drops (all collected, zero rescues) + mismatch roll-over run (no collection, no escapes, no body leak)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3 — Interaction & UI: waiting marble, tap-to-cycle, palette (TDD)

- [ ] Task: Write failing tests for the waiting-marble preview (`src/game/game.ts`, `src/render/`)
  - [ ] Non-physics mesh at the spawn point (fixed chute in levels, top-center in sandbox); hidden while a marble is live; truthfully shows the next color
  - [ ] Static under reduced motion; test hooks + testid
- [ ] Task: Implement the waiting-marble preview to green
- [ ] Task: Write failing tests for tap-to-cycle
  - [ ] Sandbox: tap the spawn/chute cell with no live marble cycles the preview color (existing tick); level chute taps are a no-op
  - [ ] Placed colored cup: tap cycles its color in both modes (replaces rotate); tint pulse (instant under reduced motion)
- [ ] Task: Implement tap-to-cycle + cup tint pulse to green; wire gestures in `src/main.ts`
- [ ] Task: Write failing tests for the palette color-cup tile (`src/ui/palette.ts`, `src/main.ts`)
  - [ ] Palette items become `{type, color?}`; cup tile tap-vs-drag discrimination (tap cycles swatch, drag places colored cup)
  - [ ] `Game.place`/`currentPalette` carry optional color; level palettes normalized (legacy string entries keep working)
- [ ] Task: Implement palette changes to green; both orientations fit 5 tiles; existing palette e2e selectors updated
- [ ] Task: e2e: sandbox cycle → Play drops exactly the previewed color; colored cup place + retint flow
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Sorting levels: solve flow & visible progress (TDD)

- [ ] Task: Write failing tests for per-color solve accounting (`src/game/game.ts`, `src/domain/solve.ts`)
  - [ ] Collected counts per color vs script; solved when all met → existing chime/sparkle/confetti/overlay + ✓ badge
  - [ ] Lost marble: next Play drops the first unmet color; partial progress persists across replays within the level
  - [ ] Collected marbles rest visibly in their cups (non-physics trophy meshes, cleared on reset/exit)
- [ ] Task: Implement solve accounting + trophy cups to green
- [ ] Task: Write failing tests + wire levels 7–9 into level select (`src/ui/level-select.ts`); badges for 7–9 refresh correctly
- [ ] Task: e2e `tests/e2e/levels.spec.ts`: scripted solve of L7; smoke-pass L8/L9; preview recovery after a wandered marble; mismatches never fail
- [ ] Task: Manual feel pass (portrait + landscape): lid readability, cycle affordance, color clarity (incl. color-blind spot check)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5 — Track completion

- [ ] Task: Docs sync (`tech-stack.md`: colors/lids/preview/schema v2, no new deps/assets; `product.md`: color sorting moves from non-goals to shipped scope)
- [ ] Task: Run full 4-viewport e2e matrix locally against the production build (incl. reliability + colored runs)
- [ ] Task: Push branch, open PR, verify CI green (unit + 4-viewport e2e)
- [ ] Task: Merge to `master`, archive track, update tracks registry
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
