// Neon tubes: drawn from the 3×5 font and simple line shapes. Off, they are dark glass;
// on, they glow with a halo and spill their colour. Each sign flickers as it catches.

function polyPixels(paths) {
  const out = [];
  for (const path of paths) for (let i = 1; i < path.length; i++) line(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1], (x, y) => out.push([x, y]));
  return out;
}

function textPixels(s, x, y) {
  const out = [];
  eachTextPixel(s, x, y, (px_, py, li) => out.push([px_, py, li]));
  return out;
}

const NEON_PALM_FRONDS = polyPixels([
  [[123, 12], [120, 10], [117, 11]],
  [[123, 12], [120, 13], [118, 15]],
  [[123, 12], [126, 10], [129, 11]],
  [[123, 12], [126, 13], [128, 15]],
  [[123, 12], [123, 9]],
]);
const NEON_PALM_TRUNK = polyPixels([[[122, 19], [122, 16], [123, 13]]]);

const FLAMINGO = polyPixels([
  [[165, 17], [166, 17], [167, 18]], // head and beak
  [[165, 17], [164, 18], [164, 20], [165, 21], [166, 22]], // neck
  [[166, 22], [169, 22], [171, 23], [170, 25], [167, 25], [165, 24], [166, 22]], // body
  [[168, 25], [168, 32]], // standing leg
  [[169, 25], [170, 28], [168, 28]], // tucked leg
]);

const NEON_SIGNS = [
  { name: 'CORAL', color: hex('#ff5fa8'), pixels: textPixels('CORAL', 55, 2), groups: [GROUP.NEON0] },
  { name: '24H', color: hex('#ff6a3d'), pixels: textPixels('24H', SIGN24.x + 1, SIGN24.y + 1), groups: [GROUP.NEON0 + 1] },
  { name: 'MART', color: hex('#48f0ff'), pixels: textPixels('MART', STORE.x + 6, STORE.roof + 2), groups: [GROUP.NEON0 + 2] },
  { name: 'OPEN', color: hex('#ff3d5a'), pixels: textPixels('OPEN', DINER.x + 3, DINER.roof + 4), groups: [GROUP.NEON0 + 3] },
  {
    name: 'PALM',
    color: hex('#3dff9a'),
    pixels: [...NEON_PALM_FRONDS, ...NEON_PALM_TRUNK.map(([x, y]) => [x, y, 'trunk'])],
    groups: [GROUP.NEON0 + 4],
  },
  {
    name: 'SUNSET',
    color: hex('#ffb13b'),
    pixels: textPixels('SUNSET', CLUB.x + 8, 6),
    groups: [0, 1, 2, 3, 4, 5].map((i) => GROUP.NEON0 + 5 + i),
  },
  { name: 'FLAMINGO', color: hex('#ff6ec7'), pixels: FLAMINGO, groups: [GROUP.NEON0 + 11] },
];

for (const s of NEON_SIGNS) {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of s.pixels) {
    sx += x;
    sy += y;
  }
  s.cx = sx / s.pixels.length;
  s.cy = sy / s.pixels.length;
}

const NEON_TRUNK = hex('#ff9a3d');
const darkGlass = (c) => mixc(scalec(c, 0.28), hex('#3a3346'), 0.45);

function drawNeon(F, S) {
  for (const [si, s] of NEON_SIGNS.entries()) {
    F.curId = ID.NEON0 + si;
    for (const p of s.pixels) {
      const [x, y, tag] = p;
      const c = tag === 'trunk' ? NEON_TRUNK : s.color;
      const grp = s.groups.length > 1 ? s.groups[tag] : s.groups[0];
      glow(F, x, y, c, 1.25, grp, darkGlass(c));
    }
  }
}

function createNeonState() {
  return NEON_SIGNS.map(() => ({ on: false, catchT: 9, short: 0 }));
}

// Flicker while catching: a few stutters, then steady.
function neonCatchLevel(catchT, seed) {
  if (catchT >= 0.9) return 1;
  const h = hash2(Math.floor(catchT * 22), seed);
  if (catchT < 0.15) return h < 0.3 ? 0.6 : 0;
  return h < 0.25 + catchT * 0.8 ? 1 : 0.08;
}

function neonShortLevel(st, time, seed) {
  if (st.short <= 0) return 1;
  return hash2(Math.floor(time * 34), seed * 7) < 0.3 ? 0.9 : 0.04;
}

// SUNSET letters chase on the beat late at night.
function sunsetChase(S, letter) {
  const k = smooth(0.84, 0.9, S.t);
  if (k <= 0) return 1;
  const step = Math.floor(S.beat * 2) % 8;
  const lit = step === letter || step === letter + 1 || step >= 6;
  return lerp(1, lit ? 1.15 : 0.18, k);
}
