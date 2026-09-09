// Generates the PWA icons (192/512/maskable/apple-touch PNGs) from a simple
// brand SVG, rendered at exact sizes via Playwright's headless Chromium.
// Run: node scripts/gen-icons.mjs  (playwright is a devDependency)
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });

const SVG = (size, maskable) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="ball" cx="35%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#ffc15e"/>
      <stop offset="45%" stop-color="#ff9f43"/>
      <stop offset="100%" stop-color="#f5761a"/>
    </radialGradient>
  </defs>
  ${maskable ? "" : `<rect width="512" height="512" rx="96" fill="#87ceeb"/>`}
  ${maskable ? `<rect width="512" height="512" fill="#87ceeb"/>` : ""}
  <circle cx="256" cy="256" r="170" fill="url(#ball)"/>
  <ellipse cx="208" cy="208" rx="58" ry="38" fill="#ffffff" opacity="0.55" transform="rotate(-32 208 208)"/>
  <ellipse cx="322" cy="322" rx="70" ry="46" fill="#a8540f" opacity="0.25" transform="rotate(-32 322 322)"/>
</svg>`;

async function render(name, size, maskable) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<!doctype html><body style="margin:0">${SVG(size, maskable)}</body>`,
  );
  await page.screenshot({ path: `${OUT}/${name}`, clip: { x: 0, y: 0, width: size, height: size } });
  await browser.close();
  console.log(`wrote ${OUT}/${name} (${size}x${size})`);
}

await render("icon-192.png", 192, false);
await render("icon-512.png", 512, false);
await render("icon-512-maskable.png", 512, true);
await render("apple-touch-icon.png", 180, false);