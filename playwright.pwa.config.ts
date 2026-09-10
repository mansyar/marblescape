import { defineConfig, devices } from "@playwright/test";

// All e2e specs run against the PRODUCTION build (service workers only exist
// in `pnpm build` output), served by `pnpm preview`. The dev-server suite
// (playwright.config.ts) remains for local development only.
export default defineConfig({
  testDir: "tests",
  testMatch: ["tests/*.spec.ts"],
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  },
  projects: [{ name: "pwa-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm build && pnpm preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 240_000,
  },
  workers: 1,
});
