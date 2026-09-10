# Track: CI/CD Pipeline

> Source of truth for the CI/CD track. Approved by user on 2026-09-10.

## Overview

Establish a robust, stable, and efficient CI/CD pipeline for Marble Scape: **GitHub Actions** CI on PRs + master pushes (full verification against the production build), and **tag-based releases** that publish a multi-arch **nginx Docker image** to **GHCR (public)** and deploy to **Coolify** via webhook + bearer token, with auto-generated GitHub Releases.

## Functional Requirements

- **FR1 — Repo & remote**: Create public GitHub repo `mansyar/marblescape` via `gh CLI` (authenticated: `mansyar`, scopes incl. `repo` + `workflow`); wire `origin`; repo public so GHCR packages are public by default (Coolify pulls unauthenticated).
- **FR2 — CI workflow** (`.github/workflows/ci.yml`): runs on **PRs + push to master**. Steps: checkout → setup Node **24.16.0** + pnpm **11.24.0** (exact, matching local) → `pnpm install --frozen-lockfile` → `pnpm check` (tsc + Biome) → `pnpm test` (Vitest, coverage report) → `pnpm build` → Playwright Chromium install → **all 16 e2e specs against the production build** (preview `:4173`) → upload Playwright report + coverage artifacts **only on failure**.
- **FR3 — Version pinning**: Add `packageManager: "pnpm@11.24.0"` to `package.json`; pin `node-version: 24.16.0` in setup-node; `engines` field for reproducibility.
- **FR4 — Prod-only e2e in CI**: Broaden `playwright.pwa.config.ts` `testMatch` to all spec files (`levels`, `smoke`, `probe`, `reliability`, `pwa`, `pwa-probe` — 16 specs). Dev-server suite (`playwright.config.ts`) stays for local dev only; CI never starts a dev server.
- **FR5 — Release workflow** (`.github/workflows/release.yml`): triggers on **`v1.2.3` semver tags only**; re-runs the full CI gates; then `docker buildx` **multi-arch amd64+arm64** → push `ghcr.io/mansyar/marblescape:v1.2.3` **and** `:latest` → POST Coolify deploy webhook with bearer token (secrets `COOLIFY_WEBHOOK_URL` / `COOLIFY_WEBHOOK_TOKEN` — user provides during implementation) → create GitHub Release with auto-generated notes.
- **FR6 — Docker image**: Multi-stage — `node:24-alpine` builds the Vite app; `nginx:alpine` runtime with SPA fallback (`try_files`), correct MIME for `manifest.webmanifest` + `sw.js`, gzip; serves the PWA precache bundle (~5–8 MB incl. WASM/GLB/OGG).
- **FR7 — Master = CI only**: pushes to master never build/push images or deploy; releases are explicit tag events.
- **FR8 — Efficiency**: Full caching (pnpm store via setup-node cache, Playwright browsers `~/.cache/ms-playwright`, Vite build cache); `concurrency: cancel-in-progress` for CI; fail-fast; single dependency install; no dev-server suite.

## Non-Functional Requirements

- **Stability**: exact version pins; frozen lockfile; deterministic prod-build e2e; Playwright retries (1) for flake tolerance; generous step timeouts; minimal workflow permissions (`contents: read` on CI; `packages: write` + `contents: write` on release).
- **Efficiency**: warm runs target ≤3 min via caching; cancellation of superseded runs.
- **Security**: no secrets committed; all credentials via Actions secrets; `GITHUB_TOKEN` scoped minimally.
- **Workflow compliance**: unchanged local developer loop (`pnpm check` / `pnpm test` / e2e) — CI mirrors it 1:1 against the prod bundle.

## Acceptance Criteria

- [ ] `gh repo create` done; `origin` → `https://github.com/mansyar/marblescape` (public); `git push` succeeds
- [ ] `package.json` has `packageManager: "pnpm@11.24.0"`; CI uses Node 24.16.0 / pnpm 11.24.0
- [ ] `.github/workflows/ci.yml` + `release.yml` valid; a pushed PR branch triggers a **green** run: check ✅, 223 unit ✅, build ✅, 16/16 prod e2e ✅
- [ ] `playwright.pwa.config.ts` runs all 16 specs against the prod build; dev-server suite excluded from CI
- [ ] `Dockerfile` multi-stage builds via `buildx` for amd64+arm64; local `docker run` serves the game with SPA fallback + `application/manifest+json` + `text/javascript` for sw.js
- [ ] Tag `v0.1.0` → release workflow green → image on GHCR (public, `v0.1.0` + `latest` tags) → Coolify webhook receives POST (200) → GitHub Release created
- [ ] Second consecutive CI run shows cache hits (pnpm store + Playwright browsers)
- [ ] No secrets in repo; `COOLIFY_WEBHOOK_URL` / `COOLIFY_WEBHOOK_TOKEN` set as Actions secrets

## Out of Scope

Branch protection rules · notifications (Slack/Discord/etc.) · nightly/scheduled runs · deploying on master · custom image tag schemes · any app-code changes beyond `package.json`/configs · DevTools installability changes.