import * as THREE from 'three';
import { CollisionWorld } from './Collision.js';
import { createCharacter, animateCharacter } from '../entities/Character.js';
import { signTexture, labelTexture } from '../utils/textures.js';
import { INTERIORS, COLLEAGUE_LOOKS, onDuty } from '../data/interiors.js';
import { npcById } from '../data/npcs.js';
import { buildingById } from '../data/buildings.js';
import logoUrl from '../assets/accofintra-logo.jpg';

// Walk-in interiors. Each one is its own small scene with its own colliders, entered through a building door.
// Rooms are drawn with inward-facing walls and a ceiling that faces down, so the third-person camera can
// pass outside a wall without hiding the room.

const hex = (c) => '#' + new THREE.Color(c).getHexString();

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texOf(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

const THEMES = {
  tower: { floor: 0xe9e4da, floorRough: 0.18, wall: 0x2b2f36, wainscot: 0x8a6440, ceiling: 0xf4f1ea, desk: 0xf2efe8, deskTrim: 0xd4a846, light: 0xfff4de, bg: 0x1a1c20 },
  bank: { floor: 0xdcd3c2, floorRough: 0.22, wall: 0xf0e8d8, wainscot: 0x5b3a22, ceiling: 0xfaf6ee, desk: 0x5b3a22, deskTrim: 0x2fbf71, light: 0xfff1d6, bg: 0x2a241c },
  exchange: { floor: 0x1d222b, floorRough: 0.3, wall: 0x141a24, wainscot: 0x0b0e13, ceiling: 0x1a1f28, desk: 0x2a313d, deskTrim: 0xd4a846, light: 0xdfe9ff, bg: 0x07090c },
  mall: { floor: 0xf1ede6, floorRough: 0.12, wall: 0xe8e3da, wainscot: 0xcfc8bb, ceiling: 0xfbfaf7, desk: 0xffffff, deskTrim: 0x5aa9e6, light: 0xfff6e6, bg: 0x1d2026 },
  cinema: { floor: 0x2a1c22, floorRough: 0.6, wall: 0x1a1418, wainscot: 0x3a1e26, ceiling: 0x120e10, desk: 0x2b1f24, deskTrim: 0xe5534b, light: 0xffd9b0, bg: 0x070506 },
  home: { floor: 0xb8875a, floorRough: 0.45, wall: 0xf3ede2, wainscot: 0xe0d5c2, ceiling: 0xfbf8f2, desk: 0x8a6440, deskTrim: 0xb5563c, light: 0xffe9c8, bg: 0x241c14 },
};

export class Interior {
  constructor(key, { environment = null, market = null } = {}) {
    this.key = key;
    this.def = INTERIORS[key];
    this.building = buildingById[this.def.building];
    this.theme = THEMES[this.def.theme];
    this.market = market;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.theme.bg);
    this.scene.environment = environment; this.scene.environmentIntensity = 0.5;
    this.collision = new CollisionWorld(Infinity);
    this.spots = [];
    this.counters = [];
    this.animated = [];
    this.tokenNo = 10 + Math.floor(Math.random() * 20);
    this.calls = [];
    this._lastDuty = null;
    const { w, d } = this.def;
    this.spawn = { x: 0, z: d / 2 - 4.6, yaw: Math.PI };
    this._lights();
    this._shell();
    if (key === 'home') this._home(); else this._counters();
    if (key === 'tower') this._towerDecor();
    if (key === 'bank') this._bankDecor();
    if (key === 'exchange') this._exchangeDecor();
    if (key === 'mall') this._mallDecor();
    if (key === 'cinema') this._cinemaDecor();
    this.spots.push({ kind: 'exit', x: 0, z: d / 2 - 1.2, label: `Leave ${this.building.name}`, sub: 'Back to the city' });
    this.update(0, 10, 0);
  }

  _lights() {
    const t = this.theme;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6b5a48, this.key === 'exchange' ? 1.0 : 0.95));
    const key = new THREE.DirectionalLight(t.light, 0.8); key.position.set(6, 12, 8); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-8, 6, -6); this.scene.add(fill);
  }

  _add(mesh, x = 0, y = 0, z = 0) { mesh.position.set(x, y, z); this.scene.add(mesh); return mesh; }

  _shell() {
    const { w, d, h } = this.def, t = this.theme;
    const floorMat = new THREE.MeshStandardMaterial({ color: t.floor, roughness: t.floorRough, metalness: 0.05, map: this.key === 'bank' ? checkerTex() : this.key === 'home' ? plankTex() : null });
    if (floorMat.map) floorMat.map.repeat.set(w / 2, d / 2);
    this._add(new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), floorMat));
    // walls as one inward-facing box (back faces culled from outside), plus a wainscot band
    const wallMat = new THREE.MeshLambertMaterial({ color: t.wall, side: THREE.BackSide });
    const shell = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [wallMat, wallMat, new THREE.MeshLambertMaterial({ color: t.ceiling, side: THREE.BackSide }), new THREE.MeshBasicMaterial({ visible: false }), wallMat, wallMat]);
    this._add(shell, 0, h / 2, 0);
    const wain = new THREE.MeshLambertMaterial({ color: t.wainscot, side: THREE.BackSide });
    this._add(new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, 1.1, d - 0.02), [wain, wain, new THREE.MeshBasicMaterial({ visible: false }), new THREE.MeshBasicMaterial({ visible: false }), wain, wain]), 0, 0.55, 0);
    // ceiling light panels
    const lp = new THREE.MeshBasicMaterial({ color: 0xfffaf0 });
    for (let x = -w / 2 + 4; x <= w / 2 - 4; x += 6) for (let z = -d / 2 + 4; z <= d / 2 - 4; z += 6) {
      if (this.key === 'home') continue;
      this._add(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.9).rotateX(Math.PI / 2), lp), x, h - 0.02, z);
    }
    // walls for the camera and the player
    for (const [x, z, bw, bd] of [[0, -d / 2 - 0.5, w + 2, 1], [0, d / 2 + 0.5, w + 2, 1], [-w / 2 - 0.5, 0, 1, d + 2], [w / 2 + 0.5, 0, 1, d + 2]]) this.collision.addBox(x, z, bw, bd, h);
    // entrance doors (glass) on the south wall
    const doorM = new THREE.MeshLambertMaterial({ color: 0x9fc2d4, transparent: true, opacity: 0.5, emissive: 0x6f9fbf, emissiveIntensity: 0.4 });
    this._add(new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.8).rotateY(Math.PI), doorM), 0, 1.4, d / 2 - 0.02);
    const mat = new THREE.MeshBasicMaterial({ map: signTexture('EXIT', 0x2fbf71, 'BACK TO THE CITY'), side: THREE.DoubleSide });
    this._add(new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), mat), 0, 3.2, d / 2 - 0.05).rotation.y = Math.PI;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2fbf71, transparent: true, opacity: 0.7 }));
    this._add(ring, 0, 0.02, d / 2 - 1.2);
  }

  // ---------------------------------------------------------------- counters with staff
  _counters() {
    const { w, d } = this.def, list = this.def.counters, t = this.theme;
    const slots = [];
    if (this.key === 'tower') {
      const north = list.slice(0, 6), east = list.slice(6, 11), west = list.slice(11);
      north.forEach((c, i) => slots.push({ c, x: -w / 2 + 6 + i * ((w - 12) / 5), z: -d / 2 + 1.7, yaw: 0 }));
      east.forEach((c, i) => slots.push({ c, x: w / 2 - 1.7, z: -d / 2 + 7 + i * ((d - 15) / 4), yaw: -Math.PI / 2 }));
      west.forEach((c, i) => slots.push({ c, x: -w / 2 + 1.7, z: -d / 2 + 7 + i * ((d - 15) / 4), yaw: Math.PI / 2 }));
    } else if (this.key === 'bank') {
      list.forEach((c, i) => slots.push({ c, x: -w / 2 + 5 + i * ((w - 10) / (list.length - 1)), z: -d / 2 + 1.7, yaw: 0 }));
    } else if (this.key === 'exchange') {
      list.forEach((c, i) => slots.push({ c, x: -w / 2 + 1.7, z: -d / 2 + 8 + i * 7, yaw: Math.PI / 2 }));
    } else if (this.key === 'mall') {
      // shop counters in front of shopfronts: three on the back wall, one on each side wall
      slots.push({ c: list[0], x: -14, z: -d / 2 + 4.2, yaw: 0 }, { c: list[1], x: 0, z: -d / 2 + 4.2, yaw: 0 }, { c: list[3], x: 14, z: -d / 2 + 4.2, yaw: 0 });
      slots.push({ c: list[2], x: w / 2 - 4.2, z: 2, yaw: -Math.PI / 2 }, { c: list[4], x: -w / 2 + 1.7, z: 4, yaw: Math.PI / 2 });
    } else if (this.key === 'cinema') {
      list.forEach((c, i) => slots.push({ c, x: -9 + i * 18, z: -d / 2 + 1.7, yaw: 0 }));
    }
    const deskM = new THREE.MeshStandardMaterial({ color: t.desk, roughness: 0.35, metalness: 0.05 });
    const glassM = new THREE.MeshLambertMaterial({ color: 0xcfe3ee, transparent: true, opacity: 0.25, depthWrite: false });
    slots.forEach(({ c, x, z, yaw }, i) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; this.scene.add(g);
      const accent = new THREE.MeshLambertMaterial({ color: c.accent, emissive: c.accent, emissiveIntensity: 0.25 });
      const desk = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.05, 0.9), deskM); desk.position.set(0, 0.525, 0.4); g.add(desk);
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 1.0), new THREE.MeshStandardMaterial({ color: 0xf6f3ee, roughness: 0.15 })); top.position.set(0, 1.08, 0.4); g.add(top);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.12, 0.12, 0.02), accent); stripe.position.set(0, 0.85, 0.86); g.add(stripe);
      const pane = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.7, 0.03), glassM); pane.position.set(0, 1.45, 0.75); pane.renderOrder = 2; g.add(pane);
      const mon = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.04), new THREE.MeshBasicMaterial({ color: 0x1b2a3a })); mon.position.set(0.8, 1.32, 0.25); mon.rotation.y = Math.PI; g.add(mon);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.75), new THREE.MeshBasicMaterial({ map: signTexture(`${i + 1}  ${c.name.toUpperCase()}`, c.accent, c.agent ? 'COUNTER' : this.key === 'mall' || this.key === 'cinema' ? 'OPEN NOW' : 'COUNTER · DESK TEAM', (3.0) / (0.75)) }));
      sign.position.set(0, 3.05, -0.15); g.add(sign);
      const chair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), new THREE.MeshLambertMaterial({ color: 0x2a2d33 })); chair.position.set(0, 0.45, -0.45); g.add(chair);
      // staff: the named agent in office hours, a desk colleague otherwise
      const agentDef = c.agent ? npcById[c.agent] : null;
      const staff = {};
      if (agentDef) { staff.agent = createCharacter(agentDef.look, { blobShadow: false }); staff.agent.root.position.set(0, 0, -0.35); g.add(staff.agent.root); }
      staff.colleague = createCharacter(COLLEAGUE_LOOKS[i % COLLEAGUE_LOOKS.length], { blobShadow: false }); staff.colleague.root.position.set(0, 0, -0.35); g.add(staff.colleague.root);
      const plateMat = new THREE.MeshBasicMaterial({ transparent: true });
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.32), plateMat); plate.position.set(-0.7, 1.2, 0.93); plate.rotation.x = -0.25; g.add(plate);
      const plates = { agent: agentDef ? labelTexture(agentDef.name, agentDef.role, hex(c.accent)) : null, colleague: labelTexture(this.key === 'mall' || this.key === 'cinema' ? 'Store team' : 'Desk team', `Counter ${i + 1}`, hex(c.accent)) };
      const cos = Math.cos(yaw), sin = Math.sin(yaw);
      const fx = x + sin * 1.8, fz = z + cos * 1.8; // customer stands in front of the desk
      this.collision.addBox(x + sin * 0.4, z + cos * 0.4, Math.abs(cos) * 3.2 + Math.abs(sin) * 1.0, Math.abs(cos) * 1.0 + Math.abs(sin) * 3.2, 1.1);
      const mark = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: c.accent, transparent: true, opacity: 0.6 }));
      mark.position.set(fx, 0.02, fz); this.scene.add(mark);
      const counter = { def: c, number: i + 1, staff, plate, plateMat, plates, agentDef, x: fx, z: fz, face: yaw + Math.PI };
      this.counters.push(counter);
      this.spots.push({ kind: 'counter', counter, x: fx, z: fz, label: `Counter ${i + 1}: ${c.name}`, sub: '' });
    });
  }

  /** Office hours: named agent at the desk; otherwise a desk colleague. Returns who is serving. */
  serving(counter, hour) { return counter.agentDef && onDuty(hour) ? counter.agentDef : null; }

  issueToken(counter) {
    const token = `${this.def.token}-${String(++this.tokenNo).padStart(3, '0')}`;
    this.calls.unshift({ token, counter: counter.number });
    this.calls = this.calls.slice(0, 4);
    this._drawTokens();
    return token;
  }

  _towerDecor() {
    const { w, d, h } = this.def;
    // reception island with the AccoFinTra logo wall and the token board
    const recep = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.05, 32, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.2 }));
    recep.rotation.y = Math.PI / 2; this._add(recep, 0, 0.525, 1); this.collision.addCircle(0, 1, 2.6);
    const logoTex = new THREE.TextureLoader().load(logoUrl, (t) => { t.colorSpace = THREE.SRGBColorSpace; });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 4.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.4 })); this._add(wall, 0, 2.6, -2.2);
    this.collision.addBox(0, -2.2, 6, 0.4, 4);
    for (const side of [1, -1]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: logoTex, toneMapped: false })); this._add(l, 0, 2.7, -2.2 + side * 0.16); if (side < 0) l.rotation.y = Math.PI; }
    this._tokenBoard(0, 5.6, d / 2 - 0.1, Math.PI, 5.4);
    this._indexScreen(-9, 4.3, -2.2, 0, 7);
    this._indexScreen(9, 4.3, -2.2, 0, 7);
    // waiting area
    this._seats(-7, 8, 3); this._seats(7, 8, 3); this._seats(-7, 11.5, 3); this._seats(7, 11.5, 3);
    for (const [x, z] of [[-w / 2 + 1.2, d / 2 - 1.2], [w / 2 - 1.2, d / 2 - 1.2], [-4, -2.2], [4, -2.2]]) this._plant(x, z);
    for (const [x, z] of [[-13, -4], [13, -4], [-13, 6], [13, 6]]) { this._add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, h, 16), new THREE.MeshStandardMaterial({ color: 0xd4a846, roughness: 0.3, metalness: 0.6 })), x, h / 2, z); this.collision.addCircle(x, z, 0.5); }
    this.spots.push({ kind: 'reception', x: 0, z: 4.4, label: 'Reception: who does what?', sub: 'Ask for directions to a counter' });
  }

  _bankDecor() {
    const { w, d } = this.def;
    this._tokenBoard(0, 5.2, d / 2 - 0.1, Math.PI, 4.6);
    this._seats(-8, 6, 4); this._seats(8, 6, 4);
    // queue barriers in front of the counters
    const post = new THREE.MeshStandardMaterial({ color: 0xc9c9c9, metalness: 0.8, roughness: 0.3 }), rope = new THREE.MeshLambertMaterial({ color: 0x8a1c1c });
    for (let x = -w / 2 + 3; x <= w / 2 - 3; x += 3) { this._add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 1, 10), post), x, 0.5, -d / 2 + 4.6); }
    this._add(new THREE.Mesh(new THREE.BoxGeometry(w - 6, 0.05, 0.05), rope), 0, 0.9, -d / 2 + 4.6);
    // vault door on the east wall
    const vault = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.4, 32).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8c9096, metalness: 0.9, roughness: 0.3 }));
    this._add(vault, w / 2 - 0.25, 2.2, 3);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 8, 24).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd4a846, metalness: 0.9, roughness: 0.25 }));
    this._add(wheel, w / 2 - 0.5, 2.2, 3);
    for (const [x, z] of [[-w / 2 + 1.2, d / 2 - 1.2], [w / 2 - 1.2, d / 2 - 1.2]]) this._plant(x, z);
  }

  _exchangeDecor() {
    const { w, d, h } = this.def;
    // giant index board on the north wall and an LED ticker ribbon around the hall
    this._indexScreen(0, 6.2, -d / 2 + 0.12, 0, 20, true);
    const c = canvas(2048, 64), tex = texOf(c); tex.wrapS = THREE.RepeatWrapping;
    this._ticker = { c, tex };
    for (const [x, z, ry, len] of [[0, -d / 2 + 0.1, 0, w], [w / 2 - 0.1, 0, -Math.PI / 2, d], [-w / 2 + 0.1, 0, Math.PI / 2, d], [0, d / 2 - 0.1, Math.PI, w]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.8), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      this._add(m, x, h - 1.6, z).rotation.y = ry;
    }
    this.animated.push((dt) => { tex.offset.x = (tex.offset.x + dt * 0.03) % 1; });
    // trading floor: rows of terminals
    const deskM = new THREE.MeshStandardMaterial({ color: 0x2a313d, roughness: 0.4 }), scr = new THREE.MeshBasicMaterial({ color: 0x2b6aa8 });
    for (let r = 0; r < 3; r++) for (let k = -2; k <= 2; k++) {
      const x = 2 + k * 4.2, z = -6 + r * 5.5;
      this._add(new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 1.2), deskM), x, 0.45, z);
      for (const o of [-0.8, 0.8]) this._add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.05), scr), x + o, 1.25, z - 0.3);
      this.collision.addBox(x, z, 3.4, 1.2, 0.9);
    }
    // opening bell podium
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.8, 24), new THREE.MeshStandardMaterial({ color: 0xd4a846, metalness: 0.7, roughness: 0.3 }));
    this._add(pod, w / 2 - 5, 0.4, -d / 2 + 5); this.collision.addCircle(w / 2 - 5, -d / 2 + 5, 1.4);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.6), new THREE.MeshStandardMaterial({ color: 0xd4a846, metalness: 0.9, roughness: 0.2 }));
    this._add(bell, w / 2 - 5, 1.5, -d / 2 + 5).rotation.x = Math.PI;
    this.spots.push({ kind: 'action', action: 'bell', x: w / 2 - 5, z: -d / 2 + 7, label: 'Ring the opening bell', sub: 'Market hours 9:15 am to 3:30 pm' });
    this.spots.push({ kind: 'action', action: 'board', x: 0, z: -d / 2 + 3.5, label: 'Read the market board', sub: 'Live simulated prices' });
    this._tokenBoard(-8, 5.2, d / 2 - 0.1, Math.PI, 4.6);
  }

  // ---------------------------------------------------------------- mall: shopfronts, atrium, escalators, food court
  _mallDecor() {
    const { w, d, h } = this.def;
    const shops = [['TECHNOVA', 0x5aa9e6, -14], ['URBAN THREAD', 0xc0577a, 0], ['BOOKNOOK', 0x2fbf71, 14]];
    const glass = new THREE.MeshLambertMaterial({ color: 0xbfd8e6, transparent: true, opacity: 0.35, depthWrite: false });
    for (const [name, c, x] of shops) {
      // shopfront: lit back panel, glass front, name fascia
      const back = new THREE.Mesh(new THREE.BoxGeometry(11, 4.4, 0.2), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: c, emissiveIntensity: 0.18 })); this._add(back, x, 2.2, -d / 2 + 0.15);
      const fas = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.1), new THREE.MeshBasicMaterial({ map: signTexture(name, c, 'STORE', 10 / 1.1) })); this._add(fas, x, 5.1, -d / 2 + 0.3);
      const gl = new THREE.Mesh(new THREE.BoxGeometry(11, 4.2, 0.06), glass); gl.renderOrder = 2; this._add(gl, x, 2.1, -d / 2 + 2.4);
      this.collision.addBox(x - 3.6, -d / 2 + 2.4, 3.4, 0.2, 4); this.collision.addBox(x + 3.6, -d / 2 + 2.4, 3.4, 0.2, 4);
      // shelves or racks behind the glass
      for (let k = -1; k <= 1; k += 2) this._add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 0.5), new THREE.MeshLambertMaterial({ color: 0x3a3f48 })), x + k * 3.6, 1.1, -d / 2 + 1);
    }
    // gallery floor above the shops with a glass balustrade, and a skylight
    this._add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, 7), new THREE.MeshLambertMaterial({ color: 0xf4f1ea })), 0, 6.2, -d / 2 + 3.5);
    const bal = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, 0.05), glass); bal.renderOrder = 2; this._add(bal, 0, 6.95, -d / 2 + 7);
    for (let x = -w / 2 + 6; x < w / 2; x += 8) this._add(new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xe8f4ff, emissiveIntensity: 0.6 })), x, 6.6, -d / 2 + 0.25);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(20, 14).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xcfe8ff })); this._add(sky, 0, h - 0.03, 4);
    // escalator to the gallery
    const esc = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 11), new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.7, roughness: 0.3 }));
    esc.rotation.x = -0.52; this._add(esc, -w / 2 + 9, 3.2, -d / 2 + 11.5); this.collision.addBox(-w / 2 + 9, -d / 2 + 11.5, 2.2, 10, 6);
    for (const s of [-1.05, 1.05]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 11), new THREE.MeshLambertMaterial({ color: 0x222831 })); rail.rotation.x = -0.52; this._add(rail, -w / 2 + 9 + s, 3.8, -d / 2 + 11.5); }
    // central fountain with a ring of planters
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.6, 32), new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.3 })); this._add(pool, 0, 0.3, 4);
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.9, 32).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x4aa3d4, emissive: 0x15405a })); this._add(water, 0, 0.58, 4);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.4, 2.4, 12, 1, true), new THREE.MeshLambertMaterial({ color: 0xdff2ff, transparent: true, opacity: 0.6 })); this._add(jet, 0, 1.6, 4);
    this.animated.push((dt, t) => { jet.scale.y = 1 + Math.sin(t * 2.2) * 0.12; });
    this.collision.addCircle(0, 4, 3.5);
    for (const [x, z] of [[-6, 4], [6, 4], [-w / 2 + 1.2, d / 2 - 1.2], [w / 2 - 1.2, d / 2 - 1.2]]) this._plant(x, z);
    // food court seating beside the food counter
    const tableM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }), chairM = new THREE.MeshLambertMaterial({ color: 0xf08a3c });
    for (const [x, z] of [[w / 2 - 11, -3], [w / 2 - 11, 3], [w / 2 - 11, 9], [w / 2 - 16, 0], [w / 2 - 16, 6]]) {
      this._add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 20), tableM), x, 0.76, z);
      this._add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.75, 8), tableM), x, 0.38, z);
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) this._add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.42), chairM), x + Math.sin(a) * 0.95, 0.23, z + Math.cos(a) * 0.95);
      this.collision.addCircle(x, z, 1.3);
    }
    const menu = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.2), new THREE.MeshBasicMaterial({ map: signTexture('FOOD COURT', 0xf08a3c, 'THALI · BIRYANI · DOSA · COFFEE', 7 / 1.2) }));
    this._add(menu, w / 2 - 0.15, 4.6, 2).rotation.y = -Math.PI / 2;
    const dir = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), new THREE.MeshBasicMaterial({ map: directoryTex() })); this._add(dir, 7, 1.9, d / 2 - 3).rotation.y = Math.PI;
    this.collision.addBox(7, d / 2 - 3, 2.6, 0.4, 3);
    // shoppers browsing (decorative)
    this._crowd([[-8, 9], [10, 12], [4, -2], [-12, 2], [14, 6]]);
  }

  // ---------------------------------------------------------------- cinema: posters, now-showing board, screen doors
  _cinemaDecor() {
    const { w, d, h } = this.def;
    const titles = [['THE LAST SIP', 0xd4a846], ['BULL RUN', 0x2fbf71], ['BEAR NECESSITIES', 0xe5534b], ['COMPOUND', 0x5aa9e6], ['THE EMI TRAP', 0xc96bd4], ['ZERO TO CRORE', 0xf08a3c]];
    titles.forEach(([t, c], i) => {
      const side = i < 3 ? -1 : 1, z = -6 + (i % 3) * 7;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.4), new THREE.MeshBasicMaterial({ map: posterTex(t, c), toneMapped: false }));
      this._add(p, side * (w / 2 - 0.12), 2.6, z).rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.7, 2.7), new THREE.MeshLambertMaterial({ color: 0xd4a846, emissive: 0xd4a846, emissiveIntensity: 0.3 }));
      this._add(frame, side * (w / 2 - 0.06), 2.6, z);
    });
    // screen entrances with glowing numbers on the back wall, either side of the counters
    for (const [x, n] of [[-17, 1], [-1, 2], [1, 3], [17, 4]]) {
      if (Math.abs(x) < 2) continue;
      this._add(new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3), new THREE.MeshLambertMaterial({ color: 0x0c0a0b })), x, 1.5, -d / 2 + 0.05);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), new THREE.MeshBasicMaterial({ map: signTexture(`SCREEN ${n}`, 0xe5534b, 'NOW SHOWING', 2.6 / 0.7) })); this._add(s, x, 3.5, -d / 2 + 0.06);
    }
    // now-showing LED board over the counters
    const board = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), new THREE.MeshBasicMaterial({ map: showtimesTex(titles), toneMapped: false })); this._add(board, 0, h - 2.2, -d / 2 + 0.08);
    // carpet runner, velvet queue ropes and lobby sofas
    this._add(new THREE.Mesh(new THREE.PlaneGeometry(5, d - 4).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x7a1c2a })), 0, 0.01, 1);
    const post = new THREE.MeshStandardMaterial({ color: 0xd4a846, metalness: 0.9, roughness: 0.25 }), rope = new THREE.MeshLambertMaterial({ color: 0x8a1c1c });
    for (const x of [-12, -6, 6, 12]) this._add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 1, 10), post), x, 0.5, -d / 2 + 4.8);
    for (const x of [-9, 9]) this._add(new THREE.Mesh(new THREE.BoxGeometry(6, 0.06, 0.06), rope), x, 0.9, -d / 2 + 4.8);
    const sofa = new THREE.MeshLambertMaterial({ color: 0x5b1a26 });
    for (const [x, z] of [[-12, 8], [12, 8]]) { this._add(new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 1.2), sofa), x, 0.25, z); this._add(new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 0.3), sofa), x, 0.65, z + 0.5); this.collision.addBox(x, z, 4, 1.3, 1); }
    // marquee bulbs around the ceiling edge, chasing
    const bulbs = [];
    const bm = [new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), new THREE.MeshBasicMaterial({ color: 0x5a4a2a })];
    for (let x = -w / 2 + 1; x <= w / 2 - 1; x += 1.4) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), bm[0]); this._add(b, x, h - 0.4, -d / 2 + 0.2); bulbs.push(b); }
    this.animated.push((dt, t) => { const k = Math.floor(t * 6); bulbs.forEach((b, i) => { b.material = bm[(i + k) % 3 === 0 ? 1 : 0]; }); });
    for (const [x, z] of [[-w / 2 + 1.2, d / 2 - 1.2], [w / 2 - 1.2, d / 2 - 1.2]]) this._plant(x, z);
    this._crowd([[-4, 6], [5, 3], [-14, 2], [13, 0]]);
  }

  /** A few people standing around (decorative, no AI). */
  _crowd(spots) {
    spots.forEach(([x, z], i) => {
      const ch = createCharacter({ ...CROWD_LOOKS[i % CROWD_LOOKS.length] }, { blobShadow: false });
      ch.root.position.set(x, 0, z); ch.root.rotation.y = (i * 2.3) % (Math.PI * 2); this.scene.add(ch.root);
      this.collision.addCircle(x, z, 0.45);
    });
  }

  _home() {
    const { w, d, h } = this.def, wall = new THREE.MeshLambertMaterial({ color: 0xf3ede2 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.5 }), fabric = new THREE.MeshLambertMaterial({ color: 0x3d5a80 });
    const part = (x, z, bw, bd) => { this._add(new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), wall), x, h / 2, z); this.collision.addBox(x, z, bw, bd, h); };
    // interior walls: garage on the east (x > 4), bedroom at the back west
    part(4, -d / 2 + 3, 0.2, 6); part(4, d / 2 - 4, 0.2, 8); // garage wall with a doorway in the middle
    part(-6.5, -2, 9, 0.2); // bedroom wall with a doorway on the east end
    // living room: sofa, coffee table, TV wall, rug
    this._add(new THREE.Mesh(new THREE.PlaneGeometry(5, 3.2).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xb5563c })), -4, 0.01, 3.5);
    const sofa = new THREE.Group(); const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.45, 1), fabric); base.position.y = 0.35; const back = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.6, 0.25), fabric); back.position.set(0, 0.75, 0.4); sofa.add(base, back); sofa.position.set(-4, 0, 5.6); this.scene.add(sofa); this.collision.addBox(-4, 5.6, 3.4, 1.1, 0.9);
    this._add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.8), wood), -4, 0.2, 3.4); this.collision.addBox(-4, 3.4, 1.6, 0.8, 0.4);
    const tvc = canvas(512, 288), tvTex = texOf(tvc); this._tv = { c: tvc, tex: tvTex };
    this._add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 0.08), new THREE.MeshBasicMaterial({ color: 0x050505 })), -4, 1.7, 0.9);
    this._add(new THREE.Mesh(new THREE.PlaneGeometry(2.45, 1.38), new THREE.MeshBasicMaterial({ map: tvTex, toneMapped: false })), -4, 1.7, 0.95);
    this._add(new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 0.5), wood), -4, 0.25, 0.75); this.collision.addBox(-4, 0.75, 3, 0.5, 0.5);
    // kitchen along the west wall
    const kitchen = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.3 });
    this._add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 4.5), kitchen), -w / 2 + 0.45, 0.475, 4.2); this.collision.addBox(-w / 2 + 0.45, 4.2, 0.7, 4.5, 1);
    this._add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.9, 0.8), new THREE.MeshStandardMaterial({ color: 0xcfd3d8, metalness: 0.6, roughness: 0.3 })), -w / 2 + 0.5, 0.95, 1.2); this.collision.addBox(-w / 2 + 0.5, 1.2, 0.8, 0.8, 1.9);
    // bedroom: bed, wardrobe, study desk with a laptop
    this._add(new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 2.4), wood), -7.5, 0.25, -5.6);
    this._add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 2.3), new THREE.MeshLambertMaterial({ color: 0xf5f5f0 })), -7.5, 0.6, -5.6);
    this._add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.8), new THREE.MeshLambertMaterial({ color: 0x5aa9e6 })), -7.5, 0.72, -5.0);
    this.collision.addBox(-7.5, -5.6, 2, 2.4, 0.9);
    this._add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.3, 0.65), wood), -3.6, 1.15, -7.6); this.collision.addBox(-3.6, -7.6, 2.2, 0.65, 2.3);
    this._add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.75, 0.7), wood), 1.8, 0.375, -7.5); this.collision.addBox(1.8, -7.5, 1.6, 0.7, 0.8);
    const lap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.03), new THREE.MeshBasicMaterial({ color: 0x3a7bd5 })); lap.position.set(1.8, 0.95, -7.65); this.scene.add(lap);
    this._plant(-w / 2 + 1, -d / 2 + 1); this._plant(3, 6.8);
    // garage: concrete floor and the active vehicle
    this._add(new THREE.Mesh(new THREE.PlaneGeometry(6.8, d).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8d8a83 })), w / 2 - 3.4, 0.012, 0);
    this.garageSpot = { x: w / 2 - 3.4, z: 0 };
    this.spots.push(
      { kind: 'action', action: 'laptop', x: 1.8, z: -6.3, label: 'Open your laptop', sub: 'Portfolio and net worth' },
      { kind: 'action', action: 'wardrobe', x: -3.6, z: -6.4, label: 'Wardrobe', sub: 'Change clothes' },
      { kind: 'action', action: 'bed', x: -6.0, z: -4.0, label: 'Sleep until morning', sub: 'Skips to 7 am the next day' },
      { kind: 'action', action: 'tv', x: -4, z: 2.4, label: 'Watch market news', sub: 'FinVora Business channel' },
      { kind: 'action', action: 'fridge', x: -w / 2 + 1.6, z: 1.2, label: 'Fridge', sub: 'Grab a snack' },
      { kind: 'action', action: 'garage', x: w / 2 - 3.4, z: 3.2, label: 'Take your vehicle out', sub: 'Drive out of the garage' },
    );
  }

  setGarageVehicle(mesh) {
    if (this._garageCar) this.scene.remove(this._garageCar);
    this._garageCar = mesh;
    if (mesh) { mesh.position.set(this.garageSpot.x, 0.02, this.garageSpot.z - 1); mesh.rotation.y = Math.PI; this.scene.add(mesh); }
  }

  // ---------------------------------------------------------------- props and screens
  _seats(x, z, n) {
    const m = new THREE.MeshLambertMaterial({ color: 0x2f3b4a }), leg = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.7, roughness: 0.3 });
    for (let i = 0; i < n; i++) {
      const sx = x + (i - (n - 1) / 2) * 0.7;
      this._add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.55), m), sx, 0.48, z);
      this._add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.08), m), sx, 0.78, z + 0.26);
    }
    this._add(new THREE.Mesh(new THREE.BoxGeometry(n * 0.7, 0.05, 0.4), leg), x, 0.25, z);
    this.collision.addBox(x, z, n * 0.7, 0.7, 0.9);
  }

  _plant(x, z) {
    this._add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.6, 12), new THREE.MeshLambertMaterial({ color: 0x3a3a3c })), x, 0.3, z);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshLambertMaterial({ color: 0x3f7d3a }));
    this._add(leaves, x, 1.15, z).scale.set(1, 1.4, 1);
    this.collision.addCircle(x, z, 0.35);
  }

  _tokenBoard(x, y, z, ry, width) {
    const c = canvas(768, 256), tex = texOf(c);
    this._tokens = { c, tex };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 3), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    this._add(m, x, y, z).rotation.y = ry;
    this._drawTokens();
  }

  _drawTokens() {
    if (!this._tokens) return;
    const { c, tex } = this._tokens, g = c.getContext('2d');
    g.fillStyle = '#07090c'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#d4a846'; g.font = '800 34px system-ui, Arial'; g.fillText('NOW SERVING', 24, 46);
    g.fillStyle = '#8a8f98'; g.font = '600 20px system-ui, Arial'; g.fillText('Token          Counter', 400, 46);
    const rows = this.calls.length ? this.calls : [{ token: `${this.def.token}-${String(this.tokenNo).padStart(3, '0')}`, counter: 1 }];
    rows.forEach((r, i) => {
      g.fillStyle = i === 0 ? '#2fbf71' : '#ecebe6'; g.font = `${i === 0 ? 800 : 600} ${i === 0 ? 40 : 30}px ui-monospace, Menlo, monospace`;
      g.fillText(r.token, 400, 96 + i * 42); g.fillText(String(r.counter), 640, 96 + i * 42);
    });
    g.fillStyle = '#ecebe6'; g.font = '600 22px system-ui, Arial'; g.fillText('Walk to a counter and press E', 24, 100);
    g.fillStyle = '#8a8f98'; g.font = '500 18px system-ui, Arial'; g.fillText('Agents serve 9 am to 6 pm. The desk team', 24, 140); g.fillText('covers the counters at other hours.', 24, 164);
    tex.needsUpdate = true;
  }

  _indexScreen(x, y, z, ry, width, big = false) {
    const c = canvas(1024, big ? 512 : 384), tex = texOf(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width * c.height / c.width), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    this._add(m, x, y, z + (ry === 0 ? 0.17 : 0)).rotation.y = ry;
    (this._screens ||= []).push({ c, tex, big });
  }

  _drawScreens() {
    const mk = this.market; if (!mk) return;
    const idx = mk.indexLevel, prev = mk.indexHist?.[mk.indexHist.length - 2] ?? idx, ch = (idx / prev - 1) * 100;
    for (const s of this._screens || []) {
      const g = s.c.getContext('2d'), W = s.c.width, H = s.c.height;
      g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#d4a846'; g.font = '800 44px system-ui, Arial'; g.fillText('FINVORA 8', 30, 62);
      g.fillStyle = '#ecebe6'; g.font = '800 92px ui-monospace, Menlo, monospace'; g.fillText(idx.toFixed(2), 30, 165);
      g.fillStyle = ch >= 0 ? '#2fbf71' : '#e5534b'; g.font = '700 44px ui-monospace, Menlo, monospace'; g.fillText(`${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(2)}%`, 30, 222);
      const hist = (mk.indexHist || []).slice(-60);
      if (hist.length > 2) {
        const lo = Math.min(...hist), hi = Math.max(...hist), x0 = 520, x1 = W - 30, y0 = 40, y1 = 230;
        g.strokeStyle = ch >= 0 ? '#2fbf71' : '#e5534b'; g.lineWidth = 4; g.beginPath();
        hist.forEach((v, i) => { const x = x0 + (x1 - x0) * i / (hist.length - 1), y = y1 - (y1 - y0) * (v - lo) / ((hi - lo) || 1); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
      }
      if (s.big) mk.stocks.forEach((st, i) => {
        const c2 = (st.price / st.prev - 1) * 100, col = i % 2, row = Math.floor(i / 2), x = 30 + col * 500, y = 300 + row * 50;
        g.fillStyle = '#ecebe6'; g.font = '700 32px ui-monospace, Menlo, monospace'; g.fillText(st.symbol, x, y); g.fillText(st.price.toFixed(2), x + 130, y);
        g.fillStyle = c2 >= 0 ? '#2fbf71' : '#e5534b'; g.fillText(`${c2 >= 0 ? '+' : ''}${c2.toFixed(2)}%`, x + 330, y);
      });
      g.fillStyle = '#5b616b'; g.font = '500 20px system-ui, Arial'; g.fillText('Fictional companies · simulated prices', 30, H - 18);
      s.tex.needsUpdate = true;
    }
    if (this._ticker) {
      const g = this._ticker.c.getContext('2d'); g.fillStyle = '#020304'; g.fillRect(0, 0, 2048, 64); g.font = '700 34px ui-monospace, Menlo, monospace';
      let x = 10; for (let rep = 0; rep < 3; rep++) for (const st of mk.stocks) { const c2 = (st.price / st.prev - 1) * 100; g.fillStyle = '#ecebe6'; const a = `${st.symbol} ${st.price.toFixed(2)} `; g.fillText(a, x, 44); x += g.measureText(a).width; g.fillStyle = c2 >= 0 ? '#2fbf71' : '#e5534b'; const b = `${c2 >= 0 ? '▲' : '▼'}${Math.abs(c2).toFixed(2)}%   `; g.fillText(b, x, 44); x += g.measureText(b).width; }
      this._ticker.tex.needsUpdate = true;
    }
    if (this._tv) {
      const g = this._tv.c.getContext('2d'); g.fillStyle = '#0b1a2e'; g.fillRect(0, 0, 512, 288);
      g.fillStyle = '#d4a846'; g.fillRect(0, 0, 512, 44); g.fillStyle = '#0b1a2e'; g.font = '800 26px system-ui, Arial'; g.fillText('FINVORA BUSINESS · LIVE', 14, 31);
      g.fillStyle = '#ecebe6'; g.font = '800 54px ui-monospace, Menlo, monospace'; g.fillText(idx.toFixed(0), 18, 120);
      g.fillStyle = ch >= 0 ? '#2fbf71' : '#e5534b'; g.font = '700 32px ui-monospace, Menlo, monospace'; g.fillText(`${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(2)}%`, 260, 118);
      const news = (mk.news || []).slice(-3).reverse();
      g.fillStyle = '#c9ced6'; g.font = '500 17px system-ui, Arial';
      news.forEach((n, i) => g.fillText(String(n.text).slice(0, 52), 18, 170 + i * 32));
      this._tv.tex.needsUpdate = true;
    }
  }

  /** Per-frame: staff animation, office-hours switch, screens. */
  update(dt, hour, t) {
    const duty = this.key !== 'home' && hour >= 9 && hour < 18;
    if (duty !== this._lastDuty) {
      this._lastDuty = duty;
      for (const c of this.counters) {
        const agentOn = !!(c.agentDef && duty);
        if (c.staff.agent) c.staff.agent.root.visible = agentOn;
        c.staff.colleague.root.visible = !agentOn;
        c.plateMat.map = agentOn ? c.plates.agent : c.plates.colleague; c.plateMat.needsUpdate = true;
        const spot = this.spots.find((s) => s.counter === c);
        if (spot) spot.sub = agentOn ? `${c.agentDef.name} · ${c.agentDef.role}` : 'Desk team on duty';
      }
    }
    for (const c of this.counters) { const ch = c.staff.agent?.root.visible ? c.staff.agent : c.staff.colleague; animateCharacter(ch, dt, 0); }
    for (const f of this.animated) f(dt, t);
    this._screenTimer = (this._screenTimer || 0) - dt;
    if (this._screenTimer <= 0) { this._screenTimer = 2; this._drawScreens(); }
  }

  nearest(p) {
    let best = null, bd = 2.3;
    for (const s of this.spots) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }

  /** The counter as a building-like object for the service panel. */
  counterPanel(counter, hour) {
    const who = this.serving(counter, hour);
    return {
      id: counter.def.id, name: `${this.building.name} · Counter ${counter.number}: ${counter.def.name}`, short: counter.def.name.toUpperCase(),
      blurb: `${counter.def.blurb} ${who ? `${who.name} (${who.role}) is serving you.` : 'The desk team is serving you.'}`,
      services: counter.def.services, desk: counter.def.desk, counter: true,
    };
  }
}

const CROWD_LOOKS = [
  { skin: 0xc08a64, shirt: 0x5aa9e6, pants: 0x2a3340, hair: 0x15110d, hairStyle: 'short', top: 'tshirt' },
  { skin: 0xa77450, shirt: 0xc0577a, pants: 0xc0577a, hair: 0x1a120c, hairStyle: 'long', top: 'saree' },
  { skin: 0xd1a27c, shirt: 0xf08a3c, pants: 0x22262c, hair: 0x241811, hairStyle: 'bob', top: 'kurta' },
  { skin: 0x8f5d3c, shirt: 0xf2f2ee, pants: 0x3d5a80, hair: 0x0d0d0d, hairStyle: 'short', top: 'shirt' },
  { skin: 0xb98a6a, shirt: 0x2fbf71, pants: 0x1c2333, hair: 0x1a120c, hairStyle: 'bun', top: 'kurta' },
];

/** A fictional film poster: title, a simple graphic and a tagline. */
function posterTex(title, color) {
  const c = canvas(256, 360), g = c.getContext('2d'), col = hex(color);
  const gr = g.createLinearGradient(0, 0, 0, 360); gr.addColorStop(0, '#0b0d12'); gr.addColorStop(1, col); g.fillStyle = gr; g.fillRect(0, 0, 256, 360);
  g.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(128, 150, 30 + i * 22, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '800 30px system-ui, sans-serif';
  const words = title.split(' '); const lines = words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : [title];
  lines.forEach((l, i) => { let f = 30; g.font = `800 ${f}px system-ui, sans-serif`; while (g.measureText(l).width > 230 && f > 14) { f -= 2; g.font = `800 ${f}px system-ui, sans-serif`; } g.fillText(l, 128, 270 + i * 34); });
  g.font = '600 13px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText('A FINVORA PICTURES FILM · FICTIONAL', 128, 345);
  return texOf(c);
}
function showtimesTex(titles) {
  const c = canvas(1024, 192), g = c.getContext('2d');
  g.fillStyle = '#050405'; g.fillRect(0, 0, 1024, 192);
  g.font = '700 22px ui-monospace, Menlo, Consolas, monospace'; g.textBaseline = 'middle';
  const times = ['10:30', '13:15', '16:00', '18:45', '21:30'];
  titles.slice(0, 4).forEach(([t, col], i) => { const y = 30 + i * 44; g.fillStyle = hex(col); g.fillText(t, 20, y); g.fillStyle = '#f0c868'; g.fillText(times.slice(i % 2, i % 2 + 4).join('   '), 520, y); });
  return texOf(c);
}
function directoryTex() {
  const c = canvas(240, 320), g = c.getContext('2d');
  g.fillStyle = '#141a24'; g.fillRect(0, 0, 240, 320); g.fillStyle = '#5aa9e6'; g.fillRect(0, 0, 240, 44);
  g.fillStyle = '#fff'; g.font = '800 20px system-ui'; g.fillText('MALL DIRECTORY', 16, 29);
  g.font = '600 15px system-ui'; ['G  TechNova', 'G  Urban Thread', 'G  BookNook', 'G  Food Court', 'G  Bank ATM', '1  Gallery', '2  Cineplex (across town)'].forEach((l, i) => { g.fillStyle = i % 2 ? '#cfd6df' : '#fff'; g.fillText(l, 16, 80 + i * 32); });
  return texOf(c);
}

function checkerTex() {
  const c = canvas(64, 64), g = c.getContext('2d');
  g.fillStyle = '#e8e0d0'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#5b4a3a'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
  const t = texOf(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function plankTex() {
  const c = canvas(64, 128), g = c.getContext('2d');
  g.fillStyle = '#b8875a'; g.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#a9784d' : '#c09164'; g.fillRect(i * 16, 0, 15, 128); g.fillStyle = '#7a5434'; g.fillRect(i * 16 + 15, 0, 1, 128); g.fillRect(i * 16, (i * 37) % 128, 15, 1); }
  const t = texOf(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
