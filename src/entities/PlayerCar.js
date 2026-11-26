import * as THREE from 'three';
import { vehicleMesh } from '../world/Traffic.js';
import { carById } from '../data/shop.js';

// The player's own car. Simple "bicycle" driving model: throttle, brake/reverse, speed-sensitive
// steering and a handbrake. Collides with buildings, trees, lamps, traffic and the city edge.

export const PARKING = { x: 8, z: 19.3, heading: 0 }; // nose-in bay on the south edge of Compound Square, facing the road

const MAX_REV = 6, BRAKE = 16, DRAG = 0.35, ROLL = 1.2, WHEELBASE = 2.6, MAX_STEER = 0.55;

export class PlayerCar {
  constructor(scene, collision, { castShadow, saved, model = 'coupe', color = 0xd4a846 }) {
    this.scene = scene; this.castShadow = castShadow;
    this.setModel(model, color);
    this.collision = collision;
    this.pos = { x: saved?.x ?? PARKING.x, z: saved?.z ?? PARKING.z };
    this.heading = saved?.heading ?? PARKING.heading;
    this.speed = 0; this.steer = 0;
    this.occupied = false;
    // Painted parking bay
    const bay = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd4a846, transparent: true, opacity: 0.35, depthWrite: false }));
    bay.rotation.y = PARKING.heading; bay.position.set(PARKING.x, 0.1, PARKING.z);
    scene.add(bay);
    this._sync();
  }

  /** Swap the body for another owned vehicle (garage). */
  setModel(catalogId, color) {
    const spec = carById[catalogId] || carById.coupe;
    if (this.mesh) { this.onBeforeSwap?.(this.mesh); this.scene.remove(this.mesh); this.mesh.traverse((o) => o.isMesh && o.geometry.dispose()); }
    const v = vehicleMesh(spec.model, color);
    this.mesh = v.mesh; this.L = v.L; this.W = v.W; this.rider = v.rider;
    v.mesh.userData.body.castShadow = this.castShadow;
    this.maxFwd = spec.maxKmh / 3.6; this.accel = spec.accel; this.catalogId = spec.id;
    this.scene.add(this.mesh);
    if (this.pos) this._sync();
  }

  get kmh() { return Math.abs(this.speed) * 3.6; }
  forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }

  /** Body sample circles used for collision. */
  circles() {
    const f = this.forward(), r = this.W / 2;
    return [-1, 0, 1].map((k) => ({ x: this.pos.x + f.x * k * (this.L / 2 - r), z: this.pos.z + f.z * k * (this.L / 2 - r), r }));
  }

  update(dt, input, { traffic, npcs }) {
    const maxFwd = this.outOfFuel ? 2.5 : this.maxFwd; // an empty tank only lets you crawl to the pump
    const throttle = this.occupied ? input.moveY : 0;
    const steerIn = this.occupied ? input.moveX : 0;
    const handbrake = this.occupied && input.jumpHeld;
    // Longitudinal
    if (throttle > 0.05) {
      if (this.speed < -0.3) this.speed += BRAKE * throttle * dt; else this.speed += this.accel * throttle * (1 - this.speed / maxFwd) * dt;
    } else if (throttle < -0.05) {
      if (this.speed > 0.3) this.speed -= BRAKE * -throttle * dt; else this.speed -= this.accel * 0.6 * -throttle * dt;
    } else {
      const roll = (ROLL + DRAG * Math.abs(this.speed)) * dt;
      this.speed = Math.abs(this.speed) <= roll ? 0 : this.speed - Math.sign(this.speed) * roll;
    }
    if (handbrake) { const b = BRAKE * 1.4 * dt; this.speed = Math.abs(this.speed) <= b ? 0 : this.speed - Math.sign(this.speed) * b; }
    this.speed = Math.max(-MAX_REV, Math.min(maxFwd, this.speed));
    // Steering: full lock at low speed, gentler at high speed
    const lock = MAX_STEER * (1 - Math.min(0.6, Math.abs(this.speed) / this.maxFwd * 0.7));
    this.steer += (steerIn * lock - this.steer) * Math.min(1, dt * 6);
    this.heading -= (this.speed * Math.tan(this.steer) / WHEELBASE) * dt * (handbrake ? 1.5 : 1);
    const f = this.forward();
    this.pos.x += f.x * this.speed * dt; this.pos.z += f.z * this.speed * dt;

    // Collisions: static world and traffic. Instead of bouncing, the car loses the part of its
    // speed that pointed into the obstacle and slides along it (head-on: stops; glancing: scrapes past).
    let nx = 0, nz = 0;
    for (let it = 0; it < 3; it++) for (const c of this.circles()) {
      const p = { x: c.x, z: c.z };
      this.collision.resolve(p, c.r);
      traffic.resolve(p, c.r);
      const dx = p.x - c.x, dz = p.z - c.z;
      if (dx || dz) { this.pos.x += dx; this.pos.z += dz; nx += dx; nz += dz; }
    }
    const nl = Math.hypot(nx, nz);
    if (nl > 1e-4) {
      const into = -(f.x * nx + f.z * nz) / nl * Math.sign(this.speed || 1); // 1 = head-on, 0 = parallel
      if (into > 0.15) {
        const before = Math.abs(this.speed);
        this.speed *= Math.max(0, 1 - into * 1.15);
        if (before > 6 && into > 0.6) this.onCrash?.(before);
      }
    }
    // Pedestrians step out of the way (and never get pushed into walls)
    for (const n of npcs) for (const c of this.circles()) {
      const dx = n.pos.x - c.x, dz = n.pos.z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.4;
      if (d < min && d > 1e-4) { n.pos.x += (dx / d) * (min - d); n.pos.z += (dz / d) * (min - d); this.collision.resolve(n.pos, 0.35); }
    }
    this._sync();
  }

  /** Where the driver steps out: beside the driver's door (right-hand drive, so the right side), else the left. */
  exitPoint() {
    const f = this.forward(), right = { x: -f.z, z: f.x };
    for (const side of [1, -1]) {
      const p = { x: this.pos.x + right.x * side * (this.W / 2 + 0.9), z: this.pos.z + right.z * side * (this.W / 2 + 0.9) };
      if (!this.collision.blocked(p.x, p.z, 0.45)) return p;
    }
    return { x: this.pos.x - f.x * (this.L / 2 + 1), z: this.pos.z - f.z * (this.L / 2 + 1) };
  }

  _sync() {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
  }

  serialize() { return { x: Math.round(this.pos.x * 100) / 100, z: Math.round(this.pos.z * 100) / 100, heading: Math.round(this.heading * 1000) / 1000 }; }
}
