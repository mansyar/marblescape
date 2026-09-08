# Marble Scape — Product Guidelines

## Design Principles (in priority order)

1. **Zero pressure** — no fail states, no timers, no scores. Missing the cup is just "the marble went adventuring." Solving a level gets a joyful celebration; not solving gets nothing bad.
2. **No reading required** — icon-driven UI, big buttons (minimum 64px touch targets), visual and audio feedback over text.
3. **Sound-first** — every marble event (click, clack, roll, plonk, fanfare) has a satisfying sampled sound, pitch-shifted by actual marble velocity. Sound must be believable. Prominent, persistent mute toggle on every screen.
4. **One big idea per screen** — the board dominates the viewport; UI chrome is minimal.
5. **Physical believability** — motion, sound, and visuals must agree. A marble's velocity drives its sound; pieces wobble and respond to touch.
6. **Celebration, not judgment** — confetti/sparkles on success; progress shown only as subtle ✓ badges, never as gates.

## Voice & Tone

Warm, playful, encouraging. Any visible text is minimal, lowercase-friendly, and read-aloud-simple. The game never says "fail", "wrong", or "try harder" — at most a gentle "try a different piece!".

## Visual Style

- Kenney low-poly 3D art (Marble Kit), CC0
- Warm wooden workshop palette, soft shadows, cozy tabletop diorama
- Candy-colored glass-look marbles
- Fixed tilted camera; scene framing adapts to portrait phone and landscape tablet

## UX Rules

- The interaction vocabulary is exactly: **drag, tap, Play button**. No pinch, no orbit, no multi-touch requirements.
- Pieces snap to grid slots; ambiguous overlaps are impossible by construction.
- Marbles can never escape the board (raised edges, guard rails).
- Settings are limited to sound on/off. No menus deeper than one level.
- Sandbox builds and sound preference auto-save (localStorage); the app resumes where the child left off.
- Both orientations must be fully supported from day one.
