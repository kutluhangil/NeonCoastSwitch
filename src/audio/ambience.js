// Layer 1, the coast: surf swells, gulls by day, a city hum at night.

function startAmbience(A) {
  const ctx = A.ctx;
  // Surf: filtered noise swelling on a slow LFO, from the beach side.
  const surf = noiseLoop(A, 0.6);
  const sf = ctx.createBiquadFilter();
  sf.type = 'lowpass';
  sf.frequency.value = 700;
  A.surfGain = ctx.createGain();
  A.surfGain.gain.value = 0.05;
  const swell = ctx.createOscillator();
  swell.frequency.value = 0.13;
  const swellDepth = ctx.createGain();
  swellDepth.gain.value = 0.045;
  swell.connect(swellDepth);
  swellDepth.connect(A.surfGain.gain);
  swell.start();
  const sp = ctx.createStereoPanner();
  sp.pan.value = -0.6;
  A.surfLevel = ctx.createGain();
  surf.connect(sf);
  sf.connect(A.surfGain);
  A.surfGain.connect(sp);
  sp.connect(A.surfLevel);
  A.surfLevel.connect(A.music);

  // City hum: low rumble plus a faint mains tone, rising with the night.
  const hum = noiseLoop(A, 0.3);
  const hf = ctx.createBiquadFilter();
  hf.type = 'lowpass';
  hf.frequency.value = 180;
  A.humGain = ctx.createGain();
  A.humGain.gain.value = 0;
  hum.connect(hf);
  hf.connect(A.humGain);
  const mains = ctx.createOscillator();
  mains.frequency.value = 55;
  const mg = ctx.createGain();
  mg.gain.value = 0.12;
  mains.connect(mg);
  mg.connect(A.humGain);
  mains.start();
  const hp = ctx.createStereoPanner();
  hp.pan.value = 0.4;
  A.humGain.connect(hp);
  hp.connect(A.music);

  A.nextGull = ctx.currentTime + 2;
}

function updateAmbience(A, S) {
  const ctx = A.ctx;
  const day = 1 - smooth(0.35, 0.5, S.t);
  setSmooth(A.surfLevel.gain, lerp(1, 0.6, S.night), ctx, 0.4);
  setSmooth(A.humGain.gain, S.night * 0.22, ctx, 0.5);
  if (day > 0.05 && ctx.currentTime > A.nextGull) {
    A.nextGull = ctx.currentTime + 3 + Math.random() * 5;
    const out = strip(A, { pan: -0.4 - Math.random() * 0.5, bus: A.music, rev: 0.3, dur: 1.2 });
    const g = ctx.createGain();
    g.gain.value = day * 0.7;
    g.connect(out);
    gullCry(A, g, ctx.currentTime + 0.02);
  }
}
