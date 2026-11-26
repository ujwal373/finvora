import { el, esc, $, $$ } from './dom.js';
import { formatINR, formatINR2, fmtNum, fmtPct } from '../config.js';
import { COMPANIES, ETFS, FUNDS, COMMODITIES } from '../sim/Market.js';
import { RATES, FD_SLABS, fdRate, emi, LIMITS, fyOf, daysBetween, yearsBetween, FinError, fdValue, rdValue } from '../sim/Finance.js';
import { CALCULATORS, calcById, defaults } from '../sim/calculators.js';
import { lineChart, spark } from './charts.js';
import { exhibit } from './Exhibits.js';
import { CARS, PAINTS, CLOTHES, CLOTH_COLORS, CAR_LOAN, INSURANCE_PCT, carValue, carById, clothById } from '../data/shop.js';
import { emiOf } from '../sim/calculators.js';
import { SIM_NOTE, cls, num, act, live } from './svcutil.js';
import { LIFE_FACTORIES, LIFE_TITLES } from './LifeServices.js';
export { SIM_NOTE };

// Working features inside buildings. Each factory returns { title, node, destroy }.
// ctx: { fin, changed(msg), journal }


const pct = (a, b) => (b ? (a / b - 1) * 100 : 0);
const retOver = (h, n) => (h.length > n ? pct(h[h.length - 1], h[h.length - 1 - n]) : null);

export function service(id, ctx) {
  if (id.startsWith('calc:')) return calcService(id.slice(5));
  const f = FACTORIES[id];
  if (!f) return { title: id, node: el('<div>Unavailable.</div>'), destroy() {} };
  return f(ctx);
}

export const SERVICE_TITLES = {
  'trade-stocks': 'Trade shares', 'trade-etfs': 'Trade ETFs', 'market-board': 'Market board', 'commodity-board': 'Commodity prices',
  'company-research': 'Company research', 'mf-invest': 'Invest in funds', 'mf-sip': 'SIPs', 'bank-deposits': 'FDs and RDs', 'bank-loans': 'Loans',
  'interest-wall': 'Interest Wall', 'doubling-lab': 'Doubling Lab', journal: 'Knowledge Journal', 'govt-schemes': 'Small savings schemes', nps: 'NPS',
  ...LIFE_TITLES, 'holding-periods': 'Holding period checker', 'car-showroom': 'Vehicles', 'clothing-store': 'Clothing and accessories', 'scam-lab': 'Scam-spotting lab', 'all-calcs': 'All calculators',
};
export const serviceTitle = (id) => (id.startsWith('calc:') ? calcById[id.slice(5)]?.title : SERVICE_TITLES[id]) || id;

// ---------------------------------------------------------------- generic tradable list (shares / ETFs)
function tradeList(ctx, kind) {
  const list = kind === 'stock' ? COMPANIES : ETFS;
  const key = (x) => x.symbol;
  let sel = key(list[0]);
  const node = el(`<div>${SIM_NOTE}<div class="split"><div class="pick" data-list></div><div data-detail></div></div></div>`);
  const render = () => {
    const m = ctx.fin.market;
    $(node, '[data-list]').innerHTML = list.map((x) => {
      const s = (m.stocks.find((q) => q.symbol === key(x)) || m.etfs.find((q) => q.symbol === key(x)));
      const ch = pct(s.price, s.prev), held = ctx.fin.qty(key(x));
      return `<button class="pick-row ${sel === key(x) ? 'on' : ''}" data-k="${key(x)}"><span><b>${esc(key(x))}</b><small>${esc(x.name)}</small></span><span class="r"><span class="mono">${fmtNum(s.price)}</span><small class="${cls(ch)}">${fmtPct(ch)}${held ? ` · ${fmtNum(held, 0)} held` : ''}</small></span></button>`;
    }).join('');
    $$(node, '[data-k]').forEach((b) => b.addEventListener('click', () => { sel = b.dataset.k; render(); }));
    const info = list.find((x) => key(x) === sel), price = m.price(sel), hist = m.history(sel);
    const q = ctx.fin.qty(sel), inv = ctx.fin.invested(sel);
    $(node, '[data-detail]').innerHTML = `
      <div class="det-head"><div><div class="det-name">${esc(info.name)}</div><div class="muted small">${esc(kind === 'stock' ? `${info.sector} · ${info.cap}` : info.desc)}</div></div><div class="r"><div class="mono big">${formatINR2(price)}</div><div class="small ${cls(retOver(hist, 1) || 0)}">${fmtPct(retOver(hist, 1) || 0)} today</div></div></div>
      ${lineChart([[sel, hist]], { height: 120, xLabels: `last ${hist.length} trading days` })}
      <div class="grid-3">${[['1 month', retOver(hist, 21)], ['6 months', retOver(hist, 126)], ['1 year', retOver(hist, 250)]].map(([l, v]) => `<div class="stat"><div class="k">${l}</div><div class="v ${v === null ? '' : cls(v)}">${v === null ? '—' : fmtPct(v)}</div></div>`).join('')}</div>
      ${q ? `<div class="holding">You hold <b>${fmtNum(q, 0)}</b> · avg cost ${formatINR2(inv / q)} · value ${formatINR(q * price)} · <span class="${cls(q * price - inv)}">P&L ${formatINR(q * price - inv)}</span></div>` : ''}
      <div class="order"><label class="fw-label" for="qty">Quantity (whole units)</label>
        <div class="order-row"><input id="qty" class="fw-input" type="number" min="1" step="1" value="1" inputmode="numeric"><button class="fw-btn green" data-buy>Buy</button><button class="fw-btn" data-sell ${q ? '' : 'disabled'}>Sell</button></div>
        <div class="muted small" data-est></div></div>
      <div class="muted small">Cash available ${formatINR(ctx.fin.cash)} · Orders fill instantly at the simulated price. No brokerage or taxes are charged in FinVora.</div>`;
    const qty = $(node, '#qty'), est = () => { $(node, '[data-est]').textContent = `Order value ≈ ${formatINR2((parseInt(qty.value, 10) || 0) * price)}`; };
    qty.addEventListener('input', est); est();
    $(node, '[data-buy]').addEventListener('click', () => act(ctx, () => ctx.fin.buyShares(sel, parseInt(qty.value, 10)), `Bought ${qty.value} ${sel}`) && render());
    $(node, '[data-sell]').addEventListener('click', () => act(ctx, () => ctx.fin.sellShares(sel, parseInt(qty.value, 10)), `Sold ${qty.value} ${sel}`) && render());
  };
  render();
  return { node, destroy: live(ctx, node, render) };
}

// ---------------------------------------------------------------- funds
function fundsService(ctx) {
  let sel = FUNDS[0].code;
  const node = el(`<div>${SIM_NOTE}<div class="split"><div class="pick" data-list></div><div data-detail></div></div></div>`);
  const render = () => {
    const m = ctx.fin.market;
    $(node, '[data-list]').innerHTML = FUNDS.map((f) => {
      const h = m.history(f.code), r = retOver(h, 250) ?? pct(h[h.length - 1], h[0]);
      const held = ctx.fin.qty(f.code);
      return `<button class="pick-row ${sel === f.code ? 'on' : ''}" data-k="${f.code}"><span><b>${esc(f.name.replace('AccoFinTra ', ''))}</b><small>${esc(f.category)} · ${esc(f.risk)} risk</small></span><span class="r"><span class="mono">${fmtNum(m.price(f.code), 4)}</span><small class="${cls(r)}">${fmtPct(r)}${held ? ' · held' : ''}</small></span></button>`;
    }).join('');
    $$(node, '[data-k]').forEach((b) => b.addEventListener('click', () => { sel = b.dataset.k; render(); }));
    const f = FUNDS.find((x) => x.code === sel), nav = m.price(sel), h = m.history(sel);
    const q = ctx.fin.qty(sel), inv = ctx.fin.invested(sel), rd = ctx.fin.redeemable(sel);
    $(node, '[data-detail]').innerHTML = `
      <div class="det-head"><div><div class="det-name">${esc(f.name)}</div><div class="muted small">${esc(f.category)} · Riskometer: ${esc(f.risk)} · Expense ratio ${(f.er * 100).toFixed(2)}% · Exit load ${f.exitLoad ? `${f.exitLoad * 100}% within 1 year` : 'nil'}${f.lockInYears ? ` · ${f.lockInYears}-year lock-in` : ''}</div></div><div class="r"><div class="mono big">₹${fmtNum(nav, 4)}</div><div class="small muted">NAV</div></div></div>
      ${lineChart([['NAV', h]], { height: 120, money: false, xLabels: `last ${h.length} trading days` })}
      <div class="grid-3">${[['1 month', retOver(h, 21)], ['6 months', retOver(h, 126)], ['1 year', retOver(h, 250)]].map(([l, v]) => `<div class="stat"><div class="k">${l}</div><div class="v ${v === null ? '' : cls(v)}">${v === null ? '—' : fmtPct(v)}</div></div>`).join('')}</div>
      ${q ? `<div class="holding">You hold <b>${fmtNum(q, 3)}</b> units · invested ${formatINR(inv)} · value ${formatINR(q * nav)} · <span class="${cls(q * nav - inv)}">P&L ${formatINR(q * nav - inv)}</span>${rd.locked ? ` · ${fmtNum(rd.locked, 3)} units locked (ELSS)` : ''}</div>` : ''}
      <div class="order"><label class="fw-label" for="amt">Lump sum amount (₹)</label>
        <div class="order-row"><input id="amt" class="fw-input" type="number" min="100" step="100" value="10000" inputmode="numeric"><button class="fw-btn green" data-buy>Invest</button></div>
        ${q ? `<label class="fw-label" for="units">Redeem units</label><div class="order-row"><input id="units" class="fw-input" type="number" min="0" step="0.001" value="${rd.free.toFixed(3)}"><button class="fw-btn" data-red>Redeem</button></div>` : ''}
      </div>
      <div class="muted small">Units = amount ÷ NAV. Past simulated returns say nothing about future returns. Cash available ${formatINR(ctx.fin.cash)}.</div>`;
    $(node, '[data-buy]').addEventListener('click', () => act(ctx, () => ctx.fin.buyFund(sel, num($(node, '#amt').value)), `Invested in ${f.name}`) && render());
    $(node, '[data-red]')?.addEventListener('click', () => act(ctx, () => ctx.fin.redeemFund(sel, Number($(node, '#units').value)), `Redeemed from ${f.name}`) && render());
  };
  render();
  return { node, destroy: live(ctx, node, render) };
}

function sipService(ctx) {
  const node = el(`<div>
    <p class="muted" style="margin-top:0">A SIP buys units automatically every month on the date you choose. Use the time controls in your Portfolio to fast-forward months and watch it work.</p>
    <div class="form-grid">
      <label>Fund<select class="fw-input" id="s-fund">${FUNDS.map((f) => `<option value="${f.code}">${esc(f.name)} (${esc(f.category)})</option>`).join('')}</select></label>
      <label>Monthly amount (₹)<input class="fw-input" id="s-amt" type="number" min="100" step="100" value="5000" inputmode="numeric"></label>
      <label>SIP date (1–28)<input class="fw-input" id="s-day" type="number" min="1" max="28" value="5" inputmode="numeric"></label>
      <label>Yearly step-up (%)<input class="fw-input" id="s-step" type="number" min="0" max="50" value="0" inputmode="numeric"></label>
    </div>
    <button class="fw-btn primary" data-start style="margin-top:.8rem">Start SIP</button>
    <div class="section-h">Your SIPs</div><div data-list></div>
  </div>`);
  const render = () => {
    const sips = ctx.fin.sips;
    $(node, '[data-list]').innerHTML = sips.length ? `<div class="tbl-wrap"><table class="board"><thead><tr><th>Fund</th><th class="r">Amount</th><th class="r">Day</th><th class="r">Paid</th><th>Next</th><th></th></tr></thead><tbody>${sips.map((s) => `<tr><td>${esc(s.name)}${s.stepUpPct ? ` <small class="muted">+${s.stepUpPct}%/yr</small>` : ''}</td><td class="r">${formatINR(s.amount)}</td><td class="r">${s.day}</td><td class="r">${s.count}</td><td>${s.active ? s.next : '<span class="muted">stopped</span>'}</td><td>${s.active ? `<button class="fw-btn sm" data-stop="${s.id}">Stop</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted">No SIPs yet.</div>';
    $$(node, '[data-stop]').forEach((b) => b.addEventListener('click', () => act(ctx, () => ctx.fin.stopSIP(b.dataset.stop), 'SIP stopped') && render()));
  };
  $(node, '[data-start]').addEventListener('click', () => act(ctx, () => ctx.fin.startSIP($(node, '#s-fund').value, num($(node, '#s-amt').value), num($(node, '#s-day').value), num($(node, '#s-step').value)), 'SIP started') && render());
  render();
  return { node, destroy: live(ctx, node, render) };
}

// ---------------------------------------------------------------- bank
function depositsService(ctx) {
  const node = el(`<div>
    <div class="muted small">FinVora Bank is fictional; its rates are illustrative, not any real bank's.</div>
    <div class="tbl-wrap"><table class="board"><thead><tr><th>Tenure</th>${FD_SLABS.map((s) => `<th class="r">${s.minM}–${s.maxM} m</th>`).join('')}</tr></thead><tbody><tr><td>Rate p.a.</td>${FD_SLABS.map((s) => `<td class="r">${(s.rate * 100).toFixed(2)}%</td>`).join('')}</tr></tbody></table></div>
    <div class="two">
      <div class="card-in"><div class="section-h" style="margin-top:0">Open a fixed deposit</div>
        <label class="fw-label">Amount (₹)</label><input class="fw-input" id="fd-a" type="number" min="1000" step="1000" value="100000" inputmode="numeric">
        <label class="fw-label">Tenure (months)</label><input class="fw-input" id="fd-m" type="number" min="1" max="120" value="12" inputmode="numeric">
        <div class="muted small" data-fdp></div><button class="fw-btn primary block" data-fd style="margin-top:.6rem">Open FD</button></div>
      <div class="card-in"><div class="section-h" style="margin-top:0">Open a recurring deposit</div>
        <label class="fw-label">Monthly instalment (₹)</label><input class="fw-input" id="rd-a" type="number" min="100" step="100" value="5000" inputmode="numeric">
        <label class="fw-label">Tenure (months)</label><input class="fw-input" id="rd-m" type="number" min="6" max="120" value="24" inputmode="numeric">
        <div class="muted small" data-rdp></div><button class="fw-btn primary block" data-rd style="margin-top:.6rem">Open RD</button></div>
    </div>
    <div class="section-h">Your deposits</div><div data-list></div>
  </div>`);
  const prev = () => {
    const a = num($(node, '#fd-a').value), mo = num($(node, '#fd-m').value), r = fdRate(mo);
    $(node, '[data-fdp]').textContent = mo ? `${(r * 100).toFixed(2)}% p.a. · maturity ≈ ${formatINR(fdValue(a, r, mo / 12))}` : '';
    const ra = num($(node, '#rd-a').value), rm = num($(node, '#rd-m').value);
    $(node, '[data-rdp]').textContent = rm >= 6 ? `${(fdRate(rm) * 100).toFixed(2)}% p.a. · you deposit ${formatINR(ra * rm)}` : '';
  };
  $$(node, 'input').forEach((i) => i.addEventListener('input', prev)); prev();
  const render = () => {
    const f = ctx.fin, d = f.date;
    const rows = [
      ...f.fds.map((x) => `<tr><td>${x.id}</td><td>FD ${x.months} m @ ${(x.rate * 100).toFixed(2)}%</td><td class="r">${formatINR(x.principal)}</td><td class="r">${x.status === 'active' ? formatINR(fdValue(x.principal, x.rate, yearsBetween(x.start, d))) : '—'}</td><td>${x.status === 'active' ? `matures ${x.maturity}` : x.status}</td><td>${x.status === 'active' ? `<button class="fw-btn sm" data-break="${x.id}">Break</button>` : ''}</td></tr>`),
      ...f.rds.map((x) => `<tr><td>${x.id}</td><td>RD ${formatINR(x.installment)}/m × ${x.months}</td><td class="r">${formatINR(x.paid.length * x.installment)}</td><td class="r">${x.status === 'active' ? formatINR(rdValue(x, d)) : formatINR(x.value || 0)}</td><td>${x.status === 'active' ? `${x.paid.length}/${x.months} paid${x.missed ? `, ${x.missed} missed` : ''}` : x.status}</td><td></td></tr>`),
    ];
    $(node, '[data-list]').innerHTML = rows.length ? `<div class="tbl-wrap"><table class="board"><thead><tr><th>ID</th><th>Deposit</th><th class="r">Put in</th><th class="r">Value now</th><th>Status</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table></div>` : '<div class="muted">No deposits yet.</div>';
    $$(node, '[data-break]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.breakFD(b.dataset.break), 'FD closed early (penalty applied)') && render()));
  };
  $(node, '[data-fd]').addEventListener('click', () => act(ctx, () => ctx.fin.openFD(num($(node, '#fd-a').value), num($(node, '#fd-m').value)), 'FD opened') && render());
  $(node, '[data-rd]').addEventListener('click', () => act(ctx, () => ctx.fin.openRD(num($(node, '#rd-a').value), num($(node, '#rd-m').value)), 'RD opened, first instalment paid') && render());
  render();
  return { node, destroy: live(ctx, node, render) };
}

function loansService(ctx) {
  const node = el(`<div>
    <div class="fw-msg info" style="margin-top:0">Borrowing is optional. Here you can see exactly what a loan costs before you ever take a real one. Your rate depends on your credit score: ${ctx.fin.loanRateFor() === null ? 'currently declined (score below 600)' : `${(ctx.fin.loanRateFor() * 100).toFixed(1)}% a year`} (FinVora Bank, illustrative).</div>
    <div class="two"><div class="card-in">
      <label class="fw-label">Loan amount (₹10,000 – ₹5,00,000)</label><input class="fw-input" id="ln-a" type="number" min="10000" max="500000" step="5000" value="100000" inputmode="numeric">
      <label class="fw-label">Tenure (6 – 60 months)</label><input class="fw-input" id="ln-m" type="number" min="6" max="60" value="24" inputmode="numeric">
      <div class="formula" data-prev style="margin-top:.6rem"></div>
      <button class="fw-btn primary block" data-take style="margin-top:.6rem">Take simulated loan</button></div>
      <div class="card-in"><div class="section-h" style="margin-top:0">Your loans</div><div data-list></div></div></div>
  </div>`);
  const prev = () => {
    const P = num($(node, '#ln-a').value), n = num($(node, '#ln-m').value);
    if (!(P > 0 && n > 0)) return;
    const e = emi(P, ctx.fin.loanRateFor() ?? RATES.personalLoan, n);
    $(node, '[data-prev]').textContent = `EMI = P × r × (1 + r)^n ÷ ((1 + r)^n − 1)\n= ${formatINR2(e)} a month for ${n} months\nTotal repaid ${formatINR(e * n)} · interest ${formatINR(e * n - P)}`;
  };
  $$(node, 'input').forEach((i) => i.addEventListener('input', prev)); prev();
  const render = () => {
    const ls = ctx.fin.loans;
    $(node, '[data-list]').innerHTML = ls.length ? ls.map((l) => `<div class="journal-item"><b>${l.id}</b> · ${formatINR(l.principal)} @ ${(l.rate * 100).toFixed(1)}% · ${l.status}<div class="small">EMI ${formatINR2(l.emi)} · paid ${l.paidCount}/${l.months}${l.missed ? ` · <span class="down">${l.missed} missed</span>` : ''} · outstanding ${formatINR(l.balance)} · interest paid ${formatINR(l.interestPaid)}</div>${l.status === 'active' ? `<div class="order-row" style="margin-top:.4rem"><input class="fw-input" type="number" min="1000" step="1000" value="${Math.min(50000, Math.round(l.balance))}" data-pp="${l.id}"><button class="fw-btn sm" data-pre="${l.id}">Prepay</button></div>` : ''}</div>`).join('') : '<div class="muted">No loans. EMIs are paid automatically from your wallet each month.</div>';
    $$(node, '[data-pre]').forEach((b) => b.addEventListener('click', () => act(ctx, () => ctx.fin.prepayLoan(b.dataset.pre, num($(node, `[data-pp="${b.dataset.pre}"]`).value)), 'Prepayment made') && render()));
  };
  $(node, '[data-take]').addEventListener('click', () => act(ctx, () => ctx.fin.takeLoan(num($(node, '#ln-a').value), num($(node, '#ln-m').value)), 'Loan credited to your wallet') && render());
  render();
  return { node, destroy: live(ctx, node, render) };
}

// ---------------------------------------------------------------- government schemes + NPS
function ageBlock(ctx, render) {
  const f = ctx.fin;
  const b = el(`<div class="card-in"><div class="small">Some schemes depend on age. Your simulation age: <b>${f.declaredAge ?? 'not set'}</b> <span class="muted">(used only inside the game)</span></div><div class="order-row" style="margin-top:.4rem"><input class="fw-input" type="number" min="18" max="100" value="${f.declaredAge ?? 30}" id="age"><button class="fw-btn sm" data-age>Set age</button></div></div>`);
  $(b, '[data-age]').addEventListener('click', () => act(ctx, () => f.declareAge(num($(b, '#age').value)), 'Simulation age updated') && render());
  return b;
}

function schemesService(ctx) {
  const node = el('<div></div>');
  const render = () => {
    const f = ctx.fin, fy = fyOf(f.date);
    node.innerHTML = `<div class="fw-msg info" style="margin-top:0">Rates notified by the Ministry of Finance for the ${RATES.asOf}: PPF ${(RATES.ppf * 100).toFixed(1)}%, NSC ${(RATES.nsc * 100).toFixed(1)}%, SCSS ${(RATES.scss * 100).toFixed(1)}%, Sukanya Samriddhi ${(RATES.ssy * 100).toFixed(1)}%. Real rates are reviewed every quarter; FinVora holds them constant (assumption).</div>
      <div data-age></div>
      <div class="two">
        <div class="card-in"><div class="section-h" style="margin-top:0">PPF · Public Provident Fund</div>
          <div class="small muted">15 years · ₹500 to ₹1.5 lakh per financial year · interest on the lowest balance between the 5th and month end, credited every 31 March · tax-free · partial withdrawal from year 7.</div>
          ${f.ppf ? `<div class="holding">Balance ${formatINR2(f.ppf.balance)} · deposited this FY (${fy}) ${formatINR(f.ppf.fy[fy] || 0)} · interest accrued so far ${formatINR2(f.ppf.accrued)} · opened ${f.ppf.opened}</div>` : ''}
          <div class="order-row"><input class="fw-input" id="ppf" type="number" min="500" step="500" value="${Math.max(500, LIMITS.ppf.maxPerFY - ((f.ppf && f.ppf.fy[fy]) || 0)) || 500}" inputmode="numeric"><button class="fw-btn green" data-ppf>Deposit</button></div></div>
        <div class="card-in"><div class="section-h" style="margin-top:0">NSC · National Savings Certificate</div>
          <div class="small muted">5 years · minimum ₹1,000 · rate fixed at purchase · compounds yearly · paid at maturity.</div>
          ${f.nsc.length ? `<div class="holding">${f.nsc.map((n) => `${n.id}: ${formatINR(n.amount)} → ${formatINR(n.maturityValue)} on ${n.maturity} (${n.status})`).join('<br>')}</div>` : ''}
          <div class="order-row"><input class="fw-input" id="nsc" type="number" min="1000" step="100" value="10000" inputmode="numeric"><button class="fw-btn green" data-nsc>Buy NSC</button></div></div>
        <div class="card-in"><div class="section-h" style="margin-top:0">SCSS · Senior Citizens' Savings Scheme</div>
          <div class="small muted">Age 60+ · up to ₹30 lakh · 5 years · interest paid to you every quarter.</div>
          ${f.scss.length ? `<div class="holding">${f.scss.map((s) => `${s.id}: ${formatINR(s.amount)} · ${s.status} · matures ${s.maturity}`).join('<br>')}</div>` : ''}
          <div class="order-row"><input class="fw-input" id="scss" type="number" min="1000" step="1000" value="100000" inputmode="numeric"><button class="fw-btn green" data-scss>Open SCSS</button></div></div>
        <div class="card-in"><div class="section-h" style="margin-top:0">SSY · Sukanya Samriddhi Yojana</div>
          <div class="small muted">For a girl below 10 · ₹250 to ₹1.5 lakh a year for 15 years · matures 21 years after opening · tax-free.</div>
          ${f.ssy ? `<div class="holding">Balance ${formatINR2(f.ssy.balance)} · opened ${f.ssy.opened} for a girl aged ${f.ssy.childAge} · this FY ${formatINR(f.ssy.fy[fy] || 0)}</div><div class="order-row"><input class="fw-input" id="ssy" type="number" min="250" step="250" value="10000" inputmode="numeric"><button class="fw-btn green" data-ssy>Deposit</button></div>`
            : `<div class="order-row"><input class="fw-input" id="ssy-age" type="number" min="0" max="9" value="3" title="Girl's age" inputmode="numeric"><input class="fw-input" id="ssy" type="number" min="250" step="250" value="10000" inputmode="numeric"><button class="fw-btn green" data-ssyo>Open</button></div><div class="small muted">First box: the girl's age (simulated). Second: first deposit.</div>`}</div>
      </div>`;
    $(node, '[data-age]').appendChild(ageBlock(ctx, render));
    $(node, '[data-ppf]').addEventListener('click', () => act(ctx, () => f.depositPPF(num($(node, '#ppf').value)), 'PPF deposit made') && render());
    $(node, '[data-nsc]').addEventListener('click', () => act(ctx, () => f.buyNSC(num($(node, '#nsc').value)), 'NSC bought') && render());
    $(node, '[data-scss]').addEventListener('click', () => act(ctx, () => f.openSCSS(num($(node, '#scss').value)), 'SCSS opened') && render());
    $(node, '[data-ssy]')?.addEventListener('click', () => act(ctx, () => f.depositSSY(num($(node, '#ssy').value)), 'SSY deposit made') && render());
    $(node, '[data-ssyo]')?.addEventListener('click', () => act(ctx, () => f.openSSY(num($(node, '#ssy-age').value), num($(node, '#ssy').value)), 'SSY account opened') && render());
  };
  render();
  return { node, destroy: live(ctx, node, render) };
}

function npsService(ctx) {
  const node = el('<div></div>');
  const render = () => {
    const f = ctx.fin, units = f.qty('NPS'), nav = f.market.price('NPS'), corpus = units * nav, inv = f.invested('NPS');
    node.innerHTML = `<div class="fw-msg info" style="margin-top:0">NPS invests in a mix of equity, corporate bonds and government securities, so returns are market-linked. Simulated scheme: 50% equity, 50% debt. Exit rules shown are for non-government subscribers as amended in December 2025.</div>
      <div data-age></div>
      ${lineChart([['NPS NAV', f.market.history('NPS')]], { height: 110, money: false })}
      <div class="grid-3"><div class="stat"><div class="k">Units</div><div class="v">${fmtNum(units, 4)}</div></div><div class="stat"><div class="k">Corpus</div><div class="v">${formatINR(corpus)}</div></div><div class="stat"><div class="k">Gain</div><div class="v ${cls(corpus - inv)}">${formatINR(corpus - inv)}</div></div></div>
      <div class="order-row" style="margin-top:.7rem"><input class="fw-input" id="nps" type="number" min="1000" step="1000" value="50000" inputmode="numeric"><button class="fw-btn green" data-nps>Contribute</button></div>
      <div class="section-h">Exit at 60 (simulation)</div>
      <div class="small">Up to 80% as a lump sum; at least 20% must buy an annuity (a pension). If the corpus is ₹8 lakh or less, all of it can be taken. Exit before 60 or before 15 years in NPS has stricter rules (not simulated).</div>
      ${units ? `<div class="order-row" style="margin-top:.4rem"><input class="fw-input" id="lump" type="number" min="0" max="100" value="${corpus <= 800000 ? 100 : 80}"><button class="fw-btn" data-exit>Exit with this % as lump sum</button></div>` : ''}`;
    $(node, '[data-age]').appendChild(ageBlock(ctx, render));
    $(node, '[data-nps]').addEventListener('click', () => act(ctx, () => f.contributeNPS(num($(node, '#nps').value)), 'NPS contribution made') && render());
    $(node, '[data-exit]')?.addEventListener('click', () => act(ctx, () => f.exitNPS(num($(node, '#lump').value)), 'NPS exit processed') && render());
  };
  render();
  return { node, destroy: live(ctx, node, render) };
}

// ---------------------------------------------------------------- boards and research
function marketBoard(ctx) {
  const node = el(`<div>${SIM_NOTE}<div data-idx></div><div class="tbl-wrap"><table class="board"><thead><tr><th>Symbol</th><th>Company</th><th class="r">Price</th><th class="r">Day</th><th>30 days</th></tr></thead><tbody></tbody></table></div><div class="section-h">Latest simulated news</div><div data-news></div></div>`);
  const render = () => {
    const m = ctx.fin.market, ih = m.indexHist;
    $(node, '[data-idx]').innerHTML = `<div class="det-head"><div><div class="det-name">FinVora Market Index</div><div class="small muted">All 8 companies, weighted by market value</div></div><div class="r"><div class="mono big">${fmtNum(ih[ih.length - 1])}</div><div class="small ${cls(retOver(ih, 1) || 0)}">${fmtPct(retOver(ih, 1) || 0)}</div></div></div>${lineChart([['Index', ih]], { height: 100, money: false })}`;
    $(node, 'tbody').innerHTML = COMPANIES.map((c) => { const s = m.stocks.find((x) => x.symbol === c.symbol), ch = pct(s.price, s.prev); return `<tr><td><b>${c.symbol}</b></td><td>${esc(c.name)}</td><td class="r">${fmtNum(s.price)}</td><td class="r ${cls(ch)}">${fmtPct(ch)}</td><td>${spark(s.hist.slice(-30), s.price >= s.hist[Math.max(0, s.hist.length - 30)])}</td></tr>`; }).join('');
    $(node, '[data-news]').innerHTML = m.news.length ? m.news.slice(-6).reverse().map((n) => `<div class="news"><span class="muted small">${n.date}</span> ${esc(n.text)} <span class="${cls(n.move)}">${fmtPct(n.move * 100, 1)}</span></div>`).join('') : '<div class="muted">No headlines yet. Time moves one simulated day about every 20 seconds.</div>';
  };
  render();
  return { node, destroy: live(ctx, node, render) };
}

function commodityBoard(ctx) {
  const node = el(`<div>${SIM_NOTE}<div data-c></div><p class="small muted">Gold and silver ETFs (FWGOLD, FWSILV) trade at the Stock Exchange and track these simulated prices. Crude oil is shown for context: in India it trades as futures, which is not simulated here.</p></div>`);
  const render = () => {
    const m = ctx.fin.market;
    $(node, '[data-c]').innerHTML = COMMODITIES.map((c) => { const s = m.commodities.find((x) => x.symbol === c.symbol), h = s.hist; return `<div class="card-in"><div class="det-head"><div><div class="det-name">${c.name}</div><div class="small muted">₹ ${c.unit} (simulated)</div></div><div class="r"><div class="mono big">${formatINR(s.price)}</div><div class="small ${cls(retOver(h, 250) ?? pct(h[h.length - 1], h[0]))}">${fmtPct(retOver(h, 250) ?? pct(h[h.length - 1], h[0]))} over ${Math.min(250, h.length - 1)} days</div></div></div>${lineChart([[c.name, h]], { height: 90 })}</div>`; }).join('');
  };
  render();
  return { node, destroy: live(ctx, node, render) };
}

function researchService(ctx) {
  const node = el(`<div>${SIM_NOTE}<p class="muted small">Fictional companies with fictional, simplified yearly numbers (₹ crore). Valuation ratios update as simulated prices move.</p><div class="tbl-wrap"><table class="board"><thead><tr><th>Company</th><th>Sector</th><th class="r">Mkt cap</th><th class="r">Revenue</th><th class="r">Profit</th><th class="r">Margin</th><th class="r">P/E</th><th class="r">Debt/Equity</th><th class="r">Div yield</th></tr></thead><tbody></tbody></table></div><div class="section-h">What the numbers hint at</div><div data-notes></div></div>`);
  const render = () => {
    const m = ctx.fin.market;
    $(node, 'tbody').innerHTML = COMPANIES.map((c) => { const p = m.price(c.symbol), mcap = p * c.shares, pe = c.profit > 0 ? mcap / c.profit : null; return `<tr><td><b>${c.symbol}</b> <small>${esc(c.name)}</small></td><td>${esc(c.sector)}</td><td class="r">${fmtNum(mcap, 0)}</td><td class="r">${fmtNum(c.revenue, 0)}</td><td class="r ${c.profit < 0 ? 'down' : ''}">${fmtNum(c.profit, 0)}</td><td class="r">${(c.profit / c.revenue * 100).toFixed(1)}%</td><td class="r">${pe ? pe.toFixed(1) : 'loss'}</td><td class="r ${c.debtEquity > 1.5 ? 'down' : ''}">${c.debtEquity.toFixed(2)}</td><td class="r">${c.divYield.toFixed(1)}%</td></tr>`; }).join('');
    $(node, '[data-notes]').innerHTML = COMPANIES.map((c) => {
      const flags = [];
      if (c.profit < 0) flags.push('loss-making');
      if (c.debtEquity > 1.5) flags.push('high debt');
      if (c.profit / c.revenue > 0.15) flags.push('high margin');
      if (c.cap === 'Small cap') flags.push('small cap: expect bigger swings');
      return flags.length ? `<div class="news"><b>${c.symbol}</b>: ${flags.join(', ')}</div>` : '';
    }).join('') + '<p class="small muted">These are prompts for thinking, not buy or sell signals.</p>';
  };
  render();
  return { node, destroy: live(ctx, node, render) };
}

function holdingPeriods(ctx) {
  const node = el('<div></div>');
  const render = () => {
    const f = ctx.fin, rows = [];
    for (const [code, lots] of Object.entries(f.holdings)) {
      const fund = FUNDS.find((x) => x.code === code);
      const equity = COMPANIES.some((c) => c.symbol === code) || code === 'FWIDX' || (fund && ['equity', 'hybrid'].includes(fund.kind) && (fund.equityShare ?? 1) >= 0.65);
      for (const l of lots) {
        const days = daysBetween(l.date, f.date), price = f.market.price(code), gain = (price - l.price) * l.qty;
        rows.push(`<tr><td><b>${code}</b></td><td>${l.date}</td><td class="r">${days}</td><td class="r ${cls(gain)}">${formatINR(gain)}</td><td>${equity ? (days > 365 ? '<span class="fw-chip green">Long term</span>' : `<span class="fw-chip">Short term · ${366 - days} days to long term</span>`) : '<span class="muted small">Different rules, ask the Tax Consultant</span>'}</td></tr>`);
      }
    }
    node.innerHTML = `<div class="fw-msg info" style="margin-top:0">Listed shares and equity funds held over 12 months: long-term gains above ₹1.25 lakh a year taxed at 12.5%. Held 12 months or less: short-term gains taxed at 20%. Budget 2026 kept these rates for FY 2026-27. FinVora money is virtual, so nothing here is actually taxed.</div>
      ${rows.length ? `<div class="tbl-wrap"><table class="board"><thead><tr><th>Code</th><th>Bought</th><th class="r">Days held</th><th class="r">Unrealised gain</th><th>Status</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>` : '<div class="muted">You have no holdings yet. Buy shares at the Stock Exchange or funds at the Mutual Fund Centre.</div>'}`;
  };
  render();
  return { node, destroy: live(ctx, node, render) };
}

const SCAMS = [
  { msg: 'SMS: "Dear customer, your account will be BLOCKED today. Update KYC now: bit.ly/kyc-upd8"', scam: true, why: 'Urgency plus a short link asking you to update KYC is classic phishing. Banks never block you through an SMS link.' },
  { msg: 'Your bank app shows: "Your FD of ₹50,000 has matured and been credited." You opened the app yourself.', scam: false, why: 'A notice inside the official app you opened yourself, about something you actually did, is normal.' },
  { msg: 'WhatsApp: "Join our VIP trading group. Guaranteed 5% profit every week. Only 10 seats left!"', scam: true, why: 'Guaranteed returns and scarcity pressure. No legitimate investment guarantees weekly profits.' },
  { msg: 'Caller: "I am from your bank. Tell me the OTP you just received so I can stop a fraud transaction."', scam: true, why: 'Banks never ask for your OTP. Hang up and call the number printed on your card.' },
  { msg: 'UPI app: "Receive ₹2,000 cashback. Enter your UPI PIN to accept."', scam: true, why: 'You never enter a UPI PIN to receive money. The PIN only ever sends money out.' },
  { msg: 'Your employer emails a payslip PDF on the usual date, from the usual company address, with no links.', scam: false, why: 'Expected, from a known sender, and asking for nothing. Still, stay alert to unexpected attachments.' },
  { msg: 'Loan app: "Instant ₹50,000 loan! Pay ₹1,999 processing fee first. Allow access to all contacts and photos."', scam: true, why: 'Upfront fees and demands for contacts and photos are hallmarks of illegal lending apps.' },
];
function scamLab(ctx) {
  let i = 0, score = 0;
  const node = el('<div></div>');
  const render = (feedback) => {
    if (i >= SCAMS.length) { node.innerHTML = `<div class="stat"><div class="k">Your score</div><div class="v">${score} / ${SCAMS.length}</div></div><p>Report real fraud fast: helpline 1930 or cybercrime.gov.in.</p><button class="fw-btn" data-again>Try again</button>`; $(node, '[data-again]').addEventListener('click', () => { i = 0; score = 0; render(); }); return; }
    const s = SCAMS[i];
    node.innerHTML = `<div class="muted small">Message ${i + 1} of ${SCAMS.length} · score ${score}</div><div class="scam-msg">${esc(s.msg)}</div>${feedback || `<div class="order-row"><button class="fw-btn" data-a="1" style="flex:1">Scam</button><button class="fw-btn" data-a="0" style="flex:1">Looks safe</button></div>`}`;
    $$(node, '[data-a]').forEach((b) => b.addEventListener('click', () => {
      const right = (b.dataset.a === '1') === s.scam; if (right) score++;
      render(`<div class="fw-msg ${right ? 'ok' : 'err'}">${right ? 'Correct.' : 'Not quite.'} ${esc(s.why)}</div><button class="fw-btn primary" data-next>Next</button>`);
      $(node, '[data-next]').addEventListener('click', () => { i++; render(); });
    }));
  };
  render();
  return { node, destroy() {} };
}

function journalService(ctx) {
  const items = ctx.journal();
  return { node: el(`<div><p class="muted" style="margin-top:0">${items.length} ideas collected from conversations around FinVora.</p>${items.length ? items.slice().reverse().map((x) => `<div class="journal-item"><b>${esc(x.title)}</b><div class="small">${esc(x.summary)}</div><div class="muted small">From ${esc(x.from)}</div></div>`).join('') : '<div class="journal-item">Nothing yet. Talk to anyone with a name tag.</div>'}</div>`), destroy() {} };
}

// ---------------------------------------------------------------- calculators
export function calcService(id) {
  const c = calcById[id];
  const vals = defaults(c);
  const node = el(`<div class="calc">
    <div class="calc-in">${c.inputs.map(([k, label, min, max, step, , unit]) => `<div class="range-row"><label for="c-${k}">${esc(label)}</label><input class="mini" type="number" id="n-${k}" min="${min}" max="${max}" step="${step}" value="${vals[k]}" aria-label="${esc(label)}"><input type="range" id="c-${k}" min="${min}" max="${max}" step="${step}" value="${vals[k]}"></div>`).join('')}</div>
    <div class="calc-out" data-out></div>
    <div class="section-h">Formula and your numbers</div><div class="formula" data-f></div>
    <div data-chart></div>
    <div class="disclaimer" data-notes></div>
  </div>`);
  const update = () => {
    const r = c.compute(vals);
    $(node, '[data-out]').innerHTML = r.outputs.map(([k, v, tone]) => `<div class="stat"><div class="k">${esc(k)}</div><div class="v ${tone === 'good' ? 'up' : tone === 'bad' ? 'down' : tone === 'gold' ? 'gold' : ''}">${typeof v === 'number' ? formatINR(v) : esc(v)}</div></div>`).join('');
    $(node, '[data-f]').textContent = r.formula;
    $(node, '[data-chart]').innerHTML = r.chart ? lineChart(r.chart.series, { height: 150, zero: true, xLabels: r.chart.labels === 'year' ? 'years →' : 'price at expiry →' }) : '';
    $(node, '[data-notes]').textContent = `Assumptions: ${r.notes} Educational illustration, not financial advice.`;
  };
  for (const [k, , min, max] of c.inputs) {
    const range = $(node, `#c-${k}`), box = $(node, `#n-${k}`);
    range.addEventListener('input', () => { vals[k] = Number(range.value); box.value = range.value; update(); });
    box.addEventListener('change', () => { let v = Number(box.value); if (!Number.isFinite(v)) v = vals[k]; v = Math.min(max, Math.max(min, v)); vals[k] = v; box.value = v; range.value = v; update(); });
  }
  update();
  return { title: c.title, node, destroy() {} };
}

function allCalcs() {
  const groups = [...new Set(CALCULATORS.map((c) => c.group))];
  const node = el(`<div>${groups.map((g) => `<div class="section-h">${esc(g)}</div><div class="chips">${CALCULATORS.filter((c) => c.group === g).map((c) => `<button class="chip" data-c="${c.id}">${esc(c.title)}</button>`).join('')}</div>`).join('')}<div data-slot style="margin-top:1rem"></div></div>`);
  $$(node, '[data-c]').forEach((b) => b.addEventListener('click', () => {
    $$(node, '[data-c]').forEach((x) => x.classList.toggle('on', x === b));
    const slot = $(node, '[data-slot]'); slot.innerHTML = '';
    const s = calcService(b.dataset.c);
    slot.append(el(`<div class="section-h">${esc(s.title)}</div>`), s.node);
    slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  return { node, destroy() {} };
}

// ---------------------------------------------------------------- showrooms
const hexCss = (n) => '#' + n.toString(16).padStart(6, '0');

function carShowroom(ctx) {
  const sel = { car: 'zippy', color: PAINTS[1].hex, mode: 'full', down: 20, months: 60 };
  const node = el('<div></div>');
  const render = () => {
    const f = ctx.fin, c = carById[sel.car];
    const ins = c.price * (c.model === 'scooter' ? INSURANCE_PCT.scooter : INSURANCE_PCT.default);
    const down = sel.mode === 'loan' ? c.price * sel.down / 100 : c.price;
    const loanAmt = c.price - down, e = sel.mode === 'loan' ? emiOf(loanAmt, CAR_LOAN.rate * 100, sel.months) : 0;
    const interest5 = sel.mode === 'loan' ? Math.max(0, e * Math.min(60, sel.months) - (loanAmt - balanceAfter(loanAmt, CAR_LOAN.rate, sel.months, Math.min(60, sel.months)))) : 0;
    let ins5 = 0; for (let y = 0; y < 5; y++) ins5 += carValue(c.price, y) * (c.model === 'scooter' ? INSURANCE_PCT.scooter : INSURANCE_PCT.default);
    const resale5 = carValue(c.price, 5), cost5 = c.price + interest5 + c.fuel * 60 + ins5 - resale5;
    node.innerHTML = `<div class="fw-msg info" style="margin-top:0">Fictional brands, illustrative prices. Paid from your virtual wallet. A vehicle loses value every year and costs money every month, so it shows up in net worth as a shrinking asset.</div>
      <div class="split"><div class="pick">${CARS.filter((x) => !x.gift).map((x) => `<button class="pick-row ${sel.car === x.id ? 'on' : ''}" data-car="${x.id}"><span><b>${esc(x.name)}</b><small>${esc(x.type)} · fuel ~${formatINR(x.fuel)}/month</small></span><span class="r"><span class="mono">${formatINR(x.price)}</span></span></button>`).join('')}</div>
      <div>
        <div class="det-head"><div><div class="det-name">${esc(c.name)}</div><div class="muted small">${esc(c.type)} · top speed in game ${c.maxKmh} km/h · ${esc(c.desc)}</div></div><div class="r"><div class="mono big">${formatINR(c.price)}</div></div></div>
        <div class="section-h" style="margin-top:.2rem">Colour</div>
        <div class="swatches">${PAINTS.map((p) => `<button class="sw ${sel.color === p.hex ? 'on' : ''}" data-col="${p.hex}" title="${esc(p.name)}" style="background:${hexCss(p.hex)}"></button>`).join('')}</div>
        <div class="section-h">Payment</div>
        <div class="seg" style="grid-template-columns:1fr 1fr"><button data-mode="full" class="${sel.mode === 'full' ? 'on' : ''}">Pay in full</button><button data-mode="loan" class="${sel.mode === 'loan' ? 'on' : ''}">Car loan @ ${(CAR_LOAN.rate * 100).toFixed(1)}%</button></div>
        ${sel.mode === 'loan' ? `<div class="range-row"><label>Down payment</label><output>${sel.down}% · ${formatINR(down)}</output><input type="range" min="${CAR_LOAN.minDownPct}" max="90" step="5" value="${sel.down}" data-down></div>
          <div class="range-row"><label>Tenure</label><output>${sel.months} months</output><input type="range" min="${CAR_LOAN.minMonths}" max="${CAR_LOAN.maxMonths}" step="12" value="${sel.months}" data-months></div>` : ''}
        <div class="grid-3" style="margin-top:.6rem">
          <div class="stat"><div class="k">Pay today</div><div class="v gold">${formatINR(down + ins)}</div><div class="small muted">incl. year-1 insurance ${formatINR(ins)}</div></div>
          ${sel.mode === 'loan' ? `<div class="stat"><div class="k">EMI</div><div class="v">${formatINR(e)}</div><div class="small muted">× ${sel.months} months</div></div>` : ''}
          <div class="stat"><div class="k">Running cost</div><div class="v">${formatINR(c.fuel)}/mo</div><div class="small muted">fuel or charging</div></div>
          <div class="stat"><div class="k">Value after 5 years</div><div class="v down">${formatINR(resale5)}</div></div>
          <div class="stat"><div class="k">True 5-year cost</div><div class="v down">${formatINR(cost5)}</div><div class="small muted">price + ${sel.mode === 'loan' ? 'interest + ' : ''}fuel + insurance − resale</div></div>
          <div class="stat"><div class="k">If invested instead</div><div class="v up">${formatINR(c.price * 1.1 ** 5)}</div><div class="small muted">the price at an assumed 10% a year</div></div>
        </div>
        <button class="fw-btn primary block" data-buy style="margin-top:.8rem">Buy ${esc(c.name)}</button>
        <div class="muted small" style="margin-top:.4rem">Cash available ${formatINR(f.cash)}. Depreciation used: about 15% in year 1, then 10% a year (illustrative).</div>
      </div></div>
      <div class="section-h">Your garage</div>
      <div>${f.garage.map((g) => { const sp = carById[g.catalogId]; return `<div class="news"><span class="sw-dot" style="background:${hexCss(g.color)}"></span><b>${esc(sp.name)}</b> ${g.gift ? '<span class="muted small">company car, running costs covered</span>' : `<span class="small">bought ${g.bought} for ${formatINR(g.price)} · worth now ${formatINR(f.carValueNow(g))}</span>`} <button class="fw-btn sm" data-use="${g.id}" style="margin-left:.5rem">${ctx.activeCar?.() === g.id ? 'Driving this' : 'Use this'}</button></div>`; }).join('')}</div>`;
    $$(node, '[data-car]').forEach((b) => b.addEventListener('click', () => { sel.car = b.dataset.car; render(); }));
    $$(node, '[data-col]').forEach((b) => b.addEventListener('click', () => { sel.color = Number(b.dataset.col); render(); }));
    $$(node, '[data-mode]').forEach((b) => b.addEventListener('click', () => { sel.mode = b.dataset.mode; render(); }));
    $(node, '[data-down]')?.addEventListener('change', (e) => { sel.down = Number(e.target.value); render(); });
    $(node, '[data-months]')?.addEventListener('change', (e) => { sel.months = Number(e.target.value); render(); });
    $(node, '[data-buy]').addEventListener('click', () => {
      const ok = act(ctx, () => { const car = ctx.fin.buyCar(sel.car, sel.color, sel.mode === 'loan' ? { loan: { downPct: sel.down, months: sel.months } } : {}); ctx.useCar?.(car.id); }, `${c.name} is yours. It's parked outside, ready to drive.`);
      if (ok) render();
    });
    $$(node, '[data-use]').forEach((b) => b.addEventListener('click', () => { ctx.useCar?.(b.dataset.use); render(); }));
  };
  render();
  return { node, destroy: live(ctx, node, render) };
}

function balanceAfter(P, annual, n, k) { const r = annual / 12, e = emiOf(P, annual * 100, n); let b = P; for (let i = 0; i < k; i++) b = b * (1 + r) - e; return Math.max(0, b); }

function clothingStore(ctx) {
  const pick = {};
  const node = el('<div></div>');
  const render = () => {
    const f = ctx.fin;
    node.innerHTML = `<div class="fw-msg info" style="margin-top:0">Paid from your virtual wallet. Clothes are spending, not assets: they don't count in your net worth. Changing your look with clothes you already own is free, from your phone.</div>
      <div class="shop-grid">${CLOTHES.map((it) => {
        const col = pick[it.id] ?? CLOTH_COLORS[0];
        const owned = f.wardrobe.find((w) => w.itemId === it.id && w.color === col);
        return `<div class="card-in shop-item"><div class="shop-swatch" style="background:${hexCss(col)}"></div><b>${esc(it.name)}</b><div class="small muted">${it.kind === 'top' ? 'Top' : it.kind === 'bottom' ? 'Bottoms' : 'Accessory'} · ${formatINR(it.price)}</div>
          <div class="swatches small-sw">${CLOTH_COLORS.map((c) => `<button class="sw ${c === col ? 'on' : ''}" data-it="${it.id}" data-c="${c}" style="background:${hexCss(c)}"></button>`).join('')}</div>
          ${owned ? `<button class="fw-btn sm block" data-wear="${owned.id}">Owned · wear it</button>` : `<button class="fw-btn sm green block" data-buy="${it.id}">Buy</button>`}</div>`;
      }).join('')}</div>
      <div class="muted small" style="margin-top:.6rem">Cash available ${formatINR(f.cash)} · ${f.wardrobe.length} items in your wardrobe.</div>`;
    $$(node, '[data-it]').forEach((b) => b.addEventListener('click', () => { pick[b.dataset.it] = Number(b.dataset.c); render(); }));
    $$(node, '[data-buy]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.buy, col = pick[id] ?? CLOTH_COLORS[0];
      if (act(ctx, () => { const w = ctx.fin.buyClothing(id, col); ctx.wear?.(w.id); }, `${clothById[id].name} bought and equipped`)) render();
    }));
    $$(node, '[data-wear]').forEach((b) => b.addEventListener('click', () => { ctx.wear?.(b.dataset.wear); ctx.changed('Equipped'); }));
  };
  render();
  return { node, destroy: live(ctx, node, render) };
}

const FACTORIES = {
  ...LIFE_FACTORIES,
  'car-showroom': carShowroom,
  'clothing-store': clothingStore,
  'trade-stocks': (ctx) => tradeList(ctx, 'stock'),
  'trade-etfs': (ctx) => tradeList(ctx, 'etf'),
  'market-board': marketBoard,
  'commodity-board': commodityBoard,
  'company-research': researchService,
  'mf-invest': fundsService,
  'mf-sip': sipService,
  'bank-deposits': depositsService,
  'bank-loans': loansService,
  'govt-schemes': schemesService,
  nps: npsService,
  'holding-periods': holdingPeriods,
  'scam-lab': scamLab,
  journal: journalService,
  'all-calcs': allCalcs,
  'interest-wall': () => exhibit('interest', {}),
  'doubling-lab': () => exhibit('rule72', {}),
};
