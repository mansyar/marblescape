# Marble Scape

A cozy, tactile 3D marble-run game for young children (ages 5-10), delivered as a fully offline-installable Progressive Web App for phones and iPads. Players drag chunky, Kenney-art-styled track pieces onto a fixed-camera 3D tabletop diorama, snap them to a grid, and press a big Play button to release a few colorful glass marbles that click-clack their way to a goal cup. It combines a free-play sandbox with six gentle "complete the track" puzzle levels that each introduce one piece. There are no scores, timers, or fail states — zero pressure, sound-first design, and cause-and-effect joy are the heart of the experience.

## Target Audience

Children ages 5-10 on phones and iPads. No reading assumed; big touch targets; zero-pressure interaction. Passion project — polish over scale.

## Core Experience

- **Fixed-camera 3D diorama**: tilted tabletop view; the camera never moves. All interaction is designed as if 2D (raycast onto board plane, grid snapping).
- **Interaction loop**: drag piece from palette → snap to grid slot → press Play → marbles run → collect → play again. Child-driven, no gestures to learn beyond drag and tap.
- **Tilted table**: gravity leans ~8° toward the player — every surface drains south and ramps accelerate. Marbles never sit still; the board itself is the first toy.
- **Sound-first**: every marble event has a satisfying sampled sound, pitch-shifted by marble speed. Prominent, persistent mute toggle.
- **Marbles**: 1 marble per run, glass-look with a random candy color. Calm cause-and-effect: one press, one marble, one story.

## v1 Scope

- 1 sandbox scene (Play → run → settle → collect → Play again)
- 6 tiny "complete the track" puzzle levels, each introducing one piece (start chute + gap + goal cup; kid bridges the route)
- 4-piece palette: straight ramp (sloped), curved ramp, trap (channel with center drop hole), goal hole
- All levels open from the start; subtle ✓ badges on solved levels (nothing locked)

## Non-Goals (v1)

- Scores, timers, star ratings, fail states
- Level editor, sharing, leaderboards, monetization
- Sequential unlocking
- Free-camera 3D / orbit controls
- Color-sorting mechanics (candidate for post-v1)

## Success Criteria

1. A child can pick it up with no instruction and stay engaged.
2. Fully playable offline after first load; installable to home screen (PWA).
3. Smooth on mid-range phones and iPads, in both portrait (phone) and landscape (tablet).
4. Sandbox builds and settings persist between sessions (localStorage).

## Known Risks

1. **3D marble physics tuning** — marbles bouncing out of tracks. Mitigation: guard-railed pieces, generous damping, simplified collision shapes, raised board edges.
2. **Dual-orientation support** — doubles layout/UI testing; camera framing adapts per aspect ratio.
3. **Offline bundle size** — Rapier WASM + glTF assets (est. 3-5MB precache); needs a cache strategy early.
4. **Collision shapes per piece** — grid-snapped 3D pieces need hand-authored collision shapes; small with 4 pieces, real cost if palette grows.
