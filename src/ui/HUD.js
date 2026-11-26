import { el, esc, $, initials } from './dom.js';
import { formatINR } from '../config.js';
import { SAVE_STATUS } from '../services/SaveService.js';
import { BUILDINGS, DISTRICTS } from '../data/buildings.js';
import { CITY } from '../config.js';

export class HUD {
  constructor(root, { profile, onMenu, onMap, onPortfolio, onPhone }) {
    this.root = root;
    this.node = el(`
      <div class="hud">
        <div class="hud-top">
          <div class="hud-left">
            <div class="glass hud-id">
              <div class="avatar">${esc(initials(profile.fullName))}</div>
              <div><div class="hud-name">${esc(profile.fullName)}</div><div class="hud-lvl">Level ${profile.level} · ${esc(profile.playerCode)}</div></div>
            </div>
            <button class="glass hud-wallet" data-portfolio title="Open your portfolio (P)">
              <div class="sim-tag"><span class="lbl">Virtual wallet · </span>Simulated money</div>
              <div class="amt" data-wallet>${formatINR(profile.wallet.available)}</div>
              <div class="hud-nw"><span data-nw></span> <span class="muted" data-sdate></span></div>
            </button>
          </div>
          <div class="hud-right">
            <div style="display:flex;gap:.45rem;align-items:center">
              <div class="glass brand">FIN<span>VORA</span></div>
              <div class="glass hud-clock"><span data-icon>☀</span><span data-clock>09:30</span></div>
              <button class="glass icon-btn phone-btn" data-phone aria-label="Phone (T)">📱<i class="badge hidden" data-badge></i></button>
              <button class="glass icon-btn" data-menu aria-label="Menu">☰</button>
            </div>
            <div class="minimap-wrap"><div class="glass minimap" data-minimap title="Open map (M)"><canvas width="180" height="180"></canvas></div><div class="wp-label hidden" data-wp></div></div>
            <div class="glass save-ind" data-s="idle"><i></i><span data-save>Ready</span></div>
            <div class="glass fps hidden" data-fps></div>
          </div>
        </div>
        <div class="glass prompt hidden" data-prompt><span class="key">E</span><span data-ptext></span><span class="sub" data-psub></span></div>
        <div class="glass speedo hidden" data-speedo><span data-kmh>0</span><small>km/h</small><b class="fuel" data-fuel></b><em>W/S drive · A/D steer · Space brake · E exit</em></div>
        <div class="toast-wrap" data-toasts></div>
      </div>`);
    root.appendChild(this.node);
    $(this.node, '[data-menu]').addEventListener('click', onMenu);
    $(this.node, '[data-minimap]').addEventListener('click', onMap);
    $(this.node, '[data-portfolio]').addEventListener('click', onPortfolio);
    $(this.node, '[data-phone]').addEventListener('click', onPhone);
    this.mini = $(this.node, '[data-minimap] canvas');
    this.miniCtx = this.mini.getContext('2d');
    this._miniTimer = 0;
    this.touch = document.body.classList.contains('touch');
    if (this.touch) $(this.node, '.prompt .key').textContent = 'TAP';
  }

  setVisible(v) { this.node.style.display = v ? '' : 'none'; }
  setWallet(amount, netWorth, date) {
    $(this.node, '[data-wallet]').textContent = formatINR(amount);
    if (netWorth !== undefined) $(this.node, '[data-nw]').textContent = `Net worth ${formatINR(netWorth)}`;
    if (date) $(this.node, '[data-sdate]').textContent = `· ${date}`;
  }

  setClock(hour) {
    const h = Math.floor(hour) % 24, m = Math.floor((hour % 1) * 60);
    $(this.node, '[data-clock]').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    $(this.node, '[data-icon]').textContent = h >= 6 && h < 18.5 ? '☀' : '☾';
  }

  setSave(status) {
    const box = $(this.node, '.save-ind');
    box.dataset.s = status;
    $(this.node, '[data-save]').textContent = SAVE_STATUS[status] || 'Ready';
  }

  setBadge(n) { const b = $(this.node, '[data-badge]'); b.classList.toggle('hidden', !n); b.textContent = n > 9 ? '9+' : n; }

  setSpeed(kmh, fuel = null) {
    const s = $(this.node, '[data-speedo]');
    s.classList.toggle('hidden', kmh === null);
    if (kmh !== null) $(s, '[data-kmh]').textContent = Math.round(kmh);
    if (fuel !== null && kmh !== null) { const f = $(s, '[data-fuel]'); const t = `Fuel ${Math.round(fuel * 100)}%`; if (f.textContent !== t) f.textContent = t; f.classList.toggle('low', fuel < 0.15); }
  }

  setFps(v, show) {
    const f = $(this.node, '[data-fps]');
    f.classList.toggle('hidden', !show);
    if (show) f.textContent = `${v} FPS`;
  }

  setPrompt(target) {
    const p = $(this.node, '[data-prompt]');
    if (!target) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    $(p, '[data-ptext]').textContent = target.label;
    $(p, '[data-psub]').textContent = target.sub || '';
  }

  setWaypoint(text) {
    const w = $(this.node, '[data-wp]');
    w.classList.toggle('hidden', !text);
    if (text) w.innerHTML = `<span style="color:var(--fw-gold)">◆</span> ${esc(text)}`;
  }

  toast(msg, { gold = false, ms = 3200 } = {}) {
    const t = el(`<div class="glass toast ${gold ? 'gold' : ''}">${esc(msg)}</div>`);
    $(this.node, '[data-toasts]').appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, ms);
  }

  /** GTA-style round minimap that turns with the camera, with the GPS route drawn on it. ~8 fps. */
  drawMinimap(dt, player, npcs, waypoint, cars = [], camYaw = 0, route = null) {
    this._miniTimer -= dt;
    if (this._miniTimer > 0) return;
    this._miniTimer = 0.1;
    const g = this.miniCtx, W = this.mini.width, R = W / 2, span = 140, s = W / span;
    const px = player.pos.x, pz = player.pos.z;
    const tx = (x) => (x - px) * s, tz = (z) => (z - pz) * s;
    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath(); g.arc(R, R, R - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#1d2026'; g.fillRect(0, 0, W, W); // roads
    g.translate(R, R); g.rotate(camYaw);
    const near = (x, z, m) => Math.abs(x - px) < span + m && Math.abs(z - pz) < span + m;
    for (const bx of CITY.blocks) for (const bz of CITY.blocks) {
      if (!near(bx, bz, 30)) continue;
      const is = (list) => list.some(([x, z]) => x === bx && z === bz);
      const park = (bx === 0 && bz === 0) || is(DISTRICTS.parks);
      g.fillStyle = is(DISTRICTS.lake) ? '#2a5f80' : park ? '#2e4a2a' : is(DISTRICTS.residential) ? '#3d3830' : is(DISTRICTS.business) ? '#323c49' : '#30343b';
      g.fillRect(tx(bx - 21.5), tz(bz - 21.5), 43 * s, 43 * s);
    }
    for (const b of BUILDINGS) {
      if (!near(b.x, b.z, 30)) continue;
      g.fillStyle = '#8a6d2c';
      g.fillRect(tx(b.x - b.w / 2), tz(b.z - b.d / 2), b.w * s, b.d * s);
    }
    g.fillStyle = '#c9ccd2';
    for (const c of cars) if (near(c.pos.x, c.pos.z, 5)) g.fillRect(tx(c.pos.x) - 1.5, tz(c.pos.z) - 1.5, 3, 3);
    for (const n of npcs) {
      if (!n.keyNpc || !near(n.pos.x, n.pos.z, 5)) continue;
      g.fillStyle = '#2fbf71'; g.beginPath(); g.arc(tx(n.pos.x), tz(n.pos.z), 2.2, 0, 7); g.fill();
    }
    if (this.myCar && !this.myCar.occupied) { g.fillStyle = '#f0c868'; g.fillRect(tx(this.myCar.pos.x) - 2.5, tz(this.myCar.pos.z) - 2.5, 5, 5); }
    if (route && route.length > 1) {
      g.strokeStyle = '#f0c868'; g.lineWidth = 4; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); route.forEach((p, i) => (i ? g.lineTo(tx(p.x), tz(p.z)) : g.moveTo(tx(p.x), tz(p.z)))); g.stroke();
    }
    // player arrow (world-oriented inside the rotated frame)
    g.save(); g.rotate(Math.PI - player.yaw);
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 2.5); g.lineTo(-6, 6); g.closePath(); g.fill();
    g.restore();
    g.restore();
    // waypoint blip, clamped to the rim when off-map
    if (waypoint) {
      let wx = (waypoint.x - px) * s, wz = (waypoint.z - pz) * s;
      const c = Math.cos(camYaw), sn = Math.sin(camYaw);
      [wx, wz] = [wx * c - wz * sn, wx * sn + wz * c];
      const d = Math.hypot(wx, wz), lim = R - 8;
      if (d > lim) { wx *= lim / d; wz *= lim / d; }
      g.fillStyle = '#f0c868'; g.strokeStyle = '#111'; g.lineWidth = 2;
      g.beginPath(); g.arc(R + wx, R + wz, 5.5, 0, 7); g.fill(); g.stroke();
    }
    // north marker on the rim
    const nx = Math.sin(camYaw) * (R - 9), nz = -Math.cos(camYaw) * (R - 9);
    g.fillStyle = '#0b0c0e'; g.beginPath(); g.arc(R + nx, R + nz, 7, 0, 7); g.fill();
    g.fillStyle = '#ecebe6'; g.font = '700 10px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', R + nx, R + nz + 0.5);
  }
}
