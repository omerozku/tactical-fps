import * as THREE from 'three';

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.position = camera.position;
    this.velocity = new THREE.Vector3();
    this.speed = 7.0;
    this.jumpSpeed = 6.0;
    this.gravity = 18.0;
    this.height = 1.7;
    this.crouching = false;
    this.grounded = false;
    this.yaw = 0;
    this.pitch = 0;

    this.position.copy(world.spawnCT);
  }

  update(dt, input) {
    // Mouse look
    const sens = 0.002;
    this.yaw -= input.mouse.dx * sens;
    this.pitch -= input.mouse.dy * sens;
    this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));

    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // Movement
    this.crouching = input.keys['ControlLeft'] || input.keys['ControlRight'];
    const currentSpeed = this.crouching ? 3.5 : (input.keys['ShiftLeft'] ? 9.0 : 7.0);

    const moveDir = new THREE.Vector3();
    if (input.keys['KeyW'] || input.keys['ArrowUp']) moveDir.z -= 1;
    if (input.keys['KeyS'] || input.keys['ArrowDown']) moveDir.z += 1;
    if (input.keys['KeyA'] || input.keys['ArrowLeft']) moveDir.x -= 1;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) moveDir.x += 1;
    moveDir.normalize();
    moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    this.velocity.x = moveDir.x * currentSpeed;
    this.velocity.z = moveDir.z * currentSpeed;

    if (this.grounded) {
      if (input.keys['Space']) {
        this.velocity.y = this.jumpSpeed;
        this.grounded = false;
      } else {
        this.velocity.y = 0;
      }
    } else {
      this.velocity.y -= this.gravity * dt;
    }

    // Apply velocity with simple AABB collision check
    const nextPos = this.position.clone().addScaledVector(this.velocity, dt);
    
    // Height adjustment for crouch
    const targetHeight = this.crouching ? 1.1 : 1.7;
    this.height += (targetHeight - this.height) * 10 * dt;
    nextPos.y = Math.max(this.height, nextPos.y);

    // Boundary check inside compound
    nextPos.x = Math.max(-44, Math.min(44, nextPos.x));
    nextPos.z = Math.max(-58, Math.min(58, nextPos.z));

    this.position.copy(nextPos);
    if (this.position.y <= this.height) {
      this.position.y = this.height;
      this.grounded = true;
    }
  }
}
