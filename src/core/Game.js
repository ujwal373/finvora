import * as THREE from 'three';
import { CITY, CLOCK, GRAPHICS_PRESETS, INTERACT, PLAYER, SAVE, formatINR } from '../config.js';
import { CollisionWorld } from '../world/Collision.js';
import { buildCity, drawTicker } from '../world/City.js';
import { buildPlaces, spurSegments } from '../world/Places.js';
import { NavGraph } from '../npc/NavGraph.js';
import { NPCManager } from '../npc/NPCManager.js';
import { Player } from '../entities/Player.js';
import { PlayerCar } from '../entities/PlayerCar.js';
import { CameraRig } from './CameraRig.js';
import { Input } from './Input.js';
import { Finance } from '../sim/Finance.js';
import { Traffic, SEATS } from '../world/Traffic.js';
import { GPS } from '../world/GPS.js';
import { buildAgentTree } from '../data/agentTrees.js';
import { KEY_NPCS, npcById } from '../data/npcs.js';
import { get as storeGet, set as storeSet } from '../services/storage.js';
import { HUD } from '../ui/HUD.js';
import { DialogueView } from '../ui/DialogueView.js';
import { Panels } from '../ui/Panels.js';
import { el, esc } from '../ui/dom.js';
import { DIALOGUES } from '../data/dialogues.js';
import { doorPoint, buildingById } from '../data/buildings.js';
import { SaveService } from '../services/SaveService.js';
import { openPhone } from '../ui/Phone.js';
import { carById, clothById } from '../data/shop.js';
import { DEFAULT_LOOK } from '../entities/Player.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Interior } from '../world/Interiors.js';
import { AGENT_COUNTER, onDuty, INTERIORS } from '../data/interiors.js';
import { Ride, lanePath, pathLength, realKm, FARES } from '../world/Rides.js';
import { BUS_STOPS, BUILDINGS, METRO_STATIONS, metroFare } from '../data/buildings.js';
import { vehicleMesh } from '../world/Traffic.js';

export const STATE_VERSION = 1;

const SCAM_TEXTS = [
  { sender: '+91 98XXX 11223', text: 'Your FinVora Bank KYC expires TODAY. Update now or your account is blocked: fv-kyc-update.link', why: 'Urgency plus a link from an unknown number. Banks never ask you to update KYC through a text link.' },
  { sender: 'VIP-STOCKS', text: 'Congratulations! Join our premium group for 5% guaranteed profit every week. Only 3 seats left.', why: 'Guaranteed profits and fake scarcity. No legitimate investment guarantees returns.' },
  { sender: 'CashBack-UPI', text: 'You have won ₹2,000 cashback! Enter your UPI PIN in the request to receive it.', why: 'A UPI PIN is only ever used to pay. You never enter it to receive money.' },
  { sender: '+91 70XXX 44551', text: 'Instant loan ₹50,000 approved! Pay ₹999 processing fee to release funds.', why: 'Fees before a loan is paid out are a classic fake lending app trick.' },
  { sender: 'Electricity Dept', text: 'Your power will be cut tonight at 9:30 pm due to unpaid bill. Call this officer immediately.', why: 'Fake bill threats push you to call scammers who then ask for remote access or payment.' },
];

export function defaultState(touch) {
  return {
    v: STATE_VERSION,
    player: { x: PLAYER.spawn.x, z: PLAYER.spawn.z, yaw: PLAYER.spawn.rot },
    clockHour: CLOCK.startHour,
    settings: { graphics: touch ? 'low' : 'medium', sensitivity: 1, invertY: false, showFps: false, autoTime: true },
    journal: [],
    visited: [],
    talkedTo: [],
    tutorial: { done: false, step: 0 },
    welcomed: false,
    avatar: { skin: DEFAULT_LOOK.skin, hair: DEFAULT_LOOK.hair, hairStyle: 'short', body: 'm', build: 'average', height: 1, facial: 'none', equipped: {} },
    activeCar: 'CAR0',
    messages: [],
  };
}

/** Merge a saved state over defaults so older saves gain new fields without losing data. */
export function migrateState(saved, touch) {
  const d = defaultState(touch);
  if (!saved || typeof saved !== 'object') return d;
  return {
    ...d, ...saved,
    player: { ...d.player, ...(saved.player || {}) },
    settings: { ...d.settings, ...(saved.settings || {}) },
    tutorial: { ...d.tutorial, ...(saved.tutorial || {}) },
    journal: Array.isArray(saved.journal) ? saved.journal : [],
    visited: Array.isArray(saved.visited) ? saved.visited : [],
    talkedTo: Array.isArray(saved.talkedTo) ? saved.talkedTo : [],
    avatar: { ...d.avatar, ...(saved.avatar || {}), equipped: { ...((saved.avatar && saved.avatar.equipped) || {}) } },
    messages: Array.isArray(saved.messages) ? saved.messages.slice(-60) : [],
    v: STATE_VERSION,
  };
}

export class Game {
  constructor({ canvas, hudRoot, overlayRoot, profile, supabase, onLogout, onRename, onPasswordReset }) {
    this.canvas = canvas; this.hudRoot = hudRoot; this.overlayRoot = overlayRoot;
    this.profile = profile;
    this.callbacks = { onLogout, onRename, onPasswordReset };
    this.input = new Input(canvas, hudRoot);
    this.input.onLockChange = () => this._lockHint();
    this.save = new SaveService({
      supabase, profile,
      onStatus: (s) => this.hud?.setSave(s),
      onConflict: (info) => this._onConflict(info),
    });
    this.waypoint = null;
    this.clock = { t: 0 };
  }

  async start() {
    let saved = null;
    try { saved = await this.save.load(); }
    catch (e) { console.error(e); this.saveLoadError = e; }
    this.state = migrateState(saved, this.input.touch);
    this.finKey = `finworld:finance:${this.profile.id}`;
    let finSaved = null;
    try { finSaved = await storeGet(this.finKey); } catch (e) { console.warn(e); }
    try { this.fin = new Finance(finSaved || undefined); } catch (e) { console.error('Finance save unreadable, starting fresh', e); this.fin = new Finance(); }
    this.simTimer = 0;
    this.preset = GRAPHICS_PRESETS[this.state.settings.graphics] || GRAPHICS_PRESETS.medium;
    this._initRenderer();
    this._initWorld();
    this._initUI();
    this._applySettings(this.state.settings, true);
    this._bindLifecycle();
    this.last = performance.now();
    this.fpsAcc = { t: 0, n: 0, fps: 60, low: 0, high: 0 };
    try { this.renderer.compile(this.scene, this.camera); } catch { /* optional warm-up */ }
    this.renderer.setAnimationLoop(() => this._frame());
    if (this.saveLoadError) this.hud.toast('Could not load cloud save. Playing from defaults; nothing will overwrite your cloud data until it reconnects.', { ms: 6000 });
    if (!this.state.welcomed) {
      this.input.enabled = false;
      this.panels.welcome(this.profile, () => {
        this.state.welcomed = true; this.input.enabled = true;
        this._persist({ immediate: true });
        this._renderTutorial();
      });
    } else {
      this._renderTutorial();
      this.hud.toast(`Welcome back, ${this.profile.fullName.split(' ')[0]}.`, { gold: true });
    }
  }

  // ---------------------------------------------------------------- setup
  _initRenderer() {
    const p = this.preset;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: p.antialias, powerPreference: 'high-performance', stencil: false });
    } catch (e) {
      throw new Error('WebGL is not available on this device or browser. FinVora needs WebGL to draw the 3D city.');
    }
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.type = p.antialias ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.maxPR = Math.min(window.devicePixelRatio || 1, p.maxPixelRatio);
    this.pixelRatio = this.maxPR * p.pixelScale;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, p.fogFar + 40); // nothing past the fog is drawn
    this._resize();
    window.addEventListener('resize', () => this._resize());

    this.hemi = new THREE.HemisphereLight(0xdfefff, 0x4a4030, 1);
    this.sun = new THREE.DirectionalLight(0xfff2dc, 1.5);
    this.sun.shadow.camera.left = -45; this.sun.shadow.camera.right = 45;
    this.sun.shadow.camera.top = 45; this.sun.shadow.camera.bottom = -45;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 160;
    this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog(0x9fc4e0, 60, p.fogFar);
    // Image-based lighting: gives glass, car paint, metal and polished floors real reflections.
    try { const pm = new THREE.PMREMGenerator(this.renderer); this.envMap = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); this.scene.environment = this.envMap; this.scene.environmentIntensity = 0.55; } catch { this.envMap = null; }
    this.scene.background = new THREE.Color(0x9fc4e0);
  }

  _initWorld() {
    this.collision = new CollisionWorld(CITY.bound);
    this.nav = new NavGraph(CITY.roadXs, CITY.roadZs);
    this.places = buildPlaces();
    this.market = this.fin.market;
    const spurs = spurSegments(this.places, this.nav);
    this.city = buildCity(this.scene, this.collision, { preset: this.preset, spurs, market: this.market });
    this.traffic = new Traffic(this.scene, this.nav, this.preset.cars, { castShadow: this.preset.shadows });

    this.player = new Player(this.scene, this.collision, { castShadow: this.preset.shadows, look: this.computeLook() });
    const sp = this.state.player;
    this.player.place(sp.x, sp.z, sp.yaw);
    const owned = this.fin.garage.find((c) => c.id === this.state.activeCar) || this.fin.garage[0];
    this.state.activeCar = owned.id;
    this.car = new PlayerCar(this.scene, this.collision, { castShadow: this.preset.shadows, saved: this.state.vehicle, model: owned.catalogId, color: owned.color });
    this.driving = false;
    this.cam = new CameraRig(this.camera, this.collision);
    this.cam.snapBehind(this.player.yaw);
    this.npcs = new NPCManager(this.scene, this.nav, this.places, { castShadow: this.preset.shadows, citizens: this.preset.citizens, nameTagRange: this.preset.nameTagRange });

    this.gps = new GPS(this.scene, this.nav);
    this.interiors = {}; this.inside = null; this.ride = null;
    // Waypoint beacon
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xf0c868, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.beacon.visible = false;
    this.scene.add(this.beacon);
  }

  _initUI() {
    this.hud = new HUD(this.hudRoot, { profile: this.profile, onMenu: () => this.openMenu(), onMap: () => this.openMap(), onPortfolio: () => this.openPortfolio(), onPhone: () => this.openPhone() });
    this._lastLedgerSeen = this.fin.ledger.length ? this.fin.ledger[this.fin.ledger.length - 1].id : 0;
    this.fin.on((e) => { if (e.type === 'advance') this._phoneMessages(e.news); });
    this.updatePhoneBadge();
    this._walletHud();
    this.dialogue = new DialogueView(this.overlayRoot);
    this.panels = new Panels(this.overlayRoot);
    this._lockHint();
    this.hud.setSave(this.profile.mode === 'cloud' ? (navigator.onLine ? 'saved' : 'offline') : 'local');
  }

  _bindLifecycle() {
    const leave = () => { this._captureState(); this.save.schedule(this.state, { immediate: true }); this._saveFinance(true); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); });
    window.addEventListener('pagehide', leave);
    this.periodic = setInterval(() => { this._captureState(); this.save.schedule(this.state); }, SAVE.periodicMs);
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 70 : 60; // wider view in portrait phones
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- settings
  /** Returns true if some change needs a reload to take full effect. */
  _applySettings(patch, initial = false) {
    const s = Object.assign(this.state.settings, patch);
    this.input.sensitivity = s.sensitivity;
    this.cam.invertY = s.invertY;
    let reload = false;
    if (patch.graphics && !initial) {
      const old = this.preset, p = GRAPHICS_PRESETS[patch.graphics];
      this.preset = p;
      this.maxPR = Math.min(window.devicePixelRatio || 1, p.maxPixelRatio);
      this.pixelRatio = this.maxPR * p.pixelScale;
      this.renderer.setPixelRatio(this.pixelRatio); this._resize();
      this.scene.fog.far = p.fogFar; this.camera.far = p.fogFar + 40; this.camera.updateProjectionMatrix();
      reload = old.citizens !== p.citizens || old.antialias !== p.antialias || old.treeDensity !== p.treeDensity;
    }
    const p = this.preset;
    this.renderer.shadowMap.enabled = p.shadows;
    this.sun.castShadow = p.shadows;
    if (p.shadows) { this.sun.shadow.mapSize.set(p.shadowMap, p.shadowMap); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    this.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true)); });
    this.npcs.nameTagRange = p.nameTagRange;
    if (!initial) this._persist();
    return reload;
  }

  // ---------------------------------------------------------------- persistence
  _captureState() {
    if (!this.player) return;
    this.state.player = { x: round(this.player.pos.x), z: round(this.player.pos.z), yaw: round(this.player.yaw) };
    this.state.clockHour = round(this.hour);
    this.clock.t = 0;
    if (this.car) this.state.vehicle = this.car.serialize();
  }

  _persist(opts) { this._captureState(); this.save.schedule(this.state, opts); }

  _onConflict(info) {
    this.hud?.toast('Newer progress was found on another device, so this session now follows the cloud copy. Your local copy was kept as a backup.', { ms: 7000 });
    if (info.cloudState && this.player) {
      this.state = migrateState(info.cloudState, this.input.touch);
      this.player.place(this.state.player.x, this.state.player.z, this.state.player.yaw);
    }
  }

  // ---------------------------------------------------------------- menus
  get overlayOpen() { return this.dialogue.open || this.panels.open; }

  _setOverlay(open) {
    this.input.enabled = !open;
    this.input.setTouchVisible(!open);
    if (open) this.input.unlock();
    this._lockHint();
  }

  /** Desktop hint: how to capture / release the mouse. */
  _lockHint() {
    if (this.input.touch || !this.hud) return;
    const show = !this.input.locked && !this.overlayOpen;
    if (!this._hintEl) { this._hintEl = el('<div class="glass lock-hint">Click the game to look around with your mouse · Esc frees the cursor</div>'); this.hudRoot.appendChild(this._hintEl); }
    this._hintEl.classList.toggle('hidden', !show);
  }

  openMenu(tab = 'settings') {
    if (this.dialogue.open) this.dialogue.close();
    this._setOverlay(true);
    this.panels.menu({
      settings: this.state.settings, journal: this.state.journal, profile: this.profile,
      onSettings: (patch) => this._applySettings(patch),
      onReload: async () => { this._captureState(); await this.save.schedule(this.state, { immediate: true }); location.reload(); },
      onLogout: async () => { this._captureState(); await this.save.schedule(this.state, { immediate: true }); this.callbacks.onLogout(); },
      onRename: async (name) => { await this.callbacks.onRename(name); this.profile.fullName = name.trim(); },
      onPasswordReset: () => this.callbacks.onPasswordReset(this.profile.email),
      onClose: () => this._setOverlay(false),
    }, tab);
  }

  openMap() {
    if (this.overlayOpen) return;
    this._setOverlay(true);
    this.panels.map({
      player: this.player, npcs: this.npcs.npcs, waypoint: this.waypoint, route: this.waypoint ? this.gps.route : null,
      onSetWaypoint: (b) => { const d = doorPoint(b); this.waypoint = { id: b.id, name: b.name, x: d.x, z: d.z, side: b.door }; this.hud.toast(`Waypoint set: ${b.name}`); },
    });
    this.panels.current.onClose = () => this._setOverlay(false);
  }

  // ---------------------------------------------------------------- interaction
  _findTarget() {
    const p = this.player.pos, f = this.player.forward();
    if (this.ride) return null;
    if (this.inside) {
      const s = this.inside.nearest(p);
      return s ? { kind: 'spot', spot: s, label: s.label, sub: s.sub } : null;
    }
    if (this.driving) return { kind: 'exit-car', label: 'Get out of the car', sub: this.car.kmh > 7 ? 'slow down first' : '' };
    let best = null, bestScore = Infinity;
    const dc = Math.hypot(this.car.pos.x - p.x, this.car.pos.z - p.z);
    if (dc < 3.4) { best = { kind: 'car', label: 'Drive your car', sub: 'FinVora coupe' }; bestScore = dc - 0.5; }
    for (const n of this.npcs.npcs) {
      if (n.onDuty) continue; // working at their counter inside
      const dx = n.pos.x - p.x, dz = n.pos.z - p.z, d = Math.hypot(dx, dz);
      if (d > INTERACT.npcRange) continue;
      const facing = (dx * f.x + dz * f.z) / (d || 1);
      const score = d - facing * 0.8 - (n.keyNpc ? 0.6 : 0);
      if (score < bestScore) { bestScore = score; best = { kind: 'npc', npc: n, label: n.keyNpc ? `Talk to ${n.def.name}` : 'Say hello', sub: n.keyNpc ? n.def.role : 'Resident' }; }
    }
    for (const d of this.city.doors) {
      const dist = Math.hypot(d.x - p.x, d.z - p.z);
      if (dist > INTERACT.doorRange) continue;
      const score = dist < 1.6 ? dist - 1.5 : dist + 0.3; // standing on the door ring always means "enter"
      if (d.type === 'bus') { if (score < bestScore) { bestScore = score; best = { kind: 'bus', door: d, label: 'Take the city bus', sub: `${d.stop.name} stop · ₹10 to ₹30` }; } continue; }
      if (d.type === 'metro') { if (score < bestScore) { bestScore = score; best = { kind: 'metro', door: d, label: 'Take the FinVora Metro', sub: `${d.station.name} station · ₹20 to ₹40` }; } continue; }
      if (score < bestScore) { bestScore = score; best = { kind: 'door', door: d, label: d.building.interior === 'home' ? 'Go inside your home' : `Enter ${d.building.name}`, sub: d.building.interior ? 'Walk in' : 'Open now' }; }
    }
    return best;
  }

  _interact(t) {
    this._tutorialEvent('interact');
    if (t.kind === 'car') return this._enterCar();
    if (t.kind === 'exit-car') return this._exitCar();
    if (t.kind === 'spot') return this._spot(t.spot);
    if (t.kind === 'bus') return this.openBusMenu(t.door.stop);
    if (t.kind === 'metro') return this.openMetroMenu(t.door.station);
    if (t.kind === 'npc') {
      const n = t.npc;
      if (!n.keyNpc) { this.hud.toast(`Resident: “${n.def.line}”`, { ms: 4500 }); return; }
      n.startTalk();
      this.player.faceTowards(n.pos.x, n.pos.z);
      if (!this.state.talkedTo.includes(n.def.id)) this.state.talkedTo.push(n.def.id);
      const tree = n.def.dialogue ? DIALOGUES[n.def.dialogue] : buildAgentTree(n.def.id);
      this._openDialogue(tree, { name: n.def.name, role: n.def.hasName ? n.def.role : 'FinVora helper', color: n.def.look.shirt }, () => n.endTalk(), n.def.id);
    } else {
      const b = t.door.building;
      if (!this.state.visited.includes(b.id)) { this.state.visited.push(b.id); this._persist(); }
      if (this.waypoint?.id === b.id) this.waypoint = null;
      if (b.interior) this.enterInterior(b.interior); else this.openBuilding(b);
    }
  }

  _enterCar() {
    this.driving = true; this.car.occupied = true;
    this.player.seatIn(this.car.mesh, SEATS[this.car.rider] || SEATS.car);
    this.cam.targetDistance = 10; this.cam.pitch = 0.32; this.cam.snapBehind(this.car.heading);
    this.input.setDriving(true);
    if (!this.state.droveOnce) { this.state.droveOnce = true; this.hud.toast(this.input.touch ? 'Joystick up to drive, sideways to steer, BRAKE to stop, EXIT to get out.' : 'W/S to drive and reverse, A/D to steer, Space to brake, E to get out.', { gold: true, ms: 6000 }); }
  }

  _exitCar() {
    if (this.car.kmh > 7) { this.hud.toast('Slow down before getting out.'); return; }
    this.car.speed = 0;
    this.driving = false; this.car.occupied = false;
    const p = this.car.exitPoint();
    this.player.standUp();
    this.player.place(p.x, p.z, this.car.heading);
    this.cam.targetDistance = 7.5;
    this.input.setDriving(false);
    this.hud.setSpeed(null);
    this._persist();
  }

  openBuilding(b, startTab = 0) {
    this._setOverlay(true);
    this.panels.building(b, {
      svcCtx: this._svcCtx(),
      startTab,
      helpers: b.counter ? (b.staffId ? [npcById[b.staffId]] : []) : KEY_NPCS.filter((h) => h.office === b.id),
      onFindHelper: (id) => (b.counter ? this.talkTo(id) : this._findNpc(id)),
      onTalkDesk: (bb) => { const tree = DIALOGUES[bb.desk]; this._openDialogue(tree, tree.speaker, null); },
      onClose: () => { if (!this.dialogue.open) this._setOverlay(false); },
    });
  }

  // ---------------------------------------------------------------- interiors
  enterInterior(key) {
    if (this.driving || this.ride) return;
    const it = (this.interiors[key] ||= new Interior(key, { environment: this.envMap, market: this.market }));
    this.inside = it;
    if (key === 'home') {
      const c = this.fin.garage.find((x) => x.id === this.state.activeCar) || this.fin.garage[0];
      it.setGarageVehicle(vehicleMesh(carById[c.catalogId].model, c.color).mesh);
    }
    this.player.scene = it.scene; it.scene.add(this.player.object);
    this.player.collision = it.collision; this.cam.collision = it.collision;
    this._camDist = this.cam.targetDistance;
    this.player.place(it.spawn.x, it.spawn.z, it.spawn.yaw);
    this.cam.targetDistance = 4.4; this.cam.pitch = 0.2; this.cam.snapBehind(it.spawn.yaw);
    this.hud.setInside(it.def.title);
    this.hud.setSpeed(null);
    if (key === 'home') this.hud.toast('Welcome home. Laptop, wardrobe, bed, TV and your garage are all here.', { gold: true, ms: 5000 });
    else this.hud.toast(`${it.def.title}. Walk to a counter and press ${this.input.touch ? 'TALK' : 'E'}. Agents serve 9 am to 6 pm; the desk team covers other hours.`, { gold: true, ms: 6000 });
    this._tutorialEvent('enter');
  }

  exitInterior() {
    const it = this.inside; if (!it) return;
    this.inside = null;
    this.player.scene = this.scene; this.scene.add(this.player.object);
    this.player.collision = this.collision; this.cam.collision = this.collision;
    const d = doorPoint(it.building, 2.4);
    this.player.place(d.x, d.z, d.face + Math.PI);
    this.cam.targetDistance = this._camDist || 7.5; this.cam.snapBehind(d.face + Math.PI);
    this.hud.setInside(null);
    this._persist();
  }

  _spot(s) {
    const it = this.inside;
    if (s.kind === 'exit') return this.exitInterior();
    if (s.kind === 'counter') {
      const c = s.counter, token = it.issueToken(c), who = it.serving(c, this.hour);
      const b = it.counterPanel(c, this.hour); b.staffId = who ? who.id : null;
      this.player.faceTowards(c.x - Math.sin(c.face) * 2, c.z - Math.cos(c.face) * 2);
      this.hud.toast(`Token ${token}: please go to counter ${c.number}. ${who ? `${who.name} will help you.` : 'The desk team will help you.'}`, { ms: 3500 });
      return this.openBuilding(b);
    }
    if (s.kind === 'reception') {
      const lines = it.def.counters.map((c, i) => `${i + 1}. ${c.name}`).join(' · ');
      return this.hud.toast(`Reception: ${lines}`, { ms: 9000 });
    }
    switch (s.action) {
      case 'laptop': return this.openPortfolio();
      case 'wardrobe': return this.openPhone('avatar');
      case 'tv': return this.openBuilding({ id: 'tv', name: 'FinVora Business · Live', blurb: 'Simulated market news and prices on your TV.', services: ['market-board', 'results'] });
      case 'fridge': return this.hud.toast('A cold mango lassi. Cooking at home is one of the easiest ways to save money.');
      case 'bed': {
        this.state.clockHour = 7; this.clock.t = 0; this._advanceSim(1);
        return this.hud.toast(`Good morning! It is 7:00 am on ${this.fin.date}.`, { gold: true });
      }
      case 'garage': {
        const gpos = this.city.homeGarage; this.exitInterior();
        this._parkCarAt(gpos.x, gpos.z, gpos.yaw); this._enterCar(); return undefined;
      }
      case 'bell': return this.hud.toast(this.fin.marketOpen() ? 'Ding! The market is open (9:15 am to 3:30 pm).' : 'Ding! The market is closed now. It opens at 9:15 am on weekdays.', { gold: true });
      case 'board': return this.openBuilding({ id: 'board', name: 'FinVora Stock Exchange · Market board', blurb: 'Live simulated prices for every listed company and ETF.', services: ['market-board'] });
      default: return undefined;
    }
  }

  talkTo(id) {
    const def = npcById[id]; if (!def) return;
    const tree = def.dialogue ? DIALOGUES[def.dialogue] : buildAgentTree(def.id);
    this._openDialogue(tree, { name: def.name, role: def.hasName ? def.role : 'FinVora helper', color: def.look.shirt }, null, def.id);
  }

  // ---------------------------------------------------------------- bus and rickshaw rides
  openBusMenu(stop) {
    const i0 = BUS_STOPS.findIndex((s) => s.id === stop.id), n = BUS_STOPS.length;
    const options = BUS_STOPS.map((s, i) => ({ s, stops: (i - i0 + n) % n })).filter((o) => o.stops > 0)
      .map((o) => ({ value: o.s.id, label: o.s.name, sub: `${o.stops} stop${o.stops > 1 ? 's' : ''} · fare ₹${FARES.bus(o.stops)}` }));
    this._setOverlay(true);
    this.panels.choice({ title: `Bus stop: ${stop.name}`, sub: 'FinVora City Bus loops through 7 stops. Pay by UPI, card or cash from your wallet (fares are illustrative).', options,
      onPick: (id) => this.startBus(stop, BUS_STOPS.find((s) => s.id === id)), onClose: () => this._setOverlay(false) });
  }

  // ---------------------------------------------------------------- FinVora Metro (fast travel between stations)
  openMetroMenu(st) {
    const i0 = METRO_STATIONS.findIndex((s) => s.id === st.id);
    const options = METRO_STATIONS.map((s, i) => ({ s, n: Math.abs(i - i0) })).filter((o) => o.n > 0)
      .map((o) => ({ value: o.s.id, label: o.s.name, sub: `${o.n} station${o.n > 1 ? 's' : ''} · token ₹${metroFare(o.n)} · about ${2 + o.n * 2} min` }));
    this._setOverlay(true);
    this.panels.choice({ title: `FinVora Metro · ${st.name}`, sub: 'Blue Line, every 4 minutes. Buy a token by UPI, card or from your wallet (fares are illustrative).', options,
      onPick: (id) => this.rideMetro(st, METRO_STATIONS.find((s) => s.id === id)), onClose: () => this._setOverlay(false) });
  }

  rideMetro(from, to) {
    const n = Math.abs(METRO_STATIONS.indexOf(to) - METRO_STATIONS.indexOf(from)), fare = metroFare(n);
    try { this.fin.travel(fare, `Metro token: ${from.name} to ${to.name}`); } catch (e) { this.hud.toast(e.message, { ms: 4500 }); return; }
    this._walletHud(); this._saveFinance();
    const dest = this.city.metro.find((m) => m.id === to.id).door;
    const fade = this._fade ||= (() => { const d = el('<div class="metro-fade"><div class="metro-fade-in"><div class="metro-roundel">M</div><div data-t></div></div></div>'); document.body.appendChild(d); return d; })();
    fade.querySelector('[data-t]').textContent = `Blue Line to ${to.name}…`;
    fade.classList.add('on');
    this._setOverlay(true);
    setTimeout(() => {
      this.player.place(dest.x + 1.2, dest.z, Math.PI / 2); this.cam.snapBehind(Math.PI / 2);
      this.state.clockHour = (this.state.clockHour + (2 + n * 2) / 60) % 24;
      setTimeout(() => { fade.classList.remove('on'); this._setOverlay(false); this.hud.toast(`${to.name}. Token ₹${fare} paid. Mind the gap!`, { gold: true }); this._persist(); }, 700);
    }, 1300);
  }

  startBus(from, to) {
    const i0 = BUS_STOPS.indexOf(from), i1 = BUS_STOPS.indexOf(to), stops = (i1 - i0 + BUS_STOPS.length) % BUS_STOPS.length;
    const fare = FARES.bus(stops);
    try { this.fin.travel(fare, `Bus ticket: ${from.name} to ${to.name}`); } catch (e) { this.hud.toast(e.message, { ms: 4500 }); return; }
    this._walletHud(); this._saveFinance();
    const path = lanePath(this.nav, { x: from.x, z: from.z }, { x: to.x, z: to.z });
    const dest = this.city.busStops.find((s) => s.id === to.id);
    this._startRide('bus', path, 9, () => { this.hud.toast(`${to.name}. Mind your step!`); return { x: dest.waitX, z: dest.waitZ }; });
    this.hud.toast(`Ticket ₹${fare} paid. Next stop: ${to.name}.`, { gold: true });
  }

  rideQuote(buildingId) {
    const b = buildingById[buildingId]; if (!b) return null;
    const d = doorPoint(b, 3);
    const path = lanePath(this.nav, this.player.pos, d);
    const km = realKm(pathLength(path));
    return { km: Math.round(km * 10) / 10, fare: FARES.auto(km), path, door: d, name: b.name };
  }

  startRickshaw(buildingId) {
    if (this.inside || this.driving || this.ride) { this.hud.toast(this.inside ? 'Step outside first to catch a rickshaw.' : 'Get out of your vehicle first.'); return; }
    const q = this.rideQuote(buildingId); if (!q || q.path.length < 2) { this.hud.toast('You are already there.'); return; }
    this.panels.close();
    this.hud.toast(`An auto-rickshaw pulls up. Meter on: about ₹${q.fare} to ${q.name}.`, { gold: true, ms: 4000 });
    this._startRide('auto', q.path, 8, () => {
      try { this.fin.travel(q.fare, `Auto-rickshaw to ${q.name} (${q.km} km)`, { force: true }); } catch { /* forced */ }
      this._walletHud(); this._saveFinance();
      this.hud.toast(`Arrived at ${q.name}. Meter fare ₹${q.fare} paid.`);
      return { x: q.door.x, z: q.door.z };
    });
  }

  _startRide(kind, path, speed, onArrive) {
    this.waypoint = null;
    this.ride = new Ride(this.scene, { kind, path, speed, onArrive: () => {
      const r = this.ride; const p = onArrive();
      this.player.standUp(); this.player.place(p.x, p.z, r.heading); this.cam.snapBehind(r.heading); this.cam.targetDistance = this._camDist || 7.5;
      r.dispose(this.scene); this.ride = null; this._persist();
    } });
    this._camDist = this.cam.targetDistance;
    this.player.seatIn(this.ride.mesh, this.ride.seat);
    this.cam.targetDistance = kind === 'bus' ? 14 : 8; this.cam.pitch = 0.3; this.cam.snapBehind(this.ride.heading);
  }

  _svcCtx() {
    return {
      fin: this.fin,
      wear: (wid) => this.wear(wid),
      activeCar: () => this.state.activeCar,
      useCar: (id) => {
        const isNew = !this.state.garageSeen?.includes(id);
        this.useCar(id);
        const show = buildingById['car-showroom'];
        if (isNew && show && this.panels.open) { const d = doorPoint(show, 4.5); this._parkCarAt(d.x, d.z + 6.5, Math.PI); }
        (this.state.garageSeen ||= []).push(id);
      },
      journal: () => this.state.journal,
      playerName: () => this.profile?.name || this.state.name,
      carNear: () => { const fs = this.city.fuelStation; return !!fs && Math.hypot(this.car.pos.x - fs.x, this.car.pos.z - fs.z) < 30; },
      changed: (msg) => { if (msg) this.hud.toast(msg); this._walletHud(); this._saveFinance(); },
      error: (msg) => this.hud.toast(msg, { ms: 4500 }),
    };
  }

  // ---------------------------------------------------------------- phone, avatar, garage
  openPhone(app = null) {
    if (this.overlayOpen) return;
    this._setOverlay(true);
    this._phoneCamYaw = null;
    openPhone(this.panels, this, app);
  }
  onPhoneClosed() { this._setOverlay(false); this._phoneCamYaw = null; }
  onPhoneApp(app) {
    this.panels.current?.back.classList.toggle('side', app === 'avatar');
    if (app === 'avatar') { this._phoneCamYaw = this.player.yaw; this.cam.targetDistance = 6; }
    else if (this._phoneCamYaw !== null) { this._phoneCamYaw = null; this.cam.targetDistance = this.driving ? 10 : 7.5; }
  }
  clockText() { const h = this.hour; return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; }
  goTo(buildingId) { const b = buildingById[buildingId]; if (!b) return; const d = doorPoint(b); this.waypoint = { id: b.id, name: b.name, x: d.x, z: d.z, side: b.door }; this.hud.toast(`Waypoint set: ${b.name}`); }
  findNpc(id) { this._findNpc(id); }
  callNpc(id) {
    const n = this.npcs.byId(id); if (!n) return;
    const tree = n.def.dialogue ? DIALOGUES[n.def.dialogue] : buildAgentTree(n.def.id);
    this._openDialogue(tree, { name: n.def.name, role: `${n.def.hasName ? n.def.role : 'FinVora helper'} · on call`, color: n.def.look.shirt }, null, n.def.id);
  }

  computeLook() {
    const a = this.state.avatar, eq = a.equipped || {}, look = { ...DEFAULT_LOOK, skin: a.skin, hair: a.hair, hairStyle: a.hairStyle, body: a.body || 'm', build: a.build || 'average', height: a.height || 1, facial: a.facial || 'none', accs: [] };
    const item = (slot) => { const w = this.fin?.wardrobe.find((x) => x.id === eq[slot]); return w ? { w, it: clothById[w.itemId] } : null; };
    const top = item('top');
    if (top) { look.top = top.it.style; if (top.it.outer) { look.outer = top.w.color; look.shirt = top.it.style === 'saree' ? top.w.color : 0xf2f2ee; } else look.shirt = top.w.color; if (top.it.style === 'suit') look.pants = top.w.color; }
    const bottom = item('bottom'); if (bottom && !(top && top.it.style === 'saree')) look.pants = bottom.w.color;
    const shoes = item('shoes'); if (shoes) look.shoes = shoes.w.color;
    for (const acc of ['cap', 'glasses', 'watch', 'bag']) { const x = item(acc); if (x) { look.accs.push(acc); if (acc === 'cap') look.cap = x.w.color; if (acc === 'bag') look.bag = x.w.color; } }
    return look;
  }
  applyAvatar() { this.player.setLook(this.computeLook()); this._persist(); }
  wear(wid, toggle = false) {
    const w = this.fin.wardrobe.find((x) => x.id === wid); if (!w) return;
    const it = clothById[w.itemId], slot = it.kind === 'acc' ? it.style : it.kind;
    const eq = this.state.avatar.equipped;
    if (toggle && eq[slot] === wid) delete eq[slot]; else eq[slot] = wid;
    this.applyAvatar();
  }
  useCar(id) {
    const c = this.fin.garage.find((x) => x.id === id); if (!c) return;
    this.state.activeCar = id;
    if (this.driving) this.player.standUp();
    this.car.setModel(c.catalogId, c.color);
    if (this.driving) this.player.seatIn(this.car.mesh, SEATS[this.car.rider] || SEATS.car);
    this._persist();
  }
  _parkCarAt(x, z, heading) { this.car.speed = 0; this.car.pos.x = x; this.car.pos.z = z; this.car.heading = heading; this.car._sync(); this._persist(); }
  summonCar() {
    if (this.driving) return;
    const f = this.player.forward();
    for (const [dx, dz] of [[f.x * 4, f.z * 4], [-f.z * 3.5, f.x * 3.5], [f.z * 3.5, -f.x * 3.5], [-f.x * 4, -f.z * 4]]) {
      const x = this.player.pos.x + dx, z = this.player.pos.z + dz;
      if (!this.collision.blocked(x, z, 1.4)) { this._parkCarAt(x, z, this.player.yaw); this.hud.toast(`${carById[this.car.catalogId].name} is here.`); return; }
    }
    this.hud.toast('No space to park here. Try somewhere more open.');
  }

  updatePhoneBadge() { this.hud?.setBadge(this.state.messages.filter((m) => !m.read).length); }
  _msg(from, text, extra = {}) {
    this.state.messages.push({ id: `M${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, from, text, date: this.fin.date, read: false, ...extra });
    if (this.state.messages.length > 60) this.state.messages.splice(0, this.state.messages.length - 60);
  }
  _phoneMessages(news = []) {
    const fresh = this.fin.ledger.filter((e) => e.id > this._lastLedgerSeen);
    if (fresh.length) this._lastLedgerSeen = fresh[fresh.length - 1].id;
    const groups = {};
    for (const e of fresh) (groups[e.type] ||= []).push(e);
    const say = (type, from, one, many) => { const g = groups[type]; if (g) this._msg(from, g.length === 1 ? one(g[0]) : many(g)); };
    say('sip', 'sip-coach', (e) => `Your SIP of ${formatINR(-e.amount)} into ${e.name} went through on ${e.date}.`, (g) => `${g.length} SIP instalments went through, ${formatINR(g.reduce((t, e) => t - e.amount, 0))} invested in total.`);
    say('sip-failed', 'sip-coach', () => 'A SIP instalment failed: not enough balance in your wallet.', (g) => `${g.length} SIP instalments failed for lack of balance.`);
    say('emi', 'loan-officer', (e) => `EMI of ${formatINR(-e.amount)} paid. ${e.note || ''}`, (g) => `${g.length} EMIs paid, ${formatINR(g.reduce((t, e) => t - e.amount, 0))} in total.`);
    say('emi-missed', 'loan-officer', () => 'You missed an EMI. Interest and a late fee were added. Top up your wallet!', (g) => `You missed ${g.length} EMIs. That hurts your credit score in real life.`);
    say('fd-mature', 'deposits-officer', (e) => `Your fixed deposit matured: ${formatINR(e.amount)} credited.`, (g) => `${g.length} FDs matured.`);
    say('rd-mature', 'deposits-officer', (e) => `Your recurring deposit matured: ${formatINR(e.amount)} credited.`, (g) => `${g.length} RDs matured.`);
    say('interest', 'deposits-officer', (e) => `Savings interest of ${formatINR(e.amount)} credited.`, (g) => `Savings interest credited ${g.length} times.`);
    say('scss-interest', 'savings-agent', (e) => `SCSS interest of ${formatINR(e.amount)} paid to your wallet.`, (g) => `${g.length} SCSS interest payouts received.`);
    say('ppf-interest', 'savings-agent', (e) => `${e.name}. ${e.note}`, (g) => `PPF interest credited ${g.length} times.`);
    say('nsc-mature', 'savings-agent', (e) => `Your NSC matured: ${formatINR(e.amount)} credited.`, (g) => `${g.length} NSCs matured.`);
    say('car-cost', 'budget-coach', (e) => `${e.name}: ${formatINR(-e.amount)}. Cars cost money every month.`, (g) => `Vehicle costs this period: ${formatINR(g.reduce((t, e) => t - e.amount, 0))} across ${g.length} bills.`);
    say('car-cost-missed', 'budget-coach', () => 'A vehicle bill could not be paid. Running costs do not stop when money runs out.', (g) => `${g.length} vehicle bills went unpaid.`);
    const big = news.filter((n) => n.kind === 'market' || Math.abs(n.move) >= 0.06);
    if (big.length) this._msg('reporter', `${big[big.length - 1].text} (${(big[big.length - 1].move * 100).toFixed(1)}%, simulated).${big.length > 1 ? ` Plus ${big.length - 1} more big ${big.length === 2 ? "story" : "stories"}.` : ''}`);
    // Now and then, a scam text to spot
    if (Math.random() < Math.min(0.5, (fresh.length ? 0.12 : 0.06) * Math.max(1, Math.log2(news.length + 2)))) {
      const s = SCAM_TEXTS[Math.floor(Math.random() * SCAM_TEXTS.length)];
      this._msg(null, s.text, { scam: true, sender: s.sender, why: s.why });
    }
    this.updatePhoneBadge();
  }
  scamAnswered(correct) {
    this.hud.toast(correct ? 'Scam reported. Nice catch!' : 'Ouch, that was a scam. Never open links in unexpected messages.', { gold: correct });
    if (correct && !this.state.journal.some((j) => j.id === 'scam-text')) this.state.journal.push({ id: 'scam-text', title: 'Spotting scam texts', summary: 'Unknown senders, urgency, links and requests for PIN or OTP are red flags. Report and delete; never click.', from: 'Your phone', at: new Date().toISOString() });
    this._persist();
  }

  openPortfolio() {
    if (this.overlayOpen) return;
    this._setOverlay(true);
    this.panels.portfolio({
      fin: this.fin,
      autoAdvance: () => this.state.settings.autoTime !== false,
      onToggleAuto: (v) => { this.state.settings.autoTime = v; this._persist(); },
      onAdvance: (days) => this._advanceSim(days),
      onClose: () => this._setOverlay(false),
    });
  }

  _advanceSim(days) {
    const news = this.fin.advance(days);
    this._lifeAlerts();
    drawTicker(this.city, this.market);
    this._walletHud();
    this._saveFinance();
    this._announce(news, days > 1);
  }

  /** Salary, bills, card statements, life events: toast the latest and file them in the phone's Messages. */
  _lifeAlerts() {
    const ev = this.fin.takeEvents();
    if (!ev.length) return;
    for (const e of ev.slice(-6)) this._msg(null, e.text);
    this.updatePhoneBadge();
    const top = ev.filter((e) => e.kind !== 'info').slice(-2);
    (top.length ? top : ev.slice(-1)).forEach((e, i) => setTimeout(() => this.hud.toast(e.text, { gold: e.kind === 'good', ms: 5500 }), i * 1800));
  }

  /** The Market Reporter announces notable simulated news. */
  _announce(news, summary = false) {
    const big = news.filter((n) => n.kind === 'market' || Math.abs(n.move) >= 0.06);
    if (!big.length) return;
    const rep = npcById.reporter.name;
    if (summary && big.length > 1) this.hud.toast(`${rep}: ${big.length} big stories while time skipped. Latest: ${big[big.length - 1].text} (simulated)`, { gold: true, ms: 6000 });
    else this.hud.toast(`${rep}: ${big[big.length - 1].text} (simulated)`, { gold: true, ms: 6000 });
    const r = this.npcs.byId('reporter'); if (r?.bubble) { r.bubble.visible = true; setTimeout(() => { if (r.state !== 'chat') r.bubble.visible = false; }, 6000); }
  }

  newsText() {
    const n = this.market.news.slice(-3).reverse();
    if (!n.length) return 'No big stories yet today. Markets are calm. Remember, every headline in FinVora is simulated.';
    return 'Latest simulated headlines: ' + n.map((x) => `${x.date}: ${x.text} (${x.move >= 0 ? '+' : ''}${(x.move * 100).toFixed(1)}%)`).join(' · ') + '. None of this is real news.';
  }

  _walletHud() {
    if (!this.hud || !this.fin) return;
    const s = this.fin.snapshot();
    this.hud.setWallet(this.fin.cash, s.netWorth, this.fin.date);
  }

  _saveFinance(now = false) {
    clearTimeout(this._finTimer);
    const write = () => storeSet(this.finKey, this.fin.serialize()).catch((e) => console.warn('finance save failed', e));
    if (now) write(); else this._finTimer = setTimeout(write, 1500);
  }

  _findNpc(id) {
    const n = this.npcs.byId(id);
    if (!n) return;
    this.dialogue.close();
    if (n.onDuty) {
      const ac = AGENT_COUNTER[id], b = buildingById[INTERIORS[ac.interior].building], d = doorPoint(b);
      this.waypoint = { id: b.id, name: b.name, x: d.x, z: d.z, side: b.door };
      this.hud.toast(`${n.def.name} is working at the ${ac.name} counter inside ${b.name}. Waypoint set.`);
      return;
    }
    this.waypoint = { id: `npc:${id}`, name: n.def.name, npc: n, x: n.pos.x, z: n.pos.z };
    this.hud.toast(`Following ${n.def.name}. Look for the gold beam.`);
  }

  _openDialogue(tree, speaker, onClose, agentId = null) {
    this._setOverlay(true);
    const h = this.hour;
    const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const names = Object.fromEntries(KEY_NPCS.map((n) => [n.id, n.name]));
    this.dialogue.show(tree, speaker, { firstName: this.profile.fullName.split(' ')[0], greeting, self: speaker.name, names, newsText: () => this.newsText() }, {
      agentId,
      onFind: (id) => this._findNpc(id),
      onService: (bid) => { const b = buildingById[bid]; if (!b) return; const d = doorPoint(b); this.waypoint = { id: b.id, name: b.name, x: d.x, z: d.z, side: b.door }; this.hud.toast(`Waypoint set: ${b.name}`); },
      onLearn: (l) => {
        if (this.state.journal.some((j) => j.id === l.id)) return false;
        this.state.journal.push({ id: l.id, title: l.title, summary: l.summary, from: speaker.name, at: new Date().toISOString() });
        this._persist();
        return true;
      },
      onClose: () => { onClose?.(); this._setOverlay(false); },
    });
  }

  // ---------------------------------------------------------------- tutorial
  _renderTutorial() {
    this.tutorialEl?.remove();
    const t = this.state.tutorial;
    if (t.done) return;
    const touch = this.input.touch;
    const steps = [
      touch ? 'Use the joystick on the left to walk around Compound Square.' : 'Walk with W A S D. Hold Shift to run.',
      touch ? 'Drag on the right side of the screen to look around.' : 'Drag with the mouse to look around. Scroll to zoom.',
      `Walk up to someone with a name tag, or a glowing doorway, and ${touch ? 'tap TALK' : 'press E'}. Tap your wallet any time for your portfolio.`,
    ];
    this.tutorialEl = el(`<div class="glass tutorial"><span class="step">${t.step + 1}/3</span><p>${esc(steps[t.step])}</p></div>`);
    this.hudRoot.appendChild(this.tutorialEl);
    this.tutorialAcc = 0;
  }

  _tutorialEvent(kind, amount = 0) {
    const t = this.state.tutorial;
    if (t.done) return;
    const advance = () => {
      t.step++;
      if (t.step >= 3) {
        t.done = true; this.tutorialEl?.remove();
        this.hud.toast('Tutorial complete. Every building is open. Open the map (M) to explore, and press P for your portfolio.', { gold: true, ms: 6000 });
        this._persist();
      } else this._renderTutorial();
    };
    if (t.step === 0 && kind === 'move') { this.tutorialAcc += amount; if (this.tutorialAcc > 5) advance(); }
    else if (t.step === 1 && kind === 'look') { this.tutorialAcc += amount; if (this.tutorialAcc > 1.2) advance(); }
    else if (t.step === 2 && kind === 'interact') advance();
  }

  // ---------------------------------------------------------------- loop
  get hour() { return (this.state.clockHour + this.clock.t / CLOCK.realSecondsPerGameHour) % 24; }

  _frame() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000); // up to 100 ms so slow devices still run in real time
    this.last = now;
    this.clock.t += dt;
    const elapsed = now / 1000;

    const inp = this.input.read();
    if (this.dialogue.open) this.dialogue.handle(inp.pressed);
    else if (this.panels.open) this.panels.handle(inp.pressed);
    else {
      if (inp.pressed.has('pause')) this.openMenu();
      else if (inp.pressed.has('map')) this.openMap();
      else if (inp.pressed.has('journal')) this.openMenu('journal');
      else if (inp.pressed.has('portfolio')) this.openPortfolio();
      else if (inp.pressed.has('phone')) this.openPhone();
      // Esc while the mouse is captured only releases it (the browser handles that); next Esc opens the menu.
    }

    const prevDist = this.player.distanceWalked;
    if (this.ride) {
      this.ride.update(dt);
      if (this.ride) {
        this.player.pos.x = this.ride.pos.x; this.player.pos.z = this.ride.pos.z; this.player.yaw = this.ride.heading;
        if (!inp.lookDX && !inp.lookDY) { let d = this.ride.heading + Math.PI - this.cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.cam.yaw += d * Math.min(1, dt * 2); }
        this.hud.setSpeed(this.ride.kmh);
      }
    } else if (this.driving) {
      for (let k = 0, n = Math.ceil(dt / 0.034), h = dt / n; k < n; k++) this.car.update(h, inp, { traffic: this.traffic, npcs: this.npcs.npcs });
      this.player.pos.x = this.car.pos.x; this.player.pos.z = this.car.pos.z; this.player.yaw = this.car.heading; this.player._sync();
      // Camera eases in behind the car while moving, unless the player is looking around.
      if (Math.abs(this.car.speed) > 2 && !inp.lookDX && !inp.lookDY) {
        let d = this.car.heading + Math.PI - this.cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        this.cam.yaw += d * Math.min(1, dt * 2.2);
      }
      // Fuel: the active vehicle burns fuel with distance; an empty tank limits it to a crawl.
      const lvl = this.fin.useFuel(this.state.activeCar, Math.abs(this.car.speed) * dt);
      this.car.outOfFuel = lvl <= 0;
      if (lvl < 0.12 && !this._fuelWarned) { this._fuelWarned = true; this.hud.toast(lvl <= 0 ? 'Out of fuel! Crawl to FinVora Fuels (marked on your map).' : 'Fuel is low. Head to FinVora Fuels near the west side of the centre.', { ms: 5000 }); }
      if (lvl > 0.3) this._fuelWarned = false;
      this.hud.setSpeed(this.car.kmh, lvl);
      this.cam.ignoreFoliage = true;
    } else {
      this.cam.ignoreFoliage = false;
      this.player.update(dt, inp, this.cam.yaw);
      if (!this.inside) {
        this.traffic.resolve(this.player.pos, PLAYER.radius);
        for (const c of this.car.circles()) { const dx = this.player.pos.x - c.x, dz = this.player.pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + PLAYER.radius; if (d < m && d > 1e-4) { this.player.pos.x += dx / d * (m - d); this.player.pos.z += dz / d * (m - d); } }
      }
      this.player._sync();
      if (!this.inside) this.car.update(dt, inp, { traffic: this.traffic, npcs: this.npcs.npcs });
    }
    this._tutorialEvent('move', this.player.distanceWalked - prevDist);
    this._tutorialEvent('look', Math.abs(inp.lookDX) + Math.abs(inp.lookDY));
    if (this._phoneCamYaw !== null && this._phoneCamYaw !== undefined) { let d = this._phoneCamYaw - this.cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.cam.yaw += d * Math.min(1, dt * 4); }
    this.cam.update(dt, inp, { x: this.player.pos.x, y: this.player.y, z: this.player.pos.z });
    const hourNow = this.hour, duty = onDuty(hourNow);
    this.fin.clockHour = hourNow;
    if (this.fin.amo?.length && this.fin.marketOpen()) {
      const res = this.fin.executeAMO();
      if (res.length) { this._walletHud(); this._saveFinance(); this.hud.toast(`Market open: ${res.filter((r) => r.ok).length} after-market order${res.length > 1 ? 's' : ''} executed${res.some((r) => !r.ok) ? `, ${res.filter((r) => !r.ok).length} rejected` : ''}.`, { gold: true }); }
    }
    for (const n of this.npcs.npcs) n.onDuty = n.keyNpc && duty && !!AGENT_COUNTER[n.def.id];
    if (this.inside) this.inside.update(dt, hourNow, elapsed);
    else {
      this.npcs.update(dt, hourNow, this.player.pos, this.camera, this.preset.cullRange);
      this._peds = this._peds || [];
      this._peds.length = 0; if (!this.driving && !this.ride) this._peds.push(this.player.pos);
      for (const n of this.npcs.npcs) if (!n.onDuty) this._peds.push(n.pos);
      this.traffic.update(dt, this._peds, this.camera.position, this.preset.cullRange, this.ride ? [this.car, this.ride] : [this.car]);
    }
    this.hud.myCar = this.car;

    // Interaction prompt
    const target = this.overlayOpen ? null : this._findTarget();
    this.target = target;
    this.hud.setPrompt(this.driving && this.input.touch ? null : target);
    this.input.setInteractLabel(target ? ({ door: 'ENTER', car: 'DRIVE', 'exit-car': 'EXIT', bus: 'BUS', metro: 'METRO', spot: target.spot?.kind === 'exit' ? 'EXIT' : 'USE' }[target.kind] || 'TALK') : '');
    if (target && inp.pressed.has('interact')) this._interact(target);

    // World animation
    this.city.clockHour = hourNow;
    for (const fn of this.city.animated) fn(dt, elapsed);
    if (!this.inside) this.city.updateSignals?.(dt, this.traffic.t || 0);
    if (this.state.settings.autoTime !== false) {
      this.simTimer += dt;
      if (this.simTimer > 20) { this.simTimer = 0; this._advanceSim(1); }
    }
    if (!this.inside) this._dayNight();

    // Waypoint
    if (this.waypoint?.npc) { this.waypoint.x = this.waypoint.npc.pos.x; this.waypoint.z = this.waypoint.npc.pos.z; }
    if (this.waypoint && !this.inside) {
      const d = Math.hypot(this.waypoint.x - this.player.pos.x, this.waypoint.z - this.player.pos.z);
      this.beacon.visible = true; this.beacon.position.set(this.waypoint.x, 30, this.waypoint.z);
      this.gps.update(dt, this.player.pos, this.waypoint, elapsed);
      const left = Math.max(d, this.gps.length());
      this.hud.setWaypoint(`${this.waypoint.name} · ${left >= 1000 ? (left / 1000).toFixed(1) + ' km' : Math.round(left) + ' m'}`);
      if (d < (this.waypoint.npc ? 2.5 : 3)) { this.hud.toast(this.waypoint.npc ? `You found ${this.waypoint.name}. Press ${this.input.touch ? 'TALK' : 'E'} to talk.` : `Arrived at ${this.waypoint.name}`); this.waypoint = null; }
    } else if (!this.inside) { this.beacon.visible = false; this.hud.setWaypoint(null); this.gps.clear(); }

    this.hud.setClock(this.hour);
    if (!this.inside) this.hud.drawMinimap(dt, this.player, this._visibleNpcs(), this.waypoint, this.traffic.cars, this.cam.yaw, this.waypoint ? this.gps.route : null);
    this.renderer.render(this.inside ? this.inside.scene : this.scene, this.camera);
    this._perf(dt);
  }

  _visibleNpcs() { const a = this._vn || (this._vn = []); a.length = 0; for (const n of this.npcs.npcs) if (!n.onDuty) a.push(n); return a; }

  _dayNight() {
    const h = this.hour;
    const ang = ((h - 6) / 12) * Math.PI;
    const sunY = Math.sin(ang);
    const day = THREE.MathUtils.clamp(sunY * 1.6 + 0.25, 0, 1);
    const dusk = THREE.MathUtils.clamp(1 - Math.abs(sunY) * 3.5, 0, 1) * (sunY > -0.3 ? 1 : 0);
    const sky = new THREE.Color(0x0b1424).lerp(new THREE.Color(0x9fc4e0), day).lerp(new THREE.Color(0xe39a5b), dusk * 0.45);
    this.scene.background.copy(sky); this.scene.fog.color.copy(sky);
    this.hemi.intensity = 0.35 + day * 0.75;
    this.sun.intensity = 0.15 + day * 1.45;
    this.sun.color.setHex(0xfff2dc).lerp(new THREE.Color(0xffb070), dusk * 0.6);
    const sx = Math.cos(ang) * 0.8, sy = Math.max(0.25, sunY), sz = 0.45;
    const p = this.player.pos;
    this.sun.position.set(p.x + sx * 70, sy * 70, p.z + sz * 70);
    this.sun.target.position.set(p.x, 0, p.z);
    const night = 1 - day;
    if (Math.abs((this._lastNight ?? -1) - night) > 0.01) {
      this._lastNight = night;
      for (const m of this.city.nightMats) m.emissiveIntensity = night * 0.85;
      this.city.lampMat.emissiveIntensity = night * 1.8;
    }
  }

  /** Adaptive resolution: drop render scale when FPS stays low, recover when there is headroom. */
  _perf(dt) {
    const a = this.fpsAcc;
    a.t += dt; a.n++;
    if (a.t < 1) return;
    a.fps = Math.round(a.n / a.t); a.t = 0; a.n = 0;
    this.hud.setFps(a.fps, this.state.settings.showFps);
    if (document.hidden) return;
    if (a.fps < 28) { a.low++; a.high = 0; } else if (a.fps > 55) { a.high++; a.low = 0; } else { a.low = a.high = 0; }
    const target = this.maxPR * this.preset.pixelScale;
    if (a.low >= 2 && this.pixelRatio > 0.55) {
      this.pixelRatio = Math.max(0.55, this.pixelRatio * 0.85); this.renderer.setPixelRatio(this.pixelRatio); this._resize(); a.low = 0;
      if (!this._perfWarned && this.state.settings.graphics !== 'low') { this._perfWarned = true; this.hud.toast('Lowering render resolution to keep things smooth. Try Low graphics in Settings.'); }
    } else if (a.high >= 4 && this.pixelRatio < target) {
      this.pixelRatio = Math.min(target, this.pixelRatio * 1.1); this.renderer.setPixelRatio(this.pixelRatio); this._resize(); a.high = 0;
    }
  }

  /** Debug/testing hook (used by automated playtests). */
  debugSnapshot() {
    return {
      player: { ...this.player.pos, yaw: this.player.yaw },
      hour: this.hour,
      target: this.target ? this.target.label : null,
      npcs: this.npcs.npcs.filter((n) => n.keyNpc).map((n) => ({ id: n.def.id, x: n.pos.x, z: n.pos.z, state: n.state })),
      cars: this.traffic.cars.map((c) => ({ x: c.pos.x, z: c.pos.z, speed: c.speed })),
      myCar: { ...this.car.serialize(), kmh: this.car.kmh, driving: this.driving },
      inside: this.inside ? this.inside.key : null, riding: this.ride ? this.ride.kind : null,
      cash: this.fin.cash, simDate: this.fin.date, ledger: this.fin.ledger.length,
      journal: this.state.journal.length,
      fps: this.fpsAcc.fps,
      pixelRatio: this.pixelRatio,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
  }
}

const round = (v) => Math.round(v * 100) / 100;
