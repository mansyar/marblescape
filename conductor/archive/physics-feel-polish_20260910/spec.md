# Track Spec — Physics Feel Polish

**Track ID:** `physics-feel-polish_20260910` · **Type:** Feature (polish) · **Branch:** `track/physics-feel-polish`

## Overview

A targeted polish pass over marble motion and sound, closing the "feel polish" follow-up deferred since the MVP and Known Risk #1 (3D marble physics tuning). Goal: the click-clack drama of a real marble run — marbles that flow, roll audibly, click musically, and finish their story with a clear "run done" moment. Gravity direction stays fixed; everything else tunable is on the table.

## Functional Requirements

### FR1 — Motion retuning (constants-only lever)

- Retune the centralized `PHYSICS` constants (`src/domain/physics-config.ts`): linear/angular damping, marble/board restitution, spawn height and jitter — tuned so runs read as lively but never chaotic, and marbles never visibly bounce out of channels.
- Gravity **direction** is fixed (~8° south tilt); its magnitude may be re-balanced only within the existing tilt.

### FR2 — Audio feel (physics + audio together)

- Replace the single global 60 ms impact gate with **per-marble throttling** so rapid click-clack sequences are not silently dropped.
- Lower the current "ignore all impacts below force 1" cutoff so gentle, low-speed ticks still sound.
- Refine pitch/volume curves (keep the existing musical band; no screeching).
- Add a **CC0 roll sample** (Kenney audio or equivalent): one looping roll voice per moving marble, gain + playback rate driven by actual marble speed, stopped when the marble slows or is reaped.

### FR3 — Explicit run-settle detection

- New pure, unit-tested detector (`src/domain/run-settle.ts`): a **run is finished** when (a) every spawned marble has been collected or rescued, or (b) all live marbles stay below a velocity threshold for N consecutive physics steps.
- **Stall cap:** if a run exceeds ~15 s, it is declared finished and lingering marbles are quietly reaped (rescued path) — a jam can never outlive the session.
- Emits an `onRunSettled` event consumed by the game to play a soft final cue. **Play never locks** — the button always works; settle only adds a cue (and optionally a gentle pulse), never a gate.

### FR4 — Deterministic verification

- Headless simulation tests with seeded boards and scripted fixed-step runs asserting: no marble escapes beyond the rescue path, no stall beyond the cap, every spawned marble is accounted for (collected/rescued), and settle fires within bounds.
- Existing 4-viewport Playwright e2e matrix remains green as the regression gate.

## Non-Functional Requirements

- All tunables remain centralized (physics + new audio mapping constants); no magic numbers in call sites.
- Roll audio must be bounded: at most one active roll voice per marble; no leaks when marbles are reaped.
- Mobile Safari audio unlock behavior preserved; mute toggle governs all new sounds.
- >80% coverage on new modules; `pnpm check` + full test suite green.

## Acceptance Criteria

1. A full level run sounds and reads like a marble run: continuous roll while moving, discrete clicks at impacts, soft final cue when the run ends.
2. Rapid impacts no longer drop sounds (per-marble throttle verified by unit test).
3. A stalled/creeping marble is reaped within the ~15 s cap (headless sim test).
4. Settle event fires exactly once per run, on the detector's terms (collected/rescued/at-rest), never blocking Play.
5. All existing unit tests and the e2e viewport matrix pass unchanged (except updated expectations where intentionally tuned).

## Out of Scope

- New pieces, new levels, level design changes
- Visual juice (confetti, sheen, celebration effects) — separate track
- Color sorting (post-v1 feature track)
- Camera framing changes, physics engine swap, render loop changes
