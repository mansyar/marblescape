# Implementation Plan — mvp-sandbox_20260908

Follows the TDD lifecycle and task/phase protocols defined in [conductor/workflow.md](../../workflow.md).
Every task: mark `[~]` in progress → Red (failing tests) → Green (implement) → Refactor → coverage check → commit → attach git-note task summary → mark `[x]` with commit SHA.

## Phase 1 — Project Bootstrap [checkpoint: 1d7c3f0]

- [x] Task: Scaffold Vite + TypeScript project (5b4ac2c)
    - `npm create vite` (TypeScript, strict mode per code styleguides)
    - Configure Vitest, Playwright, ESLint + Prettier per `conductor/code_styleguides/`
    - Verify `CI=true npm test` runs green on the empty suite
    - Fill in the **Development Commands** section of `conductor/workflow.md`
- [x] Task: Download & structure Kenney Marble Kit assets (1d7c3f0)
    - Import 4 pieces (straight ramp, curved ramp, funnel, goal cup) + marbles + board materials as glTF
    - Verify assets load in the dev build
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [1d7c3f0]

## Phase 2 — Core Domain Logic (pure TypeScript, no Three.js) [checkpoint: f272132]

- [x] Task: Grid model & placement validation (c4ef213)
    - Red: tests for occupancy, valid/invalid slots, bounds checking
    - Green: implement grid + placement API
- [x] Task: Piece definitions & rotation state machine (c44fb4a)
    - Red: tests for 4 piece types, 90° rotation cycling, orientation constraints (funnel/cup may have fewer valid orientations)
    - Green: implement piece catalog + rotation
- [x] Task: Save/load serialization (a758186)
    - Red: round-trip tests (layout ↔ versioned localStorage schema)
    - Green: implement serializer
- [x] Task: Physics tuning config module (167b144)
    - Centralized constants: gravity scale, damping, restitution, marble count range, rescue timeout — no magic numbers elsewhere
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [f272132]

## Phase 3 — 3D Diorama Rendering [checkpoint: b959bc9]

- [x] Task: Scene, fixed tilted camera & responsive framing (7a8363e)
    - Red: tests for camera framing math per aspect ratio (portrait phone / landscape tablet)
    - Green: render board diorama, adaptive framing
- [x] Task: Board, raised edges & lighting (bbced54)
    - Wooden tabletop, containment edges, soft shadows
- [x] Task: Piece rendering (b5187f9)
    - glTF loading, grid-slot preview highlights (valid/invalid)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Physics & Marble Run

- [x] Task: Rapier integration with fixed-timestep loop (57379ed)
    - Red: fixed-step determinism unit test
    - Green: implement stepping decoupled from render
- [x] Task: Piece collision bodies (d17a030)
    - Hand-authored simplified colliders for the 4 piece types, synced from grid state
- [x] Task: Marble spawner, cup detection & collection (2d8faaa)
    - Red: settle/collection logic tests
    - Green: drop 2-5 marbles, detect goal, collect on settle
- [~] Task: Containment & rescue system
    - Red: rescue-trigger tests
    - Green: board-edge colliders + velocity≈0 timeout rescue
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5 — Touch Interaction & Edit UX

- [ ] Task: Drag-from-palette placement
    - Red: pointer→grid-slot mapping tests
    - Green: raycast to board plane, grid snap, valid-slot highlight, reject wiggle
- [ ] Task: Tap-to-rotate & hold-drag-to-move
    - Red: interaction state transition tests
    - Green: implement (≥64px effective touch targets)
- [ ] Task: Drag-off-board delete
    - Green: pop-back-to-palette animation
- [ ] Task: HUD (Play, mute, reset)
    - Green: Play drops marbles; child-driven run loop
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 6 — Sound

- [ ] Task: Web Audio manager
    - Red: pitch-mapping & event-wiring tests (audio graph mocked)
    - Green: CC0 samples, velocity-based pitch-shifting
- [ ] Task: Mute toggle with persistence
    - Red: preference round-trip test
    - Green: implement
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 7 — Persistence & Responsive Polish

- [ ] Task: Auto-save/resume sandbox layout
    - Green: debounced writes; restore on boot; wire tested Phase 2 serializer
- [ ] Task: Dual-orientation layout polish
    - HUD placement, palette ergonomics in portrait and landscape
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 8 — Reliability Gate & Track Completion

- [ ] Task: Playwright smoke test
    - App boots; scripted scene marble reaches cup (touch-emulated viewport)
- [ ] Task: Reliability gate run
    - 20 consecutive scripted runs: 0 escapes / 0 stuck marbles
    - Coverage ≥ 80% verified
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)