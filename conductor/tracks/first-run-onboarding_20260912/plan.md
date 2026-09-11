# Implementation Plan — First-Run Onboarding

Branch: `track/first-run-onboarding` · Spec: [spec.md](./spec.md)

Workflow discipline: strict TDD (failing tests → green → refactor → coverage → commit + git note → plan update). Status markers: `[ ]` pending, `[~]` in progress, `[x]` complete (append commit SHA).

## Phase 1 — Domain: onboarding state & first-run layout (TDD)

- [ ] Task: Write failing tests for the onboarding state machine & flag IO (`src/domain/onboarding.ts`)
  - [ ] `nextOnboardingStep`: "place" → "play" on first successful placement; solve on first Play from **any** step (skip-ahead completes); placements after step 1 stay "play"; nothing changes after "done"
  - [ ] `isOnboarded`/`markOnboarded` under `marblescape.onboarded.v1`: absent/corrupt = not onboarded; set = onboarded; writes idempotent
- [ ] Task: Write failing tests for the starter layout & fresh detection (`src/domain/first-run.ts`)
  - [ ] Layout: 8×6; straights rot 0 at (4,0)/(4,1)/(4,3)/(4,4); classic goal at (4,5); gap (4,2); unique, in-bounds cells
  - [ ] Chain validity: chute → gap → goal connects via `connectsWith` once a Ramp rot 0 fills the gap
  - [ ] `isFirstRun`: true only when `loadBoard` is null AND flag absent; any save or flag → false; corrupt flag behaves as absent
- [ ] Task: Implement both modules to green; >80% coverage
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2 — Seed, events & cue layer (TDD)

- [ ] Task: Write failing e2e for the first-run flow (`tests/onboarding.spec.ts`)
  - [ ] Fresh context: seed pieces present per layout, gap (4,2) open, seed persisted
  - [ ] Cues at step "place": hand + target ring + pulsing Ramp tile; `pointer-events:none` layer
  - [ ] `place("straight", 4, 2)` → step "play" (ring/tile pulse stop; Play pulses; hand gestures to Play)
  - [ ] `play()` → flag set, cue layer done/gone; reload → no cues, child's board persists, no reseed
  - [ ] Pre-existing save → no seed, no cues (existing player untouched)
  - [ ] Reduced-motion emulation → no traveling hand (static cue), flow still completable
  - [ ] One landscape viewport boot assertion
- [ ] Task: Implement seed & detection to green (`Game.seedFirstRun()`, `isFirstRun` boot order in `main.ts`)
  - [ ] Seed uses the layout constant, assigns normal sandbox ids, syncs visuals, saves immediately
- [ ] Task: Implement Game callbacks + main wiring to green
  - [ ] `onPiecePlaced` (successful sandbox placement), `onPlayed` (every Play; house pattern like `onLevelSolved`)
  - [ ] First Play writes the flag; cue step advances on real actions
- [ ] Task: Implement the cue layer (`src/ui/onboarding.ts`; DOM target ring positioned via a new `worldToScreen` projection helper; Ramp-tile pulse hook in `palette.ts`; Play ref returned by `createHud`)
  - [ ] Hidden in puzzle mode and under overlays; resumes on sandbox return until completed
  - [ ] Live reduced-motion branch; loop anchors recomputed per cycle for resize/orientation
- [ ] Task: Unit tests for pure cue config & projection helper; >80% coverage on new/changed modules
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3 — Verification, polish & docs

- [ ] Task: Manual feel pass (portrait + landscape; reduced motion): cues read as invitation, hand path lands correctly on gap and Play, no drag obstruction, pulses subtle
- [ ] Task: e2e regression: smoke, levels, color-sorting, responsive, reliability suites green; no cue leakage into puzzle/overlays
- [ ] Task: Docs sync (`product.md` records first-run onboarding + starter seed; `tech-stack.md` dated no-new-deps note; precache list unchanged)
- [ ] Task: Run the full 4-viewport production e2e matrix locally (incl. reliability gates)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Track completion

- [ ] Task: Push branch, open PR, verify CI green (unit + 4-viewport e2e)
- [ ] Task: Merge to `master`, archive track, update tracks registry
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)