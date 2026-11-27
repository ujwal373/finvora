import { el, esc, $, $$, hex } from './dom.js';
import { service, serviceTitle } from './Services.js';
import { BUILDINGS, DISTRICTS } from '../data/buildings.js';
import { CITY } from '../config.js';
import { GRAPHICS_PRESETS, formatINR, formatINR2, fmtNum, fmtPct } from '../config.js';

// Modal panels: building interiors, pause menu (settings, journal, controls, account), map, welcome.
// Only one modal is open at a time. Each returns a close function.

export class Panels {
  constructor(root) { this.root = root; this.current = null; }
  get open() { return !!this.current; }

  _modal(inner, { narrow = false, onClose } = {}) {
    this.close();
    const back = el(`<div class="modal-back"><div class="fw-card panel ${narrow ? 'narrow' : ''}" role="dialog" aria-modal="true"></div></div>`);
    $(back, '.panel').appendChild(inner);
    back.addEventListener('pointerdown', (e) => { if (e.target === back) this.close(); });
    this.root.appendChild(back);
    const cleanups = [];
    this.current = { back, onClose, cleanups };
    $$(inner, '[data-close]').forEach((b) => b.addEventListener('click', () => this.close()));
    return this.current;
  }

  close() {
    if (!this.current) return;
    const c = this.current; this.current = null;
    c.cleanups.forEach((f) => f());
    c.back.remove();
    c.onClose?.();
  }

  handle(pressed) { if (pressed.has('pause') || pressed.has('back')) this.close(); }

  // ---------------------------------------------------------------- building interior
  building(b, { svcCtx, onTalkDesk, onClose, helpers = [], onFindHelper, startTab = 0 }) {
    const inner = el(`<div style="display:contents">
      <div class="panel-head">
        <div><span class="fw-chip green">Open to everyone</span>
          <div class="panel-title">${esc(b.name)}</div><div class="muted" style="font-size:.92rem">${esc(b.blurb)}</div></div>
        <button class="close-x" data-close aria-label="Leave building">✕</button>
      </div>
      <div class="menu-tabs" data-tabs>${b.services.map((id, i) => `<button data-t="${i}">${esc(serviceTitle(id))}</button>`).join('')}</div>
      <div class="panel-body">
        <div data-svc></div>
        ${b.desk || helpers.length ? `<div class="section-h">People here</div><div class="chips" data-people>${b.desk ? '<button class="chip" data-desk>Help desk</button>' : ''}${helpers.map((h) => `<button class="chip" data-h="${h.id}">${b.counter ? 'Talk to ' : ''}${esc(h.name)}${h.name !== h.role ? ` · ${esc(h.role)}` : ''} ${b.counter ? '💬' : '⌖'}</button>`).join('')}</div>` : ''}
        <div class="disclaimer">FinVora is an educational simulation. All money is virtual and every price is simulated. Your transaction history is permanent: it cannot be edited or deleted. Nothing here is financial advice.</div>
      </div>
    </div>`);
    const m = this._modal(inner, { onClose });
    m.back.querySelector('.panel').classList.add('wide');
    let current = null;
    const show = (i) => {
      current?.destroy?.();
      $$(inner, '[data-tabs] [data-t]').forEach((x) => x.classList.toggle('on', Number(x.dataset.t) === i));
      const slot = $(inner, '[data-svc]'); slot.innerHTML = '';
      try { current = service(b.services[i], svcCtx); }
      catch (e) { console.error(e); current = { node: el('<div class="fw-msg info">This section could not load. Close the building and open it again.</div>') }; }
      slot.appendChild(current.node);
      $(inner, '.panel-body').scrollTop = 0;
    };
    $$(inner, '[data-tabs] [data-t]').forEach((x) => x.addEventListener('click', () => show(Number(x.dataset.t))));
    if (b.services.length < 2) $(inner, '[data-tabs]').style.display = 'none';
    m.cleanups.push(() => current?.destroy?.());
    if (b.desk) $(inner, '[data-desk]').addEventListener('click', () => { this.close(); onTalkDesk(b); });
    $$(inner, '[data-h]').forEach((x) => x.addEventListener('click', () => { this.close(); onFindHelper(x.dataset.h); }));
    show(Math.min(startTab, b.services.length - 1));
  }

  /** A simple list of choices (bus destinations and similar). */
  choice({ title, sub = '', options, onPick, onClose }) {
    const inner = el(`<div style="display:contents">
      <div class="panel-head"><div><div class="panel-title">${esc(title)}</div><div class="muted small">${esc(sub)}</div></div><button class="close-x" data-close>✕</button></div>
      <div class="panel-body"><div class="pick">${options.map((o) => `<button class="pick-row" data-v="${esc(o.value)}" ${o.disabled ? 'disabled' : ''}><span><b>${esc(o.label)}</b><small>${esc(o.sub || '')}</small></span><span class="r">›</span></button>`).join('')}</div></div>
    </div>`);
    const m = this._modal(inner, { narrow: true, onClose });
    $$(inner, '[data-v]').forEach((b) => b.addEventListener('click', () => { const v = b.dataset.v; const cb = m.onClose; m.onClose = null; this.close(); cb?.(); onPick(v); }));
  }

  // ---------------------------------------------------------------- portfolio
  portfolio({ fin, onClose, autoAdvance, onToggleAuto, onAdvance }) {
    const inner = el(`<div style="display:contents">
      <div class="panel-head"><div><span class="fw-chip gold">Virtual money · simulated prices</span><div class="panel-title">My Portfolio</div><div class="muted small" data-date></div></div><button class="close-x" data-close>✕</button></div>
      <div class="menu-tabs">${['Overview', 'Holdings', 'Transactions', 'Time'].map((t, i) => `<button data-t="${i}">${t}</button>`).join('')}</div>
      <div class="panel-body" data-body></div></div>`);
    const m = this._modal(inner, { onClose });
    m.back.querySelector('.panel').classList.add('wide');
    let tab = 0;
    const body = $(inner, '[data-body]');
    const render = () => {
      const s = fin.snapshot();
      $(inner, '[data-date]').textContent = `Simulation date ${s.date} · ${autoAdvance() ? 'time running (1 day ≈ 20 s)' : 'time paused'}`;
      $$(inner, '[data-t]').forEach((x) => x.classList.toggle('on', Number(x.dataset.t) === tab));
      if (tab === 0) {
        const maxA = Math.max(...Object.values(s.alloc), 1);
        body.innerHTML = `<div class="grid-3">
            <div class="stat"><div class="k">Net worth</div><div class="v gold">${formatINR(s.netWorth)}</div></div>
            <div class="stat"><div class="k">Cash (savings)</div><div class="v">${formatINR(fin.cash)}</div></div>
            <div class="stat"><div class="k">Invested value</div><div class="v">${formatINR(s.invested)}</div></div>
            <div class="stat"><div class="k">Unrealised P&L</div><div class="v ${s.unrealised >= 0 ? 'up' : 'down'}">${formatINR(s.unrealised)}</div></div>
            <div class="stat"><div class="k">Realised P&L</div><div class="v ${s.realised >= 0 ? 'up' : 'down'}">${formatINR(s.realised)}</div></div>
            <div class="stat"><div class="k">XIRR</div><div class="v">${s.xirr === null ? '<span class="muted small">after 30 days</span>' : `${(s.xirr * 100).toFixed(2)}%`}</div></div>
            ${s.loans ? `<div class="stat"><div class="k">Loans outstanding</div><div class="v down">${formatINR(s.loans)}</div></div>` : ''}
          </div>
          <div class="section-h">Asset allocation</div>
          ${Object.entries(s.alloc).map(([k, v]) => `<div class="bar-row"><span>${k}</span><div class="bar"><i style="width:${(v / maxA * 100).toFixed(1)}%"></i></div><span class="mono">${formatINR(v)} · ${(v / s.assets * 100).toFixed(1)}%</span></div>`).join('')}
          <p class="small muted">XIRR is your annualised return across every investment cash flow and its date. Started with ${formatINR(1000000)} of virtual money on ${fin.start}.</p>`;
      } else if (tab === 1) {
        body.innerHTML = s.rows.length ? `<div class="tbl-wrap"><table class="board"><thead><tr><th>Holding</th><th>Type</th><th class="r">Qty</th><th class="r">Cost</th><th class="r">Value</th><th class="r">P&L</th></tr></thead><tbody>${s.rows.map((r) => `<tr><td><b>${esc(r.code)}</b> <small>${esc(r.name)}</small></td><td>${esc(r.type)}</td><td class="r">${fmtNum(r.qty, r.type === 'stock' || r.type === 'etf' ? 0 : 3)}</td><td class="r">${formatINR(r.cost)}</td><td class="r">${formatINR(r.value)}</td><td class="r ${r.pl >= 0 ? 'up' : 'down'}">${formatINR(r.pl)} <small>(${fmtPct(r.cost ? r.pl / r.cost * 100 : 0, 1)})</small></td></tr>`).join('')}</tbody></table></div>` : '<div class="muted">No market holdings yet. Visit the Stock Exchange or the Mutual Funds counter in AccoFinTra Tower.</div>';
        body.innerHTML += `<div class="section-h">Deposits, schemes and loans</div><div class="small">${[
          ...fin.fds.filter((x) => x.status === 'active').map((x) => `FD ${x.id}: ${formatINR(x.principal)} @ ${(x.rate * 100).toFixed(2)}%, matures ${x.maturity}`),
          ...fin.rds.filter((x) => x.status === 'active').map((x) => `RD ${x.id}: ${formatINR(x.installment)}/month, ${x.paid.length}/${x.months} paid`),
          fin.ppf && `PPF balance ${formatINR(fin.ppf.balance)}`, fin.ssy && `SSY balance ${formatINR(fin.ssy.balance)}`,
          ...fin.nsc.filter((x) => x.status === 'active').map((x) => `NSC ${x.id}: ${formatINR(x.amount)}, matures ${x.maturity}`),
          ...fin.scss.filter((x) => x.status === 'active').map((x) => `SCSS ${x.id}: ${formatINR(x.amount)}`),
          ...fin.sips.filter((x) => x.active).map((x) => `SIP ${formatINR(x.amount)}/month into ${x.name}, next ${x.next}`),
          ...fin.loans.filter((x) => x.status === 'active').map((x) => `Loan ${x.id}: ${formatINR(x.balance)} outstanding, EMI ${formatINR(x.emi)}`),
        ].filter(Boolean).map((t) => `<div class="news">${esc(t)}</div>`).join('') || '<span class="muted">None yet.</span>'}</div>`;
      } else if (tab === 2) {
        const L = fin.ledger.slice(-150).reverse();
        body.innerHTML = `<div class="fw-msg info" style="margin-top:0">Permanent record of ${fin.ledger.length} transactions. Entries can never be edited or deleted.</div><div class="tbl-wrap"><table class="board"><thead><tr><th>#</th><th>Date</th><th>Activity</th><th class="r">Amount</th><th class="r">Balance after</th></tr></thead><tbody>${L.map((e) => `<tr><td class="muted">${e.id}</td><td>${e.date}</td><td>${esc(e.name)}${e.qty ? ` <small>${fmtNum(e.qty, e.asset === 'fund' || e.asset === 'nps' ? 3 : 0)} @ ${fmtNum(e.price, e.asset === 'fund' || e.asset === 'nps' ? 4 : 2)}</small>` : ''}${e.pl !== undefined ? ` <small class="${e.pl >= 0 ? 'up' : 'down'}">P&L ${formatINR(e.pl)}</small>` : ''}${e.note ? `<div class="small muted">${esc(e.note)}</div>` : ''}</td><td class="r ${e.amount > 0 ? 'up' : e.amount < 0 ? 'down' : ''}">${e.amount ? formatINR2(e.amount) : '—'}</td><td class="r">${formatINR(e.cashAfter)}</td></tr>`).join('')}</tbody></table></div>`;
      } else {
        body.innerHTML = `<p style="margin-top:0">Markets and accounts run on a simulated calendar. While you play, one simulated day passes about every 20 seconds. Jump ahead to watch SIPs, EMIs, interest and maturities happen.</p>
          <div class="toggle-row"><span>Let time run while I play</span><input type="checkbox" data-auto ${autoAdvance() ? 'checked' : ''}></div>
          <div class="chips" style="margin-top:.8rem">${[[1, '+1 day'], [7, '+1 week'], [30, '+1 month'], [182, '+6 months'], [365, '+1 year']].map(([d, l]) => `<button class="chip" data-adv="${d}">${l}</button>`).join('')}</div>
          <p class="small muted">Jumping ahead cannot be undone, just like real time. Prices along the way are simulated afresh.</p>`;
        $(body, '[data-auto]').addEventListener('change', (e) => onToggleAuto(e.target.checked));
        $$(body, '[data-adv]').forEach((b) => b.addEventListener('click', () => { onAdvance(Number(b.dataset.adv)); }));
      }
    };
    $$(inner, '[data-t]').forEach((x) => x.addEventListener('click', () => { tab = Number(x.dataset.t); render(); }));
    render();
    m.cleanups.push(fin.on(() => render()));
  }

  // ---------------------------------------------------------------- welcome (first login)
  welcome(profile, onStart) {
    const inner = el(`<div style="display:contents">
      <div class="panel-head"><div><div class="auth-kicker">Welcome to FinVora</div><div class="panel-title">Hello, ${esc(profile.fullName.split(' ')[0])}</div></div></div>
      <div class="panel-body">
        <p>Your player ID is <b style="font-family:var(--fw-mono);color:var(--fw-gold-2)">${esc(profile.playerCode)}</b>. Your virtual wallet has been opened with:</p>
        <div class="stat"><div class="k">Virtual wallet · simulated money</div><div class="v" style="color:var(--fw-gold-2)">${formatINR(profile.wallet.available)}</div></div>
        <p class="muted" style="font-size:.9rem">This is game currency for learning. It is not real money, cannot be withdrawn and never touches a real bank or broker.</p>
        <p style="font-size:.92rem">${profile.mode === 'cloud' ? 'Your progress saves to your account automatically, so you can carry on from any device.' : 'You are playing as a guest: progress saves in this browser. Every building is open. Tap your wallet (or press P) for your portfolio.'}</p>
        <button class="fw-btn primary block" data-go>Enter the city</button>
      </div></div>`);
    this._modal(inner, { narrow: true, onClose: onStart });
    $(inner, '[data-go]').addEventListener('click', () => this.close());
  }

  info(title, html, onClose) {
    const inner = el(`<div style="display:contents"><div class="panel-head"><div class="panel-title">${esc(title)}</div><button class="close-x" data-close>✕</button></div><div class="panel-body">${html}</div></div>`);
    this._modal(inner, { narrow: true, onClose });
  }

  // ---------------------------------------------------------------- map
  map({ player, npcs, waypoint, onSetWaypoint, route = null }) {
    const inner = el(`<div style="display:contents">
      <div class="panel-head"><div><div class="panel-title">City map</div><div class="muted" style="font-size:.88rem">Tap a building or pick from the list to set a waypoint.</div></div><button class="close-x" data-close>✕</button></div>
      <div class="panel-body">
        <div class="map-wrap"><canvas width="720" height="720"></canvas></div>
        <div class="section-h">Locations</div>
        <div class="grid-2" data-list></div>
      </div></div>`);
    this._modal(inner);
    const HALF = CITY.bound + 6, cv = $(inner, 'canvas'), g = cv.getContext('2d'), W = cv.width, s = W / (HALF * 2);
    const tx = (x) => (x + HALF) * s, tz = (z) => (z + HALF) * s;
    const draw = () => {
      g.fillStyle = '#1a2a1a'; g.fillRect(0, 0, W, W);
      g.fillStyle = '#2b2f36'; g.fillRect(tx(-CITY.bound + 1), tz(-CITY.bound + 1), (CITY.bound - 1) * 2 * s, (CITY.bound - 1) * 2 * s);
      for (const bx of CITY.blocks) for (const bz of CITY.blocks) { const park = (bx === 0 && bz === 0) || (DISTRICTS.centralPark || []).some(([x, z]) => x === bx && z === bz) || DISTRICTS.parks.some(([x, z]) => x === bx && z === bz); const home = DISTRICTS.residential.some(([x, z]) => x === bx && z === bz); const biz = DISTRICTS.business.some(([x, z]) => x === bx && z === bz); const lake = DISTRICTS.lake.some(([x, z]) => x === bx && z === bz); g.fillStyle = lake ? '#2f6f94' : park ? '#36572f' : home ? '#4a4438' : biz ? '#3d4a5a' : '#3a3f47'; g.fillRect(tx(bx - 21.5), tz(bz - 21.5), 43 * s, 43 * s); const lbl = home ? 'HOMES' : biz ? 'OFFICES' : lake ? 'LAKE' : DISTRICTS.stadium.some(([x, z]) => x === bx && z === bz) ? 'STADIUM' : ''; if (lbl) { g.fillStyle = '#9b8f78'; g.font = `600 ${Math.max(8, s * 4)}px system-ui`; g.textAlign = 'center'; g.fillText(lbl, tx(bx), tz(bz)); } }
      g.fillStyle = '#e0b860'; g.font = `700 ${s * 3}px system-ui`; for (const [bx, bz] of DISTRICTS.bazaar) g.fillText('BAZAAR', tx(bx), tz(bz));
      for (const b of BUILDINGS) {
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#8a6d2c';
        g.fillRect(tx(b.x - b.w / 2), tz(b.z - b.d / 2), b.w * s, b.d * s);
        if (waypoint?.id === b.id) { g.strokeStyle = '#f0c868'; g.lineWidth = 4; g.strokeRect(tx(b.x - b.w / 2), tz(b.z - b.d / 2), b.w * s, b.d * s); }
        g.fillStyle = '#ecebe6';
        let fs = Math.max(9, s * 2.6); g.font = `700 ${fs}px system-ui`;
        while (g.measureText(b.short).width > b.w * s - 4 && fs > 7) { fs -= 0.5; g.font = `700 ${fs}px system-ui`; }
        const words = b.short.split(' ');
        if (g.measureText(b.short).width > b.w * s - 4 && words.length > 1) words.forEach((w, i) => g.fillText(w, tx(b.x), tz(b.z) + (i - (words.length - 1) / 2) * fs));
        else g.fillText(b.short, tx(b.x), tz(b.z));
      }
      g.fillStyle = '#9ce8be'; g.font = `700 ${s * 3}px system-ui`; g.fillText('COMPOUND SQUARE', tx(0), tz(-14));
      if (route && route.length > 1) { g.strokeStyle = '#f0c868'; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath(); route.forEach((p, i) => (i ? g.lineTo(tx(p.x), tz(p.z)) : g.moveTo(tx(p.x), tz(p.z)))); g.stroke(); }
      for (const n of npcs) if (n.keyNpc) { g.fillStyle = '#2fbf71'; g.beginPath(); g.arc(tx(n.pos.x), tz(n.pos.z), 5, 0, 7); g.fill(); }
      g.save(); g.translate(tx(player.pos.x), tz(player.pos.z)); g.rotate(Math.PI - player.yaw);
      g.fillStyle = '#f0c868'; g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 8); g.lineTo(0, 3); g.lineTo(-8, 8); g.closePath(); g.fill(); g.restore();
    };
    draw();
    cv.addEventListener('pointerdown', (e) => {
      const r = cv.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W / s - HALF, z = ((e.clientY - r.top) / r.height) * W / s - HALF;
      const b = BUILDINGS.find((b) => Math.abs(x - b.x) < b.w / 2 + 2 && Math.abs(z - b.z) < b.d / 2 + 2);
      if (b) { onSetWaypoint(b); this.close(); }
    });
    $(inner, '[data-list]').innerHTML = BUILDINGS.map((b) => `<button class="fw-btn sm" data-b="${b.id}" style="justify-content:space-between"><span>${esc(b.name)}</span></button>`).join('');
    $$(inner, '[data-b]').forEach((btn) => btn.addEventListener('click', () => { onSetWaypoint(BUILDINGS.find((b) => b.id === btn.dataset.b)); this.close(); }));
  }

  // ---------------------------------------------------------------- pause menu
  menu(ctx, tab = 'settings') {
    const tabs = [['settings', 'Settings'], ['journal', 'Journal'], ['controls', 'Controls'], ['account', 'Account']];
    const inner = el(`<div style="display:contents">
      <div class="panel-head"><div><div class="auth-kicker">Paused</div><div class="panel-title">FIN<span style="color:var(--fw-gold)">VORA</span></div></div><button class="close-x" data-close aria-label="Resume">✕</button></div>
      <div class="menu-tabs">${tabs.map(([k, l]) => `<button data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="panel-body" data-body></div>
      <div style="padding:0 1.15rem 1.1rem"><button class="fw-btn primary block" data-close>Resume</button></div>
    </div>`);
    this._modal(inner, { onClose: ctx.onClose });
    const body = $(inner, '[data-body]');
    const show = (k) => {
      $$(inner, '[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === k));
      body.innerHTML = '';
      body.appendChild(this[`_tab_${k}`](ctx));
    };
    $$(inner, '[data-tab]').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
    show(tab);
  }

  _tab_settings(ctx) {
    const s = ctx.settings;
    const n = el(`<div>
      <div class="section-h" style="margin-top:0">Graphics quality</div>
      <div class="seg">${Object.entries(GRAPHICS_PRESETS).map(([k, p]) => `<button data-g="${k}" class="${s.graphics === k ? 'on' : ''}">${p.label}</button>`).join('')}</div>
      <p class="muted" style="font-size:.82rem;margin:.5rem 0 0">Low suits phones and integrated graphics. Shadows and resolution change immediately; crowd size and anti-aliasing apply after a reload.</p>
      <div class="section-h">Camera</div>
      <div class="range-row"><label for="st-sens">Look sensitivity</label><output data-sv>${s.sensitivity.toFixed(1)}×</output><input id="st-sens" type="range" min="0.3" max="2.5" step="0.1" value="${s.sensitivity}"></div>
      <div class="toggle-row"><span>Invert vertical look</span><input type="checkbox" data-inv ${s.invertY ? 'checked' : ''}></div>
      <div class="toggle-row"><span>Show FPS counter</span><input type="checkbox" data-fps ${s.showFps ? 'checked' : ''}></div>
      <div class="section-h">Audio</div>
      <p class="muted" style="font-size:.85rem;margin:.2rem 0 0">No sound yet. Audio and its settings arrive in a later milestone.</p>
      <div data-reload class="hidden" style="margin-top:1rem"><button class="fw-btn block" data-rl>Reload now to apply all graphics changes</button></div>
    </div>`);
    $$(n, '[data-g]').forEach((b) => b.addEventListener('click', () => {
      $$(n, '[data-g]').forEach((x) => x.classList.toggle('on', x === b));
      const needsReload = ctx.onSettings({ graphics: b.dataset.g });
      $(n, '[data-reload]').classList.toggle('hidden', !needsReload);
    }));
    $(n, '[data-rl]').addEventListener('click', () => ctx.onReload());
    $(n, '#st-sens').addEventListener('input', (e) => { $(n, '[data-sv]').textContent = `${(+e.target.value).toFixed(1)}×`; ctx.onSettings({ sensitivity: +e.target.value }); });
    $(n, '[data-inv]').addEventListener('change', (e) => ctx.onSettings({ invertY: e.target.checked }));
    $(n, '[data-fps]').addEventListener('change', (e) => ctx.onSettings({ showFps: e.target.checked }));
    return n;
  }

  _tab_journal(ctx) {
    const items = ctx.journal;
    return el(`<div>
      <p class="muted" style="margin-top:0">Ideas you have picked up talking to people around FinVora. ${items.length} discovered so far.</p>
      ${items.length ? items.slice().reverse().map((i) => `<div class="journal-item"><b>${esc(i.title)}</b><div style="font-size:.9rem;margin-top:.25rem">${esc(i.summary)}</div><div class="muted" style="font-size:.75rem;margin-top:.3rem">From ${esc(i.from)}</div></div>`).join('')
        : '<div class="journal-item">Nothing yet. Walk up to anyone with a name tag and talk to them.</div>'}
    </div>`);
  }

  _tab_controls() {
    return el(`<div>
      <div class="section-h" style="margin-top:0">Keyboard and mouse</div>
      <div class="kbd-grid">
        <kbd>W A S D</kbd><span>Move (arrow keys also work)</span>
        <kbd>Shift</kbd><span>Run</span>
        <kbd>Space</kbd><span>Jump</span>
        <kbd>Drag mouse</kbd><span>Look around</span>
        <kbd>Wheel</kbd><span>Zoom camera</span>
        <kbd>E</kbd><span>Talk / enter building</span>
        <kbd>1–5</kbd><span>Pick a dialogue reply (or type a question)</span>
        <kbd>P</kbd><span>Portfolio and time controls</span>
        <kbd>M</kbd><span>City map</span>
        <kbd>J</kbd><span>Knowledge Journal</span>
        <kbd>Esc</kbd><span>Close / pause menu</span>
      </div>
      <div class="section-h">Touch</div>
      <div class="kbd-grid">
        <kbd>Left thumb</kbd><span>Virtual joystick to move</span>
        <kbd>Right drag</kbd><span>Look around</span>
        <kbd>TALK</kbd><span>Talk / enter when a prompt shows</span>
        <kbd>RUN</kbd><span>Toggle running</span>
      </div>
    </div>`);
  }

  _tab_account(ctx) {
    const p = ctx.profile;
    const n = el(`<div>
      <div class="grid-2">
        <div class="stat"><div class="k">Name</div><div class="v" style="font-family:var(--fw-font);font-size:1rem">${esc(p.fullName)}</div></div>
        <div class="stat"><div class="k">Player ID</div><div class="v" style="font-size:1rem">${esc(p.playerCode)}</div></div>
        <div class="stat"><div class="k">Email</div><div class="v" style="font-family:var(--fw-font);font-size:.95rem;word-break:break-all">${esc(p.email)}</div></div>
        <div class="stat"><div class="k">Saving</div><div class="v" style="font-family:var(--fw-font);font-size:.95rem">${p.mode === 'cloud' ? 'Cloud account' : 'Guest (this browser)'}</div></div>
        <div class="stat"><div class="k">Level · XP</div><div class="v" style="font-size:1rem">${p.level} · ${p.xp}</div></div>
        <div class="stat"><div class="k">Member since</div><div class="v" style="font-family:var(--fw-font);font-size:.95rem">${new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
      </div>
      ${p.mode === 'cloud' ? `
      <div class="section-h">Display name</div>
      <div style="display:flex;gap:.5rem"><input class="fw-input" data-name maxlength="80" value="${esc(p.fullName)}"><button class="fw-btn" data-savename>Save</button></div>
      <div class="section-h">Password</div>
      <button class="fw-btn block" data-reset>Email me a password reset link</button>` : `<p class="muted" style="font-size:.88rem">You are playing as a guest. Your progress is saved in this browser on this device. Optional accounts for playing across devices will come once FinVora is online.</p>`}
      <div data-msg></div>
      <div class="section-h">Session</div>
      <button class="fw-btn block" data-logout style="border-color:rgba(229,83,75,.45);color:#ffb1ab">${p.mode === 'cloud' ? 'Save and log out' : 'Save and return to the start screen'}</button>
    </div>`);
    const msg = (t, cls) => { $(n, '[data-msg]').innerHTML = `<div class="fw-msg ${cls}">${esc(t)}</div>`; };
    $(n, '[data-logout]').addEventListener('click', () => ctx.onLogout());
    if (p.mode === 'cloud') {
      $(n, '[data-savename]').addEventListener('click', async () => {
        try { await ctx.onRename($(n, '[data-name]').value); msg('Name updated.', 'ok'); } catch (e) { msg(e.message || 'Could not update name.', 'err'); }
      });
      $(n, '[data-reset]').addEventListener('click', async () => {
        try { await ctx.onPasswordReset(); msg(`Reset link sent to ${p.email}.`, 'ok'); } catch (e) { msg(e.message || 'Could not send reset email.', 'err'); }
      });
    }
    return n;
  }
}

export { hex };
