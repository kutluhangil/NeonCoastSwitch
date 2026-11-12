// Light pass: ambient + banded (Bayer-dithered) lights on albedo, plus switched emission
// and a soft halo. Produces an RGBA8 image for the glass shader.

function createShadeBuffers() {
  const n = W * H;
  return { L: new Float32Array(n * 3), E: new Float32Array(n * 3), HS: new Float32Array(n * 3), T: new Float32Array(n * 3) };
}

const LIGHT_BANDS = 4;

function applyLight(B, l, k) {
  const { L, E } = B;
  const c = l.color;
  const air = l.air || 0;
  const add = (x, y, f) => {
    if (f <= 0) return;
    const v = dither(f * k, x, y, LIGHT_BANDS);
    const i = (y * W + x) * 3;
    if (v > 0) {
      L[i] += c[0] * v;
      L[i + 1] += c[1] * v;
      L[i + 2] += c[2] * v;
    }
    if (air > 0) {
      const a = dither(f * air * k, x, y, 6);
      E[i] += c[0] * a;
      E[i + 1] += c[1] * a;
      E[i + 2] += c[2] * a;
    }
  };
  if (l.kind === 'point') {
    const x0 = Math.max(0, Math.floor(l.x - l.r));
    const x1 = Math.min(W - 1, Math.ceil(l.x + l.r));
    const y0 = Math.max(l.yMin || 0, Math.floor(l.y - l.r));
    const y1 = Math.min(H - 1, Math.ceil(l.y + l.r));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - l.x, y - l.y) / l.r;
        if (d < 1) add(x, y, (1 - d) * (1 - d));
      }
  } else if (l.kind === 'pool') {
    const x0 = Math.max(0, Math.floor(l.x - l.rx));
    const x1 = Math.min(W - 1, Math.ceil(l.x + l.rx));
    const y0 = Math.max(l.yMin || 0, Math.floor(l.y - l.ry));
    const y1 = Math.min(H - 1, Math.ceil(l.y + l.ry));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot((x - l.x) / l.rx, (y - l.y) / l.ry);
        if (d < 1) add(x, y, 1 - d * d);
      }
  } else if (l.kind === 'cone') {
    const dx = l.bx - l.ax;
    const dy = l.by - l.ay;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const pad = Math.max(l.w0, l.w1) + 1;
    const x0 = Math.max(0, Math.floor(Math.min(l.ax, l.bx) - pad));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(l.ax, l.bx) + pad));
    const y0 = Math.max(0, Math.floor(Math.min(l.ay, l.by) - pad));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(l.ay, l.by) + pad));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const rx = x - l.ax;
        const ry = y - l.ay;
        const s = (rx * ux + ry * uy) / len;
        if (s < 0 || s > 1) continue;
        const q = Math.abs(rx * -uy + ry * ux);
        const wdt = lerp(l.w0, l.w1, s);
        if (q > wdt) continue;
        add(x, y, (1 - s * 0.55) * (1 - (q / wdt) * 0.6));
      }
  }
}

// opts: { levels, ambient, flash, rim: {x, dir, k} | null, hover }
function shade(F, lights, opts, B, out) {
  const { L, E, HS, T } = B;
  const n = W * H;
  const { levels, ambient, flash } = opts;
  for (let i = 0; i < n; i++) {
    const j = i * 3;
    L[j] = ambient[0] + flash;
    L[j + 1] = ambient[1] + flash * 0.9;
    L[j + 2] = ambient[2] + flash * 0.7;
    E[j] = E[j + 1] = E[j + 2] = 0;
  }
  for (const l of lights) {
    const lv = levels[l.group] * (l.level === undefined ? 1 : l.level);
    if (lv > 0.01) applyLight(B, l, l.power * lv);
  }

  // A bright dithered rim trails the knob.
  const rim = opts.rim;
  if (rim) {
    const span = 7;
    for (let y = 0; y < H; y++)
      for (let d = 0; d < span; d++) {
        const x = Math.round(rim.x - rim.dir * d);
        if (x < 0 || x >= W) continue;
        const v = dither((1 - d / span) * rim.k, x, y, LIGHT_BANDS);
        const i = (y * W + x) * 3;
        L[i] += 1.0 * v;
        L[i + 1] += 0.72 * v;
        L[i + 2] += 0.42 * v;
      }
  }

  for (let i = 0; i < n; i++) {
    const j = i * 3;
    const lv = levels[F.grp[i]];
    const er = F.emi[j] * lv;
    const eg = F.emi[j + 1] * lv;
    const eb = F.emi[j + 2] * lv;
    E[j] += er;
    E[j + 1] += eg;
    E[j + 2] += eb;
    const h = F.halo[i];
    HS[j] = h ? er : 0;
    HS[j + 1] = h ? eg : 0;
    HS[j + 2] = h ? eb : 0;
  }
  boxBlur(HS, T, 2);
  boxBlur(HS, T, 2);

  const hover = opts.hover || 0;
  const big = hoverIsBig(hover);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const j = i * 3;
      let r = F.alb[j] * L[j] + E[j] + dither(HS[j] * 0.7, x, y, 8);
      let g = F.alb[j + 1] * L[j + 1] + E[j + 1] + dither(HS[j + 1] * 0.7, x, y, 8);
      let b = F.alb[j + 2] * L[j + 2] + E[j + 2] + dither(HS[j + 2] * 0.7, x, y, 8);
      if (hover) {
        const id = F.id[i];
        if (id === hover) {
          const k = big ? 0.05 : 0.12;
          r += k;
          g += k;
          b += k * 0.8;
        } else if (!big && ((x > 0 && F.id[i - 1] === hover) || (x < W - 1 && F.id[i + 1] === hover) || (y > 0 && F.id[i - W] === hover) || (y < H - 1 && F.id[i + W] === hover))) {
          r = lerp(r, 1, 0.75);
          g = lerp(g, 0.95, 0.75);
          b = lerp(b, 0.7, 0.75);
        }
      }
      const o = i * 4;
      out[o] = r >= 1 ? 255 : r <= 0 ? 0 : (r * 255) | 0;
      out[o + 1] = g >= 1 ? 255 : g <= 0 ? 0 : (g * 255) | 0;
      out[o + 2] = b >= 1 ? 255 : b <= 0 ? 0 : (b * 255) | 0;
      out[o + 3] = 255;
    }
}

// Separable box blur, in place via tmp.
function boxBlur(A, T, r) {
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let ch = 0; ch < 3; ch++) {
        let s = 0;
        for (let k = -r; k <= r; k++) {
          const xx = x + k < 0 ? 0 : x + k >= W ? W - 1 : x + k;
          s += A[(y * W + xx) * 3 + ch];
        }
        T[(y * W + x) * 3 + ch] = s * norm;
      }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let ch = 0; ch < 3; ch++) {
        let s = 0;
        for (let k = -r; k <= r; k++) {
          const yy = y + k < 0 ? 0 : y + k >= H ? H - 1 : y + k;
          s += T[(yy * W + x) * 3 + ch];
        }
        A[(y * W + x) * 3 + ch] = s * norm;
      }
}
