import * as THREE from 'three';
import { CITY } from '../config.js';

// GTA-style GPS: a route along the roads from the player to the waypoint, drawn as a glowing
// ribbon on the street and as a line on the minimap / map. Recomputed as you move.

/** A pseudo "place" for any point: it leaves towards the nearest road. */
export function roadAnchor(x, z) {
  const nx = CITY.roadXs.reduce((a, r) => (Math.abs(r - x) < Math.abs(a - x) ? r : a));
  const nz = CITY.roadZs.reduce((a, r) => (Math.abs(r - z) < Math.abs(a - z) ? r : a));
  if (Math.abs(nx - x) <= Math.abs(nz - z)) {
    const side = nx >= x ? '+x' : '-x';
    return { x: Math.abs(nx - x) < 0.6 ? nx + (side === '+x' ? -0.6 : 0.6) : x, z, side };
  }
  const side = nz >= z ? '+z' : '-z';
  return { x, z: Math.abs(nz - z) < 0.6 ? nz + (side === '+z' ? -0.6 : 0.6) : z, side };
}

export class GPS {
  constructor(scene, nav) {
    this.nav = nav;
    this.route = null;
    this.mat = new THREE.MeshBasicMaterial({ color: 0xf0c868, transparent: true, opacity: 0.55, depthWrite: false, fog: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.renderOrder = 2; this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.timer = 0; this.last = null;
  }

  clear() { this.route = null; this.mesh.visible = false; this.last = null; }

  update(dt, player, wp, t) {
    if (!wp) { if (this.route) this.clear(); return; }
    this.timer -= dt;
    const moved = !this.last || Math.hypot(player.x - this.last.px, player.z - this.last.pz) > 3 || Math.hypot(wp.x - this.last.wx, wp.z - this.last.wz) > 2;
    if (this.timer <= 0 && moved) {
      this.timer = 0.4;
      this.last = { px: player.x, pz: player.z, wx: wp.x, wz: wp.z };
      const a = roadAnchor(player.x, player.z);
      const b = wp.side ? { x: wp.x, z: wp.z, side: wp.side } : roadAnchor(wp.x, wp.z);
      try { this.route = this.nav.route(a, b); this.route[0] = { x: player.x, z: player.z }; } catch { this.route = [{ x: player.x, z: player.z }, { x: wp.x, z: wp.z }]; }
      this._build();
    }
    this.mat.opacity = 0.42 + Math.sin(t * 4) * 0.12;
  }

  /** Remaining route length in metres. */
  length() {
    if (!this.route) return 0;
    let L = 0; for (let i = 1; i < this.route.length; i++) L += Math.hypot(this.route[i].x - this.route[i - 1].x, this.route[i].z - this.route[i - 1].z);
    return L;
  }

  _build() {
    const r = this.route, pos = [], w = 0.7, y = 0.16;
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1], b = r[i];
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
      if (L < 0.01) continue;
      const nx = (-dz / L) * w, nz = (dx / L) * w;
      // extend each segment by half a width so corners join neatly
      const ex = (dx / L) * w, ez = (dz / L) * w;
      const ax = a.x - ex, az = a.z - ez, bx = b.x + ex, bz = b.z + ez;
      pos.push(ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz, ax + nx, y, az + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.mesh.geometry.dispose();
    this.mesh.geometry = g;
    this.mesh.visible = true;
  }
}
