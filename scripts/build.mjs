// Concatenates src/ into a single self-contained index.html (no bundler, no minifier).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Load order matters: later files use earlier declarations.
export const SIM_FILES = [
  'core/util.js',
  'core/layout.js',
  'gfx/font.js',
  'gfx/buffer.js',
  'scene/sky.js',
  'scene/beach.js',
  'scene/city.js',
  'scene/street.js',
  'scene/neon.js',
  'actors/vehicles.js',
  'actors/convertible.js',
  'actors/fx.js',
  'actors/traffic.js',
  'actors/police.js',
  'actors/heli.js',
  'actors/holdup.js',
  'actors/taps.js',
  'actors/idle.js',
  'gfx/light.js',
  'core/world.js',
];

const BROWSER_FILES = [
  'gfx/glass.js',
  'audio/engine.js',
  'audio/music.js',
  'audio/sfx.js',
  'audio/ambience.js',
  'ui/input.js',
  'ui/readouts.js',
  'main.js',
];

export function readSources(files) {
  return files
    .map((f) => `// ---- ${f}\n${readFileSync(join(root, 'src', f), 'utf8').trimEnd()}\n`)
    .join('\n');
}

function build() {
  const page = readFileSync(join(root, 'src/page.html'), 'utf8');
  const js = `(() => {\n'use strict';\n${readSources([...SIM_FILES, ...BROWSER_FILES])}\n})();`;
  if (!page.includes('/*BUNDLE*/')) throw new Error('page.html is missing the /*BUNDLE*/ marker');
  const html = page.replace('/*BUNDLE*/', () => js);
  writeFileSync(join(root, 'index.html'), html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log(`index.html written (${kb} KB)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build();
