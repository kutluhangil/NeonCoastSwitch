// Logic tests for the simulation: the sim sources run in a vm context, no browser needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { SIM_FILES, readSources } from '../scripts/build.mjs';

function load() {
  const ctx = vm.createContext({ console });
  vm.runInContext(readSources(SIM_FILES), ctx, { filename: 'sim.js' });
  return (expr) => vm.runInContext(expr, ctx);
}

const STEP = 1 / 60;
const run = (sim, S, seconds, each) => {
  const step = sim('stepWorld');
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    step(S, STEP);
    if (each) each(S, i * STEP);
  }
};

function world(sim, t) {
  const S = sim('createWorld')(7);
  const x = sim('knobX')(t);
  S.knob.x = S.knob.target = x;
  S.car.x = x;
  return S;
}

test('clock runs 18:30 → 23:30 across the knob', () => {
  const sim = load();
  assert.equal(sim('clockText(0)'), '18:30');
  assert.equal(sim('clockText(0.5)'), '21:00');
  assert.equal(sim('clockText(1)'), '23:30');
});

test('Bayer 4×4 thresholds are 16 distinct values in (0, 1)', () => {
  const sim = load();
  const v = new Set();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) v.add(sim(`bayer(${x}, ${y})`));
  assert.equal(v.size, 16);
  for (const t of v) assert.ok(t > 0 && t < 1);
});

test('every neon text has glyphs and fits its width', () => {
  const sim = load();
  for (const s of ['CORAL', '24H', 'MART', 'OPEN', 'SUNSET', '!']) {
    let n = 0;
    sim('eachTextPixel')(s, 0, 0, () => n++);
    assert.ok(n > 0, s);
    assert.equal(sim('textWidth')(s), s.length * 4 - 1);
  }
});

test('knob springs to its target and stays inside the track', () => {
  const sim = load();
  const S = world(sim, 0);
  S.knob.target = sim('KNOB_MAX');
  run(sim, S, 3);
  assert.ok(Math.abs(S.knob.x - sim('KNOB_MAX')) < 0.5);
  assert.ok(S.knob.x <= sim('KNOB_MAX'));
  assert.ok(Math.abs(S.car.x - S.knob.x) < 2, 'the car follows the knob');
});

test('street lights are off ahead of the knob on the rail, on in the full render', () => {
  const sim = load();
  const S = world(sim, 0.3);
  run(sim, S, 0.5);
  sim('computeLevels')(S);
  const G = sim('GROUP');
  const lamps = sim('LAMPS');
  for (const [i, x] of lamps.entries()) {
    const expectOn = x + 2 < S.knob.x;
    assert.equal(S.levels.rail[G.LAMP0 + i] > 0, expectOn, `lamp ${i}`);
    assert.equal(S.levels.full[G.LAMP0 + i], 1);
  }
});

test('speeding after dark brings the police; slowing down loses them', () => {
  const sim = load();
  const S = world(sim, 0.7);
  S.traffic.length = 0;
  S.holdup.cooldown = 999;
  const states = new Set();
  const KMIN = sim('KNOB_MIN');
  const KMAX = sim('KNOB_MAX');
  // Drive hard back and forth across the night half of the road.
  run(sim, S, 8, (S, t) => {
    S.knob.target = Math.floor(t / 1.1) % 2 === 0 ? KMAX : KMIN + 70;
    states.add(S.police.state);
  });
  assert.ok(states.has('chase'), 'police joined the chase');
  run(sim, S, 12, (S) => states.add(S.police.state));
  assert.ok(states.has('giveup'));
  assert.equal(S.police.state, 'off');
});

test('the hold-up plays through every phase without anyone being hit', () => {
  const sim = load();
  const S = world(sim, 0.96);
  S.traffic.length = 0;
  S.trafficState.spawnIn = 999;
  const phases = [];
  let shots = 0;
  S.bus.on('sfx', (e) => e.name === 'shot' && shots++);
  run(sim, S, 40, (S) => {
    if (phases[phases.length - 1] !== S.holdup.phase) phases.push(S.holdup.phase);
  });
  assert.deepEqual(phases.slice(0, 6), ['arrive', 'alarm', 'police', 'shootout', 'getaway', 'idle']);
  assert.ok(shots >= 6, `shots fired: ${shots}`);
  assert.ok(S.holdup.cooldown > 0);
});

test('three taps on the store after dark start the hold-up early', () => {
  const sim = load();
  const S = world(sim, 0.65);
  const ID = sim('ID');
  run(sim, S, 0.2);
  for (let i = 0; i < 3; i++) sim('handleTap')(S, ID.STORE, 90, 30);
  assert.equal(S.holdup.phase, 'pending');
  S.traffic.length = 0;
  run(sim, S, 1);
  assert.notEqual(S.holdup.phase, 'pending');
});

test('before dark, store taps only ring the chime', () => {
  const sim = load();
  const S = world(sim, 0.3);
  const ID = sim('ID');
  for (let i = 0; i < 3; i++) sim('handleTap')(S, ID.STORE, 90, 30);
  assert.equal(S.holdup.phase, 'idle');
});

test('every tap target reacts with a sound', () => {
  const sim = load();
  const S = world(sim, 0.7);
  run(sim, S, 3);
  const ID = sim('ID');
  const heard = [];
  S.bus.on('sfx', (e) => heard.push(e.name));
  const targets = [ID.SKY, ID.SEA, ID.LIFEGUARD, ID.PALM0, ID.WIN0, ID.STORE, ID.DINER, ID.NEON0, ID.HELI, ID.POLICE];
  for (const id of targets) {
    const before = heard.length;
    sim('handleTap')(S, id, 60, 20);
    run(sim, S, 0.05);
    assert.ok(heard.length > before, `target ${id} made no sound`);
  }
  sim('tapCar')(S);
  assert.ok(heard.includes('hop') && heard.includes('honk'));
});

test('a coconut bonks the dog when the car is under the palm', () => {
  const sim = load();
  const PALMS = sim('PALMS');
  const crownX = PALMS[1].x + 2;
  const S = world(sim, sim('knobT')(crownX));
  S.car.x = crownX;
  let bonked = false;
  S.bus.on('sfx', (e) => e.name === 'bonk' && (bonked = true));
  sim('handleTap')(S, sim('ID').PALM0 + 1, crownX, 20);
  run(sim, S, 2);
  assert.ok(bonked);
  assert.ok(S.car.bonk > 0);
});

test('scene paints and both renders differ ahead of the knob at night', () => {
  const sim = load();
  const S = world(sim, 0.5);
  run(sim, S, 1);
  const F = sim('createFrame')();
  const B = sim('createShadeBuffers')();
  sim('drawScene')(F, S);
  sim('computeLevels')(S);
  const lights = sim('buildLights')(S);
  const W = sim('W');
  const H = sim('H');
  const rail = new Uint8Array(W * H * 4);
  const full = new Uint8Array(W * H * 4);
  sim('shade')(F, lights, { levels: S.levels.rail, ambient: S.ambient, flash: 0, rim: null, hover: 0 }, B, rail);
  sim('shade')(F, lights, { levels: S.levels.full, ambient: S.ambient, flash: 0, rim: null, hover: 0 }, B, full);
  let diffAhead = 0;
  let diffBehind = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const d = Math.abs(rail[i] - full[i]) + Math.abs(rail[i + 1] - full[i + 1]) + Math.abs(rail[i + 2] - full[i + 2]);
      if (x > S.knob.x + 25) diffAhead += d;
      if (x < S.knob.x - 30) diffBehind += d;
    }
  assert.ok(diffAhead > 10000, `ahead differs: ${diffAhead}`);
  assert.ok(diffBehind < diffAhead / 10, `behind matches: ${diffBehind}`);
});
