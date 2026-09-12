# Track Spec — Picture-Based Piece Palette

**Track ID:** `palette-pictures_20260912` · **Type:** Feature (UI/UX) · **Branch:** `track/palette-pictures`

## Overview

Closes the palette's last read-dependent gap: tiles show English words ("Ramp", "Curve", "Funnel", "Hole") that a pre-reader cannot decode, conflicting with product principle #2 ("No reading required"). This track replaces tile text with pictures of the actual piece models: at startup, each already-loaded Kenney GLB template is rendered once to a small transparent-background image (in-memory data URL), and the palette shows those images on the tiles. No new assets, dependencies, or precache entries — the images are generated from models the game already ships. The color-cup tile keeps its candy dot beneath the cup picture and its tap-to-cycle behavior. Every existing interaction (drag/drop, rejection shake, first-run pulse, ≥64px targets, portrait/landscape layouts) is unchanged, and a text label remains only as a defensive fallback if a snapshot cannot be produced.

## Functional Requirements

### FR1 — Startup snapshot generation

- After piece templates load (game start), render each piece type (`straight`, `curved`, `funnel`, `goal`) once to a small transparent-background image (~160×160, crisp at 2× DPR for 72px tiles) in a three-quarter view matching the board's look.
- One pass, cached in memory for the session; no per-frame work; no new network requests.
- Fault-tolerant: a type whose snapshot fails is omitted and its tile falls back to the text label; the palette never shows a blank tile.

### FR2 — Picture tiles

- Tiles render the piece image instead of text; no visible words in normal operation.
- Tiles keep `aria-label` (piece name) and existing hooks: `data-piece-type`, `data-color` on the cup tile, and first-run pulse targeting.
- Tile footprint, ≥64px targets, and portrait/landscape layouts stay as today.

### FR3 — Color-cup tile

- The cup tile shows the cup picture plus the existing candy dot below; tapping still cycles the six candy colors (dot redraws), swiping still places a colored cup.

### FR4 — Fallback & accessibility

- If a snapshot is missing, the tile shows its word label (today's rendering) — the game stays fully playable either way.
- Screen readers get the same piece names via `aria-label`.

### FR5 — No behavior changes

- Drag/drop (incl. rejection shake and pickup lift), color cycling, onboarding cue anchors (straight-tile rect), HUD, board rendering, physics, audio, levels, and saves are unchanged.

## Non-Functional Requirements

- Zero new dependencies, assets, or precache entries; offline behavior identical.
- One-time boot cost only; temporary render resources disposed after the pass.
- TDD per `workflow.md`; >80% coverage on new/changed modules; `pnpm check` clean.
- Both orientations across the 4-viewport e2e matrix; reduced motion unaffected (static images).

## Acceptance Criteria

1. Sandbox and all puzzle levels show picture-based tiles with no visible text; the cup tile shows picture + candy dot.
2. Tap-to-cycle and drag-to-place behave exactly as before; first-run onboarding pulse and anchors still work.
3. Every tile exposes an `aria-label`; snapshot failure degrades to the word label.
4. No new files in the build/precache manifest; no new runtime fetches.
5. `pnpm check`, unit suite, and the 4-viewport production e2e matrix (incl. reliability gates) are green.
6. Docs updated: `product.md` records picture tiles; `tech-stack.md` gets a dated no-new-assets note.

## Out of Scope

- Level-select thumbnails/previews (digits → pictures) — candidate future track.
- Converting other text UI (update banner, overlays) to icons.
- Animated previews, rotation indicators, or tile hover states.
- Changes to piece models, physics, audio, saves, or level data.

## Risks

- Snapshot legibility at tile size → fixed three-quarter angle + manual feel pass; text fallback covers failure.
- Offscreen render cost on low-end devices → single small pass at boot, resources disposed immediately.
- Test coupling to label text → e2e selects by `data-piece-type` today; palette unit tests updated deliberately.