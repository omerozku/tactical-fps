import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'WARDEN P9', tag: 'SIDEARM', cost: 300,
    damage: 34, headMult: 2.4, fireRate: 0.16, auto: false,
    mag: 12, reserve: 36, reload: 1.35, range: 70, falloff: 0.55,
    baseSpread: 0.0035, moveSpread: 0.05, airSpread: 0.075, crouchFactor: 0.62,
    recoilPitch: 0.019, recoilYaw: 0.006, bloom: 0.003, pellets: 1,
    tracer: PALETTE.goldSoft, sound: 'pistol',
  },
  rifle: {
    id: 'rifle', name: 'CINDER AR', tag: 'RIFLE', cost: 2700,
    damage: 31, headMult: 2.6, fireRate: 0.088, auto: true,
    mag: 30, reserve: 90, reload: 2.05, range: 105, falloff: 0.34,
    baseSpread: 0.0018, moveSpread: 0.045, airSpread: 0.09, crouchFactor: 0.58,
    recoilPitch: 0.020, recoilYaw: 0.0075, bloom: 0.0022, pellets: 1,
    tracer: PALETTE.goldSoft, sound: 'rifle',
  },
  sniper: {
    id: 'sniper', name: 'LONGSHOT M90', tag: 'SNIPER', cost: 4300,
    damage: 112, headMult: 2.0, fireRate: 0.95, auto: false,
    mag: 5, reserve: 20, reload: 2.75, range: 150, falloff: 0.12,
    baseSpread: 0.00035, moveSpread: 0.085, airSpread: 0.12, crouchFactor: 0.5,
    recoilPitch: 0.085, recoilYaw: 0.01, bloom: 0.02, pellets: 1,
    tracer: PALETTE.cream, sound: 'sniper',
  },
  shotgun: {
    id: 'shotgun', name: 'BREACHER 12', tag: 'SHOTGUN', cost: 1100,
    damage: 12, headMult: 1.55, fireRate: 0.72, auto: false,
    mag: 6, reserve: 24, reload: 2.5, range: 34, falloff: 0.82,
    baseSpread: 0.052, moveSpread: 0.03, airSpread: 0.07, crouchFactor: 0.8,
    recoilPitch: 0.062, recoilYaw: 0.018, bloom: 0.012, pellets: 9,
    tracer: PALETTE.rust, sound: 'shotgun',
  },
};

const RECOIL_PATTERN = [0.7, -0.5, 0.8, -0.9, 0.35, -0.7, 1, -0.25, 0.55, -0.85, 0.2, -0.4];

export function createWeaponSystem(S) {
  const data = {
    cooldown: 0,
    reloadTimer: 0,
    bloom: 0,
    shots: 0,
    lastFire: -10,
    dryCooldown: 0,
    saved: null,
    shake: 0,
  };

  function def() {
    return WEAPONS[S.weapon];
  }

  function syncAmmo() {
    S.ammo[S.weapon].mag = S.mag;
    S.ammo[S.weapon].reserve = S.reserve;
  }

  function equip(id, full = false) {
    if (!WEAPONS[id]) return false;
    if (S.weapon !== id) syncAmmo();
    if (full) {
      S.ammo[id].mag = WEAPONS[id].mag;
      S.ammo[id].reserve = WEAPONS[id].reserve;
    }
    S.weapon = id;
    S.inventory[id] = true;
    S.mag = S.ammo[id].mag;
    S.reserve = S.ammo[id].reserve;
    S.reloading = false;
    data.reloadTimer = 0;
    data.cooldown = 0.28;
    data.bloom = 0;
    data.shots = 0;
    return true;
  }

  function refillAll() {
    for (const id of Object.keys(WEAPONS)) {
      if (!S.inventory[id]) continue;
      S.ammo[id].mag = WEAPONS[id].mag;
      S.ammo[id].reserve = WEAPONS[id].reserve;
    }
    S.mag = S.ammo[S.weapon].mag;
    S.reserve = S.ammo[S.weapon].reserve;
    S.reloading = false;
    data.reloadTimer = 0;
    data.bloom = 0;
    data.shots = 0;
  }

  function startReload() {
    const w = def();
    if (S.reloading || S.mag >= w.mag || S.reserve <= 0) return false;
    S.reloading = true;
    data.reloadTimer = w.reload;
    return true;
  }

  function update(dt) {
    data.cooldown = Math.max(0, data.cooldown - dt);
    data.dryCooldown = Math.max(0, data.dryCooldown - dt);
    data.shake = Math.max(0, data.shake - dt * 2.8);
    data.bloom = Math.max(0, data.bloom - dt * (S.reloading ? 0.09 : 0.05));
    if (S.reloading) {
      data.reloadTimer -= dt;
      if (data.reloadTimer <= 0) {
        const w = def();
        const need = w.mag - S.mag;
        const take = Math.min(need, S.reserve);
        S.mag += take;
        S.reserve -= take;
        S.reloading = false;
        syncAmmo();
      }
    }
  }

  function fire() {
    const w = def();
    if (S.reloading || data.cooldown > 0) return null;
    if (S.mag <= 0) {
      if (data.dryCooldown <= 0) {
        data.dryCooldown = 0.32;
        return { empty: true, weapon: w };
      }
      return null;
    }
    S.mag--;
    syncAmmo();
    data.cooldown = w.fireRate;
    data.shots++;
    data.bloom = Math.min(data.bloom + w.bloom, w.baseSpread + 0.055);
    data.shake = 1;
    const pattern = RECOIL_PATTERN[(data.shots - 1) % RECOIL_PATTERN.length];
    const pitch = w.recoilPitch * (1 + Math.min(0.7, data.shots * 0.045));
    const yaw = pattern * w.recoilYaw;
    return { weapon: w, pitch, yaw, spread: spreadFor(w, 0, false, false) };
  }

  function spreadFor(w, speed, airborne, crouching) {
    const move = Math.min(1.35, speed / 6.1) * w.moveSpread;
    const air = airborne ? w.airSpread : 0;
    const crouch = crouching ? w.crouchFactor : 1;
    return (w.baseSpread + move + air + data.bloom) * crouch;
  }

  function currentSpread(speed, airborne, crouching) {
    return spreadFor(def(), speed, airborne, crouching);
  }

  function velocityKick() {
    return data.shake;
  }

  return { data, def, equip, refillAll, startReload, update, fire, currentSpread, velocityKick };
}

function buildGun(materials, kind) {
  const group = new THREE.Group();
  const add = (w, h, d, x, y, z, mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  };
  const barrel = (length, radius, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), materials.metal);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  if (kind === 'pistol') {
    add(0.11, 0.1, 0.38, 0, 0, -0.08, materials.dark);
    add(0.105, 0.12, 0.11, 0, -0.1, 0.06, materials.dark);
    barrel(0.16, 0.028, 0, 0.025, -0.29);
    add(0.07, 0.035, 0.12, 0, 0.065, -0.05, materials.accent);
    add(0.03, 0.03, 0.03, 0, 0.09, -0.2, materials.gold);
  } else if (kind === 'rifle') {
    add(0.13, 0.12, 0.62, 0, 0, -0.16, materials.dark);
    add(0.1, 0.1, 0.34, 0, -0.02, 0.29, materials.body);
    add(0.09, 0.17, 0.1, 0, -0.12, 0.12, materials.dark);
    add(0.1, 0.12, 0.18, 0, -0.11, -0.02, materials.dark);
    barrel(0.5, 0.025, 0, 0.015, -0.68);
    add(0.06, 0.05, 0.4, 0, 0.095, -0.16, materials.body);
    add(0.035, 0.035, 0.35, 0, 0.135, -0.13, materials.accent);
    add(0.02, 0.07, 0.02, 0, 0.16, -0.4, materials.dark);
    add(0.07, 0.03, 0.14, 0, 0.07, -0.05, materials.gold);
  } else if (kind === 'sniper') {
    add(0.12, 0.11, 0.7, 0, 0, -0.22, materials.dark);
    add(0.11, 0.13, 0.36, 0, -0.015, 0.33, materials.accentDark);
    add(0.09, 0.16, 0.1, 0, -0.1, 0.12, materials.dark);
    barrel(0.72, 0.022, 0, 0.02, -0.9);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.34, 12), materials.body);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.13, -0.18);
    group.add(scope);
    add(0.075, 0.075, 0.075, 0, 0.13, -0.34, materials.lens);
    add(0.02, 0.1, 0.02, 0, 0.13, -0.05, materials.gold);
    add(0.02, 0.1, 0.02, 0, 0.13, 0.02, materials.gold);
  } else {
    add(0.14, 0.13, 0.56, 0, 0, -0.14, materials.dark);
    add(0.11, 0.12, 0.3, 0, -0.02, 0.27, materials.rustBody);
    add(0.1, 0.16, 0.1, 0, -0.1, 0.09, materials.dark);
    barrel(0.58, 0.038, 0.035, 0.02, -0.64);
    barrel(0.58, 0.038, -0.035, 0.02, -0.64);
    add(0.11, 0.07, 0.18, 0, -0.1, -0.12, materials.rustBody);
    add(0.06, 0.03, 0.16, 0, 0.08, -0.05, materials.gold);
  }

  group.position.set(0.31, -0.29, -0.58);
  group.rotation.set(0.02, -0.045, 0);
  group.visible = false;
  group.userData.muzzle = new THREE.Vector3(0, 0.02, kind === 'sniper' ? -1.3 : kind === 'shotgun' ? -0.95 : kind === 'rifle' ? -0.95 : -0.4);
  return group;
}

export function createViewModel(camera) {
  const materials = {
    dark: new THREE.MeshStandardMaterial({ color: PALETTE.slateDark, roughness: 0.5, metalness: 0.45 }),
    body: new THREE.MeshStandardMaterial({ color: PALETTE.slate, roughness: 0.55, metalness: 0.35 }),
    metal: new THREE.MeshStandardMaterial({ color: PALETTE.slateLight, roughness: 0.3, metalness: 0.75 }),
    accent: new THREE.MeshStandardMaterial({ color: PALETTE.teal, roughness: 0.5, metalness: 0.3 }),
    accentDark: new THREE.MeshStandardMaterial({ color: PALETTE.tealDeep, roughness: 0.6, metalness: 0.3 }),
    rustBody: new THREE.MeshStandardMaterial({ color: PALETTE.rustDark, roughness: 0.65 }),
    gold: new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: 0.4, metalness: 0.6 }),
    lens: new THREE.MeshStandardMaterial({ color: PALETTE.teal, emissive: PALETTE.teal, emissiveIntensity: 0.8, roughness: 0.2 }),
  };
  const root = new THREE.Group();
  const models = {};
  for (const id of Object.keys(WEAPONS)) {
    models[id] = buildGun(materials, id);
    root.add(models[id]);
  }
  camera.add(root);
  let shown = null;
  let kick = 0;
  let reloadDrop = 0;
  let swayX = 0;
  let swayY = 0;

  function show(id) {
    if (shown === id) return;
    if (shown && models[shown]) models[shown].visible = false;
    shown = id;
    if (models[id]) models[id].visible = true;
  }

  function update(dt, state) {
    if (!shown) return;
    const model = models[shown];
    kick = Math.max(0, kick - dt * 7);
    const targetDrop = state.reloading ? -0.16 : 0;
    reloadDrop += (targetDrop - reloadDrop) * Math.min(1, dt * 9);
    swayX += ((state.speed ? Math.sin(state.bob) * 0.012 : 0) - swayX) * Math.min(1, dt * 10);
    swayY += ((state.speed ? Math.abs(Math.cos(state.bob)) * 0.006 : 0) - swayY) * Math.min(1, dt * 10);
    const crouchDrop = state.crouching ? -0.018 : 0;
    root.position.set(0.31 + swayX, -0.29 + swayY + crouchDrop + reloadDrop, -0.58 + kick * 0.09);
    root.rotation.set(0.02 + kick * 0.16 + reloadDrop * 0.9, -0.045 + swayX * 1.2, -reloadDrop * 0.55);
    if (state.dead) {
      root.position.y = -0.62;
      root.rotation.z = -0.5;
    }
  }

  function addKick() {
    kick = 1;
  }

  function muzzleWorld(out) {
    if (!shown) {
      out.set(0, 0, 0);
      return out;
    }
    const model = models[shown];
    model.updateWorldMatrix(true, false);
    out.copy(model.userData.muzzle);
    model.localToWorld(out);
    return out;
  }

  return { root, show, update, addKick, muzzleWorld };
}
