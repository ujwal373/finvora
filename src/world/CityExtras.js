import * as THREE from 'three';
import { CITY } from '../config.js';
import { METRO_STATIONS, METRO_Z } from '../data/buildings.js';
import { signTexture } from '../utils/textures.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createCharacter } from '../entities/Character.js';
import { vehicleMesh } from './Traffic.js';
import { signalAt, isSignalised } from './Signals.js';

// Round 10 city: the mall, cinema, restaurant, hospital, school and gym exteriors, Central Park,
// the elevated FinVora Metro with running trains, traffic signals, billboards and street furniture.

const hex = (c) => '#' + new THREE.Color(c).getHexString();
const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const glow = (color, k = 0.35) => new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: k });
const signMat = (title, accent, sub, w, h) => new THREE.MeshBasicMaterial({ map: signTexture(title, accent, sub, w / h) });

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** Window-band facade (horizontal strips of glass between solid spandrels), tiled per floor. */
function bandTex(wall, glassCol, floors = 1) {
  const t = canvasTex(64, 64, (g) => {
    g.fillStyle = hex(wall); g.fillRect(0, 0, 64, 64);
    g.fillStyle = hex(glassCol); g.fillRect(0, 18, 64, 30);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 18, 64, 4);
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 0; x < 64; x += 16) g.fillRect(x, 18, 2, 30);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, floors); return t;
}
function brickTex() {
  const t = canvasTex(128, 128, (g) => {
    g.fillStyle = '#9c4a33'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 8) for (let x = (y / 8) % 2 ? -8 : 0; x < 128; x += 16) { g.fillStyle = `hsl(12, ${45 + ((x * 7 + y) % 15)}%, ${33 + ((x + y * 3) % 9)}%)`; g.fillRect(x + 1, y + 1, 14, 6); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ================================================================ building styles
// Each style builds in a local frame whose entrance faces +z (see `styled` in City.js): L.fw wide, L.fd deep.

export const EXTRA_STYLES = {
  mall({ L, b, city, shadows }) {
    const { fw, fd } = L, H = b.h;
    const clad = lam(0xe9e5dc), dark = lam(0x2b2f38), steel = lam(0xc9ccd1);
    const shop = new THREE.MeshLambertMaterial({ color: 0x24303c, emissive: 0xfff1d6, emissiveIntensity: 0.22 });
    city.nightMats.push(shop);
    // podium of shopfronts, solid upper floors with accent bands
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw, 6, fd), [shop, shop, dark, dark, shop, shop]), 0, 3, 0);
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw + 0.4, H - 6, fd + 0.4), clad), 0, 6 + (H - 6) / 2, 0);
    for (const y of [7.2, 11.5, 15.2]) L.add(new THREE.Mesh(new THREE.BoxGeometry(fw + 0.6, 0.35, fd + 0.6), glow(b.accent, 0.25)), 0, y, 0);
    for (let i = -3; i <= 3; i++) L.add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 6, 0.25), dark), i * (fw / 7), 3, fd / 2 + 0.05);
    // glass atrium cube on the entrance side
    const atrium = new THREE.MeshStandardMaterial({ color: 0x8fb4c8, transparent: true, opacity: 0.6, roughness: 0.05, metalness: 0.4 });
    L.add(new THREE.Mesh(new THREE.BoxGeometry(13, H + 3, 3), atrium), 0, (H + 3) / 2, fd / 2 - 1);
    for (const x of [-6.5, 0, 6.5]) L.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, H + 3, 0.3), steel), x, (H + 3) / 2, fd / 2 + 0.55);
    for (let y = 4; y < H + 3; y += 4) L.add(new THREE.Mesh(new THREE.BoxGeometry(13, 0.2, 0.2), steel), 0, y, fd / 2 + 0.55);
    L.add(new THREE.Mesh(new THREE.PlaneGeometry(12, 2.2), signMat('CENTRAL MALL', b.accent, 'FINVORA · SHOPS · FOOD COURT · ATM', 12, 2.2)), 0, H + 0.6, fd / 2 + 0.75);
    // brand boards along the podium
    [['TECHNOVA', 0x5aa9e6], ['URBAN THREAD', 0xc0577a], ['BOOKNOOK', 0x2fbf71], ['FOOD COURT', 0xf08a3c]].forEach(([n, c], i) => {
      const x = [-fw / 2 + 5, -fw / 2 + 12, fw / 2 - 12, fw / 2 - 5][i];
      L.add(new THREE.Mesh(new THREE.PlaneGeometry(6, 0.9), signMat(n, c, 'IN THE MALL', 6, 0.9)), x, 5.3, fd / 2 + 0.08);
    });
    // rooftop LED screen with a rotating message
    const msgs = ['Shop smart: compare the EMI with the full price', 'Pay your card bill in full every month', 'FinVora Central Mall · open 10 am to 10 pm'];
    const scr = canvasTex(512, 128, () => {}); const sc = scr.image, sg = sc.getContext('2d');
    const draw = (m) => { sg.fillStyle = '#05080c'; sg.fillRect(0, 0, 512, 128); sg.fillStyle = '#5aa9e6'; sg.fillRect(0, 0, 8, 128); sg.fillStyle = '#fff'; sg.font = '700 28px system-ui'; let f = 28; while (sg.measureText(m).width > 480 && f > 14) { f -= 2; sg.font = `700 ${f}px system-ui`; } sg.textBaseline = 'middle'; sg.fillText(m, 22, 64); scr.needsUpdate = true; };
    draw(msgs[0]);
    const screen = L.add(new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: scr, toneMapped: false })), 0, H + 4.2, -2);
    screen.castShadow = false;
    L.add(new THREE.Mesh(new THREE.BoxGeometry(14.4, 3.9, 0.4), dark), 0, H + 4.2, -2.25);
    for (const x of [-5, 5]) L.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, 0.3), dark), x, H + 1.2, -2.3);
    let k = 0; city.animated.push((dt, t) => { const n = Math.floor(t / 6) % msgs.length; if (n !== k) { k = n; draw(msgs[n]); } });
    // rooftop plant, flags at the entrance
    L.add(new THREE.Mesh(new THREE.BoxGeometry(6, 2, 4), steel), -fw / 4, H + 1, -fd / 4);
    [0x5aa9e6, 0xd4a846, 0x2fbf71].forEach((c, i) => {
      const x = [-15, -12, 12][i];
      L.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 8, 8), lam(0xdedede)), x, 4, fd / 2 + 2.4);
      L.add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), lam(c, { side: THREE.DoubleSide })), x + 0.85, 7.4, fd / 2 + 2.4);
    });
  },

  cinema({ L, b, city }) {
    const { fw, fd } = L, H = b.h;
    const black = lam(0x1b1d24), red = glow(0xe5534b, 0.35), gold = glow(0xd4a846, 0.3);
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw, H, fd), black), 0, H / 2, 0);
    // ribbed red facade fins
    for (let i = -6; i <= 6; i++) L.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, H - 5, 0.6), red), i * (fw / 13), 5 + (H - 5) / 2, fd / 2 + 0.3);
    // vertical blade sign
    const blade = canvasTex(96, 512, (g) => {
      g.fillStyle = '#e5534b'; g.fillRect(0, 0, 96, 512); g.fillStyle = '#fff'; g.font = '900 64px system-ui'; g.textAlign = 'center';
      'CINEPLEX'.split('').forEach((ch, i) => g.fillText(ch, 48, 70 + i * 60));
    });
    L.add(new THREE.Mesh(new THREE.BoxGeometry(2, 12, 0.6), [red, red, red, red, new THREE.MeshBasicMaterial({ map: blade, toneMapped: false }), red]), fw / 2 - 2.5, H - 4, fd / 2 + 1.6);
    // marquee canopy with chasing bulbs
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw * 0.7, 1.6, 4), lam(0x2a1418)), 0, 5, fd / 2 + 2);
    L.add(new THREE.Mesh(new THREE.PlaneGeometry(fw * 0.66, 1.2), signMat('NOW SHOWING', 0xf0c868, 'THE LAST SIP · BULL RUN · COMPOUND · THE EMI TRAP', fw * 0.66, 1.2)), 0, 5, fd / 2 + 4.02);
    const bm = [new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), new THREE.MeshBasicMaterial({ color: 0x4a3a1a })];
    const bulbs = [];
    for (let x = -fw * 0.35; x <= fw * 0.35; x += 0.7) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), bm[0]); L.add(s, x, 4.1, fd / 2 + 4.05).castShadow = false; bulbs.push(s); }
    city.animated.push((dt, t) => { const k = Math.floor(t * 5); bulbs.forEach((s, i) => { s.material = bm[(i + k) % 3 === 0 ? 1 : 0]; }); });
    // poster light boxes either side of the doors
    [['THE LAST SIP', 0xd4a846], ['BULL RUN', 0x2fbf71], ['THE EMI TRAP', 0xc96bd4], ['COMPOUND', 0x5aa9e6]].forEach(([title, c], i) => {
      const tex = canvasTex(128, 180, (g) => {
        const gr = g.createLinearGradient(0, 0, 0, 180); gr.addColorStop(0, '#0b0d12'); gr.addColorStop(1, hex(c)); g.fillStyle = gr; g.fillRect(0, 0, 128, 180);
        g.fillStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(64, 70, 40, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.textAlign = 'center'; let f = 18; g.font = `800 ${f}px system-ui`; while (g.measureText(title).width > 118) { f -= 1; g.font = `800 ${f}px system-ui`; } g.fillText(title, 64, 150);
      });
      const x = [-fw * 0.36, -fw * 0.24, fw * 0.24, fw * 0.36][i];
      L.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2.8), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })), x, 1.9, fd / 2 + 0.06);
      L.add(new THREE.Mesh(new THREE.BoxGeometry(2.3, 3.1, 0.1), gold), x, 1.9, fd / 2 + 0.01);
    });
    L.add(new THREE.Mesh(new THREE.PlaneGeometry(fw * 0.5, 2.4), signMat('CINEPLEX FINVORA', 0xe5534b, '4 SCREENS · DOLBY SOUND · RECLINERS', fw * 0.5, 2.4)), 0, H - 1.8, fd / 2 + 0.62);
  },

  restaurant({ L, b, city }) {
    const { fw, fd } = L, H = b.h;
    const wall = lam(b.color), cream = lam(0xf3e6d0), wood = lam(0x7a4f2e);
    const warm = new THREE.MeshLambertMaterial({ color: 0x8a6a48, emissive: 0xffc070, emissiveIntensity: 0.45 });
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw, H - 1, fd), wall), 0, (H - 1) / 2, 0);
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw + 0.3, 0.4, fd + 0.3), cream), 0, 4.2, 0);
    // arched windows (warm light) on both floors
    for (let i = -2; i <= 2; i++) for (const y of [2, 6.2]) {
      L.add(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), warm), i * (fw / 5.2), y, fd / 2 + 0.02);
      L.add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.05, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), warm), i * (fw / 5.2), y + 1.2, fd / 2 + 0.02);
    }
    // rooftop terrace: parapet, umbrellas, string lights
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw, 0.9, 0.2), cream), 0, H - 0.55, fd / 2 - 0.1);
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw, 0.9, 0.2), cream), 0, H - 0.55, -fd / 2 + 0.1);
    for (const s of [-1, 1]) L.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, fd), cream), s * (fw / 2 - 0.1), H - 0.55, 0);
    const umb = [0xf08a3c, 0x2fbf71, 0xe5534b];
    for (let i = 0; i < 3; i++) {
      const x = -fw / 3 + i * fw / 3;
      L.add(new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.8, 8), lam(umb[i])), x, H + 1.6, 0);
      L.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), lam(0xdddddd)), x, H + 0.2, 0);
      L.add(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 14), wood), x, H, 0);
    }
    const bulb = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
    for (let x = -fw / 2 + 0.5; x < fw / 2; x += 0.9) L.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), bulb), x, H + 0.6 + Math.sin(x * 0.7) * 0.15, fd / 2 - 0.1).castShadow = false;
    // outdoor seating on the pavement side
    for (const x of [-fw / 3, fw / 3]) {
      L.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 14), wood), x, 0.76, fd / 2 + 2.2);
      L.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 6), wood), x, 0.38, fd / 2 + 2.2);
      L.add(new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.6, 8), lam(0xf3e6d0)), x, 2.5, fd / 2 + 2.2);
      L.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), lam(0x555555)), x, 1.3, fd / 2 + 2.2);
    }
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw * 0.7, 0.15, 1.8), lam(0x2fbf71)), 0, 3.8, fd / 2 + 0.9);
    L.add(new THREE.Mesh(new THREE.PlaneGeometry(9, 1.3), signMat('SPICE ROUTE', b.accent, 'RESTAURANT · ROOFTOP · SINCE 2026', 9, 1.3)), 0, 4.75, fd / 2 + 0.2);
    L.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.6, 0.9), lam(0x6d5d50)), fw / 2 - 2, H + 0.8, -fd / 2 + 2);
  },

  hospital({ L, b, city }) {
    const { fw, fd } = L, H = b.h;
    const ft = bandTex(0xf4f4f2, 0x7fa6bf, Math.round(H / 4)); ft.repeat.x = Math.round(fw / 6);
    const facade = new THREE.MeshLambertMaterial({ map: ft, emissive: 0xdff2ff, emissiveIntensity: 0 });
    city.nightMats.push(facade);
    const white = lam(0xf4f4f2), red = glow(0xe5534b, 0.45), green = glow(0x2fbf71, 0.5);
    const tw = fw * 0.62;
    L.add(new THREE.Mesh(new THREE.BoxGeometry(tw, H, fd * 0.8), [facade, facade, white, white, facade, facade]), -fw * 0.17, H / 2, -fd * 0.08);
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw, 6, fd), [facade, facade, white, white, facade, facade]), 0, 3, 0); // wide outpatient wing
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw + 0.3, 0.4, fd + 0.3), lam(0x5aa9e6)), 0, 6.1, 0);
    // red cross on the tower and the roof helipad
    const cross = (m, s, x, y, z) => { L.add(new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.32, 0.2), m), x, y, z); L.add(new THREE.Mesh(new THREE.BoxGeometry(s * 0.32, s, 0.2), m), x, y, z); };
    cross(red, 5, -fw * 0.17, H - 4, -fd * 0.08 + fd * 0.4 + 0.12);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.3, 24), lam(0x3a3f48)); L.add(pad, -fw * 0.17, H + 0.15, -fd * 0.08);
    const H_ = canvasTex(128, 128, (g) => { g.fillStyle = '#3a3f48'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#f0c868'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#fff'; g.font = '900 72px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 64, 68); });
    L.add(new THREE.Mesh(new THREE.CircleGeometry(4.6, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: H_ })), -fw * 0.17, H + 0.31, -fd * 0.08);
    // emergency canopy and an ambulance
    L.add(new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 5), white), fw / 2 - 5, 4, fd / 2 + 2.4);
    for (const x of [fw / 2 - 8.6, fw / 2 - 1.4]) L.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 8), lam(0xbbbbbb)), x, 2, fd / 2 + 4.6);
    L.add(new THREE.Mesh(new THREE.PlaneGeometry(7, 0.9), signMat('EMERGENCY', 0xe5534b, 'OPEN 24 HOURS · AMBULANCE 108', 7, 0.9)), fw / 2 - 5, 4.65, fd / 2 + 4.92);
    const amb = vehicleMesh('suv', 0xf4f4f2); amb.mesh.position.set(fw / 2 - 5, 0.12, fd / 2 + 2.2); amb.mesh.rotation.y = Math.PI / 2; L.group.add(amb.mesh);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.3), glow(0xe5534b, 1)); bar.position.set(fw / 2 - 5, 2.1, fd / 2 + 2.2); L.group.add(bar);
    city.animated.push((dt, t) => { bar.material.emissiveIntensity = Math.sin(t * 8) > 0 ? 1 : 0.15; });
    // main entrance sign and the pharmacy's green cross
    L.add(new THREE.Mesh(new THREE.PlaneGeometry(12, 1.5), signMat('FINVORA CITY HOSPITAL', 0xe5534b, 'OPD · DIAGNOSTICS · DAY CARE', 12, 1.5)), -fw * 0.17, 7.2, -fd * 0.08 + fd * 0.4 + 0.12);
    const ph = new THREE.Group(); ph.position.set(-fw / 2 + 3, 4.3, fd / 2 + 0.2); L.group.add(ph);
    for (const [w, h] of [[1.6, 0.5], [0.5, 1.6]]) ph.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), green));
    L.add(new THREE.Mesh(new THREE.PlaneGeometry(5, 0.8), signMat('PHARMACY', 0x2fbf71, '24 × 7 · GENERIC MEDICINES', 5, 0.8)), -fw / 2 + 7, 4.3, fd / 2 + 0.1);
  },

  school({ L, b, city }) {
    const { fw, fd } = L, H = b.h;
    const brick = brickTex(); brick.repeat.set(fw / 6, H / 6);
    const wall = new THREE.MeshLambertMaterial({ map: brick }), trim = lam(0xf2f2ee), roof = lam(0x5b4636);
    const winM = new THREE.MeshLambertMaterial({ color: 0x2e3e4c, emissive: 0xfff0c8, emissiveIntensity: 0 }); city.nightMats.push(winM);
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw, H, fd * 0.55), wall), 0, H / 2, -fd * 0.2);
    for (const s of [-1, 1]) L.add(new THREE.Mesh(new THREE.BoxGeometry(fw * 0.22, H, fd), wall), s * (fw / 2 - fw * 0.11), H / 2, 0); // two wings forming a courtyard
    for (const y of [3.9, 7.9]) L.add(new THREE.Mesh(new THREE.BoxGeometry(fw + 0.2, 0.25, fd * 0.55 + 0.2), trim), 0, y, -fd * 0.2);
    for (let f = 0; f < 3; f++) for (let i = -5; i <= 5; i++) {
      if (Math.abs(i) < 1) continue;
      L.add(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.8), winM), i * (fw / 12), 2 + f * 4, -fd * 0.2 + fd * 0.275 + 0.02);
    }
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw + 0.6, 0.6, fd * 0.55 + 0.6), roof), 0, H + 0.3, -fd * 0.2);
    // clock tower over the entrance
    L.add(new THREE.Mesh(new THREE.BoxGeometry(4.2, H + 8, 4.2), wall), 0, (H + 8) / 2, -fd * 0.2 + fd * 0.275);
    L.add(new THREE.Mesh(new THREE.ConeGeometry(3.4, 4, 4).rotateY(Math.PI / 4), roof), 0, H + 10, -fd * 0.2 + fd * 0.275);
    const clock = canvasTex(128, 128, () => {}), cg = clock.image.getContext('2d');
    L.add(new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), new THREE.MeshBasicMaterial({ map: clock })), 0, H + 5, -fd * 0.2 + fd * 0.275 + 2.12);
    let lastMin = -1;
    city.animated.push(() => {
      const hr = city.clockHour ?? 10, min = Math.floor(hr * 60); if (min === lastMin) return; lastMin = min;
      cg.fillStyle = '#f7f3e8'; cg.beginPath(); cg.arc(64, 64, 62, 0, Math.PI * 2); cg.fill(); cg.strokeStyle = '#2b2f38'; cg.lineWidth = 5; cg.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; cg.fillStyle = '#2b2f38'; cg.fillRect(64 + Math.sin(a) * 50 - 2, 64 - Math.cos(a) * 50 - 2, 4, 4); }
      const hand = (a, len, w) => { cg.lineWidth = w; cg.beginPath(); cg.moveTo(64, 64); cg.lineTo(64 + Math.sin(a) * len, 64 - Math.cos(a) * len); cg.stroke(); };
      hand(((hr % 12) / 12) * Math.PI * 2, 30, 6); hand(((min % 60) / 60) * Math.PI * 2, 46, 3);
      clock.needsUpdate = true;
    });
    // gate arch between the wings carrying the school's name
    for (const s of [-1, 1]) L.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.6, 0.6), trim), s * fw * 0.27, 2.8, fd / 2 - 0.3);
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw * 0.56, 1.6, 0.4), roof), 0, 5.4, fd / 2 - 0.3);
    L.add(new THREE.Mesh(new THREE.PlaneGeometry(fw * 0.5, 1.3), signMat('FINVORA PUBLIC SCHOOL', 0xd4a846, 'AND COLLEGE · EVENING DIPLOMAS FOR ADULTS', fw * 0.5, 1.3)), 0, 5.4, fd / 2 - 0.08);
    // courtyard: flagpole and a basketball hoop
    L.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 10, 8), lam(0xdedede)), -fw * 0.2, 5, fd * 0.3);
    L.add(new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), lam(0xf08a3c, { side: THREE.DoubleSide })), -fw * 0.2 + 0.95, 9.3, fd * 0.3);
    L.add(new THREE.Mesh(new THREE.PlaneGeometry(fw * 0.36, fd * 0.3).rotateX(-Math.PI / 2), lam(0x3d6fa8)), fw * 0.05, 0.14, fd * 0.24);
    L.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 8), lam(0x333333)), fw * 0.22, 1.6, fd * 0.24);
    L.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 1.6), lam(0xffffff)), fw * 0.22 - 0.2, 3.2, fd * 0.24);
  },

  gym({ L, b, city }) {
    const { fw, fd } = L, H = b.h;
    const black = lam(0x1c1f24), neon = glow(b.accent, 0.6);
    const glass = new THREE.MeshLambertMaterial({ color: 0x9fc2d4, transparent: true, opacity: 0.35, depthWrite: false });
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw, H, fd - 4), black), 0, H / 2, -2);
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw, 0.3, fd), black), 0, H - 0.15, 0); // roof over the glass hall
    const g = L.add(new THREE.Mesh(new THREE.BoxGeometry(fw - 0.2, H - 0.4, 0.1), glass), 0, (H - 0.4) / 2, fd / 2 - 0.05); g.renderOrder = 2; g.castShadow = false;
    for (const s of [-1, 1]) { const sg = L.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, H - 0.4, 4), glass), s * (fw / 2 - 0.05), (H - 0.4) / 2, fd / 2 - 2); sg.renderOrder = 2; sg.castShadow = false; }
    L.add(new THREE.Mesh(new THREE.BoxGeometry(fw, 0.1, 4), lam(0x8a8f96)), 0, 0.17, fd / 2 - 2);
    // lit interior: mirror wall and ceiling lights behind the glass
    L.add(new THREE.Mesh(new THREE.PlaneGeometry(fw - 0.4, H - 0.6), new THREE.MeshLambertMaterial({ color: 0xcfd8e0, emissive: 0xbfd0dc, emissiveIntensity: 0.35 })), 0, (H - 0.6) / 2, fd / 2 - 3.98);
    for (let x = -fw / 2 + 2; x < fw / 2; x += 3.5) L.add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff })), x, H - 0.5, fd / 2 - 2).castShadow = false;
    // treadmills facing the street and a weights rack
    for (let i = -3; i <= 3; i++) {
      L.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 1.9), black), i * 2.8, 0.35, fd / 2 - 2.2);
      L.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.12), lam(0x30343c)), i * 2.8, 1.1, fd / 2 - 1.3);
      L.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.05), neon), i * 2.8, 1.65, fd / 2 - 1.24);
    }
    // neon stripes, logo board
    for (const y of [H - 1, 0.9]) L.add(new THREE.Mesh(new THREE.BoxGeometry(fw + 0.1, 0.15, 0.15), neon), 0, y, fd / 2 + 0.05);
    L.add(new THREE.Mesh(new THREE.PlaneGeometry(10, 1.5), signMat('FINVORA FIT', b.accent, 'GYM · CLASSES · OPEN 5 AM TO 11 PM', 10, 1.5)), 0, H + 1.1, fd / 2 - 0.2);
    L.add(new THREE.Mesh(new THREE.BoxGeometry(10.4, 1.9, 0.2), black), 0, H + 1.1, fd / 2 - 0.35);
    // a giant dumbbell on the roof
    L.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4, 10).rotateZ(Math.PI / 2), lam(0xc9ccd1)), 0, H + 3, -4);
    for (const s of [-1, 1]) L.add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.6, 16).rotateZ(Math.PI / 2), neon), s * 1.8, H + 3, -4);
  },
};
export const EXTRA_STYLE_NAMES = Object.keys(EXTRA_STYLES);

// ================================================================ Central Park
export function buildCentralPark(scene, collision, city, { grass, shadows, bx, bz, trees }) {
  const gm = new THREE.MeshLambertMaterial({ map: grass });
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(39, 39).rotateX(-Math.PI / 2), gm); lawn.position.set(bx, 0.09, bz); lawn.receiveShadow = shadows; scene.add(lawn);
  // jogging track ring, cross paths to the fountain
  const track = new THREE.Mesh(new THREE.RingGeometry(13, 15, 64).rotateX(-Math.PI / 2), lam(0xb0553e)); track.position.set(bx, 0.1, bz); scene.add(track);
  const lane = new THREE.Mesh(new THREE.RingGeometry(13.95, 14.05, 64).rotateX(-Math.PI / 2), lam(0xf2f2ee)); lane.position.set(bx, 0.105, bz); scene.add(lane);
  const pathM = lam(0xbdb6a6);
  for (const [w, d] of [[3, 39], [39, 3]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), pathM); p.position.set(bx, 0.1, bz); scene.add(p); }
  // fountain
  const stone = lam(0xd9d2c3);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.7, 40), stone); basin.position.set(bx, 0.35, bz); basin.castShadow = shadows; scene.add(basin);
  const water = new THREE.Mesh(new THREE.CircleGeometry(3.9, 40).rotateX(-Math.PI / 2), lam(0x3f8fb8, { emissive: 0x0b2a3a })); water.position.set(bx, 0.66, bz); scene.add(water);
  const tier = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 0.6, 1.6, 24), stone); tier.position.set(bx, 1.4, bz); scene.add(tier);
  const jetM = new THREE.MeshLambertMaterial({ color: 0xdff2ff, transparent: true, opacity: 0.55, emissive: 0x5a8aa8, emissiveIntensity: 0.3 });
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.5, 3.2, 14, 1, true), jetM); jet.position.set(bx, 3.6, bz); scene.add(jet);
  const jets = [];
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) { const j = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.12, 1.4, 8, 1, true), jetM); j.position.set(bx + Math.cos(a) * 3, 1.3, bz + Math.sin(a) * 3); j.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); scene.add(j); jets.push(j); }
  city.animated.push((dt, t) => { jet.scale.y = 1 + Math.sin(t * 2) * 0.15; jets.forEach((j, i) => { j.scale.y = 0.8 + Math.sin(t * 3 + i) * 0.25; }); water.position.y = 0.66 + Math.sin(t * 1.5) * 0.008; });
  collision.addCircle(bx, bz, 4.5);
  // playground (north-west quadrant): swings and a slide
  const px = bx - 8, pz = bz - 8, metal = lam(0xe5534b), yellow = lam(0xf0c868);
  const sand = new THREE.Mesh(new THREE.CircleGeometry(4.2, 24).rotateX(-Math.PI / 2), lam(0xe3cf9e)); sand.position.set(px, 0.11, pz); scene.add(sand);
  for (const s of [-1.6, 1.6]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3, 6), metal); leg.position.set(px + s, 1.5, pz - 1.6); scene.add(leg); }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6).rotateZ(Math.PI / 2), metal); top.position.set(px, 3, pz - 1.6); scene.add(top);
  const swings = [];
  for (const s of [-0.7, 0.7]) { const sw = new THREE.Group(); sw.position.set(px + s, 3, pz - 1.6); const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.25), yellow); seat.position.y = -2.3; sw.add(seat); for (const r of [-0.22, 0.22]) { const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.3, 4), lam(0x333333)); rope.position.set(r, -1.15, 0); sw.add(rope); } scene.add(sw); swings.push(sw); }
  city.animated.push((dt, t) => { swings.forEach((s, i) => { s.rotation.x = Math.sin(t * 1.6 + i * 1.3) * 0.35; }); });
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 4).rotateX(0.55), yellow); slide.position.set(px + 1.5, 1.1, pz + 1.6); scene.add(slide);
  const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.9), metal); ladder.position.set(px + 1.5, 1.1, pz - 0.1); scene.add(ladder);
  collision.addBox(px, pz - 1.6, 3.6, 0.6, 3); collision.addBox(px + 1.5, pz + 0.8, 1, 3.4, 2.2);
  // open-air gym (south-east quadrant)
  const gx = bx + 8, gz = bz + 8;
  for (let i = 0; i < 3; i++) {
    const x = gx - 2.5 + i * 2.5;
    for (const s of [-0.7, 0.7]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), lam(0x2fbf71)); p.position.set(x + s, 1.1, gz); scene.add(p); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6).rotateZ(Math.PI / 2), lam(0xc9ccd1)); bar.position.set(x, 2.1 - i * 0.4, gz); scene.add(bar);
    collision.addBox(x, gz, 1.6, 0.3, 2.2);
  }
  // benches facing the fountain
  const wood = lam(0x8a6440), iron = lam(0x2b2f38);
  for (const [dx, dz, r] of [[0, -7.5, 0], [0, 7.5, Math.PI], [-7.5, 0, Math.PI / 2], [7.5, 0, -Math.PI / 2]]) for (const o of [-2.6, 2.6]) {
    const g = new THREE.Group(); g.position.set(bx + dx + (dz ? o : 0), 0, bz + dz + (dx ? o : 0)); g.rotation.y = r;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5), wood); seat.position.set(0, 0.46, 0); g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.08), wood); back.position.set(0, 0.75, -0.24); g.add(back);
    for (const s of [-0.8, 0.8]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.45), iron); leg.position.set(s, 0.23, 0); g.add(leg); }
    scene.add(g); collision.addBox(g.position.x, g.position.z, r ? 0.6 : 1.8, r ? 1.8 : 0.6, 0.9);
  }
  // entrance arch on the south side (towards AccoFinTra Plaza)
  for (const s of [-2.2, 2.2]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 0.5), stone); p.position.set(bx + s, 2, bz - 19.2); p.castShadow = shadows; scene.add(p); collision.addCircle(bx + s, bz - 19.2, 0.35); }
  const arch = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 0.9), signMat('CENTRAL PARK', 0x2fbf71, 'OPEN 5 AM TO 10 PM · FREE ENTRY', 5.4, 0.9)); arch.position.set(bx, 4.2, bz - 19.5); arch.rotation.y = Math.PI; scene.add(arch);
  const arch2 = arch.clone(); arch2.rotation.y = 0; arch2.position.z = bz - 18.9; scene.add(arch2);
  // trees around the track, never on paths
  for (let a = 0.2; a < Math.PI * 2; a += 0.42) {
    const r = 17.4, x = bx + Math.cos(a) * r, z = bz + Math.sin(a) * r;
    if (Math.abs(x - bx) < 2.6 || Math.abs(z - bz) < 2.6) continue;
    trees.push([x, z]);
  }
  for (const [dx, dz] of [[-8, 8], [8, -8], [-10, 4], [4, -10]]) trees.push([bx + dx, bz + dz]);
  city.noTrees = [...(city.noTrees || []), [bx, bz]];
}

// ================================================================ FinVora Metro (elevated Blue Line)
const DECK_Y = 9, DECK_W = 7, X0 = -212, X1 = 212;
export function metroEntrance(st) {
  const side = st.side ?? -1; // -1: north pavement, +1: south pavement
  const z = METRO_Z + side * 8;
  return { x: st.x + 13.4, z, face: -Math.PI / 2, stairZ: z, side };
}

export function buildMetro(scene, collision, city, { shadows }) {
  const conc = lam(0xc9c3b6), dark = lam(0x3a3f48), blue = glow(0x2e6fd6, 0.25), rail = lam(0x8a8f96);
  const parts = [];
  // deck, parapets and rails as one merged mesh
  const len = X1 - X0, cx = (X0 + X1) / 2;
  parts.push(new THREE.BoxGeometry(len, 1.1, DECK_W).translate(cx, DECK_Y - 0.55, METRO_Z));
  for (const s of [-1, 1]) parts.push(new THREE.BoxGeometry(len, 0.9, 0.25).translate(cx, DECK_Y + 0.45, METRO_Z + s * (DECK_W / 2 - 0.12)));
  const deck = new THREE.Mesh(mergeGeometries(parts), conc); deck.castShadow = shadows; deck.receiveShadow = shadows; scene.add(deck);
  parts.forEach((g) => g.dispose());
  const rails = [];
  for (const tz of [-1.6, 1.6]) for (const o of [-0.72, 0.72]) rails.push(new THREE.BoxGeometry(len, 0.12, 0.1).translate(cx, DECK_Y + 0.06, METRO_Z + tz + o));
  scene.add(new THREE.Mesh(mergeGeometries(rails), rail)); rails.forEach((g) => g.dispose());
  const band = new THREE.Mesh(new THREE.BoxGeometry(len, 0.35, DECK_W + 0.1), blue); band.position.set(cx, DECK_Y - 0.9, METRO_Z); scene.add(band);
  // piers: never in a junction box
  const piers = [];
  for (const b of CITY.blocks) for (const o of [-15, 0, 15]) {
    const x = b + o; if (METRO_STATIONS.some((s) => Math.abs(s.x - x) < 21)) continue;
    piers.push(new THREE.CylinderGeometry(0.7, 0.8, DECK_Y - 1.1, 12).translate(x, (DECK_Y - 1.1) / 2, METRO_Z), new THREE.BoxGeometry(2, 0.8, DECK_W - 1).translate(x, DECK_Y - 1.5, METRO_Z));
    collision.addCircle(x, METRO_Z, 0.8);
  }
  const pm = new THREE.Mesh(mergeGeometries(piers), conc); pm.castShadow = shadows; scene.add(pm); piers.forEach((g) => g.dispose());
  // stations
  city.metro = [];
  for (const st of METRO_STATIONS) buildStation(scene, collision, city, st, { shadows, conc, dark, blue });
  // trains
  city.trains = [makeTrain(scene, -1, shadows), makeTrain(scene, 1, shadows)];
  city.animated.push((dt) => city.trains.forEach((t) => t.update(dt)));
}

function roundel(name) {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2e6fd6'; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = '900 150px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('M', 128, 136);
  });
}

function buildStation(scene, collision, city, st, { shadows, conc, dark, blue }) {
  const pw = 40, pd = 13, x = st.x, z = METRO_Z;
  const box = (w, h, d, m, px, py, pz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(px, py, pz); o.castShadow = shadows; o.receiveShadow = shadows; scene.add(o); return o; };
  box(pw, 1.2, pd, conc, x, DECK_Y - 0.6, z); // platform slab
  for (const s of [-1, 1]) box(pw, 0.12, 2.4, lam(0xe8e4da), x, DECK_Y + 0.06, z + s * 4.6); // platform floors
  for (const s of [-1, 1]) box(pw, 0.06, 0.4, lam(0xf0c868), x, DECK_Y + 0.13, z + s * 3.5); // yellow safety lines
  // columns, curved roof, name boards
  for (const ox of [-16, -6, 6, 16]) for (const s of [-1, 1]) box(0.5, 4.2, 0.5, dark, x + ox, DECK_Y + 2.1, z + s * 5.6);
  for (const ox of [-15, 0, 15]) { box(1.5, DECK_Y - 1.2, 1.5, conc, x + ox, (DECK_Y - 1.2) / 2, z); collision.addCircle(x + ox, z, 0.8); }
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, pw, 24, 1, true, -0.62, 1.24).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xdfe3e8, side: THREE.DoubleSide }));
  roof.position.set(x, DECK_Y - 3.2, z); roof.scale.set(1, 1, 0.82); roof.castShadow = shadows; scene.add(roof);
  const rt = roundel();
  for (const s of [-1, 1]) {
    const nb = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.3), new THREE.MeshBasicMaterial({ map: signTexture(st.name.toUpperCase(), 0x2e6fd6, 'FINVORA METRO · BLUE LINE', 12 / 1.3), side: THREE.DoubleSide }));
    nb.position.set(x, DECK_Y + 4.7, z + s * 6.6); scene.add(nb);
    const r = new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), new THREE.MeshBasicMaterial({ map: rt, side: THREE.DoubleSide })); r.position.set(x - 8, DECK_Y + 4.7, z + s * 6.62); scene.add(r);
  }
  // street entrance: glass kiosk with the M roundel and a staircase up to the platform
  const e = metroEntrance(st);
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc2d4, transparent: true, opacity: 0.45, depthWrite: false });
  const k = box(4, 3, 3, glass, e.x - 1.2, 1.5, e.z); k.renderOrder = 2; k.castShadow = false;
  box(4.4, 0.25, 3.4, blue, e.x - 1.2, 3.1, e.z);
  const len = Math.hypot(12, DECK_Y), ang = Math.atan2(DECK_Y, 12);
  const stair = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 2.6), conc); stair.position.set(e.x - 3.2 - 6, DECK_Y / 2, e.z); stair.rotation.z = -ang; stair.castShadow = shadows; scene.add(stair);
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.08), glass); r.position.set(e.x - 3.2 - 6, DECK_Y / 2 + 0.7, e.z + s * 1.3); r.rotation.z = -ang; r.renderOrder = 2; scene.add(r); }
  box(2.6, DECK_Y - 1, 2.6, conc, e.x - 15.2 + 1.2, (DECK_Y - 1) / 2, e.z); // landing tower up to platform level
  const post = box(0.2, 4.4, 0.2, dark, e.x + 1.4, 2.2, e.z + 1.6 * -e.side);
  const sign = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), new THREE.MeshBasicMaterial({ map: rt, side: THREE.DoubleSide })); sign.position.set(post.position.x, 4.6, post.position.z); sign.rotation.y = Math.PI / 2; scene.add(sign);
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.6), new THREE.MeshBasicMaterial({ map: signTexture('METRO', 0x2e6fd6, st.name.toUpperCase(), 3.4 / 0.6), side: THREE.DoubleSide }));
  tag.position.set(e.x - 1.2, 3.6, e.z); tag.rotation.y = Math.PI / 2; scene.add(tag);
  collision.addBox(e.x - 7.9, e.z, 17.4, 3, DECK_Y);
  const door = { x: e.x + 2, z: e.z, face: -Math.PI / 2 };
  city.metro.push({ ...st, door });
  city.doors.push({ type: 'metro', station: st, x: door.x, z: door.z, face: door.face });
  city.noTrees = [...(city.noTrees || []), ...[0, 4, 8, 12, 16].map((o) => [e.x + 2 - o, e.z])];
}

/** A three-car train shuttling along its track, stopping at every station. */
function makeTrain(scene, track, shadows) {
  const geos = [];
  const col = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color(c).convertSRGBToLinear(); for (let i = 0; i < n; i++) a.set([cc.r, cc.g, cc.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.toNonIndexed ? g : g; };
  const add = (w, h, d, x, y, z, c) => geos.push(col(new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed(), c));
  for (let k = 0; k < 3; k++) {
    const x = (k - 1) * 11.4;
    add(11, 3, 2.9, x, 1.9, 0, 0xf2f2ee);
    add(11.02, 0.9, 2.92, x, 2.25, 0, 0x1c2733); // window band
    add(11.04, 0.3, 2.94, x, 1.15, 0, 0x2e6fd6); // blue stripe
    add(11, 0.25, 2.7, x, 3.5, 0, 0xc9ccd1); // roof
    for (const dz of [-4, -1.3, 1.3, 4]) add(0.9, 2.2, 2.95, x + dz, 1.6, 0, 0xdfe3e8); // doors
    add(10, 0.5, 2.4, x, 0.25, 0, 0x2b2f38); // bogies
  }
  for (const s of [-1, 1]) { add(0.4, 2, 2.6, s * 17.5, 2.1, 0, 0x2e6fd6); add(0.42, 0.8, 2, s * 17.6, 2.4, 0, 0x0c1218); }
  const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.3 }));
  geos.forEach((g) => g.dispose());
  mesh.castShadow = shadows; scene.add(mesh);
  const z = METRO_Z + track * 1.6, stops = [X0 + 20, ...METRO_STATIONS.map((s) => s.x), X1 - 20];
  const t = { mesh, i: track < 0 ? 0 : stops.length - 1, dir: track < 0 ? 1 : -1, pos: track < 0 ? stops[0] : stops[stops.length - 1], v: 0, dwell: 3 + Math.random() * 4 };
  const VMAX = 16, A = 1.1;
  t.update = (dt) => {
    if (t.dwell > 0) { t.dwell -= dt; mesh.position.set(t.pos, DECK_Y, z); return; }
    let next = t.i + t.dir; if (next < 0 || next >= stops.length) { t.dir *= -1; next = t.i + t.dir; }
    const target = stops[next], rem = Math.abs(target - t.pos);
    const brake = (t.v * t.v) / (2 * A);
    t.v = rem <= brake + 0.05 ? Math.max(0.6, t.v - A * dt) : Math.min(VMAX, t.v + A * dt);
    const step = Math.min(rem, t.v * dt);
    t.pos += Math.sign(target - t.pos) * step;
    if (Math.abs(target - t.pos) < 0.02) { t.pos = target; t.i = next; t.v = 0; t.dwell = 8; }
    mesh.position.set(t.pos, DECK_Y, z);
  };
  t.update(0);
  return t;
}

// ================================================================ traffic signals
export function buildSignals(scene, city, { shadows }) {
  const heads = [];
  for (const x of CITY.roadXs) for (const z of CITY.roadZs) {
    if (!isSignalised(x, z)) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const lx = dz, lz = -dx; // left of travel (India keeps left)
      heads.push({ jx: x, jz: z, axis: dx ? 'x' : 'z', px: x - dx * 7.2 + lx * 4.4, pz: z - dz * 7.2 + lz * 4.4, yaw: Math.atan2(-dx, -dz) });
    }
  }
  const pole = new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6).translate(0, 1.7, 0);
  const head = new THREE.BoxGeometry(0.4, 1.15, 0.3).translate(0, 3.85, 0);
  const lamp = new THREE.CircleGeometry(0.13, 10);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const poles = new THREE.InstancedMesh(pole, lam(0x2b2f38), heads.length), boxes = new THREE.InstancedMesh(head, lam(0x16181c), heads.length);
  const lamps = new THREE.InstancedMesh(lamp, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), heads.length * 3);
  heads.forEach((h, i) => {
    q.setFromAxisAngle(up, h.yaw); m4.compose(v.set(h.px, 0, h.pz), q, one); poles.setMatrixAt(i, m4); boxes.setMatrixAt(i, m4);
    for (let k = 0; k < 3; k++) {
      const off = new THREE.Vector3(0, 4.22 - k * 0.37, 0.16).applyQuaternion(q);
      m4.compose(v.set(h.px + off.x, off.y, h.pz + off.z), q, one); lamps.setMatrixAt(i * 3 + k, m4);
      lamps.setColorAt(i * 3 + k, new THREE.Color(0x222222));
    }
  });
  poles.castShadow = shadows; scene.add(poles, boxes, lamps);
  for (const m of [poles, boxes, lamps]) m.computeBoundingSphere();
  const ON = { red: 0xff2a2a, amber: 0xffb020, green: 0x2cff6a }, OFF = [0x3a1010, 0x3a2a08, 0x0b2e18], c = new THREE.Color();
  let acc = 1;
  city.signalHeads = heads;
  city.updateSignals = (dt, t) => {
    acc += dt; if (acc < 0.25) return; acc = 0;
    heads.forEach((h, i) => {
      const s = signalAt(t, h.jx, h.jz, h.axis);
      lamps.setColorAt(i * 3, c.setHex(s === 'red' ? ON.red : OFF[0]));
      lamps.setColorAt(i * 3 + 1, c.setHex(s === 'amber' ? ON.amber : OFF[1]));
      lamps.setColorAt(i * 3 + 2, c.setHex(s === 'green' ? ON.green : OFF[2]));
    });
    lamps.instanceColor.needsUpdate = true;
  };
}

// ================================================================ billboards and street furniture
const ADS = [
  ['START A SIP TODAY', 'FinVora Funds · small amounts, every month', 0x2fbf71],
  ['NEVER SHARE YOUR OTP', 'FinVora Cyber Cell · banks never ask for it', 0xe5534b],
  ['INSURE BEFORE YOU NEED IT', 'Term and health cover · AccoFinTra Tower', 0x9b7fd4],
  ['PAY YOUR CARD BILL IN FULL', 'Interest on unpaid balances can top 40% a year', 0xd4a846],
  ['EMERGENCY FUND FIRST', 'Six months of expenses, then invest', 0x5aa9e6],
  ['CINEPLEX · NOW SHOWING', 'The Last Sip · Bull Run · The EMI Trap', 0xe5534b],
];
export function buildStreetProps(scene, collision, city, { shadows }) {
  // roadside billboards in parks and on corners, facing the boulevards
  // all in park blocks, beside a boulevard (width along the road)
  const spots = [[100, -118, 0], [-200, -82, 0], [-200, 18, 0], [150, -132, 0], [132, -50, Math.PI / 2], [200, 118, 0]];
  spots.forEach(([x, z, r], i) => {
    const [title, sub, c] = ADS[i % ADS.length];
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r; scene.add(g);
    for (const s of [-2.5, 2.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 6, 8), lam(0x2b2f38)); p.position.set(s, 3, 0); p.castShadow = shadows; g.add(p); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(8.4, 3.6, 0.3), lam(0x1c1f24)); back.position.set(0, 7.6, -0.1); back.castShadow = shadows; g.add(back);
    for (const s of [1, -1]) { const face = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.2), signMat(title, c, sub, 8, 3.2)); face.position.set(0, 7.6, s * 0.06); if (s < 0) face.rotation.y = Math.PI; g.add(face); }
    const wx = Math.cos(r), wz = -Math.sin(r);
    for (const s of [-2.5, 2.5]) collision.addCircle(x + wx * s, z + wz * s, 0.25);
    city.noTrees = [...(city.noTrees || []), [x, z], [x + wx * 3.5, z + wz * 3.5], [x - wx * 3.5, z - wz * 3.5]];
  });
  // litter bins and bollards beside every street lamp in the core
  const binPts = [], bollards = [];
  for (const bx of CITY.blocks) for (const bz of CITY.blocks) {
    if (Math.max(Math.abs(bx), Math.abs(bz)) > 150) continue;
    for (const [sx, sz] of [[-1, -1], [1, 1]]) binPts.push([bx + sx * 19 + sx * -1.2, bz + sz * 19]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const k of [1.4, 2.6]) bollards.push([bx + sx * 19.6, bz + sz * (19.6 - k * 0.1) - sz * k]);
  }
  const bin = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.24, 0.9, 10).translate(0, 0.45, 0), lam(0x2f6b3a), binPts.length);
  binPts.forEach(([x, z], i) => { bin.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0.04, z)); collision.addCircle(x, z, 0.3); });
  bin.computeBoundingSphere(); bin.castShadow = shadows; scene.add(bin);
  const bol = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.11, 0.8, 8).translate(0, 0.4, 0), lam(0x9aa0a6), bollards.length);
  bollards.forEach(([x, z], i) => bol.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0.04, z)));
  bol.computeBoundingSphere(); scene.add(bol);
  // a few people relaxing in Central Park (decorative)
  [[-3, 46, 0], [4.5, 58, Math.PI], [-12, 52, 1.2]].forEach(([x, z, r], i) => {
    const ch = createCharacter([{ skin: 0xc08a64, shirt: 0x2fbf71, pants: 0x2a3340, hair: 0x15110d, hairStyle: 'short', top: 'tshirt' }, { skin: 0xa77450, shirt: 0xf08a3c, pants: 0x22262c, hair: 0x1a120c, hairStyle: 'bun', top: 'kurta' }, { skin: 0xd1a27c, shirt: 0x5aa9e6, pants: 0x1c2333, hair: 0x241811, hairStyle: 'bob', top: 'shirt' }][i], { blobShadow: true });
    ch.root.position.set(x, 0, z); ch.root.rotation.y = r; scene.add(ch.root); collision.addCircle(x, z, 0.4);
  });
}
