import * as THREE from 'three';
import { S, addFeed } from './state.js';
import { PALETTE } from './palette.js';
import { createInput } from './input.js';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createBots } from './bots.js';
import { createRounds } from './rounds.js';
import { WEAPONS, createWeaponSystem, createViewModel } from './weapon.js';
import { createSfx } from './sfx.js';
import { createFx } from './fx.js';
import { createHud } from './hud.js';
import { createGrenades } from './grenade.js';

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot');
const shotSeed = Number(params.get('seed') || 1);
const BUY_KEYS = ['rifle', 'shotgun', 'sniper', 'armor', 'grenade', 'pistol'];
const SLOT_KEYS = ['pistol', 'rifle', 'sniper', 'shotgun'];

let renderer;
let scene;
let camera;
let world;
let fx;
let sfx;
let player;
let bots;
let rounds;
let weapons;
let viewmodel;
let grenades;
let hud;
let input;
let bombVisual;
let started = false;
let elapsed = 0;
let lastDamagePulse = 0;
let playerUpdated = false;

window.__shotReady = false;

const clock = new THREE.Clock();
const muzzle = new THREE.Vector3();
const shotDir = new THREE.Vector3();
const shotRight = new THREE.Vector3();
const shotUp = new THREE.Vector3();
const scopeEl = document.getElementById('scope');

function createBombVisual() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.24, 0.34),
    new THREE.MeshStandardMaterial({ color: PALETTE.slateDark, roughness: 0.52, metalness: 0.45 }),
  );
  body.position.y = 0.12;
  body.castShadow = true;
  group.add(body);
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.035, 0.24),
    new THREE.MeshStandardMaterial({ color: PALETTE.rust, roughness: 0.62, metalness: 0.2 }),
  );
  plate.position.y = 0.255;
  group.add(plate);
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.03, 0.12),
    new THREE.MeshBasicMaterial({ color: PALETTE.goldSoft }),
  );
  pad.position.set(0.03, 0.276, 0);
  group.add(pad);
  const ledMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.t });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), ledMaterial);
  led.position.set(-0.14, 0.28, 0.03);
  group.add(led);
  const light = new THREE.PointLight(PALETTE.t, 0, 5, 2);
  light.position.set(0, 0.35, 0);
  group.add(light);
  group.visible = false;
  scene.add(group);
  return { group, ledMaterial, light };
}

function handleDeploy() {
  if (shotMode) return;
  sfx.unlock();
  started = true;
  hud.hideOverlay();
  rounds.startMatch();
}

function handleBuy(id) {
  if (!hud.isBuyOpen()) return { ok: false, reason: 'Loadout closed' };
  let result;
  if (id === 'armor') result = rounds.buyArmor();
  else if (id === 'grenade') result = rounds.buyGrenade();
  else result = rounds.buyWeapon(id);
  if (result.ok) {
    viewmodel.show(S.weapon);
    hud.updateBuy();
  }
  return result;
}

function openBuy() {
  if (S.phase !== 'buy' || shotMode) return;
  hud.showBuy(true);
  rounds.setBuyPaused(true);
  input.exitLock();
}

function closeBuy() {
  hud.showBuy(false);
  if (S.phase === 'buy') {
    rounds.setBuyPaused(false);
    rounds.startBuyTimer();
  }
  sfx.unlock();
  if (!shotMode) input.requestLock();
}

function canPlay() {
  return S.phase === 'live' && player.alive && !hud.isBuyOpen() && input.state.locked;
}

function fireWeapon() {
  if (!canPlay()) return;
  const shot = weapons.fire();
  if (!shot) return;
  if (shot.empty) {
    sfx.empty();
    return;
  }
  const weapon = shot.weapon;
  player.addRecoil(shot.pitch, shot.yaw);
  viewmodel.addKick();
  S.screenShake = Math.min(1, S.screenShake + weapon.recoilPitch * 7 + 0.1);
  camera.getWorldDirection(shotDir);
  shotRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
  shotUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  viewmodel.muzzleWorld(muzzle);
  const spread = weapons.currentSpread(player.speed, !player.grounded, player.crouching);
  let hitSomething = false;
  for (let pellet = 0; pellet < weapon.pellets; pellet++) {
    const dirX = shotDir.x + shotRight.x * (Math.random() - 0.5) * spread * 2 + shotUp.x * (Math.random() - 0.5) * spread * 2;
    const dirY = shotDir.y + shotRight.y * (Math.random() - 0.5) * spread * 2 + shotUp.y * (Math.random() - 0.5) * spread * 2;
    const dirZ = shotDir.z + shotRight.z * (Math.random() - 0.5) * spread * 2 + shotUp.z * (Math.random() - 0.5) * spread * 2;
    const length = Math.hypot(dirX, dirY, dirZ) || 1;
    const dx = dirX / length;
    const dy = dirY / length;
    const dz = dirZ / length;
    const wall = world.rayBlocked(camera.position.x, camera.position.y, camera.position.z, dx, dy, dz, weapon.range);
    const limit = Math.min(weapon.range, wall);
    const hit = bots.rayHit(camera.position.x, camera.position.y, camera.position.z, dx, dy, dz, limit + 0.05, 'ct', null);
    let endX = camera.position.x + dx * limit;
    let endY = camera.position.y + dy * limit;
    let endZ = camera.position.z + dz * limit;
    if (hit) {
      endX = camera.position.x + dx * hit.dist;
      endY = camera.position.y + dy * hit.dist;
      endZ = camera.position.z + dz * hit.dist;
      const falloff = 1 - (hit.dist / weapon.range) * weapon.falloff;
      const damage = weapon.damage * Math.max(0.22, falloff);
      const dealt = bots.damageBot(hit.bot, damage, hit.part, 'RANGER', true, weapon.headMult);
      if (dealt > 0) {
        hitSomething = true;
        sfx.hit(hit.part === 'head');
        fx.bloodBurst(endX, endY, endZ);
      }
    } else if (wall < weapon.range) {
      fx.impact(endX, endY, endZ, dx, dy, dz);
    }
    fx.tracer(muzzle.x, muzzle.y, muzzle.z, endX, endY, endZ, weapon.tracer);
  }
  fx.muzzle(muzzle.x, muzzle.y, muzzle.z, weapon.tracer, 0.42, 7);
  const sideX = shotRight.x * 0.65 + shotDir.x * 0.2;
  const sideZ = shotRight.z * 0.65 + shotDir.z * 0.2;
  fx.casing(muzzle.x, muzzle.y - 0.03, muzzle.z, sideX, sideZ);
  sfx.fire(weapon.sound, 0.82);
  bots.hear(player.x, player.z, 't', 32, 'ct');
  if (hitSomething) S.screenShake = Math.min(1, S.screenShake + 0.05);
}

function updateDefuse(dt) {
  if (!S.bomb.planted || !player.alive || S.phase !== 'live') {
    if (S.bomb.defuse > 0) S.bomb.defuse = 0;
    return;
  }
  const distance = Math.hypot(player.x - S.bomb.x, player.z - S.bomb.z);
  if (distance > 2.15 || !input.keys.KeyE) {
    if (S.bomb.defuse > 0) S.bomb.defuse = 0;
    return;
  }
  S.bomb.defuse = Math.min(1, S.bomb.defuse + dt / 5.2);
  if (S.bomb.defuse >= 1) {
    S.bomb.defuse = 0;
    rounds.defuse('RANGER');
  }
}

function switchWeapon(id) {
  if (!WEAPONS[id] || !S.inventory[id]) return;
  weapons.equip(id);
  viewmodel.show(id);
  sfx.beep(620, 0.06, 0.045);
}

function onKeyDown(event) {
  if (event.repeat) return;
  if (event.code === 'KeyM') {
    const muted = sfx.toggleMute();
    addFeed(muted ? 'AUDIO MUTED' : 'AUDIO ENABLED');
    return;
  }
  if (event.code === 'KeyB') {
    if (shotMode) return;
    if (hud.isBuyOpen()) closeBuy();
    else if (S.phase === 'buy') openBuy();
    return;
  }
  if (event.code === 'KeyR') {
    if (S.phase === 'live' && player.alive && !hud.isBuyOpen() && weapons.startReload()) sfx.reload();
    return;
  }
  if (event.code === 'KeyG') {
    if (canPlay() && grenades.throwFromPlayer(camera)) {
      viewmodel.show(S.weapon);
    }
    return;
  }
  if (event.code.startsWith('Digit')) {
    const index = Number(event.code.slice(5)) - 1;
    if (index < 0 || index > 5) return;
    if (hud.isBuyOpen()) {
      handleBuy(BUY_KEYS[index]);
      return;
    }
    if (canPlay() && index < 4) switchWeapon(SLOT_KEYS[index]);
  }
}

function updateCameraEffects(dt) {
  const scoped = S.weapon === 'sniper'
    && input.mouse.right
    && player.alive
    && S.phase === 'live'
    && !hud.isBuyOpen()
    && input.state.locked
    && !shotMode;
  const targetFov = scoped ? 32 : 74;
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 15);
  if (Math.abs(camera.fov - targetFov) > 0.02) camera.updateProjectionMatrix();
  viewmodel.root.visible = !scoped;
  scopeEl.hidden = !scoped;
  const crosshair = document.getElementById('crosshair');
  if (crosshair) crosshair.hidden = scoped;
  if (playerUpdated) {
    S.screenShake = Math.max(0, S.screenShake - dt * 2.7);
    if (S.screenShake > 0.001) {
      const amp = S.screenShake * 0.036;
      camera.position.x += Math.sin(elapsed * 67) * amp;
      camera.position.y += Math.cos(elapsed * 83) * amp * 0.65;
      camera.rotation.z += Math.sin(elapsed * 53) * amp * 0.22;
    }
  }
}

function updateGame(dt) {
  const menuOpen = hud.isBuyOpen();
  const live = S.phase === 'live';
  const paused = !started || S.phase === 'matchEnd' || menuOpen || (live && !input.state.locked);
  playerUpdated = false;
  if (!paused) {
    const canMove = (S.phase === 'live' || S.phase === 'buy') && player.alive;
    player.update(dt, input, canMove);
    playerUpdated = true;
    weapons.update(dt);
    bots.update(dt);
    rounds.update(dt);
    if (S.phase === 'live') {
      updateDefuse(dt);
      grenades.update(dt);
    }
    if (S.damagePulse !== lastDamagePulse) {
      lastDamagePulse = S.damagePulse;
      sfx.damage();
      S.screenShake = Math.max(S.screenShake, 0.52);
    }
    if (canPlay()) {
      const weapon = WEAPONS[S.weapon];
      const fireHeld = input.mouse.left && weapon.auto;
      const firePressed = input.mouse.leftPressed && !weapon.auto;
      if (fireHeld || firePressed) fireWeapon();
    }
  }
  viewmodel.show(S.weapon);
  viewmodel.update(dt, {
    speed: player.speed,
    bob: player.bob,
    crouching: player.crouching,
    reloading: S.reloading,
    dead: !player.alive,
  });
  bombVisual.group.visible = S.bomb.planted;
  if (S.bomb.planted) {
    bombVisual.group.position.set(S.bomb.x, 0, S.bomb.z);
    const rate = S.bomb.timer < 10 ? 12 : 5;
    const on = Math.sin(elapsed * rate) > 0;
    bombVisual.light.intensity = on ? 1.4 : 0.08;
    bombVisual.ledMaterial.color.setHex(on ? PALETTE.goldSoft : PALETTE.t);
  } else {
    bombVisual.light.intensity = 0;
  }
}

function updateShot(dt) {
  viewmodel.show(S.weapon);
  viewmodel.update(dt, {
    speed: 0,
    bob: 0,
    crouching: false,
    reloading: S.reloading,
    dead: false,
  });
  bombVisual.group.visible = S.bomb.planted;
  if (S.bomb.planted) {
    bombVisual.group.position.set(S.bomb.x, 0, S.bomb.z);
    bombVisual.light.intensity = Math.sin(elapsed * 5) > 0 ? 1.4 : 0.08;
  } else {
    bombVisual.light.intensity = 0;
  }
}

function configureShot(mode) {
  started = true;
  S.shotMode = true;
  rounds.setShot(mode);
  viewmodel.show(S.weapon);
  hud.setPointerLocked(true);
  S.feed.length = 0;
  S.feedSeq = 0;
  if (mode === 'play') {
    S.feed = [
      { id: 1, text: 'SHERIFF [CINDER AR] MAGPIE', ttl: 5 },
      { id: 2, text: 'VULCAN PLANTED @ A', ttl: 5 },
      { id: 3, text: 'DAGGER [LONGSHOT M90] TALON', ttl: 5 },
    ];
    S.feedSeq = 3;
  }
  if (mode === 'start') {
    hud.showStart();
  } else if (mode === 'buy') {
    hud.hideOverlay();
    hud.showBuy(true);
  } else if (mode === 'end') {
    hud.hideOverlay();
    hud.showMatchEnd('ct');
  } else {
    hud.hideOverlay();
    hud.showBuy(false);
  }
  camera.fov = 74;
  camera.updateProjectionMatrix();
  hud.update(0);
  setTimeout(() => {
    window.__shotReady = true;
  }, 550);
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  if (shotMode) {
    updateShot(dt);
  } else {
    updateGame(dt);
    updateCameraEffects(dt);
  }
  hud.update(dt);
  renderer.render(scene, camera);
  input.endFrame();
}

function init() {
  const host = document.getElementById('game');
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  host.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 42, 118);
  camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 220);
  scene.add(camera);

  world = createWorld(scene);
  fx = createFx(scene);
  sfx = createSfx();
  player = createPlayer(world, camera, S);
  bots = createBots(scene, world, fx, S, sfx, player);
  weapons = createWeaponSystem(S);
  viewmodel = createViewModel(camera);
  viewmodel.show(S.weapon);
  grenades = createGrenades(scene, world, fx, sfx, S, player, bots);
  rounds = createRounds({ S, world, player, bots, weapons, sfx });
  hud = createHud({
    S,
    world,
    player,
    bots,
    onBuy: handleBuy,
    onCloseBuy: closeBuy,
    onDeploy: handleDeploy,
  });
  input = createInput(renderer.domElement, (locked) => {
    hud.setPointerLocked(locked);
    if (locked) sfx.unlock();
  });
  bombVisual = createBombVisual();
  bots.setCallbacks({
    plant: (site, x, z, bot) => rounds.plant(site, x, z, bot),
    defuse: (bot) => rounds.defuse(bot),
  });
  rounds.setCallbacks({
    onBuyStart: (round) => {
      if (shotMode) return;
      hud.showBuy(true);
      rounds.setBuyPaused(true);
      input.exitLock();
      hud.showBanner(`ROUND ${round}`, 'BUY PHASE', 'SELECT YOUR LOADOUT', '');
    },
    onLive: (round) => {
      hud.showBuy(false);
      hud.showBanner(`ROUND ${round}`, 'LIVE', 'DEFEND SITES A / B', '');
      if (!shotMode && started) input.requestLock();
    },
    onRoundEnd: (winner, reason) => {
      hud.showBuy(false);
      hud.showBanner(winner === 'ct' ? 'ROUND WON' : 'ROUND LOST', `ROUND ${S.round}`, reason, winner);
    },
    onMatchEnd: (winner) => {
      hud.showMatchEnd(winner);
      input.exitLock();
    },
    onPlant: (bomb) => {
      hud.showBanner('CHARGE PLANTED', `SITE ${bomb.site ? bomb.site.name : '?'}`, 'DEFUSE BEFORE DETONATION', 't');
    },
    onDefuse: (bomb) => {
      hud.showBanner('CHARGE DEFUSED', `SITE ${bomb.site ? bomb.site.name : '?'}`, 'ROUND SECURED', 'ct');
    },
    onExplode: (bomb) => {
      fx.explosion(bomb.x, 0.25, bomb.z);
      sfx.explosion();
      S.screenShake = 1;
    },
  });
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', onKeyDown);
  renderer.domElement.addEventListener('mousedown', (event) => {
    if (event.button === 0 && !input.state.locked && started && !hud.isBuyOpen() && !shotMode && (S.phase === 'live' || S.phase === 'buy')) {
      sfx.unlock();
      input.requestLock();
    }
  });

  player.reset(world.spawns.ct[0]);
  player.armor = 0;
  bots.resetRound();
  hud.setPointerLocked(false);
  hud.showStart();
  hud.update(0);
  window.__sable = { S, player, bots, rounds, weapons, world, input, hud, camera, viewmodel, bombVisual };
  if (shotMode) configureShot(shotMode);
  animate();
}

init();
