// The hold-up, left of the knob: window shatters → police arrive → five seconds of
// shooting from cover → getaway and chase. Stylised and bloodless; nobody is hit.
const HOLDUP_MX = 82; // where the muscle car parks, in front of the store
const MUSCLE_BODY = hex('#ffcc1f');
const HOLDUP_LATE = 0.9;
const AFTER_DARK = 0.6;
const SHOOTOUT_SECONDS = 5;

function createHoldup() {
  return { phase: 'idle', t: 0, cooldown: 0, taps: [], mx: W + 16, mv: 0, px: W + 16, pv: 0, robbers: [], officers: [], shotIn: 0, muzzles: [], alarm: 0, bar: 0, mWheel: 0, pWheel: 0 };
}

function holdupStatus(h) {
  if (h.phase === 'alarm' || h.phase === 'police') return 'Alarm';
  if (h.phase === 'shootout') return 'Shots fired';
  if (h.phase === 'getaway') return 'Getaway';
  return null;
}

function storeTapped(S) {
  const h = S.holdup;
  if (S.t < AFTER_DARK || h.phase !== 'idle' || h.cooldown > 0) return;
  h.taps = h.taps.filter((t) => S.time - t < 3);
  h.taps.push(S.time);
  if (h.taps.length >= 3) {
    h.taps = [];
    h.phase = 'pending';
  }
}

function startHoldup(S) {
  const h = S.holdup;
  h.phase = 'arrive';
  h.t = 0;
  h.mx = W + 16;
  h.mv = -110;
  h.px = W + 30;
  h.pv = 0;
  h.robbers = [];
  h.officers = [];
  h.muzzles = [];
  h.skid = false;
  h.peeled = false;
  S.bus.emit('sfx', { name: 'roar', x: h.mx, k: 0.5 });
}

function moveFigure(f, dt, speed) {
  const dx = f.tx - f.x;
  const dy = f.ty - f.gy;
  const d = Math.hypot(dx, dy);
  if (d < 0.5) {
    f.x = f.tx;
    f.gy = f.ty;
    return true;
  }
  const s = Math.min(d, speed * dt);
  f.x += (dx / d) * s;
  f.gy += (dy / d) * s;
  f.phase += dt * 9;
  f.facing = dx < 0 ? -1 : 1;
  return false;
}

function fireShot(S) {
  const h = S.holdup;
  const robberSide = S.rng() < 0.5;
  const shooters = robberSide ? h.robbers : h.officers;
  const f = shooters[Math.floor(S.rng() * shooters.length)];
  if (!f) return;
  f.pop = 0.35;
  const dir = robberSide ? 1 : -1;
  const gx = f.x + dir * 3;
  const gy = f.gy - 4;
  h.muzzles.push({ x: gx, y: gy, life: 0.09, dir });
  S.flash = Math.max(S.flash, 0.55);
  // Sparks and glass off the other side's car body.
  const tx = robberSide ? h.px + (S.rng() - 0.5) * 16 : h.mx + (S.rng() - 0.5) * 18;
  const ty = FAR_GROUND - 3 - S.rng() * 3;
  burst(S, 'spark', tx, ty, 5, 40, 0.35);
  if (S.rng() < 0.45) burst(S, 'glass', tx, ty - 1, 4, 30, 0.7);
  S.bus.emit('sfx', { name: 'shot', x: gx, side: robberSide ? 'robber' : 'police' });
  if (S.rng() < 0.35) {
    const rx = tx + (S.rng() - 0.5) * 20;
    burst(S, 'spark', rx, PAVE_Y + S.rng() * 3, 3, 50, 0.3);
    S.bus.emit('sfx', { name: 'ricochet', x: rx, delay: 0.05 + S.rng() * 0.08 });
  }
}

function stepHoldup(S, dt) {
  const h = S.holdup;
  h.cooldown = Math.max(0, h.cooldown - dt);
  h.bar += dt * 2.2;
  h.alarm = Math.max(0, h.alarm - dt);
  if (h.cooldown <= 0 && h.phase === 'idle') S.store.broken = false;
  for (const m of h.muzzles) m.life -= dt;
  h.muzzles = h.muzzles.filter((m) => m.life > 0);

  if (h.phase === 'idle') {
    if (S.t >= HOLDUP_LATE && h.cooldown <= 0 && S.police.state === 'off' && farLaneClear(S)) startHoldup(S);
    return;
  }
  if (h.phase === 'pending') {
    if (farLaneClear(S) && S.police.state === 'off') startHoldup(S);
    return;
  }
  h.t += dt;

  if (h.phase === 'arrive') {
    h.mv = -Math.max(6, (h.mx - HOLDUP_MX) * 1.8);
    h.mx += h.mv * dt;
    h.mWheel += (h.mv * dt) / 2.2;
    if (h.mx - HOLDUP_MX < 0.6) {
      h.mx = HOLDUP_MX;
      h.mv = 0;
      h.phase = 'alarm';
      h.t = 0;
      S.store.broken = true;
      h.alarm = 30;
      burst(S, 'glass', STORE.x + 12, STORE.glassY + 3, 18, 45, 1);
      S.bus.emit('sfx', { name: 'glass', x: STORE.x + 12 });
      S.bus.emit('sfx', { name: 'alarm', on: true, x: STORE.x + 12 });
      const door = STORE.doorX + 2;
      h.robbers = [
        { x: door, gy: PAVE_Y + 2, tx: HOLDUP_MX - 15, ty: FAR_GROUND, phase: 0, facing: -1, sack: true, pop: 0, inCar: false },
        { x: door + 3, gy: PAVE_Y + 2, tx: HOLDUP_MX - 11, ty: FAR_GROUND, phase: 0.5, facing: -1, sack: false, pop: 0, inCar: false },
      ];
    }
    return;
  }

  for (const r of h.robbers) if (!r.inCar && h.phase !== 'getaway') r.covered = moveFigure(r, dt, 22);

  if (h.phase === 'alarm') {
    if (h.t > 1.4) {
      h.phase = 'police';
      h.t = 0;
      h.px = W + 20;
      h.pv = -150;
      const knobLeft = S.knob.x - KNOB_W / 2;
      h.pStop = clamp(knobLeft - 20, HOLDUP_MX + 22, HOLDUP_MX + 26);
      S.bus.emit('sfx', { name: 'policeIn', x: h.px });
    }
    return;
  }

  if (h.phase === 'police') {
    const d = h.px - h.pStop;
    if (d > 0.4) {
      h.pv = -Math.max(10, Math.min(150, d * 3));
      if (d < 30 && !h.skid) {
        h.skid = true;
        S.bus.emit('sfx', { name: 'squeal', x: h.px, k: 0.9 });
      }
      if (d < 30) spawnFx(S, 'smoke', h.px + 6, FAR_GROUND - 1, 10, -8, 0.8);
      h.px += h.pv * dt;
      h.pWheel += (h.pv * dt) / 2.2;
    } else if (!h.officers.length) {
      h.pv = 0;
      h.officers = [
        { x: h.px + 4, gy: FAR_GROUND, tx: h.px + 13, ty: FAR_GROUND, phase: 0, facing: 1, pop: 0 },
        { x: h.px + 8, gy: FAR_GROUND, tx: h.px + 17, ty: FAR_GROUND, phase: 0.5, facing: 1, pop: 0 },
      ];
      S.bus.emit('sfx', { name: 'bullhorn', x: h.px });
    }
    for (const o of h.officers) o.covered = moveFigure(o, dt, 20);
    if (h.officers.length && h.officers.every((o) => o.covered) && h.robbers.every((r) => r.covered)) {
      h.phase = 'shootout';
      h.t = 0;
      h.shotIn = 0.3;
    }
    return;
  }

  if (h.phase === 'shootout') {
    for (const f of [...h.robbers, ...h.officers]) {
      f.pop = Math.max(0, f.pop - dt);
      f.facing = h.robbers.includes(f) ? 1 : -1;
    }
    h.shotIn -= dt;
    if (h.shotIn <= 0 && h.t < SHOOTOUT_SECONDS) {
      fireShot(S);
      h.shotIn = 0.22 + S.rng() * 0.4;
    }
    if (h.t >= SHOOTOUT_SECONDS + 0.4) {
      h.phase = 'getaway';
      h.t = 0;
      h.skid = false;
      for (const r of h.robbers) {
        r.tx = HOLDUP_MX - 4;
        r.ty = FAR_GROUND;
      }
      for (const o of h.officers) {
        o.tx = h.px + 2;
        o.ty = FAR_GROUND;
      }
    }
    return;
  }

  if (h.phase === 'getaway') {
    for (const r of h.robbers) if (!r.inCar && moveFigure(r, dt, 30)) r.inCar = true;
    const robbersIn = h.robbers.every((r) => r.inCar);
    if (robbersIn) {
      if (!h.peeled) {
        h.peeled = true;
        S.bus.emit('sfx', { name: 'squeal', x: h.mx, k: 1 });
        S.bus.emit('sfx', { name: 'roar', x: h.mx, k: 1 });
      }
      h.mv = Math.max(-240, h.mv - 260 * dt);
      h.mx += h.mv * dt;
      h.mWheel += (h.mv * dt) / 2.2;
      if (h.mx > HOLDUP_MX - 30) spawnFx(S, 'smoke', h.mx + 12, FAR_GROUND - 1, 14 + Math.random() * 10, -10, 1);
    }
    if (h.t > 0.5) for (const o of h.officers) if (!o.inCar && moveFigure(o, dt, 30)) o.inCar = true;
    if (robbersIn && h.officers.every((o) => o.inCar) && h.t > 1.3) {
      h.pv = Math.max(-230, h.pv - 220 * dt);
      h.px += h.pv * dt;
      h.pWheel += (h.pv * dt) / 2.2;
    }
    if (h.mx < -40 && h.px < -40) {
      h.phase = 'idle';
      h.cooldown = 45;
      h.peeled = false;
      h.robbers = [];
      h.officers = [];
      S.bus.emit('sfx', { name: 'alarm', on: false });
    }
  }
}

const holdupBusy = (h) => h.phase !== 'idle' && h.phase !== 'pending';
const holdupSirenOn = (h) => h.phase === 'police' || h.phase === 'shootout' || h.phase === 'getaway';

function drawHoldup(F, S) {
  const h = S.holdup;
  if (!holdupBusy(h)) return;
  F.curId = ID.NONE;
  const lights = S.night > 0.3;
  if (h.mx < W + 20) h.mBox = drawVehicle(F, 'muscle', MUSCLE_BODY, h.mx, FAR_GROUND, -1, { lights, wheel: h.mWheel, brake: h.phase === 'arrive' });
  for (const r of h.robbers) {
    if (r.inCar) continue;
    const moving = Math.abs(r.tx - r.x) > 0.5 || Math.abs(r.ty - r.gy) > 0.5;
    const pose = moving ? 'run' : h.phase === 'shootout' ? (r.pop > 0 ? 'aim' : 'crouch') : 'crouch';
    drawFigure(F, 'robber', r.x, Math.round(r.gy), pose, r.facing, r.phase, { sack: r.sack });
  }
  F.curId = ID.POLICE;
  if (h.phase !== 'arrive' && h.phase !== 'alarm' && h.px < W + 20) h.pBox = drawVehicle(F, 'police', VEH_COLORS.k, h.px, FAR_GROUND, -1, { lights: true, bar: h.bar, wheel: h.pWheel });
  F.curId = ID.NONE;
  for (const o of h.officers) {
    if (o.inCar) continue;
    const moving = Math.abs(o.tx - o.x) > 0.5;
    const pose = moving ? 'run' : h.phase === 'shootout' ? (o.pop > 0 ? 'aim' : 'crouch') : 'crouch';
    drawFigure(F, 'officer', o.x, Math.round(o.gy), pose, o.facing, o.phase);
  }
  for (const m of h.muzzles) {
    addGlow(F, m.x, m.y, hex('#fff1b0'), 3);
    addGlow(F, m.x + m.dir, m.y, hex('#ffb347'), 2);
    addGlow(F, m.x + m.dir, m.y - 1, hex('#ffb347'), 1.2);
  }
}
