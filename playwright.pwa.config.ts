import { defineConfig, devices } from "@playwright/test";

// All e2e specs run against the PRODUCTION build (service workers only exist
// in `pnpm build` output), served by `pnpm preview`. The dev-server suite
// (playwright.config.ts) remains for local development only.
//
// Every spec runs in all four viewports (20 specs × 4 projects = 80 runs):
// portrait/landscape phones and iPads cover the dual-orientation matrix.
export default defineConfig({
  testDir: "tests",
  testMatch: ["tests/*.spec.ts"],
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:4173",
    hasTouch: true,
  },
  projects: [
    {
      name: "portrait-phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "landscape-phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 844, height: 390 } },
    },
    {
      name: "portrait-tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "landscape-tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 240_000,
  },
  workers: 1,
});
