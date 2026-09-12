# Track Spec — First-Run Onboarding

**Track ID:** `first-run-onboarding_20260912` · **Type:** Feature (player onboarding) · **Branch:** `track/first-run-onboarding`

## Overview

Closes the gap behind product success criterion #1 ("A child can pick it up with no instruction"): today a first-ever launch lands the child on an empty sandbox with no clue that pieces are draggable or that Play starts the story. This track adds a passive, no-text, never-blocking first-run sequence: the sandbox is seeded with a one-gap starter track, a ghost hand demonstrates dragging the Ramp into the gap, then pulses Play. Cues advance only on the child's real actions, complete on the first Play press, and never return — existing players (any saved board or flag) are never interrupted. Entirely code-driven: inline SVG/DOM cues, no new dependencies, assets, or precache entries. Drag/tap/Play vocabulary, levels, saves, physics, and sorting stay unchanged.

## Functional Requirements

### FR1 — First-run detection & starter track

- Fresh start = no saved sandbox board (`loadBoard` → null) AND completion flag absent (`marblescape.onboarded.v1`).
- On fresh start, seed a fixed 8×6 starter track: straights at (4,0), (4,1), (4,3), (4,4) rotation 0, classic (colorless) goal cup at (4,5), a single gap at (4,2). Spawn (4,0) is the existing sandbox chute cell.
- Seed pieces are ordinary sandbox pieces: movable, removable, saved immediately; the child may ignore, alter, or dismantle them.
- Seeding happens exactly once. Any board save — including the seed itself — prevents re-seeding; Reset (♻) never re-seeds either.
- Domain exports the layout constant (no ids); Game assigns normal sandbox ids, syncs visuals, and saves.

### FR2 — Step 1 cues: "drag a piece"

- While active: the Ramp palette tile gently pulses, a soft target ring marks the gap cell (projected overlay), and a ghost hand gestures from the Ramp tile toward the gap.
- The hand loops a short gesture; anchor positions are recomputed per loop so orientation/resize changes are absorbed.
- Step advances on the child's first successful sandbox placement (any cell, any type — the taught action is dragging a piece out).
- Cues never block input, never move the child's pieces, and are never involved in placement/rejection decisions.

### FR3 — Step 2 cues: "press Play" & completion

- After step 1: ramp pulse and gap ring stop; the Play button pulses and the hand gestures a tap at it.
- Onboarding completes on the first Play press in any mode, success or not: flag written, cues fade out for good.
- Pressing Play before step 1 (child skips ahead) completes onboarding immediately.
- After completion nothing is ever shown again; nothing else persists besides the flag.

### FR4 — Coexistence & reduced motion

- Cues are sandbox-only: hidden while in a puzzle level or while level-select/solved overlays are up; they resume on return to sandbox until completed.
- Reduced motion (live via `matchMedia`): no traveling hand — static hand beside the Ramp tile + opacity-only pulses. Everything remains completable.
- No reading; cue layer is `pointer-events:none`, `aria-hidden`, and below overlay z-index.
- Existing players: cues never show; their first Play still writes the flag quietly (idempotent).

### FR5 — Hooks & tests

- Cue layer is DOM-inspectable: `data-onboarding-step="place|play|done"` on the root, `[data-onboarding="hand"|"ring"|"play"]` parts; e2e reads the flag directly from localStorage.
- Game gains two nullable callbacks (house pattern, like `onLevelSolved`): `onPiecePlaced` (fired on successful sandbox placement) and `onPlayed` (fired on every Play press) — used by main wiring.
- Unit tests: step machine transitions, flag IO (absent/corrupt/set), starter layout well-formedness (in bounds, no overlaps, chute→gap→goal chain connects via `connectsWith` once the Ramp fills the gap), reduced-motion cue config, projection helper.
- e2e: fresh boot → seed present + gap open + cues at step "place"; place → step "play"; play → flag set + cues gone; reload → no cues, board (with child's edit) persists; pre-existing save → no cues + no reseed; reduced-motion emulation → static hand; one landscape boot assertion.

## Non-Functional Requirements

- TDD per `workflow.md`; >80% coverage on new/changed modules; `pnpm check` clean.
- Zero new dependencies, assets, or precache entries — inline SVG + CSS only.
- No per-frame allocations; cue layer is compositor-friendly; fixed camera unchanged.
- Zero pressure / no reading / no fail states: cues are passive and skippable by simply playing; no timers, no locks, no text.
- Both orientations; save schema, level catalog, physics tunables unchanged.
- Live reduced-motion fallback; existing saves keep today's behavior apart from the silent flag write.

## Acceptance Criteria

1. Fresh install: starter track present, place cues → play cues → completion on Play; flag set; reload keeps board + child's edit, shows no cues.
2. Existing player (saved board or flag): boot identical to today — no seed, no cues.
3. Puzzle mode and overlays never show cues; returning to sandbox resumes them until completed.
4. Reduced motion: no traveling animation; static hand + gentle opacity pulse; still completable.
5. Cues never block anything: child can play, solve, or ignore the whole game while cues show.
6. `pnpm check` + unit suite + 4-viewport production e2e matrix + reliability gates green; new modules >80% coverage.
7. Docs: `product.md` records first-run onboarding + starter seed; `tech-stack.md` gets a dated no-new-deps note.

## Out of Scope

- Rotate / pop-back tutorials, replay button, repeat-onboarding UI, parent settings entry
- Puzzle-mode cues or a guided first level
- Starter-track variations or procedural seeds
- New sounds or audio assets for cues (cues are silent; audio stays event-driven)
- Text, voice-over, localization
- Changes to color sorting, levels, physics, or save schema
- Analytics/telemetry (offline-first stays)

## Risks

- Cue confusion or obscuring → cues passive and subordinate; manual checkpoint per orientation.
- Hand-position math vs fixed camera/orientation → recompute per loop + landscape e2e + reduced-motion branch.
- Seed vs "sandbox saves persist" expectations → seed is ordinary pieces, saved and editable; guarded tests.
- Silent flag write for existing players → no UI impact; unknown-key rollback is trivial.