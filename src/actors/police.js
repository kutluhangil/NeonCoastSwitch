// After dark, driving fast brings a police car onto your tail. Slow down and it gives up,
// swings out, overtakes and leaves.
const POLICE_AFTER_DARK = 0.55;
const SPEEDING_MPH = 48;

function createPolice() {
  return { state: 'off', x: -30, v: 0, lane: 0, bar: 0, slowT: 0, heat: 0, dir: 1, lostT: 0, wheel: 0 };
}

function stepPolice(S, dt) {
  const P = S.police;
  const c = S.car;
  const mph = Math.abs(c.v) * PX_TO_MPH;
  P.lostT = Math.max(0, P.lostT - dt);
  P.bar += dt * 2.2;

  if (P.state === 'off') {
    const eligible = S.t >= POLICE_AFTER_DARK && S.holdup.phase === 'idle';
    if (eligible && mph > SPEEDING_MPH) P.heat += (dt * (mph - SPEEDING_MPH)) / 6;
    else P.heat = Math.max(0, P.heat - dt * 0.15);
    if (P.heat >= 1) {
      P.state = 'chase';
      P.heat = 0;
      P.slowT = 0;
      P.lane = 0;
      P.x = c.facing > 0 ? -18 : W + 18;
      P.v = c.v * 0.9;
      S.bus.emit('sfx', { name: 'policeIn', x: P.x });
    }
    return;
  }

  if (P.state === 'chase') {
    const target = c.x - c.facing * 27;
    let a = (target - P.x) * 9 - P.v * 5.2;
    a = clamp(a, -800, 800);
    P.v = clamp(P.v + a * dt, -270, 270);
    P.x += P.v * dt;
    P.slowT = mph < 25 ? P.slowT + dt : 0;
    if (P.slowT > 2.2 || S.t < POLICE_AFTER_DARK - 0.08 || S.holdup.phase !== 'idle') {
      P.state = 'giveup';
      P.dir = c.facing;
      P.lostT = 3.5;
      S.bus.emit('sfx', { name: 'bark', x: c.x });
      S.bus.emit('sfx', { name: 'bark', x: c.x, delay: 0.25 });
    }
  } else if (P.state === 'giveup') {
    P.lane = Math.min(1, P.lane + dt * 1.8);
    P.v = lerp(P.v, P.dir * 175, 1 - Math.exp(-dt * 1.6));
    P.x += P.v * dt;
    if (P.x < -30 || P.x > W + 30) {
      P.state = 'off';
      P.x = -30;
    }
  }
  P.wheel += (P.v * dt) / 2.2;
}

const policeGround = (P) => Math.round(lerp(NEAR_GROUND - 1, FAR_GROUND, smooth(0, 1, P.lane)));

function drawPolice(F, S) {
  const P = S.police;
  if (P.state === 'off') return;
  F.curId = ID.POLICE;
  const facing = Math.abs(P.v) > 5 ? sign(P.v) : S.car.facing;
  P.box = drawVehicle(F, 'police', VEH_COLORS.k, P.x, policeGround(P), facing, { lights: true, bar: P.bar, wheel: P.wheel });
  P.facing = facing;
}
