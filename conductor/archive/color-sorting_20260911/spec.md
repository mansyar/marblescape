# Track Spec — Color Sorting

**Track ID:** `color-sorting_20260911` · **Type:** Feature · **Branch:** `track/color-sorting`

## Overview

The post-v1 feature explicitly reserved by `product.md` ("Color-sorting mechanics (candidate for post-v1)") and twice deferred by prior specs (physics-feel-polish, celebration-juice). Color becomes a gentle puzzle dimension: colored goal cups accept only their matching candy-color marble; a mismatched marble rolls over a closed lid and continues its adventure — no fail, no trap. The next marble waits visibly at the chute (sandbox: tap to cycle its color), and three new levels (7–9) introduce sorting one idea at a time. Entirely code-driven: no new dependencies, art, audio assets, or precache entries. Classic catch-all goal, levels 1–6, and existing sandbox saves remain behaviorally unchanged.

## Functional Requirements

### FR1 — Colored cups

- Goal pieces gain an optional color from the existing 6-color candy palette (`MARBLE_PALETTE`).
- **Matching marble**: lid opens (animated; instant under reduced motion) → collected exactly as today (sparkle burst, plonk, solve chime).
- **Non-matching marble**: lid stays closed (full floor) → marble rolls over and onward; no fail voice, no penalty; existing settle/reap behavior applies.
- Classic colorless goal keeps catch-all semantics.
- Tap on a placed colored cup **cycles its color** (cups are non-rotatable, so tap is free) with the existing tick + a small tint pulse; lid state follows.

### FR2 — The waiting marble (next-marble preview)

- When no marble is live, the next marble is shown waiting at the spawn point — at the fixed chute in levels; above the top-center spawn in sandbox.
- **Sandbox**: tap the waiting marble to cycle its color (6 candy colors, existing tick); otherwise each run previews a fresh random candy color — the preview always tells the truth about what Play will drop.
- **Levels**: the waiting marble shows the scripted next color (not tappable).
- Visual-only (not simulated), hidden while a marble is live; no idle animation under reduced motion.

### FR3 — Level color scripts & solving

- `LevelDef` gains an optional ordered `marbleColors` script. Classic levels 1–6 stay random (unchanged).
- Play drops the **first scripted color whose required count is unmet** — a wandered marble is simply re-droppable; a lost marble never soft-locks a level, and the preview always shows what's next.
- A sorting level is solved when every scripted color has reached its matching cup (existing chime + confetti + solved overlay + ✓ badge; replays keep prior collections; solving again celebrates again).

### FR4 — Levels 7–9, one idea each

- **L7 — Two colors, one reroute:** chute + two colored cups + one gap; child routes the current color, then changes the route between drops. Teaches: same track, different color.
- **L8 — Color + funnel combo:** funnel drop-through with two colored cups.
- **L9 — Three-color finale:** three cups, 2–3 gaps, all four piece types.
- Each sorting level: ≥2 colored cups (unique colors), no classic goal, validated at load (bounds/overlap/gap rules + sortability). Level select gains tiles 7–9 automatically.

### FR5 — Palette (5th tile)

- One **color-cup tile**: tap cycles its color; drag places it with that color. Classic goal tile unchanged. Both layouts fit 5 tiles.

### FR6 — Persistence (schema v2)

- `PlacedPiece` gains optional `color` (goal pieces only); v1 saves migrate losslessly (no color = classic goal; invalid color → classic), strict validation preserved.

### FR7 — Test hooks & tests

- Extend `window.__marblescape` (next-color cycle, cup/lid state) + DOM testids for the preview.
- Units: color cycling, cup/lid state machine, script consumption ("first unmet color"), sortability validation, v1→v2 migration.
- e2e: sandbox tap-cycle → dropped color matches; scripted solve of L7; mismatch roll-on; classic regression; full 4-viewport matrix + reliability gate (plus a colored-cup run).

## Non-Functional Requirements

- TDD per `workflow.md`; >80% coverage on new/changed modules; `pnpm check` clean.
- Zero pressure, no reading, drag/tap only, ≥64px targets, both orientations.
- No new dependencies/assets/precache entries; cup/lid/preview are code-driven over the existing CC0 model.
- 60fps: pooled/tweened like existing juice; no per-frame allocations.
- Reduced motion honored live (instant lid, static preview, existing fallbacks).
- Saves stay backward compatible; corrupt data still falls back to a fresh board.
- Sorting levels' solvability is validated in code at load (each scripted color independently routable to its cup).

## Acceptance Criteria

1. Sandbox previews the next marble; tap cycles it; Play drops exactly that color; classic behavior otherwise unchanged.
2. Colored cup collects only its color (sparkle + plonk); non-matching marbles roll over the closed lid — no fails, traps, or unintended collections.
3. Levels 7–9 load, validate as sortable, and are solvable by scripted Playwright runs; badges persist.
4. Levels 1–6, classic goal semantics, and v1 saves are unchanged; migration lossless.
5. Palette fits 5 tiles in both orientations; tile/placed-cup tap-cycle works.
6. `pnpm check` + unit suite + 4-viewport production e2e matrix + reliability gate green; new modules >80% coverage.

## Out of Scope

- Replacing the classic goal; changing levels 1–6
- Marble tray / draggable marble picking; multi-marble showers (stays 1 per drop)
- Color gates/sorters as new routing mechanics
- New art/audio assets, piece models, physics tuning beyond lid behavior
- Scores/timers/fail states, sequential unlocking, level editor (permanent non-goals)
- Marble sheen / cup anticipation glow (still deferred)

## Risks

- Lid collider toggling touches the goal-cell body sync → mitigated by lid state-machine unit tests + colored reliability runs.
- Sorting routes must stay readable for young children → L7 stays single-gap simple; manual verification at each phase checkpoint.
- Color-blindness: level color pairs chosen for strong luminance contrast (e.g. avoid lemon+tangerine pairs together); lid state communicates readiness independent of hue.
