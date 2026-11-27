import * as THREE from 'three';
import { createCharacter, animateCharacter } from '../entities/Character.js';
import { labelTexture } from '../utils/textures.js';
import { KEY_NPCS, CITIZEN_LOOKS, CITIZEN_LINES } from '../data/npcs.js';
import { CITY } from '../config.js';

// NPC brain: a tiny state machine per character.
//   idle (loitering at a place) -> plan route -> walk -> arrive -> idle ...
//   talking: frozen and facing the player until the dialogue closes.

const STATE = { IDLE: 'idle', WALK: 'walk', TALK: 'talk', CHAT: 'chat' };
export { STATE };

class NPC {
  constructor(def, mgr, { castShadow, keyNpc }) {
    this.def = def;
    this.mgr = mgr;
    this.keyNpc = keyNpc;
    this.char = createCharacter(def.look, { castShadow });
    this.object = this.char.root;
    mgr.scene.add(this.object);
    const sp = mgr.places[def.spawn] || mgr.randomPlace();
    const j = sp.kind === 'post' ? 0 : 2;
    this.pos = { x: sp.x + (Math.random() - 0.5) * j, z: sp.z + (Math.random() - 0.5) * j };
    this.place = sp;
    this.yaw = Math.random() * Math.PI * 2;
    this.state = STATE.IDLE;
    this.timer = 1 + Math.random() * 3;
    this.route = []; this.ri = 0;
    this.lane = (Math.random() < 0.5 ? -1 : 1) * CITY.walkOffset; // keep to the pavement
    this.circuitIdx = 0; this.patrolIdx = 0; this.commuteIdx = 0;
    this.speed = 0;
    this.loiterTarget = null;
    if (keyNpc) this._makeLabel();
    this._sync();
  }

  _makeLabel() {
    const tex = labelTexture(this.def.name, this.def.hasName ? this.def.role : 'FinVora helper');
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
    sprite.scale.set(2.2, 0.62, 1);
    sprite.position.y = 2.45;
    this.object.add(sprite);
    this.label = sprite;
  }

  /** Decide the next destination according to the movement pattern. */
  nextPlace(hour) {
    const d = this.def, P = this.mgr.places;
    switch (d.pattern) {
      case 'routine': {
        let cur = d.routine[0];
        for (const r of d.routine) if (hour >= r.from) cur = r;
        return P[cur.place];
      }
      case 'circuit': this.circuitIdx = (this.circuitIdx + 1) % d.circuit.length; return P[d.circuit[this.circuitIdx]];
      case 'commuter': this.commuteIdx = 1 - this.commuteIdx; return P[d.between[this.commuteIdx]];
      case 'wanderer':
      default: {
        let p; do p = this.mgr.randomPlace(); while (p === this.place);
        return p;
      }
    }
  }

  update(dt, hour, playerPos) {
    const d = this.def;
    if (this.state === STATE.TALK) {
      this.speed = 0;
      const ty = Math.atan2(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
      this.yaw = lerpAngle(this.yaw, ty, 1 - Math.exp(-8 * dt));
    } else if (this.state === STATE.CHAT) {
      this.speed = 0;
      this.chatTimer -= dt;
      const o = this.chatWith;
      if (o) this.yaw = lerpAngle(this.yaw, Math.atan2(o.pos.x - this.pos.x, o.pos.z - this.pos.z), 1 - Math.exp(-6 * dt));
      if (this.chatTimer <= 0 || !o || o.state !== STATE.CHAT) this.endChat();
    } else if (d.pattern === 'patrol') {
      this._patrol(dt, playerPos);
    } else if (this.state === STATE.IDLE) {
      this.timer -= dt;
      this._loiter(dt);
      const routineMismatch = d.pattern === 'routine' && this.nextPlace(hour) !== this.place;
      if (this.timer <= 0 || routineMismatch) {
        const target = this.nextPlace(hour);
        if (target && target !== this.place) {
          this.route = pavement(applyLane(this.mgr.nav.route(this._asPlace(), target), this.lane));
          this.ri = 1; this.dest = target; this.state = STATE.WALK;
        } else this.timer = 5 + Math.random() * 5;
      }
    } else if (this.state === STATE.WALK) {
      const arrived = this._follow(dt, playerPos);
      if (arrived) {
        this.place = this.dest; this.state = STATE.IDLE;
        const [a, b] = d.dwell || [8, 16];
        this.timer = d.pattern === 'routine' ? 20 + Math.random() * 20 : a + Math.random() * (b - a);
        this.loiterTarget = null;
      }
    }
    animateCharacter(this.char, dt, this.speed);
    this._sync();
  }

  _asPlace() {
    // Start from the place we are loitering at (its spur leads back to the road).
    return { x: this.pos.x, z: this.pos.z, side: this.place.side };
  }

  _loiter(dt) {
    if (this.place.kind === 'post') {
      // Stand at a fixed post, turned towards a partner if one is beside us.
      this.speed = 0;
      // Most of the time they greet the plaza (facing visitors coming from the south); every so often they
      // turn to each other for a short chat, then go back to welcoming people.
      const p = this.def.partner && this.mgr.byId(this.def.partner);
      const t = performance.now() / 1000, chatting = p && Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) < 4 && (t % 50) < 9;
      const ty = chatting ? Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z) : 0.18 * Math.sign(this.place.x || 1) + Math.sin(t * 0.25 + this.place.x) * 0.35;
      this.yaw = lerpAngle(this.yaw, ty, 1 - Math.exp(-3 * dt));
      if (this.bubble && this.def.partner) this.bubble.visible = chatting && Math.sin(t * 1.3 + (this.place.x > 0 ? Math.PI : 0)) > 0;
      return;
    }
    if (!this.loiterTarget || Math.random() < dt * 0.08) {
      const r = this.place.loiter || 1.2;
      this.loiterTarget = Math.random() < 0.45 ? null : { x: this.place.x + (Math.random() - 0.5) * 2 * r, z: this.place.z + (Math.random() - 0.5) * 2 * r };
    }
    if (this.loiterTarget) {
      const reached = this._stepTowards(this.loiterTarget, dt, 0.7);
      if (reached) this.loiterTarget = null;
    } else this.speed = 0;
  }

  _patrol(dt, playerPos) {
    const nav = this.mgr.nav, pts = this.def.patrol;
    if (!this.route.length) {
      // Walk from spawn to the first patrol node, then loop.
      const n0 = nav.nodes[nav.nodeAt(...pts[0])];
      this.route = [{ x: this.pos.x, z: this.pos.z }, { x: n0.x, z: n0.z }];
      this.ri = 1; this.patrolIdx = 0;
    }
    if (this._follow(dt, playerPos)) {
      this.patrolIdx = (this.patrolIdx + 1) % pts.length;
      const n = nav.nodes[nav.nodeAt(...pts[this.patrolIdx])];
      this.route = applyLane([{ x: this.pos.x, z: this.pos.z }, { x: n.x, z: n.z }], this.lane * 0.8, true);
      this.ri = 1;
    }
  }

  /** Walk along this.route. Returns true when the last point is reached. */
  _follow(dt, playerPos) {
    const wp = this.route[this.ri];
    if (!wp) return true;
    // Courtesy stop: pause if the player stands right in front.
    const dxp = playerPos.x - this.pos.x, dzp = playerPos.z - this.pos.z;
    const fwd = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
    if (dxp * dxp + dzp * dzp < 1.6 && dxp * fwd.x + dzp * fwd.z > 0) { this.speed = 0; return false; }
    if (this._stepTowards(wp, dt, this.def.speed)) {
      this.ri++;
      if (this.ri >= this.route.length) return true;
    }
    return false;
  }

  _stepTowards(p, dt, speed) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.25) { this.speed = 0; return true; }
    const step = Math.min(d, speed * dt);
    this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step;
    this.mgr.separate(this);
    this.speed = step / dt;
    this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-9 * dt));
    return false;
  }

  _sync() {
    this.object.position.set(this.pos.x, 0, this.pos.z);
    this.object.rotation.y = this.yaw;
  }

  startChat(other, secs) { this.state = STATE.CHAT; this.chatWith = other; this.chatTimer = secs; if (this.bubble) this.bubble.visible = true; }
  endChat() { if (this.state === STATE.CHAT) { this.state = STATE.IDLE; this.timer = Math.max(this.timer, 3); } this.chatWith = null; this.chatCooldown = 25 + Math.random() * 30; if (this.bubble) this.bubble.visible = false; }

  startTalk() {
    if (this.state === STATE.CHAT) { const o = this.chatWith; this.endChat(); o?.endChat(); } this.prevState = this.state === STATE.TALK ? this.prevState : this.state; this.state = STATE.TALK; }
  endTalk() { this.state = this.prevState || STATE.IDLE; if (this.state === STATE.IDLE) this.timer = Math.max(this.timer, 2); }
}

/** Pull the road-side ends of a route's spurs back onto the pavement. */
function pavement(route) {
  if (!route || route.length < 4) return route;
  const pull = (i, toward) => {
    const a = route[i], b = route[toward], d = Math.hypot(b.x - a.x, b.z - a.z);
    if (d > CITY.walkOffset + 0.5) { a.x += (b.x - a.x) / d * CITY.walkOffset; a.z += (b.z - a.z) / d * CITY.walkOffset; }
  };
  pull(1, 0); pull(route.length - 2, route.length - 1);
  return route;
}

function bubbleTexture() {
  const c = document.createElement('canvas'); c.width = 96; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath(); g.roundRect(4, 4, 88, 42, 14); g.fill();
  g.beginPath(); g.moveTo(30, 44); g.lineTo(26, 60); g.lineTo(44, 44); g.fill();
  g.fillStyle = '#1c1f24'; for (const x of [28, 48, 68]) { g.beginPath(); g.arc(x, 25, 5, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function lerpAngle(a, b, t) { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * t; }

/** Offset interior route points sideways so NPCs keep to a lane instead of a single file. */
function applyLane(route, lane, all = false) {
  if (!route || route.length < 3 && !all) return route;
  const out = route.map((p) => ({ ...p }));
  const from = all ? 1 : 2, to = all ? out.length : out.length - 2;
  for (let i = from; i < to; i++) {
    const a = route[i - 1], b = route[Math.min(i + 1, route.length - 1)];
    let dx = b.x - a.x, dz = b.z - a.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    out[i].x += -dz * lane; out[i].z += dx * lane;
  }
  return out;
}

export class NPCManager {
  constructor(scene, nav, places, { castShadow, citizens, nameTagRange }) {
    this.scene = scene; this.nav = nav; this.places = places;
    this.placeList = Object.values(places);
    this.nameTagRange = nameTagRange;
    this.npcs = [];
    for (const def of KEY_NPCS) this.npcs.push(new NPC(def, this, { castShadow, keyNpc: true }));
    const bubbleMat = new THREE.SpriteMaterial({ map: bubbleTexture(), transparent: true, depthTest: true });
    for (const n of this.npcs) { const b = new THREE.Sprite(bubbleMat); b.scale.set(0.7, 0.5, 1); b.position.y = 2.95; b.visible = false; n.object.add(b); n.bubble = b; n.chatCooldown = 10 + Math.random() * 30; }
    this.pairTimer = 2;
    for (let i = 0; i < citizens; i++) {
      const look = { ...CITIZEN_LOOKS[i % CITIZEN_LOOKS.length], hairStyle: ['short', 'long', 'bob', 'bun'][i % 4] };
      const def = {
        id: `citizen-${i}`, name: 'Citizen', role: 'Resident', look, speed: 1.1 + Math.random() * 0.5,
        pattern: 'wanderer', dwell: [6, 20], spawn: this.randomPlace().id, line: CITIZEN_LINES[i % CITIZEN_LINES.length],
      };
      this.npcs.push(new NPC(def, this, { castShadow: false, keyNpc: false }));
    }
  }

  randomPlace() { return this.placeList[Math.floor(Math.random() * this.placeList.length)]; }

  separate(self) {
    for (const o of this.npcs) {
      if (o === self) continue;
      const dx = self.pos.x - o.pos.x, dz = self.pos.z - o.pos.z, d2 = dx * dx + dz * dz;
      if (d2 > 0.0001 && d2 < 0.64) { const d = Math.sqrt(d2), p = (0.8 - d) * 0.5; self.pos.x += (dx / d) * p; self.pos.z += (dz / d) * p; }
    }
  }

  update(dt, hour, playerPos, camera, cullRange = 200) {
    this.pairTimer -= dt;
    if (this.pairTimer <= 0) { this.pairTimer = 1.5; this._pairChats(); }
    const tags = this._tags || (this._tags = []); tags.length = 0;
    for (const n of this.npcs) {
      n.chatCooldown -= dt;
      n.update(dt, hour, playerPos);
      n.object.visible = !n.onDuty && Math.hypot(n.pos.x - camera.position.x, n.pos.z - camera.position.z) < cullRange;
      if (n.label) {
        const d = Math.hypot(n.pos.x - playerPos.x, n.pos.z - playerPos.z);
        n.label.visible = n.object.visible && d < this.nameTagRange;
        if (n.label.visible) { n._tagD = d; tags.push(n); }
      }
    }
    // Never let name tags overlap on screen: the nearer person keeps theirs, the farther one hides it.
    if (tags.length > 1) {
      tags.sort((a, b) => a._tagD - b._tagD);
      const v = this._v || (this._v = new THREE.Vector3()), shown = [];
      for (const n of tags) {
        v.set(n.pos.x, 2.45 + (n.object.position.y || 0), n.pos.z).project(camera);
        const w = 0.16 * (12 / Math.max(4, n._tagD)), h = w * 0.3;
        if (shown.some((s) => Math.abs(s.x - v.x) < (s.w + w) / 2 && Math.abs(s.y - v.y) < (s.h + h) / 2)) { n.label.visible = false; continue; }
        shown.push({ x: v.x, y: v.y, w, h });
      }
    }
  }

  byId(id) { return this.npcs.find((n) => n.def.id === id); }

  /** NPCs standing idle near each other strike up a conversation now and then. */
  _pairChats() {
    const idle = this.npcs.filter((n) => n.state === STATE.IDLE && n.chatCooldown <= 0 && n.def.pattern !== 'patrol');
    for (let i = 0; i < idle.length; i++) for (let j = i + 1; j < idle.length; j++) {
      const a = idle[i], b = idle[j];
      if (a.state !== STATE.IDLE || b.state !== STATE.IDLE) continue;
      if (Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) > 4.5) continue;
      const secs = 8 + Math.random() * 8;
      a.startChat(b, secs); b.startChat(a, secs);
    }
  }
}
