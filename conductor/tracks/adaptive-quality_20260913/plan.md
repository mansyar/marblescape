# Implementation Plan — Adaptive Performance & Quality

Branch: `track/adaptive-quality` · Spec: [spec.md](./spec.md)

Workflow discipline: strict TDD (failing tests → green → refactor → coverage → commit + git note → plan update). Status markers: `[ ]` pending, `[~]` in progress, `[x]` complete (append commit SHA).

## Phase 1 — Frame pacing meter & quality policy core (pure, TDD)

- [ ] Task: Write failing unit tests for the new pure modules (`src/render/perf-meter.ts`, `src/render/quality.ts`, `src/render/quality-config.ts`): EMA + rolling p95 math with injected timestamps (no rAF, deterministic); downgrade requires sustained breach windows (single spikes ignored); upgrade requires sustained healthy window + cooldown (no thrash); tier ladder monotonic with hard Tier 2 floor; full tier budgets equal today's constants (drift guard)
- [ ] Task: Implement to green — meter, governor state machine, centralized config constants (spec defaults, evidence-tunable); >80% coverage
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2 — Renderer & effects integration + hidden dev readout (TDD)

- [ ] Task: Write failing tests: quality → renderer pixel-ratio path flows through the shared framing function (`applyFraming`) incl. orientation/resize; sparkle/confetti/gleam/shadow budgets consult tier at emission time (pool capacities unchanged); downgrades immediate, upgrades gated to rest; reduced-motion × tier composition (smaller budget wins); `?debug` overlay only exists with the flag, zero cost without
- [ ] Task: Implement to green — meter wired into the game/render loop; governor applies dpr; effects read budgets; dev overlay lives in the UI layer; >80% coverage
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3 — CI perf gate (CPU-throttled e2e) + evidence tuning

- [ ] Task: Add `tests/perf.spec.ts`: deterministic 5-marble stress scene (run → sparkles → collect/confetti → sorting) under CDP CPU throttling; Chromium single-project, skipped elsewhere; reads meter stats via `window.__marblescape`; asserts p95 ≤ budget after adaptation, adaptation engaged (tier < full), no catastrophic long frames; no new dependencies
- [ ] Task: Baseline & tune — ≥3 local baseline runs, set generous documented thresholds, confirm repeat stability and that full-quality regressions would be caught; record numbers; add dated perf-gate note to `tech-stack.md`
- [ ] Task: Full-suite check — 4-viewport matrix green, suite duration impact acceptable, both reliability gates unaffected
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Docs, manual pass & completion

- [ ] Task: Docs sync — `product.md` (criterion #3 is now machine-checked), `tech-stack.md` (final system + thresholds), inline comments
- [ ] Task: Owner manual pass on phone, portrait + landscape: steady pacing on busy runs, no visible resolution pops, `?debug` sane; record result
- [ ] Task: Final gates (`pnpm check`, unit coverage, full e2e) + conductor review; apply review fixes if any
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
