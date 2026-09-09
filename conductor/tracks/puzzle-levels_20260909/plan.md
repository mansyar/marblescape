# Implementation Plan — Puzzle Mode: 6 Levels

> Follows the TDD lifecycle and task/phase protocols defined in [conductor/workflow.md](../../workflow.md).
> Every task: mark `[~]` in progress → Red (failing tests) → Green (implement) → Refactor → coverage check → commit → attach git-note task summary → mark `[x]` with commit SHA.

## Phase 1 — Level Data Model & Solvability Validation

- [x] Task: Write failing tests for level data types & validators (`src/domain/levels.test.ts`) — `0273fa3`
  - [x] Level definition schema: id, name, board size, fixed pieces (type/pos/rotation), gaps (pos + accepted piece types), start chute, goal cup, palette
  - [x] Validator rejects: overlaps, gaps on non-empty slots, palette pieces not in registry, missing start/goal
- [x] Task: Implement `src/domain/levels.ts` (types, 6 level definitions, `validateLevel`) — `0273fa3`
  - [x] L1 straight → L6 finale per spec table (piece order, gap counts 1→3)
- [x] Task: Write failing tests for route-solvability checker — `0273fa3`
  - [x] Solvable: connected route exists start → goal using gap placements from palette
  - [x] Unsolvable fixtures rejected (missing connection, wrong piece available)
- [x] Task: Implement solvability check (mouth-graph traversal over CONNECTIONS + gap candidates) — `0273fa3`
- [x] Task: Coverage check (>80% on new modules) + commit + git note — `0273fa3`
- [x] Task: Phase Verification & Checkpoint — `[checkpoint: 9ca2c6b]`

## Phase 2 — Puzzle Mode State & Game Integration

- [x] Task: Write failing tests for puzzle mode state (`src/domain/puzzle.test.ts`) — `338a17e`
  - [x] Loading a level: fixed pieces placed immovable, gaps registered, palette restricted
  - [x] Gap-only placement: accepts palette piece into empty gap; rejects wrong piece, non-gap slots, furniture slots
  - [x] Rotate/move/delete allowed on gap pieces only; furniture operations no-op
  - [x] Returning to sandbox restores prior sandbox board (puzzle state is isolated from sandbox board)
- [x] Task: Extend `Game` with mode switching (sandbox | level(n)) wiring board/physics/render/palette — `2556c7d`
  - [x] Furniture flags through `board.ts`/`piece-view.ts` (non-interactive placement) — furniture renders via merged `boardFor`; Game-level guards make it non-interactive
  - [ ] Palette filters to level pieces (visual rebuild in `main.ts` lands with Phase 3 navigation; `currentPalette()` API ready)
- [x] Task: Coverage check + commit + git note — `338a17e` (coverage 91.5%/90.9%, note attached)
- [x] Task: Phase Verification & Checkpoint — `[checkpoint: df4f152]`

## Phase 3 — Level Select Screen & Navigation

- [x] Task: Write failing tests for level-select state/persistence helpers — `91b923e`
  - [x] 7 tiles (sandbox + 6 levels), nothing locked
  - [x] ✓ badge read/write in localStorage (`badges.test.ts` style per existing `prefs.test.ts`)
- [x] Task: Implement level select screen (`src/ui/level-select.ts`) — icon-only tiles ≥64px, ✓ badges — `7502676`
  - [x] Home button in HUD → level select; tile tap loads sandbox/level
  - [x] Portrait + landscape layout (responsive grid, full-screen overlay)
- [x] Task: Manual touch verification plan (Playwright touch emulation for taps/navigation) — `85f3004`
  - [x] Fix: pre-placed start chute at spawn cell in all 6 levels (user reported marble dropping to floor)
  - [x] Verified: probe.spec.ts (touch viewport) — enterLevel(1), bridge gap, play → marble collected in cup
- [x] Task: Coverage check + commit + git note — `91b923e`, `7502676`, `85f3004`
- [x] Task: Phase Verification & Checkpoint — `[checkpoint: 8bb6e21]`

## Phase 4 — Solve Detection, Badges & Post-Solve Flow

- [x] Task: Write failing tests for solve detection & badge lifecycle — `cc2c9cd`
  - [x] Marble reaching goal cup in level mode emits solve event
  - [x] Badge set once per level; persists across reload
  - [x] Chime + pulse fire per successful run; badge write only on first solve
  - [x] Home button visibility after first solve; Play remains usable
- [x] Task: Implement solve wiring in `Game` (goal-cup contact → event → `ui` effects) + badge store — `cc2c9cd`
- [x] Task: Coverage check + commit + git note — `cc2c9cd`
- [x] Task: Phase Verification & Checkpoint — `[checkpoint: c879ac4]`

## Phase 5 — E2E Verification, Regression & Track Completion

- [x] Task: Playwright E2E: navigate level select → solve each of 6 levels → ✓ badges asserted — `a96916b`
  - [x] `tests/levels.spec.ts`: real UI navigation (HUD home → tile → placements → play), badge + overlay + ✓ chip asserted per level
  - [x] `tests/probe.spec.ts`: 8-run funnel-level reliability probe
  - [x] `fix(levels) e96dff4`: L3/L6 redesigned (curved gaps at row 4, 4-piece run-up) after curve stalls
  - [x] `fix(physics) 5022d8f`: flat straight colliders remove 0.086 joint walls (marble jams); trough-center spawn; marbles never sleep
- [x] Task: Sandbox regression gate: existing smoke + reliability specs pass unchanged — `a96916b`
- [x] Task: Full suite: `pnpm check` + `pnpm test` + coverage report — `5022d8f`
  - [x] `pnpm check` clean (53 files), 203/203 unit, e2e 10/10 (6 levels + 2 smoke + reliability 20-drop + funnel probe)
  - [x] Coverage: levels 93.1% stmts/90% branch, puzzle 91.5%/88.5%, badges 100%, solve 100%
- [x] Task: Phase Verification & Checkpoint — `[checkpoint: 0042d9f]`