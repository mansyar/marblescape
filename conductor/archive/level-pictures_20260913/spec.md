# Track Spec — Picture-Based Level Select

**Track ID:** `level-pictures_20260913` · **Type:** Feature (UI/UX) · **Branch:** `track/level-pictures`

## Overview

Closes the last read-dependent UI: level-select tiles currently show digits 1–9 plus a 🏖️ emoji, conflicting with product principle #2 ("No reading required") and contradicting the now picture-based piece palette. This track replaces both with runtime-rendered mini-boards:

- **Nine level tiles** become camera-matched miniatures of each level's starting board — floor, walls, furniture, spawn chute, and candy-tinted cups — rendered from the same fixed tilted camera the child actually plays with; empty gap slots get a soft highlight so "where pieces go" reads at a glance.
- **The sandbox tile** becomes a live snapshot of the child's current saved build, refreshed when the board changes.
- **No new assets, dependencies, or precache entries**: snapshots reuse the offscreen capture pipeline built for the piece palette. If a snapshot can't be produced (no WebGL / render failure), tiles fall back to today's digit/emoji. ✓ badges, nothing locked, tap targets, and layouts are unchanged.

## Functional Requirements

### FR1 — Camera-matched level mini-boards

- After templates load and the board restores, render each shipped level once to a ~160×160 transparent PNG: board floor + walls, fixed furniture (incl. spawn chute), colored cups tinted with their candy color, gaps empty.
- Camera matches gameplay: same elevation/FOV/look-at language (`computeCameraFraming` for the level's board size), framed to the whole board.
- One pass, cached in memory for the session; no per-frame work; no new network requests.

### FR2 — Gap hints

- Empty gap slots render with the in-game highlight language (soft green translucent tile) so a pre-reader sees where pieces belong; the hint does not reveal which piece fits.

### FR3 — Live sandbox snapshot

- The sandbox tile shows the current sandbox board (an empty board renders the plain tabletop).
- Refreshed lazily when level select is shown and the board changed since the last snapshot (serialized-board comparison); at most one offscreen pass per change.

### FR4 — Picture-only tiles, fallback & accessibility

- No visible digits/emoji when snapshots succeed; tiles keep `data-level-select="level-N"|"sandbox"` hooks, ≥64px targets, and ✓ chips.
- Tiles expose `aria-label` ("Level N", "Sandbox"); a missing/failed snapshot degrades to today's glyph — never a blank tile.

### FR5 — No behavior changes

- Picking levels, badge refresh on show, grid layout, orientation behavior, game rendering, physics, audio, saves, and level data are unchanged.

## Non-Functional Requirements

- Zero new dependencies, assets, or precache entries; offline behavior identical.
- One-time boot cost for 9 small renders; sandbox regeneration only on show + change; render resources disposed; no steady-state per-frame work.
- TDD per `workflow.md`; >80% coverage on new/changed modules; `pnpm check` clean.
- Legible at 84–96px tiles; portrait + landscape; reduced motion unaffected (static images).

## Acceptance Criteria

1. Level select shows 10 picture tiles (sandbox + 9 levels); no visible digits/emoji when rendering works.
2. Level tiles reflect level geometry (furniture, colored cups) and softly mark empty gaps; ✓ chips still show on solved levels.
3. Editing the sandbox and reopening level select updates the sandbox tile to the new build.
4. `aria-label`s present; snapshot failure falls back to digit/emoji; all tiles tappable and ≥64px.
5. `pnpm check`, unit suite, and the 4-viewport production e2e matrix green; `product.md` + `tech-stack.md` updated.

## Out of Scope

- Animated previews, rotation indicators, hover states.
- New levels / Level Pack 2; changes to level data, models, physics, audio, or saves.
- Converting other text UI (update banner, overlays) to icons.

## Risks

- Legibility at tile size → same camera as gameplay, 160px source, manual feel pass; digit fallback covers total failure.
- Boot cost on low-end devices (9 board renders) → one small pass, disposed resources; if measurements show jank, lazy-generate per tile on first open.
- Sandbox staleness → compare serialized board before cache reuse; regenerate on show.
- Test coupling → e2e already selects by `data-level-select`; unit tests cover composition + fallback.
