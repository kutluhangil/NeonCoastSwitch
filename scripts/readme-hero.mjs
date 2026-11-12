// Generates docs/media/hero.svg: an animated README banner in the page's own style —
// evening colours, the kicker and italic serif title, and a mini switch whose amber
// capsule drags the night across a skyline (windows and neon come on behind it).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOOP = 12; // seconds
// Timeline (fractions of the loop): day → sweep → night hold → return.
const SWEEP_A = 0.08;
const SWEEP_B = 0.48;
const BACK_A = 0.8;
const BACK_B = 0.9;

const pct = (f) => `${(f * 100).toFixed(2)}%`;
const W = 1200;
const H = 440;

// Mini switch geometry.
const sw = { x: 640, y: 150, w: 500, h: 150 };
const track = { x: sw.x + 16, y: sw.y + 16, w: sw.w - 32, h: sw.h - 32 };
const knobW = 84;
const knobX0 = track.x + 6;
const knobX1 = track.x + track.w - knobW - 6;

// Skyline blocks inside the track (x relative to track), with window grids.
const blocks = [
  { x: 18, w: 54, top: 30, color: '#f49ab3' },
  { x: 84, w: 40, top: 54, color: '#2f5296' },
  { x: 132, w: 62, top: 22, color: '#e8e2d6' },
  { x: 204, w: 46, top: 46, color: '#9fe5ca' },
  { x: 260, w: 70, top: 16, color: '#b9a2e6' },
  { x: 340, w: 44, top: 40, color: '#2f5296' },
  { x: 392, w: 60, top: 28, color: '#f49ab3' },
];
const LIGHTS = ['#ffc66b', '#ff8fc8', '#8fd6ff'];

// A light at fraction f of the track switches on as the knob passes, off on the way back.
function lightKeyframes(name, f) {
  const on = SWEEP_A + (SWEEP_B - SWEEP_A) * f;
  const off = BACK_A + (BACK_B - BACK_A) * (1 - f);
  return `@keyframes ${name}{0%,${pct(on - 0.004)}{opacity:0}${pct(on)}{opacity:1}${pct(on + 0.006)}{opacity:.35}${pct(on + 0.012)},${pct(off)}{opacity:1}${pct(off + 0.004)},100%{opacity:0}}`;
}

let css = '';
let windows = '';
let n = 0;
const roadY = track.y + track.h - 30;
for (const [bi, b] of blocks.entries()) {
  const bx = track.x + b.x;
  const by = track.y + b.top;
  windows += `<rect x="${bx}" y="${by}" width="${b.w}" height="${roadY - by}" fill="${b.color}" class="bld"/>`;
  for (let wy = by + 8; wy < roadY - 12; wy += 14)
    for (let wx = bx + 7; wx < bx + b.w - 10; wx += 13) {
      const f = (wx - track.x) / track.w;
      const dark = (wx * 7 + wy * 3 + bi) % 5 === 0;
      windows += `<rect x="${wx}" y="${wy}" width="7" height="7" fill="#2a2f4d"/>`;
      if (dark) continue;
      const name = `w${n++}`;
      css += lightKeyframes(name, f);
      windows += `<rect x="${wx}" y="${wy}" width="7" height="7" fill="${LIGHTS[(wx + wy) % 3]}" style="animation:${name} ${LOOP}s linear infinite" class="lit"/>`;
    }
}

// Neon sign and lamp pools.
const neon = { x: track.x + 268, y: track.y + 4, w: 54 };
css += lightKeyframes('neon', (neon.x - track.x + 27) / track.w);
const lamps = [70, 190, 330, 430].map((lx, i) => {
  const name = `lamp${i}`;
  css += lightKeyframes(name, lx / track.w);
  const cx = track.x + lx;
  return `<ellipse cx="${cx}" cy="${roadY + 6}" rx="34" ry="9" fill="url(#pool)" style="animation:${name} ${LOOP}s linear infinite" opacity="0"/><rect x="${cx - 1}" y="${roadY - 34}" width="2" height="34" fill="#4c4a5a"/><rect x="${cx - 4}" y="${roadY - 37}" width="8" height="3" fill="#ffa646" style="animation:${name} ${LOOP}s linear infinite" opacity="0"/>`;
});

const stars = Array.from({ length: 34 }, (_, i) => {
  const x = (i * 197) % W;
  const y = 14 + ((i * 83) % 120);
  if (x < 620 && y > 70) return ''; // keep the kicker clear
  const r = i % 7 === 0 ? 1.8 : 1.1;
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff6e8" style="animation:stars ${LOOP}s linear infinite, twinkle ${2 + (i % 5) * 0.6}s ease-in-out ${(i % 7) * 0.3}s infinite"/>`;
}).join('');

const sky = (a, b, c) => `${pct(0)},${pct(SWEEP_A)}{${a}}${pct((SWEEP_A + SWEEP_B) / 2)}{${b}}${pct(SWEEP_B)},${pct(BACK_A)}{${c}}${pct(BACK_B)},100%{${a}}`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Neon Coast Switch — Material Studies No. 066">
<style>
.bg{animation:bg ${LOOP}s linear infinite}
@keyframes bg{${sky('fill:#f6d3bf', 'fill:#9a4f7e', 'fill:#170b26')}}
.ink{animation:ink ${LOOP}s linear infinite}
@keyframes ink{${sky('fill:#3a2131', 'fill:#fff0f4', 'fill:#f3e6ff')}}
.muted{animation:muted ${LOOP}s linear infinite}
@keyframes muted{${sky('fill:#5e3d52', 'fill:#f6dce8', 'fill:#cdb9e6')}}
.rule{animation:rule ${LOOP}s linear infinite}
@keyframes rule{${sky('stroke:#3a213133', 'stroke:#fff0f433', 'stroke:#f3e6ff33')}}
.bezel{animation:bezel ${LOOP}s linear infinite}
@keyframes bezel{${sky('fill:#f7eddb', 'fill:#6d4a6a', 'fill:#381f3c')}}
.skyfill{animation:skyfill ${LOOP}s linear infinite}
@keyframes skyfill{${sky('fill:#f2b38f', 'fill:#b13a8b', 'fill:#12123d')}}
.bld{animation:bld ${LOOP}s linear infinite}
@keyframes bld{${sky('filter:brightness(1)', 'filter:brightness(.7)', 'filter:brightness(.38)')}}
@keyframes stars{${sky('opacity:0', 'opacity:.2', 'opacity:.9')}}
@keyframes twinkle{0%,100%{transform:scale(1)}50%{transform:scale(.55)}}
circle{transform-box:fill-box;transform-origin:center}
.knob{animation:knob ${LOOP}s cubic-bezier(.45,.05,.3,1) infinite}
@keyframes knob{0%,${pct(SWEEP_A)}{transform:translateX(0)}${pct(SWEEP_B)},${pct(BACK_A)}{transform:translateX(${knobX1 - knobX0}px)}${pct(BACK_B)},100%{transform:translateX(0)}}
.lit{filter:drop-shadow(0 0 3px currentColor)}
.neon{fill:#ffb13b;filter:drop-shadow(0 0 4px #ffb13b) drop-shadow(0 0 9px #ff7a3d)}
${css}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<defs>
  <linearGradient id="amber" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#5c2c0a" stop-opacity=".92"/>
    <stop offset=".45" stop-color="#c77a2a" stop-opacity=".62"/>
    <stop offset="1" stop-color="#ffd27a" stop-opacity=".5"/>
  </linearGradient>
  <linearGradient id="streak" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".75"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="pool"><stop offset="0" stop-color="#ffa646" stop-opacity=".85"/><stop offset="1" stop-color="#ffa646" stop-opacity="0"/></radialGradient>
  <filter id="soft" x="-20%" y="-40%" width="140%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
  <clipPath id="trackClip"><rect x="${track.x}" y="${track.y}" width="${track.w}" height="${track.h}" rx="${track.h / 2}"/></clipPath>
</defs>
<rect class="bg" width="${W}" height="${H}" fill="#9a4f7e"/>
${stars}
<g font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="15" letter-spacing="2.4">
  <text class="muted" x="64" y="104" fill="#5e3d52">MATERIAL STUDIES / NO. 066 · WEBGL + WEB AUDIO</text>
</g>
<text class="ink" x="60" y="200" fill="#3a2131" font-family="'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif" font-style="italic" font-size="78" letter-spacing="-1">Neon Coast</text>
<text class="ink" x="60" y="282" fill="#3a2131" font-family="'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif" font-style="italic" font-size="78" letter-spacing="-1">Switch.</text>
<text class="muted" x="64" y="336" fill="#5e3d52" font-family="'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif" font-size="20">Golden hour to midnight on the coast road.</text>
<line class="rule" x1="64" y1="372" x2="${W - 64}" y2="372" stroke="#3a213133" stroke-width="1"/>
<g font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="13" letter-spacing="1.8">
  <text class="muted" x="64" y="404" fill="#5e3d52">CLOCK 18:30 → 23:30</text>
  <text class="muted" x="460" y="404" fill="#5e3d52">176 × 50 PIXELS · ONE SHADER</text>
  <text class="muted" x="${W - 64}" y="404" fill="#5e3d52" text-anchor="end">NO LIBRARIES · ALL SYNTHESISED</text>
</g>

<rect x="${sw.x}" y="${sw.y + 14}" width="${sw.w}" height="${sw.h}" rx="${sw.h / 2}" fill="#000" opacity=".28" filter="url(#soft)"/>
<rect class="bezel" x="${sw.x}" y="${sw.y}" width="${sw.w}" height="${sw.h}" rx="${sw.h / 2}" fill="#f7eddb"/>
<g clip-path="url(#trackClip)">
  <rect class="skyfill" x="${track.x}" y="${track.y}" width="${track.w}" height="${track.h}" fill="#b13a8b"/>
  ${windows}
  <rect x="${neon.x - 4}" y="${neon.y - 3}" width="${neon.w + 8}" height="18" rx="3" fill="#2a2238"/>
  <text x="${neon.x + neon.w / 2}" y="${neon.y + 11}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-weight="700" font-size="12" letter-spacing="2" fill="#5a4a3a">SUNSET</text>
  <text class="neon" x="${neon.x + neon.w / 2}" y="${neon.y + 11}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-weight="700" font-size="12" letter-spacing="2" style="animation:neon ${LOOP}s linear infinite" opacity="0">SUNSET</text>
  <rect x="${track.x}" y="${roadY}" width="${track.w}" height="${track.y + track.h - roadY}" fill="#3b3849"/>
  <rect x="${track.x}" y="${roadY - 4}" width="${track.w}" height="4" fill="#d8b7a2"/>
  ${Array.from({ length: 18 }, (_, i) => `<rect x="${track.x + 8 + i * 27}" y="${roadY + 14}" width="13" height="2.5" fill="#f4c84a"/>`).join('')}
  ${lamps.join('')}
</g>
<rect x="${track.x}" y="${track.y}" width="${track.w}" height="${track.h}" rx="${track.h / 2}" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="2"/>
<g class="knob">
  <rect x="${knobX0 + 3}" y="${track.y - 8 + 8}" width="${knobW}" height="${track.h + 16}" rx="${knobW / 2}" fill="#000" opacity=".25" filter="url(#soft)"/>
  <rect x="${knobX0}" y="${track.y - 8}" width="${knobW}" height="${track.h + 16}" rx="${knobW / 2}" fill="url(#amber)" stroke="#ffe9c2" stroke-opacity=".85" stroke-width="2"/>
  <ellipse cx="${knobX0 + knobW / 2}" cy="${track.y + track.h - 4}" rx="${knobW * 0.32}" ry="6" fill="#ffb347" opacity=".75"/>
  <path d="M ${knobX0 + 18} ${track.y + 6} Q ${knobX0 + 12} ${track.y + 30} ${knobX0 + 16} ${track.y + 58}" stroke="url(#streak)" stroke-width="7" stroke-linecap="round" fill="none"/>
  <circle cx="${knobX0 + knobW - 20}" cy="${track.y + track.h - 8}" r="3.2" fill="#fff" opacity=".9"/>
</g>
</svg>
`;

writeFileSync(join(root, 'docs/media/hero.svg'), svg);
console.log(`hero.svg written (${(svg.length / 1024).toFixed(1)} KB, ${n} windows)`);

// Section divider: a hairline with an amber glint travelling along it, like the knob's rim.
const divider = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 24" width="1200" height="24" aria-hidden="true">
<style>
.glint{animation:glint 6s cubic-bezier(.45,.05,.3,1) infinite}
@keyframes glint{0%{transform:translateX(-160px)}100%{transform:translateX(1200px)}}
@media (prefers-reduced-motion:reduce){.glint{animation:none;transform:translateX(520px)}}
</style>
<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#ffb347" stop-opacity="0"/><stop offset=".5" stop-color="#ffd27a"/><stop offset="1" stop-color="#ff6ec7" stop-opacity="0"/></linearGradient></defs>
<line x1="0" y1="12" x2="1200" y2="12" stroke="#9a4f7e" stroke-opacity=".35" stroke-width="1"/>
<rect class="glint" x="0" y="10.5" width="160" height="3" rx="1.5" fill="url(#g)"/>
</svg>
`;
writeFileSync(join(root, 'docs/media/divider.svg'), divider);
console.log('divider.svg written');
