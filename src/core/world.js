// World state, the fixed-step simulation, scene painting order, lights and switch levels.

const AMBIENT = { gold: hex('#fff0dc'), dusk: hex('#a77aa8'), night: hex('#3a3a6a') };

function createSwitches(windows) {
  const list = [];
  for (const win of windows) if (!win.dark) list.push({ kind: 'window', group: GROUP.WIN0 + win.i, gate: win.gate });
  list.push({ kind: 'warm', group: GROUP.HOTEL, gate: HOTEL.x + 14 });
  list.push({ kind: 'fluor', group: GROUP.STORE, gate: STORE.x + 8, x: STORE.x + 12 });
  list.push({ kind: 'warm', group: GROUP.DINER, gate: DINER.x + 8 });
  list.push({ kind: 'warm', group: GROUP.CLUB, gate: CLUB.x + 10 });
  for (const [i, x] of LAMPS.entries()) list.push({ kind: 'lamp', group: GROUP.LAMP0 + i, gate: x + 2, x });
  for (const [i, s] of NEON_SIGNS.entries()) list.push({ kind: 'neon', sign: i, groups: s.groups, gate: s.cx, x: s.cx });
  for (const sw of list) {
    sw.on = false;
    sw.catchT = 9;
  }
  return list;
}

function createWorld(seed = 66) {
  const windows = hotelWindows().map((w) => ({ ...w, forced: 0, silT: 0, seq: 0, popped: false }));
  const t0 = 0.08;
  const S = {
    bus: createBus(),
    rng: mulberry32(seed),
    time: 0,
    beat: 0,
    beatClock: null, // set by the audio layer so drums and chases lock to the music
    t: t0,
    night: 0,
    sky: skyStops(t0),
    ambient: AMBIENT.gold,
    flash: 0,
    reducedMotion: false,
    knob: { x: knobX(t0), v: 0, target: knobX(t0), grabbed: false, stretch: 0, wob: { x: 0, v: 0 }, acc: 0 },
    car: createCar(),
    traffic: [],
    trafficState: { spawnIn: 1.5 },
    police: createPolice(),
    heli: createHeli(),
    holdup: createHoldup(),
    fx: [],
    pops: [],
    nuts: [],
    gulls: [],
    windows,
    switches: createSwitches(windows),
    neon: createNeonState(),
    palms: PALMS.map(() => ({ shake: 0, nuts: 3, regrow: 0 })),
    store: { door: 0, doorT: 0, wave: 0, broken: false },
    carhop: { state: 'idle', x: 0, gy: 0, facing: -1, phase: 0, t: 0, lastSeam: 0 },
    dolphin: null,
    flag: 0,
    shootingStar: null,
    idle: createIdle(),
    hover: 0,
    status: 'Cruising',
    levels: { rail: new Float32Array(GROUP_COUNT), full: new Float32Array(GROUP_COUNT) },
  };
  S.car.x = S.knob.x;
  return S;
}

// Knob: follows the target on a spring, stretches with speed, wobbles when it stops.
function stepKnob(S, dt) {
  const k = S.knob;
  const prevV = k.v;
  springStep(k, k.target, 170, 2 * Math.sqrt(170) * 0.78, dt);
  if (k.x < KNOB_MIN) {
    k.x = KNOB_MIN;
    k.v = Math.max(0, k.v);
  }
  if (k.x > KNOB_MAX) {
    k.x = KNOB_MAX;
    k.v = Math.min(0, k.v);
  }
  k.acc = (k.v - prevV) / dt;
  k.stretch = lerp(k.stretch, clamp(Math.abs(k.v) / 700, 0, 0.32), 1 - Math.exp(-dt * 18));
  // Damped wobble fed by the acceleration.
  k.wob.v += (-k.wob.x * 260 - k.wob.v * 9 + clamp(k.acc, -4000, 4000) * 0.00045) * dt;
  k.wob.x += k.wob.v * dt;
}

function stepSwitches(S, dt) {
  for (const sw of S.switches) {
    const on = S.knob.x > sw.gate;
    sw.catchT += dt;
    if (on && !sw.on) {
      sw.catchT = 0;
      if (sw.kind === 'neon') S.bus.emit('sfx', { name: 'neonOn', x: sw.x });
      else if (sw.kind === 'lamp' || sw.kind === 'fluor') S.bus.emit('sfx', { name: 'lampOn', x: sw.x });
    }
    sw.on = on;
  }
  for (const n of S.neon) n.short = Math.max(0, n.short - dt);
}

function switchLevel(sw) {
  if (!sw.on) return 0;
  const t = sw.catchT;
  if (sw.kind === 'neon') return neonCatchLevel(t, sw.sign + 3);
  if (sw.kind === 'lamp') return t < 0.08 ? 0.5 : lerp(0.35, 1, smooth(0, 1.4, t));
  if (sw.kind === 'fluor') return t > 0.7 ? 1 : hash2(Math.floor(t * 18), 9) < 0.45 ? 1 : 0.1;
  return t < 0.12 ? 0.5 : 1;
}

function computeLevels(S) {
  const R = S.levels.rail;
  const Fu = S.levels.full;
  R.fill(0);
  Fu.fill(0);
  R[GROUP.ALWAYS] = Fu[GROUP.ALWAYS] = 1;
  R[GROUP.SKY] = Fu[GROUP.SKY] = 1;
  R[GROUP.TOWERS] = Fu[GROUP.TOWERS] = smooth(0.25, 0.6, S.t);
  for (const sw of S.switches) {
    const rail = switchLevel(sw);
    if (sw.kind === 'neon') {
      const st = S.neon[sw.sign];
      const sh = neonShortLevel(st, S.time, sw.sign + 1);
      for (const [li, g] of sw.groups.entries()) {
        const chase = sw.groups.length > 1 ? sunsetChase(S, li) : 1;
        R[g] = rail * sh * chase;
        Fu[g] = sh * chase;
      }
    } else {
      R[sw.group] = rail;
      Fu[sw.group] = 1;
    }
  }
}

function stepWorld(S, dt) {
  S.time += dt;
  S.beat = S.beatClock ? S.beatClock() : (S.time * 100) / 60;
  stepKnob(S, dt);
  S.t = knobT(S.knob.x);
  S.night = smooth(0.45, 0.8, S.t);
  S.sky = skyStops(S.t);
  S.ambient = ramp3(AMBIENT.gold, AMBIENT.dusk, AMBIENT.night, S.t, 0.5);
  S.flash = Math.max(0, S.flash - dt * 9);
  stepSwitches(S, dt);
  stepCar(S, dt);
  stepTraffic(S, dt);
  stepPolice(S, dt);
  stepHoldup(S, dt);
  stepHeli(S, dt);
  stepTaps(S, dt);
  stepCoconuts(S, dt);
  stepFx(S, dt);
  stepIdle(S, dt);
  S.status = computeStatus(S);
}

function computeStatus(S) {
  const h = holdupStatus(S.holdup);
  if (h) return h;
  if (S.police.state === 'chase') return 'Pursuit';
  if (S.police.lostT > 0) return 'Lost them';
  if (Math.abs(S.car.v) * PX_TO_MPH > SPEEDING_MPH) return 'Speeding';
  return 'Cruising';
}

function drawScene(F, S) {
  frameClear(F);
  drawSky(F, S);
  drawFarTowers(F, S);
  drawBeach(F, S);
  drawGulls(F, S);
  drawPalm(F, S, 0);
  drawSeaWall(F);
  drawGround(F);
  drawCity(F, S);
  drawNeon(F, S);
  drawStreetFurniture(F, S);
  drawHeli(F, S);
  drawTraffic(F, S);
  drawHoldup(F, S);
  drawCarhop(F, S);
  drawPolice(F, S);
  S.carBox = drawCar(F, S);
  drawCoconuts(F, S);
  drawFx(F, S);
  drawPops(F, S);
}

function headBeam(front, groundY, dir) {
  return { kind: 'cone', ax: front, ay: groundY - 3, bx: front + dir * 30, by: groundY, w0: 1, w1: 4.5, color: HEAD_LIGHT, power: 0.75, air: 0.1, group: GROUP.ALWAYS };
}

function buildLights(S) {
  const out = [];
  for (const [i, x] of LAMPS.entries()) {
    out.push({ kind: 'pool', x, y: 40, rx: 14, ry: 6, yMin: PAVE_Y, color: SODIUM, power: 0.95, group: GROUP.LAMP0 + i });
    out.push({ kind: 'point', x, y: 22, r: 7, color: SODIUM, power: 0.55, group: GROUP.LAMP0 + i });
  }
  for (const s of NEON_SIGNS) out.push({ kind: 'point', x: s.cx, y: s.cy, r: s.name === 'SUNSET' ? 14 : 10, color: s.color, power: 0.32, group: s.groups[0] });
  out.push({ kind: 'pool', x: STORE.x + 13, y: 36, rx: 16, ry: 3, yMin: PAVE_Y, color: FLUOR, power: 0.55, group: GROUP.STORE });
  out.push({ kind: 'pool', x: DINER.x + 12, y: 36, rx: 13, ry: 3, yMin: PAVE_Y, color: hex('#ffcf8f'), power: 0.45, group: GROUP.DINER });
  out.push({ kind: 'pool', x: HOTEL.x + 14, y: 36, rx: 8, ry: 2.5, yMin: PAVE_Y, color: hex('#ffcf8a'), power: 0.45, group: GROUP.HOTEL });
  out.push({ kind: 'point', x: CLUB.x + 19, y: 31, r: 10, color: hex('#d35dff'), power: 0.3, group: GROUP.CLUB });

  const lightsOn = S.night > 0.3;
  if (lightsOn) {
    for (const c of S.traffic) if (c.box) out.push(headBeam(c.box.front, FAR_GROUND, -1));
    if (S.carBox && S.night > 0.35) out.push(headBeam(S.carBox.front, NEAR_GROUND, S.car.facing));
    const h = S.holdup;
    if (holdupBusy(h) && h.mBox && h.mx < W + 10) out.push(headBeam(h.mBox.front, FAR_GROUND, -1));
  }
  const pushBar = (x, y, phase) => {
    const red = Math.sin(phase * TAU) > 0;
    out.push({ kind: 'point', x, y, r: 17, color: red ? BAR_RED : BAR_BLUE, power: 1.1, group: GROUP.ALWAYS });
  };
  const P = S.police;
  if (P.state !== 'off' && P.box) {
    pushBar(P.x, P.box.y0, P.bar);
    out.push(headBeam(P.box.front, policeGround(P), P.facing));
  }
  const h = S.holdup;
  if (holdupBusy(h) && h.pBox && h.phase !== 'arrive' && h.phase !== 'alarm') pushBar(h.px, h.pBox.y0, h.bar);
  if (h.alarm > 0 && Math.sin(S.time * 12) > 0) out.push({ kind: 'point', x: STORE.x + 13, y: 27, r: 22, color: hex('#ff2a2a'), power: 0.9, group: GROUP.ALWAYS });
  for (const m of h.muzzles) out.push({ kind: 'point', x: m.x, y: m.y, r: 20, color: hex('#ffd27a'), power: 2.2, group: GROUP.ALWAYS });

  const Hh = S.heli;
  if (Hh.state === 'in' && Hh.lamp) {
    const bx = Hh.beam.x;
    out.push({ kind: 'cone', ax: Hh.lamp.x, ay: Hh.lamp.y, bx, by: 45, w0: 0.8, w1: 7, color: SEARCH, power: 0.55, air: 0.22, group: GROUP.ALWAYS });
    out.push({ kind: 'pool', x: bx, y: 45, rx: 9, ry: 3.2, color: SEARCH, power: 1.2, group: GROUP.ALWAYS });
  }
  return out;
}
