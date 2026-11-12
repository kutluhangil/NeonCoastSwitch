// The coral convertible: follows the knob on a spring in the near lane.
// A dog in sunglasses drives; a white cat in sunglasses rides in the back.
const CONV_TPL = [
  '...............cc.......',
  '..............cg........',
  '...bbbbbbbbbbbcgbbbbbb..',
  'tbbbbbbbbbbbbbbbbbbbbbbl',
  'bsssssssssssssssssssssbb',
  'cbbwwwbbbbbbbbbbbbwwwbbc',
  '...whw............whw...',
];
const CONV_COLORS = {
  b: hex('#ff6b5e'),
  s: hex('#fbf6ee'),
  dog: hex('#c98a4b'),
  dogDark: hex('#7a4a2a'),
  cat: hex('#f4f2ec'),
  catPink: hex('#ffb3c1'),
  shades: hex('#0f0c14'),
  tongue: hex('#ff7d9c'),
  shake: hex('#ffd1e8'),
  straw: hex('#ff4f8b'),
};

function createCar() {
  return {
    x: knobX(0.08),
    v: 0,
    a: 0,
    facing: 1,
    wheel: 0,
    hop: { x: 0, v: 0 },
    bounceDir: 0,
    duck: 0,
    bonk: 0,
    ears: 0,
    brake: false,
    puffT: 0,
    reverseSmoke: 0,
    drink: 0,
    paw: 0,
    lean: 0,
    catBob: 0,
    yipCd: 0,
    meowCd: 0,
  };
}

const CAR_MAX_V = 230;
const CAR_MAX_A = 900;

function stepCar(S, dt) {
  const c = S.car;
  const k = 40;
  let a = (S.knob.x - c.x) * k - c.v * 2 * Math.sqrt(k) * 0.82;
  a = clamp(a, -CAR_MAX_A, CAR_MAX_A);
  const prevV = c.v;
  c.v = clamp(c.v + a * dt, -CAR_MAX_V, CAR_MAX_V);
  c.x += c.v * dt;
  c.a = (c.v - prevV) / dt;
  c.wheel += (c.v * dt) / 2.2;
  const speed = Math.abs(c.v);

  // Hard reversal: heavy braking at speed → tyre smoke and a squeal.
  const braking = c.a * c.v < 0;
  c.brake = braking && Math.abs(c.a) > 140 && speed > 4;
  if (braking && Math.abs(c.a) > 600 && speed > 70) {
    if (c.reverseSmoke <= 0) {
      S.bus.emit('sfx', { name: 'squeal', x: c.x, k: Math.min(1, speed / 200) });
      if (c.meowCd <= 0) {
        S.bus.emit('sfx', { name: 'meow', x: c.x, delay: 0.35 });
        c.meowCd = 5;
      }
    }
    c.reverseSmoke = 0.35;
  }
  // The dog yips with joy at speed.
  c.yipCd = Math.max(0, c.yipCd - dt);
  c.meowCd = Math.max(0, c.meowCd - dt);
  if (speed * PX_TO_MPH > 55 && c.yipCd <= 0) {
    c.yipCd = 4 + Math.random() * 3;
    S.bus.emit('sfx', { name: 'yip', x: c.x });
    S.bus.emit('sfx', { name: 'yip', x: c.x, delay: 0.14 });
  }
  if (c.reverseSmoke > 0) {
    c.reverseSmoke -= dt;
    for (let i = 0; i < 2; i++) spawnFx(S, 'smoke', c.x + (Math.random() - 0.5) * 18, NEAR_GROUND - 1, (Math.random() - 0.5) * 20, -8 - Math.random() * 10, 0.9);
  }
  if (speed > 15) c.facing = sign(c.v);

  // Exhaust puffs while accelerating.
  if (!braking && Math.abs(c.a) > 160) {
    c.puffT -= dt;
    if (c.puffT <= 0) {
      c.puffT = 0.07;
      spawnFx(S, 'puff', c.x - c.facing * 13, NEAR_GROUND - 2, -c.facing * 18 + c.v * 0.2, -4, 0.6);
    }
  }

  // Hydraulics bounce on a spring; springs squeak at each bottom-out.
  const prevHopV = c.hop.v;
  springStep(c.hop, 0, 130, 4.5, dt);
  if (prevHopV < 0 && c.hop.v >= 0 && c.hop.x < -0.2 && Math.abs(prevHopV) > 4) S.bus.emit('sfx', { name: 'squeak', x: c.x, k: Math.min(1, Math.abs(prevHopV) / 40) });
  if (c.hop.x < 0) c.hop.x = Math.max(c.hop.x, -1.2);

  c.ears += dt * (6 + speed * 0.12);
  c.bonk = Math.max(0, c.bonk - dt);
  c.drink = Math.max(0, c.drink - dt);
  c.lean = Math.max(0, c.lean - dt);
  c.paw = Math.max(0, c.paw - dt * 6);
  c.catBob = Math.max(0, c.catBob - dt * 5);
  const wantDuck = S.holdup.phase === 'shootout' || S.holdup.phase === 'police' ? 1 : 0;
  c.duck = clamp(c.duck + (wantDuck ? dt * 6 : -dt * 2), 0, 1);
}

function drawCar(F, S) {
  const c = S.car;
  const flip = c.facing < 0;
  const w = CONV_TPL[0].length;
  const x0 = Math.round(c.x - w / 2);
  const lift = Math.round(Math.max(0, c.hop.x));
  const bodyY = NEAR_GROUND - CONV_TPL.length + 1 - lift;
  const speed = Math.abs(c.v);
  const X = (lx) => x0 + (flip ? w - 1 - lx : lx);
  F.curId = ID.CAR;

  // Speed lines behind the car.
  if (speed > 120) {
    const k = smooth(120, 220, speed);
    for (let i = 0; i < 3; i++) {
      const len = 4 + Math.floor(hash2(i, Math.floor(S.time * 20)) * 6 * k);
      const y = bodyY + 1 + i * 2;
      for (let j = 0; j < len; j++) glow(F, X(-3 - j - i * 2), y, [1, 1, 1], 0.5 * k * (1 - j / len), GROUP.ALWAYS, null, false);
    }
  }

  // Occupants, drawn first so the doors hide their lower halves.
  const duck = Math.round(c.duck * 4);
  const dogY = bodyY - 2 + duck + (c.lean > 0 ? 1 : 0);
  const catY = bodyY - 2 + duck + (c.catBob > 0.5 ? 1 : 0);
  const occ = new Map();
  const put = (lx, ly, col) => occ.set(`${lx},${ly}`, col);
  // dog
  for (let lx = 10; lx <= 12; lx++) for (let ly = 0; ly <= 2; ly++) put(lx, ly, CONV_COLORS.dog);
  put(13, 1, CONV_COLORS.dog);
  put(13, 2, CONV_COLORS.dogDark);
  for (let lx = 11; lx <= 13; lx++) put(lx, 1, CONV_COLORS.shades);
  const flapping = speed > 60;
  const earUp = flapping && Math.sin(c.ears) > 0;
  if (flapping) {
    put(9, 0, CONV_COLORS.dogDark);
    put(8, earUp ? -1 : 0, CONV_COLORS.dogDark);
  } else {
    put(9, 1, CONV_COLORS.dogDark);
    put(9, 2, CONV_COLORS.dogDark);
  }
  if (speed > 90) {
    put(13, 3, CONV_COLORS.tongue);
    if (speed > 150) put(14, 3, CONV_COLORS.tongue);
  }
  // cat, two seats back
  const cat = new Map();
  for (let lx = 3; lx <= 5; lx++) for (let ly = 0; ly <= 2; ly++) cat.set(`${lx},${ly}`, CONV_COLORS.cat);
  cat.set('3,-1', CONV_COLORS.cat);
  cat.set('5,-1', CONV_COLORS.cat);
  cat.set('4,1', CONV_COLORS.shades);
  cat.set('5,1', CONV_COLORS.shades);
  cat.set('6,1', CONV_COLORS.shades);
  cat.set('5,2', CONV_COLORS.catPink);

  const occSprite = (map, yTop) => {
    const keys = [...map.keys()].map((s) => s.split(',').map(Number));
    const minX = Math.min(...keys.map((k) => k[0]));
    const maxX = Math.max(...keys.map((k) => k[0]));
    const minY = Math.min(...keys.map((k) => k[1]));
    const maxY = Math.max(...keys.map((k) => k[1]));
    const sx = flip ? x0 + w - 1 - maxX : x0 + minX;
    sprite(F, sx, yTop + minY, maxX - minX + 1, maxY - minY + 1, (lx, ly) => map.get(`${lx + minX},${ly + minY}`) || null, { flip, shade: false });
  };
  occSprite(occ, dogY);
  occSprite(cat, catY);

  // Lens glint on the cat's sunglasses.
  if (Math.sin(S.time * 2.3) > 0.93 && duck < 3) glow(F, X(6), catY + 1, [1, 1, 1], 1.6);

  // Body.
  sprite(
    F,
    x0,
    bodyY,
    w,
    CONV_TPL.length,
    (lx, ly) => {
      const ch = CONV_TPL[ly][lx];
      if (ch === '.') return null;
      if (ch === 'b') return ly >= 5 ? scalec(CONV_COLORS.b, 0.8) : CONV_COLORS.b;
      if (ch === 's') return CONV_COLORS.s;
      if (ch === 'h') return (Math.floor(c.wheel) + lx) % 2 === 0 ? VEH_COLORS.h1 : VEH_COLORS.h2;
      return VEH_COLORS[ch];
    },
    { flip },
  );
  // Wheels stay on the road while the body rides the hydraulics.
  if (lift > 0)
    for (let ly = 0; ly < lift; ly++)
      for (const lx of [3, 4, 5, 18, 19, 20]) px(F, X(lx), NEAR_GROUND - ly, lx === 4 || lx === 19 ? VEH_COLORS.h2 : VEH_COLORS.w);

  const lights = S.night > 0.35;
  if (lights) glow(F, X(23), bodyY + 3, HEAD_LIGHT, 1.5);
  if (lights || c.brake) glow(F, X(0), bodyY + 3, TAIL_LIGHT, c.brake ? 1.8 : 0.8);

  // The dog drums on the door; a milkshake when the carhop delivers.
  if (c.paw > 0) px(F, X(13), bodyY + 2 - (c.paw > 0.5 ? 1 : 0), CONV_COLORS.dog);
  if (c.drink > 0) {
    px(F, X(14), bodyY + 1, CONV_COLORS.shake);
    px(F, X(14), bodyY, CONV_COLORS.shake);
    px(F, X(14), bodyY - 1, CONV_COLORS.straw);
    px(F, X(13), bodyY - 1, CONV_COLORS.straw);
  }

  // Stars circle the dog's head after a coconut.
  if (c.bonk > 0) {
    for (let i = 0; i < 3; i++) {
      const a = S.time * 7 + (i * TAU) / 3;
      glow(F, X(11) + Math.cos(a) * 3, dogY - 1 + Math.sin(a) * 1.2, hex('#ffe45c'), 1.5);
    }
  }
  return { x0, bodyY, front: X(23), rear: X(0) };
}
