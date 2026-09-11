# Track Spec — Marble Sheen, Cup Glow & Table Limit

**Track ID:** `marble-sheen-glow_20260911` · **Type:** Feature (polish + calm-table rule) · **Branch:** `track/marble-sheen-glow`

## Overview

Closes the visual item deferred three times ("Marble sheen / cup anticipation glow" — celebration-juice "considered, not selected"; color-sorting "still deferred"), plus the product owner's calm-table rule: at most five marbles may be on the table at once — the newest drop always arrives and the oldest marble fades away quietly (never a fail, never a count). Entirely code-driven: no new dependencies, art, audio assets, or precache entries. Colors, levels, saves, physics tuning, and the drag/tap/Play vocabulary stay unchanged.

## Functional Requirements

### FR1 — Table marble limit (quiet recycling)

- New cap: at most **5 active marbles** on the table (`PHYSICS.maxMarblesOnTable = 5`, beside `maxMarblesPerDrop`).
- Every Play press still drops one marble; when the drop would exceed the cap, the **oldest active marble** (FIFO spawn order) is recycled: physics body removed immediately, its visual mesh shrinks/fades out detached over ~150–200 ms (silent).
- Recycling is quiet bookkeeping, like the existing leftover-reap path: not collected, not rescued/escaped, no badge/solve impact; run-settle treats it as done (no stall regression).
- Cup trophies are untouched; a marble already resting in a cup is never recycled.
- Applies uniformly to sandbox and puzzle levels. Removal never delays or blocks the new drop.
- Sorting stays coherent: lids/floors/targets re-sync after spawn/recycle (existing `refreshCupState`); the waiting preview stays truthful.
- State changes immediately; the fade is cosmetic (house pattern — reuse the detached shrink tween, extended with opacity).
- Reduced motion: instant removal (no fade).

### FR2 — Marble sheen (code-driven catch-light)

- Marbles read as glossy glass: tuned marble material (sharper specular/clear highlight) plus a small catch-light that stays visible as the marble tumbles — at the fixed camera, both orientations.
- Sheen stays subordinate to candy color: the six colors must remain as distinguishable as today (sorting levels depend on it).
- No env maps, probes, textures, or assets; shared resources; at most one extra draw per marble; no per-frame allocations.
- Static (no animation) → no reduced-motion branch needed.

### FR3 — Soft contact shadow

- Each active marble gets a soft elliptical blob shadow on the board surface beneath it; scale/opacity follow height so marbles feel grounded.
- No shadow maps; pooled shared quad; cleaned up with the marble (including recycle fades).
- Classic warm board look preserved; trophy marbles in cups unchanged.

### FR4 — Cup anticipation glow (match + approach)

- Compatible goal cup (same rule as the open lid: live marble color, else next/waiting color) emits a gentle glow:
  - **Match**: soft slow pulse while it matches the waiting/next marble;
  - **Approach**: brightness ramps as a matching marble nears the cup mouth (~2 tiles), peaking at collection.
- Incompatible (closed) cups never glow; the classic catch-all cup glows on any approach.
- Adds to, never replaces, the lid state signal — open/closed stays readable with glow off.
- Visual-only; emissive/tint on existing cup meshes; ≤3 cups; no per-frame allocations.
- Reduced motion: steady gentle glow, no pulsing.

### FR5 — Verification hooks & tests

- Extend `window.__marblescape`: `recycledCount()` (cap-driven only; fresh-run leftover clears must not increment it); reuse `marbleCount()`.
- Units: recycling policy (cap/FIFO/oldest-gone, distinguished from leftover-clear), fade lifecycle, glow intensity mapping (match + distance), shadow height mapping, reduced-motion branches.
- e2e: rapid Play presses → active count never exceeds 5, `recycledCount` grows, newest marble present; collection/sorting/solve regressions; 4-viewport matrix + reliability gates green.

## Non-Functional Requirements

- TDD per `workflow.md`; >80% coverage on new/changed modules; `pnpm check` clean.
- Zero new dependencies, assets, or precache entries; everything code-driven.
- 60 fps with 5 marbles + sparkles/confetti: pooled, shared resources, no per-frame allocations; reliability gates show no regression.
- Zero pressure / no reading / no fail states: recycling is silent and gentle; no new UI, text, or settings.
- Both orientations; fixed camera unchanged. Save schema, level catalog, physics tunables unchanged.
- Live reduced-motion: instant removal; steady glow.

## Acceptance Criteria

1. Repeated Play presses (sandbox and levels) never leave >5 active marbles; each press yields a marble; over-cap drops fade the oldest (~≤200 ms) with no collect/rescue counts and no sound.
2. Recycling touches nothing else: runs settle, lids/colors/trophies, badges, preview stay correct; 20-drop reliability gates green.
3. Marbles visibly read as glossy glass with a grounded contact shadow, both orientations, without muddying the six candy colors.
4. The compatible cup visibly anticipates (pulse on match; brightens on approach); closed cups stay dark; lid readability preserved.
5. Reduced motion: instant removal + steady glow.
6. `pnpm check` + unit suite + 4-viewport production e2e matrix + reliability gates green; new modules >80% coverage.
7. Docs: `product.md` records the table marble rule; `tech-stack.md` gets its dated no-new-deps feature note.

## Out of Scope

- Env-map reflections, real shadow maps, post-processing
- Non-hue color glyphs/shape cues for sorting (separate candidate)
- New pieces, levels, level-design changes; physics tuning
- Multi-marble showers per press, marble tray, draggable marble picking
- New sounds or audio assets (recycling stays silent)
- UI chrome, text, settings, level select changes
- Scores/timers/fail states, sequential unlocking, level editor (permanent non-goals)

## Risks

- Recycling vs run-settle/sorting bookkeeping → policy unit tests + e2e recycle test + unchanged reliability gates.
- Sheen/glow vs color & lid readability (sorting is hue-based) → sheen subordinate; glow additive; manual verification per phase checkpoint.
- 5 marbles + effects on mid-range devices → pooled draws, no per-frame allocations; manual perf check at the checkpoint.
- A fading marble could read as loss → quick, silent, no negative cue; tone stays "the marble went adventuring".
