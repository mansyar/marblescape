# Marble Scape

A cozy, tactile 3D marble-run game for young children (ages 5-10), delivered as a fully offline-installable Progressive Web App for phones and iPads. Players drag chunky, Kenney-art-styled track pieces onto a fixed-camera 3D tabletop diorama, snap them to a grid, and press a big Play button to release a few colorful glass marbles that click-clack their way to a goal cup. It combines a free-play sandbox with nine gentle "complete the track" puzzle levels that each introduce one idea — a new piece or color sorting. There are no scores, timers, or fail states — zero pressure, sound-first design, and cause-and-effect joy are the heart of the experience.

## Target Audience

Children ages 5-10 on phones and iPads. No reading assumed; big touch targets; zero-pressure interaction. Passion project — polish over scale.

## Core Experience

- **Fixed-camera 3D diorama**: tilted tabletop view; the camera never moves. All interaction is designed as if 2D (raycast onto board plane, grid snapping).
- **Interaction loop**: drag piece from palette → snap to grid slot → press Play → marbles run → collect → play again. Child-driven, no gestures to learn beyond drag and tap.
- **Tilted table**: gravity leans ~6° toward the player — every surface drains gently south. Marbles never sit still; the board itself is the first toy.
- **Sound-first**: every marble event has a satisfying sampled sound, pitch-shifted by marble speed. Prominent, persistent mute toggle.
- **Marbles**: Up to 5 live marbles — each press drops one; pressing again while the table is full quietly fades the oldest (no waiting, never a fail). Glass-look in six candy colors with a moving catch-light and a soft contact shadow so each marble reads as real and grounded. The next marble waits visibly at the chute — tap it in the sandbox to pick its color; puzzle levels script the order. Calm cause-and-effect: one press, one marble, one story.
- **Color sorting (v1)**: tinted goal cups — a matching marble drops through the open lid, a mismatch rolls over the closed lid and keeps going (never a fail). The compatible cup softly pulses and brightens as its marble approaches; collected marbles rest visibly in their cups.
- **First-run onboarding**: brand-new players start with a seeded starter track that has exactly one open gap, plus passive cues — a glowing target ring and a looping ghost hand that walks the Ramp tile to the gap, then a pulsing ▶. Fill the gap, press Play once, and the cues fade out for good. No text, no locks; returning players never see it.
- **Picture-based level select**: every tile is a miniature of the board it opens — the nine levels are camera-matched renders of their starting boards (floor, walls, furniture, candy-colored cups, and softly highlighted empty gaps), and the sandbox tile shows a live snapshot of the child's own build (refreshed whenever it changes). No digits anywhere; the last reading-dependent UI is gone.

## v1 Scope

- 1 sandbox scene (Play → run → settle → collect → Play again), colored cups included
- 9 tiny "complete the track" puzzle levels (the first six each introduce one piece; levels 7-9 introduce color sorting)
- 4-piece palette: straight channel, curved channel, trap (channel with center drop hole), goal hole — shown as pictures of the pieces themselves (no labels) — plus a color-cup tile that cycles the six candy colors
- 3 color-sorting levels (7-9): scripted marble colors, matching cups open, mismatches roll on
- All levels open from the start; picture tiles (camera-matched mini-board previews) with subtle ✓ badges on solved levels (nothing locked)
- First-run onboarding for new players: seeded one-gap starter track + passive drag/Play cues (shown once, then gone forever)

## Non-Goals (v1)

- Scores, timers, star ratings, fail states
- Level editor, sharing, leaderboards, monetization
- Sequential unlocking
- Free-camera 3D / orbit controls

## Success Criteria

1. A child can pick it up with no instruction and stay engaged.
2. Fully playable offline after first load; installable to home screen (PWA).
3. Smooth on mid-range phones and iPads, in both portrait (phone) and landscape (tablet) — machine-checked: when a device gets busy an adaptive quality system quietly steps rendering quality down to keep frame pacing smooth, restores it when calm, and a CPU-throttled perf gate guards it (track `adaptive-quality_20260913`).
4. Sandbox builds and settings persist between sessions (localStorage).

## Known Risks

1. **3D marble physics tuning** — marbles bouncing out of tracks. Mitigation: guard-railed pieces, rebalanced damping (0.3/0.45, track `physics-feel-polish_20260910`), simplified collision shapes, raised board edges. Verified by headless 20-drop reliability gate (every marble collected, zero escapes) plus the 4-viewport e2e matrix.
2. **Dual-orientation support** — doubles layout/UI testing; camera framing adapts per aspect ratio.
3. **Offline bundle size** — Rapier WASM + glTF assets (est. 3-5MB precache); needs a cache strategy early.
4. **Collision shapes per piece** — grid-snapped 3D pieces need hand-authored collision shapes; small with 4 pieces, real cost if palette grows.
