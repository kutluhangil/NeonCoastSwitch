// Scene geometry in scene pixels (176×50). y grows downward.
const W = 176;
const H = 50;

const KNOB_W = 38;
const KNOB_H = 58;
const KNOB_MIN = 20;
const KNOB_MAX = W - 20;
const knobT = (x) => clamp((x - KNOB_MIN) / (KNOB_MAX - KNOB_MIN), 0, 1);
const knobX = (t) => KNOB_MIN + t * (KNOB_MAX - KNOB_MIN);

const HORIZON = 21;
const SAND_Y = 29;
const WALL_Y = 32;
const PAVE_Y = 34;
const KERB_Y = 37;
const ROAD_Y = 38;
const DASH_Y = 43;
const FAR_GROUND = 42; // bottom row of far-lane wheels
const NEAR_GROUND = 49; // bottom row of near-lane wheels
const BEACH_END = 47;

const HOTEL = { x: 50, w: 28, roof: 8 };
const HOTEL_WIN = { cols: [52, 57, 62, 67, 72], rows: [11, 17, 23], w: 3, h: 3 };
const STORE = { x: 80, w: 27, roof: 20, glassY: 27, doorX: 99 };
const SIGN24 = { post: 104, x: 99, y: 9 };
const DINER = { x: 110, w: 25, roof: 21 };
const CLUB = { x: 135, w: 39, roof: 13 };
const PALMS = [
  { x: 40, base: SAND_Y + 3, top: 12, beach: true },
  { x: 79, base: PAVE_Y + 2, top: 9 },
  { x: 107, base: PAVE_Y + 2, top: 22 },
  { x: 135, base: PAVE_Y + 2, top: 9 },
];
const LAMPS = [48, 83, 131, 160]; // poles stand in gaps so they never cut through a sign
const TOWER = { x: 22, w: 9 }; // lifeguard tower
const SUN_X = 13;

// Clock: 18:30 → 23:30 across the knob's travel.
const clockMinutes = (t) => 18 * 60 + 30 + t * 300;
function clockText(t) {
  const m = Math.floor(clockMinutes(t));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// 1 scene px ≈ 0.19 m; mph = px/s · 0.19 · 2.237.
const PX_TO_MPH = 0.425;

// Tap / hover ids written into the id buffer while painting.
const ID = {
  NONE: 0,
  SKY: 1,
  SEA: 2,
  ROAD: 3,
  LIFEGUARD: 4,
  PALM0: 5, // 5..8
  WIN0: 10, // 10..24
  STORE: 25,
  DINER: 26,
  NEON0: 27, // 27..33
  CAR: 34,
  TRAFFIC0: 35, // 35..44
  POLICE: 45,
  HELI: 46,
};

// Light groups: every emissive pixel and light belongs to one, so each render can switch them.
const GROUP = { ALWAYS: 0, SKY: 1, TOWERS: 2, STORE: 3, DINER: 4, CLUB: 5, HOTEL: 6, LAMP0: 8, WIN0: 16, NEON0: 40 };
const GROUP_COUNT = 64;
