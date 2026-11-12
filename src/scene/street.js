// Pavement, kerb, the two-lane road, palms with swaying fronds, and four street lamps.
const C_STREET = {
  pave: hex('#d8b7a2'),
  seam: hex('#b9947f'),
  kerb: hex('#efe6d8'),
  kerbShadow: hex('#8d7f86'),
  road: hex('#3b3849'),
  roadHi: hex('#46435a'),
  dash: hex('#f4c84a'),
  trunk: hex('#8a5a3b'),
  trunkHi: hex('#a9744e'),
  frond: hex('#3d9b55'),
  frondHi: hex('#62c070'),
  nut: hex('#6b4128'),
  pole: hex('#4c4a5a'),
  lampOff: hex('#6b6577'),
};
const SODIUM = hex('#ffa646');
const PAVE_SEAM = 6; // a seam every 6 px (the carhop's wheels click on them)

function drawGround(F) {
  F.curId = ID.NONE;
  for (let y = PAVE_Y; y < KERB_Y; y++)
    for (let x = 0; x < W; x++) px(F, x, y, x % PAVE_SEAM === 0 && y > PAVE_Y ? C_STREET.seam : y === PAVE_Y ? mixc(C_STREET.pave, C_STREET.kerb, 0.3) : C_STREET.pave);
  for (let x = 0; x < W; x++) px(F, x, KERB_Y, C_STREET.kerb);
  F.curId = ID.ROAD;
  for (let y = ROAD_Y; y < H; y++)
    for (let x = 0; x < W; x++) {
      let c = y === ROAD_Y ? C_STREET.kerbShadow : hash2(x, y * 5) < 0.07 ? C_STREET.roadHi : C_STREET.road;
      if (y === DASH_Y && x % 8 < 4) c = C_STREET.dash;
      px(F, x, y, c);
    }
}

// Fronds bend with the breeze; a shake makes them thrash.
function palmPixels(p, S, i) {
  const pts = new Map();
  const put = (x, y, c) => pts.set(`${Math.round(x)},${Math.round(y)}`, [Math.round(x), Math.round(y), c]);
  const lean = p.beach ? -2 : i % 2 === 0 ? 2 : -2;
  const shake = S.palms[i].shake;
  const n = p.base - p.top;
  for (let k = 0; k <= n; k++) {
    const y = p.base - k;
    const x = p.x + lean * Math.pow(k / n, 2);
    const c = k % 2 === 0 ? C_STREET.trunk : C_STREET.trunkHi;
    put(x, y, c);
    put(x + 1, y, scalec(c, 0.8));
  }
  const cx = p.x + lean + 0.5;
  const cy = p.top;
  const sway = Math.sin(S.time * 1.1 + i * 1.7) * 0.07 + shake * Math.sin(S.time * 31 + i) * 0.35;
  const fronds = [-2.95, -2.45, -1.95, -1.2, -0.7, -0.2];
  for (const [fi, a0] of fronds.entries()) {
    const len = fi === 2 || fi === 3 ? 6 : 8;
    const a = a0 + sway * (1 + fi * 0.1);
    for (let s = 1; s <= len; s++) {
      const droop = (s * s) / len * 0.55;
      const x = cx + Math.cos(a) * s;
      const y = cy + Math.sin(a) * s + droop;
      put(x, y, s < 3 ? C_STREET.frond : s % 3 === 0 ? C_STREET.frondHi : C_STREET.frond);
      if (s > 2 && s < len - 1) put(x, y + 1, scalec(C_STREET.frond, 0.75));
    }
  }
  const nuts = S.palms[i].nuts;
  if (nuts > 0) put(cx - 1, cy + 1, C_STREET.nut);
  if (nuts > 1) put(cx + 1, cy + 1, C_STREET.nut);
  if (nuts > 2) put(cx, cy + 2, C_STREET.nut);
  return [...pts.values()];
}

function drawPalm(F, S, i) {
  const pts = palmPixels(PALMS[i], S, i);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const grid = new Map(pts.map(([x, y, c]) => [`${x},${y}`, c]));
  F.curId = ID.PALM0 + i;
  sprite(F, x0, y0, x1 - x0 + 1, y1 - y0 + 1, (lx, ly) => grid.get(`${lx + x0},${ly + y0}`) || null, { shade: false });
}

function drawLamp(F, S, i) {
  const x = LAMPS[i];
  F.curId = ID.NONE;
  rect(F, x, 22, 1, PAVE_Y + 2 - 22, C_STREET.pole);
  rect(F, x - 1, PAVE_Y + 2, 3, 1, scalec(C_STREET.pole, 0.7));
  rect(F, x - 1, 20, 3, 1, C_STREET.pole);
  for (let lx = -1; lx <= 1; lx++) glow(F, x + lx, 21, SODIUM, 1.3, GROUP.LAMP0 + i, C_STREET.lampOff);
}

function drawStreetFurniture(F, S) {
  for (let i = 1; i < PALMS.length; i++) drawPalm(F, S, i);
  for (let i = 0; i < LAMPS.length; i++) drawLamp(F, S, i);
}
