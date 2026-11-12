// Web Audio graph and helpers. Everything is synthesised live; no samples.
// sfx bus ─┐
// music ─ duck ─┼─ compressor ─ master ─ out      (music ≈ 5 dB under the effects)
// reverb / dotted-eighth echo sends ─┘
const BPM = 100;
const STEP_SEC = 60 / BPM / 4; // sixteenth
const MUSIC_LEVEL = 0.4; // measured: keeps the music ≈5 dB under the effects (scripts/audio-check.mjs)

const panOf = (x) => clamp((x / W) * 2 - 1, -1, 1) * 0.85;
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeNoise(ctx, seconds) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function makeImpulse(ctx, seconds, decay, bright = 1) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const n = Math.random() * 2 - 1;
      lp += (n - lp) * bright;
      d[i] = lp * Math.pow(1 - i / len, decay);
    }
  }
  return b;
}

function buildGraph(ctx) {
  const A = { ctx };
  A.out = ctx.createGain();
  A.out.connect(ctx.destination);
  A.comp = ctx.createDynamicsCompressor();
  A.comp.threshold.value = -14;
  A.comp.knee.value = 10;
  A.comp.ratio.value = 4;
  A.comp.attack.value = 0.004;
  A.comp.release.value = 0.22;
  A.comp.connect(A.out);

  A.sfx = ctx.createGain();
  A.sfx.connect(A.comp);
  A.duck = ctx.createGain();
  A.duck.connect(A.comp);
  A.music = ctx.createGain();
  A.music.gain.value = MUSIC_LEVEL;
  A.music.connect(A.duck);

  A.reverb = ctx.createConvolver();
  A.reverb.buffer = makeImpulse(ctx, 2.4, 3.2, 0.5);
  A.revOut = ctx.createGain();
  A.revOut.gain.value = 0.32;
  A.reverb.connect(A.revOut);
  A.revOut.connect(A.comp);
  A.revSend = ctx.createGain();
  A.revSend.connect(A.reverb);

  // Dotted-eighth echo (0.45 s at 100 BPM) with a darkening feedback loop.
  A.echo = ctx.createDelay(1.5);
  A.echo.delayTime.value = STEP_SEC * 3;
  const fb = ctx.createGain();
  fb.gain.value = 0.34;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3200;
  A.echo.connect(lp);
  lp.connect(fb);
  fb.connect(A.echo);
  A.echoOut = ctx.createGain();
  A.echoOut.gain.value = 0.3;
  lp.connect(A.echoOut);
  A.echoOut.connect(A.comp);
  A.echoSend = ctx.createGain();
  A.echoSend.connect(A.echo);

  A.noise = makeNoise(ctx, 2);
  return A;
}

// Output strip for one sound: panner → bus, plus optional reverb/echo sends.
function strip(A, { x = W / 2, pan = null, bus = A.sfx, rev = 0, echo = 0, t = A.ctx.currentTime, dur = 2 } = {}) {
  const ctx = A.ctx;
  const g = ctx.createGain();
  const p = ctx.createStereoPanner();
  p.pan.value = pan === null ? panOf(x) : pan;
  g.connect(p);
  p.connect(bus);
  if (rev > 0) {
    const s = ctx.createGain();
    s.gain.value = rev;
    p.connect(s);
    s.connect(A.revSend);
  }
  if (echo > 0) {
    const s = ctx.createGain();
    s.gain.value = echo;
    p.connect(s);
    s.connect(A.echoSend);
  }
  // Let the graph collect the strip once its sound has ended.
  setTimeout(() => g.disconnect(), (t - ctx.currentTime + dur + 0.5) * 1000);
  return g;
}

// One enveloped oscillator with an optional pitch glide and filter.
function tone(A, dest, { type = 'sine', f0, f1 = null, glide = null, t, a = 0.005, hold = 0, d = 0.2, peak = 0.3, detune = 0, filter = null }) {
  const ctx = A.ctx;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + (glide || a + hold + d));
  o.detune.value = detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  if (hold > 0) g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
  let node = o;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = filter.type || 'lowpass';
    f.frequency.setValueAtTime(filter.f, t);
    if (filter.f1) f.frequency.exponentialRampToValueAtTime(filter.f1, t + a + hold + d);
    f.Q.value = filter.q || 0.7;
    o.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + a + hold + d + 0.05);
  return o;
}

// Enveloped filtered noise burst.
function noiseHit(A, dest, { t, a = 0.002, hold = 0, d = 0.15, peak = 0.3, type = 'bandpass', f = 2000, f1 = null, q = 1, rate = 1, cut = false }) {
  const ctx = A.ctx;
  const src = ctx.createBufferSource();
  src.buffer = A.noise;
  src.playbackRate.value = rate;
  const fl = ctx.createBiquadFilter();
  fl.type = type;
  fl.frequency.setValueAtTime(f, t);
  if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + a + hold + d);
  fl.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  if (hold > 0) g.gain.setValueAtTime(peak, t + a + hold);
  if (cut) g.gain.linearRampToValueAtTime(0, t + a + hold + 0.01);
  else g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
  src.connect(fl);
  fl.connect(g);
  g.connect(dest);
  const off = Math.random() * 1.5;
  src.start(t, off);
  src.stop(t + a + hold + d + 0.05);
  return src;
}

// A looping noise source for continuous textures.
function noiseLoop(A, rate = 1) {
  const src = A.ctx.createBufferSource();
  src.buffer = A.noise;
  src.loop = true;
  src.playbackRate.value = rate;
  src.start();
  return src;
}

const setSmooth = (param, value, ctx, tc = 0.05) => param.setTargetAtTime(value, ctx.currentTime, tc);

function createAudio(S) {
  let A = null;
  const api = { enabled: true, unlock, setEnabled, update, graph: () => A };

  S.bus.on('sfx', (e) => {
    if (!A || !api.enabled || A.ctx.state !== 'running') return;
    playSfx(A, S, e);
  });

  function unlock() {
    if (A) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC({ latencyHint: 'interactive' });
    A = buildGraph(ctx);
    A.out.gain.value = api.enabled ? 1 : 0;
    startMusic(A, S);
    startAmbience(A);
    startLoops(A);
    S.beatClock = () => musicBeat(A);
    if (ctx.state === 'suspended') ctx.resume();
  }

  function setEnabled(on) {
    api.enabled = on;
    if (A) setSmooth(A.out.gain, on ? 1 : 0, A.ctx, 0.04);
  }

  function update() {
    if (!A || A.ctx.state !== 'running') return;
    scheduleMusic(A, S);
    updateMusicMix(A, S);
    updateAmbience(A, S);
    updateLoops(A, S);
  }

  return api;
}
