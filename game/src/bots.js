import * as THREE from 'three';
import { PALETTE, TEAM_COLOR } from './palette.js';
import { addFeed } from './state.js';

const BOT_RADIUS = 0.34;
const BOT_HEIGHT = 1.72;
const EYE = 1.55;
const T_NAMES = ['VULCAN', 'MAGPIE', 'TALON', 'CINDER', 'ROOK'];
const CT_NAMES = ['SHERIFF', 'DAGGER', 'HALO', 'PATCH'];
const T_ROLES = ['rushA', 'rushA', 'rushB', 'rushB', 'lurk'];
const CT_ROLES = ['holdA', 'holdB', 'mid', 'rotate'];

const T_ROUTE_A = [[0, -28], [0, -20], [8.5, -20], [14, -18], [16, -16], [21, -15], [24, -15]];
const T_ROUTE_B = [[0, -28], [0, -20], [-8.5, -20], [-14, -18], [-16, -16], [-21, -15], [-24, -15]];
const T_ROUTE_LURK = [[0, -25], [0, -20], [0, -15], [0, -8], [4, -9], [9, -9], [14, -10], [20, -12], [24, -14]];
const CT_ROUTE_A = [[8, 27], [9, 16], [9, 9], [14, 7], [16, 0], [16, -8], [16, -14], [20, -12]];
const CT_ROUTE_B = [[-8, 27], [-9, 16], [-9, 9], [-14, 7], [-16, 0], [-16, -8], [-16, -14], [-20, -12]];
const CT_ROUTE_MID = [[0, 25], [0, 17], [0, 10], [0, 5]];
const CT_ROUTE_ROTATE = [[8, 27], [8, 20], [8, 13], [3, 10]];
const DEFUSE_A = [[9, 9], [14, 6], [16, 0], [16, -8], [16, -16], [20, -16], [24, -15]];
const DEFUSE_B = [[-9, 9], [-14, 6], [-16, 0], [-16, -8], [-16, -16], [-20, -16], [-24, -15]];

function angleLerp(current, target, amount) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * Math.min(1, amount);
}

function rayAABB(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ, maxT) {
  let tmin = 0;
  let tmax = maxT;
  for (let axis = 0; axis < 3; axis++) {
    const o = axis === 0 ? ox : axis === 1 ? oy : oz;
    const d = axis === 0 ? dx : axis === 1 ? dy : dz;
    const lo = axis === 0 ? minX : axis === 1 ? minY : minZ;
    const hi = axis === 0 ? maxX : axis === 1 ? maxY : maxZ;
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return -1;
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) { const swap = t1; t1 = t2; t2 = swap; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  return tmin > 0.01 ? tmin : -1;
}

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, radius, maxT) {
  const lx = ox - cx;
  const ly = oy - cy;
  const lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - radius * radius;
  const h = b * b - c;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  if (t > 0.01 && t < maxT) return t;
  return -1;
}

function buildBotModel(team) {
  const isT = team === 't';
  const bodyMat = new THREE.MeshStandardMaterial({ color: isT ? PALETTE.rustDark : PALETTE.tealDeep, roughness: 0.78 });
  const vestMat = new THREE.MeshStandardMaterial({ color: isT ? PALETTE.rust : PALETTE.teal, roughness: 0.62, metalness: 0.12 });
  const trimMat = new THREE.MeshStandardMaterial({ color: isT ? PALETTE.gold : PALETTE.ct, roughness: 0.5, metalness: 0.2 });
  const headMat = new THREE.MeshStandardMaterial({ color: isT ? PALETTE.rustDark : PALETTE.tealDeep, roughness: 0.65 });
  const skinMat = new THREE.MeshStandardMaterial({ color: isT ? 0xb98a62 : 0xd6b08a, roughness: 0.8 });
  const gunMat = new THREE.MeshStandardMaterial({ color: PALETTE.slateDark, roughness: 0.45, metalness: 0.5 });
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.31, 0.82, 4, 8), bodyMat);
  body.position.y = 0.77;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.42), vestMat);
  vest.position.set(0, 0.98, 0.01);
  vest.castShadow = true;
  group.add(vest);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.44), trimMat);
  belt.position.set(0, 0.66, 0.01);
  group.add(belt);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.225, 12, 10), skinMat);
  head.position.y = 1.55;
  head.castShadow = true;
  group.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.245, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), headMat);
  helmet.position.y = 1.58;
  group.add(helmet);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.16), trimMat);
  brim.position.set(0, 1.57, -0.2);
  group.add(brim);
  const legMat = new THREE.MeshStandardMaterial({ color: isT ? PALETTE.rustDark : PALETTE.tealDeep, roughness: 0.85 });
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), legMat);
    leg.position.set(side * 0.13, 0.32, 0);
    leg.castShadow = true;
    group.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.46, 0.14), vestMat);
    arm.position.set(side * 0.32, 1.0, -0.03);
    arm.rotation.x = -0.18;
    group.add(arm);
  }
  const gun = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.62), gunMat);
  receiver.position.set(0, 1.12, -0.38);
  gun.add(receiver);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 8), gunMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 1.13, -0.84);
  gun.add(barrel);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.1), trimMat);
  mag.position.set(0, 1.0, -0.35);
  gun.add(mag);
  group.add(gun);
  const patch = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.03), new THREE.MeshBasicMaterial({ color: TEAM_COLOR[team] }));
  patch.position.set(0.17, 1.06, -0.22);
  group.add(patch);
  return { group, head, body, gun };
}

export function createBots(scene, world, fx, S, sfx, player) {
  const list = [];
  const callbacks = { plant: null, defuse: null };
  let elapsed = 0;

  function register(team, index) {
    const name = team === 't' ? T_NAMES[index] : CT_NAMES[index];
    const model = buildBotModel(team);
    scene.add(model.group);
    const bot = {
      id: list.length,
      team,
      index,
      name,
      role: team === 't' ? T_ROLES[index] : CT_ROLES[index],
      x: 0, z: 0, y: 0,
      yaw: team === 't' ? Math.PI : 0,
      hp: 100,
      armor: 40,
      alive: true,
      group: model.group,
      headMesh: model.head,
      bodyMesh: model.body,
      weapon: team === 't' ? (index === 4 ? 'sniper' : 'rifle') : 'rifle',
      damage: team === 't' ? (index === 4 ? 64 : 22) : 20,
      range: team === 't' ? (index === 4 ? 95 : 76) : 78,
      fireInterval: team === 't' ? (index === 4 ? 1.1 : 0.13) : 0.14,
      skill: team === 't' ? 0.62 + index * 0.03 : 0.66 + index * 0.035,
      reactionBase: team === 't' ? 0.42 : 0.48,
      hasBomb: false,
      mode: 'route',
      route: [],
      routeIndex: 0,
      holdX: 0, holdZ: 0, holdYaw: 0,
      target: null,
      targetVisible: false,
      lastSeen: 0,
      lastSeenX: 0, lastSeenZ: 0,
      reaction: 0,
      fireCd: 0,
      burst: 0,
      burstSize: 3,
      aiTimer: Math.random() * 0.1,
      alertX: 0, alertZ: 0, alertT: 0,
      scan: Math.random() * 6.28,
      strafe: Math.random() < 0.5 ? 1 : -1,
      strafeTimer: 0.6 + Math.random(),
      stuck: 0,
      moving: false,
      speed: 0,
      plantT: 0,
      defuseT: 0,
      lastX: 0, lastZ: 0,
      checkTimer: 0,
    };
    list.push(bot);
    return bot;
  }

  for (let i = 0; i < 5; i++) register('t', i);
  for (let i = 0; i < 4; i++) register('ct', i);

  function tBots() {
    return list.filter((bot) => bot.team === 't');
  }

  function chooseRoute(bot) {
    const flip = S.round % 2 === 0;
    if (bot.team === 't') {
      if (bot.role === 'lurk') return T_ROUTE_LURK.map((point) => point.slice());
      if (bot.role === 'rushA') return (flip ? T_ROUTE_B : T_ROUTE_A).map((point) => point.slice());
      return (flip ? T_ROUTE_A : T_ROUTE_B).map((point) => point.slice());
    }
    if (bot.role === 'holdA') return CT_ROUTE_A.map((point) => point.slice());
    if (bot.role === 'holdB') return CT_ROUTE_B.map((point) => point.slice());
    if (bot.role === 'mid') return CT_ROUTE_MID.map((point) => point.slice());
    return CT_ROUTE_ROTATE.map((point) => point.slice());
  }

  function chooseHold(bot) {
    if (bot.role === 'holdA') return { x: 20, z: -11, yaw: -0.6 };
    if (bot.role === 'holdB') return { x: -20, z: -11, yaw: 0.6 };
    if (bot.role === 'mid') return { x: 0, z: 6, yaw: 0 };
    return { x: 4, z: 11, yaw: 0.15 };
  }

  function resetRound() {
    S.bomb.carrier = null;
    for (const bot of list) {
      const spawn = bot.team === 't' ? world.spawns.t[bot.index] : world.spawns.ct[bot.index + 1];
      bot.x = spawn.x;
      bot.z = spawn.z;
      bot.y = 0;
      bot.yaw = bot.team === 't' ? Math.PI : 0;
      bot.hp = 100;
      bot.armor = 40;
      bot.alive = true;
      bot.hasBomb = false;
      bot.mode = 'route';
      bot.route = chooseRoute(bot);
      bot.routeIndex = 0;
      const hold = chooseHold(bot);
      bot.holdX = hold.x;
      bot.holdZ = hold.z;
      bot.holdYaw = hold.yaw;
      bot.target = null;
      bot.targetVisible = false;
      bot.lastSeen = 0;
      bot.reaction = 0;
      bot.fireCd = 0;
      bot.burst = 0;
      bot.alertT = 0;
      bot.stuck = 0;
      bot.plantT = 0;
      bot.defuseT = 0;
      bot.group.position.set(bot.x, 0, bot.z);
      bot.group.rotation.set(0, bot.yaw, 0);
      bot.group.visible = true;
      bot.group.scale.set(1, 1, 1);
    }
    const terrorists = list.filter((bot) => bot.team === 't');
    const carrier = terrorists.find((bot) => bot.role === 'rushA') || terrorists[0];
    if (carrier) {
      carrier.hasBomb = true;
      S.bomb.carrier = carrier.id;
    }
  }

  function setCallbacks(next) {
    callbacks.plant = next.plant;
    callbacks.defuse = next.defuse;
  }

  function hear(x, z, team, radius, sourceTeam) {
    for (const bot of list) {
      if (!bot.alive || bot.team !== team || bot.team === sourceTeam) continue;
      const dx = x - bot.x;
      const dz = z - bot.z;
      if (dx * dx + dz * dz <= radius * radius) {
        bot.alertX = x;
        bot.alertZ = z;
        bot.alertT = 5.5;
      }
    }
  }

  function stepBot(bot, mx, mz) {
    let moved = false;
    if (mx !== 0) {
      const nx = bot.x + mx;
      if (!world.circleBlocked(nx, bot.z, BOT_RADIUS, 0, BOT_HEIGHT)) {
        bot.x = nx;
        moved = true;
      }
    }
    if (mz !== 0) {
      const nz = bot.z + mz;
      if (!world.circleBlocked(bot.x, nz, BOT_RADIUS, 0, BOT_HEIGHT)) {
        bot.z = nz;
        moved = true;
      }
    }
    return moved;
  }

  function faceToward(bot, x, z, dt, rate = 9) {
    const dx = x - bot.x;
    const dz = z - bot.z;
    const desired = Math.atan2(-dx, -dz);
    bot.yaw = angleLerp(bot.yaw, desired, rate * dt);
  }

  function followRoute(bot, dt, speed) {
    if (bot.routeIndex >= bot.route.length) {
      bot.mode = 'hold';
      return;
    }
    const point = bot.route[bot.routeIndex];
    const dx = point[0] - bot.x;
    const dz = point[1] - bot.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.65) {
      bot.routeIndex++;
      return;
    }
    faceToward(bot, point[0], point[1], dt);
    const step = Math.min(speed * dt, distance);
    const moved = stepBot(bot, (dx / distance) * step, (dz / distance) * step);
    bot.moving = moved;
    bot.speed = moved ? speed : 0;
    if (!moved) {
      bot.stuck += dt;
      if (bot.stuck > 0.75) {
        bot.routeIndex = Math.min(bot.route.length - 1, bot.routeIndex + 1);
        bot.stuck = 0;
      }
    } else {
      bot.stuck = 0;
    }
  }

  function rayCharacter(ox, oy, oz, dx, dy, dz, x, feetY, z, maxT) {
    const bodyT = rayAABB(ox, oy, oz, dx, dy, dz, x - 0.34, feetY + 0.12, z - 0.34, x + 0.34, feetY + 1.32, z + 0.34, maxT);
    const headT = raySphere(ox, oy, oz, dx, dy, dz, x, feetY + 1.54, z, 0.25, maxT);
    if (headT > 0 && (bodyT < 0 || headT < bodyT)) return { t: headT, part: 'head' };
    if (bodyT > 0) return { t: bodyT, part: 'body' };
    return null;
  }

  function rayHit(ox, oy, oz, dx, dy, dz, maxDist, team, ignore) {
    let bestT = maxDist;
    let bestBot = null;
    let bestPlayer = false;
    let bestPart = 'body';
    if (player && player.alive && player.team !== team) {
      const hit = rayCharacter(ox, oy, oz, dx, dy, dz, player.x, player.y, player.z, bestT);
      if (hit) {
        bestT = hit.t;
        bestBot = null;
        bestPlayer = true;
        bestPart = hit.part;
      }
    }
    for (const bot of list) {
      if (!bot.alive || bot.team === team || bot === ignore) continue;
      const hit = rayCharacter(ox, oy, oz, dx, dy, dz, bot.x, bot.y, bot.z, bestT);
      if (hit) {
        bestT = hit.t;
        bestBot = bot;
        bestPlayer = false;
        bestPart = hit.part;
      }
    }
    if (bestBot || bestPlayer) return { bot: bestBot, player: bestPlayer, part: bestPart, dist: bestT };
    return null;
  }

  function transferBomb(fromBot) {
    if (!S.bomb.planted) {
      let nearest = null;
      let nearestDist = Infinity;
      for (const bot of list) {
        if (bot.team !== 't' || !bot.alive || bot === fromBot) continue;
        const distance = Math.hypot(bot.x - fromBot.x, bot.z - fromBot.z);
        if (distance < nearestDist) {
          nearestDist = distance;
          nearest = bot;
        }
      }
      if (nearest) {
        nearest.hasBomb = true;
        S.bomb.carrier = nearest.id;
        if (nearest.mode !== 'plant') {
          nearest.route = (nearest.x > 0 ? T_ROUTE_A : T_ROUTE_B).map((point) => point.slice());
          nearest.routeIndex = 0;
          nearest.mode = 'route';
        }
      } else {
        S.bomb.carrier = null;
      }
    }
  }

  function killBot(bot, attackerName, headshot) {
    bot.alive = false;
    bot.hp = 0;
    bot.mode = 'dead';
    bot.target = null;
    bot.group.rotation.set(0, bot.yaw, Math.PI / 2);
    bot.group.position.y = 0.33;
    if (bot.hasBomb) {
      bot.hasBomb = false;
      transferBomb(bot);
    }
    addFeed(`${attackerName} ${headshot ? 'HEADSHOT ' : ''}${bot.name}`);
  }

  function damageBot(bot, amount, part, attackerName, isPlayer = false, headMult = 2.1) {
    if (!bot.alive) return 0;
    let damage = amount;
    if (bot.armor > 0) {
      bot.armor = Math.max(0, bot.armor - damage * 0.4);
      damage *= 0.64;
    }
    if (part === 'head') damage *= headMult;
    bot.hp -= damage;
    bot.lastSeen = Math.max(bot.lastSeen, 0.6);
    bot.alertT = 4;
    if (bot.hp <= 0) {
      const finalDamage = damage;
      killBot(bot, attackerName, part === 'head');
      if (isPlayer) {
        S.kills++;
        S.money = Math.min(16000, S.money + 300);
        if (part === 'head') S.headshots++;
        S.hitPulse++;
        S.hitHead = part === 'head';
      }
      return finalDamage;
    }
    if (isPlayer) {
      S.hitPulse++;
      S.hitHead = part === 'head';
    }
    return damage;
  }

  function shootTarget(bot, target, targetX, targetY, targetZ, distance) {
    const dx = targetX - bot.x;
    const dy = targetY - (bot.y + 1.12);
    const dz = targetZ - bot.z;
    const length = Math.hypot(dx, dy, dz) || 1;
    let ax = dx / length;
    let ay = dy / length;
    let az = dz / length;
    const movePenalty = bot.moving ? 0.017 : 0;
    const targetMovePenalty = target && target.isPlayer ? Math.min(0.018, (target.speed || 0) * 0.003) : 0;
    const spread = (1 - bot.skill) * 0.03 + distance * 0.00042 + movePenalty + targetMovePenalty;
    ax += (Math.random() - 0.5) * spread * 2;
    ay += (Math.random() - 0.5) * spread * 1.2;
    az += (Math.random() - 0.5) * spread * 2;
    const norm = Math.hypot(ax, ay, az) || 1;
    ax /= norm; ay /= norm; az /= norm;
    const muzzleX = bot.x - Math.sin(bot.yaw) * 0.68;
    const muzzleY = bot.y + 1.13;
    const muzzleZ = bot.z - Math.cos(bot.yaw) * 0.68;
    const wall = world.rayBlocked(muzzleX, muzzleY, muzzleZ, ax, ay, az, bot.range);
    const limit = Math.min(bot.range, wall);
    const hit = rayHit(muzzleX, muzzleY, muzzleZ, ax, ay, az, limit + 0.05, bot.team, bot);
    let endX = muzzleX + ax * limit;
    let endY = muzzleY + ay * limit;
    let endZ = muzzleZ + az * limit;
    if (hit) {
      endX = muzzleX + ax * hit.dist;
      endY = muzzleY + ay * hit.dist;
      endZ = muzzleZ + az * hit.dist;
      const falloff = 1 - (hit.dist / bot.range) * 0.38;
      let damage = bot.damage * Math.max(0.35, falloff);
      if (hit.bot) {
        const killed = hit.bot.hp <= 0;
        damageBot(hit.bot, damage, hit.part, bot.name);
        fx.bloodBurst(endX, endY, endZ);
        if (!killed && hit.bot.alive) {
          hit.bot.alertT = 5;
          hit.bot.alertX = bot.x;
          hit.bot.alertZ = bot.z;
        }
      } else if (hit.player) {
        player.takeDamage(damage, bot.x, bot.z);
        fx.bloodBurst(endX, endY, endZ);
        if (!player.alive) {
          addFeed(`${bot.name} ${hit.part === 'head' ? 'HEADSHOT ' : ''}RANGER`);
        }
      }
    } else if (wall < bot.range) {
      fx.impact(endX, endY, endZ, ax, ay, az);
    }
    const distanceToPlayer = Math.hypot(bot.x - player.x, bot.z - player.z);
    const volume = Math.max(0.06, Math.min(0.55, 1 - distanceToPlayer / 48));
    const pan = Math.max(-0.9, Math.min(0.9, ((bot.x - player.x) * Math.cos(player.yaw) - (bot.z - player.z) * Math.sin(player.yaw)) / 22));
    sfx.fire(bot.weapon === 'sniper' ? 'sniper' : 'rifle', volume, pan);
    fx.tracer(muzzleX, muzzleY, muzzleZ, endX, endY, endZ, TEAM_COLOR[bot.team]);
    fx.muzzle(muzzleX, muzzleY, muzzleZ, TEAM_COLOR[bot.team], 0.42, 6);
    hear(bot.x, bot.z, bot.team === 't' ? 'ct' : 't', 30, bot.team);
  }

  function findTarget(bot) {
    let best = null;
    let bestScore = Infinity;
    const candidates = [];
    if (player && player.alive && player.team !== bot.team) candidates.push(player);
    for (const other of list) {
      if (other !== bot && other.alive && other.team !== bot.team) candidates.push(other);
    }
    for (const candidate of candidates) {
      const dx = candidate.x - bot.x;
      const dz = candidate.z - bot.z;
      const distance = Math.hypot(dx, dz);
      if (distance > (bot.weapon === 'sniper' ? 100 : 62)) continue;
      const eyeY = bot.y + EYE;
      const targetY = candidate.isPlayer ? candidate.y + candidate.eye : candidate.y + 1.4;
      const dirX = dx / (distance || 1);
      const dirZ = dz / (distance || 1);
      const forwardX = -Math.sin(bot.yaw);
      const forwardZ = -Math.cos(bot.yaw);
      const facing = forwardX * dirX + forwardZ * dirZ;
      const alerted = bot.alertT > 0;
      if (facing < 0.08 && !alerted && distance > 5) continue;
      const dy = targetY - eyeY;
      const length = Math.hypot(dx, dy, dz) || 1;
      if (world.rayBlocked(bot.x, eyeY, bot.z, dx / length, dy / length, dz / length, length) < length - 0.35) continue;
      const score = distance + (candidate.isPlayer ? -3 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }

  function updateCombat(bot, dt) {
    const target = bot.target;
    if (!target || !target.alive) {
      bot.target = null;
      bot.targetVisible = false;
      return false;
    }
    const dx = target.x - bot.x;
    const dz = target.z - bot.z;
    const distance = Math.hypot(dx, dz);
    const targetY = target.isPlayer ? target.y + 1.05 : target.y + 1.02;
    const eyeY = bot.y + EYE;
    const targetEyeY = target.isPlayer ? target.y + target.eye : target.y + 1.4;
    const lineLength = Math.hypot(dx, targetEyeY - eyeY, dz) || 1;
    const visible = world.rayBlocked(bot.x, eyeY, bot.z, dx / lineLength, (targetEyeY - eyeY) / lineLength, dz / lineLength, lineLength) >= lineLength - 0.35;
    bot.targetVisible = visible;
    if (visible) {
      bot.lastSeen = 2.4;
      bot.lastSeenX = target.x;
      bot.lastSeenZ = target.z;
      if (bot.reaction <= 0 && bot.burst === 0) bot.reaction = bot.reactionBase + Math.random() * 0.22;
    } else {
      bot.lastSeen = Math.max(0, bot.lastSeen - dt);
      if (bot.lastSeen <= 0) {
        bot.target = null;
        bot.targetVisible = false;
        return false;
      }
    }
    faceToward(bot, target.x, target.z, dt, 15);
    bot.strafeTimer -= dt;
    if (bot.strafeTimer <= 0) {
      bot.strafe *= -1;
      bot.strafeTimer = 0.7 + Math.random() * 1.2;
    }
    const perpX = -dz / (distance || 1);
    const perpZ = dx / (distance || 1);
    let moveX = perpX * bot.strafe;
    let moveZ = perpZ * bot.strafe;
    if (distance > 20) {
      moveX += dx / (distance || 1) * 0.5;
      moveZ += dz / (distance || 1) * 0.5;
    } else if (distance < 5) {
      moveX -= dx / (distance || 1) * 0.55;
      moveZ -= dz / (distance || 1) * 0.55;
    }
    const speed = 2.6 + bot.skill * 0.9;
    const moveLength = Math.hypot(moveX, moveZ) || 1;
    const moved = stepBot(bot, (moveX / moveLength) * speed * dt, (moveZ / moveLength) * speed * dt);
    bot.moving = moved;
    bot.speed = moved ? speed : 0;

    bot.reaction = Math.max(0, bot.reaction - dt);
    bot.fireCd -= dt;
    if (bot.reaction <= 0 && bot.fireCd <= 0 && distance < bot.range && visible) {
      shootTarget(bot, target, target.x, targetY, target.z, distance);
      bot.burst++;
      if (bot.burst >= bot.burstSize) {
        bot.burst = 0;
        bot.burstSize = 3 + Math.floor(Math.random() * 3);
        bot.fireCd = 0.55 + Math.random() * 0.85;
      } else {
        bot.fireCd = bot.fireInterval + Math.random() * 0.035;
      }
    }
    return true;
  }

  function updateBot(bot, dt) {
    if (!bot.alive) return;
    if (bot.alertT > 0) bot.alertT -= dt;
    bot.aiTimer -= dt;
    if (bot.aiTimer <= 0) {
      bot.aiTimer = 0.14 + Math.random() * 0.08;
      const found = findTarget(bot);
      if (found) {
        if (bot.target !== found) bot.reaction = bot.reactionBase + Math.random() * 0.2;
        bot.target = found;
        hear(found.x, found.z, bot.team, 19, null);
      } else if (bot.targetVisible) {
        bot.targetVisible = false;
      }
    }

    if (bot.mode === 'plant') {
      bot.speed = 0;
      bot.moving = false;
      faceToward(bot, bot.x + Math.sin(bot.yaw), bot.z + Math.cos(bot.yaw), dt, 2);
      bot.plantT -= dt;
      if (bot.plantT <= 0) {
        bot.hasBomb = false;
        const site = world.siteAt(bot.x, bot.z);
        if (callbacks.plant && site) callbacks.plant(site, bot.x, bot.z, bot);
        S.bomb.carrier = null;
        bot.mode = 'defend';
        bot.holdX = bot.x;
        bot.holdZ = bot.z;
        bot.holdYaw = bot.yaw;
        bot.route = [];
        bot.routeIndex = 0;
      }
      return;
    }

    if (bot.mode === 'defusing') {
      bot.speed = 0;
      bot.moving = false;
      const target = bot.target;
      if (target && target.alive && bot.targetVisible && Math.hypot(target.x - bot.x, target.z - bot.z) < 10) {
        bot.mode = 'combat';
        return;
      }
      bot.defuseT += dt;
      if (bot.defuseT >= 5.2) {
        if (callbacks.defuse) callbacks.defuse(bot);
        bot.defuseT = 0;
      }
      return;
    }

    if (bot.target && bot.target.alive) {
      bot.mode = 'combat';
      if (updateCombat(bot, dt)) return;
    }

    if (S.bomb.planted) {
      const site = S.bomb.site;
      const isOnSite = site && Math.hypot(bot.x - site.x, bot.z - site.z) < 9;
      if (bot.team === 'ct') {
        if (isOnSite && bot.targetVisible) {
          return;
        }
        if (!isOnSite) {
          bot.mode = 'defuseRoute';
          const route = site && site.name === 'A' ? DEFUSE_A : DEFUSE_B;
          if (bot.route !== route) {
            if (bot.routeIndex >= bot.route.length || bot.route[0][0] !== route[0][0]) {
              bot.route = route;
              bot.routeIndex = 0;
            }
          }
          followRoute(bot, dt, 4.5);
          return;
        }
        const bombDistance = Math.hypot(bot.x - S.bomb.x, bot.z - S.bomb.z);
        if (bombDistance < 1.45 && !bot.targetVisible) {
          bot.mode = 'defusing';
          bot.defuseT = 0;
          bot.faceX = S.bomb.x;
          bot.faceZ = S.bomb.z;
          return;
        }
        faceToward(bot, S.bomb.x, S.bomb.z, dt, 7);
        bot.mode = 'defuseRoute';
        const step = Math.min(3.8 * dt, bombDistance);
        const moved = stepBot(bot, ((S.bomb.x - bot.x) / (bombDistance || 1)) * step, ((S.bomb.z - bot.z) / (bombDistance || 1)) * step);
        if (!moved) {
          const route = site && site.name === 'A' ? DEFUSE_A : DEFUSE_B;
          followRoute(bot, dt, 4.2);
        }
        return;
      }
      if (!isOnSite) {
        bot.mode = 'route';
        const route = site && site.name === 'A' ? T_ROUTE_A : T_ROUTE_B;
        if (bot.route !== route) {
          bot.route = route;
          bot.routeIndex = 0;
        }
        followRoute(bot, dt, 4.4);
        return;
      }
      if (bot.mode !== 'hold' && bot.mode !== 'defend') {
        bot.mode = 'hold';
        bot.holdX = bot.x;
        bot.holdZ = bot.z;
        bot.holdYaw = bot.yaw;
      }
      continueHold(bot, dt);
      return;
    }

    if (bot.team === 't' && bot.hasBomb) {
      const site = world.siteAt(bot.x, bot.z);
      if (site && Math.hypot(bot.x - site.x, bot.z - site.z) < 5.2) {
        bot.mode = 'plant';
        bot.plantT = 3.3;
        bot.fireCd = 0;
        return;
      }
      followRoute(bot, dt, 4.65);
      return;
    }

    if (bot.mode === 'route') {
      followRoute(bot, dt, bot.team === 't' ? 4.5 : 4.2);
      if (bot.routeIndex >= bot.route.length) {
        bot.mode = 'hold';
        bot.holdX = bot.x;
        bot.holdZ = bot.z;
        bot.holdYaw = bot.yaw;
      }
      return;
    }

    if (bot.mode === 'combat') {
      return;
    }

    if (bot.alertT > 0 && bot.team === 'ct') {
      const alarmDistance = Math.hypot(bot.alertX - bot.x, bot.alertZ - bot.z);
      if (alarmDistance < 18) {
        faceToward(bot, bot.alertX, bot.alertZ, dt, 5);
      }
    }

    continueHold(bot, dt);
  }

  function continueHold(bot, dt) {
    bot.scan += dt * 0.8;
    const scanYaw = bot.holdYaw + Math.sin(bot.scan) * 0.7;
    bot.yaw = angleLerp(bot.yaw, scanYaw, 3 * dt);
    const dx = bot.holdX - bot.x;
    const dz = bot.holdZ - bot.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 1.1) {
      const step = Math.min(2.8 * dt, distance);
      const moved = stepBot(bot, (dx / distance) * step, (dz / distance) * step);
      bot.moving = moved;
      bot.speed = moved ? 2.8 : 0;
    } else {
      bot.moving = false;
      bot.speed = 0;
    }
  }

  function syncMesh(bot) {
    bot.group.position.set(bot.x, bot.alive ? bot.y : 0.33, bot.z);
    if (bot.alive) bot.group.rotation.set(0, bot.yaw, 0);
  }

  function update(dt) {
    elapsed += dt;
    const live = S.phase === 'live';
    for (const bot of list) {
      if (bot.alive && live) updateBot(bot, dt);
      syncMesh(bot);
    }
  }

  function aliveCount(team) {
    let count = 0;
    for (const bot of list) if (bot.team === team && bot.alive) count++;
    return count;
  }

  function inboundCount() {
    return aliveCount('ct') + (player.alive ? 1 : 0);
  }

  function findCarrier() {
    for (const bot of list) if (bot.team === 't' && bot.alive && bot.hasBomb) return bot;
    return null;
  }

  function nearestBombDefuser() {
    for (const bot of list) if (bot.team === 'ct' && bot.alive && bot.mode === 'defusing') return bot;
    return null;
  }

  function stageShot(mode) {
    const set = (bot, x, z, yaw, botMode = 'hold', alive = true) => {
      bot.x = x;
      bot.z = z;
      bot.y = 0;
      bot.yaw = yaw;
      bot.alive = alive;
      bot.hp = alive ? 100 : 0;
      bot.mode = botMode;
      bot.target = null;
      bot.targetVisible = false;
      bot.holdX = x;
      bot.holdZ = z;
      bot.holdYaw = yaw;
      bot.group.rotation.set(0, yaw, alive ? 0 : Math.PI / 2);
      bot.group.position.set(x, alive ? 0 : 0.33, z);
      bot.group.visible = true;
    };
    const terrorists = list.filter((bot) => bot.team === 't');
    const guards = list.filter((bot) => bot.team === 'ct');
    if (mode === 'start') {
      set(terrorists[0], 20, -28, Math.PI);
      set(terrorists[1], 31, -24, Math.PI);
      set(terrorists[2], -20, -28, Math.PI);
      set(terrorists[3], -31, -24, Math.PI);
      set(terrorists[4], 0, -18, Math.PI);
      set(guards[0], -6, 27, 0);
      set(guards[1], 7, 26, 0);
      set(guards[2], -13, 24, 0.5);
      set(guards[3], 13, 23, -0.5);
    } else if (mode === 'play') {
      set(terrorists[0], 27, -16, 0, 'hold');
      set(terrorists[1], 33, -11, 0.4, 'hold');
      set(terrorists[2], 20, -13, 0, 'hold');
      set(terrorists[3], 8, -9, 0.2, 'hold');
      set(terrorists[4], 0, -2, 0, 'hold');
      set(guards[0], 18, -7, Math.PI);
      set(guards[1], 12, -2, Math.PI * 0.75);
      set(guards[2], 6, 6, Math.PI);
      set(guards[3], -2, 12, Math.PI * 0.7);
    } else if (mode === 'buy') {
      set(terrorists[0], 0, -29, Math.PI);
      set(terrorists[1], 8, -28, Math.PI);
      set(terrorists[2], -8, -28, Math.PI);
      set(terrorists[3], 16, -26, Math.PI);
      set(terrorists[4], -16, -26, Math.PI);
      set(guards[0], 0, 29, 0);
      set(guards[1], 7, 28, 0);
      set(guards[2], -7, 28, 0);
      set(guards[3], 13, 26, 0);
    } else {
      set(terrorists[0], 27, -17, 0, 'hold', false);
      set(terrorists[1], 32, -10, 0.5, 'hold', false);
      set(terrorists[2], 21, -20, 0.2, 'hold');
      set(terrorists[3], 15, -5, 0, 'hold');
      set(terrorists[4], 7, 2, 0, 'hold');
      set(guards[0], 18, -7, Math.PI);
      set(guards[1], 12, -3, Math.PI * 0.8);
      set(guards[2], 20, 3, Math.PI);
      set(guards[3], 4, 10, Math.PI * 0.6);
    }
    for (const bot of list) {
      bot.route = [];
      bot.routeIndex = 0;
      bot.speed = 0;
      bot.moving = false;
    }
  }

  function listBots() {
    return list;
  }

  function visualFor(bot) {
    return bot.group;
  }

  return {
    list,
    resetRound,
    update,
    setCallbacks,
    hear,
    rayHit,
    damageBot,
    aliveCount,
    inboundCount,
    findCarrier,
    nearestBombDefuser,
    stageShot,
    listBots,
    visualFor,
    transferBomb,
  };
}
