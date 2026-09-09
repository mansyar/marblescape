# Marble Scape — Puzzle Mode: 6 Levels

- **Type:** Feature
- **Date:** 2026-09-09
- **Track ID:** puzzle-levels_20260909

## Overview

Add the six "complete the track" puzzle levels that complete Marble Scape's v1 scope, built entirely on the existing sandbox engine (board, pieces, physics, sounds, persistence). Each level is a fixed, pre-built route — start chute → pre-placed track → goal cup — with empty grid slots (gaps) the child bridges by dragging the right piece(s) from a restricted palette. A simple, icon-only level-select screen lets the child move between the sandbox and levels; solving a level (marble lands in the goal cup) sets a persistent ✓ badge. Zero pressure: nothing locked, no fail states, always replayable.

## Functional Requirements

1. **Level select screen** — icon-only grid of 7 big tiles (≥64px touch targets): Sandbox + Levels 1–6. Solved levels show a subtle ✓ badge (persisted in localStorage). Nothing locked; no reading required. Reachable at launch and via a big Home button in the HUD.
2. **Level definitions** — 6 fixed layouts as declarative data (grid coordinates, rotations, gaps, palette):
   - **L1 — Straight:** start chute north, route south to goal; 1 gap; palette: `straight`.
   - **L2 — Curved:** route bends; 1–2 gaps; palette: `curved` (+ `straight`).
   - **L3 — Mix:** straight + curved combination; 2 gaps; palette: `straight`, `curved`.
   - **L4 — Goal:** start chute + goal cup pre-placed, route gap before the cup; child places the `goal` piece in the gap; 2 gaps; palette: `goal`, `straight`.
   - **L5 — Funnel:** route includes a drop-through funnel; 2 gaps; palette: `funnel`, `straight`, `curved`.
   - **L6 — Finale:** all pieces; 3 gaps; palette: all 4.
3. **Fixed furniture** — start chute and goal cup are pre-placed, non-movable, non-rotatable, non-removable in every level. Pre-placed track pieces are likewise fixed; only gaps accept placement.
4. **Restricted palette** — only the level's palette pieces appear in the tray; supply is sized to the number of gaps (no extras, or generous-but-limited — implementation detail, must not allow dead ends).
5. **Gap-only placement** — placement validation in puzzle mode accepts only gap slots with a palette piece; invalid placements reject with the existing wiggle. Rotation/move/delete apply to gap pieces only.
6. **Solve detection** — when a marble lands in the level's goal cup during a Play run: set ✓ badge for that level (localStorage, persists), play a gentle chime + small visual pulse, show the big Home button. First solve only for the badge; every successful run replays the sound/pulse.
7. **Post-solve flow** — the board stays interactive and replayable (Play again). Child returns to level select only via Home.
8. **Sandbox unchanged** — sandbox behavior, palette, and persistence remain exactly as shipped.

## Non-Functional Requirements

- TDD per `workflow.md`; >80% coverage on new modules (level data validation, mode state, badge persistence).
- Level layouts defined as typed, testable data — each layout must be validated at load (gaps solvable: a route exists from start mouth to goal cup given palette pieces).
- All new UI follows child-friendly rules: ≥64px targets, icon-only, portrait + landscape.
- 60fps target maintained; no new per-frame work beyond existing sandbox costs.

## Acceptance Criteria

1. Level select shows 7 tiles with correct ✓ badges; badges survive reload.
2. Each of the 6 levels loads its fixed board, restricted palette, and only gap slots accept pieces; furniture cannot be moved/rotated/removed.
3. A scripted Playwright test solves each level (correct pieces into gaps) and the marble reaches the goal cup, setting the ✓ badge.
4. An automated validity check proves each level layout is solvable with its restricted palette (route from start to goal exists).
5. Solve triggers badge + chime + pulse exactly once for the badge, with Home available; Play remains usable.
6. Sandbox regression: existing unit + smoke + reliability tests pass unchanged.
7. Both portrait and landscape usable for level select and all levels.

## Out of Scope

Celebration FX beyond chime + pulse (separate track) · PWA/offline (separate track) · level editor · sequential unlocking · scoring/timers/fail states · new piece types or physics changes · UI art overhaul of the palette/HUD beyond the Home button.