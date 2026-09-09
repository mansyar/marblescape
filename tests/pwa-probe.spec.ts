import { test, expect } from "@playwright/test";

// Sanity probe for the PWA track: SW registration + update banner presence
// against the production preview build (SW only exists in prod builds).
test("probe: SW registers and update banner is in the DOM", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__marblescape !== undefined);

  // Registration is async — poll inside a single evaluate until the SW is
  // fully activated (mirrors the manual probe that verified registration).
  const registration = await page.evaluate(async () => {
    for (let i = 0; i < 50; i += 1) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.active?.state === "activated") {
        return { scope: reg.scope, active: true, state: reg.active.state };
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return null;
  });
  expect(registration).not.toBeNull();
  expect(registration?.active).toBe(true);
  expect(registration?.state).toBe("activated");
  expect(registration?.scope).toContain("localhost:4173");

  const banner = page.locator('[data-testid="update-banner"]');
  await expect(banner).toHaveCount(1);
  await expect(banner).toBeHidden();
});
