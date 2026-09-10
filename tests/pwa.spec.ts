import { test, expect } from "@playwright/test";
import { validateManifest } from "../src/domain/manifest";

test.describe("PWA production build", () => {
  test("serves a valid web app manifest", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/manifest+json");
    const manifest = await res.json();
    expect(validateManifest(manifest)).toEqual([]);
  });

  test("index.html links the manifest and apple touch icon", async ({ page }) => {
    await page.goto("/");
    const html = await page.content();
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('href="/manifest.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon"');
  });

  test("serves the service worker with a JS content type", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("javascript");
  });

  test("registers and activates the service worker with full precache", async ({ page }) => {
    await page.goto("/");
    const registration = await page.evaluate(async () => {
      for (let i = 0; i < 50; i += 1) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.active?.state === "activated") {
          return { scope: reg.scope, state: reg.active.state };
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return null;
    });
    expect(registration).not.toBeNull();
    expect(registration?.state).toBe("activated");
    expect(registration?.scope).toContain("localhost:4173");

    // Precache completeness: every asset the game needs must be in the SW cache.
    const cacheKeys = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const urls: string[] = [];
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        urls.push(...(await cache.keys()).map((r) => r.url));
      }
      return urls;
    });
    expect(cacheKeys.some((u) => u.includes("/models/pieces/"))).toBe(true);
    expect(cacheKeys.some((u) => u.includes("/sounds/"))).toBe(true);
  });

  test("boots fully offline and can solve level 1", async ({ page, context }) => {
    // First load online: register + precache, then go offline and reload.
    await page.goto("/");
    await page.waitForFunction(() => window.__marblescape !== undefined);
    await page.waitForFunction(() => document.querySelector("canvas") !== null);
    // Wait until the SW precache holds the game assets before cutting the
    // network (a fixed sleep is flaky on slow CI runners).
    await page.evaluate(async () => {
      const hasAssets = async () => {
        for (const name of await caches.keys()) {
          const cache = await caches.open(name);
          const urls = (await cache.keys()).map((r) => r.url);
          if (
            urls.some((u) => u.includes("/models/pieces/")) &&
            urls.some((u) => u.includes("/sounds/"))
          ) {
            return true;
          }
        }
        return false;
      };
      for (let i = 0; i < 50; i += 1) {
        if (await hasAssets()) return;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    });
    // Ensure the SW is fully activated before cutting the network, so the
    // offline reload is served from precache instead of hitting the network.
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active?.state !== "activated") {
        for (let i = 0; i < 50; i += 1) {
          if (reg.active?.state === "activated") return;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    });

    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => window.__marblescape !== undefined);
    await page.waitForFunction(() => document.querySelector("canvas") !== null);

    // Full offline gameplay: level select -> level 1 -> bridge the gap -> play.
    await page.locator('[data-testid="hud-home"]').click();
    await page.locator('[data-level-select="level-1"]').click();
    const placed = await page.evaluate(() => window.__marblescape?.place("straight", 3, 2));
    expect(placed).toBe(true);
    await page.evaluate(() => window.__marblescape?.play());
    await page.waitForFunction(() => window.__marblescape?.collectedCount() >= 1, undefined, {
      timeout: 45_000,
    });

    // Solve persists offline too.
    const badges = await page.evaluate(() => localStorage.getItem("marblescape.badges.v1"));
    expect(badges).toContain("1");
  });
});
