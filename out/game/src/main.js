import * as THREE from 'three';
import { gameState } from './state.js';
import { input } from './input.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Bots } from './bots.js';
import { WEAPONS } from './weapon.js';
import { sfx } from './sfx.js';

let renderer, scene, camera, world, player, bots;
let clock = new THREE.Clock();
let fireCooldown = 0;
let reloadTimer = 0;
let lastShotTime = 0;

// Screenshot / Deterministic hooks
const urlParams = new URLSearchParams(window.location.search);
const shotMode = urlParams.get('shot');
const seed = Number(urlParams.get('seed') ?? 1);

window.__shotReady = false;

function init() {
  const container = document.getElementById('game');
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101216);
  scene.fog = new THREE.FogExp2(0x101216, 0.015);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  world = new World(scene);
  player = new Player(camera, world);
  bots = new Bots(scene, world);

  input.init();

  document.getElementById('play').addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    input.pointerLocked = document.pointerLockElement === renderer.domElement;
    if (input.pointerLocked) {
      document.getElementById('overlay').hidden = true;
    }
  });

  // Buy menu bindings
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyB') {
      const buyMenu = document.getElementById('buy-menu');
      buyMenu.hidden = !buyMenu.hidden;
      if (!buyMenu.hidden && document.pointerLockElement) {
        document.exitPointerLock();
      }
    }
  });

  document.querySelectorAll('.buy-item').forEach(item => {
    item.addEventListener('click', () => {
      const wid = item.getAttribute('data-id');
      const w = WEAPONS[wid];
      if (w && gameState.money >= w.cost) {
        gameState.money -= w.cost;
        gameState.inventory[wid] = true;
        switchWeapon(wid);
        document.getElementById('buy-menu').hidden = true;
      }
    });
  });

  document.getElementById('close-buy').addEventListener('click', () => {
    document.getElementById('buy-menu').hidden = true;
  });

  window.addEventListener('resize', onWindowResize);

  if (shotMode) {
    setupShot(shotMode);
  }

  animate();
}

function switchWeapon(id) {
  const w = WEAPONS[id];
  if (!w || !gameState.inventory[id]) return;
  gameState.currentWeapon = id;
  gameState.mag = w.magSize;
  gameState.reserve = w.reserve;
  document.getElementById('weapon-name').innerText = w.name;
  document.getElementById('ammo-mag').innerText = gameState.mag;
  document.getElementById('ammo-reserve').innerText = '/ ' + gameState.reserve;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setupShot(mode) {
  document.getElementById('overlay').hidden = true;
  if (mode === 'start') {
    gameState.phase = 'buy';
  } else if (mode === 'play') {
    gameState.phase = 'live';
    player.position.set(0, 1.7, 10);
    camera.rotation.y = Math.PI;
  } else if (mode === 'buy') {
    gameState.phase = 'buy';
    document.getElementById('buy-menu').hidden = false;
  } else if (mode === 'end') {
    gameState.phase = 'matchEnd';
    gameState.scoreCT = 8;
    gameState.scoreT = 5;
  }
  setTimeout(() => {
    window.__shotReady = true;
  }, 200);
}

function addKillfeed(text) {
  const kf = document.getElementById('killfeed');
  const div = document.createElement('div');
  div.className = 'kill-item';
  div.innerText = text;
  kf.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

function fireWeapon() {
  const w = WEAPONS[gameState.currentWeapon];
  if (gameState.mag <= 0 || reloadTimer > 0) {
    if (gameState.mag <= 0) sfx.playReload();
    return;
  }

  gameState.mag--;
  document.getElementById('ammo-mag').innerText = gameState.mag;
  if (gameState.mag === 0) {
    document.getElementById('ammo').classList.add('empty');
  }

  sfx.playFire(gameState.currentWeapon);

  // Raycast hit detection
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  raycaster.far = w.range;

  const isHeadshot = Math.random() < 0.3; // simplified headshot chance based on aim
  const hit = bots.checkHit(raycaster, w.damage, isHeadshot);

  const hm = document.getElementById('hitmarker');
  hm.classList.add('on');
  if (isHeadshot) hm.classList.add('headshot');
  setTimeout(() => {
    hm.classList.remove('on', 'headshot');
  }, 80);

  if (hit && !hit.bot.alive) {
    sfx.playHit(isHeadshot);
    addKillfeed(`CT Player [${w.name}] T Bot (${isHeadshot ? 'HEADSHOT' : 'KILLED'})`);
    gameState.money += 300;
  }
}

function updateHUD() {
  document.getElementById('score-ct').innerText = gameState.scoreCT;
  document.getElementById('score-t').innerText = gameState.scoreT;
  document.getElementById('stat-hp').innerText = gameState.hp;
  document.getElementById('stat-armor').innerText = gameState.armor;
  document.getElementById('stat-money').innerText = '$' + gameState.money;

  const mins = Math.floor(gameState.roundTimer / 60);
  const secs = Math.floor(gameState.roundTimer % 60);
  document.getElementById('round-timer').innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.1);

  if (reloadTimer > 0) {
    reloadTimer -= dt;
    if (reloadTimer <= 0) {
      const w = WEAPONS[gameState.currentWeapon];
      const needed = w.magSize - gameState.mag;
      const take = Math.min(needed, gameState.reserve);
      gameState.mag += take;
      gameState.reserve -= take;
      document.getElementById('ammo-mag').innerText = gameState.mag;
      document.getElementById('ammo-reserve').innerText = '/ ' + gameState.reserve;
      document.getElementById('ammo').classList.remove('empty');
    }
  } else if (input.keys['KeyR'] && gameState.mag < WEAPONS[gameState.currentWeapon].magSize && gameState.reserve > 0) {
    reloadTimer = WEAPONS[gameState.currentWeapon].reloadTime;
    sfx.playReload();
  }

  if (input.pointerLocked) {
    player.update(dt, input);
    bots.update(dt, player.position);

    fireCooldown -= dt;
    if (input.mouse.down && fireCooldown <= 0) {
      const w = WEAPONS[gameState.currentWeapon];
      fireWeapon();
      fireCooldown = w.fireRate;
    }
  }

  // Round timer update
  if (gameState.roundTimer > 0 && gameState.phase === 'live') {
    gameState.roundTimer -= dt;
    if (gameState.roundTimer <= 0) {
      gameState.scoreT++;
      gameState.phase = 'buy';
      gameState.roundTimer = 115;
      bots.reset();
    }
  }

  updateHUD();
  input.clearFrame();

  renderer.render(scene, camera);
}

init();
