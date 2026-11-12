// An original four-bar eighties synth-pop loop in A minor over Am · F · C · G at 100 BPM.
// Layers fade in with the knob: pad + arp → drums + bass → lead → bells, toms, crash.
// During a chase or the hold-up the bass doubles to sixteenths and chord stabs push it along.
const CHORDS = [
  { root: 45, notes: [57, 60, 64] }, // Am
  { root: 41, notes: [57, 60, 65] }, // F
  { root: 48, notes: [55, 60, 64] }, // C
  { root: 43, notes: [55, 59, 62] }, // G
];
// [step, midi, length in steps]
const LEAD = [
  [0, 76, 3], [3, 74, 1], [4, 72, 2], [6, 76, 2], [8, 81, 4], [12, 79, 2], [14, 76, 2],
  [16, 77, 3], [19, 76, 1], [20, 72, 4], [24, 69, 4], [28, 72, 2], [30, 74, 2],
  [32, 76, 3], [35, 79, 1], [36, 76, 2], [38, 72, 2], [40, 79, 6], [46, 76, 2],
  [48, 74, 3], [51, 76, 1], [52, 74, 2], [54, 71, 2], [56, 67, 4], [60, 71, 2], [62, 74, 2],
];
const ARP = [0, 1, 2, 3, 2, 1, 0, 2];
const STABS = new Set([0, 3, 6, 10, 12]);
const LAYER_RANGES = [
  [0.1, 0.22], // 2: pad + arp
  [0.3, 0.42], // 3: drums + bass
  [0.5, 0.6], // 4: lead
  [0.82, 0.9], // 5: bells, toms, crash
];

function startMusic(A, S) {
  const ctx = A.ctx;
  A.layers = LAYER_RANGES.map(() => {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(A.music);
    return g;
  });
  A.chase = ctx.createGain();
  A.chase.gain.value = 0;
  A.chase.connect(A.music);

  // Gated reverb for the snare: its own short room, cut hard after each hit.
  A.snareRoom = ctx.createConvolver();
  A.snareRoom.buffer = makeImpulse(ctx, 0.9, 1.4, 0.8);
  A.snareGate = ctx.createGain();
  A.snareGate.gain.value = 0;
  A.snareRoom.connect(A.snareGate);
  A.snareGate.connect(A.layers[1]);

  A.t0 = ctx.currentTime + 0.12;
  A.nextStep = 0;
  A.lastLeadHz = midiHz(76);
  A.sched = setInterval(() => scheduleMusic(A, S), 25);
}

function musicBeat(A) {
  return Math.max(0, (A.ctx.currentTime - A.t0) / (STEP_SEC * 4));
}

function scheduleMusic(A, S) {
  const ahead = A.ctx.currentTime + 0.14;
  for (;;) {
    const t = A.t0 + A.nextStep * STEP_SEC;
    if (t > ahead) break;
    if (t > A.ctx.currentTime - 0.02) playStep(A, S, A.nextStep % 64, t);
    A.nextStep++;
  }
}

function updateMusicMix(A, S) {
  for (const [i, [a, b]] of LAYER_RANGES.entries()) setSmooth(A.layers[i].gain, smooth(a, b, S.t), A.ctx, 0.25);
  const chasing = S.police.state === 'chase' || holdupBusy(S.holdup);
  A.chasing = chasing;
  setSmooth(A.chase.gain, chasing ? 1 : 0, A.ctx, 0.3);
}

function playStep(A, S, step, t) {
  const bar = Math.floor(step / 16);
  const s = step % 16;
  const ch = CHORDS[bar];
  const [L2, L3, L4, L5] = A.layers;

  if (s === 0) pad(A, L2, ch, t);
  arp(A, L2, ch, step, t);

  if (s === 0 || s === 8 || s === 10) kick(A, L3, t);
  if (s === 4 || s === 12) snare(A, L3, t);
  if (s % 2 === 0) noiseHit(A, L3, { t, d: s % 4 === 2 ? 0.06 : 0.035, peak: s % 4 === 2 ? 0.07 : 0.045, type: 'highpass', f: 8000, q: 0.5 });
  if (s % 2 === 0 || A.chasing) bass(A, A.chasing && s % 2 === 1 ? A.chase : L3, ch, step, t);
  if (A.chasing && STABS.has(s)) stab(A, A.chase, ch, t);

  for (const [ls, note, len] of LEAD) if (ls === step) lead(A, L4, note, len, t);

  if (s === 4 || s === 12) bell(A, L5, ch.notes[(bar + (s === 12 ? 1 : 0)) % 3] + 24, t);
  if (step === 0) crash(A, L5, t);
  if (bar === 3 && s >= 12) tom(A, L5, 210 - (s - 12) * 34, t);
}

function pad(A, dest, ch, t) {
  const ctx = A.ctx;
  const len = STEP_SEC * 16;
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1500;
  f.Q.value = 0.8;
  f.connect(g);
  const out = strip(A, { pan: 0, bus: dest, rev: 0.35, t, dur: len });
  g.connect(out);
  // Pumping: the pad ducks on every beat and swells back.
  const peak = 0.05;
  g.gain.setValueAtTime(0.0001, t);
  for (let b = 0; b < 4; b++) {
    const tb = t + b * STEP_SEC * 4;
    g.gain.setValueAtTime(peak * 0.25, tb);
    g.gain.linearRampToValueAtTime(peak, tb + 0.3);
  }
  g.gain.setValueAtTime(peak, t + len - 0.05);
  g.gain.linearRampToValueAtTime(0.0001, t + len + 0.05);
  for (const n of ch.notes)
    for (const det of [-9, 9]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midiHz(n);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + len + 0.1);
    }
}

function arp(A, dest, ch, step, t) {
  const pool = [...ch.notes, ch.notes[0] + 12];
  const n = pool[ARP[step % ARP.length]] + 12;
  const out = strip(A, { pan: (step % 2 ? 0.3 : -0.3), bus: dest, echo: 0.5, rev: 0.15, t, dur: 0.3 });
  const cutoff = 900 + 700 * (0.5 + 0.5 * Math.sin(step * 0.39));
  tone(A, out, { type: 'square', f0: midiHz(n), t, a: 0.004, d: 0.13, peak: 0.032, filter: { f: cutoff, q: 3 } });
}

function kick(A, dest, t) {
  tone(A, dest, { type: 'sine', f0: 150, f1: 42, glide: 0.11, t, a: 0.002, d: 0.2, peak: 0.42 });
  noiseHit(A, dest, { t, d: 0.015, peak: 0.08, type: 'lowpass', f: 3000 });
}

function snare(A, dest, t) {
  const out = strip(A, { pan: 0, bus: dest, t, dur: 0.4 });
  noiseHit(A, out, { t, d: 0.16, peak: 0.16, type: 'bandpass', f: 1900, q: 0.6 });
  tone(A, out, { type: 'triangle', f0: 200, f1: 150, t, d: 0.09, peak: 0.12 });
  // Feed the room and slam the gate shut after a fifth of a second.
  const send = A.ctx.createGain();
  send.gain.value = 0.9;
  noiseHit(A, send, { t, d: 0.12, peak: 0.35, type: 'bandpass', f: 2200, q: 0.5 });
  send.connect(A.snareRoom);
  setTimeout(() => send.disconnect(), (t - A.ctx.currentTime + 1) * 1000);
  const gt = A.snareGate.gain;
  gt.cancelScheduledValues(t);
  gt.setValueAtTime(0.55, t);
  gt.setValueAtTime(0.55, t + 0.2);
  gt.linearRampToValueAtTime(0, t + 0.23);
}

function bass(A, dest, ch, step, t) {
  const sixteenths = A.chasing;
  const idx = sixteenths ? step : Math.floor(step / 2);
  const n = ch.root - 12 + (idx % 2 === 1 ? 12 : 0);
  const d = sixteenths ? 0.11 : 0.22;
  tone(A, dest, { type: 'sawtooth', f0: midiHz(n), t, a: 0.004, d, peak: 0.11, filter: { f: 1100, f1: 260, q: 4 } });
}

function stab(A, dest, ch, t) {
  const out = strip(A, { pan: 0, bus: dest, rev: 0.2, t, dur: 0.3 });
  for (const n of ch.notes) for (const det of [-7, 7]) tone(A, out, { type: 'sawtooth', f0: midiHz(n + 12), detune: det, t, a: 0.003, d: 0.12, peak: 0.022, filter: { f: 2600, f1: 900, q: 1 } });
}

function lead(A, dest, note, len, t) {
  const ctx = A.ctx;
  const dur = len * STEP_SEC;
  const hz = midiHz(note);
  const out = strip(A, { pan: 0.1, bus: dest, echo: 0.55, rev: 0.3, t, dur: dur + 0.4 });
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 2600;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.06, t + 0.02);
  g.gain.setValueAtTime(0.06, t + dur - 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
  f.connect(g);
  g.connect(out);
  // Late vibrato: an LFO whose depth only opens after the note settles.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.6;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.setValueAtTime(0, t + Math.min(0.25, dur * 0.5));
  depth.gain.linearRampToValueAtTime(dur > 0.4 ? 26 : 8, t + dur);
  lfo.connect(depth);
  lfo.start(t);
  lfo.stop(t + dur + 0.2);
  for (const det of [-11, 11]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.detune.value = det;
    // Glide from the previous note.
    o.frequency.setValueAtTime(A.lastLeadHz, t);
    o.frequency.setTargetAtTime(hz, t, 0.025);
    depth.connect(o.detune);
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.2);
  }
  A.lastLeadHz = hz;
}

function bell(A, dest, note, t) {
  const ctx = A.ctx;
  const out = strip(A, { pan: -0.25, bus: dest, rev: 0.5, echo: 0.3, t, dur: 2 });
  const car = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const idx = ctx.createGain();
  const g = ctx.createGain();
  const hz = midiHz(note);
  car.frequency.value = hz;
  mod.frequency.value = hz * 3.5;
  idx.gain.setValueAtTime(hz * 2.2, t);
  idx.gain.exponentialRampToValueAtTime(hz * 0.05, t + 1.2);
  mod.connect(idx);
  idx.connect(car.frequency);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  car.connect(g);
  g.connect(out);
  car.start(t);
  mod.start(t);
  car.stop(t + 1.7);
  mod.stop(t + 1.7);
}

function tom(A, dest, hz, t) {
  const out = strip(A, { pan: 0.4 - (hz - 100) / 400, bus: dest, rev: 0.4, t, dur: 0.6 });
  tone(A, out, { type: 'sine', f0: hz, f1: hz * 0.55, glide: 0.2, t, a: 0.002, d: 0.28, peak: 0.22 });
  noiseHit(A, out, { t, d: 0.03, peak: 0.05, type: 'bandpass', f: 1200 });
}

function crash(A, dest, t) {
  const out = strip(A, { pan: 0.3, bus: dest, rev: 0.4, t, dur: 2.5 });
  noiseHit(A, out, { t, a: 0.003, d: 1.9, peak: 0.09, type: 'highpass', f: 4500, q: 0.4 });
  noiseHit(A, out, { t, a: 0.002, d: 0.9, peak: 0.05, type: 'bandpass', f: 7400, q: 6 });
}
