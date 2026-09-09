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

Any static file host (Cloudflare Pages / Netlify / GitHub Pages — final choice open). The PWA must precache the app shell, Rapier WASM, glTF assets, and audio (est. 3-5MB).
