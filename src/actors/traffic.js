// Traffic drives left in the far lane: sedans, coupes, vans and a yellow taxi.
const TRAFFIC_KINDS = [
  { kind: 'sedan', w: 0.36 },
  { kind: 'coupe', w: 0.26 },
  { kind: 'van', w: 0.2 },
  { kind: 'taxi', w: 0.18 },
];
const TRAFFIC_BODIES = ['#4fa3d9', '#e8e2d2', '#7c5cc4', '#3fbf9f', '#d9576b', '#f2a65a', '#5c6b8a'].map(hex);
const TAXI_BODY = hex('#ffcf3a');

function pickKind(r) {
  let acc = 0;
  for (const k of TRAFFIC_KINDS) {
    acc += k.w;
    if (r < acc) return k.kind;
  }
  return 'sedan';
}

// Density thins late at night so the far lane can clear for the hold-up.
const trafficDensity = (t) => 1 - smooth(0.8, 0.9, t);

function stepTraffic(S, dt) {
  const T = S.trafficState;
  const blocked = S.holdup.phase !== 'idle';
  T.spawnIn -= dt * trafficDensity(S.t);
  if (T.spawnIn <= 0 && !blocked) {
    T.spawnIn = 2.2 + S.rng() * 4;
    const last = S.traffic[S.traffic.length - 1];
    const used = new Set(S.traffic.map((c) => c.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    if ((!last || last.x < W - 6) && slot < 10) {
      const kind = pickKind(S.rng());
      S.traffic.push({
        slot,
        kind,
        body: kind === 'taxi' ? TAXI_BODY : TRAFFIC_BODIES[Math.floor(S.rng() * TRAFFIC_BODIES.length)],
        x: W + 14,
        v: -(34 + S.rng() * 22),
        wheel: 0,
        flash: 0,
        honkPitch: 0.75 + S.rng() * 0.6,
        side: Math.sign(W + 14 - S.car.x),
      });
    }
  }
  for (let i = 0; i < S.traffic.length; i++) {
    const c = S.traffic[i];
    const ahead = S.traffic[i - 1];
    let v = c.v;
    // Keep a gap to the car in front.
    if (ahead && c.x - ahead.x < 26) v = Math.max(v, ahead.v * 0.95);
    c.x += v * dt;
    c.wheel += (v * dt) / 2.2;
    c.flash = Math.max(0, c.flash - dt);
    const side = Math.sign(c.x - S.car.x);
    if (side !== c.side && side !== 0) {
      c.side = side;
      S.bus.emit('sfx', { name: 'pass', x: c.x, v: v - S.car.v, kind: c.kind });
    }
  }
  S.traffic = S.traffic.filter((c) => c.x > -16);
}

function drawTraffic(F, S) {
  const lights = S.night > 0.3;
  for (const c of S.traffic) {
    F.curId = ID.TRAFFIC0 + c.slot;
    c.box = drawVehicle(F, c.kind, c.body, c.x, FAR_GROUND, -1, { lights, wheel: c.wheel, flash: c.flash > 0 && Math.floor(c.flash * 10) % 2 === 0 ? 1 : 0 });
  }
}

const farLaneClear = (S) => S.traffic.length === 0;
