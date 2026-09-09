import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 120_000,
  // Rapier WASM physics + glTF loading per page: 2 workers keep the
  // fixed-step sims from starving each other (flaky timeouts at 3+).
  workers: 2,
  use: {
    baseURL: "http://localhost:5173",
    // Kid-sized phone viewport with touch emulation.
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  },
  webServer: {
    command: "pnpm dev --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
