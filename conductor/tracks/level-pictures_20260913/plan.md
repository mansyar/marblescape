# Implementation Plan — Picture-Based Level Select

Branch: `track/level-pictures` · Spec: [spec.md](./spec.md)

Workflow discipline: strict TDD (failing tests → green → refactor → coverage → commit + git note → plan update). Status markers: `[ ]` pending, `[~]` in progress, `[x]` complete (append commit SHA).

## Phase 1 — Board snapshot engine (TDD) [checkpoint: 3f19815]

- [x] Task: Write failing unit tests for board snapshots (`src/render/board-thumbnails.test.ts`) via the injectable capture seam (headless — no WebGL in jsdom) [3f19815]
  - [x] Composes a level board: floor/walls sized to the level, posed piece clones at cell centers (authored yaw + rotation + ramp lift), colored cups tinted, gap cells softly highlighted, other empty cells untouched
  - [x] `levelSnapshotInput(level)` maps fixed furniture (incl. spawn chute + cup colors) and gap cells
  - [x] Renders all levels in one pass → `Partial<Record<levelId, dataUrl>>`; missing templates skipped; a failing level omitted without throwing; capture disposed once
  - [x] Sandbox composition from `BoardState` (empty board → plain tabletop); preview cache reuses a URL while the serialized board token is unchanged and regenerates when it changes
  - [x] Camera framed like gameplay: `computeCameraFraming(1, cols, rows)` position/look-at at gameplay FOV/elevation
- [x] Task: Extract shared pose/tint helpers (`piece-view.ts`: pose a placed piece; tint a colored cup) used by both the piece renderer and snapshots — keep `piece-view` tests green [359d0e0]
- [x] Task: Implement `src/render/board-thumbnails.ts` to green (offscreen capture reusing the `OffscreenGL`/`PieceCapture` seam; transparent clear; resources disposed) [3f19815]
- [x] Task: >80% coverage on new/changed modules; `pnpm check` clean [3f19815]
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2 — Preview wiring & picture tiles (TDD)

- [~] Task: Update failing level-select tests (`src/ui/level-select.test.ts`)
  - [ ] With previews: tiles render `<img>` (no visible text), `aria-label` present, `data-level-select` hooks and ✓ chips intact
  - [ ] Without previews: digit/emoji fallback tiles, never blank
  - [ ] Preview provider queried on every grid rebuild, incl. `showLevelSelect` (sandbox refresh path)
- [ ] Task: Implement tile rendering + provider option in `src/ui/level-select.ts` to green
- [ ] Task: Wire `Game` (`createLevelPreviews()`, cached `sandboxPreview()`) and `src/main.ts` boot (generate after `game.start()` resolves; pass provider) — glue is exercised by e2e per project precedent
- [ ] Task: Regression check existing suites (smoke, levels, onboarding, color-sorting, responsive, palette); >80% coverage on changed modules
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3 — e2e, verification, polish & docs

- [ ] Task: Write e2e (`tests/level-pictures.spec.ts`)
  - [ ] Level select: 10 tiles show `<img>` with `naturalWidth > 0`; no visible digits/emoji; ✓ chips still render
  - [ ] Sandbox tile updates after an edit; entering a level and tapping 🏠 still shows the parked sandbox build (not the level board)
  - [ ] Portrait + landscape assertions
- [ ] Task: Regression check existing suites; full 4-viewport production e2e matrix locally (incl. reliability gates)
- [ ] Task: Manual feel pass (portrait + landscape, reduced motion): tile legibility at 84–96px, no blank tiles
- [ ] Task: Docs sync (`product.md` records picture level select + live sandbox preview; `tech-stack.md` dated note; precache unchanged)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
