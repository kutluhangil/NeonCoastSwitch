// A helicopter arrives at night: blinking beacon, flickering rotor, sweeping searchlight.
// It follows the chase and the hold-up.
const HELI_TPL = [
  '.................',
  '.......k.........',
  '....bbbbbb.......',
  '...gggbbbbbbbbbbb',
  '...ggbbbbbb....bk',
  '....bbbbbb.....k.',
  '....c....c.......',
  '...cccccccc......',
];
const HELI_BODY = hex('#2b3049');
const SEARCH = hex('#e8f1ff');

function createHeli() {
  return { state: 'away', x: W + 30, y: 7, v: 0, beam: { x: 90, v: 0 }, tapT: 0, facing: -1 };
}

function heliFocus(S) {
  const h = S.holdup;
  if (h.phase === 'getaway') return h.mx;
  if (h.phase !== 'idle' && h.phase !== 'pending') return (h.mx + h.px) / 2;
  if (S.police.state === 'chase' || S.heli.tapT > 0) return S.car.x;
  return null;
}

function stepHeli(S, dt) {
  const Hh = S.heli;
  const want = S.t > 0.72;
  Hh.tapT = Math.max(0, Hh.tapT - dt);
  if (Hh.state === 'away') {
    if (!want) return;
    Hh.state = 'in';
    Hh.x = W + 24;
    Hh.v = -30;
  }
  const focus = heliFocus(S);
  let target = focus !== null ? focus + 4 : 50 + (Math.sin(S.time * 0.09) * 0.5 + 0.5) * 90;
  if (!want) target = W + 40;
  const a = clamp((target - Hh.x) * 1.1 - Hh.v * 1.9, -40, 40);
  Hh.v = clamp(Hh.v + a * dt, -55, 55);
  Hh.x += Hh.v * dt;
  if (Math.abs(Hh.v) > 3) Hh.facing = sign(Hh.v);
  Hh.y = 7 + Math.sin(S.time * 0.9) * 0.8;
  if (!want && Hh.x > W + 30) {
    Hh.state = 'away';
    return;
  }
  // Searchlight: sweeps, or locks onto the action.
  const beamTarget = focus !== null ? focus : Hh.x + Math.sin(S.time * 0.55) * 30;
  springStep(Hh.beam, beamTarget, focus !== null ? 14 : 3, focus !== null ? 7 : 3.5, dt);
}

function drawHeli(F, S) {
  const Hh = S.heli;
  if (Hh.state === 'away') return;
  F.curId = ID.HELI;
  const w = HELI_TPL[0].length;
  const x0 = Math.round(Hh.x - w / 2);
  const y0 = Math.round(Hh.y - 3);
  const flip = Hh.facing > 0;
  sprite(F, x0, y0, w, HELI_TPL.length, (lx, ly) => {
    const ch = HELI_TPL[ly][lx];
    if (ch === '.') return null;
    if (ch === 'g') return VEH_COLORS.g;
    if (ch === 'c') return hex('#8d93a6');
    if (ch === 'k') return VEH_COLORS.k;
    return HELI_BODY;
  }, { flip });
  const X = (lx) => x0 + (flip ? w - 1 - lx : lx);
  // Rotor: a flickering blade.
  const frame = Math.floor(S.time * 24) % 3;
  const half = [8, 5, 7][frame];
  for (let i = -half; i <= half; i++) if (frame !== 1 || Math.abs(i) % 3 !== 2) px(F, X(7) + i, y0, hex('#565b70'));
  // Beacon blinks.
  if (Math.sin(S.time * 5) > 0.6) glow(F, X(16), y0 + 4, hex('#ff3040'), 2);
  glow(F, X(6), y0 + 6, SEARCH, 1.6);
  Hh.lamp = { x: X(6), y: y0 + 6 };
}
