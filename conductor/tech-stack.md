# Marble Scape — Technology Stack

Version-checked against npm registry on 2026-09-08.

## Core

| Component | Choice | Version |
|---|---|---|
| Language | TypeScript (strict mode) | 7.0.2 |
| Build tool / Dev server | Vite | 8.2.2 |
| 3D Rendering | Three.js | 0.185.1 |
| Physics | @dimforge/rapier3d-compat (WASM, async-init build) | 0.20.0 |
| PWA / Offline | vite-plugin-pwa (Workbox 7.4.1) | 1.3.0 |

> Note: TypeScript 7 is the new native-compiler line. If any tooling incompatibility appears with Vite 8 or Vitest 5, fall back to the latest 5.x release — no code changes expected.

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

## Deployment

Any static file host (Cloudflare Pages / Netlify / GitHub Pages — final choice open). The PWA must precache the app shell, Rapier WASM, glTF assets, and audio (est. 3-5MB).
