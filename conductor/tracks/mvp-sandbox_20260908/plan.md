# Implementation Plan — mvp-sandbox_20260908

Follows the TDD lifecycle and task/phase protocols defined in [conductor/workflow.md](../../workflow.md).
Every task: mark `[~]` in progress → Red (failing tests) → Green (implement) → Refactor → coverage check → commit → attach git-note task summary → mark `[x]` with commit SHA.

## Phase 1 — Project Bootstrap

- [x] Task: Scaffold Vite + TypeScript project (97f4836)
    - `npm create vite` (TypeScript, strict mode per code styleguides)
    - Configure Vitest, Playwright, ESLint + Prettier per `conductor/code_styleguides/`
    - Verify `CI=true npm test` runs green on the empty suite
    - Fill in the **Development Commands** section of `conductor/workflow.md`
- [ ] Task: Download & structure Kenney Marble Kit assets
    - Import 4 pieces (straight ramp, curved ramp, funnel, goal cup) + marbles + board materials as glTF
    - Verify assets load in the dev build
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2 — Core Domain Logic (pure TypeScript, no Three.js)

- [ ] Task: Grid model & placement validation
    - Red: tests for occupancy, valid/invalid slots, bounds checking
    - Green: implement grid + placement API
- [ ] Task: Piece definitions & rotation state machine
    - Red: tests for 4 piece types, 90° rotation cycling, orientation constraints (funnel/cup may have fewer valid orientations)
    - Green: implement piece catalog + rotation
- [ ] Task: Save/load serialization
    - Red: round-trip tests (layout ↔ versioned localStorage schema)
    - Green: implement serializer
- [ ] Task: Physics tuning config module
    - Centralized constants: gravity scale, damping, restitution, marble count range, rescue timeout — no magic numbers elsewhere
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3 — 3D Diorama Rendering

- [ ] Task: Scene, fixed tilted camera & responsive framing
    - Red: tests for camera framing math per aspect ratio (portrait phone / landscape tablet)
    - Green: render board diorama, adaptive framing
- [ ] Task: Board, raised edges & lighting
    - Wooden tabletop, containment edges, soft shadows
- [ ] Task: Piece rendering
    - glTF loading, grid-slot preview highlights (valid/invalid)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Physics & Marble Run

- [ ] Task: Rapier integration with fixed-timestep loop
    - Red: fixed-step determinism unit test
    - Green: implement stepping decoupled from render
- [ ] Task: Piece collision bodies
    - Hand-authored simplified colliders for the 4 piece types, synced from grid state
- [ ] Task: Marble spawner, cup detection & collection
    - Red: settle/collection logic tests
    - Green: drop 2-5 marbles, detect goal, collect on settle
- [ ] Task: Containment & rescue system
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
