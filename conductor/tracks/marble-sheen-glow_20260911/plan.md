# Implementation Plan — Marble Sheen, Cup Glow & Table Limit

Branch: `track/marble-sheen-glow` · Spec: [spec.md](./spec.md)

Workflow discipline: strict TDD (failing tests → green → refactor → coverage → commit + git note → plan update). Status markers: `[ ]` pending, `[~]` in progress, `[x]` complete (append commit SHA).

## Phase 1 — Table marble limit: recycling policy (TDD) [checkpoint: a23e646]

- [x] Task: Write failing tests for the cap constant & recycling policy (`src/domain/physics-config.ts`, `src/physics/marbles.ts`) [b7f06e9]
  - [x] `PHYSICS.maxMarblesOnTable = 5` beside `maxMarblesPerDrop`; config test
  - [x] Spawning at the cap always adds the new marble and recycles the oldest active one (FIFO); active count never exceeds the cap
  - [x] Recycling fires a dedicated event/count distinct from the fresh-run leftover clear (`onLost`): not collected, not rescued; run-settle treats it as done
  - [x] Recycled marble fully removed (no body leak, not collectible afterward); cup trophies never recycled
- [x] Task: Implement the recycling policy to green; >80% coverage [b7f06e9]
- [x] Task: Write failing tests for Game wiring: `recycledCount()` hook + detached fade (`src/game/game.ts`) [49589cb]
  - [x] State first: body removed immediately; mesh detaches and shrinks/fades ~150–200 ms (reuse `popTweens` pattern extended with opacity), disposed at end
  - [x] Reduced motion: instant removal
  - [x] Cup lids/floor sync and waiting preview re-evaluated after recycle (existing `refreshCupState`/`syncWaiting`)
- [x] Task: Implement Game wiring to green; >80% coverage [49589cb]
- [x] Task: e2e: rapid Play presses (sandbox + one level) → active count never exceeds 5, `recycledCount` grows, newest marble present; reliability gates unchanged [a23e646]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: a23e646]

## Phase 2 — Marble sheen & soft contact shadow (TDD) [checkpoint: cda1e1c]

- [x] Task: Write failing tests for the contact shadow (`src/render/marble-shadow.ts`) [124a6d8]
  - [x] Height → scale/opacity mapping (clamped, monotonic; no-op above max height)
  - [x] Lifecycle: one shadow per active marble, cleaned on collect/rescue/recycle, pooled with no leak
- [x] Task: Implement soft contact shadows to green; >80% coverage [124a6d8]
- [x] Task: Write failing tests for the sheen layer (`src/render/marble-gleam.ts`) [dbbaf14]
  - [x] Shared geometry/material/highlight resources created once and disposed; per-marble attach/detach; no per-frame allocations
  - [x] Highlight is additive and never modifies the marble's candy color
- [x] Task: Implement marble sheen to green; >80% coverage [dbbaf14] [4aa377d]
- [x] Task: Manual feel pass (portrait + landscape): glossiness, grounding, color clarity, perf spot check with 5 marbles + sparkles [cda1e1c]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: cda1e1c]

## Phase 3 — Cup anticipation glow (TDD) [checkpoint: 6a9bbc8]

- [x] Task: Write failing tests for the glow intensity mapping (`src/render/cup-glow.ts`) [63aced2]
  - [x] Match state: baseline pulse for the compatible cup (steady glow under reduced motion); incompatible cups → 0 [63aced2]
  - [x] Approach ramp: brightness rises as a matching marble nears (~2 tiles), peaks at collection; classic catch-all cup glows on any approach [63aced2]
- [x] Task: Implement cup glow to green; wire the per-frame update (live marble positions + next color); >80% coverage [63aced2] [cf8497c]
  - [x] ≤3 cups; emissive/tint only on existing cup meshes; no per-frame allocations; lid readability preserved [63aced2] [cf8497c]
- [x] Task: e2e/regression: sorting levels still solve; lid/color state hooks unchanged by glow; reduced-motion steady glow [6a9bbc8]
- [x] Task: Manual feel pass (both orientations; reduced motion): anticipation reads, no hue confusion [6a9bbc8]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: 6a9bbc8]

## Phase 4 — Track completion

- [x] Task: Docs sync (`product.md`: table marble rule; `tech-stack.md`: dated no-new-deps feature note) [891267a]
- [ ] Task: Run the full 4-viewport e2e matrix locally against the production build (incl. reliability gates)
- [ ] Task: Push branch, open PR, verify CI green (unit + 4-viewport e2e)
- [ ] Task: Merge to `master`, archive track, update tracks registry
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
