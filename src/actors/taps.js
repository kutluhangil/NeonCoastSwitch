// Tapping the scene. Each target reacts and emits its own synthesised sound.
// Touches on the knob always mean the car (handled by the input layer).

const BIG_TARGETS = new Set([ID.SKY, ID.SEA, ID.ROAD]);

function tappable(id) {
  return id !== ID.NONE;
}

function tapCar(S) {
  const c = S.car;
  c.hop.v = 62;
  S.bus.emit('sfx', { name: 'hop', x: c.x });
  S.bus.emit('sfx', { name: 'honk', x: c.x, delay: 0.32 });
  resetIdle(S);
}

function handleTap(S, id, x, y) {
  resetIdle(S);
  if (id === ID.ROAD) {
    S.knob.target = clamp(x, KNOB_MIN, KNOB_MAX);
    return;
  }
  if (id >= ID.PALM0 && id < ID.PALM0 + PALMS.length) return tapPalm(S, id - ID.PALM0);
  if (id >= ID.WIN0 && id < ID.WIN0 + S.windows.length) return tapWindow(S, S.windows[id - ID.WIN0]);
  if (id >= ID.NEON0 && id < ID.NEON0 + NEON_SIGNS.length) return tapNeon(S, id - ID.NEON0);
  if (id >= ID.TRAFFIC0 && id < ID.TRAFFIC0 + 10) {
    const car = S.traffic.find((c) => c.slot === id - ID.TRAFFIC0);
    if (car) {
      car.flash = 0.6;
      S.bus.emit('sfx', { name: 'carHonk', x: car.x, pitch: car.honkPitch });
    }
    return;
  }
  switch (id) {
    case ID.STORE:
      S.store.doorT = 1.6;
      S.store.wave = 1.4;
      S.bus.emit('sfx', { name: 'chime', x: STORE.x + 20 });
      storeTapped(S);
      return;
    case ID.DINER:
      return tapDiner(S);
    case ID.SEA:
      if (!S.dolphin) {
        S.dolphin = { x0: clamp(x - 9, 0, BEACH_END - 22), t: 0, dur: 1.5, splashed: false };
        S.bus.emit('sfx', { name: 'dolphin', x });
      }
      return;
    case ID.LIFEGUARD:
      S.flag = 1;
      S.bus.emit('sfx', { name: 'whistle', x: TOWER.x + 4 });
      return;
    case ID.POLICE:
      S.bus.emit('sfx', { name: 'bullhorn', x });
      S.bus.emit('sfx', { name: 'radio', x, delay: 0.55 });
      return;
    case ID.HELI:
      S.heli.tapT = 6;
      S.bus.emit('sfx', { name: 'squelch', x });
      return;
    case ID.SKY:
      if (S.t > 0.55) {
        S.shootingStar = { x: x - 10, y: Math.max(1, y - 4), vx: 70, vy: 26, life: 1 };
        S.bus.emit('sfx', { name: 'shootingStar', x });
      } else {
        const fromLeft = x > W / 2;
        S.gulls.push({ x: fromLeft ? -4 : W + 4, y: clamp(y, 3, 16), vx: fromLeft ? 34 : -34, vy: 0, flap: 0, visitor: true, tx: x });
        S.bus.emit('sfx', { name: 'gull', x });
      }
  }
}

function tapPalm(S, i) {
  const p = S.palms[i];
  p.shake = 1.3;
  S.bus.emit('sfx', { name: 'rustle', x: PALMS[i].x });
  if (p.nuts <= 0) return;
  p.nuts--;
  p.regrow = 18;
  const crown = PALMS[i];
  const cx = crown.x + (crown.beach ? -2 : i % 2 === 0 ? 2 : -2);
  const underCar = Math.abs(S.car.x - cx) < 11;
  S.nuts.push({ x: cx, y: crown.top + 2, vx: (Math.random() - 0.5) * 8, vy: 0, floor: underCar ? NEAR_GROUND - 1 : PAVE_Y + 2, rest: 0, hitDog: false });
}

function tapWindow(S, win) {
  if (win.seq > 0) return;
  win.seq = 2.6;
  win.popped = false;
  S.bus.emit('sfx', { name: 'knock3', x: win.x + 1 });
}

function tapNeon(S, i) {
  const st = S.neon[i];
  st.short = 1.4;
  const s = NEON_SIGNS[i];
  for (let k = 0; k < 10; k++) {
    const [x, y] = s.pixels[Math.floor(Math.random() * s.pixels.length)];
    spawnFx(S, 'crackle', x, y, (Math.random() - 0.5) * 50, -20 - Math.random() * 30, 0.4 + Math.random() * 0.3);
  }
  S.bus.emit('sfx', { name: 'short', x: s.cx });
}

function tapDiner(S) {
  S.bus.emit('sfx', { name: 'orderBell', x: DINER.x + 12 });
  const ch = S.carhop;
  if (ch.state !== 'idle') return;
  ch.state = 'out';
  ch.x = DINER.x + DINER.w - 4;
  ch.gy = PAVE_Y + 2;
  ch.lastSeam = Math.floor(ch.x / PAVE_SEAM);
  S.bus.emit('sfx', { name: 'skates', on: true });
}

function stepTaps(S, dt) {
  for (const p of S.palms) {
    p.shake = Math.max(0, p.shake - dt);
    if (p.nuts < 3) {
      p.regrow -= dt;
      if (p.regrow <= 0) {
        p.nuts++;
        p.regrow = 18;
      }
    }
  }

  for (const win of S.windows) {
    win.forced = Math.max(0, win.forced - dt);
    win.silT = Math.max(0, win.silT - dt);
    if (win.seq <= 0) continue;
    win.seq -= dt;
    const elapsed = 2.6 - win.seq;
    if (elapsed > 0.8 && win.forced <= 0) {
      win.forced = 5;
      win.silT = 1.6;
    }
    if (elapsed > 1.15 && !win.popped) {
      win.popped = true;
      addPop(S, '!', win.x + 1, win.y - 7, 1.5);
      S.bus.emit('sfx', { name: 'hey', x: win.x + 1 });
    }
  }

  const st = S.store;
  st.doorT = Math.max(0, st.doorT - dt);
  st.wave = Math.max(0, st.wave - dt);
  const doorTarget = st.doorT > 0.4 || S.holdup.phase === 'alarm' ? 1 : 0;
  st.door = clamp(st.door + (doorTarget ? dt * 4 : -dt * 3), 0, 1);

  stepCarhop(S, dt);

  if (S.dolphin) {
    const d = S.dolphin;
    d.t += dt;
    if (!d.splashed) {
      d.splashed = true;
      burst(S, 'splash', d.x0, SAND_Y - 3, 8, 30, 0.6);
    }
    if (d.t >= d.dur) {
      burst(S, 'splash', d.x0 + 18, SAND_Y - 3, 10, 34, 0.7);
      S.dolphin = null;
    }
  }

  S.flag = Math.max(0, S.flag - dt * 0.4);

  if (S.shootingStar) {
    const s = S.shootingStar;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt * 0.9;
    if (s.life <= 0 || s.y > HORIZON) S.shootingStar = null;
  }

  stepGulls(S, dt);
}

function stepCarhop(S, dt) {
  const ch = S.carhop;
  if (ch.state === 'idle') return;
  const home = DINER.x + DINER.w - 4;
  const speed = 34;
  if (ch.state === 'out') {
    const tx = S.car.x + S.car.facing * 2;
    const ty = KERB_Y + 1;
    const dx = tx - ch.x;
    const dy = ty - ch.gy;
    const d = Math.hypot(dx, dy);
    if (d < 1.5) {
      ch.state = 'hand';
      ch.t = 1.1;
      S.car.drink = 3.2;
      S.bus.emit('sfx', { name: 'skates', on: false });
      S.bus.emit('sfx', { name: 'slurp', x: S.car.x, delay: 0.4 });
      for (let i = 0; i < 4; i++) addPop(S, 'heart', S.car.x + (Math.random() - 0.5) * 6, NEAR_GROUND - 11 - i * 2, 1.6 + i * 0.3);
    } else {
      const s = Math.min(d, speed * dt);
      ch.x += (dx / d) * s;
      ch.gy += (dy / d) * s;
      ch.facing = dx < 0 ? -1 : 1;
    }
  } else if (ch.state === 'hand') {
    ch.t -= dt;
    if (ch.t <= 0) {
      ch.state = 'back';
      S.bus.emit('sfx', { name: 'skates', on: true });
    }
  } else if (ch.state === 'back') {
    const dx = home - ch.x;
    const dy = PAVE_Y + 2 - ch.gy;
    const d = Math.hypot(dx, dy);
    if (d < 1) {
      ch.state = 'idle';
      S.bus.emit('sfx', { name: 'skates', on: false });
    } else {
      const s = Math.min(d, speed * dt);
      ch.x += (dx / d) * s;
      ch.gy += (dy / d) * s;
      ch.facing = dx < 0 ? -1 : 1;
    }
  }
  ch.phase += dt * 6;
  // Wheels click on the paving seams.
  const seam = Math.floor(ch.x / PAVE_SEAM);
  if (seam !== ch.lastSeam && ch.gy < KERB_Y) S.bus.emit('sfx', { name: 'seamClick', x: ch.x });
  ch.lastSeam = seam;
}

function drawCarhop(F, S) {
  const ch = S.carhop;
  if (ch.state === 'idle') return;
  F.curId = ID.NONE;
  drawFigure(F, 'carhop', ch.x, Math.round(ch.gy), 'stand', ch.facing, ch.phase, { skates: true, shake: ch.state === 'out' });
}

function stepGulls(S, dt) {
  const day = S.t < 0.45;
  if (day && S.gulls.filter((g) => !g.visitor).length < 2 && S.rng() < dt * 0.5) {
    S.gulls.push({ x: -4, y: 4 + S.rng() * 9, vx: 9 + S.rng() * 6, vy: 0, flap: S.rng() * TAU });
  }
  for (const g of S.gulls) {
    g.flap += dt * (g.visitor ? 9 : 6);
    g.x += g.vx * dt;
    g.y += Math.sin(g.flap * 0.3) * dt * 2;
    if (!g.visitor && day && g.x > BEACH_END + 4) g.vx = -Math.abs(g.vx);
    if (!g.visitor && day && g.x < -2 && g.vx < 0) g.vx = Math.abs(g.vx);
  }
  S.gulls = S.gulls.filter((g) => g.x > -8 && g.x < W + 8);
}

function hoverIsBig(id) {
  return BIG_TARGETS.has(id);
}
