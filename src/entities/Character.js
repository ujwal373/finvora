import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Low-poly humanoid. Each body part is ONE mesh built from vertex-coloured boxes merged together,
// so a character costs 6 draw calls (2 legs, 2 arms, torso, head) and all characters share one material.
// Faces +Z at rotation.y = 0. Limbs pivot at hips/shoulders for a procedural walk cycle.

const sharedMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const shadowGeo = new THREE.CircleGeometry(0.42, 12).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
const col = new THREE.Color();

function part(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed();
  col.setHex(color).convertSRGBToLinear();
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  return g;
}

function mesh(parts, castShadow) {
  const m = new THREE.Mesh(mergeGeometries(parts), sharedMat);
  m.castShadow = castShadow;
  parts.forEach((p) => p.dispose());
  return m;
}

export function createCharacter(look, { castShadow = false, blobShadow = true } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const accs = new Set(look.accs || [look.accessory]);
  const top = look.top || (look.accessory === 'coat' ? 'jacket' : 'shirt');
  const outer = look.outer ?? (look.accessory === 'coat' ? 0x3d342b : 0x2b2f38);
  const coat = top === 'jacket' || top === 'suit' || top === 'hoodie';
  const sleeve = coat ? outer : top === 'tshirt' ? look.skin : look.shirt;

  const shade = (c, f) => { const k = new THREE.Color(c); k.multiplyScalar(f); return k.getHex(); };
  const sneakers = look.shoes !== undefined && look.shoes !== 0x1a1a1a;
  const saree = top === 'saree', kurta = top === 'kurta';

  const leg = () => mesh([
    part(0.2, 0.82, 0.22, 0, -0.41, 0, look.pants),
    ...(saree ? [] : [part(0.21, 0.05, 0.23, 0, -0.74, 0, shade(look.pants, 0.75))]), // hem
    part(0.22, 0.1, 0.32, 0, -0.82, 0.05, look.shoes ?? 0x1a1a1a),
    ...(sneakers ? [part(0.23, 0.04, 0.33, 0, -0.86, 0.05, 0xf2f2ee)] : []), // white sole
  ], castShadow);
  const arm = (left) => mesh([
    ...(top === 'tshirt' ? [part(0.16, 0.24, 0.17, 0, -0.12, 0, look.shirt), part(0.15, 0.38, 0.16, 0, -0.43, 0, look.skin)]
      : saree ? [part(0.16, 0.18, 0.17, 0, -0.09, 0, shade(look.shirt, 0.7)), part(0.14, 0.44, 0.15, 0, -0.4, 0, look.skin)]
      : [part(0.15, 0.62, 0.16, 0, -0.31, 0, sleeve), part(0.16, 0.06, 0.17, 0, -0.6, 0, coat ? look.shirt : shade(sleeve, 0.85))]), // cuff
    part(0.13, 0.12, 0.13, 0, -0.66, 0, look.skin),
    ...(left && accs.has('watch') ? [part(0.15, 0.05, 0.15, 0, -0.57, 0, 0xd4a846)] : []),
    ...(!left && saree ? [part(0.12, 0.05, 0.12, 0, -0.58, 0, 0xd4a846)] : []), // bangles
  ], castShadow);

  const hipL = new THREE.Group(); hipL.position.set(-0.13, 0.9, 0); hipL.add(leg()); body.add(hipL);
  const hipR = new THREE.Group(); hipR.position.set(0.13, 0.9, 0); hipR.add(leg()); body.add(hipR);
  const shL = new THREE.Group(); shL.position.set(-0.35, 1.52, 0); shL.add(arm(true)); body.add(shL);
  const shR = new THREE.Group(); shR.position.set(0.35, 1.52, 0); shR.add(arm()); body.add(shR);

  const T = (w, h, d, x, y, z, c) => torsoParts.push(part(w, h, d, x, y, z, c));
  const torsoParts = [part(0.54, 0.66, 0.3, 0, 1.23, 0, saree ? shade(look.shirt, 0.7) : look.shirt)];
  T(0.16, 0.06, 0.16, 0, 1.58, 0, look.skin); // neck
  if (top === 'shirt' || top === 'suit' || top === 'jacket') { T(0.12, 0.08, 0.04, -0.07, 1.54, 0.15, top === 'shirt' ? shade(look.shirt, 1.15) : 0xf2f2ee); T(0.12, 0.08, 0.04, 0.07, 1.54, 0.15, top === 'shirt' ? shade(look.shirt, 1.15) : 0xf2f2ee); }
  if (top === 'shirt') for (const y of [1.42, 1.3, 1.18, 1.06]) T(0.03, 0.03, 0.02, 0, y, 0.155, shade(look.shirt, 0.6));
  if (!saree && !kurta && top !== 'hoodie') T(0.55, 0.06, 0.31, 0, 0.92, 0, top === 'suit' ? 0x111111 : 0x2a1f16); // belt
  if (coat) {
    T(0.2, 0.66, 0.33, -0.18, 1.23, 0, outer); T(0.2, 0.66, 0.33, 0.18, 1.23, 0, outer); T(0.58, 0.2, 0.33, 0, 1.5, 0, outer);
    if (top === 'suit' || top === 'jacket') { T(0.07, 0.3, 0.02, -0.09, 1.42, 0.17, shade(outer, 0.7)); T(0.07, 0.3, 0.02, 0.09, 1.42, 0.17, shade(outer, 0.7)); }
    if (top === 'suit') { T(0.08, 0.04, 0.02, -0.17, 1.36, 0.17, 0xf2f2ee); T(0.03, 0.03, 0.02, 0.1, 1.08, 0.17, 0x111111); T(0.03, 0.03, 0.02, 0.1, 1.0, 0.17, 0x111111); }
    if (top === 'jacket') { T(0.12, 0.1, 0.02, -0.17, 1.33, 0.17, shade(outer, 0.8)); T(0.12, 0.1, 0.02, 0.17, 1.33, 0.17, shade(outer, 0.8)); }
    if (top === 'hoodie') { T(0.44, 0.3, 0.16, 0, 1.62, -0.19, outer); T(0.3, 0.14, 0.02, 0, 1.0, 0.17, shade(outer, 0.8)); T(0.02, 0.16, 0.02, -0.05, 1.45, 0.17, 0xf2f2ee); T(0.02, 0.16, 0.02, 0.05, 1.45, 0.17, 0xf2f2ee); }
  }
  if (kurta) { T(0.56, 0.5, 0.31, 0, 0.74, 0, look.shirt); T(0.03, 0.4, 0.02, 0, 1.36, 0.155, 0xd4a846); T(0.57, 0.04, 0.32, 0, 0.5, 0, 0xd4a846); }
  if (saree) {
    T(0.5, 0.96, 0.36, 0, 0.42, 0, look.shirt);                                    // skirt to the ankles
    for (const x of [-0.06, 0, 0.06]) T(0.02, 0.8, 0.02, x, 0.42, 0.185, shade(look.shirt, 0.8)); // pleats
    T(0.51, 0.06, 0.37, 0, -0.03, 0, 0xd4a846);                                     // gold border
    T(0.2, 0.2, 0.32, 0.14, 0.95, 0.01, look.shirt); T(0.2, 0.2, 0.32, 0.02, 1.13, 0.01, look.shirt); T(0.2, 0.22, 0.32, -0.12, 1.32, 0.01, look.shirt); // pallu across the chest
    T(0.2, 0.9, 0.06, -0.2, 1.05, -0.18, look.shirt); T(0.2, 0.06, 0.07, -0.2, 0.6, -0.18, 0xd4a846);       // pallu down the back
  }
  if (look.accessory === 'tie' || top === 'suit') T(0.07, 0.42, 0.02, 0, 1.18, 0.16, top === 'suit' ? 0x7a1c1c : 0x8a1c1c);
  if (look.accessory === 'badge') T(0.1, 0.07, 0.02, -0.14, 1.37, 0.16, 0xd4a846);
  if (accs.has('bag')) { const b = look.bag ?? 0x2f4f3f; T(0.4, 0.46, 0.16, 0, 1.22, -0.23, b); T(0.3, 0.14, 0.04, 0, 1.08, -0.32, shade(b, 0.8)); T(0.05, 0.5, 0.03, -0.15, 1.3, 0.16, shade(b, 0.7)); T(0.05, 0.5, 0.03, 0.15, 1.3, 0.16, shade(b, 0.7)); }
  body.add(mesh(torsoParts, castShadow));

  const head = new THREE.Group(); head.position.y = 1.74; body.add(head);
  const hp = [part(0.3, 0.32, 0.3, 0, 0, 0, look.skin)];
  const hs = look.hairStyle || 'short';
  if (accs.has('cap')) { const c = look.cap ?? look.shirt; hp.push(part(0.33, 0.12, 0.33, 0, 0.19, 0, c), part(0.3, 0.03, 0.17, 0, 0.14, 0.23, c), part(0.05, 0.03, 0.05, 0, 0.26, 0, 0xf2f2ee)); }
  else hp.push(part(0.32, 0.1, 0.32, 0, 0.17, 0, look.hair));
  if (hs === 'long') hp.push(part(0.32, 0.56, 0.08, 0, -0.08, -0.15, look.hair));
  if (hs === 'bob') hp.push(part(0.32, 0.36, 0.08, 0, 0.02, -0.15, look.hair));
  if (hs === 'bun') hp.push(part(0.14, 0.14, 0.14, 0, 0.16, -0.2, look.hair));
  hp.push(part(0.05, 0.04, 0.02, -0.07, 0.03, 0.155, 0x1a1410), part(0.05, 0.04, 0.02, 0.07, 0.03, 0.155, 0x1a1410)); // eyes
  if (accs.has('glasses')) hp.push(part(0.11, 0.07, 0.02, -0.07, 0.03, 0.165, 0x111111), part(0.11, 0.07, 0.02, 0.07, 0.03, 0.165, 0x111111), part(0.3, 0.02, 0.02, 0, 0.06, 0.165, 0x111111));
  head.add(mesh(hp, castShadow));

  if (blobShadow) {
    const s = new THREE.Mesh(shadowGeo, shadowMat);
    s.position.y = 0.12; s.renderOrder = -1;
    root.add(s);
  }
  return { root, body, hipL, hipR, shL, shR, head, phase: Math.random() * 10 };
}

/** Procedural walk/idle. `speed` in m/s drives stride amount and cadence. */
/** Seated poses: 'sit' (car/auto driver) or 'ride' (scooter), or null to stand. */
export function seatPose(c, pose) {
  c.seated = pose || null;
  c.body.position.y = 0; c.body.rotation.x = 0; c.head.rotation.y = 0;
  if (pose === 'sit') { c.hipL.rotation.set(-1.45, 0, 0.05); c.hipR.rotation.set(-1.45, 0, -0.05); c.shL.rotation.set(-1.05, 0, 0.12); c.shR.rotation.set(-1.05, 0, -0.12); }
  else if (pose === 'ride') { c.hipL.rotation.set(-1.15, 0, 0.22); c.hipR.rotation.set(-1.15, 0, -0.22); c.shL.rotation.set(-1.2, 0, 0.18); c.shR.rotation.set(-1.2, 0, -0.18); c.body.rotation.x = 0.12; }
  else for (const p of [c.hipL, c.hipR, c.shL, c.shR]) p.rotation.set(0, 0, 0);
}

export function animateCharacter(c, dt, speed, airborne = false) {
  if (c.seated) return;
  const moving = speed > 0.15;
  c.phase += dt * (moving ? 2.2 + speed * 1.25 : 1.4);
  const amt = moving ? Math.min(0.85, 0.25 + speed * 0.11) : 0;
  const s = Math.sin(c.phase * 2);
  const k = 1 - Math.exp(-18 * dt);
  const L = THREE.MathUtils.lerp;
  c.hipL.rotation.x = L(c.hipL.rotation.x, airborne ? -0.5 : s * amt, k);
  c.hipR.rotation.x = L(c.hipR.rotation.x, airborne ? 0.3 : -s * amt, k);
  c.shL.rotation.x = L(c.shL.rotation.x, airborne ? -2.4 : -s * amt * 0.9, k);
  c.shR.rotation.x = L(c.shR.rotation.x, airborne ? -2.4 : s * amt * 0.9, k);
  c.body.position.y = moving ? Math.abs(Math.cos(c.phase * 2)) * 0.05 * (amt / 0.6) : Math.sin(c.phase) * 0.008;
  c.body.rotation.x = moving ? Math.min(0.12, speed * 0.012) : 0;
  c.head.rotation.y = moving ? 0 : Math.sin(c.phase * 0.35) * 0.25;
}
