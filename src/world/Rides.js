import { CITY } from '../config.js';
import { vehicleMesh } from './Traffic.js';
import { roadAnchor } from './GPS.js';
import { DRIVE_SCALE } from '../data/shop.js';

// Paid rides: the city bus between shelters, and an auto-rickshaw you call from the phone.
// The vehicle drives itself along the left lane of the route; you sit inside and watch the city go by.

export const FARES = {
  bus: (stops) => (stops <= 2 ? 10 : stops <= 4 ? 20 : 30), // flat stage fares (illustrative)
  // Auto meter (illustrative, modelled on Mumbai's meter: a minimum fare for the first 1.5 km, then per km)
  auto: (km) => Math.round(Math.max(26, 26 + (km - 1.5) * 17.14)),
};

/** Left-lane polyline along the road grid from one point to another (both anywhere in the city). */
export function lanePath(nav, from, to) {
  const a = roadAnchor(from.x, from.z), b = roadAnchor(to.x, to.z);
  const r = nav.route(a, b);
  const road = r.slice(1, -1);
  if (road.length < 2) return road;
  const L = CITY.laneOffset, out = [];
  const dir = (p, q) => { const dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1; return { x: dx / l, z: dz / l }; };
  const left = (d) => ({ x: d.z, z: -d.x });
  for (let i = 0; i < road.length; i++) {
    const p = road[i];
    const din = i > 0 ? dir(road[i - 1], p) : null, dout = i < road.length - 1 ? dir(p, road[i + 1]) : null;
    if (din && dout && Math.abs(din.x * dout.x + din.z * dout.z) < 0.5) {
      const l1 = left(din), l2 = left(dout); out.push({ x: p.x + (l1.x + l2.x) * L, z: p.z + (l1.z + l2.z) * L });
    } else { const l = left(din || dout); out.push({ x: p.x + l.x * L, z: p.z + l.z * L }); }
  }
  return out.filter((p, i) => i === 0 || Math.hypot(p.x - out[i - 1].x, p.z - out[i - 1].z) > 0.3);
}

export const pathLength = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) : 0), 0);
export const realKm = (metres) => (metres * DRIVE_SCALE) / 1000;

export class Ride {
  constructor(scene, { kind, path, speed, onArrive }) {
    this.kind = kind; this.path = path; this.speed = speed; this.onArrive = onArrive;
    const v = vehicleMesh(kind === 'bus' ? 'bus' : 'auto', kind === 'bus' ? undefined : 0x1f7a3a);
    this.mesh = v.mesh; this.W = v.W; this.L = v.L; scene.add(this.mesh);
    this.i = 1; this.pos = { ...path[0] };
    const d0 = path[1] || path[0];
    this.heading = Math.atan2(d0.x - path[0].x, d0.z - path[0].z);
    this.seat = kind === 'bus' ? { x: 0.6, y: 1.25, z: -1.5, pose: 'sit' } : { x: 0, y: 0.95, z: -0.75, pose: 'sit' };
    this.done = false; this.v = 0;
    this._sync();
  }
  get kmh() { return this.v * 3.6; }
  update(dt) {
    if (this.done) return;
    const tgt = this.path[this.i];
    const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z, d = Math.hypot(dx, dz);
    const last = this.i === this.path.length - 1;
    const want = last ? Math.min(this.speed, 0.9 * d + 1) : (d < 10 && this._turnAhead() ? Math.max(4, this.speed * 0.5) : this.speed);
    this.v += Math.sign(want - this.v) * Math.min(Math.abs(want - this.v), 5 * dt);
    const step = Math.min(d, this.v * dt);
    if (d > 1e-3) { this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step; }
    let dh = Math.atan2(dx, dz) - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * Math.min(1, dt * 5);
    if (d < 0.4) { if (last) { this.done = true; this.v = 0; this.onArrive?.(); } else this.i++; }
    this._sync();
  }
  _turnAhead() {
    const a = this.path[this.i - 1], b = this.path[this.i], c = this.path[this.i + 1];
    if (!a || !c) return false;
    const d1 = { x: b.x - a.x, z: b.z - a.z }, d2 = { x: c.x - b.x, z: c.z - b.z };
    return Math.abs(d1.x * d2.z - d1.z * d2.x) > 1e-3;
  }
  _sync() { this.mesh.position.set(this.pos.x, 0, this.pos.z); this.mesh.rotation.y = this.heading; }
  dispose(scene) { scene.remove(this.mesh); }
}
