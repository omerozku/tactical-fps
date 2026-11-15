import * as THREE from 'three';
import { PALETTE } from './palette.js';

export class Bots {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.bots = [];
    this.spawnBots();
  }

  spawnBots() {
    // 5 Terrorist bots
    for (let i = 0; i < 5; i++) {
      const geom = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
      const mat = new THREE.MeshStandardMaterial({ color: PALETTE.t, roughness: 0.6 });
      const mesh = new THREE.Mesh(geom, mat);
      
      const pos = this.world.spawnT.clone().add(new THREE.Vector3((i - 2) * 3, 0.9, (Math.random() - 0.5) * 4));
      mesh.position.copy(pos);
      mesh.castShadow = true;
      this.scene.add(mesh);

      this.bots.push({
        mesh,
        hp: 100,
        alive: true,
        patrolTimer: Math.random() * 5,
        targetPos: pos.clone(),
        role: i < 2 ? 'rushA' : (i < 4 ? 'rushB' : 'mid')
      });
    }
  }

  update(dt, playerPos) {
    this.bots.forEach(bot => {
      if (!bot.alive) return;

      // Simple AI routing & movement
      bot.patrolTimer -= dt;
      if (bot.patrolTimer <= 0) {
        bot.patrolTimer = 4 + Math.random() * 3;
        const offset = new THREE.Vector3((Math.random() - 0.5) * 20, 0, (Math.random() - 0.5) * 20);
        bot.targetPos.copy(this.world.spawnT).add(offset);
      }

      const dir = bot.targetPos.clone().sub(bot.mesh.position);
      dir.y = 0;
      const dist = dir.length();
      if (dist > 1.0) {
        dir.normalize();
        bot.mesh.position.addScaledVector(dir, 3.5 * dt);
        bot.mesh.lookAt(bot.mesh.position.clone().add(dir));
      }

      // If player is close, attack/look at player
      const toPlayer = playerPos.clone().sub(bot.mesh.position);
      toPlayer.y = 0;
      if (toPlayer.length() < 25) {
        bot.mesh.lookAt(playerPos.clone().setY(bot.mesh.position.y));
      }
    });
  }

  checkHit(raycaster, damage, isHeadshot) {
    let hitBot = null;
    let minDst = Infinity;

    this.bots.forEach(bot => {
      if (!bot.alive) return;
      const intersects = raycaster.intersectObject(bot.mesh);
      if (intersects.length > 0 && intersects[0].distance < minDst) {
        minDst = intersects[0].distance;
        hitBot = bot;
      }
    });

    if (hitBot) {
      const actualDmg = isHeadshot ? damage * 3.5 : damage;
      hitBot.hp -= actualDmg;
      if (hitBot.hp <= 0) {
        hitBot.alive = false;
        hitBot.mesh.visible = false;
      }
      return { bot: hitBot, headshot: isHeadshot };
    }
    return null;
  }

  reset() {
    this.bots.forEach((bot, i) => {
      bot.hp = 100;
      bot.alive = true;
      bot.mesh.visible = true;
      const pos = this.world.spawnT.clone().add(new THREE.Vector3((i - 2) * 3, 0.9, (Math.random() - 0.5) * 4));
      bot.mesh.position.copy(pos);
      bot.targetPos.copy(pos);
    });
  }
}
