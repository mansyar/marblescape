# Marble Scape

A cozy, tactile 3D marble-run game for young children (ages 5-10), delivered as a fully offline-installable Progressive Web App for phones and iPads. Players drag chunky, Kenney-art-styled track pieces onto a fixed-camera 3D tabletop diorama, snap them to a grid, and press a big Play button to release a few colorful glass marbles that click-clack their way to a goal cup. It combines a free-play sandbox with nine gentle "complete the track" puzzle levels that each introduce one idea — a new piece or color sorting. There are no scores, timers, or fail states — zero pressure, sound-first design, and cause-and-effect joy are the heart of the experience.

## Target Audience

Children ages 5-10 on phones and iPads. No reading assumed; big touch targets; zero-pressure interaction. Passion project — polish over scale.

## Core Experience

- **Fixed-camera 3D diorama**: tilted tabletop view; the camera never moves. All interaction is designed as if 2D (raycast onto board plane, grid snapping).
- **Interaction loop**: drag piece from palette → snap to grid slot → press Play → marbles run → collect → play again. Child-driven, no gestures to learn beyond drag and tap.
- **Tilted table**: gravity leans ~8° toward the player — every surface drains south and ramps accelerate. Marbles never sit still; the board itself is the first toy.
- **Sound-first**: every marble event has a satisfying sampled sound, pitch-shifted by marble speed. Prominent, persistent mute toggle.
- **Marbles**: 1 marble per run, glass-look in six candy colors. The next marble waits visibly at the chute — tap it in the sandbox to pick its color; puzzle levels script the order. Calm cause-and-effect: one press, one marble, one story.
- **Color sorting (post-v1)**: tinted goal cups — a matching marble drops through the open lid, a mismatch rolls over the closed lid and keeps going (never a fail). Collected marbles rest visibly in their cups.

## v1 Scope

- 1 sandbox scene (Play → run → settle → collect → Play again), colored cups included
- 9 tiny "complete the track" puzzle levels (the first six each introduce one piece; levels 7-9 introduce color sorting)
- 4-piece palette: straight ramp (sloped), curved ramp, trap (channel with center drop hole), goal hole — plus a color-cup tile that cycles the six candy colors
- 3 color-sorting levels (7-9): scripted marble colors, matching cups open, mismatches roll on
- All levels open from the start; subtle ✓ badges on solved levels (nothing locked)

## Non-Goals (v1)

- Scores, timers, star ratings, fail states
- Level editor, sharing, leaderboards, monetization
- Sequential unlocking
- Free-camera 3D / orbit controls

## Success Criteria

1. A child can pick it up with no instruction and stay engaged.
2. Fully playable offline after first load; installable to home screen (PWA).
3. Smooth on mid-range phones and iPads, in both portrait (phone) and landscape (tablet).
4. Sandbox builds and settings persist between sessions (localStorage).

## Known Risks

1. **3D marble physics tuning** — marbles bouncing out of tracks. Mitigation: guard-railed pieces, rebalanced damping (0.3/0.45, track `physics-feel-polish_20260910`), simplified collision shapes, raised board edges. Verified by headless 20-drop reliability gate (every marble collected, zero escapes) plus the 4-viewport e2e matrix.
2. **Dual-orientation support** — doubles layout/UI testing; camera framing adapts per aspect ratio.
3. **Offline bundle size** — Rapier WASM + glTF assets (est. 3-5MB precache); needs a cache strategy early.
4. **Collision shapes per piece** — grid-snapped 3D pieces need hand-authored collision shapes; small with 4 pieces, real cost if palette grows.
