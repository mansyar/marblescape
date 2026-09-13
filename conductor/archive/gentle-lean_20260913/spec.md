# Track Spec — Gentle Lean & Flat Straights

**Track ID:** `gentle-lean_20260913` · **Type:** Feature (physics feel + visuals) · **Branch:** `track/gentle-lean`

## Overview

Two corrections to the tabletop's physical language, in the spirit of physical believability (product principle #5):

1. **Gentler lean.** The simulated table lean drops from ~8° to ~6° south (`gravity z` 2.5 → 1.88), so marbles flow with less urgency and runs feel calmer.
2. **Honest straights.** The straight piece currently *looks* like a ramp (mesh pitched 0.09 rad + lifted) while its collider has been flat since the physics-feel work. Remove the visual ramp so every piece reads flush, seams disappear, and the look matches the physics.

The south pull is the only drive force (all colliders are already flat), so the reliability gates and the 9-level e2e suite are the contract; a light re-tune of centralized constants is allowed inside this track if needed.

## Functional Requirements

### FR1 — Reduced lean

- `PHYSICS.gravity` becomes a ~6° south pull (`y = -17.8`, `z ≈ 1.88`); direction stays due south with zero east-west drift.
- The comment and the gravity unit test encode the new angle (angle derived from the vector, not a magic z value).

### FR2 — Flat straight look

- `CONNECTIONS.straight` no longer declares a slope; the now-unused `slope` field is removed from `PieceDef`.
- `posePiece` renders every piece flush (yaw alignment only — no pitch, no lift).
- Live renderer, palette thumbnails, and level mini-boards all share that poser, so all three surfaces show flat straights automatically.

### FR3 — Flow preserved

- A marble released at the chute on a flat straight still accelerates south and reaches a downstream cup.
- Both 20-drop reliability gates (classic + colored) stay green on the 4-viewport matrix: 0 escapes, 0 rescues, every marble collected.
- All 9 levels still solve; no new stuck/stall regressions (settle/rescue behavior no worse than today).
- If flow needs help, only centralized constants in `physics-config.ts` (damping / restitution / spawn height) are re-tuned, each change justified by a failing test or gate result.

### FR4 — Visual flushness

- Straight channels look flush with their neighbors at all 4 rotations: no raised lips, no visible seam steps, no marble clipping.
- Palette tile and level previews match the live board geometry.

### FR5 — No behavior changes elsewhere

- Level data, saves, rotation/placement rules, sorting, audio, first-run onboarding, picture tiles, HUD, and celebration behavior are unchanged.

## Non-Functional Requirements

- TDD per `workflow.md`; >80% coverage on changed modules; `pnpm check` clean.
- No new dependencies, assets, or precache entries; offline behavior identical.
- All tunables stay in `physics-config.ts`.
- Docs sync: `product.md` (~6° lean; "straight channel", not ramp), `tech-stack.md` (tuning notes), inline comments.

## Acceptance Criteria

1. Gravity encodes a ~6° south lean (unit test asserts the angle within tolerance; due south; no E-W drift).
2. No piece carries a visual slope; unit tests assert flat posing everywhere the poser is used (live, thumbnails, previews).
3. Both reliability gates pass with 0 escapes / 0 rescues / all collected across the 4 viewports.
4. All 9 levels still solve in e2e; no increase in rescues/stalls.
5. Owner manual pass on phone (portrait + landscape): straights look flush; runs feel calmer but clearly flowing.
6. `product.md` + `tech-stack.md` updated; `pnpm check` + unit + e2e green.

## Out of Scope

- Collider shape changes (already flat) or new pieces.
- Camera / framing changes.
- Level data, audio, celebration, onboarding, picture tiles, or save changes.
- Per-level hacks or special-case tuning.

## Risks

- **Stalls at the gentler lean** (curve deflectors, funnel entries, seams) → gates + level e2e are the proof; re-tune only central constants.
- **Settle/rescue heuristics at slower speeds** (false "settled" cues or slower rescues) → verify in e2e + manual pass; adjust only on a concrete regression.
- **Model alignment** — flattening may reveal an authored offset in `straight.glb` → compare against flush neighbors at 4 rotations; fix via poser constants, not per-model hacks.
- **Test churn** — `pieces`/`thumbnails` tests currently assert the ramp; update them deliberately to assert flatness.
