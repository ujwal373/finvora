import * as THREE from 'three';
import { CITY } from '../config.js';
import { BUILDINGS, DISTRICTS, doorPoint } from '../data/buildings.js';
import logoUrl from '../assets/accofintra-logo.jpg';
import { windowTextures, signTexture, tickerTexture, groundTexture, paverTexture, grassTexture } from '../utils/textures.js';
import { distToSegment } from './Places.js';
import { vehicleMesh } from './Traffic.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
  buildPark(scene, collision, city, { grass, shadows });
  const extraTrees = [];
  buildResidential(scene, collision, city, { win, shadows });
  for (const [bx, bz] of DISTRICTS.parks) buildGarden(scene, { grass, shadows, bx, bz, trees: extraTrees, preset });
  for (const [bx, bz] of DISTRICTS.bazaar) buildBazaar(scene, collision, city, { shadows, bx, bz });
  buildBusiness(scene, collision, city, { win, shadows });
  for (const [bx, bz] of DISTRICTS.lake) buildLake(scene, collision, city, { bx, bz, trees: extraTrees });
  for (const [bx, bz] of DISTRICTS.stadium) buildStadium(scene, collision, city, { bx, bz, shadows });

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
  const treePts = [...extraTrees];
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
  for (let x = -17; x <= 17; x += 4.2) for (let z = -17; z <= 17; z += 4.2) {
    const jx = x + (Math.random() - 0.5) * 1.6, jz = z + (Math.random() - 0.5) * 1.6;
    if (Math.abs(jx) < 4.6 || Math.abs(jz) < 4.6 || Math.hypot(jx, jz) < 9.5) continue;
    if (Math.random() > preset.treeDensity) continue;
    treePts.push([jx, jz]);
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
  const mat = new THREE.MeshLambertMaterial({ map: win.map, emissiveMap: win.emissive, emissive: 0xcfe8ff, emissiveIntensity: 0, vertexColors: true });
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
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: signTexture('FINVORA STADIUM', 0xd4a846, 'HOME OF THE FINVORA LEAGUE'), side: THREE.DoubleSide }));
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

function buildPark(scene, collision, city, { grass, shadows }) {
  const pavMat = new THREE.MeshLambertMaterial({ color: 0xa7a59d });
  const gm = new THREE.MeshLambertMaterial({ map: grass }); grass.repeat.set(9, 9);
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(37, 37).rotateX(-Math.PI / 2), gm);
  lawn.position.y = 0.09; lawn.receiveShadow = shadows;
  scene.add(lawn);
  const pathMat = pavMat;
  for (const [w, d] of [[3.6, 37], [37, 3.6]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), pathMat);
    p.position.y = 0.1; p.receiveShadow = shadows; scene.add(p);
  }
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.2, 0.03, 32), pathMat);
  plaza.position.y = 0.105; plaza.receiveShadow = shadows; scene.add(plaza);

  // Fountain with a slowly spinning gold coin
  const stone = new THREE.MeshLambertMaterial({ color: 0xbdb8ad });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.2, 0.7, 24), stone);
  basin.position.y = 0.35; basin.castShadow = shadows; basin.receiveShadow = shadows; scene.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.1, 24), new THREE.MeshLambertMaterial({ color: 0x3f8fb8, emissive: 0x0b2a3a }));
  water.position.y = 0.62; scene.add(water);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.6, 10), stone);
  pillar.position.y = 1.3; pillar.castShadow = shadows; scene.add(pillar);
  const coinMat = new THREE.MeshLambertMaterial({ color: 0xd4a846, emissive: 0x3a2a08 });
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.22, 28).rotateX(Math.PI / 2), coinMat);
  coin.position.y = 3.3; coin.castShadow = shadows; scene.add(coin);
  const rupee = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: rupeeTexture(), transparent: true }));
  rupee.position.z = 0.12; coin.add(rupee);
  const rupeeBack = rupee.clone(); rupeeBack.rotation.y = Math.PI; rupeeBack.position.z = -0.12; coin.add(rupeeBack);
  city.animated.push((dt, t) => { coin.rotation.y += dt * 0.6; water.position.y = 0.62 + Math.sin(t * 2) * 0.015; });
  collision.addCircle(0, 0, 4.25);

  // Benches beside the paths
  const wood = new THREE.MeshLambertMaterial({ color: 0x8a6440 });
  const benchSpots = [[2.8, -13, 0], [-2.8, -13, 0], [2.8, 13, 0], [-2.8, 13, 0], [13, 2.8, 1], [13, -2.8, 1], [-13, 2.8, 1], [-13, -2.8, 1]];
  for (const [x, z, rot] of benchSpots) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 2), wood); seat.position.y = 0.48;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 2), wood); back.position.set(x > 0 && !rot ? 0.28 : -0.28, 0.75, 0);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 1.8), new THREE.MeshLambertMaterial({ color: 0x222222 })); legs.position.y = 0.22; legs.scale.set(1, 1, 1);
    g.add(seat, back, legs);
    g.position.set(x, 0, z);
    if (rot) { g.rotation.y = Math.PI / 2; back.position.x = z > 0 ? -0.28 : 0.28; }
    else back.position.x = x > 0 ? 0.28 : -0.28;
    seat.castShadow = back.castShadow = shadows;
    scene.add(g);
    if (rot) collision.addBox(x, z, 2, 0.7, 0.9); else collision.addBox(x, z, 0.7, 2, 0.9);
  }
}

function rupeeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#5b420e'; g.font = '800 96px system-ui, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('₹', 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
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

  switch (b.style) {
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
      add(box(b.w, b.h * 0.72, b.d, mats), 0, b.h * 0.36, 0);
      add(box(b.w * 0.72, b.h * 0.28, b.d * 0.72, mats), 0, b.h * 0.72 + b.h * 0.14, 0);
      if (b.id === 'accofintra-hq') addLogos(group, b);
      add(new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.74, 0.6, b.d * 0.74), accentMat), 0, b.h + 0.3, 0);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6, 5), new THREE.MeshLambertMaterial({ color: 0x999999 })), 0, b.h + 3.4, 0);
      break;
    }
    case 'glass': {
      const glass = new THREE.MeshLambertMaterial({ color: b.color, map: win.map, emissiveMap: win.emissive, emissive: 0xbfe3ff, emissiveIntensity: 0 });
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
      const top = new THREE.Mesh(new THREE.PlaneGeometry(along[0] * 0.8, 0.8), new THREE.MeshBasicMaterial({ map: signTexture('FUEL · CNG · EV', b.accent, 'FINVORA FUELS'), side: THREE.DoubleSide }));
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
  const inset = b.style === 'classical' ? -3.95 : 0.05; // classical door sits behind the colonnade
  doorGroup.position.set(dir[0] * (faceHalf + inset), 0, dir[1] * (faceHalf + inset));
  doorGroup.rotation.y = rotY;
  group.add(doorGroup);
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x0f1a22, emissive: 0x3a6f8f, emissiveIntensity: 0.25 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 0.2), doorMat); door.position.y = 1.6 + (b.style === 'classical' ? 0.8 : 0); doorGroup.add(door);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.35, 0.3), accentMat); frame.position.y = door.position.y + 1.75; doorGroup.add(frame);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(5, 0.18, 2.2), new THREE.MeshLambertMaterial({ color: 0x1c1f24 }));
  canopy.position.set(0, door.position.y + 2.05, 1.05); canopy.castShadow = shadows; doorGroup.add(canopy);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), new THREE.MeshBasicMaterial({ map: signTexture(b.short, b.accent, 'OPEN · FINVORA') }));
  sign.position.set(0, Math.min(b.h - 1.5, door.position.y + 3.6), b.style === 'glass' ? 0.75 : 0.25); // in front of glass fins
  if (b.style === 'classical') sign.position.set(0, b.h - 4.6, 4.05);
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

  collision.addBox(b.x, b.z, b.style === 'classical' ? b.w + 1.6 : b.w, b.style === 'classical' ? b.d + 1.6 : b.d, b.h);
  city.doors.push({ type: 'building', building: b, x: dp.x, z: dp.z, face: dp.face, marker });
}

// The AccoFinTra logo on all four sides of the tower's upper section, and above the entrance.
let logoTex = null;
function addLogos(group, b) {
  logoTex ||= new THREE.TextureLoader().load(logoUrl, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; });
  logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: logoTex, toneMapped: false });
  const upperY = b.h * 0.72 + b.h * 0.14, half = b.w * 0.72 / 2 + 0.06, size = b.w * 0.6;
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    const a = i * Math.PI / 2; m.position.set(Math.sin(a) * half, upperY, Math.cos(a) * half); m.rotation.y = a; group.add(m);
  }
  const low = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), mat);
  low.position.set(0, 17, b.d / 2 + 0.06); group.add(low);
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
