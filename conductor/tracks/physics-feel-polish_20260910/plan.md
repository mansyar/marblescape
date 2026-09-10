# Implementation Plan — Physics Feel Polish

Branch: `track/physics-feel-polish` · Spec: [spec.md](./spec.md)

Workflow discipline: strict TDD (failing tests → green → refactor → coverage → commit + git note → plan update). Status markers: `[ ]` pending, `[~]` in progress, `[x]` complete (append commit SHA).

## Phase 1 — Run-settle detection (pure domain, TDD)

- [x] Task: Write failing tests for the run-settle detector [f571e52]
  - [x] New module `src/domain/run-settle.ts` (pure): fed per-step marble states (collected/rescued/velocity)
  - [x] Tests: settle when all marbles reaped; settle after N consecutive sub-threshold steps; no settle while any marble fast; event fires exactly once per run; stall cap (~15 s) declares finish
- [x] Task: Implement detector to green; verify >80% coverage [f571e52]
- [x] Task: Write failing tests + implement stall-cap reap policy in `MarbleManager` (timeout → rescued path, quietly) [35ef45d]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: 9b4031c]

## Phase 2 — Audio feel (TDD)

- [x] Task: Write failing tests for per-marble impact throttling (replaces global 60 ms gate) [214c296]
- [x] Task: Implement per-marble throttle + lowered gentle-impact cutoff; green [214c296]
- [x] Task: Write failing tests for refined pitch/volume curves; implement (musical band kept) [dfb2c3c]
- [x] Task: Write failing tests for roll-voice module (`src/audio/roll.ts`): speed→gain/rate mapping, start/stop lifecycle, mute honored, no voice leaks on reap [c12fca3]
- [x] Task: Implement roll module; source + add CC0 roll sample asset (Kenney audio or equivalent) to precache [c12fca3]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: e58a592]

## Phase 3 — Motion retuning & game integration

- [x] Task: Write failing tests + wire `onRunSettled` into `Game`: soft final cue, Play never locked [670039c]
- [x] Task: Headless deterministic simulation tests (seeded boards, scripted fixed-step runs): no-escape beyond rescue, no stall beyond cap, every marble accounted for, settle fires within bounds [978819a]
- [x] Task: Retune `PHYSICS` constants (damping, restitution, spawn) — gravity direction fixed [5ed8b30]
- [x] Task: Manual feel pass on dev build (portrait + landscape); iterate constants once [c0d07cd]
- [x] Task: Run full e2e viewport matrix locally against production build; update only intentionally-tuned expectations [c0d07cd]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: 4f54107]

## Phase 4 — Track completion

- [ ] Task: Docs sync (tech-stack note for new audio asset + settle design; product risk #1 mitigation note)
- [ ] Task: Push branch, open PR, verify CI (unit + 4-viewport e2e green)
- [ ] Task: Merge to `master`, archive track, update tracks registry
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
