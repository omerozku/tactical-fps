import * as THREE from 'three';
import { PALETTE } from './palette.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();

function flashTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,247,210,1)');
  gradient.addColorStop(0.32, 'rgba(240,200,119,0.9)');
  gradient.addColorStop(0.7, 'rgba(224,169,74,0.32)');
  gradient.addColorStop(1, 'rgba(224,169,74,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createFx(scene) {
  const tracerGeometry = new THREE.BoxGeometry(0.022, 0.022, 1);
  const tracers = [];
  for (let i = 0; i < 36; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: PALETTE.goldSoft, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(tracerGeometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    scene.add(mesh);
    tracers.push({ mesh, material, life: 0, max: 0.075 });
  }

  const flashMap = flashTexture();
  const flashes = [];
  for (let i = 0; i < 8; i++) {
    const material = new THREE.SpriteMaterial({
      map: flashMap, color: PALETTE.goldSoft, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    sprite.scale.set(0.6, 0.6, 1);
    scene.add(sprite);
    flashes.push({ sprite, material, life: 0, max: 0.07, size: 0.6 });
  }

  const lights = [];
  for (let i = 0; i < 3; i++) {
    const light = new THREE.PointLight(PALETTE.goldSoft, 0, 14, 2);
    scene.add(light);
    lights.push({ light, life: 0, max: 0.09, power: 0 });
  }

  const sparkGeometry = new THREE.BoxGeometry(0.045, 0.045, 0.045);
  const sparks = [];
  for (let i = 0; i < 64; i++) {
    const material = new THREE.MeshBasicMaterial({ color: PALETTE.goldSoft, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(sparkGeometry, material);
    mesh.visible = false;
    scene.add(mesh);
    sparks.push({ mesh, material, vx: 0, vy: 0, vz: 0, life: 0, max: 0.4, gravity: 9 });
  }

  const casingGeometry = new THREE.BoxGeometry(0.035, 0.035, 0.075);
  const casingMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: 0.32, metalness: 0.8 });
  const casings = [];
  for (let i = 0; i < 18; i++) {
    const mesh = new THREE.Mesh(casingGeometry, casingMaterial);
    mesh.visible = false;
    scene.add(mesh);
    casings.push({ mesh, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, life: 0 });
  }

  let tracerIndex = 0;
  let flashIndex = 0;
  let lightIndex = 0;
  let sparkIndex = 0;
  let casingIndex = 0;

  function tracer(x1, y1, z1, x2, y2, z2, color) {
    const item = tracers[tracerIndex++ % tracers.length];
    tmpA.set(x2 - x1, y2 - y1, z2 - z1);
    const length = tmpA.length();
    if (length < 0.02) return;
    tmpA.divideScalar(length);
    item.mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    item.mesh.quaternion.setFromUnitVectors(Z_AXIS, tmpA);
    item.mesh.scale.set(1, 1, length);
    item.material.color.setHex(color);
    item.material.opacity = 0.9;
    item.mesh.visible = true;
    item.life = item.max;
  }

  function muzzle(x, y, z, color, size = 0.62, power = 10) {
    const flash = flashes[flashIndex++ % flashes.length];
    flash.sprite.position.set(x, y, z);
    flash.sprite.scale.set(size, size, 1);
    flash.material.color.setHex(color);
    flash.material.opacity = 0.95;
    flash.sprite.visible = true;
    flash.life = flash.max;
    flash.size = size;
    const light = lights[lightIndex++ % lights.length];
    light.light.position.set(x, y, z);
    light.light.color.setHex(color);
    light.light.intensity = power;
    light.life = light.max;
    light.power = power;
  }

  function sparkBurst(x, y, z, color, count = 5, force = 2.6) {
    for (let i = 0; i < count; i++) {
      const item = sparks[sparkIndex++ % sparks.length];
      item.mesh.position.set(x, y, z);
      item.vx = (Math.random() - 0.5) * force;
      item.vy = Math.random() * force * 0.8 + 0.5;
      item.vz = (Math.random() - 0.5) * force;
      item.material.color.setHex(color);
      item.material.opacity = 0.95;
      item.mesh.visible = true;
      item.life = item.max * (0.55 + Math.random() * 0.7);
      item.gravity = 9;
    }
  }

  function impact(x, y, z, dx, dy, dz) {
    tmpB.set(-dx, -dy, -dz).normalize();
    sparkBurst(x + tmpB.x * 0.07, y + tmpB.y * 0.07, z + tmpB.z * 0.07, PALETTE.goldSoft, 5, 2.4);
    const flash = flashes[flashIndex++ % flashes.length];
    flash.sprite.position.set(x, y, z);
    flash.sprite.scale.set(0.28, 0.28, 1);
    flash.material.color.setHex(PALETTE.cream);
    flash.material.opacity = 0.8;
    flash.sprite.visible = true;
    flash.life = 0.045;
    flash.size = 0.28;
  }

  function bloodBurst(x, y, z) {
    sparkBurst(x, y, z, PALETTE.t, 4, 1.8);
  }

  function casing(x, y, z, rightX, rightZ) {
    const item = casings[casingIndex++ % casings.length];
    item.mesh.position.set(x, y, z);
    item.vx = rightX * (1.3 + Math.random() * 0.9);
    item.vz = rightZ * (1.3 + Math.random() * 0.9);
    item.vy = 1.8 + Math.random() * 1.4;
    item.rx = Math.random() * 8;
    item.ry = Math.random() * 8;
    item.rz = Math.random() * 8;
    item.life = 2.2;
    item.mesh.rotation.set(item.rx, item.ry, item.rz);
    item.mesh.visible = true;
  }

  function explosion(x, y, z) {
    const flash = flashes[flashIndex++ % flashes.length];
    flash.sprite.position.set(x, y + 0.3, z);
    flash.sprite.scale.set(4.2, 4.2, 1);
    flash.material.color.setHex(PALETTE.goldSoft);
    flash.material.opacity = 0.95;
    flash.sprite.visible = true;
    flash.life = 0.22;
    flash.size = 4.2;
    const light = lights[lightIndex++ % lights.length];
    light.light.position.set(x, y + 1, z);
    light.light.color.setHex(PALETTE.goldSoft);
    light.light.intensity = 60;
    light.life = 0.28;
    light.power = 60;
    sparkBurst(x, y + 0.4, z, PALETTE.goldSoft, 22, 7);
    sparkBurst(x, y + 0.2, z, PALETTE.rust, 14, 5);
  }

  function update(dt) {
    for (let i = 0; i < tracers.length; i++) {
      const item = tracers[i];
      if (item.life <= 0) continue;
      item.life -= dt;
      const ratio = Math.max(0, item.life / item.max);
      item.material.opacity = ratio * 0.9;
      if (item.life <= 0) item.mesh.visible = false;
    }
    for (let i = 0; i < flashes.length; i++) {
      const item = flashes[i];
      if (item.life <= 0) continue;
      item.life -= dt;
      const ratio = Math.max(0, item.life / item.max);
      item.material.opacity = ratio * 0.95;
      const scale = item.size * (0.35 + (1 - ratio) * 1.2);
      item.sprite.scale.set(scale, scale, 1);
      if (item.life <= 0) item.sprite.visible = false;
    }
    for (let i = 0; i < lights.length; i++) {
      const item = lights[i];
      if (item.life <= 0) continue;
      item.life -= dt;
      const ratio = Math.max(0, item.life / item.max);
      item.light.intensity = item.power * ratio;
      if (item.life <= 0) item.light.intensity = 0;
    }
    for (let i = 0; i < sparks.length; i++) {
      const item = sparks[i];
      if (item.life <= 0) continue;
      item.life -= dt;
      item.vy -= item.gravity * dt;
      item.mesh.position.x += item.vx * dt;
      item.mesh.position.y += item.vy * dt;
      item.mesh.position.z += item.vz * dt;
      if (item.mesh.position.y < 0.03) {
        item.mesh.position.y = 0.03;
        item.vy *= -0.28;
        item.vx *= 0.6;
        item.vz *= 0.6;
      }
      item.material.opacity = Math.max(0, item.life / item.max);
      if (item.life <= 0) item.mesh.visible = false;
    }
    for (let i = 0; i < casings.length; i++) {
      const item = casings[i];
      if (item.life <= 0) continue;
      item.life -= dt;
      item.vy -= 13 * dt;
      item.mesh.position.x += item.vx * dt;
      item.mesh.position.y += item.vy * dt;
      item.mesh.position.z += item.vz * dt;
      item.mesh.rotation.x += item.rx * dt;
      item.mesh.rotation.y += item.ry * dt;
      item.mesh.rotation.z += item.rz * dt;
      if (item.mesh.position.y < 0.04) {
        item.mesh.position.y = 0.04;
        item.vy *= -0.32;
        item.vx *= 0.55;
        item.vz *= 0.55;
        item.rx *= 0.5;
        item.ry *= 0.5;
        item.rz *= 0.5;
      }
      if (item.life <= 0) item.mesh.visible = false;
    }
  }

  function clear() {
    for (const item of tracers) { item.life = 0; item.mesh.visible = false; }
    for (const item of flashes) { item.life = 0; item.sprite.visible = false; }
    for (const item of lights) { item.life = 0; item.light.intensity = 0; }
    for (const item of sparks) { item.life = 0; item.mesh.visible = false; }
    for (const item of casings) { item.life = 0; item.mesh.visible = false; }
  }

  return { tracer, muzzle, impact, bloodBurst, casing, explosion, update, clear };
}
