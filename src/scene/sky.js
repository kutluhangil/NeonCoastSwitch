// Golden-hour blue and peach → magenta dusk → night with moon and stars. Gulls by day.
const SKY = {
  gold: [hex('#3f74bd'), hex('#f2b38f'), hex('#ffd59c')],
  dusk: [hex('#2a2167'), hex('#b13a8b'), hex('#ff7b6c')],
  night: [hex('#060820'), hex('#12123d'), hex('#2b1b52')],
};

function skyStops(t) {
  const a = smooth(0.12, 0.5, t);
  const b = smooth(0.5, 0.85, t);
  return [0, 1, 2].map((i) => mixc(mixc(SKY.gold[i], SKY.dusk[i], a), SKY.night[i], b));
}

const STARS = (() => {
  const r = mulberry32(66);
  const list = [];
  for (let i = 0; i < 46; i++) list.push({ x: Math.floor(r() * W), y: Math.floor(r() * 19), p: r() * TAU, big: r() < 0.12 });
  return list;
})();

const MOON = { x: 92, y: 4, r: 3 };

function sunY(t) {
  return 14 + t * 26;
}

function drawSky(F, S) {
  const [top, mid, low] = S.sky;
  F.curId = ID.SKY;
  for (let y = 0; y < PAVE_Y; y++) {
    const c = ramp3(top, mid, low, clamp(y / HORIZON, 0, 1), 0.55);
    for (let x = 0; x < W; x++) {
      const d = [dither(c[0], x, y, 24), dither(c[1], x, y, 24), dither(c[2], x, y, 24)];
      glow(F, x, y, d, 1, GROUP.SKY, [0, 0, 0], false);
    }
  }

  const starK = smooth(0.5, 0.8, S.t);
  if (starK > 0) {
    for (const s of STARS) {
      const tw = 0.55 + 0.45 * Math.sin(S.time * (1.3 + (s.p % 1.7)) + s.p);
      const k = starK * tw * (s.big ? 1 : 0.7);
      glow(F, s.x, s.y, [0.9, 0.92, 1], k, GROUP.SKY, null, s.big);
    }
  }

  const moonK = smooth(0.55, 0.8, S.t);
  if (moonK > 0) {
    const { x: mx, y: my, r } = MOON;
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y > r * r + 1) continue;
        const crater = (x === -1 && y === 0) || (x === 1 && y === 1) || (x === 0 && y === -2);
        glow(F, mx + x, my + y, crater ? hex('#c9c3a8') : hex('#fff6d6'), moonK, GROUP.SKY);
      }
  }

  drawSun(F, S);
  drawShootingStar(F, S);
}

function drawSun(F, S) {
  const cy = sunY(S.t);
  const r = 6;
  if (cy - r >= HORIZON) return;
  F.curId = ID.SKY;
  const top = hex('#ffe680');
  const bot = hex('#ff5c7a');
  for (let y = Math.ceil(cy - r); y <= cy + r && y < HORIZON; y++) {
    const dy = y - cy;
    // Bands cut through the lower half.
    if (dy > 0.5 && Math.floor(dy) % 2 === 1) continue;
    const half = Math.sqrt(Math.max(0, r * r - dy * dy));
    const c = mixc(top, bot, invLerp(-r, r, dy));
    for (let x = Math.ceil(SUN_X - half); x <= SUN_X + half; x++) glow(F, x, y, c, 1.15, GROUP.SKY);
  }
}

function drawShootingStar(F, S) {
  const s = S.shootingStar;
  if (!s) return;
  for (let i = 0; i < 7; i++) {
    const k = (1 - i / 7) * Math.min(1, s.life * 2);
    glow(F, s.x - s.vx * i * 0.018, s.y - s.vy * i * 0.018, [1, 0.95, 0.85], k * 1.4, GROUP.SKY);
  }
}

// Gulls: tiny flapping v-shapes over the beach.
function drawGulls(F, S) {
  F.curId = ID.SKY;
  for (const g of S.gulls) {
    const up = Math.sin(g.flap) > 0;
    const x = Math.round(g.x);
    const y = Math.round(g.y);
    const wing = hex('#f4f1ea');
    const tip = hex('#5b5560');
    px(F, x, y, wing);
    px(F, x - 1, y + (up ? -1 : 0), wing);
    px(F, x + 1, y + (up ? -1 : 0), wing);
    px(F, x - 2, y + (up ? -1 : 1), tip);
    px(F, x + 2, y + (up ? -1 : 1), tip);
  }
}
