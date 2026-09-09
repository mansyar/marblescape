# Implementation Plan: PWA & Offline Install (`pwa-offline_20260909`)

Branch: `track/pwa-offline-install` (from `master` @ merge of puzzle track)

## Phase 1 — Manifest module, icons & PWA config

- [ ] Task: Document PWA wiring in `conductor/tech-stack.md` (vite-plugin-pwa moved from "listed, not wired" to "wired: generateSW + prompt registration") before implementation
- [ ] Task: Write failing tests for manifest validation module
  - [ ] `src/domain/manifest.test.ts`: accepts a valid manifest (name, short_name, id, start_url `/`, display `standalone`, theme_color, background_color, icons incl. 192×192, 512×512, and a `purpose: "maskable"` 512 icon)
  - [ ] Rejects missing/empty `name`, missing `short_name`, non-`standalone` display, missing start_url, missing theme/background color, missing icons, icons without a 192 or a 512 entry, missing maskable icon
  - [ ] Red confirmed (module missing → test file fails to load)
- [ ] Task: Implement `src/domain/manifest.ts` (validateManifest returning `string[]` errors, exported `REQUIRED_ICON_SIZES`) — Green, coverage > 80%
- [ ] Task: Generate app icons
  - [ ] `scripts/gen-icons.mjs`: Playwright-driven render of the favicon brand motif (sky-blue rounded square + orange marble) at 192/512/512-maskable/180 px → `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`
  - [ ] Run once, verify PNG dimensions, check in
- [ ] Task: Wire `vite-plugin-pwa` into `vite.config.ts`
  - [ ] `vitePWA({ registerType: 'prompt', includeAssets, workbox: { globPatterns incl. `**/*.glb`, `**/*.ogg`, navigateFallback: 'index.html' }, manifest: { …FR1 fields, icons } })`
  - [ ] `index.html`: manifest link + apple-touch-icon link added (injected/static)
- [ ] Task: Build & preview smoke — `pnpm build` emits `dist/manifest.webmanifest`, `dist/sw.js`, precached assets; `pnpm preview` serves them; `pnpm check` clean
- [ ] Task: Coverage check + commit + git note (incl. tech-stack.md update)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2 — Update banner

- [ ] Task: Write failing tests for update-banner state
  - [ ] `src/domain/pwa-update.test.ts`: state machine `'idle' | 'ready' | 'activating'` — onNeedRefresh transitions idle→ready; update/dismiss transitions ready→activating/idle; repeat needRefresh while ready stays ready
  - [ ] Red confirmed
- [ ] Task: Implement `src/domain/pwa-update.ts` (pure reducer + `createUpdateState()`) — Green, coverage > 80%
- [ ] Task: Implement `src/ui/update-banner.ts` + wire registration in `src/main.ts`
  - [ ] `registerSW` from `virtual:pwa-register` with `onNeedRefresh` → show banner ("New version ready — Update", cozy HUD style, `data-testid="update-banner"`); tap → `updateSW(true)`
  - [ ] Banner is non-blocking (fixed top, dismissible by tapping Update or X), never interrupts play
- [ ] Task: Coverage check + commit + git note
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3 — PWA e2e verification & regression

- [ ] Task: Write `tests/pwa.spec.ts` (production-build spec) + `playwright.pwa.config.ts`
  - [ ] Config: `webServer: pnpm build && pnpm preview --port 4173 --strictPort`, testMatch `tests/pwa.spec.ts`, excluded from the main dev-server config
  - [ ] Spec: manifest served at `/manifest.webmanifest` and passes `validateManifest` (unit module reused in e2e); `index.html` contains manifest + apple-touch-icon links; `sw.js` served with JS content type
  - [ ] Spec: SW registration becomes active and precache completes (first online load)
  - [ ] Spec: `context.setOffline(true)` → reload → full app boots (canvas + HUD visible, `window.__marblescape` present)
  - [ ] Spec: **level 1 solvable offline** — enter level, place ramp, play, marble collected (badge persists)
- [ ] Task: Full regression gate — `pnpm check`, unit suite, existing dev-server e2e suite (10 tests) all green
- [ ] Task: Coverage check + commit + git note
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4 — Track completion

- [ ] Task: Mark track complete — registry `[x]`, metadata `completed`
- [ ] Task: Final full-suite certification + git note
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)