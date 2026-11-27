import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CITY } from '../config.js';
import { signalAt, isSignalised, STOP_LINE } from './Signals.js';
import logoUrl from '../assets/accofintra-logo.jpg';

// Road traffic. Vehicles follow the boulevard grid, keep LEFT (Indian rule of the road),
// pick a random turn at every junction, slow for corners and brake for pedestrians,
// the player and the vehicle ahead. Each vehicle is one merged, vertex-coloured mesh (1 draw call).

// Glossy paint and tinted glass: they pick up reflections from the scene's environment lighting.
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.28 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x5f7f92, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.5, depthWrite: false });
const col = new THREE.Color();
function paint(g, color) {
  col.setHex(color).convertSRGBToLinear();
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([col.r, col.g, col.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv');
  return g;
}
function box(w, h, d, x, y, z, color) { return paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed(), color); }
/** Wheel along the x axis: tyre plus a silver rim. */
function wheel(r, w, x, y, z) {
  return [
    paint(new THREE.CylinderGeometry(r, r, w, 14).rotateZ(Math.PI / 2).translate(x, y, z).toNonIndexed(), 0x141414),
    paint(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 10).rotateZ(Math.PI / 2).translate(x, y, z).toNonIndexed(), 0xb8bcc2),
  ];
}
const wheels = (L, W, r = 0.34, inset = 0.75) => [-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => wheel(r, 0.24, sx * (W / 2 - 0.1), r, sz * (L / 2 - inset))));
/** Simple seated driver (traffic only): torso + head, visible through the glass. RHD: driver on the right. */
const driver = (y, z, shirt = 0x3d5a80) => [box(0.42, 0.5, 0.3, -0.36, y + 0.25, z, shirt), box(0.24, 0.26, 0.24, -0.36, y + 0.65, z, 0xb07a52), box(0.26, 0.08, 0.26, -0.36, y + 0.8, z, 0x15100c)];

/**
 * Generic car body. o: L, W, wheelR, bodyH, cabL, cabH, cabZ (cabin centre offset), hood (front drop), roof colour,
 * plus extras. Returns { parts (opaque), glass }.
 */
function car(c, o) {
  const { L, W, r = 0.34, bodyH = 0.62, cabL = 2.1, cabH = 0.62, cabZ = -0.2, roof = c, trim = 0x16181c, light = 0xfff2c0, drv = true } = o;
  const base = r * 0.75, top = base + bodyH, cw = W - 0.16;
  const parts = [
    box(W, bodyH, L - 0.3, 0, base + bodyH / 2, 0, c),                       // body
    box(W - 0.04, bodyH * 0.55, 0.22, 0, base + bodyH * 0.3, L / 2 - 0.12, trim), // front bumper
    box(W - 0.04, bodyH * 0.55, 0.22, 0, base + bodyH * 0.3, -L / 2 + 0.12, trim), // rear bumper
    box(W * 0.45, bodyH * 0.28, 0.05, 0, base + bodyH * 0.55, L / 2 - 0.14, 0x0c0c0c), // grille
    box(0.34, 0.12, 0.06, -W / 2 + 0.28, base + bodyH * 0.7, L / 2 - 0.15, light), box(0.34, 0.12, 0.06, W / 2 - 0.28, base + bodyH * 0.7, L / 2 - 0.15, light),
    box(0.3, 0.1, 0.06, -W / 2 + 0.26, base + bodyH * 0.7, -L / 2 + 0.15, 0xe5534b), box(0.3, 0.1, 0.06, W / 2 - 0.26, base + bodyH * 0.7, -L / 2 + 0.15, 0xe5534b),
    box(0.05, 0.03, L - 0.6, -W / 2 - 0.005, base + bodyH * 0.55, 0, trim), box(0.05, 0.03, L - 0.6, W / 2 + 0.005, base + bodyH * 0.55, 0, trim), // door lines
    box(cw, 0.07, cabL * 0.82, 0, top + cabH - 0.035, cabZ, roof),            // roof
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(0.08, cabH, 0.08, sx * (cw / 2 - 0.04), top + cabH / 2, cabZ + sz * (cabL / 2 - 0.12), roof))), // pillars
    box(0.16, 0.1, 0.2, -W / 2 - 0.08, top + 0.12, cabZ + cabL / 2 - 0.1, roof), box(0.16, 0.1, 0.2, W / 2 + 0.08, top + 0.12, cabZ + cabL / 2 - 0.1, roof), // mirrors
    box(cw - 0.1, 0.25, cabL - 0.3, 0, top + 0.12, cabZ, 0x2a2a2e),          // seats / interior
    ...wheels(L, W, r, Math.min(0.85, L * 0.19)),
    ...(drv ? driver(top - 0.3, cabZ + 0.15) : []),
  ];
  const glass = [box(cw - 0.06, cabH - 0.05, cabL - 0.2, 0, top + (cabH - 0.05) / 2, cabZ, 0)];
  return { parts, glass };
}

export const MODELS = {
  hatch: (c, d = true) => ({ L: 3.8, W: 1.72, speed: 9.5, ...car(c, { L: 3.8, W: 1.72, cabL: 2.2, cabZ: -0.35, cabH: 0.66, drv: d }) }),
  sedan: (c, d = true) => ({ L: 4.5, W: 1.8, speed: 10.5, ...car(c, { L: 4.5, W: 1.8, cabL: 2.3, cabZ: -0.15, drv: d }) }),
  taxi: (c, d = true) => { const m = car(0x141414, { L: 4.2, W: 1.72, roof: 0xe8c21e, cabL: 2.2, cabZ: -0.2, drv: d }); m.parts.push(box(0.6, 0.18, 0.3, 0, 1.72, -0.2, 0xffe46b)); return { L: 4.2, W: 1.72, speed: 9, ...m }; },
  suv: (c, d = true) => { const m = car(c, { L: 4.6, W: 2.0, r: 0.42, bodyH: 0.85, cabL: 3.1, cabH: 0.72, cabZ: -0.3, drv: d }); m.parts.push(box(1.6, 0.06, 0.06, -0.0, 2.18, -0.9, 0x222222), box(1.6, 0.06, 0.06, 0, 2.18, 0.4, 0x222222)); return { L: 4.6, W: 2.0, speed: 9, ...m }; },
  ev: (c, d = true) => { const m = car(c, { L: 4.4, W: 1.9, bodyH: 0.56, cabL: 2.6, cabH: 0.58, cabZ: -0.15, light: 0x9fe6ff, drv: d }); m.parts.push(box(1.7, 0.05, 0.05, 0, 0.62, 2.2, 0x7fd8ff), box(1.7, 0.05, 0.05, 0, 0.62, -2.2, 0xe5534b)); return { L: 4.4, W: 1.9, speed: 10, ...m }; },
  sports: (c, d = true) => { const m = car(c, { L: 4.5, W: 1.98, r: 0.36, bodyH: 0.46, cabL: 1.8, cabH: 0.48, cabZ: -0.35, roof: 0x111111, drv: d }); m.parts.push(box(1.98, 0.06, 0.4, 0, 1.08, -2.05, 0x111111), box(0.1, 0.32, 0.1, -0.7, 0.9, -2.05, 0x111111), box(0.1, 0.32, 0.1, 0.7, 0.9, -2.05, 0x111111), box(0.5, 0.04, 1.3, 0, 0.74, 1.3, 0x111111)); return { L: 4.5, W: 1.98, speed: 12, ...m }; },
  player: (c = 0x1800ad, d = false) => { const m = car(c, { L: 4.3, W: 1.9, bodyH: 0.56, cabL: 2.0, cabH: 0.55, cabZ: -0.35, roof: 0xf2f2ee, trim: 0x101010, drv: d });
    m.parts.push(box(0.16, 0.02, 4.0, -0.14, 0.82, 0, 0xf2f2ee), box(0.16, 0.02, 4.0, 0.14, 0.82, 0, 0xf2f2ee), box(0.03, 0.021, 4.0, 0, 0.82, 0, 0xd4a846), // twin white stripes, gold pinstripe
      box(0.02, 0.05, 3.7, -0.955, 0.33, 0, 0xd4a846), box(0.02, 0.05, 3.7, 0.955, 0.33, 0, 0xd4a846),                                   // gold side lines
      box(1.9, 0.06, 0.45, 0, 1.12, -2.0, 0xf2f2ee), box(0.1, 0.28, 0.1, -0.7, 0.96, -2.0, 0x101010), box(0.1, 0.28, 0.1, 0.7, 0.96, -2.0, 0x101010));
    return { L: 4.3, W: 1.9, speed: 0, brand: true, ...m }; },
  hatchP: (c) => MODELS.hatch(c, false),
  sedanP: (c) => MODELS.sedan(c, false),
  scooter: (c) => ({ L: 1.85, W: 0.7, speed: 0, rider: 'scooter', parts: [
    box(0.36, 0.1, 0.9, 0, 0.32, 0.05, 0x1b1d22),          // floorboard
    box(0.46, 0.5, 0.75, 0, 0.62, -0.45, c),              // rear body
    box(0.4, 0.14, 0.62, 0, 0.92, -0.42, 0x141414),        // seat
    box(0.44, 0.75, 0.16, 0, 0.7, 0.55, c),               // front apron
    box(0.3, 0.2, 0.3, 0, 0.42, 0.68, c),                 // front mudguard
    box(0.07, 0.5, 0.07, 0, 1.12, 0.6, 0x2a2a2e),          // steering stem
    box(0.66, 0.05, 0.05, 0, 1.36, 0.6, 0x1b1b1b),         // handlebar
    box(0.24, 0.13, 0.1, 0, 1.3, 0.68, c), box(0.14, 0.08, 0.04, 0, 1.3, 0.735, 0xfff2c0), // headlight
    box(0.04, 0.16, 0.04, -0.3, 1.46, 0.58, 0x1b1b1b), box(0.04, 0.16, 0.04, 0.3, 1.46, 0.58, 0x1b1b1b), // mirror stalks
    box(0.1, 0.06, 0.03, -0.3, 1.56, 0.58, 0x9aa4ad), box(0.1, 0.06, 0.03, 0.3, 1.56, 0.58, 0x9aa4ad),
    box(0.2, 0.08, 0.04, 0, 0.72, -0.84, 0xe5534b),        // tail light
    ...wheel(0.26, 0.14, 0, 0.26, 0.68), ...wheel(0.26, 0.16, 0, 0.26, -0.62),
  ], glass: [] }),
  auto: (c = 0x1f7a3a, d = true) => ({ L: 2.8, W: 1.45, speed: 7, parts: [
    box(1.42, 0.5, 2.6, 0, 0.5, -0.05, c), box(1.42, 0.08, 1.9, 0, 1.92, -0.35, 0xe8c21e), box(1.42, 1.15, 0.08, 0, 1.33, -1.25, 0x161616),
    ...[-1, 1].flatMap((sx) => [box(0.06, 1.15, 0.06, sx * 0.68, 1.33, 0.55, 0x161616), box(0.06, 1.15, 0.06, sx * 0.68, 1.33, -1.25, 0x161616)]),
    box(1.3, 0.38, 0.5, 0, 0.92, -0.85, 0x2a2a2e), box(0.4, 0.18, 0.45, -0.0, 0.85, 0.35, 0x2a2a2e),
    box(0.7, 0.42, 0.1, 0, 0.82, 1.22, c), box(0.2, 0.1, 0.04, 0, 0.9, 1.28, 0xfff2c0), box(0.6, 0.05, 0.05, 0, 1.15, 0.95, 0x1b1b1b),
    ...wheel(0.28, 0.18, 0, 0.28, 1.0), ...wheel(0.28, 0.18, -0.6, 0.28, -0.85), ...wheel(0.28, 0.18, 0.6, 0.28, -0.85),
    ...(d ? [box(0.4, 0.5, 0.28, 0, 1.05, 0.3, 0x5a6b7a), box(0.24, 0.26, 0.24, 0, 1.45, 0.3, 0x8d5a3b)] : []),
  ], glass: [box(1.2, 0.6, 0.04, 0, 1.6, 0.55, 0)] }),
  autoP: (c) => ({ ...MODELS.auto(c, false), rider: 'auto' }),
  bus: () => ({ L: 9.5, W: 2.5, speed: 7, parts: [
    box(2.5, 1.2, 9.3, 0, 1.05, 0, 0xc0392b), box(2.5, 0.25, 9.3, 0, 2.95, 0, 0xe8e4da), box(2.46, 0.06, 9.2, 0, 3.1, 0, 0xc0392b),
    ...[-4, -2, 0, 2, 4].flatMap((z) => [-1, 1].map((sx) => box(0.1, 1.2, 0.12, sx * 1.22, 2.25, z, 0xc0392b))),
    box(2.4, 0.3, 0.1, 0, 1.4, 4.66, 0x0c0c0c), box(0.4, 0.15, 0.06, -0.9, 1.0, 4.66, 0xfff2c0), box(0.4, 0.15, 0.06, 0.9, 1.0, 4.66, 0xfff2c0),
    box(1.6, 0.32, 0.06, 0, 3.0, 4.66, 0x0c0c0c), ...driver(1.2, 4.0, 0x2c3e50),
    ...wheels(9.5, 2.5, 0.5, 1.6),
  ], glass: [box(2.44, 1.2, 9.2, 0, 2.25, 0, 0)] }),
};
const SPEED = { hatch: 9.5, sedan: 10.5, taxi: 9, suv: 9, ev: 10, sports: 12, auto: 7, bus: 7 };
const PAINT = [0xc0392b, 0x2e86de, 0xecf0f1, 0x7f8c8d, 0x27ae60, 0x34495e, 0xd35400, 0x8e44ad, 0xf5f5f0, 0x2c3e50];
const MIX = ['hatch', 'hatch', 'sedan', 'sedan', 'taxi', 'auto', 'auto', 'suv', 'ev', 'bus', 'hatch', 'sedan', 'sports'];

/** Seat positions in vehicle-local space (x left+, y up, z forward) for the player when driving. */
export const SEATS = { scooter: { x: 0, y: 0.98, z: -0.35, pose: 'ride' }, auto: { x: 0, y: 0.92, z: 0.25, pose: 'sit' }, car: { x: -0.38, y: 0.2, z: -0.1, pose: 'sit' } }; // y = hip height: low enough that the head stays under the roof

/** Builds a vehicle as a group: one opaque merged mesh plus one transparent glass mesh. */
export function vehicleMesh(kind, color) {
  const spec = MODELS[kind](color);
  const group = new THREE.Group();
  const body = new THREE.Mesh(mergeGeometries(spec.parts), mat);
  group.add(body);
  if (spec.glass && spec.glass.length) { const glass = new THREE.Mesh(mergeGeometries(spec.glass), glassMat); glass.renderOrder = 1; group.add(glass); }
  spec.parts.forEach((p) => p.dispose()); (spec.glass || []).forEach((p) => p.dispose());
  group.userData.body = body;
  if (spec.brand) brandVehicle(group, spec.L, spec.W);
  return { mesh: group, L: spec.L, W: spec.W, rider: spec.rider || 'car' };
}

let logoTex = null, logoMat = null;
/** AccoFinTra logo decals on both doors and the bonnet of the company car. */
export function brandVehicle(group, L, W, { doorY = 0.6, bonnetY = 0.836 } = {}) {
  if (typeof document === 'undefined') return group;
  logoTex ||= new THREE.TextureLoader().load(logoUrl, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; });
  logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 4;
  logoMat ||= new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.35, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), logoMat); d.position.set(s * (W / 2 + 0.012), doorY, -0.15); d.rotation.y = s * Math.PI / 2; group.add(d); }
  const hood = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), logoMat); hood.rotation.x = -Math.PI / 2; hood.position.set(0, bonnetY, L / 2 - 0.62); group.add(hood);
}

export class Traffic {
  constructor(scene, nav, count, { castShadow }) {
    this.nav = nav;
    this.cars = [];
    this.scene = scene;
    const edges = [];
    for (const n of nav.nodes) for (const m of nav.adj[n.id]) edges.push([n.id, m]);
    for (let i = 0; i < count; i++) {
      const kind = MIX[i % MIX.length];
      const v = vehicleMesh(kind, PAINT[(i * 7) % PAINT.length]);
      const spec = { L: v.L, W: v.W, speed: SPEED[kind] };
      const mesh = v.mesh;
      v.mesh.userData.body.castShadow = castShadow;
      scene.add(mesh);
      const [a, b] = edges[(i * 37 + 11) % edges.length];
      const A = nav.nodes[a], Bn = nav.nodes[b];
      const t = 0.3 + ((i * 0.17) % 0.4);
      const car = { kind, mesh, L: spec.L, W: spec.W, vmax: spec.speed * (0.85 + Math.random() * 0.3), speed: 0, a, b, c: null, wait: 0, ghost: 0 };
      const f = norm(Bn.x - A.x, Bn.z - A.z);
      car.pos = { x: A.x + (Bn.x - A.x) * t + f.z * CITY.laneOffset, z: A.z + (Bn.z - A.z) * t - f.x * CITY.laneOffset };
      car.heading = Math.atan2(f.x, f.z);
      this._chooseNext(car);
      this.cars.push(car);
    }
  }

  _chooseNext(car) {
    const opts = this.nav.adj[car.b].filter((n) => n !== car.a);
    car.c = opts.length ? opts[Math.floor(Math.random() * opts.length)] : car.a;
    const A = this.nav.nodes[car.a], B = this.nav.nodes[car.b], C = this.nav.nodes[car.c];
    const fin = norm(B.x - A.x, B.z - A.z), fout = norm(C.x - B.x, C.z - B.z);
    const L = CITY.laneOffset;
    const leftIn = { x: fin.z, z: -fin.x }, leftOut = { x: fout.z, z: -fout.x };
    const straight = Math.abs(fin.x - fout.x) < 0.01 && Math.abs(fin.z - fout.z) < 0.01;
    const uturn = Math.abs(fin.x + fout.x) < 0.01 && Math.abs(fin.z + fout.z) < 0.01;
    // Corner point where the incoming and outgoing left lanes meet.
    car.target = straight || uturn
      ? { x: B.x + leftIn.x * L, z: B.z + leftIn.z * L }
      : { x: B.x + (leftIn.x + leftOut.x) * L, z: B.z + (leftIn.z + leftOut.z) * L };
    car.turning = !straight;
    car.fin = fin; car.leftIn = leftIn;
  }

  update(dt, pedestrians, camPos, cullRange, others = []) {
    this.t = (this.t || 0) + dt;
    for (const car of this.cars) {
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      const rx = -fz, rz = fx;
      // ---- look ahead for anything to brake for
      let limit = car.vmax;
      const reach = car.L / 2 + 2.5 + car.speed * 1.1;
      let blockedByCar = false, blocker = null;
      const check = (ox, oz, halfWidth, isCar, who = null) => {
        const dx = ox - car.pos.x, dz = oz - car.pos.z;
        const ahead = dx * fx + dz * fz;
        if (ahead <= 0 || ahead > reach + (isCar ? 2 : 0)) return;
        if (Math.abs(dx * rx + dz * rz) > car.W / 2 + halfWidth) return;
        const gap = ahead - car.L / 2 - (isCar ? 2.2 : 1.2);
        const v = Math.max(0, gap) * 1.2;
        if (v < limit) { limit = v; if (isCar) { blockedByCar = true; blocker = who; } }
      };
      for (const p of pedestrians) check(p.x, p.z, 0.6, false);
      if (car.ghost <= 0) for (const o of this.cars) if (o !== car) check(o.pos.x, o.pos.z, o.W / 2, true, o);
      for (const o of others) check(o.pos.x, o.pos.z, o.W / 2 + 0.6, true);
      // ---- corner speed
      const dT = Math.hypot(car.target.x - car.pos.x, car.target.z - car.pos.z);
      if (car.turning && dT < 14) limit = Math.min(limit, 4.2 + dT * 0.25);
      // ---- traffic signal at the junction ahead: stop at the line on red (and on amber if there is room to stop)
      car.atSignal = false;
      const Bn = this.nav.nodes[car.b];
      if (isSignalised(Bn.x, Bn.z)) {
        const dB = Math.abs((Bn.x - car.pos.x) * car.fin.x + (Bn.z - car.pos.z) * car.fin.z);
        const gap = dB - STOP_LINE;
        if (gap > -0.5 && gap < 40) {
          const light = signalAt(this.t, Bn.x, Bn.z, Math.abs(car.fin.x) > 0.5 ? 'x' : 'z');
          const canStop = gap > (car.speed * car.speed) / (2 * 7) + 0.5;
          if (light === 'red' || (light === 'amber' && canStop)) {
            const v = Math.max(0, gap) * 0.9;
            if (v < limit) { limit = v; car.atSignal = gap < 6; }
          }
        }
      }
      // ---- queueing behind a car that waits at a signal is normal; only a real jam triggers the creep-through
      car.queued = !!(blockedByCar && blocker && (blocker.atSignal || blocker.queued));
      if (car.speed < 0.2 && blockedByCar && !car.queued) { car.wait += dt; if (car.wait > 5) { car.ghost = 2; car.wait = 0; } } else car.wait = 0;
      car.ghost -= dt;

      const accel = limit > car.speed ? 4 : 10;
      car.speed += Math.sign(limit - car.speed) * Math.min(Math.abs(limit - car.speed), accel * dt);
      // ---- steer toward the lane target
      const dx = car.target.x - car.pos.x, dz = car.target.z - car.pos.z;
      const want = Math.atan2(dx, dz);
      let dh = want - car.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      car.heading += dh * Math.min(1, dt * (car.turning ? 3.2 : 6));
      const step = car.speed * dt;
      const d = Math.hypot(dx, dz) || 1;
      // Move mostly along heading but always converge on the target so cars never orbit a corner.
      const hx = Math.sin(car.heading), hz = Math.cos(car.heading);
      car.pos.x += (hx * 0.6 + (dx / d) * 0.4) * step;
      car.pos.z += (hz * 0.6 + (dz / d) * 0.4) * step;
      // Lane discipline: between junctions, hold the centre of the LEFT lane (never drift towards the middle).
      const A = this.nav.nodes[car.a], B = this.nav.nodes[car.b];
      if (Math.hypot(car.pos.x - A.x, car.pos.z - A.z) > 9 && Math.hypot(car.pos.x - B.x, car.pos.z - B.z) > 9) {
        const ex = car.pos.x - (B.x + car.leftIn.x * CITY.laneOffset), ez = car.pos.z - (B.z + car.leftIn.z * CITY.laneOffset);
        const lat = ex * car.leftIn.x + ez * car.leftIn.z, k = Math.min(1, dt * 4);
        car.pos.x -= car.leftIn.x * lat * k; car.pos.z -= car.leftIn.z * lat * k;
        let dh2 = Math.atan2(car.fin.x, car.fin.z) - car.heading; dh2 = Math.atan2(Math.sin(dh2), Math.cos(dh2));
        car.heading += dh2 * Math.min(1, dt * 3);
      }
      if (d < 1.2) { car.a = car.b; car.b = car.c; this._chooseNext(car); }

      car.mesh.position.set(car.pos.x, 0, car.pos.z);
      car.mesh.rotation.y = car.heading;
      car.mesh.visible = Math.hypot(car.pos.x - camPos.x, car.pos.z - camPos.z) < cullRange;
    }
  }

  /** Push a walking circle out of every vehicle body (vehicles are oriented boxes). */
  resolve(pos, r) {
    for (const car of this.cars) {
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      const dx = pos.x - car.pos.x, dz = pos.z - car.pos.z;
      const lz = dx * fx + dz * fz, lx = dx * -fz + dz * fx; // local: along / across
      const hl = car.L / 2, hw = car.W / 2;
      const qx = Math.max(-hw, Math.min(lx, hw)), qz = Math.max(-hl, Math.min(lz, hl));
      let ex = lx - qx, ez = lz - qz, dd = Math.hypot(ex, ez);
      if (dd >= r) continue;
      if (dd < 1e-6) { // inside: leave by the nearer side
        if (hw - Math.abs(lx) < hl - Math.abs(lz)) { ex = Math.sign(lx) || 1; ez = 0; } else { ex = 0; ez = Math.sign(lz) || 1; }
        const nx = ex ? Math.sign(lx || 1) * (hw + r) : lx, nz = ez ? Math.sign(lz || 1) * (hl + r) : lz;
        pos.x = car.pos.x + nx * -fz + nz * fx; pos.z = car.pos.z + nx * fx + nz * fz;
      } else {
        const push = r - dd; ex /= dd; ez /= dd;
        pos.x += (ex * -fz + ez * fx) * push; pos.z += (ex * fx + ez * fz) * push;
      }
    }
  }
}

function norm(x, z) { const L = Math.hypot(x, z) || 1; return { x: x / L, z: z / L }; }
