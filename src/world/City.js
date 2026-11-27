import * as THREE from 'three';
import { CITY } from '../config.js';
import { BUILDINGS, DISTRICTS, BUS_STOPS, doorPoint } from '../data/buildings.js';
import { createCharacter } from '../entities/Character.js';
import logoUrl from '../assets/accofintra-logo.jpg';
import { windowTextures, signTexture, tickerTexture, groundTexture, paverTexture, grassTexture } from '../utils/textures.js';
import { distToSegment } from './Places.js';
import { vehicleMesh } from './Traffic.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EXTRA_STYLES, EXTRA_STYLE_NAMES, buildCentralPark, buildMetro, buildSignals, buildStreetProps } from './CityExtras.js';

const BLOCK_HALF = 20; // block spans centre ± 20 (roads are 10 wide)

/**
 * Builds the static city: ground, boulevards, 12 buildings, Compound Square park, trees and street lamps.
 * Registers colliders in `collision`. Returns handles for animation and interaction.
 */
export function buildCity(scene, collision, { preset, spurs, market }) {
  const city = { doors: [], nightMats: [], lampMat: null, animated: [], tickerCanvas: null };
  const shadows = preset.shadows;
  const win = windowTextures();
  const B = CITY.blocks, HB = BLOCK_HALF + (5 - CITY.asphaltHalf); // slab half-size reaches the asphalt edge

  // ---------- Ground (asphalt) ----------
  const gt = groundTexture(); gt.repeat.set(110, 110);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY.groundHalf * 2, CITY.groundHalf * 2).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: gt }));
  ground.receiveShadow = shadows;
  scene.add(ground);

  // Countryside beyond the outer ring road
  const grass = grassTexture();
  const outerMat = new THREE.MeshLambertMaterial({ map: grass.clone() });
  outerMat.map.needsUpdate = true; outerMat.map.repeat.set(0.25, 0.25);
  const ring = new THREE.Shape();
  const G = CITY.groundHalf, H = CITY.bound - 1;
  ring.moveTo(-G, -G); ring.lineTo(G, -G); ring.lineTo(G, G); ring.lineTo(-G, G);
  const hole = new THREE.Path(); hole.moveTo(-H, -H); hole.lineTo(-H, H); hole.lineTo(H, H); hole.lineTo(H, -H); ring.holes.push(hole);
  const outer = new THREE.Mesh(new THREE.ShapeGeometry(ring).rotateX(-Math.PI / 2), outerMat);
  outer.position.y = 0.03; outer.receiveShadow = shadows;
  scene.add(outer);

  // ---------- Blocks: one instanced pavement slab + kerb per block ----------
  const pav = paverTexture(); pav.repeat.set(11, 11);
  const blockPts = [];
  for (const bx of B) for (const bz of B) blockPts.push([bx, bz, 0]);
  const slabs = instanced(new THREE.BoxGeometry(HB * 2, 0.08, HB * 2), new THREE.MeshLambertMaterial({ map: pav }), blockPts, 0.04);
  slabs.receiveShadow = shadows; scene.add(slabs);
  scene.add(instanced(new THREE.BoxGeometry(HB * 2 + 0.4, 0.06, HB * 2 + 0.4), new THREE.MeshLambertMaterial({ color: 0x6d6b66 }), blockPts, 0.03));

  // ---------- Road markings (instanced) ----------
  const E = CITY.bound - 2;
  const dashPos = [];
  for (const x of CITY.roadXs) for (let z = -E; z <= E; z += 5) if (!CITY.roadZs.some((rz) => Math.abs(rz - z) < 7)) dashPos.push([x, z, 0]);
  for (const z of CITY.roadZs) for (let x = -E; x <= E; x += 5) if (!CITY.roadXs.some((rx) => Math.abs(rx - x) < 7)) dashPos.push([x, z, Math.PI / 2]);
  const crossPos = [];
  for (const x of CITY.roadXs) for (const z of CITY.roadZs) for (let k = -2.8; k <= 2.81; k += 1.4) {
    crossPos.push([x + k, z - 5.4, 0], [x + k, z + 5.4, 0], [x - 5.4, z + k, Math.PI / 2], [x + 5.4, z + k, Math.PI / 2]);
  }
  scene.add(instanced(new THREE.PlaneGeometry(0.22, 2.2).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xd4a846 }), dashPos, 0.02));
  scene.add(instanced(new THREE.PlaneGeometry(0.6, 2.4).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xcfcfc8 }), crossPos, 0.02));

  // ---------- Districts ----------
  buildTowerPlaza(scene, collision, city, { grass, shadows });
  buildBusStops(scene, collision, city, { shadows });
  const extraTrees = [];
  buildResidential(scene, collision, city, { win, shadows });
  for (const [bx, bz] of DISTRICTS.parks) buildGarden(scene, { grass, shadows, bx, bz, trees: extraTrees, preset });
  for (const [bx, bz] of DISTRICTS.bazaar) buildBazaar(scene, collision, city, { shadows, bx, bz });
  buildBusiness(scene, collision, city, { win, shadows });
  for (const [bx, bz] of DISTRICTS.lake) buildLake(scene, collision, city, { bx, bz, trees: extraTrees });
  for (const [bx, bz] of DISTRICTS.stadium) buildStadium(scene, collision, city, { bx, bz, shadows });
  for (const [bx, bz] of DISTRICTS.centralPark || []) buildCentralPark(scene, collision, city, { grass, shadows, bx, bz, trees: extraTrees });
  buildMetro(scene, collision, city, { shadows });
  buildSignals(scene, city, { shadows });
  buildStreetProps(scene, collision, city, { shadows });

  // ---------- Buildings ----------
  for (const b of BUILDINGS) buildBuilding(scene, collision, city, b, { win, shadows, market });

  // ---------- Showroom display cars ----------
  const show = BUILDINGS.find((b) => b.id === 'car-showroom');
  if (show) [['suv', 0x2e86de], ['sports', 0xc0392b], ['ev', 0xf2f2ee]].forEach(([model, color], i) => {
    const v = vehicleMesh(model, color);
    const x = show.x - 9 + i * 9, z = show.z - show.d / 2 - 4.2;
    v.mesh.position.set(x, 0.25, z); v.mesh.rotation.y = 0.5; v.mesh.userData.body.castShadow = shadows; scene.add(v.mesh);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.25, 24), new THREE.MeshLambertMaterial({ color: 0x2a2d33 }));
    plinth.position.set(x, 0.125, z); scene.add(plinth);
    collision.addCircle(x, z, 2.9); city.noTrees = [...(city.noTrees || []), [x, z]];
    city.animated.push((dt) => { v.mesh.rotation.y += dt * 0.25; });
  });

  // ---------- Trees and lamps ----------
  const nearSpur = (x, z, m) => spurs.some((s) => distToSegment(x, z, s) < m);
  const nearBuilding = (x, z, m) => BUILDINGS.some((b) => Math.abs(x - b.x) < b.w / 2 + m && Math.abs(z - b.z) < b.d / 2 + m);
  const clearOf = (x, z) => !(city.noTrees || []).some(([px, pz]) => Math.hypot(px - x, pz - z) < 4.2);
  const treePts = extraTrees.filter(([x, z]) => clearOf(x, z) && !nearBuilding(x, z, 1.2));
  for (const bx of B) for (const bz of B) {
    if (bx === 0 && bz === 0) continue;
    for (let t = -17; t <= 17; t += 6.8) {
      for (const [x, z] of [[bx + t, bz - 18.4], [bx + t, bz + 18.4], [bx - 18.4, bz + t], [bx + 18.4, bz + t]]) {
        if (nearSpur(x, z, 3.6) || nearBuilding(x, z, 0.9) || (city.noTrees || []).some(([px, pz]) => Math.hypot(px - x, pz - z) < 4.2)) continue;
        if (Math.random() > preset.treeDensity) continue;
        treePts.push([x, z]);
      }
    }
  }
  const outerPts = [];
  const R = CITY.bound + 6;
  for (let k = -R; k <= R; k += 7) for (const [x, z] of [[k, -R], [k, R], [-R, k], [R, k]]) outerPts.push([x + Math.random() * 2, z + Math.random() * 2]);
  const scales = addTrees(scene, [...treePts, ...outerPts], shadows);
  treePts.forEach(([x, z], i) => { collision.addCircle(x, z, 0.45); collision.addSphere(x, 2.9 * scales[i], z, 1.25 * scales[i]); });

  const lampPts = [];
  for (const bx of B) for (const bz of B) for (const sx of [-1, 1]) for (const sz of [-1, 1]) lampPts.push([bx + sx * 19, bz + sz * 19]);
  city.lampMat = addLamps(scene, lampPts, shadows);
  for (const [x, z] of lampPts) collision.addCircle(x, z, 0.2);

  // Low hedge marking the city edge
  const hedgeMat = new THREE.MeshLambertMaterial({ color: 0x3e6a33 });
  const he = CITY.bound + 0.6, hl = he * 2 + 2;
  for (const [x, z, w, d] of [[0, -he, hl, 1.6], [0, he, hl, 1.6], [-he, 0, 1.6, hl], [he, 0, 1.6, hl]]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), hedgeMat);
    h.position.set(x, 0.55, z); h.castShadow = shadows; h.receiveShadow = shadows;
    scene.add(h);
  }
  return city;
}

/** Apartment towers: 4 per residential block, all in one instanced draw call. */
function buildResidential(scene, collision, city, { win, shadows }) {
  const pts = [];
  for (const [bx, bz] of DISTRICTS.residential) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const h = 14 + Math.floor(Math.random() * 4) * 5;
    pts.push({ x: bx + sx * 8, z: bz + sz * 8, h });
    collision.addBox(bx + sx * 8, bz + sz * 8, 11, 11, h);
  }
  const geo = scaledBox(11, 1, 11, 4).translate(0, 0.5, 0);
  // Re-tile V so windows stay ~4 m tall whatever the scale.y: store tiles in shader-free way by using 24 m reference.
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) if (i < 8 || i >= 16) uv.setY(i, uv.getY(i) * 6);
  const mat = new THREE.MeshLambertMaterial({ map: win.map, emissiveMap: win.emissive, emissive: 0xffffff, emissiveIntensity: 0 });
  city.nightMats.push(mat);
  const mesh = new THREE.InstancedMesh(geo, mat, pts.length);
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  const tones = [0xb9a48a, 0xa8b3b8, 0xc2b59b, 0x9aa6a0, 0xb7a199, 0xd0c4ae];
  pts.forEach((p, i) => { m4.makeScale(1, p.h, 1).setPosition(p.x, 0, p.z); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, c.setHex(tones[i % tones.length])); });
  mesh.castShadow = mesh.receiveShadow = shadows;
  scene.add(mesh);
  const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(11.6, 0.6, 11.6), new THREE.MeshLambertMaterial({ color: 0x5b5750 }), pts.length);
  pts.forEach((p, i) => { m4.makeTranslation(p.x, p.h + 0.3, p.z); roofs.setMatrixAt(i, m4); });
  scene.add(roofs);
}

/** Business district: 3 glass towers per block, one instanced draw call for all of them. */
function buildBusiness(scene, collision, city, { win, shadows }) {
  const pts = [];
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const [bx, bz] of DISTRICTS.business) {
    const layout = [[-8.5, -8, 13, 13], [8.5, -8, 13, 13], [0, 9, 28, 11]];
    for (const [ox, oz, w, d] of layout) {
      const h = 26 + Math.floor(rnd() * 9) * 7;
      pts.push({ x: bx + ox, z: bz + oz, w, d, h });
      collision.addBox(bx + ox, bz + oz, w, d, h);
    }
  }
  if (!pts.length) return;
  // Merge every tower into one geometry so window UVs follow each tower's real size (1 draw call).
  const tones = [0x4a6a7a, 0x3b4a5c, 0x5a7d8c, 0x2f3b4a, 0x6b7f8f, 0x3e5560];
  const col = new THREE.Color();
  const parts = pts.map((p, i) => {
    const g = scaledBox(p.w, p.h, p.d, 4).toNonIndexed().translate(p.x, p.h / 2, p.z);
    col.setHex(tones[i % tones.length]).convertSRGBToLinear();
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) c.set([col.r, col.g, col.b], k * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  });
  const mat = new THREE.MeshStandardMaterial({ map: win.map, emissiveMap: win.emissive, emissive: 0xcfe8ff, emissiveIntensity: 0, vertexColors: true, roughness: 0.2, metalness: 0.45 });
  city.nightMats.push(mat);
  const mesh = new THREE.Mesh(mergeGeometries(parts), mat);
  parts.forEach((g) => g.dispose());
  mesh.castShadow = mesh.receiveShadow = shadows;
  const crown = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xd4a846, emissive: 0xd4a846, emissiveIntensity: 0.3 }), pts.length);
  const m4 = new THREE.Matrix4();
  pts.forEach((p, i) => { m4.makeScale(p.w * 0.6, 1.2, p.d * 0.6).setPosition(p.x, p.h + 0.6, p.z); crown.setMatrixAt(i, m4); });
  scene.add(mesh, crown);
}

function buildLake(scene, collision, city, { bx, bz, trees }) {
  const water = new THREE.Mesh(new THREE.CircleGeometry(16, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2f7fa8, emissive: 0x0a2a3a, transparent: true, opacity: 0.92 }));
  water.position.set(bx, 0.12, bz); scene.add(water);
  const shore = new THREE.Mesh(new THREE.RingGeometry(16, 18.5, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xcdbb8c }));
  shore.position.set(bx, 0.11, bz); scene.add(shore);
  const boat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 3), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  boat.position.set(bx + 6, 0.3, bz); scene.add(boat);
  city.animated.push((dt, t) => { boat.position.x = bx + Math.cos(t * 0.15) * 8; boat.position.z = bz + Math.sin(t * 0.15) * 8; boat.rotation.y = -t * 0.15; water.position.y = 0.12 + Math.sin(t) * 0.01; });
  collision.addCircle(bx, bz, 16.3);
  for (let a = 0; a < Math.PI * 2; a += 0.5) trees.push([bx + Math.cos(a) * 19.4, bz + Math.sin(a) * 19.4]);
}

function buildStadium(scene, collision, city, { bx, bz, shadows }) {
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(18, 15, 12, 40, 1, true), new THREE.MeshLambertMaterial({ color: 0xd9d4c8, side: THREE.DoubleSide }));
  stand.position.set(bx, 6, bz); stand.scale.z = 0.8; stand.castShadow = shadows; scene.add(stand);
  const pitch = new THREE.Mesh(new THREE.CircleGeometry(14, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3f8a3a }));
  pitch.position.set(bx, 0.12, bz); pitch.scale.z = 0.8; scene.add(pitch);
  const roof = new THREE.Mesh(new THREE.TorusGeometry(17, 0.6, 6, 40), new THREE.MeshLambertMaterial({ color: 0xd4a846, emissive: 0xd4a846, emissiveIntensity: 0.3 }));
  roof.rotation.x = Math.PI / 2; roof.position.set(bx, 12.2, bz); roof.scale.y = 0.8; scene.add(roof);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: signTexture('FINVORA STADIUM', 0xd4a846, 'HOME OF THE FINVORA LEAGUE', (14) / (3.5)), side: THREE.DoubleSide }));
  sign.position.set(bx, 15, bz - 14.8); scene.add(sign);
  collision.addBox(bx, bz, 36, 29, 12);
}

function buildGarden(scene, { grass, shadows, bx, bz, trees, preset }) {
  const gm = new THREE.MeshLambertMaterial({ map: grass });
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(37, 37).rotateX(-Math.PI / 2), gm);
  lawn.position.set(bx, 0.09, bz); lawn.receiveShadow = shadows; scene.add(lawn);
  const path = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.02, 37), new THREE.MeshLambertMaterial({ color: 0xa7a59d }));
  path.position.set(bx, 0.1, bz); scene.add(path);
  for (let x = -16; x <= 16; x += 4.5) for (let z = -16; z <= 16; z += 4.5) {
    if (Math.abs(x) < 4.5) continue;
    if (Math.random() > preset.treeDensity * 0.8) continue;
    trees.push([bx + x + (Math.random() - 0.5), bz + z + (Math.random() - 0.5)]);
  }
}

function buildBazaar(scene, collision, city, { shadows, bx, bz }) {
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.04, 24), new THREE.MeshLambertMaterial({ color: 0xc9a46b }));
  plaza.position.set(bx, 0.1, bz); scene.add(plaza);
  const colors = [0xe5534b, 0xd4a846, 0x2fbf71, 0x5aa9e6, 0xc96bd4, 0xf08a3c];
  const spots = [[-12, -12], [12, -12], [-12, 12], [12, 12], [-14, 0.01], [14, 0.01]].filter(([x, z]) => !(Math.abs(x) > 13 && Math.abs(z) < 1));
  spots.forEach(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(bx + x, 0, bz + z);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 2), new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
    counter.position.y = 0.5; counter.castShadow = shadows;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 4).rotateY(Math.PI / 4), new THREE.MeshLambertMaterial({ color: colors[i % colors.length] }));
    roof.position.y = 3; roof.castShadow = shadows;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    pole.position.y = 1.2;
    g.add(counter, roof, pole); scene.add(g);
    collision.addBox(bx + x, bz + z, 3.2, 2, 3);
  });
}

/**
 * Split instances into ~100 m tiles so the camera only draws tiles it can see (frustum culling works per
 * InstancedMesh). Without this a 460 m city would draw every tree and lamp every frame.
 */
const TILE = 100;
function chunked(geo, material, items, set, { castShadow = false, receiveShadow = false, colors = null } = {}) {
  const tiles = new Map();
  items.forEach((it, i) => { const k = `${Math.floor(it[0] / TILE)},${Math.floor(it[1] / TILE)}`; if (!tiles.has(k)) tiles.set(k, []); tiles.get(k).push(i); });
  const group = new THREE.Group(), m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (const idx of tiles.values()) {
    const mesh = new THREE.InstancedMesh(geo, material, idx.length);
    idx.forEach((i, j) => { set(m4, items[i], i); mesh.setMatrixAt(j, m4); if (colors) mesh.setColorAt(j, col.setHex(colors(i))); });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow;
    group.add(mesh);
  }
  return group;
}

function instanced(geo, material, pts, y) {
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  const g = chunked(geo, material, pts, (m4, [x, z, r]) => { q.setFromAxisAngle(up, r); m4.compose(v.set(x, y, z), q, one); });
  Object.defineProperty(g, 'receiveShadow', { set: (b) => g.children.forEach((c) => (c.receiveShadow = b)) });
  return g;
}

function addTrees(scene, pts, shadows) {
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1.8, 5).translate(0, 0.9, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1.35, 0).translate(0, 2.9, 0);
  const greens = [0x3f7d3a, 0x4c8c3f, 0x2f6b35, 0x5a9446];
  const scales = pts.map(() => 0.8 + Math.random() * 0.5), rots = pts.map(() => Math.random() * Math.PI * 2);
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sv = new THREE.Vector3();
  const set = (m4, [x, z], i) => { q.setFromAxisAngle(up, rots[i]); m4.compose(v.set(x, 0, z), q, sv.setScalar(scales[i])); };
  scene.add(chunked(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x5a3f2a }), pts, set, { castShadow: shadows }));
  scene.add(chunked(crownGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), pts, set, { castShadow: shadows, colors: (i) => greens[i % greens.length] }));
  return scales;
}

function addLamps(scene, pts, shadows) {
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 4.2, 6).translate(0, 2.1, 0);
  const headGeo = new THREE.BoxGeometry(0.5, 0.18, 0.5).translate(0, 4.25, 0);
  const headMat = new THREE.MeshLambertMaterial({ color: 0x333333, emissive: 0xffd58a, emissiveIntensity: 0 });
  const set = (m4, [x, z]) => m4.makeTranslation(x, 0, z);
  scene.add(chunked(poleGeo, new THREE.MeshLambertMaterial({ color: 0x1c1f24 }), pts, set, { castShadow: shadows }));
  scene.add(chunked(headGeo, headMat, pts, set));
  return headMat;
}

/** Box geometry with world-scaled UVs on the side faces so a shared window texture tiles every 4 m. */
function scaledBox(w, h, d, tile = 4) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // Face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(dims[f][0] / tile)), uv.getY(i) * Math.max(1, Math.round(dims[f][1] / tile)));
  }
  return g;
}

function buildBuilding(scene, collision, city, b, { win, shadows, market }) {
  const group = new THREE.Group();
  group.position.set(b.x, 0, b.z);
  scene.add(group);

  const sideMat = new THREE.MeshLambertMaterial({ color: b.color, map: win.map, emissiveMap: win.emissive, emissive: 0xffffff, emissiveIntensity: 0 });
  const roofMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(b.color).multiplyScalar(0.7) });
  const solidMat = new THREE.MeshLambertMaterial({ color: b.color });
  const accentMat = new THREE.MeshLambertMaterial({ color: b.accent, emissive: b.accent, emissiveIntensity: 0.25 });
  city.nightMats.push(sideMat);
  const mats = [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat];
  const add = (mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); mesh.castShadow = shadows; mesh.receiveShadow = shadows; group.add(mesh); return mesh; };
  const box = (w, h, d, m) => new THREE.Mesh(scaledBox(w, h, d), m);

  switch (EXTRA_STYLES[b.style] ? '__extra' : b.style) {
    case '__extra': EXTRA_STYLES[b.style]({ L: styled(group, b), b, city, shadows, win }); break;
    case 'classical': {
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w + 1.6, 0.8, b.d + 1.6), new THREE.MeshLambertMaterial({ color: 0xbfb8a8 })), 0, 0.4, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h - 2, b.d - 4), solidMat), 0, (b.h - 2) / 2 + 0.8, -2);
      const colMat = new THREE.MeshLambertMaterial({ color: 0xf1ece0 });
      const colGeo = new THREE.CylinderGeometry(0.55, 0.62, b.h - 4.4, 10);
      for (let i = 0; i < 8; i++) add(new THREE.Mesh(colGeo, colMat), -b.w / 2 + 2 + i * ((b.w - 4) / 7), 0.8 + (b.h - 4.4) / 2, b.d / 2 - 1.4);
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w, 1.4, 3.6), colMat), 0, b.h - 2.9, b.d / 2 - 1.8);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, b.w, 3, 1).rotateZ(Math.PI / 2).scale(1, 1.8, 1.8), colMat);
      add(ped, 0, b.h - 1.6, b.d / 2 - 2.4);
      // LED ticker band
      const tk = tickerTexture(); city.tickerCanvas = tk.canvas; city.tickerTex = tk.tex;
      const band = new THREE.Mesh(new THREE.PlaneGeometry(b.w - 2, 0.9), new THREE.MeshBasicMaterial({ map: tk.tex }));
      add(band, 0, b.h - 2.9, b.d / 2 + 0.02).castShadow = false;
      tk.tex.repeat.set(1, 1);
      drawTicker(city, market);
      city.animated.push((dt) => { tk.tex.offset.x = (tk.tex.offset.x + dt * 0.035) % 1; });
      break;
    }
    case 'tower': {
      // AccoFinTra Tower: glass lobby podium, two setback shafts, gold crown and spire, logos on all sides.
      const glass = new THREE.MeshStandardMaterial({ color: 0x6f8aa5, map: win.map, emissiveMap: win.emissive, emissive: 0xbfe3ff, emissiveIntensity: 0, roughness: 0.12, metalness: 0.55 });
      const lobby = new THREE.MeshStandardMaterial({ color: 0x8fb4c8, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.3 });
      city.nightMats.push(glass);
      const P = 9, s1w = b.w * 0.78, s1d = b.d * 0.74, s1h = b.h * 0.6, s2w = s1w * 0.8, s2d = s1d * 0.82, s2h = b.h * 0.22;
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w, P, b.d), [lobby, lobby, roofMat, roofMat, lobby, lobby]), 0, P / 2, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w - 1.2, P - 0.4, b.d - 1.2), new THREE.MeshLambertMaterial({ color: 0x2a2f38 })), 0, P / 2, 0); // lobby interior
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.6, 0.7, b.d + 0.6), accentMat), 0, P + 0.35, 0);
      add(box(s1w, s1h, s1d, [glass, glass, roofMat, roofMat, glass, glass]), 0, P + s1h / 2, -b.d * 0.08);
      add(box(s2w, s2h, s2d, [glass, glass, roofMat, roofMat, glass, glass]), 0, P + s1h + s2h / 2, -b.d * 0.08);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.Mesh(new THREE.BoxGeometry(0.6, s1h + s2h, 0.6), accentMat), x * s1w / 2, P + (s1h + s2h) / 2 - (x && z ? 0 : 0), -b.d * 0.08 + z * s1d / 2);
      const crownY = P + s1h + s2h;
      add(new THREE.Mesh(new THREE.CylinderGeometry(s2w * 0.42, s2w * 0.55, 8, 4, 1).rotateY(Math.PI / 4), accentMat), 0, crownY + 4, -b.d * 0.08);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 14, 6), new THREE.MeshLambertMaterial({ color: 0xd9d9d9 })), 0, crownY + 15, -b.d * 0.08);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff4040 })); tip.position.set(0, crownY + 22.2, -b.d * 0.08); group.add(tip);
      city.animated.push((dt, t) => { tip.visible = Math.sin(t * 3) > 0; });
      const podSign = new THREE.Mesh(new THREE.PlaneGeometry(16, 1.9), new THREE.MeshBasicMaterial({ map: signTexture('ACCOFINTRA TOWER', b.accent, 'SERVICE HALL · 16 COUNTERS · OPEN 24 HOURS', (16) / (1.9)) }));
      podSign.position.set(0, P - 1.4, b.d / 2 + 0.08); group.add(podSign);
      addLogos(group, { upperY: P + s1h + s2h * 0.5, half: [s2w / 2 + 0.06, s2d / 2 + 0.06], z0: -b.d * 0.08, size: Math.min(s2w, s2d) * 0.8, frontY: P + s1h * 0.12, frontZ: -b.d * 0.08 + s1d / 2 + 0.06 });
      b.tall = crownY + 22;
      break;
    }
    case 'bse': {
      // Exchange tower inspired by Mumbai's historic exchange building: podium with pilotis, a tall concrete
      // shaft with deep vertical fins, and a wider "hammerhead" crown carrying the name.
      const conc = new THREE.MeshLambertMaterial({ color: 0xd8cfbd, map: win.map, emissiveMap: win.emissive, emissive: 0xffe6b0, emissiveIntensity: 0 });
      city.nightMats.push(conc);
      const plain = new THREE.MeshLambertMaterial({ color: 0xcfc6b3 }), dark = new THREE.MeshLambertMaterial({ color: 0x3a3a3c });
      const sw = b.w - 10, sd = b.d - 8, P = 6, top = 10, sh = b.h - P - top;
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.6, b.d), plain), 0, 0.3, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(sw + 2, P, sd + 2), dark), 0, P / 2, -1);           // recessed ground floor
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w - 2, 1.2, b.d - 2), plain), 0, P + 0.6, 0);        // podium deck
      for (let i = 0; i < 6; i++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, P, 10), plain), -b.w / 2 + 2 + i * ((b.w - 4) / 5), P / 2, b.d / 2 - 2);
      add(box(sw, sh, sd, [conc, conc, roofMat, roofMat, conc, conc]), 0, P + 1.2 + sh / 2, -1);
      const fins = [];
      for (let i = 0; i <= 6; i++) { const x = -sw / 2 + i * (sw / 6); fins.push(new THREE.BoxGeometry(0.7, sh, 1.1).translate(x, P + 1.2 + sh / 2, -1 + sd / 2 + 0.5), new THREE.BoxGeometry(0.7, sh, 1.1).translate(x, P + 1.2 + sh / 2, -1 - sd / 2 - 0.5)); }
      for (let i = 0; i <= 5; i++) { const z = -1 - sd / 2 + i * (sd / 5); fins.push(new THREE.BoxGeometry(1.1, sh, 0.7).translate(sw / 2 + 0.5, P + 1.2 + sh / 2, z), new THREE.BoxGeometry(1.1, sh, 0.7).translate(-sw / 2 - 0.5, P + 1.2 + sh / 2, z)); }
      const finMesh = new THREE.Mesh(mergeGeometries(fins), plain); fins.forEach((g) => g.dispose()); add(finMesh);
      const crownY = P + 1.2 + sh;
      add(new THREE.Mesh(new THREE.BoxGeometry(sw + 4, top, sd + 4), new THREE.MeshLambertMaterial({ color: 0xbfb5a2 })), 0, crownY + top / 2, -1);
      add(new THREE.Mesh(new THREE.BoxGeometry(sw + 4.2, 1.2, sd + 4.2), dark), 0, crownY + 1.4, -1);
      const nameSign = new THREE.Mesh(new THREE.PlaneGeometry(sw + 2, 4.2), new THREE.MeshBasicMaterial({ map: signTexture('STOCK EXCHANGE', b.accent, 'FINVORA · EST. 2026', (sw + 2) / (4.2)) }));
      nameSign.position.set(0, crownY + 6, -1 + sd / 2 + 2.05); group.add(nameSign);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 16, 6), new THREE.MeshLambertMaterial({ color: 0xbbbbbb })), 0, b.h + 8, -1);
      // LED ticker band on the podium
      const tk = tickerTexture(); city.tickerCanvas = tk.canvas; city.tickerTex = tk.tex;
      const band = new THREE.Mesh(new THREE.PlaneGeometry(b.w - 3, 1.1), new THREE.MeshBasicMaterial({ map: tk.tex }));
      band.position.set(0, P + 0.6, b.d / 2 - 0.98); group.add(band);
      drawTicker(city, market);
      city.animated.push((dt) => { tk.tex.offset.x = (tk.tex.offset.x + dt * 0.035) % 1; });
      addBull(scene, collision, b.x + 8, b.z + b.d / 2 + 5.5, shadows);
      break;
    }
    case 'bank': {
      // Classical bank: steps, a colonnade under a pediment, and a dome over the banking hall.
      const L = styled(group, b), fw = L.fw, fd = L.fd;
      const stone = new THREE.MeshLambertMaterial({ color: 0xece5d6 }), step = new THREE.MeshLambertMaterial({ color: 0xc9c1b0 });
      for (let i = 0; i < 3; i++) L.add(new THREE.Mesh(new THREE.BoxGeometry(fw + 2 - i * 0.8, 0.3, fd + 2 - i * 0.8), step), 0, 0.15 + i * 0.3, 0);
      L.add(box(fw - 2, b.h - 1, fd - 6, [solidMat, solidMat, roofMat, roofMat, solidMat, solidMat]), 0, 0.9 + (b.h - 1) / 2, -3);
      const colGeo = new THREE.CylinderGeometry(0.5, 0.58, b.h - 3.4, 14);
      for (let i = 0; i < 8; i++) { const x = -fw / 2 + 1.6 + i * ((fw - 3.2) / 7); L.add(new THREE.Mesh(colGeo, stone), x, 0.9 + (b.h - 3.4) / 2, fd / 2 - 1.3); L.add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 1.3), stone), x, b.h - 2.35, fd / 2 - 1.3); }
      L.add(new THREE.Mesh(new THREE.BoxGeometry(fw, 1.6, 3.6), stone), 0, b.h - 1.4, fd / 2 - 1.7);
      const tri = new THREE.Shape(); tri.moveTo(-fw / 2, 0); tri.lineTo(fw / 2, 0); tri.lineTo(0, 3.6); tri.lineTo(-fw / 2, 0);
      L.add(new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 3.6, bevelEnabled: false }), stone), 0, b.h - 0.6, fd / 2 - 3.5);
      L.add(new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 2.4, 24), stone), 0, b.h + 1.2, -3);
      L.add(new THREE.Mesh(new THREE.SphereGeometry(5.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x5f8f7a })), 0, b.h + 2.4, -3);
      L.add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 2, 10), accentMat), 0, b.h + 8.4, -3);
      const nm = new THREE.Mesh(new THREE.PlaneGeometry(fw * 0.7, 1.2), new THREE.MeshBasicMaterial({ map: signTexture('FINVORA BANK', b.accent, 'SINCE 2026 · DEPOSITS · LOANS · CARDS', (fw * 0.7) / (1.2)) }));
      L.add(nm, 0, b.h - 1.4, fd / 2 + 0.12);
      break;
    }
    case 'showroom': {
      // Low, fully glazed car showroom with a thin roof slab: the cars inside are visible from the street.
      const L = styled(group, b), fw = L.fw, fd = L.fd;
      const glassW = new THREE.MeshLambertMaterial({ color: 0xa8c8dc, transparent: true, opacity: 0.32, depthWrite: false });
      L.add(new THREE.Mesh(new THREE.BoxGeometry(fw, 0.3, fd), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 })), 0, 0.15, 0);
      L.add(new THREE.Mesh(new THREE.BoxGeometry(fw, b.h, 0.4), solidMat), 0, b.h / 2, -fd / 2 + 0.2);
      for (const [w, d, x, z] of [[fw, 0.1, 0, fd / 2], [0.1, fd, -fw / 2, 0], [0.1, fd, fw / 2, 0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, b.h, d), glassW); m.position.set(x, b.h / 2, z); m.renderOrder = 2; L.group.add(m); }
      for (let i = -3; i <= 3; i++) L.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, b.h, 0.15), new THREE.MeshLambertMaterial({ color: 0x222831 })), i * fw / 6.5, b.h / 2, fd / 2);
      L.add(new THREE.Mesh(new THREE.BoxGeometry(fw + 3, 0.6, fd + 3), new THREE.MeshLambertMaterial({ color: 0x1b1f26 })), 0, b.h + 0.3, 0.6);
      L.add(new THREE.Mesh(new THREE.BoxGeometry(fw + 3.05, 0.25, fd + 3.05), accentMat), 0, b.h - 0.02, 0.6);
      [['sedan', 0xc0392b, -7], ['gt', 0x111111, 0], ['suv', 0xecf0f1, 7]].forEach(([m, c, x]) => { const v = vehicleMesh(m === 'gt' ? 'sports' : m, c); v.mesh.position.set(x, 0.3, -1); v.mesh.rotation.y = 0.6; L.group.add(v.mesh); });
      const nm = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), new THREE.MeshBasicMaterial({ map: signTexture('FINVORA MOTORS', b.accent, 'NEW · EV · SCOOTERS', (14) / (1.6)) }));
      L.add(nm, 0, b.h + 0.3, fd / 2 + 2.12);
      break;
    }
    case 'boutique': {
      // Two-storey fashion boutique: shop windows with mannequins under striped awnings, a balcony above.
      const L = styled(group, b), fw = L.fw, fd = L.fd;
      L.add(box(fw, b.h, fd, [solidMat, solidMat, roofMat, roofMat, solidMat, solidMat]), 0, b.h / 2, 0);
      const shop = new THREE.MeshLambertMaterial({ color: 0x20262e, emissive: 0xffe2c4, emissiveIntensity: 0.12 });
      for (const x of [-fw / 3, fw / 3]) L.add(new THREE.Mesh(new THREE.BoxGeometry(fw / 3.4, 3.4, 0.12), shop), x, 2.1, fd / 2 + 0.05);
      const stripes = awningTexture(b.accent);
      for (const x of [-fw / 3, fw / 3]) { const aw = new THREE.Mesh(new THREE.BoxGeometry(fw / 3.2, 0.12, 1.6), new THREE.MeshLambertMaterial({ map: stripes })); aw.rotation.x = 0.25; L.add(aw, x, 4.1, fd / 2 + 0.8); }
      const pink = new THREE.MeshLambertMaterial({ color: b.accent });
      L.add(new THREE.Mesh(new THREE.BoxGeometry(fw * 0.9, 0.15, 1.3), solidMat), 0, 5.6, fd / 2 + 0.65);
      for (let i = 0; i < 14; i++) L.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), pink), -fw * 0.44 + i * (fw * 0.88 / 13), 6.1, fd / 2 + 1.25);
      L.add(new THREE.Mesh(new THREE.BoxGeometry(fw * 0.9, 0.08, 0.08), pink), 0, 6.55, fd / 2 + 1.25);
      for (let i = 0; i < 4; i++) L.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.1), new THREE.MeshLambertMaterial({ color: 0x3b4653, emissive: 0xfff0d0, emissiveIntensity: 0.15 })), -fw * 0.36 + i * fw * 0.24, 7.8, fd / 2 + 0.05);
      const mannequins = [[0xc0577a, 'saree'], [0x2a3340, 'suit'], [0xf08a3c, 'kurta'], [0x5aa9e6, 'shirt']];
      mannequins.forEach(([c, top], i) => { const ch = createCharacter({ skin: 0xe8e0d8, shirt: c, pants: top === 'saree' ? c : 0x222222, hair: 0xe8e0d8, hairStyle: 'short', top, outer: c, accessory: 'none' }, { blobShadow: false }); ch.root.position.set((i < 2 ? -fw / 3 : fw / 3) + (i % 2 ? 1.2 : -1.2), 0.35, fd / 2 - 0.6); ch.root.scale.setScalar(0.92); L.group.add(ch.root); });
      L.add(new THREE.Mesh(new THREE.BoxGeometry(fw + 0.4, 0.5, fd + 0.4), pink), 0, b.h + 0.25, 0);
      const nm = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.5), new THREE.MeshBasicMaterial({ map: signTexture('STYLE STUDIO', b.accent, 'FASHION · ACCESSORIES', (9) / (1.5)) }));
      L.add(nm, 0, 9.6, fd / 2 + 0.06);
      break;
    }
    case 'mart': {
      // Big-box supermarket: red fascia, glass entrance, trolleys and a parking bay in front.
      const L = styled(group, b), fw = L.fw, fd = L.fd;
      L.add(box(fw, b.h, fd, [solidMat, solidMat, roofMat, roofMat, solidMat, solidMat]), 0, b.h / 2, 0);
      L.add(new THREE.Mesh(new THREE.BoxGeometry(fw + 0.3, 2.2, 0.4), accentMat), 0, b.h - 1.1, fd / 2 + 0.2);
      L.add(new THREE.Mesh(new THREE.BoxGeometry(10, 3.6, 0.12), new THREE.MeshLambertMaterial({ color: 0x9fc2d4, transparent: true, opacity: 0.6 })), 0, 1.8, fd / 2 + 0.07);
      L.add(new THREE.Mesh(new THREE.BoxGeometry(12, 0.25, 3), new THREE.MeshLambertMaterial({ color: 0x2b2f38 })), 0, 4, fd / 2 + 1.5);
      const nm = new THREE.Mesh(new THREE.PlaneGeometry(fw * 0.6, 1.8), new THREE.MeshBasicMaterial({ map: signTexture('SUPERMART', b.accent, 'FRESH · DAILY NEEDS · BILLS', (fw * 0.6) / (1.8)) }));
      L.add(nm, 0, b.h - 1.1, fd / 2 + 0.42);
      const lineM = new THREE.MeshBasicMaterial({ color: 0xf2f2ee });
      for (let i = -5; i <= 5; i++) { const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 4.5).rotateX(-Math.PI / 2), lineM); L.add(ln, i * 2.8, 0.13, fd / 2 + 6.5); }
      const cart = new THREE.MeshLambertMaterial({ color: 0xb8bcc2 });
      for (let i = 0; i < 4; i++) L.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.9), cart), fw / 2 - 3 - i * 0.25, 0.6, fd / 2 + 2.2 + i * 0.3);
      break;
    }
    case 'house': {
      // Your home: two-storey bungalow with a tiled roof, porch, garden and an attached garage.
      const L = styled(group, b), fw = L.fw, fd = L.fd;
      const wall = new THREE.MeshLambertMaterial({ color: b.color }), tile = new THREE.MeshLambertMaterial({ color: b.accent }), trim = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const mainW = 11, mainX = -2.5, garW = 5, garX = fw / 2 - garW / 2;
      L.add(new THREE.Mesh(new THREE.BoxGeometry(mainW, 6.2, fd), wall), mainX, 3.1, 0);
      L.add(new THREE.Mesh(new THREE.BoxGeometry(mainW + 0.3, 0.25, fd + 0.3), trim), mainX, 3.1, 0);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, mainW + 1, 3, 1).rotateZ(Math.PI / 2).scale(1, 2.2, fd * 0.62), tile); L.add(roof, mainX, 7.3, 0);
      L.add(new THREE.Mesh(new THREE.BoxGeometry(garW, 3.2, fd - 1), wall), garX, 1.6, -0.5);
      L.add(new THREE.Mesh(new THREE.BoxGeometry(garW + 0.4, 0.3, fd - 0.6), tile), garX, 3.35, -0.5);
      const shutter = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.6), new THREE.MeshLambertMaterial({ map: shutterTexture() })); L.add(shutter, garX, 1.35, fd / 2 - 0.98);
      const winM = new THREE.MeshLambertMaterial({ color: 0x2e3e4c, emissive: 0xffd58a, emissiveIntensity: 0 }); city.nightMats.push(winM);
      for (const [x, y] of [[mainX - 3.2, 1.7], [mainX + 3.2, 1.7], [mainX - 3.2, 4.7], [mainX + 0, 4.7], [mainX + 3.2, 4.7]]) { L.add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.3), winM), x, y, fd / 2 + 0.02); L.add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.2), trim), x, y - 0.7, fd / 2 + 0.08); }
      L.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.3, 0.1), new THREE.MeshLambertMaterial({ color: 0x6b3f22 })), 0.4, 1.15, fd / 2 + 0.05);
      L.add(new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 1.8), trim), 0.4, 2.7, fd / 2 + 0.9);
      for (const x of [-0.9, 1.7]) L.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 8), trim), x, 1.35, fd / 2 + 1.6);
      L.add(new THREE.Mesh(new THREE.PlaneGeometry(garW, 12).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8d8a83 })), garX, 0.13, fd / 2 + 6);
      const hedge = new THREE.MeshLambertMaterial({ color: 0x3e6a33 });
      L.add(new THREE.Mesh(new THREE.BoxGeometry(11, 0.9, 0.6), hedge), -7.5 + 2, 0.45, fd / 2 + 8);
      const nm = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: signTexture('HOME', b.accent, 'YOUR HOUSE', (2.4) / (0.6)) }));
      L.add(nm, 0.4, 3.1, fd / 2 + 0.2);
      city.homeGarage = L.toWorld(garX, fd / 2 + 4);
      break;
    }
    case 'glass': {
      const glass = new THREE.MeshStandardMaterial({ color: b.color, map: win.map, emissiveMap: win.emissive, emissive: 0xbfe3ff, emissiveIntensity: 0, roughness: 0.15, metalness: 0.5 });
      city.nightMats.push(glass);
      add(box(b.w, b.h, b.d, [glass, glass, roofMat, roofMat, glass, glass]), 0, b.h / 2, 0);
      const finGeo = new THREE.BoxGeometry(0.3, b.h, 0.5);
      for (let i = -2; i <= 2; i++) {
        if (b.door === '+z' || b.door === '-z') add(new THREE.Mesh(finGeo, accentMat), i * (b.w / 5), b.h / 2, (b.door === '+z' ? 1 : -1) * (b.d / 2 + 0.2));
        else add(new THREE.Mesh(finGeo, accentMat).rotateY(Math.PI / 2), (b.door === '+x' ? 1 : -1) * (b.w / 2 + 0.2), b.h / 2, i * (b.d / 5));
      }
      break;
    }
    case 'campus': {
      add(box(b.w, b.h, b.d, mats), 0, b.h / 2, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.6, 0.6, b.d + 0.6), new THREE.MeshLambertMaterial({ color: 0x8e7d5c })), 0, b.h + 0.3, 0);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(b.w, b.d) * 0.26, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), accentMat);
      add(dome, 0, b.h + 0.6, 0);
      break;
    }
    case 'stepped': {
      const t1 = b.h * 0.45, t2 = b.h * 0.33, t3 = b.h * 0.22;
      add(box(b.w, t1, b.d, mats), 0, t1 / 2, 0);
      add(box(b.w * 0.78, t2, b.d * 0.78, mats), 0, t1 + t2 / 2, 0);
      add(box(b.w * 0.52, t3, b.d * 0.52, mats), 0, t1 + t2 + t3 / 2, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.54, 0.5, b.d * 0.54), accentMat), 0, b.h + 0.25, 0);
      break;
    }
    case 'pump': {
      // kiosk + canopy over the forecourt (towards the road) + dispensers
      add(box(b.w, b.h, b.d, mats), 0, b.h / 2, 0);
      const dir0 = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[b.door];
      const cx = dir0[0] * 10, cz = dir0[1] * 10, along = dir0[0] ? [14, 11] : [11, 14];
      const steel = new THREE.MeshLambertMaterial({ color: 0xd9dde2 });
      add(new THREE.Mesh(new THREE.BoxGeometry(along[0] + 2, 0.9, along[1] + 2), new THREE.MeshLambertMaterial({ color: 0xf4f4f2 })), cx, 5.6, cz);
      add(new THREE.Mesh(new THREE.BoxGeometry(along[0] + 2.05, 0.35, along[1] + 2.05), accentMat), cx, 5.25, cz);
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.2, 0.4), steel), cx + px * along[0] * 0.4, 2.6, cz + pz * along[1] * 0.4);
      const dispMat = new THREE.MeshLambertMaterial({ color: 0x2b2f38 }), evMat = new THREE.MeshLambertMaterial({ color: 0x2fbf71, emissive: 0x2fbf71, emissiveIntensity: 0.3 });
      [-3, 3].forEach((o, i) => {
        const dx = cx + (dir0[0] ? 0 : o), dz = cz + (dir0[0] ? o : 0);
        add(new THREE.Mesh(new THREE.BoxGeometry(1, 1.8, 0.8), i ? evMat : dispMat), dx, 0.9, dz);
        add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 1.2), new THREE.MeshLambertMaterial({ color: 0x9aa0a6 })), dx, 0.12, dz);
        collision.addCircle(b.x + dx, b.z + dz, 0.8);
      });
      const top = new THREE.Mesh(new THREE.PlaneGeometry(along[0] * 0.8, 0.8), new THREE.MeshBasicMaterial({ map: signTexture('FUEL · CNG · EV', b.accent, 'FINVORA FUELS', (along[0] * 0.8) / (0.8)), side: THREE.DoubleSide }));
      const edge = (dir0[0] ? along[0] : along[1]) / 2 + 1.07; top.position.set(cx + dir0[0] * edge, 5.6, cz + dir0[1] * edge); top.rotation.y = Math.atan2(dir0[0], dir0[1]); group.add(top);
      city.fuelStation = { x: b.x + cx, z: b.z + cz };
      break;
    }
    default: {
      add(box(b.w, b.h, b.d, mats), 0, b.h / 2, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 0.7, b.d + 0.4), roofMat), 0, b.h + 0.35, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 2.4), new THREE.MeshLambertMaterial({ color: 0x777b80 })), b.w * 0.2, b.h + 1.2, -b.d * 0.15);
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.1, 0.5, b.d + 0.1), accentMat), 0, 4.4, 0);
    }
  }

  // ---------- Entrance: door, canopy, sign, glowing floor marker ----------
  const dir = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[b.door];
  const faceHalf = dir[0] ? b.w / 2 : b.d / 2;
  const rotY = Math.atan2(dir[0], dir[1]);
  const doorGroup = new THREE.Group();
  const inset = b.style === 'classical' || b.style === 'bank' ? -3.95 : b.style === 'bse' ? -3.95 : 0.05; // doors behind a colonnade sit back
  doorGroup.position.set(dir[0] * (faceHalf + inset), 0, dir[1] * (faceHalf + inset));
  doorGroup.rotation.y = rotY;
  group.add(doorGroup);
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x0f1a22, emissive: 0x3a6f8f, emissiveIntensity: 0.25 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 0.2), doorMat); door.position.y = 1.6 + (b.style === 'classical' || b.style === 'bank' ? 0.8 : 0); doorGroup.add(door);
  if (b.style === 'house' || b.style === 'tower') door.visible = false;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.35, 0.3), accentMat); frame.position.y = door.position.y + 1.75; doorGroup.add(frame);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(b.style === 'tower' ? 9 : 5, 0.18, b.style === 'tower' ? 4 : 2.2), new THREE.MeshLambertMaterial({ color: b.style === 'tower' ? 0xd4a846 : 0x1c1f24 }));
  canopy.position.set(0, door.position.y + 2.05, b.style === 'tower' ? 2 : 1.05); canopy.castShadow = shadows; doorGroup.add(canopy);
  if (b.style === 'house') { canopy.visible = false; frame.visible = false; }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), new THREE.MeshBasicMaterial({ map: signTexture(b.short, b.accent, 'OPEN · FINVORA', (7) / (1.75)) }));
  sign.position.set(0, Math.min(b.h - 1.5, door.position.y + 3.6), b.style === 'glass' ? 0.75 : 0.25); // in front of glass fins
  if (b.style === 'classical' || b.style === 'bank') sign.position.set(0, 4.6, 4.2);
  if (b.style === 'bse') sign.position.set(0, 4.8, 4.3);
  if (b.style === 'tower') sign.position.set(0, 4.6, 0.3);
  if (['house', 'tower', 'bank', 'bse', 'boutique', 'mart', 'showroom', ...EXTRA_STYLE_NAMES].includes(b.style)) sign.visible = false; // these carry their own name signs
  doorGroup.add(sign);

  const dp = doorPoint(b);
  const markerColor = 0xd4a846;
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: markerColor, transparent: true, opacity: 0.75, depthWrite: false }));
  marker.position.set(dp.x, 0.12, dp.z);
  scene.add(marker);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2.4, 20, 1, true), new THREE.MeshBasicMaterial({ color: markerColor, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.set(dp.x, 1.3, dp.z);
  scene.add(beam);
  city.animated.push((dt, t) => { const s = 1 + Math.sin(t * 3) * 0.07; marker.scale.set(s, 1, s); beam.material.opacity = 0.08 + (Math.sin(t * 3) + 1) * 0.04; });

  const pad = b.style === 'classical' || b.style === 'bank' ? 1.6 : 0;
  if (b.style === 'house') { collision.addBox(b.x, b.z, b.w, b.d, b.h); }
  else collision.addBox(b.x, b.z, b.w + pad, b.d + pad, b.tall || b.h);
  city.doors.push({ type: 'building', building: b, x: dp.x, z: dp.z, face: dp.face, marker });
}

// The AccoFinTra logo on all four sides of the tower's upper shaft, and above the entrance.
let logoTex = null;
function addLogos(group, o) {
  logoTex ||= new THREE.TextureLoader().load(logoUrl, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; });
  logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: logoTex, toneMapped: false });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(o.size, o.size), mat);
    const a = i * Math.PI / 2, hx = o.half[0], hz = o.half[1];
    m.position.set(Math.sin(a) * hx, o.upperY, o.z0 + Math.cos(a) * hz); m.rotation.y = a; group.add(m);
  }
  const low = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), mat);
  low.position.set(0, o.frontY, o.frontZ); group.add(low);
}

/** A local frame for a building whose entrance is on side `b.door`: build as if the door faced +z. */
function styled(group, b) {
  const dir = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }[b.door];
  const g = new THREE.Group(); g.rotation.y = Math.atan2(dir[0], dir[1]); group.add(g);
  const fw = dir[0] ? b.d : b.w, fd = dir[0] ? b.w : b.d;
  return {
    group: g, fw, fd,
    add(mesh, x = 0, y = 0, z = 0) { mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh; },
    toWorld(x, z) { const c = Math.cos(g.rotation.y), s = Math.sin(g.rotation.y); return { x: b.x + x * c + z * s, z: b.z - x * s + z * c, yaw: g.rotation.y }; },
  };
}

function awningTexture(accent) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 8; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#' + new THREE.Color(accent).getHexString(); g.fillRect(i * 8, 0, 8, 8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function shutterTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#c9ccd1'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#9aa0a8';
  for (let y = 0; y < 64; y += 5) g.fillRect(0, y, 64, 1.5);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** A bronze bull on a granite plinth outside the exchange (a classic market symbol). */
function addBull(scene, collision, x, z, shadows) {
  const bronze = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, metalness: 0.75, roughness: 0.35 });
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -0.5;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1, 4.4), new THREE.MeshLambertMaterial({ color: 0x3a3a3c })); plinth.position.y = 0.5; g.add(plinth);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 1.7, 6, 12).rotateX(Math.PI / 2), bronze); body.position.set(0, 2.1, 0); body.scale.set(1, 1.05, 1); g.add(body);
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), bronze); hump.position.set(0, 2.55, 0.65); g.add(hump);
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.5, 4, 10).rotateX(1.1), bronze); head.position.set(0, 2.05, 1.85); g.add(head);
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.75, 8), bronze); horn.position.set(s * 0.42, 2.55, 1.85); horn.rotation.z = -s * 1.0; horn.rotation.x = 0.5; g.add(horn);
    for (const zz of [0.85, -0.85]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 1.2, 8), bronze); leg.position.set(s * 0.42, 1.55, zz); leg.rotation.x = zz > 0 ? -0.25 : 0.2; g.add(leg); }
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 1.1, 6), bronze); tail.position.set(0, 2.5, -1.6); tail.rotation.x = -0.9; g.add(tail);
  g.traverse((m) => { m.castShadow = shadows; });
  scene.add(g);
  collision.addCircle(x, z, 2.3);
}

/** Centre block: AccoFinTra Plaza. A granite forecourt, walkway to the tower, lawns, pools, flags and benches. */
function buildTowerPlaza(scene, collision, city, { grass, shadows }) {
  const granite = new THREE.MeshLambertMaterial({ color: 0xb9b4aa });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), granite); pl.position.y = 0.09; pl.receiveShadow = shadows; scene.add(pl);
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(6, 18).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8e887e })); walk.position.set(0, 0.1, 11); scene.add(walk);
  const gm = new THREE.MeshLambertMaterial({ map: grass }); grass.repeat.set(3, 3);
  for (const x of [-12.5, 12.5]) {
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(13, 6).rotateX(-Math.PI / 2), gm); lawn.position.set(x, 0.11, 16); lawn.receiveShadow = shadows; scene.add(lawn);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(9, 0.35, 3.2), new THREE.MeshLambertMaterial({ color: 0x3f8fb8, emissive: 0x0b2a3a })); pool.position.set(x, 0.18, 9.5); scene.add(pool);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.4, 3.8), granite); rim.position.set(x, 0.12, 9.5); scene.add(rim);
    collision.addBox(x, 9.5, 9.6, 3.8, 0.5);
    city.animated.push((dt, t) => { pool.position.y = 0.18 + Math.sin(t * 2 + x) * 0.01; });
  }
  // Flagpoles beside the entrance
  const poleM = new THREE.MeshLambertMaterial({ color: 0xdedede });
  [[-7.5, 0xd4a846], [7.5, 0x2fbf71], [-9.5, 0x5aa9e6], [9.5, 0xe5534b]].forEach(([x, c]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 9, 8), poleM); p.position.set(x, 4.5, 5.5); p.castShadow = shadows; scene.add(p);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1, 6, 1), new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide })); f.position.set(x + 0.95, 8.3, 5.5); scene.add(f);
    city.animated.push((dt, t) => { const a = f.geometry.attributes.position; for (let i = 0; i < a.count; i++) { const u = a.getX(i) + 0.9; a.setZ(i, Math.sin(t * 4 + u * 3 + x) * 0.12 * u); } a.needsUpdate = true; });
    collision.addCircle(x, 5.5, 0.2);
  });
  // Benches facing the lawns
  const wood = new THREE.MeshLambertMaterial({ color: 0x8a6440 });
  for (const x of [-15, -9.5, 9.5, 15]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), wood); seat.position.set(x, 0.48, 19.2); scene.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.1), wood); back.position.set(x, 0.78, 19.5); scene.add(back);
    collision.addBox(x, 19.3, 2.2, 0.7, 0.9);
  }
  city.spawnPlaza = { x: 0, z: 17 };
}

/** Bus shelters with a bench, a timetable sign and a glass back panel. */
function buildBusStops(scene, collision, city, { shadows }) {
  city.busStops = [];
  const roofM = new THREE.MeshLambertMaterial({ color: 0xc0392b }), glassM = new THREE.MeshLambertMaterial({ color: 0x9fc2d4, transparent: true, opacity: 0.45 }), steel = new THREE.MeshLambertMaterial({ color: 0x2b2f38 });
  for (const st of BUS_STOPS) {
    // shelter faces the road
    const toRoad = st.road === 'z' ? [0, Math.sign(st.at - st.z)] : [Math.sign(st.at - st.x), 0];
    const g = new THREE.Group(); g.position.set(st.x, 0, st.z); g.rotation.y = Math.atan2(toRoad[0], toRoad[1]); scene.add(g);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.15, 1.9), roofM); roof.position.set(0, 2.7, 0); roof.castShadow = shadows; g.add(roof);
    const back = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.2, 0.08), glassM); back.position.set(0, 1.4, -0.85); g.add(back);
    for (const x of [-2.15, 2.15]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.7, 0.1), steel); p.position.set(x, 1.35, -0.85); g.add(p); }
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.45), steel); bench.position.set(0, 0.5, -0.5); g.add(bench);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.42), new THREE.MeshBasicMaterial({ map: signTexture('BUS STOP', 0xc0392b, st.name.toUpperCase(), (1.6) / (0.42)), side: THREE.DoubleSide })); sign.position.set(0, 2.98, 0.9); g.add(sign);
    const bx = st.x + toRoad[0] * 1.6, bz = st.z + toRoad[1] * 1.6;
    collision.addBox(st.x - toRoad[0] * 0.85, st.z - toRoad[1] * 0.85, toRoad[0] ? 0.2 : 4.4, toRoad[0] ? 4.4 : 0.2, 2.2);
    city.busStops.push({ ...st, waitX: bx, waitZ: bz, roadX: st.road === 'x' ? st.at - toRoad[0] * 1.75 : st.x, roadZ: st.road === 'z' ? st.at - toRoad[1] * 1.75 : st.z });
    city.doors.push({ type: 'bus', stop: st, x: bx, z: bz, face: Math.atan2(toRoad[0], toRoad[1]) });
    city.noTrees = [...(city.noTrees || []), [st.x, st.z]];
  }
}

export function drawTicker(city, market) {
  if (!city.tickerCanvas) return;
  const c = city.tickerCanvas, g = c.getContext('2d');
  g.fillStyle = '#050607'; g.fillRect(0, 0, c.width, c.height);
  g.font = '700 30px ui-monospace, Menlo, Consolas, monospace'; g.textBaseline = 'middle';
  let x = 12;
  g.fillStyle = '#d4a846'; g.fillText('FICTIONAL SIMULATION ·', x, 32); x += g.measureText('FICTIONAL SIMULATION · ').width;
  for (const s of market.stocks) {
    const ch = (s.price / s.prev - 1) * 100, up = ch >= 0;
    g.fillStyle = '#ecebe6'; const a = `${s.symbol} ${s.price.toFixed(2)} `; g.fillText(a, x, 32); x += g.measureText(a).width;
    g.fillStyle = up ? '#2fbf71' : '#e5534b'; const t = `${up ? '▲' : '▼'}${Math.abs(ch).toFixed(2)}%   `; g.fillText(t, x, 32); x += g.measureText(t).width;
    if (x > c.width - 40) break;
  }
  city.tickerTex.needsUpdate = true;
}
