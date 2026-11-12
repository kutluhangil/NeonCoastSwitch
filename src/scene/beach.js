// The beach on the left: sea with glitter, surf on the sand, lifeguard tower,
// striped umbrella, surfboard and a low sea wall.
const C_BEACH = {
  seaHi: hex('#5fb3c9'),
  seaLo: hex('#1f5f8f'),
  sand: hex('#f0cf94'),
  wet: hex('#c9a46f'),
  foam: hex('#fbf7ee'),
  wall: hex('#e9dccb'),
  joint: hex('#b9a48e'),
  teal: hex('#2fb7aa'),
  pink: hex('#f58fb2'),
  red: hex('#e8414b'),
  white: hex('#f6f2ea'),
  wood: hex('#9a6a44'),
  glass: hex('#28324a'),
  board: hex('#ffd34d'),
  stripe: hex('#2b8fd6'),
};

function drawSea(F, S) {
  F.curId = ID.SEA;
  const sunUp = 1 - smooth(0.2, 0.4, S.t);
  const night = smooth(0.55, 0.85, S.t);
  for (let y = HORIZON; y < SAND_Y + 1; y++) {
    const depth = invLerp(HORIZON, SAND_Y, y);
    const c = mixc(mixc(S.sky[2], C_BEACH.seaHi, 0.45), C_BEACH.seaLo, depth * 0.8);
    for (let x = 0; x < W; x++) {
      const wave = hash2(x + Math.floor(S.time * 2 + y * 3), y) < 0.08;
      px(F, x, y, wave ? mixc(c, C_BEACH.foam, 0.35) : c);
    }
  }
  // Sun path on the water and scattered glitter.
  for (let y = HORIZON; y < SAND_Y - 1; y++) {
    const spread = 1.5 + (y - HORIZON) * 0.9;
    for (let x = Math.floor(SUN_X - spread); x <= SUN_X + spread; x++) {
      const h = hash2(x * 7 + Math.floor(S.time * 6), y * 13);
      if (h < 0.35 * sunUp) glow(F, x, y, hex('#ffd36b'), 0.9 * sunUp, GROUP.ALWAYS, null, true);
    }
  }
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(hash2(i, Math.floor(S.time * 1.6 + i * 0.37)) * BEACH_END);
    const y = HORIZON + 1 + Math.floor(hash2(i * 3, Math.floor(S.time * 1.6 + i * 0.37)) * (SAND_Y - HORIZON - 2));
    const k = sunUp > 0.1 ? 0.8 * sunUp : 0.45 * night;
    glow(F, x, y, night > 0.5 ? hex('#cfe0ff') : hex('#fff1c2'), k, GROUP.ALWAYS, null, false);
  }
}

function drawSand(F, S) {
  F.curId = ID.SEA;
  // Surf: foam line swells in and out over wet sand.
  for (let x = 0; x <= BEACH_END; x++) {
    const swell = Math.sin(S.time * 0.75 + x * 0.09) * 0.8 + Math.sin(S.time * 1.9 + x * 0.31) * 0.35;
    const fy = SAND_Y + Math.round(swell);
    for (let y = SAND_Y - 1; y < WALL_Y; y++) {
      if (y < fy) continue;
      F.curId = ID.NONE;
      const grain = hash2(x, y) < 0.15;
      if (y === fy) {
        F.curId = ID.SEA;
        px(F, x, y, C_BEACH.foam);
      } else if (y === fy + 1) px(F, x, y, C_BEACH.wet);
      else px(F, x, y, grain ? mixc(C_BEACH.sand, C_BEACH.wet, 0.4) : C_BEACH.sand);
    }
  }
}

function drawUmbrella(F) {
  F.curId = ID.NONE;
  rect(F, 8, 23, 1, 9, hex('#eae4da'));
  sprite(F, 2, 20, 13, 4, (x, y) => {
    const half = [3, 5, 6, 6][y];
    if (Math.abs(x - 6) > half) return null;
    if (y === 3 && (x + 1) % 2 === 0) return null; // scalloped edge
    return Math.floor((x + 1) / 2) % 2 === 0 ? C_BEACH.red : C_BEACH.white;
  });
}

function drawSurfboard(F) {
  F.curId = ID.NONE;
  sprite(F, 34, 21, 3, 11, (x, y) => {
    if ((y === 0 || y === 10) && x !== 1) return null;
    return x === 1 && y > 1 && y < 10 ? C_BEACH.stripe : C_BEACH.board;
  });
}

function drawLifeguard(F, S) {
  F.curId = ID.LIFEGUARD;
  const x0 = TOWER.x;
  // legs and brace
  rect(F, x0 + 1, 24, 1, 8, C_BEACH.wood);
  rect(F, x0 + 7, 24, 1, 8, C_BEACH.wood);
  line(x0 + 1, 31, x0 + 7, 25, (x, y) => px(F, x, y, C_BEACH.wood));
  // ramp down to the sand
  line(x0 + 9, 22, x0 + 13, 31, (x, y) => {
    px(F, x, y, C_BEACH.wood);
    px(F, x, y + 1, scalec(C_BEACH.wood, 0.7));
  });
  // cabin with a dark window, pink roof
  sprite(F, x0, 18, 9, 6, (x, y) => (y >= 1 && y <= 3 && x >= 2 && x <= 6 ? C_BEACH.glass : y === 5 ? scalec(C_BEACH.teal, 0.8) : C_BEACH.teal));
  sprite(F, x0 - 1, 15, 11, 3, (x, y) => (Math.abs(x - 5) <= [3, 4, 5][y] ? C_BEACH.pink : null));
  // flag pole and the red flag, flapping harder after a whistle
  rect(F, x0 + 8, 8, 1, 7, hex('#d8d2c8'));
  const flap = S.flag;
  for (let fx = 0; fx < 4; fx++)
    for (let fy = 0; fy < 3; fy++) {
      const wave = Math.round(Math.sin(S.time * (4 + flap * 10) - fx * 1.3) * (0.4 + fx * 0.25 * (0.4 + flap)));
      px(F, x0 + 9 + fx, 8 + fy + wave, fy === 2 ? scalec(C_BEACH.red, 0.75) : C_BEACH.red);
    }
}

function drawSeaWall(F) {
  F.curId = ID.NONE;
  for (let x = 0; x <= BEACH_END + 2; x++)
    for (let y = WALL_Y; y < PAVE_Y; y++) {
      const joint = (y === WALL_Y + 1 && x % 7 === 0) || (y === WALL_Y && x % 7 === 3);
      px(F, x, y, y === WALL_Y ? mixc(C_BEACH.wall, C_BEACH.white, 0.4) : joint ? C_BEACH.joint : C_BEACH.wall);
    }
}

function drawDolphin(F, S) {
  const d = S.dolphin;
  if (!d) return;
  const p = d.t / d.dur; // 0..1 along the leap
  if (p <= 0 || p >= 1) return;
  const x = d.x0 + p * 18;
  const y = SAND_Y - 3 - Math.sin(p * Math.PI) * 9;
  const ang = Math.cos(p * Math.PI) * 0.9; // nose up, then down
  F.curId = ID.SEA;
  const body = hex('#6f8fae');
  const belly = hex('#d9e4ee');
  const pts = [];
  for (let i = -3; i <= 3; i++) pts.push([Math.round(x + i), Math.round(y - i * ang * 0.8)]);
  for (const [i, [bx, by]] of pts.entries()) {
    if (by >= SAND_Y - 1) continue;
    px(F, bx, by, body);
    if (i > 0 && i < 6 && by + 1 < SAND_Y - 1) px(F, bx, by + 1, belly);
  }
  const [hx, hy] = pts[pts.length - 1];
  if (hy < SAND_Y - 1) px(F, hx + 1, hy - Math.sign(ang), body);
  const [tx, ty] = pts[0];
  if (ty < SAND_Y - 1) {
    px(F, tx - 1, ty - 1, body);
    px(F, tx - 1, ty + 1, body);
  }
  const [fx, fy] = pts[3];
  if (fy - 1 < SAND_Y - 1) px(F, fx - 1, fy - 1, body);
}

function drawBeach(F, S) {
  drawSea(F, S);
  drawDolphin(F, S);
  drawSand(F, S);
  drawUmbrella(F);
  drawLifeguard(F, S);
  drawSurfboard(F);
}
