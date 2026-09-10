# Implementation Plan: Dual-Orientation & Responsive Layout

**Track ID:** `dual-orientation_20260910`
**Branch:** `track/dual-orientation`

## Phase 1 — Framing math & live re-frame plumbing

- [x] Task: Write failing unit tests for `computeCameraFraming` reserved-space extension — `8da87a1`
  - [ ] `src/render/framing.test.ts`: reserved width only, reserved height only, both
  - [ ] Wide / tall aspect extremes keep the board inside the remaining region with margin
  - [ ] No reserved space → identical output to today (backward compatibility)
- [x] Task: Implement reserved-space extension in `src/render/framing.ts` (pure function, optional `reservedWidth`/`reservedHeight` fractions) — make tests green — `8da87a1`
- [x] Task: Write failing unit tests for a debounced viewport-resize module (fake timers) — `0af4f4b`
  - [ ] New `src/render/resize.ts` contract: register callback + debounce (~100 ms), coalesces bursts, fires once after quiet window, returns teardown that removes the listener
  - [ ] `orientationchange`-style events handled via the same resize path
- [x] Task: Implement `src/render/resize.ts` — make tests green — `0af4f4b`
- [x] Task: Wire re-frame into the game: on debounced resize, recompute `computeCameraFraming` (passing landscape rail reservation) and re-apply camera transform; board state untouched (no reload, no re-init) — `9795ed1`
  - [ ] Unit test: layout-mode helper (`src/ui/layout.ts`) maps viewport size → mode (portrait/landscape) + reserved rail fraction
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — `[checkpoint: 9795ed1]`

## Phase 2 — Landscape UI chrome (palette rail + level grid)

- [x] Task: Write failing tests for landscape palette rail structure — `39c6880`
  - [ ] `src/ui/palette.test.ts`: landscape mode renders a vertical right-side rail (fixed, right:0, vertical flex)
  - [ ] Same buttons, same order (Ramp, Curve, Funnel, Hole) top → bottom, ≥72px
  - [ ] Rail respects `env(safe-area-inset-right)` padding
  - [ ] Portrait mode output unchanged (bottom bar)
- [x] Task: Implement landscape rail in `src/ui/palette.ts` (reuse `onDrag`/`onDrop` NDC contract; picking/gesture code untouched) — make tests green — `39c6880`
- [x] Task: Wire the rail's reserved width into the game's framing call (Phase 1 plumbing) — `aeccbf2`
  - [ ] Unit test: game/scene passes landscape rail reservation; portrait passes none
- [x] Task: Level-select auto-fit grid — `cdcc2a9`
  - [ ] `src/ui/level-select.ts`: switch grid to `repeat(auto-fit, minmax(96px, 1fr))`
  - [ ] E2E (Phase 3 spec) will verify all 6 cards visible/tappable in every viewport
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) — `[checkpoint: cdcc2a9]`

## Phase 3 — E2E viewport matrix (production build)

- [ ] Task: Write failing e2e specs for the new viewports
  - [ ] `tests/responsive.spec.ts`: landscape palette rail present + order Ramp→Hole, drag-drop from rail places a piece
  - [ ] Level-select: all 6 cards visible and tappable in every viewport
  - [ ] Live re-frame: boot level, place a piece, `page.setViewportSize` to landscape, assert piece persists and level still solvable — no reload
- [ ] Task: Extend `playwright.pwa.config.ts` with four viewport projects (390×844, 844×390, 768×1024, 1024×768) running the full `tests/*.spec.ts` suite each (16 × 4 = 64 runs) against `vite preview` :4173
  - [ ] Deterministic: viewports via `use.viewport`, no fixed sleeps, workers:1 kept
- [ ] Task: Run the full matrix locally — 64/64 green; fix any flakes
- [ ] Task: Push branch, open PR, verify CI runs the full matrix green (64/64, check, unit ≥223)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Track completion

- [ ] Task: Mark track complete — registry `[x]`, metadata.json `completed`
- [ ] Task: Final certification — full suite (check, unit, 64/64 prod e2e, dev suite) + docs sync (tech-stack.md note, tracks.md)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)