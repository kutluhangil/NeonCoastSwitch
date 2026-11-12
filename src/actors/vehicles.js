// Vehicle templates (drawn facing right) and tiny figures.
// b body · B lower body · k black · W white · g glass · c chrome · w tyre · h hub
// l headlight · t taillight · r/u red/blue light bar · y taxi sign
const CAR_TPL = {
  sedan: [
    '.......bbbbbbb........',
    '......bgggbgggb.......',
    '.....bggggbggggb......',
    'tbbbbbbbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbbbbbbbl',
    'BBBBBBBBBBBBBBBBBBBBBc',
    'cBBwwwBBBBBBBBBBwwwBBc',
    '...whw..........whw...',
  ],
  coupe: [
    '........bbbbb.......',
    '.......bggggbb......',
    '......bgggggggbb....',
    'tbbbbbbbbbbbbbbbbbbl',
    'BBBBBBBBBBBBBBBBBBBB',
    'cBBwwwBBBBBBBBwwwBBc',
    '...whw........whw...',
  ],
  van: [
    'bbbbbbbbbbbbbbbbb.....',
    'bggggbggggbggggbbgb...',
    'bggggbggggbggggbbggb..',
    'bbbbbbbbbbbbbbbbbbbbbb',
    'tbbbbbbbbbbbbbbbbbbbbl',
    'BBBBBBBBBBBBBBBBBBBBBB',
    'cBBwwwBBBBBBBBBBwwwBBc',
    '...whw..........whw...',
  ],
  taxi: [
    '.........yyy..........',
    '.......bbbbbbb........',
    '......bgggbgggb.......',
    '.....bggggbggggb......',
    'tbbbbbbbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbbbbbbbl',
    'BBBBBBBBBBBBBBBBBBBBBc',
    'cBBwwwBBBBBBBBBBwwwBBc',
    '...whw..........whw...',
  ],
  police: [
    '.........rruu.........',
    '.......kkkkkkk........',
    '......kgggkgggk.......',
    '.....kggggkggggk......',
    'tkkkkkWWWWWWWWWWkkkkkk',
    'kkkkkkWWWWWWWWWWkkkkkl',
    'kkkkkkWWWWWWWWWWkkkkkc',
    'ckkwwwkkkkkkkkkkwwwkkc',
    '...whw..........whw...',
  ],
  muscle: [
    '.........bbbbbb.........',
    '........bggggggb........',
    'kk.....bggggggggbb......',
    'tkbbbbbbbbbbbbbbbbkkkkkl',
    'bbbbbbbbbbbbbbbbbbkkkkkb',
    'cBwwwwBBBBBBBBBBBBwwwBBc',
    '..whhw............whw...',
  ],
};

const VEH_COLORS = {
  k: hex('#17141f'),
  W: hex('#f2f0ea'),
  g: hex('#2c3a5c'),
  c: hex('#cfd8e2'),
  w: hex('#141218'),
  h1: hex('#b9c2cc'),
  h2: hex('#4a4f5a'),
  l: hex('#fff3c4'),
  t: hex('#7a1f2a'),
  r: hex('#8a1f2a'),
  u: hex('#1f2f8a'),
  y: hex('#ffe066'),
};

const HEAD_LIGHT = hex('#fff2c2');
const TAIL_LIGHT = hex('#ff2a3a');
const BAR_RED = hex('#ff2440');
const BAR_BLUE = hex('#2f6bff');

// Draws a vehicle centred on cx with its wheels on groundY. Returns the box.
function drawVehicle(F, kind, body, cx, groundY, facing, o = {}) {
  const tpl = CAR_TPL[kind];
  const w = tpl[0].length;
  const h = tpl.length;
  const x0 = Math.round(cx - w / 2);
  const y0 = Math.round(groundY - h + 1 - (o.lift || 0));
  const lower = scalec(body, 0.78);
  const flip = facing < 0;
  const wheel = o.wheel || 0;
  sprite(
    F,
    x0,
    y0,
    w,
    h,
    (lx, ly) => {
      const ch = tpl[ly][lx];
      if (ch === '.') return null;
      if (ch === 'b') return body;
      if (ch === 'B') return lower;
      if (ch === 'h') return (Math.floor(wheel) + lx) % 2 === 0 ? VEH_COLORS.h1 : VEH_COLORS.h2;
      if (ch === 'k' && kind === 'muscle') return VEH_COLORS.k;
      return VEH_COLORS[ch] || body;
    },
    { flip },
  );
  for (let ly = 0; ly < h; ly++)
    for (let lx = 0; lx < w; lx++) {
      const ch = tpl[ly][lx];
      const X = x0 + (flip ? w - 1 - lx : lx);
      const Y = y0 + ly;
      if (ch === 'l' && (o.lights || o.flash > 0)) glow(F, X, Y, HEAD_LIGHT, o.flash > 0 ? 2.2 : 1.4);
      else if (ch === 't' && (o.lights || o.brake)) glow(F, X, Y, TAIL_LIGHT, o.brake ? 1.6 : 0.8);
      else if ((ch === 'r' || ch === 'u') && o.bar) {
        const redOn = Math.sin(o.bar * TAU) > 0;
        const on = ch === 'r' ? redOn : !redOn;
        if (on) glow(F, X, Y, ch === 'r' ? BAR_RED : BAR_BLUE, 2);
      }
    }
  return { x0, y0, w, h, front: flip ? x0 - 1 : x0 + w, rear: flip ? x0 + w : x0 - 1 };
}

// Tiny people, about 6 px tall. pose: stand | run | crouch | aim
const FIG_STYLE = {
  robber: { head: hex('#16131c'), skin: hex('#c48a62'), top: hex('#22b3a6'), legs: hex('#2c2a3a') },
  officer: { head: hex('#1d2f6b'), skin: hex('#b07a55'), top: hex('#2f57c9'), legs: hex('#1d2f6b') },
  carhop: { head: hex('#f2c14e'), skin: hex('#e2a57f'), top: hex('#ff7bb5'), legs: hex('#e2a57f') },
};

function drawFigure(F, kind, x, groundY, pose, facing, phase = 0, o = {}) {
  const st = FIG_STYLE[kind];
  const pts = [];
  const add = (lx, ly, c) => pts.push([facing < 0 ? 2 - lx : lx, ly, c]);
  if (pose === 'crouch') {
    add(1, 0, st.head);
    add(0, 1, st.top);
    add(1, 1, st.top);
    add(2, 1, st.top);
    add(0, 2, st.top);
    add(1, 2, st.top);
    add(0, 3, st.legs);
    add(2, 3, st.legs);
  } else {
    add(1, 0, st.head);
    add(1, 1, kind === 'robber' ? st.head : st.skin);
    add(0, 2, st.top);
    add(1, 2, st.top);
    add(2, 2, st.top);
    add(0, 3, st.top);
    add(1, 3, st.top);
    add(2, 3, st.top);
    if (kind === 'robber') add(2, 1, st.skin); // eye slit
    if (pose === 'run' && Math.floor(phase) % 2 === 0) {
      add(1, 4, st.legs);
      add(1, 5, st.legs);
    } else if (pose === 'run') {
      add(1, 4, st.legs);
      add(0, 5, st.legs);
      add(2, 5, st.legs);
    } else {
      add(0, 4, st.legs);
      add(2, 4, st.legs);
      add(0, 5, st.legs);
      add(2, 5, st.legs);
    }
    if (pose === 'aim') {
      add(3, 2, st.skin);
      add(4, 2, VEH_COLORS.k);
    }
    if (o.wave) add(Math.sin(phase * 3) > 0 ? 3 : 2, o.wave > 0 ? 1 : 2, st.skin);
  }
  if (o.sack) {
    const sx = facing < 0 ? 3 : -1;
    pts.push([sx, 2, hex('#c9b27a')], [sx, 3, hex('#b39a63')], [sx - Math.sign(facing), 3, hex('#b39a63')]);
  }
  if (o.skates) pts.push([0, 6, VEH_COLORS.k], [2, 6, VEH_COLORS.k]);
  if (o.shake) pts.push([facing < 0 ? -1 : 3, 1, hex('#ffd1e8')], [facing < 0 ? -1 : 3, 0, hex('#f05a9a')]);
  const h = pose === 'crouch' ? 4 : o.skates ? 7 : 6;
  const minX = Math.min(...pts.map((p) => p[0]));
  const maxX = Math.max(...pts.map((p) => p[0]));
  const grid = new Map(pts.map(([lx, ly, c]) => [`${Math.round(lx)},${ly}`, c]));
  sprite(F, Math.round(x) - 1 + minX, groundY - h + 1, maxX - minX + 1, h, (lx, ly) => grid.get(`${lx + minX},${ly}`) || null, { shade: false });
}
