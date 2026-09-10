# Implementation Plan — CI/CD Pipeline

> Execution roadmap for `ci-cd-pipeline_20260910`. Follow the project workflow (TDD, phase verification & checkpoints, commit conventions).

## Phase 1 — Repo & version pinning

- [x] Task: Create public GitHub repo `mansyar/marblescape` via `gh repo create`, wire `origin`, push current `master` — repo created + origin wired + master pushed (no code change)
- [x] Task: Pin toolchain — `packageManager: "pnpm@11.24.0"` + `engines.node: "24.16.0"` in `package.json`; verify `pnpm install --frozen-lockfile` resolves clean — `b1bfc94`
- [x] Task: Phase Verification & Checkpoint — `[checkpoint: b1bfc94]`

## Phase 2 — CI workflow (PRs + master)

- [x] Task: Write `.github/workflows/ci.yml` — checkout → Node 24.16.0 + pnpm 11.24.0 (exact) → frozen install → `pnpm check` → `pnpm test` → `pnpm build` → Playwright Chromium → 16 prod e2e vs preview `:4173` → failure-only artifacts → pnpm/browser/build caching → `cancel-in-progress` — `696505d`
- [x] Task: Broaden `playwright.pwa.config.ts` `testMatch` to all 16 specs; confirm dev-server suite stays out of CI — `696505d` (16/16 vs prod build locally)
- [x] Task: Push branch → open PR → verify CI run green (check ✅, 223 unit ✅, 16/16 prod e2e ✅) — PR #1, first run failed (offline-reload flake), fixed `a319ff5`, re-run green
- [x] Task: Phase Verification & Checkpoint — `[checkpoint: a319ff5]`

## Phase 3 — Release workflow (Docker → GHCR → Coolify)

- [ ] Task: Write `Dockerfile` (node:24-alpine build → nginx:alpine, SPA fallback, manifest/sw MIME, gzip) + `.dockerignore`
- [ ] Task: Local image verification — `buildx` amd64+arm64, `docker run`, curl checks (SPA fallback, `application/manifest+json`, sw.js JS MIME, game boots)
- [ ] Task: Write `.github/workflows/release.yml` — `v*` tags only, full CI gates re-run, buildx multi-arch push `ghcr.io/mansyar/marblescape:{v1.2.3,latest}`, Coolify webhook POST + bearer token, auto GitHub Release
- [ ] Task: Set `COOLIFY_WEBHOOK_URL` + `COOLIFY_WEBHOOK_TOKEN` Actions secrets (values from user) via `gh secret set`
- [ ] Task: Dry-run release — tag `v0.1.0` → image on GHCR (public), webhook 200, Release created
- [ ] Task: Phase Verification & Checkpoint

## Phase 4 — Track completion

- [ ] Task: Mark track complete — registry `[x]`, metadata `completed`
- [ ] Task: Final certification — full suite green + docs sync (`tech-stack.md` CI/CD section, `tracks.md`)
- [ ] Task: Phase Verification & Checkpoint