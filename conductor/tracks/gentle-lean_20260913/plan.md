# Implementation Plan — Gentle Lean & Flat Straights

Branch: `track/gentle-lean` · Spec: [spec.md](./spec.md)

Workflow discipline: strict TDD (failing tests → green → refactor → coverage → commit + git note → plan update). Status markers: `[ ]` pending, `[~]` in progress, `[x]` complete (append commit SHA).

## Phase 1 — Gentler lean (TDD) [checkpoint: 0f9df66]

- [x] Task: Write failing lean tests (`src/domain/physics-config.test.ts`): angle derived from `gravity` ≈ 6° (within 0.5°), direction due south (`x = 0`), still downward (`y < 0`); old magnitude bound re-expressed as the angle [0f9df66]
- [x] Task: Implement to green — `gravity` z 2.5 → ≈1.88 (+ comments); >80% coverage [0f9df66]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [0f9df66]

## Phase 2 — Flat straights: metadata + posing (TDD) [checkpoint: b706a5a]

- [x] Task: Write failing tests [b706a5a]
  - [x] `pieces.test.ts`: no piece declares a slope (straights flat); `slope` is gone from `PieceDef` [b706a5a]
  - [x] `piece-view.test.ts`: `posePiece` applies yaw alignment only — no pitch, no lift, for every piece type/rotation [b706a5a]
  - [x] `piece-thumbnails.test.ts`: thumbnail clones stay flat (rotation.x = 0, no y offset) [b706a5a]
  - [x] `board-thumbnails.test.ts`: level mini-board clones stay flat (shared poser) [b706a5a]
- [x] Task: Implement to green — remove `slope` from `PieceDef`/straight, simplify `posePiece` + `createThumbnailClone`; palette tiles and level previews inherit automatically; >80% coverage [b706a5a]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [b706a5a]

## Phase 3 — Flow verification & tuning (gates + e2e)

- [ ] Task: Add lean-sensitive flow coverage (`tests/reliability.spec.ts` or focused spec): a marble on a flat straight chain accelerates and reaches a downstream cup under the 6° lean; zero rescues; generous time bound
- [ ] Task: Run both reliability gates + full 4-viewport production e2e matrix; if stalls appear, re-tune only `physics-config.ts` (damping/restitution/spawn height) with failing-test/gate evidence, then re-run
- [ ] Task: Regression check settle/rescue behavior at slower speeds (no false settles, no new stuck marbles)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Docs, manual pass & completion

- [ ] Task: Docs sync — `product.md` (~6° lean; "straight channel" not "straight ramp"), `tech-stack.md` (dated tuning note), inline comments
- [ ] Task: Owner manual pass on phone, portrait + landscape: straights flush, runs calmer but clearly flowing; record result
- [ ] Task: Final gates (`pnpm check`, unit coverage, e2e) + conductor review; apply review fixes if any
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
