// Far blue towers and the four boulevard buildings.
const C_CITY = {
  tower: hex('#2f5296'),
  towerDark: hex('#243f78'),
  towerWin: hex('#4a6fb3'),
  hotel: hex('#f49ab3'),
  hotelDeep: hex('#d9768f'),
  teal: hex('#2bb3a7'),
  glass: hex('#2a2f4d'),
  glassHi: hex('#5a6488'),
  storeWall: hex('#e8e2d6'),
  fascia: hex('#1e4c58'),
  shelf: hex('#8a8f9e'),
  mint: hex('#9fe5ca'),
  mintDeep: hex('#6fc3a7'),
  chrome: hex('#d6dde6'),
  chromeDark: hex('#8f9aa8'),
  lav: hex('#b9a2e6'),
  lavHi: hex('#d8c9f5'),
  lavDeep: hex('#8f78c4'),
  board: hex('#2a2238'),
  post: hex('#5d5468'),
  seat: hex('#d8455a'),
};

const WIN_LIGHTS = [hex('#ffc66b'), hex('#ff8fc8'), hex('#8fd6ff')];
const FLUOR = hex('#e6fff4');

const FAR_TOWERS = [
  { x: 43, w: 8, top: 13, ant: false },
  { x: 57, w: 11, top: 2, ant: true },
  { x: 83, w: 9, top: 6, ant: true },
  { x: 93, w: 12, top: 10, ant: false },
  { x: 111, w: 9, top: 4, ant: true },
  { x: 123, w: 11, top: 13, ant: false },
  { x: 160, w: 10, top: 3, ant: true },
];

function drawFarTowers(F, S) {
  F.curId = ID.NONE;
  for (const [ti, tw] of FAR_TOWERS.entries()) {
    for (let y = tw.top; y < PAVE_Y; y++)
      for (let x = tw.x; x < tw.x + tw.w; x++) {
        const edge = x === tw.x + tw.w - 1;
        const isWin = (x - tw.x) % 2 === 1 && (y - tw.top) % 2 === 1 && !edge && y > tw.top;
        if (!isWin) {
          px(F, x, y, edge ? C_CITY.towerDark : C_CITY.tower);
          continue;
        }
        const h = hash2(x * 5 + ti, y * 3);
        if (h < 0.42) glow(F, x, y, h < 0.21 ? hex('#ffd98a') : hex('#9fe6ff'), 0.7, GROUP.TOWERS, C_CITY.towerWin, false);
        else px(F, x, y, C_CITY.towerWin);
      }
    if (tw.ant) {
      const ax = tw.x + Math.floor(tw.w / 2);
      rect(F, ax, tw.top - 3, 1, 3, C_CITY.towerDark);
      const blink = Math.sin(S.time * 2.6 + ti * 1.7) > 0.55;
      glow(F, ax, tw.top - 4, hex('#ff3b3b'), blink ? 1.4 : 0.15, GROUP.ALWAYS, C_CITY.towerDark);
    }
  }
}

function hotelWindows() {
  const list = [];
  let i = 0;
  for (const y of HOTEL_WIN.rows)
    for (const x of HOTEL_WIN.cols) {
      const h = hash2(x, y * 7);
      list.push({ i, x, y, dark: h < 0.2, color: WIN_LIGHTS[Math.floor(hash2(y, x) * 3)], gate: x + 1 + hash2(x * 3, y) * 4 });
      i++;
    }
  return list;
}

function drawHotel(F, S) {
  const { x: hx, w, roof } = HOTEL;
  F.curId = ID.NONE;
  rect(F, hx, roof + 2, w, PAVE_Y - roof - 2, C_CITY.hotel);
  for (let y = roof + 2; y < PAVE_Y; y++) {
    px(F, hx, y, C_CITY.hotelDeep);
    px(F, hx + w - 1, y, C_CITY.hotelDeep);
  }
  rect(F, hx - 1, roof, w + 2, 2, C_CITY.teal);
  rect(F, hx - 1, roof + 1, w + 2, 1, scalec(C_CITY.teal, 0.75));
  for (const ly of [15, 21, 27]) {
    rect(F, hx - 1, ly, w + 2, 1, C_CITY.teal);
    for (let x = hx; x < hx + w; x++) px(F, x, ly + 1, C_CITY.hotelDeep);
  }
  // roof sign frame
  rect(F, hx + 6, roof - 1, 1, 1, C_CITY.post);
  rect(F, hx + w - 7, roof - 1, 1, 1, C_CITY.post);
  rect(F, hx + 4, 1, w - 8, 7, C_CITY.board);

  for (const win of S.windows) {
    F.curId = ID.WIN0 + win.i;
    const lit = !win.dark || win.forced > 0;
    for (let y = 0; y < HOTEL_WIN.h; y++)
      for (let x = 0; x < HOTEL_WIN.w; x++) {
        const wx = win.x + x;
        const wy = win.y + y;
        const glare = x + y === 0;
        if (!lit) {
          px(F, wx, wy, glare ? C_CITY.glassHi : C_CITY.glass);
          continue;
        }
        // A silhouette crosses a knocked-on window.
        const sil = win.silT > 0 && Math.round(lerp(-1, HOTEL_WIN.w, 1 - win.silT / 1.6)) === x && y > 0;
        const head = win.silT > 0 && Math.round(lerp(-1, HOTEL_WIN.w, 1 - win.silT / 1.6)) === x && y === 0;
        const c = sil || head ? hex('#1a0f22') : win.color;
        const grp = win.forced > 0 ? GROUP.ALWAYS : GROUP.WIN0 + win.i;
        glow(F, wx, wy, c, sil || head ? 0.05 : 0.95, grp, glare ? C_CITY.glassHi : C_CITY.glass);
      }
    // window sill
    F.curId = ID.NONE;
    rect(F, win.x - 1, win.y + HOTEL_WIN.h, HOTEL_WIN.w + 2, 1, C_CITY.hotelDeep);
  }

  // lobby, awning and door
  F.curId = ID.NONE;
  for (let x = hx + 9; x < hx + 19; x++) px(F, x, 28, (x & 1) === 0 ? C_CITY.teal : hex('#f6f2ea'));
  for (let y = 29; y < PAVE_Y; y++)
    for (let x = hx + 10; x < hx + 18; x++) {
      const frame = x === hx + 13 || x === hx + 14;
      if (frame) px(F, x, y, C_CITY.chromeDark);
      else glow(F, x, y, hex('#ffcf8a'), 0.7, GROUP.HOTEL, C_CITY.glass, false);
    }
}

function drawStore(F, S) {
  const { x: sx, w, roof, glassY, doorX } = STORE;
  const st = S.store;
  F.curId = ID.STORE;
  rect(F, sx, roof, w, 1, hex('#4d4a58'));
  rect(F, sx, roof + 1, w, glassY - roof - 1, C_CITY.fascia);
  rect(F, sx, roof + 1, w, 1, scalec(C_CITY.fascia, 1.35));
  rect(F, sx, glassY, 1, PAVE_Y - glassY, C_CITY.storeWall);
  rect(F, sx + w - 1, glassY, 1, PAVE_Y - glassY, C_CITY.storeWall);
  rect(F, sx, PAVE_Y - 1, w, 1, C_CITY.storeWall);

  const shelfColors = [hex('#ff6b6b'), hex('#ffd166'), hex('#5ad1a8'), hex('#6fa8ff'), hex('#ff9ad5')];
  const open = st.door; // 0..1 slide
  for (let y = glassY; y < PAVE_Y - 1; y++)
    for (let x = sx + 1; x < sx + w - 1; x++) {
      const inDoor = x >= doorX && x < doorX + 5;
      const shelfRow = (y === glassY + 2 || y === glassY + 4) && !inDoor && x !== sx + 9;
      const product = shelfRow && hash2(x, y) < 0.75;
      let c = FLUOR;
      let k = 0.55;
      let off = C_CITY.glass;
      if (product) {
        c = shelfColors[Math.floor(hash2(y, x * 3) * shelfColors.length)];
        k = 0.65;
        off = scalec(c, 0.3);
      } else if (shelfRow) {
        c = C_CITY.shelf;
        k = 0.4;
      }
      if (inDoor) {
        // sliding door panels part from the middle
        const local = x - doorX;
        const gap = Math.round(open * 2.5);
        const panel = local < 2 - gap + 0.5 || local > 2 + gap - 0.5;
        if (panel && (local === 0 || local === 4)) {
          px(F, x, y, C_CITY.chromeDark);
          continue;
        }
        if (panel) {
          c = scalec(FLUOR, 0.85);
          k = 0.5;
        }
      }
      glow(F, x, y, c, k, GROUP.STORE, off, false);
    }

  drawClerk(F, S);

  if (st.broken) {
    F.curId = ID.STORE;
    const cracks = [
      [83, 28, 88, 31],
      [86, 27, 84, 32],
      [88, 29, 92, 27],
      [90, 30, 95, 32],
      [93, 28, 96, 30],
    ];
    for (const [x0, y0, x1, y1] of cracks) line(x0, y0, x1, y1, (x, y) => px(F, x, y, hex('#f4fbff')));
    for (const [x, y] of [[87, 30], [92, 29], [91, 31]]) px(F, x, y, hex('#0e1020'));
  }

  // "24H" sign on a post
  F.curId = ID.NONE;
  rect(F, SIGN24.post, SIGN24.y + 7, 1, PAVE_Y - SIGN24.y - 7, C_CITY.post);
  sprite(F, SIGN24.x - 1, SIGN24.y, 15, 7, () => C_CITY.board, { shade: false });
}

function drawClerk(F, S) {
  const st = S.store;
  F.curId = ID.STORE;
  const cx = STORE.x + 9;
  const y0 = STORE.glassY + 1;
  const skin = hex('#c98d63');
  const shirt = hex('#e24b5b');
  glow(F, cx, y0, skin, 0.6, GROUP.STORE, scalec(skin, 0.3), false);
  glow(F, cx, y0 + 1, shirt, 0.6, GROUP.STORE, scalec(shirt, 0.3), false);
  glow(F, cx, y0 + 2, shirt, 0.6, GROUP.STORE, scalec(shirt, 0.3), false);
  glow(F, cx, y0 + 3, hex('#3a3550'), 0.5, GROUP.STORE, C_CITY.glass, false);
  if (st.wave > 0) {
    const up = Math.sin(st.wave * 18) > 0;
    glow(F, cx + 1, y0 + (up ? -1 : 0), skin, 0.7, GROUP.STORE, scalec(skin, 0.3), false);
  }
}

function drawDiner(F, S) {
  const { x: dx, w, roof } = DINER;
  F.curId = ID.DINER;
  sprite(
    F,
    dx,
    roof,
    w,
    PAVE_Y - roof,
    (x, y) => {
      if (y === 0 && (x < 2 || x > w - 3)) return null;
      if (y === 1 && (x === 0 || x === w - 1)) return null;
      if (y === 3) return C_CITY.chrome;
      if (y >= PAVE_Y - roof - 2) return (x & 1) === 0 ? C_CITY.chrome : C_CITY.chromeDark;
      return C_CITY.mint;
    },
    { outline: false },
  );
  // ribbon window with booths, and a door
  for (let y = roof + 4; y < roof + 9; y++)
    for (let x = dx + 2; x < dx + w - 6; x++) {
      const booth = y >= roof + 7 && (x - dx) % 4 !== 1;
      const lamp = y === roof + 4 && (x - dx) % 4 === 3;
      const c = booth ? C_CITY.seat : lamp ? hex('#fff1c9') : hex('#ffcf8f');
      glow(F, x, y, c, booth ? 0.6 : lamp ? 1.1 : 0.7, GROUP.DINER, booth ? scalec(C_CITY.seat, 0.35) : C_CITY.glass, lamp);
    }
  for (let y = roof + 4; y < PAVE_Y - 2; y++)
    for (let x = dx + w - 5; x < dx + w - 2; x++) glow(F, x, y, hex('#ffd9a0'), 0.65, GROUP.DINER, C_CITY.glass, false);
  // neon palm mount
  F.curId = ID.NONE;
  rect(F, dx + 11, roof - 1, 3, 1, C_CITY.post);
}

function drawClub(F, S) {
  const { x: cx, w, roof } = CLUB;
  F.curId = ID.NONE;
  const mid = cx + Math.floor(w / 2);
  sprite(
    F,
    cx,
    roof,
    w,
    PAVE_Y - roof,
    (x, y) => {
      const ax = x + cx;
      const yy = y + roof;
      if (yy < roof + 3 && Math.abs(ax - mid) > 6) return null;
      if (yy < roof + 6 && Math.abs(ax - mid) > 15) return null;
      const fin = yy < 23 && (ax === mid - 4 || ax === mid || ax === mid + 4);
      if (yy === 23 || yy === roof + 3 || yy === roof + 6) return C_CITY.lavDeep;
      if (fin) return C_CITY.lavHi;
      return C_CITY.lav;
    },
    { shade: true },
  );
  // roof sign board and posts (kept inside the pill's rounded end)
  rect(F, mid - 5, roof - 1, 1, 1, C_CITY.post);
  rect(F, mid + 5, roof - 1, 1, 1, C_CITY.post);
  rect(F, cx + 7, 5, 25, 7, C_CITY.board);

  // porthole windows
  const ports = [cx + 3, cx + 8, cx + 13];
  for (const [i, wx] of ports.entries())
    for (let y = 20; y < 22; y++)
      for (let x = wx; x < wx + 2; x++) glow(F, x, y, i === 1 ? hex('#c77dff') : hex('#ff8fd0'), 0.8, GROUP.CLUB, C_CITY.glass, false);
  // marquee with bulbs and the door
  for (let x = mid - 9; x <= mid + 9; x++) {
    px(F, x, 25, C_CITY.board);
    const bulb = (x + Math.floor(S.time * 4)) % 3 === 0;
    glow(F, x, 26, hex('#ffe9a8'), bulb ? 1.1 : 0.35, GROUP.CLUB, hex('#5d5468'));
  }
  for (let y = 27; y < PAVE_Y; y++)
    for (let x = mid - 3; x <= mid + 3; x++) glow(F, x, y, x === mid ? hex('#5a2a6e') : hex('#d35dff'), 0.55, GROUP.CLUB, C_CITY.glass, false);
}

function drawCity(F, S) {
  drawHotel(F, S);
  drawStore(F, S);
  drawDiner(F, S);
  drawClub(F, S);
}
