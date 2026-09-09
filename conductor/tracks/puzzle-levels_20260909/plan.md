# Implementation Plan — Puzzle Mode: 6 Levels

> Follows the TDD lifecycle and task/phase protocols defined in [conductor/workflow.md](../../workflow.md).
> Every task: mark `[~]` in progress → Red (failing tests) → Green (implement) → Refactor → coverage check → commit → attach git-note task summary → mark `[x]` with commit SHA.

## Phase 1 — Level Data Model & Solvability Validation

- [ ] Task: Write failing tests for level data types & validators (`src/domain/levels.test.ts`)
  - [ ] Level definition schema: id, name, board size, fixed pieces (type/pos/rotation), gaps (pos + accepted piece types), start chute, goal cup, palette
  - [ ] Validator rejects: overlaps, gaps on non-empty slots, palette pieces not in registry, missing start/goal
- [ ] Task: Implement `src/domain/levels.ts` (types, 6 level definitions, `validateLevel`)
  - [ ] L1 straight → L6 finale per spec table (piece order, gap counts 1→3)
- [ ] Task: Write failing tests for route-solvability checker
  - [ ] Solvable: connected route exists start → goal using gap placements from palette
  - [ ] Unsolvable fixtures rejected (missing connection, wrong piece available)
- [ ] Task: Implement solvability check (mouth-graph traversal over CONNECTIONS + gap candidates)
- [ ] Task: Coverage check (>80% on new modules) + commit + git note
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2 — Puzzle Mode State & Game Integration

- [ ] Task: Write failing tests for puzzle mode state (`src/game/mode.test.ts` or `src/domain/puzzle.test.ts`)
  - [ ] Loading a level: fixed pieces placed immovable, gaps registered, palette restricted
  - [ ] Gap-only placement: accepts palette piece into empty gap; rejects wrong piece, non-gap slots, furniture slots
  - [ ] Rotate/move/delete allowed on gap pieces only; furniture operations no-op
  - [ ] Returning to sandbox restores prior sandbox board
- [ ] Task: Extend `Game` with mode switching (sandbox | level(n)) wiring board/physics/render/palette
  - [ ] Furniture flags through `board.ts`/`piece-view.ts` (non-interactive placement)
  - [ ] Palette filters to level pieces
- [ ] Task: Coverage check + commit + git note
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3 — Level Select Screen & Navigation

- [ ] Task: Write failing tests for level-select state/persistence helpers
  - [ ] 7 tiles (sandbox + 6 levels), nothing locked
  - [ ] ✓ badge read/write in localStorage (`badges.test.ts` style per existing `prefs.test.ts`)
- [ ] Task: Implement level select screen (`src/ui/level-select.ts`) — icon-only tiles ≥64px, ✓ badges
  - [ ] Home button in HUD → level select; tile tap loads sandbox/level
  - [ ] Portrait + landscape layout (reuse `framing.ts` breakpoints)
- [ ] Task: Manual touch verification plan (Playwright touch emulation for taps/navigation)
- [ ] Task: Coverage check + commit + git note
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Solve Detection, Badges & Post-Solve Flow

- [ ] Task: Write failing tests for solve detection & badge lifecycle
  - [ ] Marble reaching goal cup in level mode emits solve event
  - [ ] Badge set once per level; persists across reload
  - [ ] Chime + pulse fire per successful run; badge write only on first solve
  - [ ] Home button visibility after first solve; Play remains usable
- [ ] Task: Implement solve wiring in `Game` (goal-cup contact → event → `ui` effects) + badge store
- [ ] Task: Coverage check + commit + git note
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5 — E2E Verification, Regression & Track Completion

- [ ] Task: Playwright E2E: navigate level select → solve each of 6 levels → ✓ badges asserted
- [ ] Task: Sandbox regression gate: existing smoke + reliability specs pass unchanged
- [ ] Task: Full suite: `pnpm check` + `pnpm test` + coverage report
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)