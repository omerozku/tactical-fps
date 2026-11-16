export const S = {
  phase: 'boot',
  shotMode: false,
  round: 1,
  maxRounds: 15,
  winsNeeded: 8,
  scoreCT: 0,
  scoreT: 0,
  timer: 105,
  buyTimer: 16,
  postTimer: 4.2,
  money: 800,
  lossStreak: 0,
  hp: 100,
  armor: 0,
  alive: true,
  weapon: 'pistol',
  mag: 12,
  reserve: 36,
  reloading: false,
  inventory: { pistol: true, rifle: false, sniper: false, shotgun: false },
  ammo: {
    pistol: { mag: 12, reserve: 36 },
    rifle: { mag: 30, reserve: 90 },
    sniper: { mag: 5, reserve: 20 },
    shotgun: { mag: 6, reserve: 24 },
  },
  grenades: 0,
  kills: 0,
  deaths: 0,
  headshots: 0,
  bomb: {
    planted: false,
    site: null,
    x: 0,
    y: 0,
    z: 0,
    timer: 40,
    defuse: 0,
    carrier: null,
    beep: 0,
  },
  matchWinner: null,
  roundReason: '',
  objective: 'BUY PHASE',
  feedSeq: 0,
  feed: [],
  screenShake: 0,
  damagePulse: 0,
  damageFromX: 0,
  damageFromZ: 0,
  hitPulse: 0,
  hitHead: false,
};

export function addFeed(text, ttl = 5.5) {
  S.feed.push({ id: ++S.feedSeq, text, ttl });
  if (S.feed.length > 6) S.feed.shift();
}

export function flushFeed() {
  S.feed.length = 0;
}

export function resetBomb() {
  S.bomb.planted = false;
  S.bomb.site = null;
  S.bomb.timer = 40;
  S.bomb.defuse = 0;
  S.bomb.carrier = null;
  S.bomb.beep = 0;
}
