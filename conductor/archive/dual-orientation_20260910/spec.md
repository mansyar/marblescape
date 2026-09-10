# Track: Dual-Orientation & Responsive Layout

**Track ID:** `dual-orientation_20260910`
**Type:** Feature
**Created:** 2026-09-10

## Overview

Marble Scape's v1 (product.md Success #3) requires the game to be *"smooth on mid-range phones and iPads, in both portrait (phone) and landscape (tablet)"*. Today the game is verified only in portrait phone (390×844): the camera is framed once at boot (`computeCameraFraming` in `src/render/framing.ts`), the palette is a hard-coded bottom bar (`src/ui/palette.ts`), and no e2e exercises landscape or tablet sizes. This track makes the diorama and UI chrome adapt to **all four form factors** — portrait phone, landscape phone, iPad portrait, iPad landscape — with dynamic camera framing, a landscape right-side palette rail, an auto-fit level grid, and a full 4-viewport Playwright matrix against the production build.

## Functional Requirements

### FR1 — Supported viewport matrix
- The app must render and play correctly at:
  - Portrait phone: **390×844**
  - Landscape phone: **844×390**
  - iPad portrait: **768×1024**
  - iPad landscape: **1024×768**
- Minimum supported width: **360px** (layouts must not overlap below 360px; below that is best-effort, no assertion).

### FR2 — Dynamic camera framing (reserved-space aware)
- Extend `computeCameraFraming(aspect, cols, rows, fovDeg, reservedWidth?, reservedHeight?)` in `src/render/framing.ts` as a **pure function**: optional `reservedWidth` / `reservedHeight` fractions subtract from the available viewport before solving camera distance, so the board fits the *remaining* region with `FRAMING_MARGIN` intact.
- Camera elevation (50°) and FOV (45°) unchanged. Camera never "moves" beyond the re-fit — the fixed-diorama interaction model (raycast onto board plane, 2D-feel) is preserved.

### FR3 — Resize / rotation re-frame (live, state-preserving)
- A **debounced (~100 ms) `resize` listener** re-computes framing and re-applies the camera transform + UI chrome layout. `orientationchange` is covered by the same path (it fires a resize).
- **No reload, no re-init**: board state (placed pieces, marbles, badges, palette) is fully preserved across re-frames.
- The same listener also covers iPad Split View / multitasking window resizes.
- Re-frame is an **instant snap** — no transition/animation.

### FR4 — Palette: bottom bar (portrait) ↔ right rail (landscape)
- Portrait keeps the existing bottom bar unchanged (including `env(safe-area-inset-bottom)`).
- Landscape renders the palette as a **vertical rail on the right side** of the viewport:
  - Same buttons, same order (Ramp, Curve, Funnel, Hole) top → bottom
  - Buttons keep the existing size floor (min-height 72px, min-width 72px)
  - **Reuses the existing `onDrag` / `onDrop` NDC contract** — picking/gesture code untouched
  - `padding-right: max(10px, env(safe-area-inset-right))`
- The rail's width is passed into the framing as reserved space (FR2), so the board never sits under the rail.

### FR5 — HUD
- The top-right HUD cluster (🏠 ▶ 🔊 ♻) is **unchanged in both orientations** — it is compact, ≥64px, and already safe-area aware.

### FR6 — Level-select auto-fit grid
- Level-select grid becomes CSS auto-fit: `repeat(auto-fit, minmax(96px, 1fr))` — 6 level cards flow into columns in portrait, rows in landscape. No JS changes.

### FR7 — Safe areas
- All chrome respects `env(safe-area-inset-*)`: bottom bar (bottom), landscape rail (right), HUD (top/right, already done).

### FR8 — E2E viewport matrix (production build)
- `playwright.pwa.config.ts` gains **four viewport projects** (390×844, 844×390, 768×1024, 1024×768) running the **full 16-spec suite each** (64 runs) against `vite preview` :4173.
- CI (`.github/workflows/ci.yml`) runs the full matrix on every PR/push. Existing workers:1 / deterministic style kept; expected e2e wall time ~5–8 min.

## Non-Functional Requirements

- **No gameplay changes**: physics, picking, gestures, levels, badges, audio untouched.
- **Deterministic tests**: no fixed sleeps; viewports via Playwright `use.viewport`.
- **No regressions**: existing 223 unit tests + current 16 e2e specs stay green (the 16 become the portrait-phone project).
- **TDD**: framing math and layout decisions unit-tested first (Red → Green), e2e written per workflow.
- **Mobile OK / 64px targets** (product-guidelines): all interactive chrome ≥64px in every viewport.

## Acceptance Criteria

1. All four viewport projects run the full 16-spec suite against the prod build — **64/64 green in CI**.
2. `computeCameraFraming` unit tests cover: reserved width only, reserved height only, both, wide/tall aspect extremes, margin retained, no reserved space = current behavior (backward compatible).
3. E2E verifies **live re-frame preserves state**: boot a level in a viewport, place a piece, resize (project pair or in-test resize), piece still placed and level still solvable — no reload.
4. Landscape e2e: palette renders as a right rail with order Ramp → Curve → Funnel → Hole top→bottom, ≥72px buttons, and a drag-drop from the rail places a piece and solves level 1.
5. Level-select e2e: all 6 cards visible and tappable in every viewport (smoke spec).
6. Safe-area paddings use `env(safe-area-inset-*)` (code review + unit check where feasible).
7. Manual: real-device iPad rotation + Split View sweep by the user.
8. `pnpm check` clean; unit suite ≥ 223 and green; existing dev-server suite green locally.

## Out of Scope

- Animated/smooth re-frame transitions
- Ghost-piece drag or new gesture/picking code
- HUD redesign or relocation
- New pieces, levels, or gameplay changes
- Distinct per-orientation layouts beyond the palette rail + auto-fit grid
- Dedicated support below 360px width (best-effort only)
- Android-specific multi-window hardening (covered implicitly by the resize listener)