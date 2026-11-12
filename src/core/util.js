const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
const smooth = (a, b, v) => {
  const t = invLerp(a, b, v);
  return t * t * (3 - 2 * t);
};
const sign = (v) => (v < 0 ? -1 : 1);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable 0..1 hash of integer coordinates.
function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

// Quantise a 0..1 level into `bands` steps with a 4×4 ordered dither between them.
const dither = (v, x, y, bands) => (v <= 0 ? 0 : clamp(Math.floor(v * bands + bayer(x, y)) / bands, 0, 1));

function hex(s) {
  const n = parseInt(s.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const scalec = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// Three-stop colour ramp over 0..1 with smooth joins at `m`.
const ramp3 = (a, b, c, t, m = 0.5) => (t < m ? mixc(a, b, smooth(0, m, t)) : mixc(b, c, smooth(m, 1, t)));

// Semi-implicit spring toward `target`. Returns the acceleration it applied.
function springStep(s, target, k, damp, dt) {
  const a = (target - s.x) * k - s.v * damp;
  s.v += a * dt;
  s.x += s.v * dt;
  return a;
}

function createBus() {
  const handlers = new Map();
  return {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(fn);
    },
    emit(type, data) {
      const list = handlers.get(type);
      if (list) for (const fn of list) fn(data);
    },
  };
}
