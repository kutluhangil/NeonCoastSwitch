// Times the per-frame CPU work (scene paint + two light passes + GL upload) in a real browser.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chrome = join(homedir(), 'Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const browser = await chromium.launch({ executablePath: existsSync(chrome) ? chrome : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.goto(pathToFileURL(join(root, 'index.html')).href + '?debug');
await page.waitForFunction(() => window.NCS);
const ms = await page.evaluate(() => {
  const out = {};
  for (const t of [0.2, 0.97]) {
    NCS.seek(t);
    NCS.step(1);
    const t0 = performance.now();
    for (let i = 0; i < 120; i++) NCS.step(1 / 60);
    out[t] = (performance.now() - t0) / 120;
  }
  return out;
});
await browser.close();
for (const [t, v] of Object.entries(ms)) console.log(`t=${t}: ${v.toFixed(2)} ms per frame (sim step + render)`);
