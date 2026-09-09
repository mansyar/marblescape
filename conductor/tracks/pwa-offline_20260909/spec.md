# Track Spec: PWA & Offline Install (`pwa-offline_20260909`)

## Overview

Make Marble Scape an **installable, fully offline-capable PWA**. The app already
ships with the correct mobile viewport, theme color, and Apple meta tags; what's
missing is the service worker + web app manifest wiring (`vite-plugin-pwa` is a
dependency but is not configured). After this track, a parent can add Marble
Scape to the home screen on any phone/tablet, and the whole game — sandbox, all
6 puzzle levels, sounds, Rapier WASM, and all piece models — must work with no
network connection. This fulfills the v1 success criterion "offline-installable
PWA" from `conductor/product.md`.

## Functional Requirements

### FR1 — Web App Manifest
- A valid `manifest.webmanifest` is generated at build time and linked from
  `index.html`, with: `name` ("Marble Scape"), `short_name`, `id`, `start_url`
  (`/`), `display` (`standalone`), `background_color`, `theme_color`
  (matching the current `#87ceeb`), and `icons` including 192×192 and 512×512
  PNGs plus a 512 maskable icon.
- `index.html` also gains an `apple-touch-icon` link (180×180 PNG) for iOS
  "Add to Home Screen".

### FR2 — App Icons
- Checked-in PNG icons under `public/icons/`: `icon-192.png`, `icon-512.png`,
  `icon-512-maskable.png`, `apple-touch-icon.png` — generated from a simple
  brand motif consistent with the existing `favicon.svg` (sky-blue rounded
  square, orange marble), rendered at the exact required sizes.

### FR3 — Service Worker (full offline play)
- A service worker is generated at build time (Workbox `generateSW`) that
  **precaches the entire app**: JS/CSS bundle, `index.html`, favicon, all
  icons, the Rapier WASM payload, the 4 piece glTF models
  (`/models/pieces/*.glb`), and the 3 sound effects (`/sounds/*.ogg`).
- `navigateFallback` serves `index.html` for offline navigation so any
  deep/refresh navigation works offline.
- Installation is **browser-native**: no custom install UI. The browser's own
  install affordance must appear once the manifest + SW criteria are met.

### FR4 — Update Prompt (banner)
- `registerType: 'prompt'`: when a new service worker is detected, a small
  non-blocking **banner** appears at the top of the screen (styled like the
  existing HUD, cozy palette): "New version ready — Update". Tapping it
  refreshes the page and activates the new version. The banner must not
  interrupt an in-progress game (no modal; it can be ignored).

## Non-Functional Requirements

- **TDD**: new logic in `src/` follows the project workflow (Red → Green →
  coverage > 80%, commit + git note per task). Config-only changes are
  verified via build + e2e instead.
- **Offline reliability**: after the first successful online load, a full
  offline reload must boot the game and complete a level solve with zero
  network requests succeeding (verified by e2e with `context.setOffline`).
- **No regressions**: the existing 203 unit tests and 10 e2e tests stay green;
  the dev-server-based specs are untouched.
- **Deterministic e2e**: PWA specs run against the production build
  (`pnpm preview`) because the SW is only generated for production builds.

## Acceptance Criteria

1. `pnpm build` emits `dist/manifest.webmanifest`, `dist/sw.js`, and all
   precached assets; `pnpm preview` serves them.
2. `dist/index.html` links the manifest and registers the service worker.
3. Unit tests cover a manifest-validation module (required fields, icon
   sizes) with coverage > 80%.
4. E2E `pwa` spec (against `pnpm preview`):
   - manifest is served and validates (FR1 fields present);
   - SW registration becomes active and the precache is complete;
   - with the network turned off (`context.setOffline(true)`), a reload
     boots the full app (canvas + HUD visible) and **level 1 is solvable
     offline** (place ramp, play, marble collected).
5. E2E spec: `index.html` contains the manifest link and apple-touch-icon
   link; `sw.js` is served with `Content-Type: application/javascript`.
6. Manual verification: DevTools → Application shows "Installable" +
   precached asset list (~5–8 MB); airplane-mode reload plays the game;
   a simulated new SW version shows the update banner, and tapping
   "Update" refreshes with the new version active.

## Out of Scope

- Custom install prompt / in-app "Install" button (browser-native only).
- iOS-specific install instructions or splash-screen artwork beyond the
  apple-touch-icon.
- Push notifications, analytics, or any background sync.
- Runtime caching strategies (everything is precached).
- Icon art redesign beyond the simple favicon-derived brand motif.
- Changes to gameplay, physics, levels, or the sandbox.