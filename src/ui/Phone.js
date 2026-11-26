import { el, esc, $, $$, initials } from './dom.js';
import { formatINR } from '../config.js';
import { KEY_NPCS, npcById } from '../data/npcs.js';
import { carById, clothById, SKIN_TONES, HAIR_COLORS, HAIR_STYLES } from '../data/shop.js';

// The in-game FinVora phone: Map, Wallet, Avatar, Garage, Messages, Contacts.
// Opened from the HUD phone button or the T key. Rendered inside a Panels modal.

const hexCss = (n) => '#' + n.toString(16).padStart(6, '0');
const APPS = [
  ['map', 'Map', '🗺'], ['wallet', 'Wallet', '₹'], ['avatar', 'Avatar', '☺'],
  ['garage', 'Garage', '🚗'], ['messages', 'Messages', '✉'], ['contacts', 'Contacts', '☎'],
];

export function openPhone(panels, g, startApp = null) {
  const inner = el(`<div class="phone"><div class="phone-bar"><span data-time></span><b>FIN<span style="color:var(--fw-gold)">VORA</span></b><button class="close-x sm" data-close aria-label="Put phone away">✕</button></div><div class="phone-screen" data-screen></div></div>`);
  const m = panels._modal(inner, { narrow: true, onClose: () => g.onPhoneClosed() });
  m.back.querySelector('.panel').classList.add('phone-panel');
  const screen = $(inner, '[data-screen]');
  let app = startApp;
  const head = (title) => `<div class="app-head"><button class="fw-btn sm ghost" data-home>‹ Home</button><b>${esc(title)}</b><span></span></div>`;
  const bindHome = () => $(screen, '[data-home]')?.addEventListener('click', () => { app = null; render(); });

  const render = () => {
    $(inner, '[data-time]').textContent = `${g.clockText()} · ${g.fin.date}`;
    g.onPhoneApp(app);
    if (!app) {
      const unread = g.state.messages.filter((x) => !x.read).length;
      screen.innerHTML = `<div class="home-greet">Hi ${esc(g.profile.fullName.split(' ')[0])}</div><div class="home-nw">Net worth ${formatINR(g.fin.snapshot().netWorth)}</div>
        <div class="app-grid">${APPS.map(([id, label, icon]) => `<button class="app" data-app="${id}"><span class="app-ic">${icon}${id === 'messages' && unread ? `<i class="badge">${unread}</i>` : ''}</span><span>${label}</span></button>`).join('')}</div>`;
      $$(screen, '[data-app]').forEach((b) => b.addEventListener('click', () => { app = b.dataset.app; render(); }));
      return;
    }
    if (app === 'map') { panels.close(); g.openMap(); return; }
    if (app === 'wallet') { panels.close(); g.openPortfolio(); return; }
    if (app === 'avatar') return avatar();
    if (app === 'garage') return garage();
    if (app === 'messages') return messages();
    if (app === 'contacts') return contacts();
  };

  function avatar() {
    const a = g.state.avatar, eq = a.equipped;
    const byKind = (k) => g.fin.wardrobe.filter((w) => clothById[w.itemId]?.kind === k);
    const slot = (w) => { const it = clothById[w.itemId]; return it.kind === 'acc' ? it.style : it.kind; };
    const isOn = (w) => eq[slot(w)] === w.id;
    const item = (w) => `<button class="ward ${isOn(w) ? 'on' : ''}" data-w="${w.id}"><span class="sw-dot" style="background:${hexCss(w.color)}"></span>${esc(clothById[w.itemId].name)}</button>`;
    screen.innerHTML = `${head('Avatar')}<p class="small muted" style="margin:.2rem 0 .6rem">Changes show on your character straight away. Look features are free; clothes come from the Style Studio.</p>
      <div class="section-h">Skin tone</div><div class="swatches">${SKIN_TONES.map((c) => `<button class="sw ${a.skin === c ? 'on' : ''}" data-skin="${c}" style="background:${hexCss(c)}"></button>`).join('')}</div>
      <div class="section-h">Hair colour</div><div class="swatches">${HAIR_COLORS.map((c) => `<button class="sw ${a.hair === c ? 'on' : ''}" data-hair="${c}" style="background:${hexCss(c)}"></button>`).join('')}</div>
      <div class="section-h">Hairstyle</div><div class="seg" style="grid-template-columns:repeat(4,1fr)">${HAIR_STYLES.map((s) => `<button class="${a.hairStyle === s ? 'on' : ''}" data-hs="${s}">${s}</button>`).join('')}</div>
      <div class="section-h">Wardrobe</div>
      ${g.fin.wardrobe.length ? `${[['top', 'Tops'], ['bottom', 'Bottoms'], ['acc', 'Accessories']].map(([k, l]) => byKind(k).length ? `<div class="small muted" style="margin:.4rem 0 .2rem">${l}</div><div class="chips">${byKind(k).map(item).join('')}</div>` : '').join('')}<button class="fw-btn sm" data-reset style="margin-top:.6rem">Back to the starter outfit</button>` : '<div class="small muted">Your wardrobe is empty.</div>'}
      <button class="fw-btn sm block" data-go="clothing-store" style="margin-top:.8rem">Directions to Style Studio</button>`;
    bindHome();
    const set = (patch) => { Object.assign(a, patch); g.applyAvatar(); avatar(); };
    $$(screen, '[data-skin]').forEach((b) => b.addEventListener('click', () => set({ skin: Number(b.dataset.skin) })));
    $$(screen, '[data-hair]').forEach((b) => b.addEventListener('click', () => set({ hair: Number(b.dataset.hair) })));
    $$(screen, '[data-hs]').forEach((b) => b.addEventListener('click', () => set({ hairStyle: b.dataset.hs })));
    $$(screen, '[data-w]').forEach((b) => b.addEventListener('click', () => { g.wear(b.dataset.w, true); avatar(); }));
    $(screen, '[data-reset]')?.addEventListener('click', () => { a.equipped = {}; g.applyAvatar(); avatar(); });
    $(screen, '[data-go]').addEventListener('click', () => { panels.close(); g.goTo(b0('clothing-store')); });
  }

  function garage() {
    screen.innerHTML = `${head('Garage')}<div>${g.fin.garage.map((c) => { const sp = carById[c.catalogId]; const active = g.state.activeCar === c.id; return `<div class="card-in"><div style="display:flex;justify-content:space-between;gap:.5rem;align-items:center"><div><span class="sw-dot" style="background:${hexCss(c.color)}"></span><b>${esc(sp.name)}</b><div class="small muted">${esc(sp.type)}${c.gift ? ' · company car' : ` · worth ${formatINR(g.fin.carValueNow(c))} · fuel ${formatINR(sp.fuel)}/mo`}</div></div>${active ? '<span class="fw-chip gold">In use</span>' : ''}</div>
      <div class="order-row">${active ? '' : `<button class="fw-btn sm" data-use="${c.id}">Use this</button>`}<button class="fw-btn sm" data-summon="${c.id}">Bring it to me</button></div></div>`; }).join('')}</div>
      <button class="fw-btn sm block" data-go style="margin-top:.8rem">Directions to the showroom</button>`;
    bindHome();
    $$(screen, '[data-use]').forEach((b) => b.addEventListener('click', () => { g.useCar(b.dataset.use); garage(); }));
    $$(screen, '[data-summon]').forEach((b) => b.addEventListener('click', () => { g.useCar(b.dataset.summon); g.summonCar(); panels.close(); }));
    $(screen, '[data-go]').addEventListener('click', () => { panels.close(); g.goTo(b0('car-showroom')); });
  }

  function messages() {
    const list = g.state.messages.slice().reverse();
    list.forEach((x) => (x.read = true));
    screen.innerHTML = `${head('Messages')}${list.length ? list.map((x) => {
      const who = x.scam ? x.sender : (npcById[x.from]?.name || 'FinVora');
      return `<div class="msg ${x.scam ? 'scamish' : ''}"><div class="msg-top"><b>${esc(who)}</b><span class="small muted">${esc(x.date)}</span></div><div>${esc(x.text)}</div>
        ${x.scam && !x.answered ? `<div class="order-row"><button class="fw-btn sm" data-rep="${x.id}">Report as scam</button><button class="fw-btn sm ghost" data-open="${x.id}">Open the link</button></div>` : ''}
        ${x.scam && x.answered ? `<div class="small ${x.correct ? 'up' : 'down'}">${x.correct ? 'Reported. Well spotted.' : 'That was a scam.'} ${esc(x.why)}</div>` : ''}</div>`;
    }).join('') : '<div class="small muted">No messages yet. Agents text you when SIPs run, EMIs are due, deposits mature or the market moves.</div>'}`;
    bindHome(); g.updatePhoneBadge();
    const answer = (id, correct) => { const x = g.state.messages.find((y) => y.id === id); x.answered = true; x.correct = correct; g.scamAnswered(correct); messages(); };
    $$(screen, '[data-rep]').forEach((b) => b.addEventListener('click', () => answer(b.dataset.rep, true)));
    $$(screen, '[data-open]').forEach((b) => b.addEventListener('click', () => answer(b.dataset.open, false)));
  }

  function contacts() {
    screen.innerHTML = `${head('Contacts')}<p class="small muted" style="margin:.2rem 0 .6rem">Call anyone to ask a question from wherever you are, or get walking directions.</p>${KEY_NPCS.map((n) => `<div class="contact"><span class="av" style="background:${hexCss(n.look.shirt)}">${esc(initials(n.name))}</span><div style="flex:1;min-width:0"><b>${esc(n.name)}</b><div class="small muted">${esc(n.role)}</div></div><button class="fw-btn sm" data-call="${n.id}">Call</button><button class="fw-btn sm ghost" data-dir="${n.id}">⌖</button></div>`).join('')}`;
    bindHome();
    $$(screen, '[data-call]').forEach((b) => b.addEventListener('click', () => { panels.close(); g.callNpc(b.dataset.call); }));
    $$(screen, '[data-dir]').forEach((b) => b.addEventListener('click', () => { panels.close(); g.findNpc(b.dataset.dir); }));
  }

  const b0 = (id) => id;
  render();
  m.cleanups.push(g.fin.on(() => { if (!app) render(); }));
}
