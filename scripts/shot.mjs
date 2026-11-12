// Headless screenshots of the built page for visual checks.
// Usage: node scripts/shot.mjs [scenario ...]   (default: the evening sweep)
import { chromium } from 'playwright';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'shots');
mkdirSync(outDir, { recursive: true });

// Prefer a browser already in the Playwright cache.
function findChrome() {
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  for (const rev of ['chromium-1248', 'chromium-1243', 'chromium-1234', 'chromium-1228']) {
    const p = join(cache, rev, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
    if (existsSync(p)) return p;
  }
  return undefined;
}

const SCENARIOS = {
  sweep: async (page, shot) => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      await page.evaluate((t) => (NCS.seek(t), NCS.step(2)), t);
      await shot(`t${Math.round(t * 100)}`);
    }
  },
  page: async (page, shot) => {
    await page.evaluate(() => (NCS.seek(0.3), NCS.step(1)));
    await shot('page-dusk', true);
    await page.evaluate(() => (NCS.seek(0.95), NCS.step(1)));
    await shot('page-night', true);
  },
  chase: async (page, shot) => {
    await page.evaluate(() => {
      NCS.seek(0.7);
      NCS.S.police.heat = 1;
      NCS.S.knob.target = NCS.S.knob.x - 40;
      NCS.step(1.2);
    });
    await shot('chase');
  },
  holdup: async (page, shot) => {
    await page.evaluate(() => {
      NCS.seek(0.96);
      NCS.S.traffic.length = 0;
      NCS.step(3.5);
    });
    await shot('holdup-alarm');
    await page.evaluate(() => NCS.step(4));
    await shot('holdup-shootout');
    await page.evaluate(() => NCS.step(6.2));
    await shot('holdup-getaway');
  },
  // Real pointer input: hover highlight, dragging the knob, tapping the road.
  interact: async (page, shot) => {
    const at = async (x, y) => {
      const r = await page.locator('#switch').boundingBox();
      const k = r.width / 208;
      return [r.x + (16 + x) * k, r.y + (12 + y) * k];
    };
    await page.evaluate(() => (NCS.seek(0.5), NCS.step(0.5)));
    await page.mouse.move(...(await at(63, 18)));
    await page.waitForTimeout(200);
    await shot('hover-window');
    const kx = await page.evaluate(() => NCS.S.knob.x);
    await page.mouse.move(...(await at(kx, 25)));
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(...(await at(kx + i * 4, 25)));
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    const after = await page.evaluate(() => NCS.S.knob.target);
    console.log(`drag: knob target ${kx.toFixed(1)} → ${after.toFixed(1)} (expected ≈ ${(kx + 40).toFixed(1)})`);
    await page.mouse.click(...(await at(40, 46)));
    await page.waitForTimeout(100);
    const road = await page.evaluate(() => NCS.S.knob.target);
    console.log(`road tap at x=40 → knob target ${road.toFixed(1)}`);
    await page.keyboard.press('End');
    const end = await page.evaluate(() => NCS.S.knob.target);
    console.log(`End key → knob target ${end.toFixed(1)}; aria-valuenow ${await page.locator('#switch').getAttribute('aria-valuenow')}`);
  },
  taps: async (page, shot) => {
    await page.evaluate(() => {
      NCS.seek(0.45);
      const S = NCS.S;
      NCS.tap(NCS.ID.WIN0 + 6, 62, 18);
      NCS.tap(NCS.ID.DINER, 120, 26);
      NCS.tap(NCS.ID.NEON0 + 5, 150, 4);
      NCS.tap(NCS.ID.SEA, 14, 24);
      NCS.step(1.3);
      void S;
    });
    await shot('taps');
  },
};

const args = process.argv.slice(2);
const dpr = Number((args.find((a) => a.startsWith('--dpr=')) || '--dpr=1').slice(6));
const width = Number((args.find((a) => a.startsWith('--width=')) || '--width=1200').slice(8));
const names = args.filter((a) => !a.startsWith('--'));

const browser = await chromium.launch({ executablePath: findChrome(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: dpr });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(pathToFileURL(join(root, 'index.html')).href + '?debug');
await page.waitForFunction(() => window.NCS);

// "at:<t>" shoots one moment of the evening; "at:<t>:<js>" runs code against NCS first.
for (const name of names.length ? names : ['sweep']) {
  if (name.startsWith('at:')) {
    const [, t, ...code] = name.split(':');
    await page.evaluate(([t, js]) => {
      NCS.seek(Number(t));
      if (js) new Function(js)();
      NCS.step(1.5);
    }, [t, code.join(':')]);
    const file = join(outDir, `at${Math.round(Number(t) * 100)}.png`);
    await page.locator('#switch').screenshot({ path: file });
    for (const which of ['rail', 'full']) {
      const url = await page.evaluate((w) => NCS.raw(w), which);
      writeFileSync(join(outDir, `at${Math.round(Number(t) * 100)}-${which}.png`), Buffer.from(url.split(',')[1], 'base64'));
    }
    console.log('shot', file);
    continue;
  }
  const run = SCENARIOS[name];
  if (!run) throw new Error(`Unknown scenario ${name}`);
  await run(page, async (label, full = false) => {
    const file = join(outDir, `${label}.png`);
    if (full) await page.screenshot({ path: file, fullPage: true });
    else await page.locator('#switch').screenshot({ path: file });
    console.log('shot', file);
  });
}
await browser.close();
if (errors.length) {
  console.error('Console errors:\n' + errors.join('\n'));
  process.exit(1);
}
