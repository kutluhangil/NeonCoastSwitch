// Records README media from the real page: an evening sweep and a hold-up clip (GIF),
// plus golden-hour / dusk / night stills. Needs ffmpeg on PATH.
// Usage: node scripts/build.mjs && node scripts/readme-media.mjs
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir, tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs/media');
const work = join(tmpdir(), 'ncs-frames');
mkdirSync(outDir, { recursive: true });
const chrome = join(homedir(), 'Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');

const browser = await chromium.launch({ executablePath: existsSync(chrome) ? chrome : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function open(dpr) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: dpr });
  await page.goto(pathToFileURL(join(root, 'index.html')).href + '?debug');
  await page.waitForFunction(() => window.NCS);
  await page.evaluate(() => NCS.freeze());
  return page;
}

// Captures `frames` canvas screenshots; before each one, `drive(i, dt)` runs in the page.
async function record(page, name, fps, frames, drive) {
  const dir = join(work, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const canvas = page.locator('#switch');
  for (let i = 0; i < frames; i++) {
    await page.evaluate(drive, [i, 1 / fps]);
    await page.waitForTimeout(30); // let one rAF repaint the page colours
    await canvas.screenshot({ path: join(dir, `f${String(i).padStart(4, '0')}.png`) });
  }
  const gif = join(outDir, `${name}.gif`);
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%04d.png'),
    '-vf', 'split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
    '-loop', '0', gif,
  ]);
  console.log(`${name}.gif  ${(statSync(gif).size / 1048576).toFixed(2)} MB  (${frames} frames @ ${fps} fps)`);
}

// 1. Evening sweep: golden hour → night, a pause, then a fast run back to the start.
{
  const page = await open(1);
  await page.evaluate(() => {
    NCS.seek(0.03);
    NCS.S.holdup.cooldown = 1e9;
    NCS.step(1.5);
  });
  const fps = 20;
  await record(page, 'demo', fps, Math.round(8.4 * fps), ([i, dt]) => {
    const t = i * dt;
    const ease = (a) => a * a * (3 - 2 * a);
    const S = NCS.S;
    let k = 0.03;
    if (t > 0.6 && t <= 5.6) k = 0.03 + 0.97 * ease((t - 0.6) / 5);
    else if (t > 5.6 && t <= 7.0) k = 1;
    else if (t > 7.0) k = 0.03;
    const x = 20 + k * 136;
    S.knob.target = x;
    NCS.step(dt);
  });
  await page.close();
}

// 2. The hold-up: police arrive, shots fired from cover, getaway.
{
  const page = await open(1);
  await page.evaluate(() => {
    NCS.seek(0.97);
    NCS.S.traffic.length = 0;
    NCS.S.trafficState.spawnIn = 1e9;
    for (let i = 0; i < 1200 && NCS.S.holdup.phase !== 'police'; i++) NCS.step(1 / 60);
    NCS.step(0.6);
  });
  const fps = 15;
  await record(page, 'holdup', fps, Math.round(9 * fps), ([, dt]) => NCS.step(dt));
  await page.close();
}

// 3. Stills, crisp at 2× (pixel-exact scale).
{
  const page = await open(2);
  const stills = [
    ['golden-hour', 0.05, 1.5],
    ['dusk', 0.45, 1.5],
    ['night', 0.93, 6],
  ];
  for (const [name, t, settle] of stills) {
    await page.evaluate(
      ([t, settle]) => {
        NCS.seek(t);
        NCS.S.holdup.cooldown = 1e9;
        NCS.step(settle);
      },
      [t, settle],
    );
    await page.waitForTimeout(60);
    await page.locator('#switch').screenshot({ path: join(outDir, `${name}.png`) });
    console.log(`${name}.png`);
  }
  await page.close();
}

await browser.close();
