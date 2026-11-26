import * as THREE from 'three';

// Third-person orbit camera. Yaw/pitch from mouse or touch drag, distance from wheel.
// A ray from the player's head to the desired position keeps the camera out of buildings.

export class CameraRig {
  constructor(camera, collision) {
    this.camera = camera;
    this.collision = collision;
    this.yaw = 0; // camera sits at target + (sin yaw, cos yaw) * distance
    this.pitch = 0.38;
    this.distance = 7.5;
    this.targetDistance = 7.5;
    this.minDist = 3; this.maxDist = 14;
    this.invertY = false;
    this.focus = new THREE.Vector3();
    this.current = new THREE.Vector3();
    this.lookAtOverride = null;
    this._init = false;
  }

  update(dt, input, target) {
    this.yaw -= input.lookDX;
    this.pitch += (this.invertY ? -1 : 1) * input.lookDY;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -0.15, 1.25);
    if (input.zoom) this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + input.zoom * 0.9, this.minDist, this.maxDist);
    this.distance += (this.targetDistance - this.distance) * (1 - Math.exp(-10 * dt));

    const goal = this.lookAtOverride || target;
    this.focus.lerp(new THREE.Vector3(goal.x, (goal.y ?? 0) + 1.55, goal.z), this._init ? 1 - Math.exp(-14 * dt) : 1);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    let dist = this.distance;
    const hit = this.collision.raycastBoxes(this.focus.x, this.focus.y, this.focus.z, dir.x, dir.y, dir.z, dist, !this.ignoreFoliage);
    if (hit < dist) dist = Math.max(1.2, hit - 0.35);
    const desired = this.focus.clone().addScaledVector(dir, dist);
    desired.y = Math.max(0.4, desired.y);
    if (!this._init) { this.current.copy(desired); this._init = true; }
    else this.current.lerp(desired, 1 - Math.exp(-(hit < this.distance ? 30 : 12) * dt));
    this.camera.position.copy(this.current);
    this.camera.lookAt(this.focus);
  }

  /** Swing the camera behind a given facing yaw (character forward = (sin, cos)). */
  snapBehind(faceYaw) { this.yaw = faceYaw + Math.PI; }
}
