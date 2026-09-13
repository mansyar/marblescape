# Track Spec — Adaptive Performance & Quality

**Track ID:** `adaptive-quality_20260913` · **Type:** Feature (performance & quality) · **Branch:** `track/adaptive-quality`

## Overview

Marble Scape ships for mid-range phones and iPads, but success criterion #3 ("smooth on mid-range") has no machinery behind it: pixel ratio is fixed at `min(devicePixelRatio, 2)`, particle budgets are sized for a desktop, and no test measures frame pacing.

This track adds a small deterministic quality governor: the game measures its own frame pacing, steps through a fixed ladder of **visual-only** degradations when the device struggles, returns to full quality when it recovers, and CI enforces a hard frame-time budget on a CPU-throttled Chromium. The system is invisible to children — no settings UI, no visual identity changes, no physics or audio coupling. 60 fps is the target; sustained sub-30 fps is a failure.

## Functional Requirements

### FR1 — Frame pacing meter (automatic)

- Measures frame pacing from the active render loop (rAF deltas); maintains an EMA plus a rolling-window p95.
- Policy uses sustained windows, never single spikes — initial defaults (tunable, evidence-first): downgrade when p95 > ~25 ms (1.5× the 60 fps budget) for ~3 s; upgrade when p95 < ~16.7 ms for ~10 s plus a cooldown. No thrash.
- Pure, clock-injectable module (unit-testable; no three.js imports). Runs only while a render loop is active.

### FR2 — Quality ladder (visual-only levers)

- **Tier 0 (full):** exactly today's rendering — dpr `min(devicePixelRatio, 2)`, full sparkle/confetti budgets, contact shadows + gleam on.
- **Tier 1 (reduced):** lower dpr cap, halved particle budgets; shadows/glow still on.
- **Tier 2 (lean floor):** dpr 1, minimal particle budgets, contact shadows + gleam sprites off; marble tint/glass, board art, lighting, and gameplay identity untouched.
- Never below Tier 2. Never touches physics steps, marble count, audio, board state, or saves. MSAA/antialias is explicitly not a lever.
- Tier changes: downgrades apply immediately; upgrades apply only at rest (no marbles in flight, no overlays) to avoid resolution pops during play.
- All per-tier constants live in one config module (mirroring `physics-config.ts`), tuned with evidence.

### FR3 — Integration with existing systems

- dpr changes flow through the existing `applyFraming` path so portrait/landscape and resize stay consistent.
- Sparkles/confetti/gleam/shadow pools consult the current tier at emission time (pools stay allocated; budgets shrink — no per-frame allocation).
- Composes cleanly with reduced-motion (user preference, orthogonal) and the debounced resize watcher.

### FR4 — Hidden dev readout

- `?debug` URL flag shows a tiny overlay: fps EMA, p95, current tier, downgrade/upgrade counters. Off by default, zero cost when off, nothing visible in normal play.

### FR5 — CI perf gate (hard budget)

- Playwright spec: deterministic 5-marble stress scene (run + sparkles + confetti + sorting) under CDP CPU throttling, reading the in-app meter via the existing `__marblescape` handle.
- Hard assertions with generous documented thresholds: p95 ≤ budget after adaptation, adaptation actually engaged (tier < full), no catastrophic long frames. Stable across repeats; must not meaningfully slow the suite.

### FR6 — No regression

- All existing unit + 4-viewport e2e suites (incl. both 20-drop reliability gates) stay green; reliability determinism untouched.
- No behavior change to levels, saves, audio, input, onboarding, picture tiles, or celebration.

## Non-Functional Requirements

- TDD per `workflow.md`; >80% coverage on new/changed modules; `pnpm check` clean.
- No new runtime dependencies, no new assets, no precache changes; negligible bundle impact.
- Tunables centralized in one module; no scattered magic numbers.
- Docs sync: `tech-stack.md` (quality system + gate thresholds), `product.md` (criterion #3 now machine-checked), inline comments.

## Acceptance Criteria

1. Unit tests cover meter classification, hysteresis (no thrash), tier-ladder monotonicity, and budget application.
2. Perf gate green on CI with adaptation engaged; repeats stably.
3. Full unit coverage + `pnpm check` + all e2e matrices green.
4. Owner manual pass on phone (portrait + landscape): steady pacing, no visible pops during runs, `?debug` sane; with the flag off, play is indistinguishable from today.
5. After adaptation in the stress scenario: no sustained period below 30 fps.
6. Docs updated; offline behavior unchanged.

## Out of Scope

- MSAA/antialias toggling, physics rate/substepping changes, visible quality settings, telemetry, tier persistence across sessions, renderer rewrite, device-specific Safari workarounds beyond standard resize handling.

## Risks & Mitigations

- **CI flake** → generous thresholds, single measurement source (in-app meter), documented tuning, one focused spec.
- **Visible pop on upgrade** → upgrades at rest only; small dpr steps.
- **Thrash under borderline load** → sustained-window hysteresis + cooldown; hard floor at Tier 2.
- **Headless measurement quirks** → thresholds validated against repeated local baselines before bake-in.
- **Reduced-motion interference** → orthogonal by design (presence policy vs budgets/pixels); tested together (FR3).
