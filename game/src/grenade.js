import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { addFeed } from './state.js';

const GRAVITY = 19;
const FUSE = 2.55;
const RADIUS = 8.5;

export function createGrenades(scene, world, fx, sfx, S, player, bots) {
  const live = [];
  const sphereGeometry = new THREE.SphereGeometry(0.145, 10, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.slate, roughness: 0.5, metalness: 0.55 });
  const bandMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.rust, roughness: 0.6, metalness: 0.2 });
  const lightMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.goldSoft });

  function spawn(x, y, z, vx, vy, vz) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(sphereGeometry, bodyMaterial);
    body.castShadow = true;
    group.add(body);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.028, 5, 12), bandMaterial);
    band.rotation.x = Math.PI / 2;
    group.add(band);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.07, 8), lightMaterial);
    cap.position.y = 0.15;
    group.add(cap);
    group.position.set(x, y, z);
    scene.add(group);
    live.push({
      group,
      x, y, z,
      vx, vy, vz,
      fuse: FUSE,
      rx: (Math.random() - 0.5) * 9,
      rz: (Math.random() - 0.5) * 9,
    });
  }

  function throwFromPlayer(camera) {
    if (S.grenades <= 0 || !player.alive) return false;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const startX = player.x + dir.x * 0.55;
    const startY = player.y + player.eye - 0.08;
    const startZ = player.z + dir.z * 0.55;
    S.grenades--;
    spawn(startX, startY, startZ, dir.x * 15 + player.vx * 0.3, dir.y * 15 + 4.4, dir.z * 15 + player.vz * 0.3);
    sfx.beep(290, 0.05, 0.04);
    return true;
  }

  function explode(grenade) {
    const x = grenade.x;
    const y = grenade.y + 0.25;
    const z = grenade.z;
    fx.explosion(x, y, z);
    sfx.explosion();
    S.screenShake = 1;
    bots.hear(x, z, 't', 38, 'ct');
    bots.hear(x, z, 'ct', 30, 't');
    const targets = bots.listBots();
    for (const bot of targets) {
      if (!bot.alive) continue;
      const dx = bot.x - x;
      const dz = bot.z - z;
      const distance = Math.hypot(dx, dz);
      if (distance > RADIUS) continue;
      const eyeY = bot.y + 1.35;
      const length = Math.hypot(dx, eyeY - y, dz) || 1;
      if (world.rayBlocked(x, y, z, dx / length, (eyeY - y) / length, dz / length, length) < length - 0.4) continue;
      const falloff = 1 - distance / RADIUS;
      const damage = 24 + 112 * falloff * falloff;
      bots.damageBot(bot, damage, 'body', 'FRAG CHARGE', true);
    }
    if (player.alive) {
      const dx = player.x - x;
      const dz = player.z - z;
      const distance = Math.hypot(dx, dz);
      if (distance < RADIUS) {
        const eyeY = player.y + 1.0;
        const length = Math.hypot(dx, eyeY - y, dz) || 1;
        if (world.rayBlocked(x, y, z, dx / length, (eyeY - y) / length, dz / length, length) >= length - 0.4) {
          const falloff = 1 - distance / RADIUS;
          player.takeDamage((24 + 92 * falloff * falloff) * 0.68, x, z);
        }
      }
    }
    addFeed('FRAG CHARGE DETONATED');
    scene.remove(grenade.group);
  }

  function update(dt) {
    for (let index = live.length - 1; index >= 0; index--) {
      const grenade = live[index];
      grenade.fuse -= dt;
      if (grenade.fuse <= 0) {
        explode(grenade);
        live.splice(index, 1);
        continue;
      }
      const nx = grenade.x + grenade.vx * dt;
      if (!world.circleBlocked(nx, grenade.z, 0.13, grenade.y - 0.13, grenade.y + 0.13)) {
        grenade.x = nx;
      } else {
        grenade.vx *= -0.38;
      }
      const nz = grenade.z + grenade.vz * dt;
      if (!world.circleBlocked(grenade.x, nz, 0.13, grenade.y - 0.13, grenade.y + 0.13)) {
        grenade.z = nz;
      } else {
        grenade.vz *= -0.38;
      }
      grenade.vy -= GRAVITY * dt;
      grenade.y += grenade.vy * dt;
      const support = world.supportAt(grenade.x, grenade.z, 0.16, grenade.y - 0.14);
      if (grenade.y <= support + 0.13 && grenade.vy <= 0) {
        grenade.y = support + 0.13;
        grenade.vy *= -0.42;
        grenade.vx *= 0.72;
        grenade.vz *= 0.72;
        if (Math.abs(grenade.vy) < 0.9) grenade.vy = 0;
        if (Math.hypot(grenade.vx, grenade.vz) > 1.2) sfx.grenadeBounce(0.05);
      }
      if (grenade.y < 0.13) {
        grenade.y = 0.13;
        grenade.vy = 0;
      }
      grenade.group.position.set(grenade.x, grenade.y, grenade.z);
      grenade.group.rotation.x += grenade.rx * dt;
      grenade.group.rotation.z += grenade.rz * dt;
    }
  }

  function clear() {
    for (const grenade of live) scene.remove(grenade.group);
    live.length = 0;
  }

  return { throwFromPlayer, update, clear };
}
