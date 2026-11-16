import { WEAPONS } from './weapon.js';

const BUY_ITEMS = [
  { id: 'rifle', type: 'ASSAULT RIFLE', desc: '31 DMG · FULL AUTO\nMID / LONG RANGE', cost: 2700 },
  { id: 'shotgun', type: 'CLOSE QUARTERS', desc: '9 PELLETS · 12 DMG\nBREACH AND CLEAR', cost: 1100 },
  { id: 'sniper', type: 'PRECISION RIFLE', desc: '112 DMG · BOLT ACTION\nHOLD RMB TO SCOPE', cost: 4300 },
  { id: 'armor', type: 'PROTECTION', desc: 'FULL KEVLAR PLATE\nABSORBS 100 ARMOR', cost: 650 },
  { id: 'grenade', type: 'UTILITY', desc: 'HE FRAG CHARGE\n8.5M BLAST RADIUS', cost: 300 },
  { id: 'pistol', type: 'SIDEARM', desc: '34 DMG · SEMI AUTO\n12 ROUND MAGAZINE', cost: 300 },
];

function formatClock(seconds) {
  const clamped = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function setText(element, value) {
  if (element && element.textContent !== value) element.textContent = value;
}

export function createHud({ S, world, player, bots, onBuy, onCloseBuy, onDeploy }) {
  const el = {};
  const ids = [
    'hud', 'crosshair', 'hitmarker', 'damage-vignette', 'damage-dir', 'score-ct', 'score-t',
    'ct-alive', 't-alive', 'round-label', 'round-timer', 'bomb-status', 'killfeed', 'minimap',
    'stat-hp', 'stat-armor', 'stat-money', 'stat-kills', 'stat-deaths', 'hp-fill', 'weapon-name',
    'ammo', 'ammo-mag', 'ammo-reserve', 'grenade-count', 'slot-1', 'slot-2', 'slot-3', 'slot-4',
    'objective', 'prompt', 'defuse-wrap', 'defuse-fill', 'banner', 'banner-kicker', 'banner-title',
    'banner-sub', 'death-screen', 'buy-menu', 'buy-grid', 'buy-money', 'buy-note', 'close-buy',
    'overlay', 'play', 'overlay-score', 'overlay-title', 'overlay-copy', 'minimap-label',
  ];
  for (const id of ids) el[id] = document.getElementById(id);

  const minimapCtx = el.minimap.getContext('2d');
  const feedItems = new Map();
  const slots = [
    { key: 'pistol', dot: el['slot-1'] },
    { key: 'rifle', dot: el['slot-2'] },
    { key: 'sniper', dot: el['slot-3'] },
    { key: 'shotgun', dot: el['slot-4'] },
  ];
  let buyOpen = false;
  let lastHitPulse = S.hitPulse;
  let lastDamagePulse = S.damagePulse;
  let lastFeedSeq = 0;
  let hitTimer = 0;
  let damageTimer = 0;
  let dirTimer = 0;
  let bannerTimer = 0;
  let noteTimer = 0;
  let minimapTimer = 0;
  let pointerLocked = false;
  let lastBuyKey = '';
  const overlayTitle = document.querySelector('.start-panel h1');
  const overlayLede = document.querySelector('.lede');
  const overlaySpecs = document.querySelector('.specs');
  if (el.play) el.play.addEventListener('click', () => {
    el.overlay.hidden = true;
    if (onDeploy) onDeploy();
  });

  function buildBuyGrid() {
    for (const item of BUY_ITEMS) {
      const card = document.createElement('div');
      card.className = 'buy-item';
      card.dataset.buy = item.id;
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      const keyIndex = BUY_ITEMS.indexOf(item) + 1;
      const name = item.id === 'armor' ? 'KEVLAR' : item.id === 'grenade' ? 'FRAG CHARGE' : WEAPONS[item.id].name;
      card.innerHTML = `<span class="key">${keyIndex}</span><h3>${name}</h3><div class="type">${item.type}</div><p class="desc">${item.desc.replace(/\n/g, '<br>')}</p><div class="cost-row"><span class="cost"></span><span class="owned-tag"></span></div>`;
      const activate = () => {
        if (!buyOpen) return;
        const result = onBuy ? onBuy(item.id) : null;
        if (result && !result.ok) flashNote(result.reason);
      };
      card.addEventListener('click', activate);
      card.addEventListener('keydown', (event) => {
        if (event.code === 'Enter' || event.code === 'Space') {
          event.preventDefault();
          activate();
        }
      });
      el['buy-grid'].appendChild(card);
    }
  }

  buildBuyGrid();

  if (el['close-buy']) {
    el['close-buy'].addEventListener('click', () => {
      if (onCloseBuy) onCloseBuy();
    });
  }

  function flashNote(text) {
    if (!el['buy-note']) return;
    el['buy-note'].textContent = text || '';
    noteTimer = 2.2;
  }

  function updateBuy() {
    setText(el['buy-money'], `$${S.money.toLocaleString('en-US')}`);
    const cards = el['buy-grid'].children;
    for (const card of cards) {
      const id = card.dataset.buy;
      const item = BUY_ITEMS.find((entry) => entry.id === id);
      const weapon = WEAPONS[id];
      const owned = weapon ? S.inventory[id] : id === 'armor' ? player.armor >= 100 : S.grenades >= 2;
      const maxed = id === 'armor' ? player.armor >= 100 : id === 'grenade' ? S.grenades >= 2 : false;
      const cost = weapon ? weapon.cost : item.cost;
      const affordable = S.money >= cost;
      card.classList.toggle('owned', owned && !maxed);
      card.classList.toggle('unaffordable', !owned && !affordable);
      const costEl = card.querySelector('.cost');
      const tagEl = card.querySelector('.owned-tag');
      setText(costEl, owned ? 'READY' : `$${cost.toLocaleString('en-US')}`);
      if (maxed) setText(tagEl, 'MAX');
      else if (owned && weapon) setText(tagEl, 'OWNED');
      else setText(tagEl, affordable ? 'BUY' : 'LOCKED');
      const key = `${owned}|${maxed}|${affordable}|${S.money}`;
      if (key !== lastBuyKey) lastBuyKey = key;
    }
  }

  function showBuy(open) {
    buyOpen = open;
    el['buy-menu'].hidden = !open;
    if (open) {
      el['buy-note'].textContent = '';
      updateBuy();
    }
  }

  function isBuyOpen() {
    return buyOpen;
  }

  function showBanner(title, kicker, sub, result = '') {
    el['banner-title'].textContent = title;
    el['banner-kicker'].textContent = kicker || '';
    el['banner-sub'].textContent = sub || '';
    el.banner.className = `show ${result}`.trim();
    bannerTimer = 3.1;
  }

  function showStart() {
    el.overlay.hidden = false;
    el.overlay.classList.remove('end', 'loss');
    overlayTitle.innerHTML = 'SABLE <em>CANYON</em>';
    overlayLede.textContent = 'A five-versus-five bomb defusal operation inside Foundry 07. Hold the canyon, break the Ashen Hand assault, and defuse the charge before the clock burns out.';
    overlaySpecs.style.display = '';
    el['overlay-score'].innerHTML = '';
    el.play.textContent = 'DEPLOY TO FOUNDRY';
    el['buy-menu'].hidden = true;
    buyOpen = false;
  }

  function showMatchEnd(winner) {
    el.overlay.hidden = false;
    el.overlay.classList.add('end');
    el.overlay.classList.toggle('loss', winner !== 'ct');
    const won = winner === 'ct';
    overlayTitle.innerHTML = won ? 'MATCH <em>WON</em>' : 'MATCH <em>LOST</em>';
    overlayLede.textContent = won
      ? 'The canyon holds. Foundry 07 is secure and the Ashen Hand assault has been broken.'
      : 'The Ashen Hand broke through. Foundry 07 is lost, but another deployment is ready.';
    overlaySpecs.style.display = 'none';
    el['overlay-score'].innerHTML = `<span class="ct">CANYON GUARD ${S.scoreCT}</span> &nbsp;—&nbsp; <b>${S.scoreCT > S.scoreT ? 'VICTORY' : 'DEFEAT'}</b> &nbsp;—&nbsp; <span class="t">${S.scoreT} ASHEN HAND</span>`;
    el.play.textContent = 'REDEPLOY';
    el['buy-menu'].hidden = true;
    buyOpen = false;
    el['death-screen'].hidden = true;
    showBanner(won ? 'CANYON SECURED' : 'FOUNDRY LOST', 'MATCH COMPLETE', `${S.scoreCT} — ${S.scoreT}`, won ? 'win' : 't');
  }

  function hideOverlay() {
    el.overlay.hidden = true;
  }

  function setPointerLocked(value) {
    pointerLocked = value;
  }

  function updateFeed() {
    if (S.feedSeq < lastFeedSeq) {
      for (const [, node] of feedItems) node.remove();
      feedItems.clear();
    }
    lastFeedSeq = S.feedSeq;
    for (const entry of S.feed) {
      if (feedItems.has(entry.id)) continue;
      const node = document.createElement('div');
      node.className = 'kill-item';
      node.textContent = entry.text;
      el.killfeed.appendChild(node);
      feedItems.set(entry.id, node);
      setTimeout(() => {
        node.remove();
        feedItems.delete(entry.id);
      }, 6200);
    }
    const ids = new Set(S.feed.map((entry) => entry.id));
    for (const [id, node] of feedItems) {
      if (!ids.has(id)) {
        node.remove();
        feedItems.delete(id);
      }
    }
  }

  function updateMinimap() {
    const ctx = minimapCtx;
    const width = el.minimap.width;
    const height = el.minimap.height;
    const pad = 14;
    const mapX = (x) => pad + ((x + 48) / 96) * (width - pad * 2);
    const mapY = (z) => pad + ((z + 36) / 72) * (height - pad * 2);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0b1011';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(232,221,196,0.075)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const x = pad + (i / 6) * (width - pad * 2);
      ctx.beginPath();
      ctx.moveTo(x, pad);
      ctx.lineTo(x, height - pad);
      ctx.stroke();
    }
    for (let i = 1; i < 5; i++) {
      const y = pad + (i / 5) * (height - pad * 2);
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(width - pad, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(224,169,74,0.28)';
    ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);
    for (const collider of world.colliders) {
      if (collider.maxY - collider.minY < 0.45) continue;
      const x = mapX(collider.minX);
      const y = mapY(collider.minZ);
      const w = mapX(collider.maxX) - x;
      const h = mapY(collider.maxZ) - y;
      ctx.fillStyle = collider.maxY > 4 ? 'rgba(210,220,210,0.11)' : 'rgba(210,220,210,0.07)';
      ctx.fillRect(x, y, w, h);
    }
    for (const site of [world.sites.A, world.sites.B]) {
      const x = mapX(site.x);
      const y = mapY(site.z);
      ctx.beginPath();
      ctx.arc(x, y, 19, 0, Math.PI * 2);
      ctx.fillStyle = site.name === 'A' ? 'rgba(79,149,216,0.14)' : 'rgba(210,90,58,0.14)';
      ctx.fill();
      ctx.strokeStyle = site.name === 'A' ? 'rgba(79,149,216,0.55)' : 'rgba(210,90,58,0.55)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(240,237,228,0.72)';
      ctx.font = '700 17px "Cascadia Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(site.name, x, y + 1);
    }
    if (S.bomb.planted) {
      const x = mapX(S.bomb.x);
      const y = mapY(S.bomb.z);
      const pulse = 0.55 + Math.sin(performance.now() * 0.012) * 0.35;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,96,42,${pulse})`;
      ctx.fill();
    }
    for (const bot of bots.list) {
      if (!bot.alive) continue;
      const x = mapX(bot.x);
      const y = mapY(bot.z);
      ctx.beginPath();
      ctx.arc(x, y, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = bot.team === 'ct' ? '#71a9e2' : '#e16845';
      ctx.fill();
    }
    if (player.alive) {
      const x = mapX(player.x);
      const y = mapY(player.z);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-player.yaw);
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(7, 7);
      ctx.lineTo(0, 3);
      ctx.lineTo(-7, 7);
      ctx.closePath();
      ctx.fillStyle = '#f5f0e4';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      const forwardX = -Math.sin(player.yaw);
      const forwardZ = -Math.cos(player.yaw);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + forwardX * 19, y + forwardZ * 19);
      ctx.strokeStyle = 'rgba(245,240,228,0.22)';
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(232,221,196,0.24)';
    ctx.font = '9px "Cascadia Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('N', pad + 2, pad + 12);
  }

  function update(dt) {
    const weapon = WEAPONS[S.weapon];
    setText(el['score-ct'], String(S.scoreCT));
    setText(el['score-t'], String(S.scoreT));
    setText(el['ct-alive'], String(bots.aliveCount('ct') + (player.alive ? 1 : 0)));
    setText(el['t-alive'], String(bots.aliveCount('t')));
    setText(el['stat-money'], `$${S.money.toLocaleString('en-US')}`);
    setText(el['stat-kills'], String(S.kills));
    setText(el['stat-deaths'], String(S.deaths));
    setText(el['stat-hp'], String(Math.max(0, Math.round(S.hp))));
    setText(el['stat-armor'], String(Math.max(0, Math.round(S.armor))));
    el['stat-hp'].classList.toggle('critical', S.hp <= 30);
    el['hp-fill'].style.width = `${Math.max(0, Math.min(100, S.hp))}%`;
    el['hp-fill'].style.background = S.hp <= 30 ? '#d25a3a' : S.hp <= 60 ? '#e0a94a' : '#77b88a';
    el['weapon-name'].innerHTML = `<b>${weapon ? weapon.name : 'UNARMED'}</b>${weapon ? ` · ${weapon.tag}` : ''}${S.reloading ? ' · RELOADING' : ''}`;
    setText(el['ammo-mag'], String(S.mag));
    setText(el['ammo-reserve'], `/ ${S.reserve}`);
    el['ammo'].classList.toggle('empty', S.mag === 0);
    setText(el['grenade-count'], String(S.grenades));
    for (const slot of slots) slot.dot.classList.toggle('on', !!S.inventory[slot.key]);
    setText(el['objective'], S.objective || 'AWAITING DEPLOYMENT');

    let clockText = formatClock(S.timer);
    let roundLabel = `ROUND ${S.round} / ${S.maxRounds}`;
    if (S.phase === 'buy') {
      clockText = S.buyTimer > 0 ? formatClock(S.buyTimer) : 'LOADOUT';
      roundLabel = `ROUND ${S.round} / ${S.maxRounds} · BUY`;
    } else if (S.phase === 'post') {
      clockText = 'ROUND OVER';
      roundLabel = `ROUND ${S.round} / ${S.maxRounds}`;
    } else if (S.phase === 'matchEnd') {
      clockText = 'FINAL';
      roundLabel = 'MATCH COMPLETE';
    } else if (S.bomb.planted) {
      clockText = formatClock(S.bomb.timer);
    }
    setText(el['round-timer'], clockText);
    setText(el['round-label'], roundLabel);

    if (S.bomb.planted) {
      const site = S.bomb.site ? S.bomb.site.name : '?';
      setText(el['bomb-status'], `CHARGE @ ${site} · ${formatClock(S.bomb.timer)}`);
      el['bomb-status'].classList.add('active');
      el['bomb-status'].classList.toggle('critical', S.bomb.timer < 10);
    } else {
      setText(el['bomb-status'], S.phase === 'post' ? 'ROUND RESOLVED' : 'BOMB: A / B');
      el['bomb-status'].classList.remove('active', 'critical');
    }

    if (S.hitPulse !== lastHitPulse) {
      lastHitPulse = S.hitPulse;
      el.hitmarker.classList.toggle('headshot', !!S.hitHead);
      el.hitmarker.classList.add('on');
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => el.hitmarker.classList.remove('on', 'headshot'), 95);
    }
    if (S.damagePulse !== lastDamagePulse) {
      lastDamagePulse = S.damagePulse;
      el['damage-vignette'].classList.add('hit');
      clearTimeout(damageTimer);
      damageTimer = setTimeout(() => el['damage-vignette'].classList.remove('hit'), 190);
      const dx = S.damageFromX - player.x;
      const dz = S.damageFromZ - player.z;
      const right = dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw);
      const forward = -dx * Math.sin(player.yaw) - dz * Math.cos(player.yaw);
      const bearing = Math.atan2(right, forward);
      el['damage-dir'].style.transform = `rotate(${bearing}rad)`;
      el['damage-dir'].classList.add('on');
      clearTimeout(dirTimer);
      dirTimer = setTimeout(() => el['damage-dir'].classList.remove('on'), 520);
    }

    const spread = player.speed > 5.4 ? 'spread-2' : player.speed > 2.2 ? 'spread-1' : '';
    el.crosshair.className = `${spread}${S.reloading ? ' reloading' : ''}`.trim();
    updateFeed();

    const alive = S.alive && player.alive;
    el['death-screen'].hidden = alive || (S.phase !== 'live' && S.phase !== 'post');
    const nearBomb = S.bomb.planted && player.alive && Math.hypot(player.x - S.bomb.x, player.z - S.bomb.z) < 2.1;
    let prompt = '';
    if (!alive) prompt = '';
    else if (S.phase === 'buy') prompt = buyOpen ? 'SELECT A LOADOUT · 1–6 TO BUY' : !pointerLocked ? 'CLICK TO CAPTURE MOUSE · B FOR LOADOUT' : 'PRESS B TO OPEN LOADOUT';
    else if (S.phase === 'live' && nearBomb) prompt = 'HOLD E TO DEFUSE THE CHARGE';
    else if (S.phase === 'live' && !pointerLocked && !buyOpen) prompt = 'CLICK TO CAPTURE MOUSE';
    else if (S.phase === 'post') prompt = '';
    setText(el.prompt, prompt);
    el.prompt.hidden = !prompt;
    const defusing = S.bomb.planted && S.bomb.defuse > 0 && player.alive;
    el['defuse-wrap'].hidden = !defusing;
    if (defusing) {
      el['defuse-fill'].style.width = `${Math.min(100, S.bomb.defuse * 100)}%`;
    }

    if (buyOpen) updateBuy();
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) el.banner.classList.remove('show');
    }
    if (noteTimer > 0) {
      noteTimer -= dt;
      if (noteTimer <= 0) el['buy-note'].textContent = '';
    }
    minimapTimer -= dt;
    if (minimapTimer <= 0) {
      minimapTimer = 0.06;
      updateMinimap();
    }
  }

  return {
    update,
    showBuy,
    isBuyOpen,
    showBanner,
    showStart,
    showMatchEnd,
    hideOverlay,
    setPointerLocked,
    flashNote,
    updateBuy,
  };
}
