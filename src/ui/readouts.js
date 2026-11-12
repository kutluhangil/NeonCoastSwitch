// Readouts (clock, speed, status), slider ARIA values and page colours that follow the evening.
const PAGE = {
  bg: [hex('#f6d3bf'), hex('#9a4f7e'), hex('#170b26')],
  ink: [hex('#3a2131'), hex('#fff0f4'), hex('#f3e6ff')],
};

const css = (c, a = 1) => `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${a})`;

function createReadouts(S, canvas) {
  const el = {
    clock: document.getElementById('clock'),
    speed: document.getElementById('speed'),
    status: document.getElementById('status'),
  };
  const root = document.documentElement.style;
  const last = {};
  const set = (key, value, apply) => {
    if (last[key] === value) return;
    last[key] = value;
    apply(value);
  };

  return function update() {
    const clock = clockText(S.t);
    set('clock', clock, (v) => (el.clock.textContent = v));
    set('speed', `${Math.round(Math.abs(S.car.v) * PX_TO_MPH)} mph`, (v) => (el.speed.textContent = v));
    set('status', S.status, (v) => (el.status.textContent = v));
    set('aria', Math.round(S.t * 100), (v) => {
      canvas.setAttribute('aria-valuenow', String(v));
      canvas.setAttribute('aria-valuetext', `${clock}, ${S.status}`);
    });
    const tq = Math.round(S.t * 200) / 200;
    set('theme', tq, (t) => {
      const bg = ramp3(PAGE.bg[0], PAGE.bg[1], PAGE.bg[2], t, 0.5);
      const ink = t < 0.38 ? PAGE.ink[0] : mixc(PAGE.ink[1], PAGE.ink[2], smooth(0.38, 1, t));
      root.setProperty('--bg', css(bg));
      root.setProperty('--ink', css(ink));
      root.setProperty('--muted', css(ink, 0.8));
      root.setProperty('--line', css(ink, 0.22));
    });
  };
}
