// Sound effects. One-shots are triggered by world events; loops (engine, siren,
// helicopter, skates, alarm) follow the world state every frame.

function horn(A, out, t, f, dur, peak = 0.12) {
  for (const [hz, type] of [[f, 'sawtooth'], [f * 1.26, 'square']]) tone(A, out, { type, f0: hz, t, a: 0.01, hold: dur, d: 0.06, peak, filter: { f: 1800, q: 1.5 } });
}

function bark(A, out, t, k = 1) {
  tone(A, out, { type: 'sawtooth', f0: 520 * k, f1: 330 * k, glide: 0.09, t, a: 0.004, d: 0.12, peak: 0.2, filter: { type: 'bandpass', f: 1100, q: 2.5 } });
  noiseHit(A, out, { t, d: 0.06, peak: 0.08, type: 'bandpass', f: 1400, q: 1.5 });
}

function yip(A, out, t) {
  tone(A, out, { type: 'triangle', f0: 900, f1: 1500, glide: 0.06, t, a: 0.003, d: 0.08, peak: 0.16, filter: { type: 'bandpass', f: 1500, q: 2 } });
}

function meow(A, out, t) {
  const ctx = A.ctx;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(480, t);
  o.frequency.linearRampToValueAtTime(820, t + 0.18);
  o.frequency.linearRampToValueAtTime(430, t + 0.5);
  const f1 = ctx.createBiquadFilter();
  f1.type = 'bandpass';
  f1.Q.value = 6;
  f1.frequency.setValueAtTime(700, t);
  f1.frequency.linearRampToValueAtTime(1300, t + 0.2);
  f1.frequency.linearRampToValueAtTime(800, t + 0.5);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.28, t + 0.04);
  g.gain.setValueAtTime(0.28, t + 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  o.connect(f1);
  f1.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + 0.6);
}

// Voice-like formant blip through a "wall" (muffled).
function voice(A, out, t, f0, f1, dur, formant, peak) {
  const ctx = A.ctx;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.linearRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.03);
  g.gain.setValueAtTime(peak, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  for (const fr of formant) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = fr;
    bp.Q.value = 4;
    node.connect(bp);
    node = bp;
  }
  node.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function knock(A, out, t, glass) {
  noiseHit(A, out, { t, d: 0.03, peak: 0.25, type: 'bandpass', f: glass ? 3200 : 1600, q: 2 });
  tone(A, out, { type: 'sine', f0: glass ? 1150 : 140, f1: glass ? 980 : 80, t, a: 0.002, d: glass ? 0.07 : 0.14, peak: glass ? 0.12 : 0.35 });
}

function bellTone(A, out, t, hz, dur, peak) {
  for (const [ratio, k] of [[1, 1], [2.76, 0.4], [5.4, 0.2]]) tone(A, out, { type: 'sine', f0: hz * ratio, t, a: 0.002, d: dur / ratio, peak: peak * k });
}

function duckMusic(A, t, depth = 0.25) {
  const g = A.duck.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(depth, t + 0.01);
  g.setTargetAtTime(1, t + 0.08, 0.25);
}

function playSfx(A, S, e) {
  const ctx = A.ctx;
  const t = ctx.currentTime + (e.delay || 0) + 0.005;
  const x = e.x === undefined ? W / 2 : e.x;
  const out = (o = {}) => strip(A, { x, t, ...o });
  switch (e.name) {
    case 'hinge': {
      // Aviator hinge clicks when the knob is grabbed.
      const o = out({ dur: 0.2 });
      noiseHit(A, o, { t, d: 0.012, peak: 0.25, type: 'highpass', f: 4200, q: 1 });
      noiseHit(A, o, { t: t + 0.045, d: 0.01, peak: 0.18, type: 'bandpass', f: 2300, q: 3 });
      tone(A, o, { type: 'square', f0: 3100, t: t + 0.045, d: 0.012, peak: 0.03 });
      break;
    }
    case 'honk':
      horn(A, out({ rev: 0.15, dur: 0.5 }), t, 410, 0.22);
      break;
    case 'longHonk':
      horn(A, out({ rev: 0.15, dur: 1.4 }), t, 410, 0.95, 0.11);
      break;
    case 'hop': {
      const o = out({ dur: 1.4, rev: 0.1 });
      noiseHit(A, o, { t, a: 0.01, d: 0.45, peak: 0.22, type: 'highpass', f: 3000, f1: 6000 }); // air hiss
      tone(A, o, { type: 'sine', f0: 120, f1: 50, t: t + 0.03, d: 0.18, peak: 0.45 }); // clunk
      noiseHit(A, o, { t: t + 0.03, d: 0.05, peak: 0.2, type: 'lowpass', f: 900 });
      break;
    }
    case 'squeak': {
      const o = out({ dur: 0.3 });
      tone(A, o, { type: 'triangle', f0: 1700, f1: 2500, glide: 0.08, t, a: 0.01, d: 0.12, peak: 0.07 * (0.4 + (e.k || 1)) });
      break;
    }
    case 'squeal': {
      const o = out({ dur: 0.9, rev: 0.12 });
      const k = e.k || 1;
      noiseHit(A, o, { t, a: 0.02, hold: 0.25, d: 0.35, peak: 0.16 * k, type: 'bandpass', f: 2600, q: 9 });
      tone(A, o, { type: 'sawtooth', f0: 1850, f1: 1500, glide: 0.6, t, a: 0.02, hold: 0.25, d: 0.35, peak: 0.04 * k, filter: { type: 'bandpass', f: 1800, q: 6 } });
      break;
    }
    case 'neonOn': {
      // Neon crackling and buzzing on.
      const o = out({ dur: 1 });
      for (let i = 0; i < 5; i++) noiseHit(A, o, { t: t + Math.random() * 0.35, d: 0.015, peak: 0.12, type: 'highpass', f: 3500 });
      tone(A, o, { type: 'sawtooth', f0: 120, t: t + 0.2, a: 0.02, hold: 0.35, d: 0.25, peak: 0.035, filter: { f: 900 } });
      break;
    }
    case 'lampOn': {
      const o = out({ dur: 1 });
      noiseHit(A, o, { t, d: 0.01, peak: 0.18, type: 'highpass', f: 5000 });
      noiseHit(A, o, { t: t + 0.07, d: 0.008, peak: 0.1, type: 'highpass', f: 5000 });
      tone(A, o, { type: 'sine', f0: 100, t: t + 0.05, a: 0.1, hold: 0.2, d: 0.4, peak: 0.025 });
      break;
    }
    case 'pass': {
      // Passing car: panned sweep with a doppler drop.
      const ctx2 = A.ctx;
      const g = ctx2.createGain();
      const p = ctx2.createStereoPanner();
      p.pan.setValueAtTime(0.85, t);
      p.pan.linearRampToValueAtTime(-0.85, t + 0.9);
      g.connect(p);
      p.connect(A.sfx);
      const f = e.kind === 'van' ? 85 : 110;
      tone(A, g, { type: 'sawtooth', f0: f * 1.12, f1: f * 0.86, glide: 0.9, t, a: 0.25, d: 0.65, peak: 0.06, filter: { f: 700 } });
      noiseHit(A, g, { t, a: 0.3, d: 0.6, peak: 0.1, type: 'bandpass', f: 900, f1: 500, q: 0.8 });
      setTimeout(() => g.disconnect(), (t - ctx2.currentTime + 1.5) * 1000);
      break;
    }
    case 'bark':
      bark(A, out({ rev: 0.15, dur: 0.4 }), t);
      break;
    case 'yip':
      yip(A, out({ dur: 0.3 }), t);
      break;
    case 'meow':
      meow(A, out({ rev: 0.1, dur: 0.8 }), t);
      break;
    case 'rustle': {
      const o = out({ dur: 1.2 });
      for (let i = 0; i < 8; i++) noiseHit(A, o, { t: t + i * 0.1 + Math.random() * 0.05, a: 0.02, d: 0.12, peak: 0.07, type: 'bandpass', f: 3000 + Math.random() * 2500, q: 1.2 });
      break;
    }
    case 'coconut': {
      // Hollow knock on the pavement.
      const o = out({ rev: 0.2, dur: 0.4 });
      const k = e.k || 1;
      tone(A, o, { type: 'sine', f0: 320, t, a: 0.002, d: 0.12, peak: 0.3 * k });
      tone(A, o, { type: 'sine', f0: 520, t, a: 0.002, d: 0.06, peak: 0.12 * k });
      noiseHit(A, o, { t, d: 0.02, peak: 0.1 * k, type: 'bandpass', f: 900, q: 2 });
      break;
    }
    case 'bonk': {
      const o = out({ rev: 0.15, dur: 1.4 });
      tone(A, o, { type: 'square', f0: 820, f1: 260, glide: 0.12, t, a: 0.002, d: 0.14, peak: 0.12, filter: { f: 2500 } });
      knock(A, o, t, false);
      // boing
      const ctx2 = A.ctx;
      const b = ctx2.createOscillator();
      const lfo = ctx2.createOscillator();
      const lg = ctx2.createGain();
      const g = ctx2.createGain();
      b.type = 'sine';
      b.frequency.setValueAtTime(180, t + 0.12);
      b.frequency.exponentialRampToValueAtTime(520, t + 0.7);
      lfo.frequency.value = 14;
      lg.gain.setValueAtTime(60, t + 0.12);
      lg.gain.exponentialRampToValueAtTime(4, t + 0.75);
      lfo.connect(lg);
      lg.connect(b.frequency);
      g.gain.setValueAtTime(0.0001, t + 0.12);
      g.gain.linearRampToValueAtTime(0.18, t + 0.14);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      b.connect(g);
      g.connect(o);
      b.start(t + 0.12);
      lfo.start(t + 0.12);
      b.stop(t + 0.85);
      lfo.stop(t + 0.85);
      tone(A, o, { type: 'triangle', f0: 1300, f1: 1900, glide: 0.07, t: t + 0.25, a: 0.004, d: 0.18, peak: 0.12, filter: { type: 'bandpass', f: 1600, q: 2 } }); // yelp
      break;
    }
    case 'knock3': {
      const o = out({ rev: 0.2, dur: 1 });
      for (let i = 0; i < 3; i++) knock(A, o, t + i * 0.18, true);
      break;
    }
    case 'hey':
      voice(A, out({ rev: 0.2, dur: 0.6 }), t, 230, 290, 0.32, [700, 1100], 0.9);
      break;
    case 'chime': {
      const o = out({ rev: 0.35, dur: 2 });
      bellTone(A, o, t, 1320, 0.9, 0.09);
      bellTone(A, o, t + 0.28, 990, 1.1, 0.09);
      noiseHit(A, o, { t: t + 0.05, a: 0.1, d: 0.5, peak: 0.05, type: 'bandpass', f: 1200, f1: 600, q: 0.8 }); // door slides
      break;
    }
    case 'orderBell':
      bellTone(A, out({ rev: 0.35, dur: 1.6 }), t, 2100, 1.3, 0.12);
      break;
    case 'seamClick':
      noiseHit(A, out({ dur: 0.1 }), { t, d: 0.008, peak: 0.1, type: 'highpass', f: 3800 });
      break;
    case 'slurp': {
      const o = out({ dur: 1.4 });
      for (let i = 0; i < 3; i++) noiseHit(A, o, { t: t + i * 0.32, a: 0.03, d: 0.22, peak: 0.12, type: 'bandpass', f: 600, f1: 1800, q: 6 });
      break;
    }
    case 'short': {
      // Neon shorting out: crackles and a stuttering buzz.
      const o = out({ rev: 0.1, dur: 1.6 });
      for (let i = 0; i < 12; i++) noiseHit(A, o, { t: t + Math.random() * 1.2, d: 0.01 + Math.random() * 0.02, peak: 0.16, type: 'highpass', f: 2500 + Math.random() * 3000 });
      for (let i = 0; i < 7; i++) tone(A, o, { type: 'sawtooth', f0: 120, t: t + i * 0.17 + Math.random() * 0.05, a: 0.003, hold: 0.05 + Math.random() * 0.06, d: 0.02, peak: 0.05, filter: { f: 1400 } });
      break;
    }
    case 'dolphin': {
      const o = out({ rev: 0.3, dur: 2.2 });
      noiseHit(A, o, { t, a: 0.005, d: 0.4, peak: 0.25, type: 'lowpass', f: 1600, f1: 400 });
      for (let i = 0; i < 10; i++) noiseHit(A, o, { t: t + 0.35 + i * 0.035, d: 0.006, peak: 0.12, type: 'bandpass', f: 4200, q: 4 });
      tone(A, o, { type: 'sine', f0: 2400, f1: 4300, glide: 0.35, t: t + 0.75, a: 0.03, d: 0.4, peak: 0.08 });
      noiseHit(A, o, { t: t + 1.45, a: 0.005, d: 0.45, peak: 0.22, type: 'lowpass', f: 1400, f1: 350 });
      break;
    }
    case 'whistle': {
      const ctx2 = A.ctx;
      const o = out({ rev: 0.3, dur: 1.2 });
      const w = ctx2.createOscillator();
      const tr = ctx2.createOscillator();
      const trg = ctx2.createGain();
      const g = ctx2.createGain();
      w.frequency.value = 2900;
      tr.frequency.value = 28;
      trg.gain.value = 180;
      tr.connect(trg);
      trg.connect(w.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.03);
      g.gain.setValueAtTime(0.09, t + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
      w.connect(g);
      g.connect(o);
      w.start(t);
      tr.start(t);
      w.stop(t + 0.9);
      tr.stop(t + 0.9);
      for (let i = 0; i < 6; i++) noiseHit(A, o, { t: t + 0.2 + i * 0.09, d: 0.05, peak: 0.05, type: 'bandpass', f: 900, q: 1 }); // flag flaps
      break;
    }
    case 'carHonk':
      horn(A, out({ rev: 0.15, dur: 0.6 }), t, 330 * (e.pitch || 1), 0.28, 0.08);
      break;
    case 'bullhorn': {
      const o = out({ rev: 0.25, dur: 1 });
      tone(A, o, { type: 'square', f0: 700, f1: 1400, glide: 0.25, t, a: 0.01, hold: 0.25, d: 0.15, peak: 0.07, filter: { type: 'bandpass', f: 1200, q: 2 } });
      tone(A, o, { type: 'square', f0: 1400, f1: 700, glide: 0.25, t: t + 0.42, a: 0.01, hold: 0.15, d: 0.1, peak: 0.06, filter: { type: 'bandpass', f: 1200, q: 2 } });
      break;
    }
    case 'radio': {
      // Radio chatter: band-limited syllables between squelch beeps.
      const o = out({ dur: 1.6 });
      noiseHit(A, o, { t, d: 0.08, peak: 0.1, type: 'bandpass', f: 2500, q: 1 });
      for (let i = 0; i < 6; i++) voice(A, o, t + 0.1 + i * 0.14, 180 + Math.random() * 90, 200 + Math.random() * 90, 0.12, [900, 1500], 0.6);
      tone(A, o, { type: 'sine', f0: 1700, t: t + 1, d: 0.06, peak: 0.05 });
      break;
    }
    case 'squelch': {
      const o = out({ dur: 0.6 });
      noiseHit(A, o, { t, a: 0.002, hold: 0.18, d: 0.03, peak: 0.13, type: 'bandpass', f: 2200, q: 0.8, cut: true });
      tone(A, o, { type: 'sine', f0: 1500, t: t + 0.22, d: 0.07, peak: 0.06 });
      break;
    }
    case 'shootingStar': {
      const o = out({ rev: 0.5, echo: 0.4, dur: 2 });
      [76, 81, 84, 88].forEach((m, i) => bellTone(A, o, t + i * 0.09, midiHz(m), 1.2, 0.05));
      break;
    }
    case 'gull':
      gullCry(A, out({ rev: 0.2, dur: 1.2 }), t);
      break;
    case 'drum':
      knock(A, out({ dur: 0.3 }), t, false);
      if (e.hard) noiseHit(A, out({ dur: 0.2 }), { t, d: 0.05, peak: 0.12, type: 'bandpass', f: 1200, q: 1 });
      break;
    case 'glass': {
      const o = out({ rev: 0.35, dur: 1.4 });
      noiseHit(A, o, { t, d: 0.25, peak: 0.35, type: 'highpass', f: 3000 });
      for (let i = 0; i < 14; i++) tone(A, o, { type: 'sine', f0: 2500 + Math.random() * 4000, t: t + 0.03 + Math.random() * 0.7, a: 0.001, d: 0.12, peak: 0.04 });
      break;
    }
    case 'shot': {
      // Crack, thump, and echoes off the buildings; the music ducks under it.
      const o = out({ dur: 0.6 });
      noiseHit(A, o, { t, a: 0.0005, d: 0.05, peak: 0.6, type: 'highpass', f: 1800 });
      tone(A, o, { type: 'sine', f0: 140, f1: 45, glide: 0.12, t, a: 0.001, d: 0.16, peak: 0.6 });
      const away = e.side === 'robber' ? 0.7 : -0.7;
      for (const [dt, k, f] of [[0.11, 0.22, 1600], [0.24, 0.12, 1100], [0.4, 0.06, 800]]) {
        const ec = strip(A, { pan: away * (dt > 0.2 ? -1 : 1), t: t + dt, dur: 0.4 });
        noiseHit(A, ec, { t: t + dt, a: 0.002, d: 0.12, peak: k, type: 'lowpass', f });
      }
      duckMusic(A, t);
      break;
    }
    case 'ricochet': {
      const o = out({ rev: 0.2, dur: 0.6 });
      tone(A, o, { type: 'sine', f0: 3200, f1: 900, glide: 0.35, t, a: 0.002, d: 0.38, peak: 0.08 });
      noiseHit(A, o, { t, d: 0.03, peak: 0.12, type: 'highpass', f: 4000 });
      break;
    }
    case 'roar': {
      const o = out({ rev: 0.15, dur: 2 });
      const k = e.k || 1;
      tone(A, o, { type: 'sawtooth', f0: 55, f1: 160, glide: 1.4, t, a: 0.05, hold: 0.6, d: 0.8, peak: 0.16 * k, filter: { f: 600, f1: 1400, q: 2 } });
      tone(A, o, { type: 'square', f0: 27, f1: 80, glide: 1.4, t, a: 0.05, hold: 0.6, d: 0.8, peak: 0.1 * k, filter: { f: 300 } });
      break;
    }
    case 'policeIn':
      tone(A, out({ dur: 0.5 }), { type: 'square', f0: 900, f1: 1500, glide: 0.18, t, a: 0.005, d: 0.2, peak: 0.05, filter: { f: 2000 } });
      break;
    case 'alarm':
      A.alarmOn = !!e.on;
      if (e.x !== undefined) A.alarmX = e.x;
      break;
    case 'skates':
      A.skating = !!e.on;
      break;
  }
}

function gullCry(A, out, t) {
  for (let i = 0; i < 3; i++) {
    const t0 = t + i * 0.22;
    tone(A, out, { type: 'triangle', f0: 1350, f1: 880, glide: 0.18, t: t0, a: 0.01, d: 0.18, peak: 0.07, filter: { type: 'bandpass', f: 1500, q: 3 } });
  }
}

// ---- continuous loops

function loopVoice(A, build) {
  const ctx = A.ctx;
  const g = ctx.createGain();
  g.gain.value = 0;
  const p = ctx.createStereoPanner();
  g.connect(p);
  p.connect(A.sfx);
  build(g);
  return { g, p };
}

function startLoops(A) {
  const ctx = A.ctx;
  // Engine climbing through its gears.
  A.engine = loopVoice(A, (g) => {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    f.Q.value = 3;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o1.connect(f);
    o2.connect(f);
    f.connect(g);
    o1.start();
    o2.start();
    A.engineOsc = [o1, o2];
    A.engineFilter = f;
  });
  // Siren: wail / yelp, panned to the police car.
  A.siren = loopVoice(A, (g) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2200;
    o.connect(f);
    f.connect(g);
    o.start();
    A.sirenOsc = o;
  });
  // Helicopter blade slap: noise gated by a 12 Hz pulse.
  A.heli = loopVoice(A, (g) => {
    const n = noiseLoop(A, 0.7);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 160;
    f.Q.value = 0.9;
    const slap = ctx.createGain();
    slap.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 12;
    const lg = ctx.createGain();
    lg.gain.value = 0.5;
    lfo.connect(lg);
    lg.connect(slap.gain);
    const dc = ctx.createConstantSource();
    dc.offset.value = 0.5;
    dc.connect(slap.gain);
    n.connect(f);
    f.connect(slap);
    slap.connect(g);
    lfo.start();
    dc.start();
  });
  // Carhop's wheel rumble.
  A.skates = loopVoice(A, (g) => {
    const n = noiseLoop(A, 0.5);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    n.connect(f);
    f.connect(g);
  });
  // Store alarm bell: a trilled ring.
  A.alarm = loopVoice(A, (g) => {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = 1180;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2000;
    f.Q.value = 1.5;
    const am = ctx.createGain();
    am.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 19;
    const lg = ctx.createGain();
    lg.gain.value = 0.5;
    const dc = ctx.createConstantSource();
    dc.offset.value = 0.5;
    lfo.connect(lg);
    lg.connect(am.gain);
    dc.connect(am.gain);
    o.connect(f);
    f.connect(am);
    am.connect(g);
    o.start();
    lfo.start();
    dc.start();
  });
}

const GEARS = [0, 22, 42, 64, 90, 120];

function updateLoops(A, S) {
  const ctx = A.ctx;
  const c = S.car;
  const mph = Math.abs(c.v) * PX_TO_MPH;
  let gear = 0;
  while (gear < GEARS.length - 1 && mph > GEARS[gear + 1]) gear++;
  const lo = GEARS[gear];
  const hi = GEARS[gear + 1] || 140;
  const rpm = 0.22 + 0.78 * clamp((mph - lo) / (hi - lo), 0, 1);
  const throttle = clamp(Math.abs(c.a) / 500, 0, 1) * (c.a * c.v >= 0 ? 1 : 0.3);
  const base = 38 + rpm * 95 + gear * 6;
  setSmooth(A.engineOsc[0].frequency, base, ctx, 0.04);
  setSmooth(A.engineOsc[1].frequency, base * 0.5, ctx, 0.04);
  setSmooth(A.engineFilter.frequency, 300 + rpm * 900 + throttle * 600, ctx, 0.05);
  setSmooth(A.engine.g.gain, 0.025 + rpm * 0.03 * (mph > 1 ? 1 : 0.4) + throttle * 0.05, ctx, 0.06);
  setSmooth(A.engine.p.pan, panOf(c.x), ctx, 0.05);

  // Siren follows whichever police car is active.
  const h = S.holdup;
  let sirenX = null;
  if (S.police.state !== 'off') sirenX = S.police.x;
  else if (holdupSirenOn(h)) sirenX = h.px;
  if (sirenX !== null) {
    // Wail for six seconds, then yelp for three.
    const cyc = S.time % 9;
    const f = cyc < 6 ? 640 + 560 * (0.5 - 0.5 * Math.cos((cyc / 3) * TAU)) : 700 + 600 * ((cyc / 0.31) % 1);
    setSmooth(A.sirenOsc.frequency, f, ctx, 0.02);
    const inView = sirenX > -20 && sirenX < W + 20 ? 1 : 0.4;
    setSmooth(A.siren.g.gain, 0.045 * inView, ctx, 0.1);
    setSmooth(A.siren.p.pan, panOf(sirenX), ctx, 0.08);
  } else setSmooth(A.siren.g.gain, 0, ctx, 0.3);

  const Hh = S.heli;
  setSmooth(A.heli.g.gain, Hh.state === 'in' ? 0.13 : 0, ctx, 0.5);
  setSmooth(A.heli.p.pan, panOf(Hh.x), ctx, 0.2);

  setSmooth(A.skates.g.gain, A.skating && S.carhop.state !== 'idle' ? 0.07 : 0, ctx, 0.08);
  setSmooth(A.skates.p.pan, panOf(S.carhop.x), ctx, 0.08);

  const ring = A.alarmOn && h.alarm > 0;
  setSmooth(A.alarm.g.gain, ring ? 0.04 : 0, ctx, 0.05);
  setSmooth(A.alarm.p.pan, panOf(A.alarmX || STORE.x), ctx, 0.1);
}
