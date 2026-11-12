// Boot: wire the world, the light pass, the glass shader, audio and UI into one loop.
(function boot() {
  const canvas = document.getElementById('switch');
  const stage = document.getElementById('stage');
  let glass = null;
  try {
    glass = createGlass(canvas);
  } catch (err) {
    console.error(err);
  }
  if (!glass) {
    canvas.hidden = true;
    document.getElementById('fallback').hidden = false;
    return;
  }

  const S = createWorld();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  S.reducedMotion = reduced.matches;
  reduced.addEventListener('change', (e) => (S.reducedMotion = e.matches));

  const F = createFrame();
  const B = createShadeBuffers();
  const rail = new Uint8Array(W * H * 4);
  const full = new Uint8Array(W * H * 4);
  const audio = createAudio(S);
  createInput(canvas, glass, S, F, audio);
  const updateReadouts = createReadouts(S, canvas);

  const soundBtn = document.getElementById('sound');
  soundBtn.addEventListener('click', () => {
    audio.unlock();
    audio.setEnabled(!audio.enabled);
    soundBtn.textContent = audio.enabled ? 'Sound on' : 'Sound off';
    soundBtn.setAttribute('aria-pressed', String(audio.enabled));
  });

  const fit = () => glass.resize(Math.min(stage.clientWidth, 1000));
  new ResizeObserver(fit).observe(stage);
  fit();

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    document.getElementById('fallback').textContent = 'The WebGL context was lost. Reload the page to continue.';
    document.getElementById('fallback').hidden = false;
  });

  function render() {
    drawScene(F, S);
    computeLevels(S);
    const lights = buildLights(S);
    const shape = knobShape(S.knob);
    const flash = S.flash * (S.reducedMotion ? 0.2 : 0.55);
    const dir = S.knob.v < -20 ? -1 : 1;
    const rim = { x: dir > 0 ? S.knob.x - shape.hw : S.knob.x + shape.hw, dir, k: 0.45 + Math.min(0.5, Math.abs(S.knob.v) / 300) };
    shade(F, lights, { levels: S.levels.rail, ambient: S.ambient, flash, rim, hover: S.hover }, B, rail);
    shade(F, lights, { levels: S.levels.full, ambient: S.ambient, flash, rim: null, hover: 0 }, B, full);
    glass.draw(rail, full, shape, S.night);
  }

  const STEP = 1 / 60;
  let acc = 0;
  let last = performance.now();
  let frozen = false; // debug: the test hook drives the sim itself
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      if (!frozen) stepWorld(S, STEP);
      acc -= STEP;
    }
    render();
    audio.update();
    updateReadouts();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Test hook (only with ?debug): jump the evening, fire events, step the sim deterministically.
  if (new URLSearchParams(location.search).has('debug')) {
    window.NCS = {
      S,
      freeze(on = true) {
        frozen = on;
      },
      seek(t) {
        const x = knobX(t);
        S.knob.x = S.knob.target = x;
        S.knob.v = 0;
        S.car.x = x;
        S.car.v = 0;
      },
      step(seconds) {
        for (let i = 0; i < Math.round(seconds * 60); i++) stepWorld(S, STEP);
        render();
      },
      tap(id, x, y) {
        handleTap(S, id, x, y);
      },
      tapCar() {
        tapCar(S);
      },
      // The rail or full-lit scene as a PNG data URL, scaled up with nearest sampling.
      raw(which = 'rail', zoom = 6) {
        const src = which === 'full' ? full : rail;
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(src), W, H), 0, 0);
        const z = document.createElement('canvas');
        z.width = W * zoom;
        z.height = H * zoom;
        const g = z.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.drawImage(c, 0, 0, z.width, z.height);
        return z.toDataURL('image/png');
      },
      audio,
      ID,
    };
  }
})();
