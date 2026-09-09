# Implementation Plan: PWA & Offline Install (`pwa-offline_20260909`)

Branch: `track/pwa-offline-install` (from `master` @ merge of puzzle track)

## Phase 1 — Manifest module, icons & PWA config

- [x] Task: Document PWA wiring in `conductor/tech-stack.md` (vite-plugin-pwa moved from "listed, not wired" to "wired: generateSW + prompt registration") before implementation — `730b594`
- [x] Task: Write failing tests for manifest validation module
  - [x] `src/domain/manifest.test.ts`: accepts a valid manifest (name, short_name, id, start_url `/`, display `standalone`, theme_color, background_color, icons incl. 192×192, 512×512, and a `purpose: "maskable"` 512 icon)
  - [x] Rejects missing/empty `name`, missing `short_name`, non-`standalone` display, missing start_url, missing theme/background color, missing icons, icons without a 192 or a 512 entry, missing maskable icon
  - [x] Red confirmed (module missing → test file fails to load)
- [x] Task: Implement `src/domain/manifest.ts` (validateManifest returning `string[]` errors, exported `REQUIRED_ICON_SIZES`) — Green, coverage > 80% — `7743ddc`
- [x] Task: Generate app icons — `241fb64`
  - [x] `scripts/gen-icons.mjs`: Playwright-driven render of the favicon brand motif (sky-blue rounded square + orange marble) at 192/512/512-maskable/180 px → `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`
  - [x] Run once, verify PNG dimensions, check in
- [x] Task: Wire `vite-plugin-pwa` into `vite.config.ts` — `5d29767`
  - [x] `vitePWA({ registerType: 'prompt', includeAssets, workbox: { globPatterns incl. `**/*.glb`, `**/*.ogg`, navigateFallback: 'index.html' }, manifest: { …FR1 fields, icons } })`
  - [x] `index.html`: apple-touch-icon link added (manifest link left to plugin injection; plugin installed — was listed in tech-stack but missing from package.json)
- [x] Task: Build & preview smoke — `pnpm build` emits `dist/manifest.webmanifest`, `dist/sw.js`, precached assets; `pnpm preview` serves them; `pnpm check` clean — `5d29767`
- [x] Task: Coverage check + commit + git note (incl. tech-stack.md update) — `7743ddc`, `730b594`
- [x] Task: Phase Verification & Checkpoint — [checkpoint: a28494c]

## Phase 2 — Update banner

- [x] Task: Write failing tests for update-banner state — `90daae9`
  - [x] `src/domain/pwa-update.test.ts`: state machine `'idle' | 'ready' | 'activating'` — onNeedRefresh transitions idle→ready; update/dismiss transitions ready→activating/idle; repeat needRefresh while ready stays ready
  - [x] Red confirmed
- [x] Task: Implement `src/domain/pwa-update.ts` (pure reducer + `createUpdateState()`) — Green, coverage > 80% — `90daae9`
- [x] Task: Implement `src/ui/update-banner.ts` + wire registration in `src/main.ts` — `8b47315`
  - [x] `registerSW` from `virtual:pwa-register` with `onNeedRefresh` → show banner ("New version ready — Update", cozy HUD style, `data-testid="update-banner"`); tap → `updateSW(true)`
  - [x] Banner is non-blocking (fixed top, dismissible by tapping Update or X), never interrupts play
- [x] Task: Coverage check + commit + git note — `90daae9`, `8b47315`
- [x] Task: Phase Verification & Checkpoint — [checkpoint: b0570b0]

## Phase 3 — PWA e2e verification & regression

- [x] Task: Write `tests/pwa.spec.ts` (production-build spec) + `playwright.pwa.config.ts` — `8fb224b`
  - [x] Config: `webServer: pnpm build && pnpm preview --port 4173 --strictPort`, testMatch `tests/pwa.spec.ts`, excluded from the main dev-server config
  - [x] Spec: manifest served at `/manifest.webmanifest` and passes `validateManifest` (unit module reused in e2e); `index.html` contains manifest + apple-touch-icon links; `sw.js` served with JS content type
  - [x] Spec: SW registration becomes active and precache completes (first online load)
  - [x] Spec: `context.setOffline(true)` → reload → full app boots (canvas + HUD visible, `window.__marblescape` present)
  - [x] Spec: **level 1 solvable offline** — enter level, place ramp, play, marble collected (badge persists)
- [x] Task: Full regression gate — `pnpm check`, unit suite, existing dev-server e2e suite (10 tests) all green — `8fb224b`
- [x] Task: Coverage check + commit + git note — `8fb224b`
- [x] Task: Phase Verification & Checkpoint — [checkpoint: 8fb224b]

## Phase 4 — Track completion

- [x] Task: Mark track complete — registry `[x]`, metadata `completed` — `cea48d2`
- [x] Task: Final full-suite certification + git note — `cea48d2`
- [x] Task: Phase Verification & Checkpoint — [checkpoint: cea48d2]

## Phase: Review Fixes

- [x] Task: Apply review suggestions `5bb264d`