import * as THREE from 'three';
import { PALETTE } from './palette.js';

const STEP_HEIGHT = 0.42;
const BOUNDS = { minX: -46, maxX: 46, minZ: -34, maxZ: 34 };

function labelTexture(text, background, foreground, wide = 512, tall = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = wide;
  canvas.height = tall;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, wide, tall);
  ctx.strokeStyle = foreground;
  ctx.lineWidth = Math.max(4, tall * 0.035);
  ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, wide - ctx.lineWidth * 2, tall - ctx.lineWidth * 2);
  ctx.fillStyle = foreground;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.floor(tall * 0.46)}px system-ui, sans-serif`;
  ctx.fillText(text, wide / 2, tall / 2 + tall * 0.02);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function floorTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.strokeRect(28, 28, 456, 456);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.38;
  ctx.font = '800 300px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 266);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createWorld(scene) {
  const colliders = [];
  const sites = {
    A: { x: 27, z: -14, radius: 6.4, name: 'A' },
    B: { x: -27, z: -14, radius: 6.4, name: 'B' },
  };
  const spawns = {
    ct: [
      { x: 0, z: 30 }, { x: -6, z: 30 }, { x: 6, z: 30 }, { x: -12, z: 28 }, { x: 12, z: 28 },
    ],
    t: [
      { x: 0, z: -30 }, { x: -6, z: -30 }, { x: 6, z: -30 }, { x: -12, z: -28 }, { x: 12, z: -28 },
    ],
  };

  const materials = {
    sand: new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.96 }),
    sandLight: new THREE.MeshStandardMaterial({ color: PALETTE.sandLight, roughness: 0.9 }),
    sandDark: new THREE.MeshStandardMaterial({ color: PALETTE.sandDark, roughness: 0.94 }),
    concrete: new THREE.MeshStandardMaterial({ color: PALETTE.slate, roughness: 0.9 }),
    concreteDark: new THREE.MeshStandardMaterial({ color: PALETTE.slateDark, roughness: 0.92 }),
    metal: new THREE.MeshStandardMaterial({ color: PALETTE.slateLight, roughness: 0.42, metalness: 0.55 }),
    teal: new THREE.MeshStandardMaterial({ color: PALETTE.teal, roughness: 0.6, metalness: 0.24 }),
    tealDeep: new THREE.MeshStandardMaterial({ color: PALETTE.tealDeep, roughness: 0.7 }),
    rust: new THREE.MeshStandardMaterial({ color: PALETTE.rust, roughness: 0.7, metalness: 0.3 }),
    rustDark: new THREE.MeshStandardMaterial({ color: PALETTE.rustDark, roughness: 0.8 }),
    crate: new THREE.MeshStandardMaterial({ color: PALETTE.sandDark, roughness: 0.88 }),
    crateTop: new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.9 }),
    gold: new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: 0.35, metalness: 0.7 }),
    lamp: new THREE.MeshStandardMaterial({ color: PALETTE.cream, emissive: PALETTE.goldSoft, emissiveIntensity: 2.4 }),
    ctGlow: new THREE.MeshBasicMaterial({ color: PALETTE.ct }),
    tGlow: new THREE.MeshBasicMaterial({ color: PALETTE.t }),
    paint: new THREE.MeshBasicMaterial({ color: PALETTE.goldSoft, transparent: true, opacity: 0.28, depthWrite: false }),
    paintTeal: new THREE.MeshBasicMaterial({ color: PALETTE.teal, transparent: true, opacity: 0.3, depthWrite: false }),
  };

  function addBox(w, h, d, x, y, z, material, collide = true, shadow = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (collide) {
      colliders.push({
        minX: x - w / 2, maxX: x + w / 2,
        minY: y - h / 2, maxY: y + h / 2,
        minZ: z - d / 2, maxZ: z + d / 2,
      });
    }
    return mesh;
  }

  function addCrate(size, x, z, base = 0) {
    addBox(size, size, size, x, base + size / 2, z, materials.crate);
    const edge = size * 0.09;
    addBox(size + 0.05, edge, edge, x, base + size * 0.16, z, materials.gold, false, false);
    addBox(size + 0.05, edge, edge, x, base + size * 0.84, z, materials.gold, false, false);
    addBox(edge, size * 0.7, edge, x - size * 0.36, base + size / 2, z + size * 0.36, materials.gold, false, false);
    addBox(edge, size * 0.7, edge, x + size * 0.36, base + size / 2, z + size * 0.36, materials.gold, false, false);
  }

  function addBarrel(x, z) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.15, 12), materials.rust);
    body.position.set(x, 0.575, z);
    body.castShadow = true;
    body.receiveShadow = true;
    scene.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 6, 16), materials.metal);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.9, z);
    scene.add(ring);
    colliders.push({ minX: x - 0.44, maxX: x + 0.44, minY: 0, maxY: 1.15, minZ: z - 0.44, maxZ: z + 0.44 });
  }

  function addSign(text, w, h, x, y, z, rotationY, background = '#20282b', foreground = '#e0a94a') {
    const texture = labelTexture(text, background, foreground);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;
    scene.add(mesh);
  }

  function addFloorMark(text, x, z, size, color) {
    const texture = floorTexture(text, color);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.035, z);
    scene.add(mesh);
  }

  function addSlab(w, d, x, z, material, height = 0.045) {
    addBox(w, height, d, x, height / 2, z, material, false, false);
  }

  function addWall(w, h, d, x, z, material = materials.concrete, capMaterial = materials.teal) {
    addBox(w, h, d, x, h / 2, z, material);
    if (w > d) {
      addBox(w + 0.25, 0.32, d + 0.25, x, h + 0.16, z, capMaterial, false, false);
    } else {
      addBox(w + 0.25, 0.32, d + 0.25, x, h + 0.16, z, capMaterial, false, false);
    }
  }

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(96, 72), materials.sand);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  addSlab(86, 7, 0, 25, materials.sandLight);
  addSlab(86, 6, 0, -25, materials.sandLight);
  addSlab(10, 67, 0, 0, materials.sandDark);
  addSlab(8, 28, 27, -14, materials.concreteDark);
  addSlab(8, 28, -27, -14, materials.concreteDark);
  addSlab(1.1, 60, 47, 0, materials.paint, 0.05);
  addSlab(1.1, 60, -47, 0, materials.paint, 0.05);
  addSlab(60, 0.7, 0, 0, materials.paint, 0.05);
  addSlab(60, 0.7, 0, 12, materials.paintTeal, 0.05);

  addWall(94, 7, 2, 0, -34, materials.concreteDark, materials.rust);
  addWall(94, 7, 2, 0, 34, materials.concreteDark, materials.teal);
  addWall(2, 7, 70, -47, 0, materials.concreteDark, materials.rust);
  addWall(2, 7, 70, 47, 0, materials.concreteDark, materials.teal);

  const ribs = [];
  for (let x = -40; x <= 40; x += 8) {
    ribs.push([x, -32.85], [x, 32.85]);
  }
  for (let z = -28; z <= 28; z += 8) {
    ribs.push([-45.85, z], [45.85, z]);
  }
  for (const [x, z] of ribs) addBox(0.32, 6.4, 0.22, x, 3.2, z, materials.metal, false, false);

  addBox(1, 7, 12, 10, 3.5, -28, materials.concrete);
  addBox(1, 7, 6, 10, 3.5, -15, materials.concrete);
  addBox(1, 7, 13, 10, 3.5, -0.5, materials.concrete);
  addBox(1, 7, 22, 10, 3.5, 23, materials.concrete);
  addBox(1, 7, 12, -10, 3.5, -28, materials.concrete);
  addBox(1, 7, 6, -10, 3.5, -15, materials.concrete);
  addBox(1, 7, 13, -10, 3.5, -0.5, materials.concrete);
  addBox(1, 7, 22, -10, 3.5, 23, materials.concrete);

  for (const dir of [1, -1]) {
    const cx = dir * 27;
    addWall(16, 3.2, 1, cx - dir * 0, -22, materials.teal, materials.gold);
    addWall(16, 3.2, 1, cx, -6, materials.teal, materials.gold);
    addWall(1, 3.2, 4, dir * 18, -20, materials.teal, materials.gold);
    addWall(1, 3.2, 6, dir * 18, -9, materials.teal, materials.gold);
    addWall(1, 3.2, 2, dir * 40, -21, materials.teal, materials.gold);
    addWall(1, 3.2, 4, dir * 40, -8, materials.teal, materials.gold);
    addSign(dir > 0 ? 'SITE A' : 'SITE B', 5.4, 2.1, dir * 26, 2.55, -21.3, 0, '#1d2a2c', dir > 0 ? '#4f95d8' : '#d25a3a');
    addFloorMark(dir > 0 ? 'A' : 'B', dir * 27, -14, 8.4, dir > 0 ? '#6fb2f0' : '#ec8a67');
  }

  addSign('FOUNDRY // 07', 12, 3.4, 0, 4.5, -32.75, 0, '#141b1d', '#e0a94a');
  addSign('CANYON GUARD', 7.5, 2.2, 0, 4.2, 32.7, Math.PI, '#16252c', '#6fb2f0');
  addSign('ASHEN HAND', 7.5, 2.2, 0, 4.2, -26.7, 0, '#2b1b16', '#ec8a67');
  addSign('MID', 2.8, 1.2, 8.7, 2.6, 8.9, -Math.PI / 2, '#1b2224', '#e0a94a');
  addSign('A  TUNNEL', 4.2, 1.4, 38.8, 2.8, -25, -Math.PI / 2, '#1b2224', '#6fb2f0');
  addSign('B  TUNNEL', 4.2, 1.4, -38.8, 2.8, -25, Math.PI / 2, '#1b2224', '#ec8a67');

  addCrate(2.6, 22.5, -18.5);
  addCrate(2.1, 32.5, -18.8);
  addCrate(2.4, 21.8, -9.2);
  addCrate(2.8, 32.2, -9.1);
  addCrate(1.5, 27, -14);
  addCrate(2.6, -22.5, -18.5);
  addCrate(2.1, -32.5, -18.8);
  addCrate(2.4, -21.8, -9.2);
  addCrate(2.8, -32.2, -9.1);
  addCrate(1.5, -27, -14);

  addBox(6, 1.2, 6, 0, 0.6, 0, materials.concreteDark);
  addBox(6.2, 0.18, 6.2, 0, 1.24, 0, materials.gold, false, false);
  addCrate(2.2, -6.4, 6.8);
  addCrate(2.2, 6.4, -6.8);
  addCrate(1.4, 6.4, 6.4);
  addCrate(2.4, 0, 16);
  addCrate(2.4, 0, -16);
  addBarrel(4.2, 2.1);
  addBarrel(4.9, 1.1);
  addBarrel(-4.2, -2.1);
  addBarrel(-4.9, -1.1);
  addBarrel(35.5, 2.5);
  addBarrel(-35.5, 2.5);
  addBarrel(35.5, -29.5);
  addBarrel(-35.5, -29.5);

  addBox(7, 1.1, 1.2, -5.5, 0.55, -26, materials.teal);
  addBox(7, 1.1, 1.2, 5.5, 0.55, -26, materials.teal);
  addBox(1.2, 1.1, 7, -38, 0.55, -20, materials.teal);
  addBox(1.2, 1.1, 7, 38, 0.55, -20, materials.teal);
  addCrate(1.8, 14, 24);
  addCrate(1.8, -14, 24);
  addCrate(1.2, 8.4, 20);
  addCrate(1.2, -8.4, 20);

  for (let z = -20; z <= 20; z += 10) {
    addBox(0.22, 0.22, 6, 9.2, 5.2, z, materials.teal, false, false);
    addBox(0.22, 0.22, 6, -9.2, 5.2, z, materials.teal, false, false);
  }
  addBox(18, 0.18, 0.18, 0, 5.2, 0, materials.rust, false, false);

  function addLamp(x, z, color) {
    addBox(0.24, 5.6, 0.24, x, 2.8, z, materials.metal);
    addBox(0.7, 0.25, 0.7, x, 5.55, z, materials.lamp, false, false);
    const light = new THREE.PointLight(color, 18, 20, 2);
    light.position.set(x, 5.2, z);
    scene.add(light);
  }
  addLamp(27, -4, PALETTE.teal);
  addLamp(-27, -4, PALETTE.rust);
  addLamp(0, 27, PALETTE.goldSoft);
  addLamp(0, -25, PALETTE.goldSoft);

  const hemi = new THREE.HemisphereLight(PALETTE.goldSoft, PALETTE.tealDeep, 0.78);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(PALETTE.goldSoft, 2.1);
  sun.position.set(30, 46, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -58;
  sun.shadow.camera.right = 58;
  sun.shadow.camera.top = 58;
  sun.shadow.camera.bottom = -58;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(PALETTE.teal, 0.5);
  fill.position.set(-30, 24, -25);
  scene.add(fill);

  function circleBlocked(x, z, radius, feetY, headY) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (c.maxY <= feetY + STEP_HEIGHT || c.minY >= headY) continue;
      const nearX = Math.max(c.minX, Math.min(x, c.maxX));
      const nearZ = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nearX;
      const dz = z - nearZ;
      if (dx * dx + dz * dz < radius * radius) return true;
    }
    return false;
  }

  function supportAt(x, z, radius, feetY) {
    let top = 0;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (c.maxY > feetY + STEP_HEIGHT || c.maxY <= top) continue;
      const nearX = Math.max(c.minX, Math.min(x, c.maxX));
      const nearZ = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nearX;
      const dz = z - nearZ;
      if (dx * dx + dz * dz < radius * radius * 0.9) top = c.maxY;
    }
    return top;
  }

  function rayBlocked(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = maxDist;
    if (dy < -1e-5) {
      const t = -oy / dy;
      if (t > 0 && t < best) best = t;
    }
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      let tmin = 0;
      let tmax = best;
      let miss = false;
      for (let axis = 0; axis < 3; axis++) {
        const o = axis === 0 ? ox : axis === 1 ? oy : oz;
        const d = axis === 0 ? dx : axis === 1 ? dy : dz;
        const lo = axis === 0 ? c.minX : axis === 1 ? c.minY : c.minZ;
        const hi = axis === 0 ? c.maxX : axis === 1 ? c.maxY : c.maxZ;
        if (Math.abs(d) < 1e-8) {
          if (o < lo || o > hi) { miss = true; break; }
          continue;
        }
        let t1 = (lo - o) / d;
        let t2 = (hi - o) / d;
        if (t1 > t2) { const swap = t1; t1 = t2; t2 = swap; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { miss = true; break; }
      }
      if (!miss && tmin > 0.01 && tmin < best) best = tmin;
    }
    return best;
  }

  function isWalkable(x, z, radius = 0.42) {
    if (x < BOUNDS.minX + radius || x > BOUNDS.maxX - radius) return false;
    if (z < BOUNDS.minZ + radius || z > BOUNDS.maxZ - radius) return false;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (c.maxY < 0.6) continue;
      const nearX = Math.max(c.minX, Math.min(x, c.maxX));
      const nearZ = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nearX;
      const dz = z - nearZ;
      if (dx * dx + dz * dz < radius * radius) return false;
    }
    return true;
  }

  function siteAt(x, z, margin = 0) {
    for (const key of ['A', 'B']) {
      const site = sites[key];
      const dx = x - site.x;
      const dz = z - site.z;
      if (dx * dx + dz * dz <= (site.radius + margin) * (site.radius + margin)) return site;
    }
    return null;
  }

  return {
    colliders,
    sites,
    spawns,
    bounds: BOUNDS,
    circleBlocked,
    supportAt,
    rayBlocked,
    isWalkable,
    siteAt,
    stepHeight: STEP_HEIGHT,
  };
}
