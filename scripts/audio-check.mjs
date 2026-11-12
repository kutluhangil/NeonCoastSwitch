// Audio check in a real browser: every effect plays without errors, and the music
// bus sits about 5 dB under the effects bus. Prints RMS levels in dBFS.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chrome = join(homedir(), 'Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');

const SFX = [
  'hinge', 'honk', 'longHonk', 'hop', 'squeak', 'squeal', 'neonOn', 'lampOn', 'pass', 'bark', 'yip', 'meow',
  'rustle', 'coconut', 'bonk', 'knock3', 'hey', 'chime', 'orderBell', 'seamClick', 'slurp', 'short', 'dolphin',
  'whistle', 'carHonk', 'bullhorn', 'radio', 'squelch', 'shootingStar', 'gull', 'drum', 'glass', 'shot',
  'ricochet', 'roar', 'policeIn',
];

const browser = await chromium.launch({
  executablePath: existsSync(chrome) ? chrome : undefined,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(pathToFileURL(join(root, 'index.html')).href + '?debug');
await page.waitForFunction(() => window.NCS);

const result = await page.evaluate(async (names) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  NCS.audio.unlock();
  await wait(300);
  const A = NCS.audio.graph();
  const tap = (node) => {
    const an = A.ctx.createAnalyser();
    an.fftSize = 2048;
    node.connect(an);
    return an;
  };
  const musicAn = tap(A.duck);
  const sfxAn = tap(A.sfx);
  const measure = async (an, ms) => {
    const buf = new Float32Array(an.fftSize);
    const windows = [];
    let sum = 0;
    let n = 0;
    let peak = 0;
    const end = performance.now() + ms;
    while (performance.now() < end) {
      an.getFloatTimeDomainData(buf);
      let ws = 0;
      for (const v of buf) {
        ws += v * v;
        peak = Math.max(peak, Math.abs(v));
      }
      sum += ws;
      n += buf.length;
      windows.push(Math.sqrt(ws / buf.length));
      await wait(20);
    }
    windows.sort((a, b) => a - b);
    const db = (v) => 20 * Math.log10(v + 1e-9);
    // Short-term loudness while something is sounding: the loudest 10% of ~45 ms windows.
    const top = windows.slice(Math.floor(windows.length * 0.9));
    return { rms: db(Math.sqrt(sum / n)), shortTerm: db(top.reduce((a, b) => a + b, 0) / top.length), peak: db(peak) };
  };
  const out = { state: A.ctx.state };
  // Full band, no events: the music alone.
  NCS.seek(0.8);
  NCS.S.holdup.cooldown = 999;
  await wait(2500);
  out.music = await measure(musicAn, 4000);
  // Effects: a burst of typical event sounds.
  const fx = ['honk', 'chime', 'shot', 'bark', 'glass', 'orderBell', 'whistle', 'hop', 'knock3', 'carHonk'];
  const meas = measure(sfxAn, 6000);
  for (const [i, name] of fx.entries()) setTimeout(() => NCS.S.bus.emit('sfx', { name, x: 88 }), i * 550);
  out.sfx = await meas;
  for (const name of names) NCS.S.bus.emit('sfx', { name, x: 60, on: true, k: 1 });
  await wait(1500);
  return out;
}, SFX);

await browser.close();
console.log(JSON.stringify(result, null, 2));
const gap = result.sfx.shortTerm - result.music.shortTerm;
console.log(`effects − music (short-term): ${gap.toFixed(1)} dB (target ≈ 5)`);
if (errors.length) {
  console.error('Errors:\n' + errors.join('\n'));
  process.exit(1);
}
