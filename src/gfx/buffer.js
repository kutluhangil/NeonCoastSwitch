// CPU pixel buffers: albedo (lit by the light pass), emission (added on top),
// a light group per pixel (so each render can switch sources) and a tap id.
// Painting albedo clears emission, so whatever is in front hides the glow behind it.

const OUTLINE_INK = hex('#1a0d24');

function createFrame() {
  const n = W * H;
  return {
    alb: new Float32Array(n * 3),
    emi: new Float32Array(n * 3),
    grp: new Uint8Array(n),
    id: new Uint8Array(n),
    halo: new Uint8Array(n), // 1 = this emission throws a halo
    curId: 0,
  };
}

function frameClear(F) {
  F.alb.fill(0);
  F.emi.fill(0);
  F.grp.fill(0);
  F.id.fill(0);
  F.halo.fill(0);
  F.curId = 0;
}

const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

function px(F, x, y, c) {
  x |= 0;
  y |= 0;
  if (!inside(x, y)) return;
  const i = y * W + x;
  const j = i * 3;
  F.alb[j] = c[0];
  F.alb[j + 1] = c[1];
  F.alb[j + 2] = c[2];
  F.emi[j] = F.emi[j + 1] = F.emi[j + 2] = 0;
  F.grp[i] = 0;
  F.halo[i] = 0;
  F.id[i] = F.curId;
}

// Emissive pixel. `off` is the albedo shown when its group is switched off (dark glass).
function glow(F, x, y, c, k = 1, group = GROUP.ALWAYS, off = null, halo = true) {
  x |= 0;
  y |= 0;
  if (!inside(x, y)) return;
  const i = y * W + x;
  const j = i * 3;
  if (off) {
    F.alb[j] = off[0];
    F.alb[j + 1] = off[1];
    F.alb[j + 2] = off[2];
  }
  F.emi[j] = c[0] * k;
  F.emi[j + 1] = c[1] * k;
  F.emi[j + 2] = c[2] * k;
  F.grp[i] = group;
  F.halo[i] = halo ? 1 : 0;
  F.id[i] = F.curId;
}

// Adds light on top of whatever is there (sparks, glints) without touching albedo.
function addGlow(F, x, y, c, k = 1) {
  x |= 0;
  y |= 0;
  if (!inside(x, y)) return;
  const i = y * W + x;
  const j = i * 3;
  if (F.grp[i] !== GROUP.ALWAYS && F.grp[i] !== GROUP.SKY) {
    F.emi[j] = F.emi[j + 1] = F.emi[j + 2] = 0;
  }
  F.emi[j] += c[0] * k;
  F.emi[j + 1] += c[1] * k;
  F.emi[j + 2] += c[2] * k;
  F.grp[i] = GROUP.ALWAYS;
  F.halo[i] = 1;
}

function rect(F, x, y, w, h, c) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px(F, xx, yy, c);
}

function line(x0, y0, x1, y1, fn) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 512; guard++) {
    fn(x0, y0);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

// Stamps a shape as a pixel sprite: automatic dark outline, lighter top row, darker bottom row.
// colorAt(lx, ly) returns a colour or null for each local pixel of the w×h box.
const SPR_MAX = 64;
const sprMask = new Array(SPR_MAX * SPR_MAX);
function sprite(F, x0, y0, w, h, colorAt, opts = {}) {
  const { outline = true, shade = true, flip = false } = opts;
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  const at = (lx, ly) => (lx < 0 || ly < 0 || lx >= w || ly >= h ? null : sprMask[ly * SPR_MAX + lx]);
  for (let ly = 0; ly < h; ly++)
    for (let lx = 0; lx < w; lx++) sprMask[ly * SPR_MAX + lx] = colorAt(flip ? w - 1 - lx : lx, ly);
  if (outline) {
    for (let ly = -1; ly <= h; ly++)
      for (let lx = -1; lx <= w; lx++) {
        if (at(lx, ly)) continue;
        const n = at(lx - 1, ly) || at(lx + 1, ly) || at(lx, ly - 1) || at(lx, ly + 1);
        if (n) px(F, x0 + lx, y0 + ly, mixc(scalec(n, 0.25), OUTLINE_INK, 0.6));
      }
  }
  for (let ly = 0; ly < h; ly++)
    for (let lx = 0; lx < w; lx++) {
      const c = at(lx, ly);
      if (!c) continue;
      let o = c;
      if (shade && !at(lx, ly - 1)) o = [Math.min(1, c[0] * 1.15 + 0.06), Math.min(1, c[1] * 1.15 + 0.06), Math.min(1, c[2] * 1.15 + 0.06)];
      else if (shade && !at(lx, ly + 1)) o = scalec(c, 0.7);
      px(F, x0 + lx, y0 + ly, o);
    }
}
