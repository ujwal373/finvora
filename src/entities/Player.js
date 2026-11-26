import * as THREE from 'three';
import { PLAYER } from '../config.js';
import { createCharacter, animateCharacter, seatPose } from './Character.js';

export const DEFAULT_LOOK = { skin: 0xc08a64, shirt: 0xd4a846, pants: 0x1f2630, hair: 0x15100c, hairStyle: 'short', top: 'shirt', outer: 0x2b2f38, shoes: 0x1a1a1a, accs: [] };

export class Player {
  constructor(scene, collision, { castShadow, look }) {
    this.collision = collision;
    this.scene = scene; this.castShadow = castShadow;
    this.char = createCharacter({ ...DEFAULT_LOOK, ...(look || {}) }, { castShadow, blobShadow: true });
    this.object = this.char.root;
    scene.add(this.object);
    this.pos = { x: PLAYER.spawn.x, z: PLAYER.spawn.z };
    this.y = 0; this.vy = 0;
    this.vel = new THREE.Vector2();
    this.yaw = PLAYER.spawn.rot;
    this.speed = 0;
    this.frozen = false;
    this.distanceWalked = 0;
    this._sync();
  }

  place(x, z, yaw) {
    this.pos.x = x; this.pos.z = z;
    this.collision.resolve(this.pos, PLAYER.radius);
    if (yaw !== undefined) this.yaw = yaw;
    this.vel.set(0, 0);
    this._sync();
  }

  /** `cameraYaw` turns joystick/WASD input into camera-relative world movement. */
  update(dt, input, cameraYaw) {
    let mx = 0, mz = 0;
    if (!this.frozen) {
      // Forward = away from the camera.
      const fx = -Math.sin(cameraYaw), fz = -Math.cos(cameraYaw);
      const rx = -fz, rz = fx; // right-hand vector
      mx = fx * input.moveY + rx * input.moveX;
      mz = fz * input.moveY + rz * input.moveX;
    }
    const mag = Math.min(1, Math.hypot(mx, mz));
    const target = (input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed) * mag;
    const desired = new THREE.Vector2(mag ? (mx / Math.hypot(mx, mz)) * target : 0, mag ? (mz / Math.hypot(mx, mz)) * target : 0);
    const accel = mag ? 14 : 18;
    this.vel.lerp(desired, 1 - Math.exp(-accel * dt));

    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.y * dt;
    this.collision.resolve(this.pos, PLAYER.radius);
    const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
    this.speed = dt > 0 ? moved / dt : 0;
    this.distanceWalked += moved;

    if (this.vel.lengthSq() > 0.05) {
      const targetYaw = Math.atan2(this.vel.x, this.vel.y);
      let d = targetYaw - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-12 * dt));
    }

    // Jump
    if (!this.frozen && input.pressed.has('jump') && this.y <= 0.001) this.vy = PLAYER.jumpVelocity;
    if (this.y > 0 || this.vy > 0) {
      this.vy -= PLAYER.gravity * dt;
      this.y = Math.max(0, this.y + this.vy * dt);
      if (this.y === 0) this.vy = 0;
    }

    animateCharacter(this.char, dt, this.speed, this.y > 0.05);
    this._sync();
  }

  /** Rebuild the character with a new look (avatar editor / wardrobe). */
  setLook(look) {
    const visible = this.object.visible;
    this.object.parent?.remove(this.object);
    this.object.traverse((o) => { if (o.isMesh && o.geometry && !o.geometry.parameters) o.geometry.dispose(); });
    this.char = createCharacter({ ...DEFAULT_LOOK, ...look }, { castShadow: this.castShadow, blobShadow: true });
    this.object = this.char.root; this.object.visible = visible;
    if (this.seated) { const { group, seat } = this.seated; this.seated = null; this.seatIn(group, seat); return; }
    this.scene.add(this.object);
    this._sync();
  }

  /** Sit in a vehicle: the character is parented to the vehicle so it moves with it, visible through the glass. */
  seatIn(group, seat) {
    this.seated = { group, seat };
    group.add(this.object);
    this.object.position.set(seat.x, seat.y - 0.9, seat.z);
    this.object.rotation.set(0, 0, 0);
    this.object.visible = true;
    seatPose(this.char, seat.pose);
  }

  standUp() {
    if (!this.seated) return;
    this.seated = null;
    this.scene.add(this.object);
    seatPose(this.char, null);
    this._sync();
  }

  faceTowards(x, z) { this.yaw = Math.atan2(x - this.pos.x, z - this.pos.z); this._sync(); }

  forward() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }

  _sync() {
    if (this.seated) return;
    this.object.position.set(this.pos.x, this.y, this.pos.z);
    this.object.rotation.y = this.yaw;
  }
}
