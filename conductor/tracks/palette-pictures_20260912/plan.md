# Implementation Plan — Picture-Based Piece Palette

Branch: `track/palette-pictures` · Spec: [spec.md](./spec.md)

Workflow discipline: strict TDD (failing tests → green → refactor → coverage → commit + git note → plan update). Status markers: `[ ]` pending, `[~]` in progress, `[x]` complete (append commit SHA).

## Phase 1 — Snapshot module (TDD) [checkpoint: eff97ac]

- [x] Task: Write failing unit tests for piece snapshots (`src/render/piece-thumbnails.ts`) [eff97ac]
  - [x] Renders one image per piece type (straight, curved, funnel, goal) via an injectable render seam (headless — no WebGL in jsdom)
  - [x] One pass, results cached; a failing type is omitted without throwing (fallback path)
- [x] Task: Implement the snapshot module to green (offscreen renderer + scene, transparent clear, three-quarter camera, `toDataURL` per template clone; expose a read-only template accessor from `PieceRenderer`) [eff97ac]
- [x] Task: >80% coverage on the new module; `pnpm check` clean [eff97ac]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [eff97ac]

## Phase 2 — Picture tiles & boot wiring (TDD) [checkpoint: 68c7459]

- [x] Task: Update failing palette tests (`src/ui/palette.test.ts`) [69250bd]
  - [x] With snapshots: tile renders an `<img>` with the data URL, no visible text, `aria-label` present; existing hooks (`data-piece-type`, `data-color`) intact
  - [x] Without snapshots: tile falls back to the text label
  - [x] Cup tile: picture + candy dot; tap cycles `data-color` and redraws; drag callbacks unchanged
- [x] Task: Implement palette rendering changes (`src/ui/palette.ts`) to green [69250bd]
- [x] Task: Write failing e2e (`tests/palette.spec.ts`) [434f54b]
  - [x] Sandbox: all tiles show images (`naturalWidth > 0`), zero visible text; cup dot cycles on tap
  - [x] Drag from a picture tile still places the piece; landscape viewport assertion
- [x] Task: Wire boot generation (`src/main.ts` / `Game`) — snapshots generated after `game.start()` resolves and passed into every `buildPalette()` call (including orientation rebuilds) [f1ad687]
- [x] Task: Regression check existing suites (smoke, levels, onboarding, color-sorting, responsive); >80% coverage on changed modules [68c7459]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [68c7459]

## Phase 3 — Verification, polish & docs

- [x] Task: Manual feel pass (portrait + landscape, reduced motion): tiles legible, drag feel unchanged
- [~] Task: Full 4-viewport production e2e matrix locally (incl. reliability gates)
- [x] Task: Fix landscape-phone HUD/rail overlap found by the matrix (HUD slides clear of the rail; tile hit-test) [927c0b1]
- [x] Task: Docs sync (`product.md`/`product-guidelines.md` record picture tiles; `tech-stack.md` dated no-new-assets note; precache unchanged) [6b46ae0]
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Track completion

- [ ] Task: Push branch, open PR, verify CI green (unit + 4-viewport e2e)
- [ ] Task: Merge to `master`, archive track, update tracks registry
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)