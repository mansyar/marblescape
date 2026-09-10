# Track Spec — Celebration & Interaction Juice

**Track ID:** `celebration-juice_20260910` · **Type:** Feature (polish) · **Branch:** `track/celebration-juice`

## Overview

A celebration-and-feedback polish pass closing the "visual juice" follow-up explicitly deferred by the
physics-feel-polish spec ("Visual juice (confetti, sheen, celebration effects) — separate track") and the
puzzle-levels spec ("Celebration FX beyond chime + pulse — separate track"). Goal: give every marble payoff
and every touch an immediate, tactile, physical response — cause-and-effect made visible — while keeping the
zero-pressure tone of guideline #6 ("Celebration, not judgment"). Additive only: no new dependencies, no
physics changes, no new sounds.

## Functional Requirements

### FR1 — Collect celebration: sparkle burst at the cup (3D)

- Every marble collected at the goal cup fires a short in-scene sparkle burst anchored at the cup's world
  position (depth-correct; correct in both orientations).
- Modest and pooled: hard particle caps (≤64 per burst), shared geometry/material, object pooling, no
  per-event allocations; bursts auto-expire in ≤1 s.
- Multi-marble collects coalesce: rapid successes reuse/refresh a bounded set of burst slots instead of
  stacking unbounded — the board never visually floods.
- The burst is cosmetic only: it never blocks input, mutates game state, or affects collection detection.

### FR2 — Solve celebration: confetti + enriched overlay + instant replay

- On level solve (existing `onLevelSolved`), show a full celebration: DOM/CSS confetti layer (≤120 pieces,
  ~2.5 s, auto-cleanup) plus the enriched overlay.
- Enriched overlay keeps the ✓ ms-pop pulse and "Level solved!" label; adds a big ▶ button (112 px,
  aria-label "Play again", testid) next to the existing 🏠 button.
- ▶ semantics: hide the overlay and immediately re-run the same track — placements stay exactly as solved;
  just drop a fresh marble (`play()`, no reset/reload/re-entry). 🏠 still returns to level select.
- Solving again after a replay celebrates again — same effect, never gated.

### FR3 — Interaction juice: pieces & palette

- **Reject wiggle** (MVP FR3 promise, currently only a red highlight + code comment): an invalid drop
  (occupied cell, off-board, or type not accepted) responds with a short wiggle animation on the piece
  involved — the board piece being moved, or the originating palette tile for palette drags — plus a soft
  low-pitched tick (existing sample).
- **Placement snap-bounce**: valid drops (palette → board, and re-place moves) land with a springy scale
  bounce (~200 ms, e.g. 0.85 → 1.06 → 1) via the existing tween machinery.
- **Palette pickup feedback**: while a drag is born, the palette tile lifts/squishes subtly; released on
  pointerup.
- **Rotate tap feedback**: tapping a rotatable piece animates the quarter turn (~140 ms) with a small
  squash; the logical rotation/connectivity update stays immediate (animation is visual-only) and the
  existing tick plays.
- Explicitly excluded: marble sheen, goal-cup anticipation glow.

### FR4 — Verification hooks & tests

- Extend `window.__marblescape` hooks (e.g. `burstCount` / last-burst timestamp) and add DOM testids for
  the confetti layer and ▶ replay button.
- New units tested for: burst lifecycle, pooling and caps, reduced-motion branch, tween state machines,
  reject-wiggle trigger logic.
- e2e: collect increments the burst hook; solve shows confetti + replay; ▶ hides overlay and re-runs
  (marble count grows); full 4-viewport matrix stays green; headless reliability gate (20 drops) unaffected
  by effects.

## Non-Functional Requirements

- Modest, pooled, 60fps-safe: effect constants centralized (caps, durations) like `PHYSICS`; zero measurable
  FPS drop on mid-range devices; reliability runs unchanged in outcome.
- Reduced motion honored: `prefers-reduced-motion: reduce` replaces flying particles with a gentle
  pulse/glow (✓ badge pulse, brief cup glow); no vestibular triggers.
- No new dependencies, no physics/render-loop/camera changes; effects are an additive layer over existing
  game events.
- Audio: reuse existing CC0 samples only; mute governs all cues; no new assets or precache changes.
- Zero-reading: ▶ is icon-only + aria-label; no new visible text.
- Settings remain sound-only; no new toggles or persistence.
- `pnpm check` + full unit suite + 4-viewport e2e matrix green; >80% coverage on new modules.

## Acceptance Criteria

1. Every collected marble triggers a sparkle burst anchored at the cup (sandbox + levels); observable via
   the test hook; no FPS regression in the reliability gate.
2. Solving shows confetti + enriched overlay; ▶ replays the same solved track instantly (placements
   unchanged) and hides the overlay; 🏠 still returns to level select.
3. Invalid drops wiggle + soft tick; valid drops snap-bounce; palette tiles react on pickup; rotate taps
   animate + tick.
4. `prefers-reduced-motion: reduce` degrades celebrations to gentle non-flying cues.
5. Rapid/multi-marble collects stay within caps (unit-verified) and never flood the scene.
6. All existing tests + 4-viewport e2e + headless reliability gate pass; `pnpm check` clean; new modules
   >80% coverage.

## Out of Scope

- Marble sheen and goal-cup anticipation glow (considered, not selected)
- New sounds or audio assets (reuse existing samples only)
- New pieces, levels, or level-design changes
- Physics, render loop, camera framing, or dependency changes
- Celebration settings/toggles (settings stay sound-only)
- Visual-snapshot test framework
- Scoring/timers/fail states (permanent non-goals)
