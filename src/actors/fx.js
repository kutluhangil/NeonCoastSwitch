// Particles (puffs, smoke, sparks, glass, splashes), floating pop-ups and falling coconuts.
const FX_STYLE = {
  puff: { c: hex('#c9c4cf'), grav: -6, drag: 2.5, glow: false },
  smoke: { c: hex('#e4e0e8'), grav: -10, drag: 1.8, glow: false },
  spark: { c: hex('#ffd36b'), grav: 60, drag: 0.5, glow: true },
  crackle: { c: hex('#bff6ff'), grav: 40, drag: 0.5, glow: true },
  glass: { c: hex('#d8f4ff'), grav: 90, drag: 0.3, glow: true },
  splash: { c: hex('#f2fbff'), grav: 70, drag: 0.4, glow: false },
};
const FX_MAX = 260;

function spawnFx(S, kind, x, y, vx, vy, life, color) {
  if (S.fx.length >= FX_MAX) S.fx.shift();
  S.fx.push({ kind, x, y, vx, vy, life, max: life, c: color || null, seed: Math.random() * 1000 });
}

function burst(S, kind, x, y, n, speed, life, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const s = speed * (0.4 + Math.random() * 0.6);
    spawnFx(S, kind, x, y, Math.cos(a) * s, Math.sin(a) * s - speed * 0.4, life * (0.6 + Math.random() * 0.4), color);
  }
}

function stepFx(S, dt) {
  for (const p of S.fx) {
    const st = FX_STYLE[p.kind];
    p.vy += st.grav * dt;
    p.vx *= Math.exp(-st.drag * dt);
    p.vy *= Math.exp(-st.drag * dt * 0.5);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if ((p.kind === 'glass' || p.kind === 'spark') && p.y > NEAR_GROUND) {
      p.y = NEAR_GROUND;
      p.vy *= -0.3;
      p.vx *= 0.6;
    }
  }
  S.fx = S.fx.filter((p) => p.life > 0 && p.x > -8 && p.x < W + 8 && p.y > -8);

  for (const p of S.pops) {
    p.life -= dt;
    p.y -= dt * (p.kind === 'heart' ? 5 : 3);
    if (p.kind === 'heart') p.x += Math.sin(p.life * 6 + p.seed) * dt * 4;
  }
  S.pops = S.pops.filter((p) => p.life > 0);
}

function drawFx(F, S) {
  F.curId = ID.NONE;
  for (const p of S.fx) {
    const st = FX_STYLE[p.kind];
    const k = p.life / p.max;
    const c = p.c || st.c;
    if (st.glow) {
      addGlow(F, p.x, p.y, c, 1.6 * k);
      continue;
    }
    // Fade by thinning the pixel out with an ordered dither.
    if (bayer(Math.round(p.x), Math.round(p.y)) > k * 1.2) continue;
    px(F, p.x, p.y, c);
    if (p.kind === 'smoke' && k > 0.5) px(F, p.x + 1, p.y, c);
  }
}

function addPop(S, kind, x, y, life = 1.4) {
  S.pops.push({ kind, x, y, life, max: life, seed: Math.random() * 10 });
}

const HEART = ['#.#', '###', '.#.'];
function drawPops(F, S) {
  F.curId = ID.NONE;
  for (const p of S.pops) {
    if (p.life < 0.3 && Math.floor(p.life * 20) % 2 === 0) continue;
    if (p.kind === '!') {
      sprite(F, Math.round(p.x) - 1, Math.round(p.y), 3, 5, (lx, ly) => (GLYPHS['!'][ly][lx] === '#' ? hex('#fffbe8') : null), { shade: false });
    } else if (p.kind === 'heart') {
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (HEART[y][x] === '#') glow(F, Math.round(p.x) + x - 1, Math.round(p.y) + y, hex('#ff5fa2'), 1.2);
    }
  }
}

// Coconuts fall from a palm crown, knock on the pavement, or bonk the dog.
function stepCoconuts(S, dt) {
  for (const n of S.nuts) {
    n.vy += 140 * dt;
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    const c = S.car;
    const overCar = Math.abs(n.x - c.x) < 11;
    const headY = NEAR_GROUND - 9;
    if (!n.hitDog && overCar && n.y >= headY && n.y < headY + 3 && c.duck < 0.5) {
      n.hitDog = true;
      n.vy = -45;
      n.vx = (Math.random() < 0.5 ? -1 : 1) * 30;
      c.bonk = 2.6;
      S.bus.emit('sfx', { name: 'bonk', x: n.x });
      continue;
    }
    if (n.y >= n.floor) {
      n.y = n.floor;
      if (Math.abs(n.vy) > 25) {
        S.bus.emit('sfx', { name: 'coconut', x: n.x, k: Math.min(1, n.vy / 90) });
        n.vy *= -0.38;
        n.vx *= 0.6;
      } else {
        n.vy = 0;
        n.vx *= 0.9;
        n.rest += dt;
      }
    }
  }
  S.nuts = S.nuts.filter((n) => n.rest < 6);
}

function drawCoconuts(F, S) {
  F.curId = ID.NONE;
  const c = hex('#6b4128');
  for (const n of S.nuts) sprite(F, Math.round(n.x), Math.round(n.y) - 1, 2, 2, () => c);
}
