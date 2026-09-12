# Marble Scape — Technology Stack

Version-checked against npm registry on 2026-09-08.

## Core

| Component | Choice | Version |
|---|---|---|
| Language | TypeScript (strict mode) | 6.0.3 |
| Build tool / Dev server | Vite | 8.2.2 |
| 3D Rendering | Three.js (@types/three for type declarations) | 0.185.1 |
| Physics | @dimforge/rapier3d-compat (WASM, async-init build) | 0.20.0 |
| PWA / Offline | vite-plugin-pwa (Workbox 7.4.1) — wired: `generateSW` precache (bundle, WASM, glTF, OGG, icons) + `registerType: 'prompt'` update banner | 1.3.0 |

> **Deviations from the original version check (2026-09-08, during MVP bootstrap):**
> - **Package manager:** pnpm 11.24.0 (user directive) — not npm.
> - **Lint & format:** Biome 2.5.12 (user directive) — replaces ESLint/Prettier.
> - **TypeScript:** 6.0.3 instead of 7.0.2. At scaffold time, TS 7's release postdates several lint toolchain peer ranges; pinned to 6.0.3 for toolchain compatibility. Revisit upgrade when the lint toolchain ecosystem fully supports TS 7.
> - **PWA wiring (2026-09-09, track `pwa-offline_20260909`):** vite-plugin-pwa activated in `vite.config.ts` — Workbox `generateSW` precaches the full offline bundle (JS/CSS, Rapier WASM, 4 piece GLBs, 3 OGGs, icons, favicon) with `navigateFallback: 'index.html'`; `registerType: 'prompt'` shows a non-blocking "New version ready — Update" banner; manifest served at `/manifest.webmanifest`; icons generated to `public/icons/` (192/512/maskable/apple-touch).
> - **Audio & physics feel (2026-09-10, track `physics-feel-polish_20260910`):** per-marble impact throttling replaces the global 60 ms gate; gentle-impact cutoff lowered (force 1 → 0.35); eased pitch/volume curves; looping roll voice per marble (`public/sounds/roll.ogg`, CC0 qubodup — 4th precached OGG); soft run-settle cue when a run ends away from the goal (stall-capped at 15 s, quiet reap). Physics tunables rebalanced (linear/angular damping 0.3/0.45, restitution 0.3/0.2, spawn height 0.9) — gravity direction fixed.
> - **Celebration & interaction juice (2026-09-11, track `celebration-juice_20260910`):** no new runtime dependencies, assets, or precache entries — sparkles/confetti/juice are code-driven and pooled inside the existing 60 fps budget. See "Celebration & interaction juice" below.
> - **Glass polish & table calm (2026-09-11, track `marble-sheen-glow_20260911`):** no new runtime dependencies, assets, or precache entries — code-driven gleam sprite, pooled contact shadows, emissive cup glow (steady under reduced motion), and the five-marble table rule with a 180 ms silent fade for recycled marbles. See "Glass polish & table calm" below.
> - **First-run onboarding (2026-09-12, track `first-run-onboarding_20260912`):** no new runtime dependencies, assets, or precache entries — the starter seed reuses ordinary board pieces; cues are DOM/SVG + CSS keyframes; the target ring is positioned by a pure `worldToScreen` projection helper over the existing fixed camera. See "First-run onboarding" below.

## Art & Audio

| Component | Choice |
|---|---|
| 3D models | Kenney Marble Kit (CC0, glTF) |
| Audio | Web Audio API + CC0 samples (Kenney impact sounds + qubodup bowling-roll loop), velocity-based pitch/gain, per-marble impact throttle (60 ms voice each), one looping roll voice per marble, soft run-settle cue |
| Icons/UI art | Kenney UI packs (CC0) |

## Data & Persistence

| Component | Choice |
|---|---|
| Saves / settings | localStorage (sandbox builds, sound preference, level ✓ badges, first-run completion flag) |
| Backend / Database | None — fully static, fully offline |

## Quality

| Component | Choice | Version |
|---|---|---|
| Unit tests | Vitest | 5.0.0 |
| E2E / smoke tests | Playwright | 1.63.0 |
| Lint & format | Biome | 2.5.12 |
| Package manager | pnpm | 11.24.0 |

## Deployment

CI/CD (track `ci-cd-pipeline_20260910`, 2026-09-10):

- **CI — GitHub Actions** (`.github/workflows/ci.yml`): PRs + master pushes. Exact toolchain (Node 24.16.0, pnpm 11.24.0 pinned via `packageManager` + `engines`), `pnpm install --frozen-lockfile`, `pnpm check`, unit tests (coverage report), production build, and the full Playwright e2e suite across 4 viewport projects (80 runs) against the production build; failure-only artifacts; pnpm/browser/Vite caching; cancel-in-progress.
- **Release — tags `v*`** (`.github/workflows/release.yml`): full gates re-run, multi-arch (`linux/amd64` + `linux/arm64`) Docker image → GHCR public (`ghcr.io/mansyar/marblescape`), Coolify deploy webhook (bearer; secrets `COOLIFY_WEBHOOK_URL`/`COOLIFY_WEBHOOK_TOKEN`), auto-generated GitHub Release.
- **Container:** multi-stage `Dockerfile` — `node:24.16.0-alpine` build → `nginx:1.29-alpine` (SPA fallback, PWA MIME types, gzip, healthcheck). PWA precache (app shell, Rapier WASM, glTF, audio) ships inside the image.

## Responsive layout

Dual-orientation (track `dual-orientation_20260910`, 2026-09-10): `computeCameraFraming` accepts reserved width/height fractions (pure, unit-tested); `src/ui/layout.ts` classifies viewport (portrait/landscape; landscape rail reserves 18% viewport width); debounced ~100 ms resize watcher (`src/render/resize.ts`, resize + orientationchange) re-frames live without reload or state loss; landscape palette is a right-side rail reusing the portrait drag contract; level-select uses an auto-fit `minmax(96px, 1fr)` grid; safe-area insets respected. E2E: 4 viewport projects (390×844, 844×390, 768×1024, 1024×768) × full production-build suite.

## Celebration & interaction juice

Celebration & Interaction Juice (track `celebration-juice_20260910`, 2026-09-11): everything is code-driven — **no new dependencies, assets, or precache entries**.

- **Collect celebration:** pooled 3D sparkle burst anchored at the goal cup on every collect (≤64 particles per burst, ~0.9 s life, coalesced within 150 ms, 4-slot pool) — `src/render/sparkles.ts`.
- **Solve celebration:** DOM confetti layer (≤120 pieces, ~2.5 s auto-cleanup, one reused layer) plus a solved overlay whose ▶ "Play again" instantly replays the same track with placements untouched (🏠 still returns to level select) — `src/ui/confetti.ts`, `src/ui/solved-overlay.ts`.
- **Interaction juice:** pure curve helpers (`src/render/piece-anim.ts`: snap-bounce 0.22 s `0.85 → 1.06 → 1`, reject wiggle 0.32 s decaying ±0.18 rad, short-way rotate yaw 0.14 s) applied through `src/render/piece-juice.ts` (one tween per mesh, restores rest on cancel, huge-frame safe): valid drop snap-bounce, rejected drop wiggles the piece or the originating palette tile plus a soft low tick, palette tile lift on pickup, quarter-turn spin + tick on tap. Game state still changes immediately — visuals only.
- **Reduced motion:** `prefers-reduced-motion: reduce` is honoured live via a `matchMedia` change listener — sparkles and confetti degrade to a single soft glow (no flying particles).
- **Audio:** reuses the existing `tick`/`clack` samples; the persistent mute toggle governs every effect sound.

## Color sorting

Color Sorting (track `color-sorting_20260911`, 2026-09-11): **no new dependencies, assets, or precache entries** — colors, lids, and trophies are code-driven on existing primitives.

- **Colors** (`src/domain/colors.ts`): six candy colors (names + hex), `nextMarbleColor` cycle, `isMarbleColor` guard; the marble palette moved out of `physics-config` (consumers updated).
- **Persistence** (`src/domain/board.ts`): board schema v2 — goal cups carry an optional candy color; version-1 saves migrate losslessly under the stable `marblescape.board.v1` key; unknown colors degrade to the classic cup.
- **Cup lids** (`src/physics/piece-colliders.ts`, `src/physics/board-bodies.ts`): `goalLid` open (hole ring) vs closed (flush full lid — no rolling step); floors skip every open hole; the lid state machine (`src/domain/cup-lids.ts` + `Game.refreshCupState`) opens only cups matching the collectible marble (live marble in flight, else the next previewed color) and re-syncs lids, floors, and marble targets together.
- **Interaction** (`src/render/waiting-marble.ts`, `src/render/trophies.ts`, `src/render/piece-view.ts`, `src/render/piece-juice.ts`): the waiting marble shows the next drop color (tap-to-cycle in the sandbox); cups are tinted per color with a tint-pulse flash; collected marbles rest visibly in their cups as non-physics trophy meshes.
- **Sorting levels** (`src/domain/levels.ts`, `src/domain/solve.ts`): catalog grew to 9 — levels 7-9 use colored cups with ordered `marbleColors` scripts; a level solves only when the full script is collected (`isLevelComplete`); badge ids validate against the shipped catalog (`src/domain/badges.ts`).

## Glass polish & table calm

Marble Sheen, Cup Glow & Table Limit (track `marble-sheen-glow_20260911`, 2026-09-11): **no new dependencies, assets, or precache entries** — code-driven visuals on existing primitives.

- **Table limit** (`src/domain/physics-config.ts`, `src/physics/marbles.ts`, `src/render/marble-fade.ts`): `PHYSICS.maxMarblesOnTable = 5`; a drop beyond the cap recycles the oldest marble — removed from the sim immediately and never counted as collected or rescued (`recycledCount()` hook), while its mesh eases out with a silent 180 ms shrink/fade (instant under reduced motion).
- **Sheen & grounding** (`src/render/marble-gleam.ts`, `src/render/marble-shadow.ts`): per-marble additive catch-light sprite (shared material + generated texture, camera-facing, no per-frame allocations) and pooled soft blob contact shadows (generated radial texture; scale/opacity follow height; no shadow maps).
- **Cup anticipation glow** (`src/render/cup-glow.ts`): compatible cups pulse softly and brighten as a matching marble nears (emissive in the cup's own color so hues stay true; steady under reduced motion; lids stay readable; at most a few cups, no per-frame allocations).

## First-run onboarding

First-Run Onboarding (track `first-run-onboarding_20260912`, 2026-09-12): **no new dependencies, assets, or precache entries** — code-driven, reusing the board, palette, and HUD primitives.

- **Fresh-start detection** (`src/domain/first-run.ts`, `src/domain/onboarding.ts`): `isFirstRun` = no saved board AND no `marblescape.onboarded.v1` flag; the starter layout (8×6: four straights, one classic goal, one gap at (4,2)) is seeded via `Game.seedFirstRun()` with ordinary sandbox piece ids and saved immediately.
- **Cue layer** (`src/ui/onboarding.ts`, `src/ui/cue-config.ts`, `src/render/projection.ts`): passive `pointer-events:none` DOM overlay — target ring at the gap, looping ghost hand (Ramp tile → gap, then Play), pulsing Ramp tile (`setTilePulse` hook in `src/ui/palette.ts`), pulsing ▶ (`createHud` returns the play ref). Sandbox-only; hidden under level select/solved overlays; loop anchors recomputed per cycle and on resize.
- **Completion** (`Game.onPiecePlaced` / `onPlayed` callbacks): the first successful placement advances to the Play step; the first Play press (any mode, skip-ahead included) writes the flag and fades the cues out for good. Existing players never see cues; their first Play still records the flag.
- **Reduced motion:** static hand beside the Ramp tile, opacity-only pulses (live `matchMedia` branch).
