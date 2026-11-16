const RADIUS = 0.36;
const STAND_HEIGHT = 1.8;
const CROUCH_HEIGHT = 1.3;
const STAND_EYE = 1.66;
const CROUCH_EYE = 1.12;

function approach(value, target, rate) {
  return value + (target - value) * Math.min(1, rate);
}

export function createPlayer(world, camera, S) {
  const player = {
    team: 'ct',
    name: 'RANGER',
    isPlayer: true,
    x: 0,
    y: 0,
    z: 30,
    vx: 0,
    vz: 0,
    vy: 0,
    yaw: 0,
    pitch: 0,
    recoilPitch: 0,
    recoilYaw: 0,
    eye: STAND_EYE,
    radius: RADIUS,
    height: STAND_HEIGHT,
    grounded: true,
    crouching: false,
    alive: true,
    hp: S.hp,
    armor: S.armor,
    bob: 0,
    bobOffset: 0,
    roll: 0,
    speed: 0,
    moving: false,
    sprinting: false,
    lastDamage: 0,
    camera,
  };

  function reset(spawn) {
    player.x = spawn ? spawn.x : 0;
    player.z = spawn ? spawn.z : 30;
    player.y = 0;
    player.vx = 0;
    player.vz = 0;
    player.vy = 0;
    player.yaw = 0;
    player.pitch = 0;
    player.recoilPitch = 0;
    player.recoilYaw = 0;
    player.eye = STAND_EYE;
    player.height = STAND_HEIGHT;
    player.grounded = true;
    player.crouching = false;
    player.alive = true;
    player.hp = 100;
    player.armor = S.armor;
    player.bob = 0;
    player.bobOffset = 0;
    player.roll = 0;
    player.speed = 0;
    S.hp = 100;
    S.alive = true;
    player.syncCamera();
  }

  function look(dx, dy, sensitivity = 0.00215) {
    player.yaw -= dx * sensitivity;
    player.pitch -= dy * sensitivity;
    if (player.pitch > 1.46) player.pitch = 1.46;
    if (player.pitch < -1.46) player.pitch = -1.46;
    if (player.yaw > Math.PI) player.yaw -= Math.PI * 2;
    if (player.yaw < -Math.PI) player.yaw += Math.PI * 2;
  }

  function addRecoil(pitchKick, yawKick) {
    player.recoilPitch += pitchKick;
    player.recoilYaw += yawKick;
  }

  function moveWithCollision(dx, dz, feet, height) {
    if (dx !== 0) {
      const nx = player.x + dx;
      if (!world.circleBlocked(nx, player.z, RADIUS, feet, feet + height)) player.x = nx;
      else player.vx = 0;
    }
    if (dz !== 0) {
      const nz = player.z + dz;
      if (!world.circleBlocked(player.x, nz, RADIUS, feet, feet + height)) player.z = nz;
      else player.vz = 0;
    }
  }

  function update(dt, input, canMove) {
    if (player.alive) {
      look(input.mouse.dx, input.mouse.dy);
    } else {
      look(input.mouse.dx * 0.35, input.mouse.dy * 0.35);
    }

    if (!canMove || !player.alive) {
      if (player.grounded) {
        player.vx = approach(player.vx, 0, 12 * dt);
        player.vz = approach(player.vz, 0, 12 * dt);
      }
      player.moving = false;
    } else {
      const forwardInput = (input.keys.KeyW || input.keys.ArrowUp ? 1 : 0) - (input.keys.KeyS || input.keys.ArrowDown ? 1 : 0);
      const strafeInput = (input.keys.KeyD || input.keys.ArrowRight ? 1 : 0) - (input.keys.KeyA || input.keys.ArrowLeft ? 1 : 0);
      player.crouching = !!(input.keys.ControlLeft || input.keys.ControlRight || input.keys.KeyC);
      player.sprinting = !!(input.keys.ShiftLeft || input.keys.ShiftRight) && !player.crouching;

      const forwardX = -Math.sin(player.yaw);
      const forwardZ = -Math.cos(player.yaw);
      const rightX = Math.cos(player.yaw);
      const rightZ = -Math.sin(player.yaw);
      let wishX = forwardX * forwardInput + rightX * strafeInput;
      let wishZ = forwardZ * forwardInput + rightZ * strafeInput;
      const wishLength = Math.hypot(wishX, wishZ);
      player.moving = wishLength > 0.01;

      let targetSpeed = 6.1;
      if (player.crouching) targetSpeed = 2.7;
      else if (player.sprinting) targetSpeed = 3.5;

      if (wishLength > 0.01) {
        wishX = wishX / wishLength * targetSpeed;
        wishZ = wishZ / wishLength * targetSpeed;
      } else {
        wishX = 0;
        wishZ = 0;
      }

      const accel = player.grounded ? 46 : 13;
      player.vx = approach(player.vx, wishX, accel * dt);
      player.vz = approach(player.vz, wishZ, accel * dt);
      if (!player.moving && player.grounded) {
        player.vx = approach(player.vx, 0, 13 * dt);
        player.vz = approach(player.vz, 0, 13 * dt);
      }

      if (player.grounded && input.consume('Space')) {
        player.vy = 5.15;
        player.grounded = false;
      }
    }

    const targetHeight = player.crouching ? CROUCH_HEIGHT : STAND_HEIGHT;
    player.height = approach(player.height, targetHeight, 12 * dt);
    player.eye = approach(player.eye, player.crouching ? CROUCH_EYE : STAND_EYE, 12 * dt);

    const feet = player.y;
    const head = feet + player.height + 0.08;
    moveWithCollision(player.vx * dt, player.vz * dt, feet, head);

    const support = world.supportAt(player.x, player.z, RADIUS * 1.15, player.y);
    player.vy -= 17.5 * dt;
    player.y += player.vy * dt;
    if (player.y <= support + 0.001 && player.vy <= 0) {
      player.y = support;
      player.vy = 0;
      player.grounded = true;
    } else {
      player.grounded = false;
    }
    if (player.y < 0) {
      player.y = 0;
      player.vy = 0;
      player.grounded = true;
    }

    player.speed = Math.hypot(player.vx, player.vz);
    if (player.grounded && player.moving) {
      player.bob += dt * player.speed * 1.8;
    }
    const targetBob = player.grounded && player.moving ? Math.sin(player.bob) * 0.018 * Math.min(1, player.speed / 5) : 0;
    player.bobOffset = approach(player.bobOffset, targetBob, 14 * dt);
    player.roll = approach(player.roll, -player.vx * 0.004, 8 * dt);

    const recovery = player.lastDamage > 0 ? 2.5 : 7.5;
    player.lastDamage = Math.max(0, player.lastDamage - dt);
    player.recoilPitch = approach(player.recoilPitch, 0, recovery * dt);
    player.recoilYaw = approach(player.recoilYaw, 0, recovery * dt);

    S.hp = player.hp;
    S.alive = player.alive;
    player.syncCamera();
  }

  function syncCamera() {
    const eyeBob = player.alive ? player.bobOffset : 0;
    camera.position.set(player.x, player.y + player.eye + eyeBob, player.z);
    camera.rotation.set(player.pitch + player.recoilPitch, player.yaw + player.recoilYaw, player.roll, 'YXZ');
  }

  function takeDamage(amount, fromX, fromZ) {
    if (!player.alive) return false;
    player.lastDamage = 0.55;
    let healthLoss = amount;
    if (player.armor > 0) {
      healthLoss = amount * 0.58;
      player.armor = Math.max(0, player.armor - amount * 0.55);
    }
    player.hp -= healthLoss;
    S.hp = Math.max(0, Math.round(player.hp));
    S.armor = Math.round(player.armor);
    S.damagePulse++;
    if (fromX !== undefined) {
      S.damageFromX = fromX;
      S.damageFromZ = fromZ;
    }
    if (player.hp <= 0) {
      player.hp = 0;
      player.alive = false;
      S.hp = 0;
      S.alive = false;
      S.deaths++;
      return true;
    }
    return false;
  }

  function setPose(x, z, yaw, pitch = 0) {
    player.x = x;
    player.z = z;
    player.y = 0;
    player.vx = 0;
    player.vz = 0;
    player.vy = 0;
    player.yaw = yaw;
    player.pitch = pitch;
    player.recoilPitch = 0;
    player.recoilYaw = 0;
    player.grounded = true;
    player.alive = true;
    player.hp = 100;
    S.alive = true;
    S.hp = 100;
    player.syncCamera();
  }

  function forward(out) {
    camera.getWorldDirection(out);
    return out;
  }

  player.reset = reset;
  player.update = update;
  player.syncCamera = syncCamera;
  player.addRecoil = addRecoil;
  player.takeDamage = takeDamage;
  player.setPose = setPose;
  player.forward = forward;
  return player;
}
