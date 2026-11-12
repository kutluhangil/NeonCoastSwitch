// Stop for a few seconds and the dog drums on the door in time with the music
// (soft knocks, the backbeat harder) while the cat bobs her head.
// After a while he leans on the horn and barks.
const IDLE_DRUM_AFTER = 4;
const IDLE_HORN_AFTER = 14;
const IDLE_HORN_EVERY = 16;

function createIdle() {
  return { still: 0, lastBeat: -1, nextHorn: IDLE_HORN_AFTER };
}

function resetIdle(S) {
  S.idle.still = 0;
  S.idle.nextHorn = IDLE_HORN_AFTER;
}

function stepIdle(S, dt) {
  const I = S.idle;
  const busy = S.knob.grabbed || Math.abs(S.car.v) > 3 || S.car.duck > 0.1 || S.car.drink > 0;
  if (busy) {
    resetIdle(S);
    return;
  }
  I.still += dt;
  if (I.still < IDLE_DRUM_AFTER) return;
  const beat = Math.floor(S.beat);
  if (beat !== I.lastBeat) {
    I.lastBeat = beat;
    S.car.paw = 1;
    S.car.catBob = 1;
    S.bus.emit('sfx', { name: 'drum', hard: beat % 2 === 1, x: S.car.x });
  }
  if (I.still >= I.nextHorn) {
    I.nextHorn = I.still + IDLE_HORN_EVERY;
    S.car.lean = 1.4;
    S.bus.emit('sfx', { name: 'longHonk', x: S.car.x });
    S.bus.emit('sfx', { name: 'bark', x: S.car.x, delay: 1.0 });
    S.bus.emit('sfx', { name: 'bark', x: S.car.x, delay: 1.3 });
  }
}
