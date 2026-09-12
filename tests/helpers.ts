import type { Page } from "@playwright/test";

/**
 * Boots the page as an existing player: sets the first-run completion flag
 * before app code runs, so specs that assume a free sandbox never receive
 * the starter seed or the onboarding cues (spec FR4).
 */
export async function blockFirstRun(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("marblescape.onboarded.v1", "done");
  });
}