// Pointer and keyboard. Touches on the knob always mean the car.
const KEY_STEP = (KNOB_MAX - KNOB_MIN) / 20;
const TAP_SLOP = 3; // scene px

function insideTrack(x, y) {
  const r = H / 2;
  const qx = Math.max(0, Math.abs(x - W / 2) - (W / 2 - r));
  const qy = Math.max(0, Math.abs(y - H / 2) - (H / 2 - r));
  return Math.hypot(qx, qy) <= r;
}

function sceneIdAt(F, x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= W || iy >= H || !insideTrack(x, y)) return ID.NONE;
  return F.id[iy * W + ix];
}

function createInput(canvas, glass, S, F, audio) {
  let drag = null;

  const scenePoint = (e) => {
    const r = canvas.getBoundingClientRect();
    return glass.toScene(e.clientX - r.left, e.clientY - r.top);
  };

  const setTarget = (x) => {
    S.knob.target = clamp(x, KNOB_MIN, KNOB_MAX);
  };

  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock();
    const p = scenePoint(e);
    const onKnob = insideKnob(S.knob, p.x, p.y);
    if (!onKnob && !insideTrack(p.x, p.y)) return;
    canvas.setPointerCapture(e.pointerId);
    canvas.focus({ preventScroll: true }); // preventDefault below would otherwise block focus
    drag = { id: e.pointerId, knob: onKnob, x0: p.x, y0: p.y, moved: false, offset: S.knob.x - p.x };
    if (onKnob) {
      S.knob.grabbed = true;
      S.bus.emit('sfx', { name: 'hinge', x: S.knob.x });
    }
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = scenePoint(e);
    if (drag && drag.id === e.pointerId) {
      if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > TAP_SLOP) drag.moved = true;
      if (drag.knob) setTarget(p.x + drag.offset);
      return;
    }
    const onKnob = insideKnob(S.knob, p.x, p.y);
    const id = onKnob ? ID.NONE : sceneIdAt(F, p.x, p.y);
    S.hover = id;
    canvas.style.cursor = onKnob ? 'grab' : tappable(id) ? 'pointer' : 'default';
  });

  const end = (e, cancelled) => {
    if (!drag || drag.id !== e.pointerId) return;
    const p = scenePoint(e);
    if (drag.knob) {
      S.knob.grabbed = false;
      if (!drag.moved && !cancelled) tapCar(S);
    } else if (!drag.moved && !cancelled) {
      const id = sceneIdAt(F, p.x, p.y);
      if (tappable(id)) handleTap(S, id, p.x, p.y);
    }
    drag = null;
  };
  canvas.addEventListener('pointerup', (e) => end(e, false));
  canvas.addEventListener('pointercancel', (e) => end(e, true));
  canvas.addEventListener('pointerleave', () => {
    if (!drag) S.hover = ID.NONE;
  });

  canvas.addEventListener('keydown', (e) => {
    const k = S.knob;
    let handled = true;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        setTarget(k.target + KEY_STEP * (e.shiftKey ? 4 : 1));
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        setTarget(k.target - KEY_STEP * (e.shiftKey ? 4 : 1));
        break;
      case 'PageUp':
        setTarget(k.target + KEY_STEP * 4);
        break;
      case 'PageDown':
        setTarget(k.target - KEY_STEP * 4);
        break;
      case 'Home':
        setTarget(KNOB_MIN);
        break;
      case 'End':
        setTarget(KNOB_MAX);
        break;
      case 'Enter':
      case ' ':
        setTarget(knobT(k.target) < 0.5 ? KNOB_MAX : KNOB_MIN);
        S.bus.emit('sfx', { name: 'honk', x: S.car.x });
        S.bus.emit('sfx', { name: 'honk', x: S.car.x, delay: 0.22 });
        break;
      default:
        handled = false;
    }
    if (handled) {
      audio.unlock();
      resetIdle(S);
      e.preventDefault();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== 'h' && e.key !== 'H') return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    audio.unlock();
    tapCar(S);
  });
}
