# Implementation Plan — First-Run Onboarding

Branch: `track/first-run-onboarding` · Spec: [spec.md](./spec.md)

Workflow discipline: strict TDD (failing tests → green → refactor → coverage → commit + git note → plan update). Status markers: `[ ]` pending, `[~]` in progress, `[x]` complete (append commit SHA).

## Phase 1 — Domain: onboarding state & first-run layout (TDD) [checkpoint: 1b268b7]

- [x] Task: Write failing tests for the onboarding state machine & flag IO (`src/domain/onboarding.ts`) [1b268b7]
  - [x] `nextOnboardingStep`: "place" → "play" on first successful placement; solve on first Play from **any** step (skip-ahead completes); placements after step 1 stay "play"; nothing changes after "done"
  - [x] `isOnboarded`/`markOnboarded` under `marblescape.onboarded.v1`: absent/corrupt = not onboarded; set = onboarded; writes idempotent
- [x] Task: Write failing tests for the starter layout & fresh detection (`src/domain/first-run.ts`) [1b268b7]
  - [x] Layout: 8×6; straights rot 0 at (4,0)/(4,1)/(4,3)/(4,4); classic goal at (4,5); gap (4,2); unique, in-bounds cells
  - [x] Chain validity: chute → gap → goal connects via `connectsWith` once a Ramp rot 0 fills the gap
  - [x] `isFirstRun`: true only when `loadBoard` is null AND flag absent; any save or flag → false; corrupt flag behaves as absent
- [x] Task: Implement both modules to green; >80% coverage [1b268b7]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [1b268b7]

## Phase 2 — Seed, events & cue layer (TDD) [checkpoint: b91c160]

- [x] Task: Write failing e2e for the first-run flow (`tests/onboarding.spec.ts`) [b91c160]
  - [x] Fresh context: seed pieces present per layout, gap (4,2) open, seed persisted
  - [x] Cues at step "place": hand + target ring + pulsing Ramp tile; `pointer-events:none` layer
  - [x] `place("straight", 4, 2)` → step "play" (ring/tile pulse stop; Play pulses; hand gestures to Play)
  - [x] `play()` → flag set, cue layer done/gone; reload → no cues, child's board persists, no reseed
  - [x] Pre-existing save → no seed, no cues (existing player untouched)
  - [x] Reduced-motion emulation → no traveling hand (static cue), flow still completable
  - [x] One landscape viewport boot assertion
- [x] Task: Implement seed & detection to green (`Game.seedFirstRun()`, `isFirstRun` boot order in `main.ts`) [ea57da8]
  - [x] Seed uses the layout constant, assigns normal sandbox ids, syncs visuals, saves immediately
- [x] Task: Implement Game callbacks + main wiring to green [ea57da8]
  - [x] `onPiecePlaced` (successful sandbox placement), `onPlayed` (every Play; house pattern like `onLevelSolved`)
  - [x] First Play writes the flag; cue step advances on real actions
- [x] Task: Implement the cue layer (`src/ui/onboarding.ts`; DOM target ring positioned via a new `worldToScreen` projection helper; Ramp-tile pulse hook in `palette.ts`; Play ref returned by `createHud`) [ea57da8]
  - [x] Hidden in puzzle mode and under overlays; resumes on sandbox return until completed
  - [x] Live reduced-motion branch; loop anchors recomputed per cycle for resize/orientation
- [x] Task: Unit tests for pure cue config & projection helper; >80% coverage on new/changed modules [ea57da8]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [b91c160]

## Phase 3 — Verification, polish & docs [checkpoint: c01dae5]

- [x] Task: Manual feel pass (portrait + landscape; reduced motion): cues read as invitation, hand path lands correctly on gap and Play, no drag obstruction, pulses subtle
- [x] Task: e2e regression: smoke, levels, color-sorting, responsive, reliability suites green; no cue leakage into puzzle/overlays [c01dae5]
- [x] Task: Docs sync (`product.md` records first-run onboarding + starter seed; `tech-stack.md` dated no-new-deps note; precache list unchanged) [6da4d31]
- [x] Task: Run the full 4-viewport production e2e matrix locally (incl. reliability gates) [c01dae5]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [c01dae5]

## Phase 4 — Track completion [checkpoint: 144b97b]

- [x] Task: Push branch, open PR, verify CI green (unit + 4-viewport e2e) [d2b85b3]
- [x] Task: Merge to `master`, archive track, update tracks registry [144b97b]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [144b97b]

## Phase: Review Fixes

- [x] Task: Apply review suggestions 965e586