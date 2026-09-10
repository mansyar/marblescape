# Implementation Plan — Celebration & Interaction Juice

Branch: `track/celebration-juice` · Spec: [spec.md](./spec.md)

Workflow discipline: strict TDD (failing tests → green → refactor → coverage → commit + git note → plan update). Status markers: `[ ]` pending, `[~]` in progress, `[x]` complete (append commit SHA).

## Phase 1 — Collect celebration: sparkle burst (TDD)

- [x] Task: Write failing tests for the sparkle burst module (pooling, caps, lifecycle) [37fe3c0]
  - [x] New module `src/render/sparkles.ts`: pooled burst emitter anchored at a world position
  - [x] Hard cap ≤64 live particles per burst; bounded slot reuse/coalescing for rapid collects; auto-expire ≤1 s
  - [x] Reduced-motion branch yields a non-flying glow pulse
  - [x] Tests: emission caps, pool reuse (no per-event allocation after warm-up), expiry, coalescing window, reduced-motion fallback
- [x] Task: Implement sparkle module to green; >80% coverage; `pnpm check` clean [37fe3c0]
- [x] Task: Write failing tests + wire collect celebration into `Game` (burst at the goal cup world position); expose `burstCount` test hook [0efdc2e]
- [x] Task: Implement wiring to green; verify sandbox + puzzle collects both fire; full unit suite green [d95b49e]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: d95b49e]

## Phase 2 — Solve celebration: confetti, overlay enrichments, instant replay (TDD)

- [x] Task: Write failing tests for the confetti layer module (`src/ui/confetti.ts`): ≤120 pieces, ~2.5 s auto-cleanup, reduced-motion branch, testid hook [ce6728e]
- [x] Task: Implement confetti module to green; >80% coverage [ce6728e]
- [x] Task: Write failing tests for the enriched solved overlay: ▶ "Play again" button (112 px, aria-label, testid) hides overlay + re-runs the same track (placements unchanged); 🏠 unchanged [074456d]
- [x] Task: Implement overlay + wiring in `src/main.ts`; confetti fires on `onLevelSolved`; green [074456d]
- [x] Task: Extend e2e (levels spec): solve → overlay + confetti layer + ▶ replay re-runs without leaving/altering placements [ad04335]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: ad04335]

## Phase 3 — Interaction juice: wiggle, bounce, pickup, rotate (TDD)

- [x] Task: Write failing tests for pure animation helpers (`src/render/piece-anim.ts`): snap-bounce scale curve, reject-wiggle angle curve, rotate-yaw interpolation (game logic stays immediate; visuals tween) [a03c648]
- [x] Task: Implement helpers to green; >80% coverage [a03c648]
- [x] Task: Write failing tests + wire reject feedback: invalid drop (occupied/off-board/not-accepted) wiggles the involved piece or originating palette tile + soft low-pitched tick (existing sample) [a0583ab]
- [x] Task: Write failing tests + wire valid-drop snap-bounce (palette → board and re-place moves) [a0583ab]
- [x] Task: Write failing tests + implement palette pickup feedback (tile lift/squish on drag start, reset on pointerup) and rotate tap animation (quarter-turn tween + existing tick) [a0583ab]
- [x] Task: Manual feel pass on dev build (portrait + landscape); iterate timings once [a0583ab]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [checkpoint: a0583ab]

## Phase 4 — Track completion

- [ ] Task: Docs sync (tech-stack.md: effects design, reduced-motion, no new deps/assets)
- [ ] Task: Run full e2e viewport matrix locally against production build (incl. reliability gate with effects enabled)
- [ ] Task: Push branch, open PR, verify CI (unit + 4-viewport e2e green)
- [ ] Task: Merge to `master`, archive track, update tracks registry
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
