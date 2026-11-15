import * as THREE from 'three';
import { PALETTE } from './palette.js';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.spawnCT = new THREE.Vector3(0, 1.7, 35);
    this.spawnT = new THREE.Vector3(0, 1.7, -35);
    this.siteA = new THREE.Vector3(22, 0, -25);
    this.siteB = new THREE.Vector3(-22, 0, -25);
    this.buildMap();
  }

  buildMap() {
    // Ground (Foundry compound)
    const groundGeo = new THREE.PlaneGeometry(90, 120);
    const groundMat = new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Exterior Walls & Compound Boundaries
    const wallMat = new THREE.MeshStandardMaterial({ color: PALETTE.concrete, roughness: 0.8 });
    const steelMat = new THREE.MeshStandardMaterial({ color: PALETTE.steel, metalness: 0.5, roughness: 0.4 });
    const crateMat = new THREE.MeshStandardMaterial({ color: PALETTE.crate, roughness: 0.7 });

    const addBox = (w, h, d, x, y, z, mat = wallMat, isCollider = true) => {
      const geom = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      if (isCollider) {
        this.colliders.push(new THREE.Box3().setFromObject(mesh));
      }
      return mesh;
    };

    // Outer boundary walls
    addBox(90, 8, 2, 0, 4, -60); // North
    addBox(90, 8, 2, 0, 4, 60);  // South
    addBox(2, 8, 120, -46, 4, 0); // West
    addBox(2, 8, 120, 46, 4, 0);  // East

    // Mid dividing wall / tunnels
    addBox(30, 8, 2, -15, 4, 0);
    addBox(30, 8, 2, 15, 4, 0);

    // Site A (East compound)
    addBox(16, 6, 16, 28, 3, -35, steelMat);
    // Site A crates (cover)
    addBox(4, 3, 4, 20, 1.5, -28, crateMat);
    addBox(3, 2, 6, 32, 1.0, -25, crateMat);

    // Site B (West compound)
    addBox(16, 6, 16, -28, 3, -35, steelMat);
    // Site B crates (cover)
    addBox(4, 3, 4, -20, 1.5, -28, crateMat);
    addBox(5, 2.5, 3, -30, 1.25, -22, crateMat);

    // Mid lane crates & obstacles
    addBox(4, 2.5, 4, 0, 1.25, -5, crateMat);
    addBox(6, 4, 2, 0, 2, 10, wallMat);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff5e6, 1.2);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    this.scene.add(sun);

    const siteALight = new THREE.PointLight(0x2e75e5, 2, 30);
    siteALight.position.set(28, 6, -35);
    this.scene.add(siteALight);

    const siteBLight = new THREE.PointLight(0xe54b2e, 2, 30);
    siteBLight.position.set(-28, 6, -35);
    this.scene.add(siteBLight);
  }
}
