# Marble Scape MVP — 3D Engine Core & Sandbox

- **Type:** MVP (bootstrap)
- **Date:** 2026-09-08
- **Track ID:** mvp-sandbox_20260908

## Overview

Deliver the playable heart of Marble Scape: a fixed-camera 3D tabletop diorama where kids drag, rotate, and rearrange four track piece types, then release marbles that run through the contraption with satisfying sound. Dev-served web app only — PWA/offline comes in a later track. This track exists to validate the two riskiest unknowns: 3D marble physics reliability and the drag-snap-play interaction loop.

## Functional Requirements

1. **Diorama scene** — fixed tilted camera over a wooden board with raised edges; scene framing adapts to portrait phone and landscape tablet.
2. **Palette** — tray with 4 pieces: straight ramp, curved ramp, funnel, goal cup (unlimited supply).
3. **Placement** — drag from palette snaps to grid slots; valid slots highlight; occupied/invalid slots reject with a wiggle.
4. **Rotate** — tap a placed piece cycles its 90° orientation, with animation + sound.
5. **Move** — hold-drag a placed piece to another slot.
6. **Delete** — drag a piece off the board; it pops back to the palette (puff + sound). Rule: *on the board it stays, off the board it goes home.*
7. **Play loop** — big Play button drops 2-5 colorful glass marbles into the scene; marbles run, settle, and are collected; child presses Play again. Child-driven, no auto-loop.
8. **Containment & rescue** — marbles can never escape the board; any marble at rest away from a cup for >5s is gently "rescued" (fades out, returns to pool).
9. **Sound** — CC0 samples for roll/click/plonk/pickup/delete, pitch-shifted by marble velocity; mute toggle on-screen, persisted.
10. **Persistence** — sandbox layout + sound preference in localStorage; app resumes where the child left off.
11. **HUD** — Play button, mute toggle, reset-contraption button. Nothing else.

## Non-Functional Requirements

- 60fps target on a mid-range iPad (30fps acceptable floor on older phones).
- Touch targets ≥ 64px; zero reading required.
- Fixed-timestep physics loop; all tuning constants centralized in one config module.
- Strict TypeScript per `conductor/code_styleguides/`.

## Acceptance Criteria

1. App boots from `npm run dev`; Playwright smoke test passes (app loads, scripted scene marble reaches the cup).
2. Vitest unit tests pass for: grid occupancy & placement validation, rotation state machine, save/load serialization.
3. **Reliability gate:** a scripted test scene with all 4 pieces runs marbles end-to-end 20 consecutive times with **0 escapes and 0 stuck marbles**.
4. All edit operations work by touch on a real phone/tablet viewport (Playwright touch emulation).
5. Layout + sound preference survive a page reload.
6. Both portrait and landscape layouts are usable.

## Out of Scope

Puzzle levels & level select · PWA/service worker/install · celebration FX & scoring · color sorting · level editor · free camera · performance polish beyond the 60fps target.

## Technical Notes

Three.js 0.185 + Rapier 0.20, Kenney Marble Kit glTF assets; hand-authored simplified collision shapes per piece type; board edge colliders guarantee containment; fixed-timestep loop decoupled from render. Physics tuning constants centralized for a cheap future "feel polish" pass.
