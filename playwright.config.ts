import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 120_000,
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
