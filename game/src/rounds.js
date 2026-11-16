import { WEAPONS } from './weapon.js';
import { addFeed, resetBomb } from './state.js';

const BUY_TIME = 12;
const ROUND_TIME = 105;
const BOMB_TIME = 40;
const POST_TIME = 4.4;
const ARMOR_COST = 650;
const GRENADE_COST = 300;
const MAX_MONEY = 16000;

export function createRounds({ S, world, player, bots, weapons, sfx }) {
  const callbacks = {};
  let buyPaused = true;
  let playerSurvived = false;

  function setCallbacks(next) {
    Object.assign(callbacks, next);
  }

  function resetLoadout() {
    S.inventory = { pistol: true, rifle: false, sniper: false, shotgun: false };
    S.weapon = 'pistol';
    S.grenades = 0;
    S.armor = 0;
    S.mag = WEAPONS.pistol.mag;
    S.reserve = WEAPONS.pistol.reserve;
    S.reloading = false;
    S.ammo.pistol = { mag: WEAPONS.pistol.mag, reserve: WEAPONS.pistol.reserve };
  }

  function beginBuy() {
    S.phase = 'buy';
    S.buyTimer = 0;
    S.timer = ROUND_TIME;
    S.objective = 'BUY PHASE';
    S.roundReason = '';
    S.alive = true;
    S.hp = 100;
    resetBomb();
    if (!playerSurvived) resetLoadout();
    if (playerSurvived) {
      S.armor = Math.max(0, Math.min(100, Math.round(S.armor)));
      player.armor = S.armor;
    } else {
      S.armor = 0;
      player.armor = 0;
    }
    player.reset(world.spawns.ct[0]);
    S.hp = 100;
    S.armor = Math.round(player.armor);
    if (playerSurvived) {
      weapons.refillAll();
      if (!S.inventory[S.weapon]) weapons.equip('pistol', true);
    } else {
      weapons.equip('pistol', true);
    }
    bots.resetRound();
    buyPaused = true;
    if (callbacks.onBuyStart) callbacks.onBuyStart(S.round);
  }

  function startBuyTimer() {
    if (S.phase !== 'buy') return;
    if (S.buyTimer <= 0) S.buyTimer = BUY_TIME;
    buyPaused = false;
  }

  function setBuyPaused(paused) {
    buyPaused = paused;
  }

  function startLive() {
    S.phase = 'live';
    S.timer = ROUND_TIME;
    S.buyTimer = 0;
    S.objective = 'DEFEND SITES A / B';
    addFeed(`ROUND ${S.round} — LIVE`);
    if (callbacks.onLive) callbacks.onLive(S.round);
  }

  function startMatch() {
    S.scoreCT = 0;
    S.scoreT = 0;
    S.round = 1;
    S.maxRounds = 15;
    S.winsNeeded = 8;
    S.money = 800;
    S.lossStreak = 0;
    S.kills = 0;
    S.deaths = 0;
    S.headshots = 0;
    S.matchWinner = null;
    S.roundReason = '';
    S.damagePulse = 0;
    S.hitPulse = 0;
    S.feed.length = 0;
    S.feedSeq = 0;
    playerSurvived = false;
    resetLoadout();
    beginBuy();
  }

  function plant(site, x, z, bot) {
    if (S.phase !== 'live' || S.bomb.planted) return false;
    S.bomb.planted = true;
    S.bomb.site = site;
    S.bomb.x = x;
    S.bomb.z = z;
    S.bomb.y = 0.05;
    S.bomb.timer = BOMB_TIME;
    S.bomb.defuse = 0;
    S.bomb.beep = 1;
    S.timer = BOMB_TIME;
    S.objective = 'DEFUSE THE CHARGE';
    addFeed(`${bot ? bot.name : 'ASHEN HAND'} PLANTED @ ${site ? site.name : 'SITE'}`);
    sfx.beep(660, 0.16, 0.14);
    if (callbacks.onPlant) callbacks.onPlant(S.bomb);
    return true;
  }

  function defuse(source) {
    if (S.phase !== 'live' || !S.bomb.planted) return false;
    S.bomb.defuse = 1;
    S.bomb.planted = false;
    addFeed(`${source ? source.name || source : 'RANGER'} DEFUSED THE CHARGE`);
    if (callbacks.onDefuse) callbacks.onDefuse(S.bomb);
    endRound('ct', 'CHARGE DEFUSED');
    return true;
  }

  function endRound(winner, reason) {
    if (S.phase !== 'live') return;
    S.phase = 'post';
    S.postTimer = POST_TIME;
    S.roundReason = reason;
    S.objective = reason;
    S.timer = 0;
    playerSurvived = player.alive;
    if (winner === 'ct') {
      S.scoreCT++;
      S.money = Math.min(MAX_MONEY, S.money + 3000);
      S.lossStreak = 0;
    } else {
      S.scoreT++;
      const lossBonus = 1900 + Math.min(1500, S.lossStreak * 500);
      S.money = Math.min(MAX_MONEY, S.money + lossBonus);
      S.lossStreak++;
    }
    const over = S.scoreCT >= S.winsNeeded || S.scoreT >= S.winsNeeded || S.round >= S.maxRounds;
    S.matchWinner = over ? (S.scoreCT > S.scoreT ? 'ct' : 't') : null;
    addFeed(`ROUND ${S.round} — ${winner === 'ct' ? 'CANYON GUARD' : 'ASHEN HAND'}`);
    if (sfx) sfx.roundEnd(winner === 'ct');
    if (callbacks.onRoundEnd) callbacks.onRoundEnd(winner, reason, S.matchWinner);
  }

  function buyWeapon(id) {
    if (S.phase !== 'buy') return { ok: false, reason: 'Buy window closed' };
    const weapon = WEAPONS[id];
    if (!weapon) return { ok: false, reason: 'Unknown weapon' };
    if (S.inventory[id]) {
      weapons.equip(id);
      return { ok: true, equipped: true, weapon };
    }
    if (S.money < weapon.cost) return { ok: false, reason: 'Not enough credits' };
    S.money -= weapon.cost;
    weapons.equip(id, true);
    addFeed(`BOUGHT ${weapon.name}`);
    sfx.beep(820, 0.08, 0.06);
    return { ok: true, weapon };
  }

  function buyArmor() {
    if (S.phase !== 'buy') return { ok: false, reason: 'Buy window closed' };
    if (player.armor >= 100) return { ok: false, reason: 'Armor already full' };
    if (S.money < ARMOR_COST) return { ok: false, reason: 'Not enough credits' };
    S.money -= ARMOR_COST;
    player.armor = 100;
    S.armor = 100;
    addFeed('BOUGHT KEVLAR');
    sfx.beep(720, 0.08, 0.06);
    return { ok: true };
  }

  function buyGrenade() {
    if (S.phase !== 'buy') return { ok: false, reason: 'Buy window closed' };
    if (S.grenades >= 2) return { ok: false, reason: 'Grenade limit reached' };
    if (S.money < GRENADE_COST) return { ok: false, reason: 'Not enough credits' };
    S.money -= GRENADE_COST;
    S.grenades++;
    addFeed('BOUGHT FRAG CHARGE');
    sfx.beep(560, 0.08, 0.06);
    return { ok: true };
  }

  function updateBomb(dt) {
    if (!S.bomb.planted) return;
    S.bomb.timer -= dt;
    S.timer = Math.max(0, S.bomb.timer);
    S.bomb.beep -= dt;
    const interval = 0.22 + Math.max(0, S.bomb.timer / BOMB_TIME) * 0.78;
    if (S.bomb.beep <= 0) {
      S.bomb.beep = interval;
      sfx.beep(1050, 0.09, 0.055);
    }
    if (S.bomb.timer <= 0) {
      S.bomb.timer = 0;
      S.bomb.planted = false;
      if (callbacks.onExplode) callbacks.onExplode(S.bomb);
      endRound('t', 'THE CHARGE DETONATED');
      return;
    }
    if (bots.inboundCount() === 0) {
      endRound('t', 'CANYON GUARD ELIMINATED');
    }
  }

  function update(dt) {
    if (S.phase === 'buy') {
      if (buyPaused) return;
      if (S.buyTimer > 0) {
        S.buyTimer -= dt;
        if (S.buyTimer <= 0) {
          S.buyTimer = 0;
          startLive();
        }
      }
      return;
    }
    if (S.phase === 'live') {
      if (S.bomb.planted) {
        updateBomb(dt);
        if (S.phase === 'live' && bots.inboundCount() === 0) {
          endRound('t', 'CANYON GUARD ELIMINATED');
        }
        return;
      }
      S.timer = Math.max(0, S.timer - dt);
      if (bots.aliveCount('t') === 0) {
        endRound('ct', 'ASHEN HAND ELIMINATED');
      } else if (bots.inboundCount() === 0) {
        endRound('t', 'CANYON GUARD ELIMINATED');
      } else if (S.timer <= 0) {
        endRound('ct', 'TIME EXPIRED');
      }
      return;
    }
    if (S.phase === 'post') {
      S.postTimer -= dt;
      if (S.postTimer <= 0) {
        if (S.matchWinner) {
          S.phase = 'matchEnd';
          if (callbacks.onMatchEnd) callbacks.onMatchEnd(S.matchWinner);
        } else {
          S.round++;
          beginBuy();
        }
      }
    }
  }

  function setShot(mode) {
    S.phase = mode === 'end' ? 'matchEnd' : mode === 'play' ? 'live' : 'buy';
    S.maxRounds = 15;
    S.winsNeeded = 8;
    S.matchWinner = mode === 'end' ? 'ct' : null;
    S.round = mode === 'play' ? 8 : mode === 'end' ? 13 : mode === 'buy' ? 3 : 1;
    S.scoreCT = mode === 'end' ? 8 : mode === 'play' ? 4 : mode === 'buy' ? 3 : 0;
    S.scoreT = mode === 'end' ? 5 : mode === 'play' ? 3 : mode === 'buy' ? 2 : 0;
    S.money = mode === 'buy' ? 5200 : mode === 'play' ? 3250 : 800;
    S.lossStreak = 0;
    S.buyTimer = 0;
    S.timer = mode === 'play' ? 26.4 : ROUND_TIME;
    S.objective = mode === 'buy' ? 'BUY PHASE' : mode === 'end' ? 'MATCH COMPLETE' : mode === 'start' ? 'AWAITING DEPLOYMENT' : 'DEFUSE THE CHARGE';
    S.grenades = mode === 'play' ? 1 : mode === 'buy' ? 1 : 0;
    S.kills = mode === 'play' ? 12 : 0;
    S.deaths = mode === 'play' ? 5 : 0;
    S.headshots = mode === 'play' ? 6 : 0;
    S.armor = mode === 'buy' ? 100 : mode === 'play' ? 62 : 0;
    S.alive = true;
    S.hp = mode === 'play' ? 78 : 100;
    S.inventory = { pistol: true, rifle: mode !== 'start', sniper: false, shotgun: false };
    S.weapon = mode === 'play' || mode === 'buy' ? 'rifle' : 'pistol';
    S.reloading = false;
    S.ammo.rifle = { mag: mode === 'play' ? 21 : 30, reserve: 60 };
    S.ammo.pistol = { mag: 12, reserve: 36 };
    S.mag = S.weapon === 'rifle' ? S.ammo.rifle.mag : S.ammo.pistol.mag;
    S.reserve = S.weapon === 'rifle' ? S.ammo.rifle.reserve : S.ammo.pistol.reserve;
    resetBomb();
    if (mode === 'play') {
      S.bomb.planted = true;
      S.bomb.site = world.sites.A;
      S.bomb.x = 24.4;
      S.bomb.z = -14.7;
      S.bomb.timer = 26.4;
      S.bomb.beep = 1;
      S.timer = 26.4;
    }
    player.armor = S.armor;
    if (mode === 'start') {
      player.setPose(0, 27, 0, -0.035);
    } else if (mode === 'play') {
      player.setPose(22, -18, -2.24, -0.055);
    } else if (mode === 'buy') {
      player.setPose(0, 29, 0, -0.02);
    } else {
      player.setPose(18, -7, -2.35, -0.01);
    }
    const stagedHp = mode === 'play' ? 78 : 100;
    player.hp = stagedHp;
    S.hp = stagedHp;
    S.armor = Math.round(player.armor);
    bots.stageShot(mode);
    buyPaused = true;
  }

  return {
    setCallbacks,
    startMatch,
    beginBuy,
    startBuyTimer,
    setBuyPaused,
    plant,
    defuse,
    endRound,
    buyWeapon,
    buyArmor,
    buyGrenade,
    update,
    setShot,
  };
}
