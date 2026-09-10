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

## Art & Audio

| Component | Choice |
|---|---|
| 3D models | Kenney Marble Kit (CC0, glTF) |
| Audio | Web Audio API + CC0 samples (Kenney audio), velocity-based pitch-shifting |
| Icons/UI art | Kenney UI packs (CC0) |

## Data & Persistence

| Component | Choice |
|---|---|
| Saves / settings | localStorage (sandbox builds, sound preference, level ✓ badges) |
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
