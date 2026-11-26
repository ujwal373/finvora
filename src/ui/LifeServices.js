// Building services for FinVora daily life: bank accounts and cards, credit bureau, jobs, EPF, bonds,
// gold, derivatives, insurance, property, tax, research results, IPOs, AccoFinTra investor relations,
// KYC and UPI, the academy, the supermarket and the fuel station.
import { el, esc, $, $$ } from './dom.js';
import { formatINR, formatINR2, fmtNum, fmtPct } from '../config.js';
import { COMPANIES } from '../sim/Market.js';
import { fyOf, daysBetween } from '../sim/Finance.js';
import { COURSES, courseById, JOBS, jobById, BONDS, TBILLS, FNO, PROPERTIES, propById, HOME_LOAN, ltvMax, LIFESTYLES } from '../sim/Life.js';
import { carById, FUEL, INSURANCE_PCT } from '../data/shop.js';
import { lineChart } from './charts.js';
import { SIM_NOTE, cls, num, act, live } from './svcutil.js';

const L = (ctx) => ctx.fin.life;
const lakh = (v) => `₹${(v / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} lakh`;
const chip = (t, kind = '') => `<span class="fw-chip ${kind}">${esc(t)}</span>`;
const PAY = { upi: 'UPI', debit: 'Debit card', card: 'Credit card' };

function view(ctx, draw) {
  const node = el('<div></div>');
  const render = () => { node.innerHTML = ''; draw(node, render); };
  render();
  return { node, destroy: live(ctx, node, render) };
}
function ageRow(ctx, render) {
  const f = ctx.fin;
  const b = el(`<div class="card-in"><div class="small">Your simulation age: <b>${f.declaredAge ?? 'not set (30 assumed)'}</b></div><div class="order-row" style="margin-top:.4rem"><input class="fw-input" type="number" min="18" max="100" value="${f.declaredAge ?? 30}" data-ag><button class="fw-btn sm" data-setage>Set age</button></div></div>`);
  $(b, '[data-setage]').addEventListener('click', () => act(ctx, () => f.declareAge(num($(b, '[data-ag]').value)), 'Age updated') && render());
  return b;
}
function payPicker(ctx, render) {
  const l = L(ctx);
  const b = el(`<div class="card-in"><div class="small muted">How you pay for bills, shopping and fuel</div><div class="seg" style="margin-top:.4rem">${Object.entries(PAY).map(([k, v]) => `<button data-pm="${k}" class="${l.payMethod === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>`);
  $$(b, '[data-pm]').forEach((x) => x.addEventListener('click', () => act(ctx, () => ctx.fin.setPayMethod(x.dataset.pm), `Paying by ${PAY[x.dataset.pm]}`) && render()));
  return b;
}

// ---------------------------------------------------------------- Bank: accounts, payments, credit card
function bankAccounts(ctx) {
  return view(ctx, (node, render) => {
    const f = ctx.fin, l = L(ctx), c = l.card;
    node.innerHTML = `<div class="fw-msg info" style="margin-top:0">FinVora Bank (fictional). Your wallet is a savings account paying 2.5% a year, credited every quarter. A debit card and UPI spend straight from it; a credit card borrows until the bill is due.</div>
      <div class="grid-3"><div class="stat"><div class="k">Savings balance</div><div class="v gold">${formatINR(f.cash)}</div></div><div class="stat"><div class="k">Interest so far this quarter</div><div class="v">${formatINR2(f.savingsAccrued)}</div></div><div class="stat"><div class="k">Credit score</div><div class="v">${f.creditScore().score ?? 'NH'}</div><div class="small muted">${esc(f.creditScore().label)}</div></div></div>
      <div data-pay></div>
      <div class="section-h">Credit card</div>
      ${c?.status === 'active' ? `<div class="card-in"><div class="det-head"><div><div class="det-name">FinVora Rewards Card${c.secured ? ' (secured)' : ''}</div><div class="small muted">Limit ${formatINR(c.limit)} · 1% cashback · statement on the 15th · ${c.due ? `due ${c.due}` : 'no bill due'}</div></div><div class="r"><div class="mono big ${c.balance > c.limit * 0.3 ? 'down' : ''}">${formatINR2(c.balance)}</div><div class="small muted">${Math.round(c.balance / c.limit * 100)}% of limit used</div></div></div>
          <div class="grid-3"><div class="stat"><div class="k">Last bill</div><div class="v">${formatINR(c.billed)}</div></div><div class="stat"><div class="k">Minimum due</div><div class="v">${formatINR(c.minDue)}</div></div><div class="stat"><div class="k">Cashback earned</div><div class="v up">${formatINR(c.rewards)}</div></div></div>
          <div class="small muted" style="margin:.5rem 0 .3rem">Autopay on the due date</div><div class="seg">${['full', 'min', 'off'].map((k) => `<button data-ap="${k}" class="${c.autopay === k ? 'on' : ''}">${{ full: 'Full bill', min: 'Minimum only', off: 'Off' }[k]}</button>`).join('')}</div>
          <div class="order-row" style="margin-top:.5rem"><input class="fw-input" type="number" min="1" value="${Math.ceil(c.balance) || 0}" data-cp><button class="fw-btn green" data-paycard>Pay now</button><button class="fw-btn" data-cardclose>Close card</button></div>
          <div class="small muted">Paying only the minimum keeps you out of trouble with the bureau, but the rest is charged about 3.5% a month (roughly 42% a year).</div></div>`
        : `<div class="card-in"><div class="small">Salaried? You get a limit of 3 months' gross pay. No job? A secured card against an FD of ₹20,000 or more. Applying needs a score of 650+ (or no history yet), and each application is a hard inquiry.</div><button class="fw-btn primary" data-apply style="margin-top:.5rem">Apply for a credit card</button></div>`}
      <div class="section-h">Recent payments</div>
      <div>${f.ledger.filter((e) => ['spend', 'bill', 'fuel', 'rent', 'card-pay', 'premium'].includes(e.type)).slice(-8).reverse().map((e) => `<div class="news"><span class="muted small">${e.date}</span> ${esc(e.name)} <b class="${e.amount < 0 ? 'down' : ''}">${e.amount ? formatINR2(e.amount) : ''}</b>${e.note ? ` <span class="small muted">${esc(e.note)}</span>` : ''}</div>`).join('') || '<div class="muted small">No payments yet.</div>'}</div>`;
    $(node, '[data-pay]').appendChild(payPicker(ctx, render));
    $(node, '[data-apply]')?.addEventListener('click', () => act(ctx, () => f.applyCard(), 'Credit card approved') && render());
    $$(node, '[data-ap]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.setAutopay(b.dataset.ap), 'Autopay updated') && render()));
    $(node, '[data-paycard]')?.addEventListener('click', () => act(ctx, () => f.payCard(num($(node, '[data-cp]').value)), 'Card payment made') && render());
    $(node, '[data-cardclose]')?.addEventListener('click', () => act(ctx, () => f.closeCard(), 'Card closed') && render());
  });
}

// ---------------------------------------------------------------- Credit Bureau
function creditReport(ctx) {
  return view(ctx, (node) => {
    const f = ctx.fin, s = f.creditScore(), l = L(ctx);
    const pctPos = s.score ? (s.score - 300) / 6 : 0;
    const accounts = [...f.loans.map((x) => `<tr><td>${x.id}</td><td>${{ personal: 'Personal loan', car: 'Car loan', home: 'Home loan', emergency: 'Emergency loan' }[x.kind] || x.kind}</td><td>${x.start}</td><td class="r">${formatINR(x.balance)}</td><td>${x.status}${x.missed ? ` · <span class="down">${x.missed} missed</span>` : ''}</td></tr>`),
      ...(l.card ? [`<tr><td>CARD</td><td>Credit card</td><td>${l.card.opened}</td><td class="r">${formatINR(l.card.balance)}</td><td>${l.card.status}</td></tr>`] : [])];
    node.innerHTML = `<div class="fw-msg info" style="margin-top:0">FinVora Credit Bureau (fictional, works like CIBIL). Scores run from 300 to 900. Lenders look at it before approving loans and cards, and better scores get cheaper loans. Checking your own score never lowers it.</div>
      <div class="card-in"><div class="det-head"><div><div class="det-name">${s.score ?? 'NH'}</div><div class="small muted">${esc(s.label)}</div></div><div class="r small">${s.score ? `Personal loan rate offered: ${f.loanRateFor() === null ? 'declined' : `${(f.loanRateFor() * 100).toFixed(1)}%`}` : 'Take a credit card or small loan and pay on time to start a history.'}</div></div>
        <div class="score-bar"><div style="left:${pctPos}%"></div></div><div class="small muted" style="display:flex;justify-content:space-between"><span>300</span><span>650</span><span>750</span><span>900</span></div></div>
      ${s.factors.length ? `<div class="section-h">What moves your score</div>${s.factors.map((x) => `<div class="news"><b>${esc(x.name)}</b> <span class="${cls(x.pts)}">${x.pts >= 0 ? '+' : ''}${x.pts}</span> <span class="small muted">${esc(x.text)}</span></div>`).join('')}` : ''}
      ${l.scoreHist.length > 1 ? lineChart([['Score', l.scoreHist.map((h) => h.score)]], { height: 90, money: false, xLabels: 'monthly' }) : ''}
      <div class="section-h">Accounts on your report</div>
      ${accounts.length ? `<div class="tbl-wrap"><table class="board"><thead><tr><th>ID</th><th>Type</th><th>Opened</th><th class="r">Outstanding</th><th>Status</th></tr></thead><tbody>${accounts.join('')}</tbody></table></div>` : '<div class="muted small">No credit accounts yet.</div>'}
      <div class="section-h">How to build a good score</div>
      <div class="small">Pay every EMI and card bill on time · keep card use under 30% of the limit · do not apply for many loans at once · keep old accounts open · a mix of secured and unsecured credit helps a little.</div>`;
  });
}

// ---------------------------------------------------------------- Job Centre and careers
function jobsService(ctx, only = null) {
  return view(ctx, (node, render) => {
    const f = ctx.fin, l = L(ctx), jb = l.job, ps = jb && f.payslip();
    const list = JOBS.filter((j) => !only || j.employer === only);
    node.innerHTML = `<div class="fw-msg info" style="margin-top:0">Pick a job and get a salary at the end of every month. Salaried jobs deduct PF (12% of basic), TDS (your estimated income tax) and professional tax before paying you. Employers and salaries are fictional. Raises of 7% come every year.</div>
      ${jb ? `<div class="card-in"><div class="det-head"><div><div class="det-name">${esc(jobById[jb.id].title)}</div><div class="small muted">${esc(jobById[jb.id].employer)} · since ${jb.start}</div></div><div class="r"><div class="mono big gold">${formatINR(ps.net)}</div><div class="small muted">take-home a month</div></div></div>
        <div class="tbl-wrap"><table class="board"><tbody>
          <tr><td>Gross salary</td><td class="r">${formatINR2(ps.gross)}</td></tr>
          ${ps.gig ? '<tr><td colspan="2" class="small muted">Gig payout: no deductions. Set money aside for tax.</td></tr>' : `<tr><td>Basic (50%)</td><td class="r">${formatINR2(ps.basic)}</td></tr>
          <tr><td>Your PF (12% of basic)</td><td class="r down">−${formatINR2(ps.epfEmp)}</td></tr>
          <tr><td>TDS (${l.regime} regime estimate)</td><td class="r down">−${formatINR2(ps.tds)}</td></tr>
          <tr><td>Professional tax</td><td class="r down">−${formatINR2(ps.pt)}</td></tr>
          <tr><td>Employer PF to your EPF (+ ₹${ps.eps} to pension)</td><td class="r up">+${formatINR2(ps.epfEr)}</td></tr>`}
          <tr><td><b>Net pay</b></td><td class="r"><b>${formatINR2(ps.net)}</b></td></tr></tbody></table></div>
        ${ps.gig ? '' : `<div class="small muted" style="margin:.5rem 0 .3rem">Tax regime for TDS (you can still choose either when filing)</div><div class="seg" style="grid-template-columns:1fr 1fr">${['new', 'old'].map((r) => `<button data-reg="${r}" class="${l.regime === r ? 'on' : ''}">${r === 'new' ? 'New regime (default)' : 'Old regime'}</button>`).join('')}</div>`}
        <button class="fw-btn" data-quit style="margin-top:.6rem">Resign</button></div>` : '<div class="card-in small">You are not working right now. Bills still arrive every month, so an income makes everything else easier.</div>'}
      <div class="section-h">${only ? `Careers at ${esc(only)}` : 'Open positions'}</div>
      <div class="shop-grid">${list.map((j) => { const miss = j.needs.filter((c) => !l.certs[c]); return `<div class="card-in shop-item"><b>${esc(j.title)}</b><div class="small muted">${esc(j.employer)}</div><div class="mono">${formatINR(j.gross)}<small>/month gross</small></div><div class="small">${esc(j.desc)}</div>${miss.length ? `<div class="small down">Needs: ${miss.map((c) => esc(courseById[c].title)).join(', ')}</div>` : ''}<button class="fw-btn sm ${miss.length ? '' : 'green'} block" data-job="${j.id}" ${jb?.id === j.id ? 'disabled' : ''}>${jb?.id === j.id ? 'Your job' : 'Apply'}</button></div>`; }).join('')}</div>`;
    $$(node, '[data-job]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.takeJob(b.dataset.job), 'Hired!') && render()));
    $(node, '[data-quit]')?.addEventListener('click', () => act(ctx, () => f.quitJob(), 'You resigned. Final salary paid.') && render());
    $$(node, '[data-reg]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.setRegime(b.dataset.reg), 'TDS regime updated') && render()));
  });
}

// ---------------------------------------------------------------- Retirement: EPF and annuities
function epfService(ctx) {
  return view(ctx, (node, render) => {
    const f = ctx.fin, l = L(ctx), e = l.epf;
    node.innerHTML = `<div class="fw-msg info" style="margin-top:0">EPF (Employees' Provident Fund) grows from your salary: 12% of basic from you, and from your employer 3.67% to EPF plus 8.33% (up to ₹1,250) to the pension scheme. Interest is 8.25% a year (rate declared for FY 2025-26), credited every 31 March.</div>
      <div data-age></div>
      <div class="grid-3"><div class="stat"><div class="k">EPF balance</div><div class="v gold">${formatINR2(e.balance)}</div></div><div class="stat"><div class="k">Interest accrued this year</div><div class="v">${formatINR2(e.accrued)}</div></div><div class="stat"><div class="k">Pension scheme (EPS)</div><div class="v">${formatINR(e.eps)}</div><div class="small muted">paid as a pension from 58</div></div></div>
      <button class="fw-btn" data-wd style="margin-top:.6rem">Withdraw EPF</button><div class="small muted">Allowed in full at 58, or after 2 months without a job.</div>
      <div class="section-h">Annuities (pensions)</div>
      ${l.annuities.length ? l.annuities.map((a) => `<div class="news">${a.id}: from ${esc(a.source)} · corpus ${formatINR(a.corpus)} · <b>${formatINR2(a.monthly)}</b> a month for life</div>`).join('') : '<div class="muted small">No annuity yet. At 60 you can turn a lump sum into a monthly pension, and NPS exits buy one automatically.</div>'}
      <div class="order-row" style="margin-top:.5rem"><input class="fw-input" type="number" min="100000" step="50000" value="1000000" data-an><button class="fw-btn green" data-buyan>Buy annuity (age 60+)</button></div>
      <div class="small muted">Illustrative annuity rate 6.5% a year. Annuity income is taxable and the capital is not returned.</div>`;
    $(node, '[data-age]').appendChild(ageRow(ctx, render));
    $(node, '[data-wd]').addEventListener('click', () => act(ctx, () => f.withdrawEPF(), 'EPF withdrawn') && render());
    $(node, '[data-buyan]').addEventListener('click', () => act(ctx, () => f.buyAnnuity(num($(node, '[data-an]').value)), 'Annuity started') && render());
  });
}

// ---------------------------------------------------------------- Bond Market
function bondDesk(ctx) {
  let sel = BONDS[1].code;
  return view(ctx, (node, render) => {
    const f = ctx.fin, l = L(ctx), b = BONDS.find((x) => x.code === sel) || TBILLS.find((x) => x.code === sel), isT = !!b.days;
    const price = isT ? f.tbillPrice(sel) : f.bondPriceNow(sel), q = isT ? 0 : f.bondQty(sel);
    const rate = (x) => ({ Sovereign: 'green', AAA: 'green', AA: '', BBB: 'red', BB: 'red' }[x] || '');
    node.innerHTML = `${SIM_NOTE}<div class="fw-msg info" style="margin-top:0">Face value ₹1,000 per bond. Government bond yield today: <b>${(l.gsec * 100).toFixed(2)}%</b> (simulated). When yields rise, bond prices fall. Lower ratings pay more because the issuer might default. In India, retail investors can buy G-Secs and T-bills directly through RBI Retail Direct.</div>
      <div class="split"><div class="pick">${[...BONDS, ...TBILLS].map((x) => { const p = x.days ? f.tbillPrice(x.code) : f.bondPriceNow(x.code); return `<button class="pick-row ${sel === x.code ? 'on' : ''}" data-b="${x.code}"><span><b>${esc(x.name)}</b><small>${x.days ? 'Treasury bill' : `${x.rating}`}${l.defaulted[x.code] ? ' · DEFAULTED' : ''}</small></span><span class="r"><span class="mono">${l.defaulted[x.code] ? '—' : fmtNum(p)}</span><small>${(f.bondYield(x.code) * 100).toFixed(2)}%</small></span></button>`; }).join('')}</div>
      <div><div class="det-head"><div><div class="det-name">${esc(b.name)}</div><div class="small muted">${isT ? 'Issued at a discount, pays ₹1,000 at maturity' : `${esc(b.issuer)} · ${chip(b.rating, rate(b.rating))} · coupon ${(b.coupon * 100).toFixed(2)}% paid every 6 months · matures ${f.bondMaturity(sel)}`}</div></div><div class="r"><div class="mono big">${l.defaulted[sel] ? 'Defaulted' : formatINR2(price)}</div><div class="small muted">yield ${(f.bondYield(sel) * 100).toFixed(2)}%</div></div></div>
        ${q ? `<div class="holding">You hold ${q} bonds · value ${formatINR(q * price)}</div>` : ''}
        <div class="order"><label class="fw-label">Number of bonds</label><div class="order-row"><input class="fw-input" type="number" min="1" value="10" data-qb><button class="fw-btn green" data-buy>Buy</button>${isT ? '' : `<button class="fw-btn" data-sell ${q ? '' : 'disabled'}>Sell</button>`}</div></div>
        <div class="small muted">${b.pd ? `Default risk (illustrative): about ${(b.pd * 100).toFixed(1)}% a year. If it happens, holders recover around 35%.` : 'Backed by the Government of India: no default risk in this game.'} Coupons and T-bill discounts are taxed at your slab rate. Selling before maturity gets a slightly lower dealer price.</div></div></div>
      ${l.tbills.filter((t) => !t.done).length ? `<div class="section-h">Your T-bills</div>${l.tbills.filter((t) => !t.done).map((t) => `<div class="news">${t.qty} × ${esc(TBILLS.find((x) => x.code === t.code).name)} bought at ${formatINR2(t.price)} · pays ${formatINR(t.qty * 1000)} on ${t.maturity}</div>`).join('')}` : ''}`;
    $$(node, '[data-b]').forEach((x) => x.addEventListener('click', () => { sel = x.dataset.b; render(); }));
    $(node, '[data-buy]').addEventListener('click', () => act(ctx, () => f.buyBond(sel, num($(node, '[data-qb]').value)), 'Bonds bought') && render());
    $(node, '[data-sell]')?.addEventListener('click', () => act(ctx, () => f.sellBond(sel, num($(node, '[data-qb]').value)), 'Bonds sold') && render());
  });
}

// ---------------------------------------------------------------- Commodities: digital gold, silver, SGB
function goldDesk(ctx) {
  return view(ctx, (node, render) => {
    const f = ctx.fin, l = L(ctx), gp = f.metalPrice('gold'), sp = f.metalPrice('silver');
    const card = (m, p) => { const h = l[m], val = h.grams * p * 0.985; return `<div class="card-in"><div class="det-head"><div><div class="det-name">Digital ${m}</div><div class="small muted">₹${fmtNum(p)} per gram (simulated)</div></div><div class="r"><div class="mono big">${fmtNum(h.grams, 4)} g</div><div class="small ${cls(val - h.cost)}">worth ${formatINR(val)}</div></div></div>
      <div class="order-row"><input class="fw-input" type="number" min="100" step="100" value="10000" data-amt="${m}"><button class="fw-btn green" data-bm="${m}">Buy ₹</button></div>
      <div class="order-row"><input class="fw-input" type="number" min="0.001" step="0.1" value="${Math.min(1, h.grams) || 1}" data-g="${m}"><button class="fw-btn" data-sm="${m}" ${h.grams ? '' : 'disabled'}>Sell grams</button></div></div>`; };
    node.innerHTML = `${SIM_NOTE}<div class="fw-msg info" style="margin-top:0">Digital gold lets you buy tiny amounts, stored in a vault by the seller. You pay 3% GST when buying and sell at a small spread. In real life digital gold is not regulated by SEBI or RBI, so gold ETFs and SGBs are the regulated routes.</div>
      <div class="two">${card('gold', gp)}${card('silver', sp)}</div>
      <div class="section-h">Sovereign Gold Bonds</div>
      <div class="card-in"><div class="small">Issued by RBI for the government. Priced per gram of gold, pays 2.5% a year interest on the issue price every 6 months, matures in 8 years, and the gain at maturity is tax-free. Simulated tranche: real new SGB issues have been paused since 2024.</div>
        <div class="order-row" style="margin-top:.4rem"><input class="fw-input" type="number" min="1" max="4000" value="5" data-sgb><button class="fw-btn green" data-bsgb>Buy grams at ₹${fmtNum(gp - 50)}</button></div>
        ${l.sgb.filter((s) => s.status === 'active').map((s) => `<div class="news">${s.id}: ${s.grams} g at ${formatINR2(s.price)} · matures ${s.maturity} · worth ${formatINR(s.grams * gp)} <button class="fw-btn sm" data-ssgb="${s.id}">Sell on exchange</button></div>`).join('')}</div>`;
    $$(node, '[data-bm]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.buyMetal(b.dataset.bm, num($(node, `[data-amt="${b.dataset.bm}"]`).value)), `Digital ${b.dataset.bm} bought`) && render()));
    $$(node, '[data-sm]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.sellMetal(b.dataset.sm, num($(node, `[data-g="${b.dataset.sm}"]`).value)), `Digital ${b.dataset.sm} sold`) && render()));
    $(node, '[data-bsgb]').addEventListener('click', () => act(ctx, () => f.buySGB(num($(node, '[data-sgb]').value)), 'Sovereign Gold Bonds bought') && render());
    $$(node, '[data-ssgb]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.sellSGB(b.dataset.ssgb), 'SGB sold') && render()));
  });
}

// ---------------------------------------------------------------- Derivatives (paper trading)
function fnoDesk(ctx) {
  const sel = { u: 'FV8', type: 'fut', side: 'long', k: 2, lots: 1 };
  return view(ctx, (node, render) => {
    const f = ctx.fin, l = L(ctx), spec = FNO.find((x) => x.u === sel.u), spot = f.fnoSpot(sel.u), strikes = f.fnoStrikes(sel.u), exp = f.fnoExpiry();
    const strike = strikes[sel.k], quote = f.fnoQuote(sel.u, sel.type, strike, exp), units = spec.lot * sel.lots;
    const need = sel.type === 'fut' ? quote * units * 0.15 : quote * units;
    node.innerHTML = `<div class="fw-msg err" style="margin-top:0"><b>High risk, learning only.</b> A SEBI study found that about 9 in 10 individual F&O traders lost money in FY22 to FY24. Futures can lose more than your margin. FinVora lets you buy options and trade futures with paper money; selling options is blocked.</div>
      ${l.certs.derivatives ? '' : '<div class="fw-msg info">Pass the Derivatives Risk course at the Financial Academy to unlock trading.</div>'}
      <div class="seg" style="grid-template-columns:repeat(${FNO.length},1fr)">${FNO.map((x) => `<button data-u="${x.u}" class="${sel.u === x.u ? 'on' : ''}">${x.u}</button>`).join('')}</div>
      <div class="det-head" style="margin-top:.5rem"><div><div class="det-name">${esc(spec.name)}</div><div class="small muted">Lot size ${spec.lot} · monthly expiry ${exp} (last Tuesday)</div></div><div class="r"><div class="mono big">${fmtNum(spot)}</div><div class="small muted">spot</div></div></div>
      <div class="seg" style="margin-top:.3rem">${['fut', 'call', 'put'].map((t) => `<button data-ty="${t}" class="${sel.type === t ? 'on' : ''}">${{ fut: 'Futures', call: 'Call option', put: 'Put option' }[t]}</button>`).join('')}</div>
      ${sel.type === 'fut' ? `<div class="seg" style="grid-template-columns:1fr 1fr;margin-top:.3rem"><button data-s="long" class="${sel.side === 'long' ? 'on' : ''}">Buy (expect rise)</button><button data-s="short" class="${sel.side === 'short' ? 'on' : ''}">Sell (expect fall)</button></div>`
        : `<div class="seg" style="grid-template-columns:repeat(5,1fr);margin-top:.3rem">${strikes.map((k, i) => `<button data-k="${i}" class="${sel.k === i ? 'on' : ''}">${fmtNum(k, 0)}</button>`).join('')}</div>`}
      <div class="grid-3" style="margin-top:.5rem"><div class="stat"><div class="k">${sel.type === 'fut' ? 'Futures price' : 'Premium per unit'}</div><div class="v">${fmtNum(quote)}</div></div><div class="stat"><div class="k">Contract value</div><div class="v">${formatINR((sel.type === 'fut' ? quote : strike) * units)}</div></div><div class="stat"><div class="k">${sel.type === 'fut' ? 'Margin (15%)' : 'You pay'}</div><div class="v gold">${formatINR(need)}</div></div></div>
      <div class="order-row" style="margin-top:.5rem"><label class="small">Lots</label><input class="fw-input" type="number" min="1" max="10" value="${sel.lots}" data-lots><button class="fw-btn primary" data-open>Place order</button></div>
      <div class="section-h">Open positions</div>
      ${l.fno.length ? `<div class="tbl-wrap"><table class="board"><thead><tr><th>Contract</th><th class="r">Entry</th><th class="r">Now</th><th class="r">P&L</th><th></th></tr></thead><tbody>${l.fno.map((p) => { const v = f.fnoValue(p); return `<tr><td>${p.side === 'short' ? 'Short ' : ''}${p.u} ${p.type === 'fut' ? 'FUT' : `${p.strike} ${p.type.toUpperCase()}`} × ${p.lots}<div class="small muted">exp ${p.expiry}</div></td><td class="r">${fmtNum(p.entry)}</td><td class="r">${fmtNum(v.mark)}</td><td class="r ${cls(v.pnl)}">${formatINR(v.pnl)}</td><td><button class="fw-btn sm" data-x="${p.id}">Exit</button></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="muted small">No positions.</div>'}
      <div class="small muted">Futures are marked to market daily; if losses reach 75% of margin the position is squared off automatically (a margin call). Everything settles at expiry. F&O profit is taxed as business income at slab rates.</div>`;
    $$(node, '[data-u]').forEach((b) => b.addEventListener('click', () => { sel.u = b.dataset.u; sel.k = 2; render(); }));
    $$(node, '[data-ty]').forEach((b) => b.addEventListener('click', () => { sel.type = b.dataset.ty; if (sel.type !== 'fut') sel.side = 'long'; render(); }));
    $$(node, '[data-s]').forEach((b) => b.addEventListener('click', () => { sel.side = b.dataset.s; render(); }));
    $$(node, '[data-k]').forEach((b) => b.addEventListener('click', () => { sel.k = Number(b.dataset.k); render(); }));
    $(node, '[data-lots]').addEventListener('change', (e) => { sel.lots = Math.max(1, Math.min(10, num(e.target.value) || 1)); render(); });
    $(node, '[data-open]').addEventListener('click', () => act(ctx, () => f.openFno({ u: sel.u, type: sel.type, side: sel.side, strike: sel.type === 'fut' ? null : strike, lots: sel.lots }), 'Order placed (paper trade)') && render());
    $$(node, '[data-x]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.closeFno(b.dataset.x), 'Position closed') && render()));
  });
}

// ---------------------------------------------------------------- Insurance
function insuranceDesk(ctx) {
  return view(ctx, (node, render) => {
    const f = ctx.fin, l = L(ctx), act0 = (k) => l.policies.find((p) => p.kind === k && p.active);
    const termCovers = [5000000, 10000000, 20000000], healthCovers = [500000, 1000000, 2500000];
    const pol = (k) => { const p = act0(k); return p ? `<div class="holding">Active since ${p.start} · cover ${lakh(p.cover)} · ${formatINR2(p.monthly)} a month${k === 'health' ? ` · claims ${p.claims} · used this year ${formatINR(p.used)}` : ''} <button class="fw-btn sm" data-cancel="${p.id}">Cancel</button></div>` : ''; };
    node.innerHTML = `<div class="fw-msg info" style="margin-top:0">Insurance is protection, not investment. Premiums are paid monthly from your wallet. Life happens in FinVora too: hospital visits and minor car accidents can come up any month, and only insured costs are paid for you. Premiums are illustrative and depend on age.</div>
      <div data-age></div>
      <div class="two">
        <div class="card-in"><div class="section-h" style="margin-top:0">Term life insurance</div><div class="small muted">Pays your family if you die during the term (to age 60). No payout if you survive, which is why it is cheap. Rule of thumb: 10 to 15 times yearly income.</div>${pol('term')}
          ${act0('term') ? '' : termCovers.map((c) => { const a = f.insuranceQuote('term', c); return a ? `<div class="news">${lakh(c)} cover · ${formatINR(a)} a year <button class="fw-btn sm green" data-buy="term:${c}">Buy</button></div>` : ''; }).join('') || '<div class="small down">Not available at your age.</div>'}</div>
        <div class="card-in"><div class="section-h" style="margin-top:0">Health insurance</div><div class="small muted">Pays hospital bills up to the cover each year. 30-day waiting period for illness. Premiums count for the old-regime health deduction.</div>${pol('health')}
          ${act0('health') ? '' : healthCovers.map((c) => `<div class="news">${lakh(c)} cover · ${formatINR(f.insuranceQuote('health', c))} a year <button class="fw-btn sm green" data-buy="health:${c}">Buy</button></div>`).join('')}</div>
      </div>
      <div class="section-h">Motor insurance (your vehicles)</div>
      ${f.garage.map((g) => { const s = carById[g.catalogId]; return `<div class="news"><b>${esc(s.name)}</b> ${g.gift ? '<span class="small muted">company car, insured by AccoFinTra</span>' : `<span class="small">renews yearly · about ${formatINR(f.carValueNow(g) * (s.model === 'scooter' ? INSURANCE_PCT.scooter : INSURANCE_PCT.default) * (g.zeroDep ? 1.15 : 1))} a year · zero-dep ${g.zeroDep ? chip('on', 'green') : chip('off')}</span> <button class="fw-btn sm" data-zd="${g.id}">${g.zeroDep ? 'Remove zero-dep' : 'Add zero-dep (+15%)'}</button>`}</div>`; }).join('')}
      <div class="small muted">Without zero-depreciation cover you pay about 30% of parts costs on every claim, plus a ₹1,000 compulsory deductible.</div>
      <div class="section-h">Recent life events</div>
      ${f.ledger.filter((e) => e.type === 'event').slice(-5).reverse().map((e) => `<div class="news"><span class="muted small">${e.date}</span> ${esc(e.name)} <span class="small muted">${esc(e.note || '')}</span></div>`).join('') || '<div class="muted small">Nothing yet. Fingers crossed.</div>'}`;
    $(node, '[data-age]').appendChild(ageRow(ctx, render));
    $$(node, '[data-buy]').forEach((b) => b.addEventListener('click', () => { const [k, c] = b.dataset.buy.split(':'); act(ctx, () => f.buyPolicy(k, Number(c)), 'Policy issued') && render(); }));
    $$(node, '[data-cancel]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.cancelPolicy(b.dataset.cancel), 'Policy cancelled') && render()));
    $$(node, '[data-zd]').forEach((b) => b.addEventListener('click', () => { const g = f.garage.find((x) => x.id === b.dataset.zd); act(ctx, () => f.setZeroDep(g.id, !g.zeroDep), 'Motor cover updated') && render(); }));
  });
}

// ---------------------------------------------------------------- Real estate
function propertyDesk(ctx) {
  const sel = { id: '2bhk', loan: 75, years: 20 };
  return view(ctx, (node, render) => {
    const f = ctx.fin, l = L(ctx), t = propById[sel.id], price = t.price * l.propIdx, max = ltvMax(price) * 100;
    if (sel.loan > max) sel.loan = max;
    const loanAmt = price * sel.loan / 100, e = loanAmt ? (loanAmt * (HOME_LOAN.rate / 12) * (1 + HOME_LOAN.rate / 12) ** (sel.years * 12)) / ((1 + HOME_LOAN.rate / 12) ** (sel.years * 12) - 1) : 0;
    const stamp = price * 0.06, reg = Math.min(30000, price * 0.01), today = price - loanAmt + stamp + reg;
    node.innerHTML = `<div class="fw-msg info" style="margin-top:0">FinVora property prices (simulated index ${(l.propIdx * 100).toFixed(1)}, started at 100). Buying costs 6% stamp duty plus 1% registration (capped at ₹30,000), similar to Mumbai. Home loans follow RBI loan-to-value caps: 90% up to ₹30 lakh, 80% up to ₹75 lakh, 75% above.</div>
      <div class="split"><div class="pick">${PROPERTIES.map((p) => `<button class="pick-row ${sel.id === p.id ? 'on' : ''}" data-p="${p.id}"><span><b>${esc(p.name)}</b><small>${p.area} sq ft · rent ~${formatINR(p.rent * l.propIdx)}/mo</small></span><span class="r"><span class="mono">${lakh(p.price * l.propIdx)}</span></span></button>`).join('')}</div>
      <div><div class="det-head"><div><div class="det-name">${esc(t.name)}</div><div class="small muted">Rental yield about ${(t.rent * 12 / t.price * 100).toFixed(1)}% a year before costs · maintenance ${formatINR(t.maint)}/mo</div></div><div class="r"><div class="mono big">${lakh(price)}</div></div></div>
        <div class="range-row"><label>Home loan</label><output>${sel.loan}% · ${lakh(loanAmt)}</output><input type="range" min="0" max="${max}" step="5" value="${sel.loan}" data-ln></div>
        <div class="range-row"><label>Tenure</label><output>${sel.years} years @ ${(HOME_LOAN.rate * 100).toFixed(1)}%</output><input type="range" min="5" max="30" step="1" value="${sel.years}" data-yr></div>
        <div class="grid-3"><div class="stat"><div class="k">Pay today</div><div class="v gold">${formatINR(today)}</div><div class="small muted">down payment + stamp + registration</div></div><div class="stat"><div class="k">EMI</div><div class="v">${formatINR(e)}</div></div><div class="stat"><div class="k">Total interest</div><div class="v down">${formatINR(e * sel.years * 12 - loanAmt)}</div></div></div>
        <button class="fw-btn primary block" data-buyp style="margin-top:.6rem">Buy this property</button>
        ${sel.id !== 'shop' ? `<button class="fw-btn block" data-rent style="margin-top:.4rem">Rent it to live in instead (${formatINR(t.rent * l.propIdx)}/mo + 3 months deposit)</button>` : ''}</div></div>
      <div class="section-h">Your properties</div>
      ${l.props.length ? l.props.map((p) => { const pt = propById[p.typeId], v = f.propValue(p); return `<div class="card-in"><b>${esc(pt.name)}</b> <span class="small muted">bought ${p.bought} for ${lakh(p.price)}</span> · worth <b class="${cls(v - p.price)}">${lakh(v)}</b>${p.loanId ? ` · loan ${p.loanId}` : ''}<div class="seg" style="margin-top:.4rem">${['self', 'rented', 'vacant'].map((u) => `<button data-use="${p.id}:${u}" class="${p.use === u ? 'on' : ''}">${{ self: 'Live here', rented: p.use === 'rented' && p.tenantFrom > f.date ? `Finding tenant…` : 'Rent out', vacant: 'Vacant' }[u]}</button>`).join('')}</div><button class="fw-btn sm" data-sellp="${p.id}" style="margin-top:.4rem">Sell (1% brokerage)</button></div>`; }).join('') : '<div class="muted small">You do not own property yet.</div>'}
      ${l.renting ? `<div class="news">You rent ${esc(propById[l.renting.typeId].name)} for ${formatINR(l.renting.rent)} a month since ${l.renting.since} · deposit ${formatINR(l.renting.deposit)} <button class="fw-btn sm" data-moveout>Move out</button></div>` : ''}
      <div class="section-h">REIT: FinVora Commercial REIT</div>
      <div class="card-in"><div class="small">A REIT owns rented office buildings and pays out most of its rent. Buy from one unit, sell any day on the exchange. Distributions about 7% a year, paid quarterly.</div>
        <div class="det-head"><div class="mono big">${formatINR2(l.reit.price)}</div><div class="r small">You hold ${f.reitUnits()} units</div></div>${lineChart([['REIT', l.reit.hist]], { height: 70 })}
        <div class="order-row"><input class="fw-input" type="number" min="330" step="330" value="10000" data-ra><button class="fw-btn green" data-buyr>Buy ₹</button><input class="fw-input" type="number" min="1" value="${f.reitUnits() || 1}" data-ru><button class="fw-btn" data-sellr ${f.reitUnits() ? '' : 'disabled'}>Sell units</button></div></div>`;
    $$(node, '[data-p]').forEach((b) => b.addEventListener('click', () => { sel.id = b.dataset.p; render(); }));
    $(node, '[data-ln]').addEventListener('change', (ev) => { sel.loan = Number(ev.target.value); render(); });
    $(node, '[data-yr]').addEventListener('change', (ev) => { sel.years = Number(ev.target.value); render(); });
    $(node, '[data-buyp]').addEventListener('click', () => act(ctx, () => f.buyProperty(sel.id, { loanPct: sel.loan, months: sel.years * 12 }), 'Property registered in your name') && render());
    $(node, '[data-rent]')?.addEventListener('click', () => act(ctx, () => f.rentHome(sel.id), 'Rental agreement signed') && render());
    $$(node, '[data-use]').forEach((b) => b.addEventListener('click', () => { const [id, u] = b.dataset.use.split(':'); act(ctx, () => f.setPropertyUse(id, u), 'Updated') && render(); }));
    $$(node, '[data-sellp]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.sellProperty(b.dataset.sellp), 'Property sold') && render()));
    $(node, '[data-moveout]')?.addEventListener('click', () => act(ctx, () => f.stopRenting(), 'Moved out; deposit refunded') && render());
    $(node, '[data-buyr]').addEventListener('click', () => act(ctx, () => f.buyReit(num($(node, '[data-ra]').value)), 'REIT units bought') && render());
    $(node, '[data-sellr]').addEventListener('click', () => act(ctx, () => f.sellReit(num($(node, '[data-ru]').value)), 'REIT units sold') && render());
  });
}

// ---------------------------------------------------------------- Tax Office
function taxFiling(ctx) {
  let showFy = null;
  return view(ctx, (node, render) => {
    const f = ctx.fin, cur = fyOf(f.date), years = [...new Set([...Object.keys(L(ctx).fy), cur])].sort();
    const fy = showFy && years.includes(showFy) ? showFy : (years.find((y) => y < cur && !L(ctx).filed[y]) || cur);
    const r = f.taxReport(fy), canFile = f.date > r.end && !r.filed, row = (k, v, c = '') => `<tr><td>${k}</td><td class="r ${c}">${v}</td></tr>`;
    node.innerHTML = `<div class="fw-msg info" style="margin-top:0">FY 2026-27 slabs (unchanged by Budget 2026). New regime: nil up to ₹4 lakh, then 5% to 30%, no tax up to ₹12 lakh after the rebate, standard deduction ₹75,000. Old regime: 5/20/30% with the 80C (₹1.5 lakh), health insurance, and home loan interest deductions, standard deduction ₹50,000. 4% cess on top. From 1 April 2026 the Income-tax Act, 2025 applies; section numbers changed but these rules carried over. Surcharge above ₹50 lakh is not simulated.</div>
      <div class="seg" style="grid-template-columns:repeat(${years.length},1fr)">${years.map((y) => `<button data-fy="${y}" class="${y === fy ? 'on' : ''}">FY ${y}${y === cur ? ' (now)' : L(ctx).filed[y] ? ' ✓' : ''}</button>`).join('')}</div>
      <div class="two" style="margin-top:.5rem"><div class="tbl-wrap"><table class="board"><tbody>
        ${row('Salary (gross)', formatINR(r.salary))}${r.gig ? row('Gig / freelance income', formatINR(r.gig)) : ''}${row('Interest (savings, FD, bonds)', formatINR(r.interest))}${row('Dividends and REIT payouts', formatINR(r.dividends))}${r.rent ? row('Rent received (30% deduction applied)', formatINR(r.rent)) : ''}${r.fno ? row('F&O profit (business income)', formatINR(r.fno), cls(r.fno)) : ''}${r.pension ? row('Pension (annuity)', formatINR(r.pension)) : ''}
        ${row('Equity short-term gains (20%)', formatINR(r.eqST), cls(r.eqST))}${row('Equity long-term gains (12.5% above ₹1.25 lakh)', formatINR(r.eqLT), cls(r.eqLT))}${row('Other long-term gains (12.5%)', formatINR(r.otherLT), cls(r.otherLT))}
        ${row('80C investments counted (old regime)', formatINR(r.c80))}${row('Health premium deduction (old)', formatINR(r.d80))}${row('Home loan interest (old)', formatINR(r.homeInt))}${row('TDS already paid', formatINR(r.tds))}</tbody></table></div>
        <div><div class="grid-3" style="grid-template-columns:1fr 1fr"><div class="stat ${r.better === 'new' ? 'best' : ''}"><div class="k">New regime</div><div class="v">${formatINR(r.new.tax)}</div><div class="small muted">taxable ${formatINR(r.new.taxable)}</div></div><div class="stat ${r.better === 'old' ? 'best' : ''}"><div class="k">Old regime</div><div class="v">${formatINR(r.old.tax)}</div><div class="small muted">taxable ${formatINR(r.old.taxable)}</div></div></div>
          <div class="small" style="margin:.5rem 0">The ${r.better} regime is cheaper for you by ${formatINR(Math.abs(r.new.tax - r.old.tax))}. Balance after TDS: <b class="${cls(r.tds - r[r.better].tax)}">${r.tds >= r[r.better].tax ? `refund ${formatINR(r.tds - r[r.better].tax)}` : `pay ${formatINR(r[r.better].tax - r.tds)}`}</b>.</div>
          ${r.filed ? `<div class="fw-msg ok">Filed on ${r.filed.date} under the ${r.filed.regime} regime.${r.filed.late ? ` Late fee ₹${r.filed.late}.` : ''}</div>` : canFile ? `<div class="small">Due date ${r.due}${f.date > r.due ? ' <span class="down">(passed: a late fee applies)</span>' : ''}</div><div class="seg" style="grid-template-columns:1fr 1fr;margin-top:.4rem"><button data-file="new">File: new regime</button><button data-file="old">File: old regime</button></div>` : `<div class="small muted">This year is still running. You can file from 1 April ${Number(fy.slice(0, 4)) + 1}, due ${r.due}. These are estimates so far.</div>`}</div></div>
      <div class="section-h">Capital gains statement</div>
      ${L(ctx).gains.filter((g) => fyOf(g.date) === fy).length ? `<div class="tbl-wrap"><table class="board"><thead><tr><th>Sold</th><th>Asset</th><th class="r">Qty</th><th>Bought</th><th class="r">Gain</th><th>Type</th></tr></thead><tbody>${L(ctx).gains.filter((g) => fyOf(g.date) === fy).slice(-40).reverse().map((g) => `<tr><td>${g.date}</td><td>${esc(g.name)}</td><td class="r">${fmtNum(g.qty, 3)}</td><td>${g.buyDate}</td><td class="r ${cls(g.gain)}">${formatINR(g.gain)}</td><td class="small">${{ eqST: 'Equity short term', eqLT: 'Equity long term', otherLT: 'Long term (12.5%)', slab: 'Slab rate' }[g.bucket]}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted small">No sales this year.</div>'}`;
    $$(node, '[data-fy]').forEach((b) => b.addEventListener('click', () => { showFy = b.dataset.fy; render(); }));
    $$(node, '[data-file]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.fileReturn(fy, b.dataset.file), (x) => `Return filed. ${x.balance > 0 ? `Paid ₹${Math.round(x.balance)}` : x.balance < 0 ? `Refund ₹${Math.round(-x.balance)} credited` : 'Nothing due'}`) && render()));
  });
}

// ---------------------------------------------------------------- Research: results, analysts, IPOs
function resultsService(ctx) {
  let sym = 'AFT';
  return view(ctx, (node, render) => {
    const f = ctx.fin, h = L(ctx).results[sym], av = f.analystView(sym), c = COMPANIES.find((x) => x.symbol === sym);
    node.innerHTML = `${SIM_NOTE}<div class="seg" style="grid-template-columns:repeat(8,1fr)">${COMPANIES.map((x) => `<button data-s="${x.symbol}" class="${x.symbol === sym ? 'on' : ''}">${x.symbol}</button>`).join('')}</div>
      <div class="det-head" style="margin-top:.5rem"><div><div class="det-name">${esc(c.name)}</div><div class="small muted">${esc(c.sector)} · ${esc(c.cap)} · results every quarter on the 15th of Jan, Apr, Jul and Oct</div></div><div class="r"><div class="mono big">${formatINR2(f.market.price(sym))}</div></div></div>
      <div class="grid-3"><div class="stat"><div class="k">Analyst view</div><div class="v ${av.rating === 'Buy' ? 'up' : av.rating === 'Sell' ? 'down' : ''}">${av.rating}</div><div class="small muted">target ${formatINR2(av.target)}</div></div><div class="stat"><div class="k">P/E (trailing)</div><div class="v">${av.pe ?? 'loss'}</div></div><div class="stat"><div class="k">Avg growth</div><div class="v ${cls(av.growth)}">${fmtPct(av.growth)}</div></div></div>
      <div class="tbl-wrap"><table class="board"><thead><tr><th>Quarter</th><th class="r">Revenue (₹ cr)</th><th class="r">Profit (₹ cr)</th><th class="r">vs estimates</th></tr></thead><tbody>${[...h].reverse().map((q) => `<tr><td>${q.q}</td><td class="r">${fmtNum(q.revenue, 0)}</td><td class="r ${q.profit < 0 ? 'down' : ''}">${fmtNum(q.profit, 0)}</td><td class="r ${q.surprise === undefined ? '' : cls(q.surprise)}">${q.surprise === undefined ? '—' : q.surprise >= 0 ? 'beat' : 'missed'}</td></tr>`).join('')}</tbody></table></div>
      <div class="small muted">Analyst ratings here come from a simple rule (valuation versus growth). Real analysts disagree often, and ratings are opinions, not advice.</div>`;
    $$(node, '[data-s]').forEach((b) => b.addEventListener('click', () => { sym = b.dataset.s; render(); }));
  });
}
function ipoService(ctx) {
  return view(ctx, (node, render) => {
    const f = ctx.fin, l = L(ctx), I = l.ipo;
    const maxLots = I ? Math.floor(200000 / (I.lot * I.band[1])) : 0;
    node.innerHTML = `${SIM_NOTE}<div class="fw-msg info" style="margin-top:0">An IPO is when a company first sells shares to the public. Retail investors bid up to ₹2 lakh; if the issue is oversubscribed, allotment is a lottery of one lot each. Money is blocked through UPI, and released if you get nothing. Listing happens 3 working days after the issue closes. All IPO companies here are fictional.</div>
      ${I ? `<div class="card-in"><div class="det-head"><div><div class="det-name">${esc(I.name)}</div><div class="small muted">${esc(I.sector)} · opens ${I.open} · closes ${I.close} · listing ${I.list}</div></div><div class="r">${chip(I.status === 'open' ? 'Open now' : I.status === 'upcoming' ? 'Upcoming' : 'Closed', I.status === 'open' ? 'green' : '')}</div></div>
          <div class="grid-3"><div class="stat"><div class="k">Price band</div><div class="v">₹${I.band[0]} to ₹${I.band[1]}</div></div><div class="stat"><div class="k">Lot size</div><div class="v">${I.lot} shares</div><div class="small muted">${formatINR(I.lot * I.band[1])} a lot</div></div><div class="stat"><div class="k">Subscribed</div><div class="v">${I.sub ? `${I.sub}x` : '—'}</div></div></div>
          ${I.applied ? `<div class="holding">You bid for ${I.applied.lots} lot${I.applied.lots > 1 ? 's' : ''} (${formatINR(I.applied.amount)} blocked).${I.status === 'closed' ? (I.allotted ? ' Allotted 1 lot!' : ' Not allotted.') : ''}</div>` : I.status === 'open' ? `<div class="order-row"><input class="fw-input" type="number" min="1" max="${maxLots}" value="1" data-lots><button class="fw-btn green" data-apply>Bid at cut-off (₹${I.band[1]})</button></div><div class="small muted">Bidding more lots does not raise your chance as a retail investor once the issue is heavily oversubscribed. Needs KYC and UPI.</div>` : ''}</div>`
        : `<div class="muted">No IPO right now. The next one is expected around ${l.nextIpo}.</div>`}
      <div class="section-h">Your IPO shares</div>
      ${l.ipoHold.length ? l.ipoHold.map((h) => `<div class="news"><b>${esc(h.name)}</b> ${h.qty} shares · bought ₹${h.cost} · now ${formatINR2(h.price)} <span class="${cls(h.price - h.cost)}">${fmtPct((h.price / h.cost - 1) * 100)}</span> <button class="fw-btn sm" data-sell="${h.id}">Sell all</button></div>`).join('') : '<div class="muted small">None yet.</div>'}`;
    $(node, '[data-apply]')?.addEventListener('click', () => act(ctx, () => f.applyIPO(num($(node, '[data-lots]').value)), 'Bid placed, money blocked') && render());
    $$(node, '[data-sell]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.sellIPOShares(b.dataset.sell), 'Shares sold') && render()));
  });
}

// ---------------------------------------------------------------- AccoFinTra Tower: investor relations
function aftInvestor(ctx) {
  return view(ctx, (node) => {
    const f = ctx.fin, l = L(ctx), h = l.results.AFT, q = f.qty('AFT'), av = f.analystView('AFT');
    const divs = l.divs.filter((d) => d.sym === 'AFT');
    node.innerHTML = `${SIM_NOTE}<div class="det-head"><div><div class="det-name">AccoFinTra Ltd</div><div class="small muted">Financial services · large cap · AFT · headquartered in AccoFinTra Tower</div></div><div class="r"><div class="mono big">${formatINR2(f.market.price('AFT'))}</div><div class="small muted">market cap ₹${fmtNum(av.mcap, 0)} crore</div></div></div>
      ${lineChart([['AFT', f.market.history('AFT')]], { height: 100 })}
      <div class="grid-3"><div class="stat"><div class="k">You own</div><div class="v">${fmtNum(q, 0)} shares</div></div><div class="stat"><div class="k">Last quarter profit</div><div class="v">₹${fmtNum(h[h.length - 1].profit, 0)} cr</div></div><div class="stat"><div class="k">Dividend</div><div class="v">record date 15 Aug</div><div class="small muted">${divs.length ? `last ₹${divs[divs.length - 1].dps}/share` : 'yield about 1.5%'}</div></div></div>
      <div class="section-h">Annual General Meeting</div>
      ${l.agm ? `<div class="card-in"><div class="small muted">AGM held ${l.agm.date}</div><p>${esc(l.agm.text)}</p></div>` : '<div class="muted small">The AGM is held every year on 20 August. The shareholder letter appears here after it.</div>'}
      <div class="small muted">Shareholders own part of the company: they get dividends, can vote at the AGM, and share in its growth or decline. AccoFinTra is a fictional company and all its figures are simulated.</div>`;
  });
}

// ---------------------------------------------------------------- FinTech Hub: KYC, UPI, link safety
function kycUpi(ctx) {
  return view(ctx, (node, render) => {
    const f = ctx.fin, k = L(ctx).kyc, u = L(ctx).upiDay;
    node.innerHTML = `<div class="fw-msg info" style="margin-top:0">KYC (Know Your Customer) proves who you are before you can use UPI, invest in IPOs or open accounts. In the game it is simulated: FinVora makes up a fictional PAN and UPI ID for you. Never type your real PAN, Aadhaar or bank details into a game or an unknown website.</div>
      ${k ? `<div class="card-in"><div class="det-head"><div><div class="det-name">${esc(k.upi)}</div><div class="small muted">KYC complete on ${k.date} · fictional PAN ${esc(k.pan)}</div></div><div class="r">${chip('Verified', 'green')}</div></div>
          <div class="small">UPI used today: ${formatINR(u.date === f.date ? u.spent : 0)} of ₹1,00,000 · UPI PIN is only for sending money, never for receiving.</div></div>`
        : `<div class="card-in"><label class="fw-label">Name for your fictional KYC</label><div class="order-row"><input class="fw-input" type="text" maxlength="30" value="${esc(ctx.playerName?.() || 'Player')}" data-nm><button class="fw-btn primary" data-kyc>Complete video KYC (simulated)</button></div></div>`}
      <div class="section-h">How you pay</div><div data-pay></div>
      <div class="section-h">Payment apps in FinVora</div>
      <div class="small">UPI moves money between bank accounts instantly, 24x7. Payment apps are only the front end; the money stays in your bank. Check the name shown before paying, and set daily limits you are comfortable with.</div>`;
    $(node, '[data-pay]').appendChild(payPicker(ctx, render));
    $(node, '[data-kyc]')?.addEventListener('click', () => act(ctx, () => f.completeKYC($(node, '[data-nm]').value), 'KYC complete. UPI is ready.') && render());
  });
}
const LINKS = [
  ['https://finvorabank.in/login', false, 'The bank\'s own domain, typed or bookmarked by you, over https. Still check the spelling every time.'],
  ['http://finvora-bank.secure-login.xyz/verify', true, 'The real domain is "secure-login.xyz". Anything before it can be faked, and it is plain http.'],
  ['https://incometax.gov.in', false, 'The official income tax e-filing portal ends in gov.in.'],
  ['https://incometax-refund-claim.online/pan', true, 'Refund scams copy government names on random domains. The government uses gov.in.'],
  ['https://bit.ly/3xKYCupd8', true, 'Short links hide where they go. Banks do not send KYC updates as short links.'],
  ['https://www.sebi.gov.in/intermediaries', false, 'SEBI\'s official site. You can check if a broker or adviser is registered here.'],
  ['https://finvora.bank.com.co/offer', true, 'The real domain is "com.co". The words "finvora.bank" are just a subdomain.'],
  ['https://cybercrime.gov.in', false, 'The government portal for reporting cyber fraud. Or call 1930.'],
];
function linkLab(ctx) {
  let i = 0, score = 0;
  const node = el('<div></div>');
  const draw = (fb) => {
    if (i >= LINKS.length) { node.innerHTML = `<div class="stat"><div class="k">Your score</div><div class="v">${score} / ${LINKS.length}</div></div><p class="small">Rule: read the domain right before the first single slash, from right to left.</p><button class="fw-btn" data-again>Try again</button>`; $(node, '[data-again]').addEventListener('click', () => { i = 0; score = 0; draw(); }); return; }
    const [url, bad, why] = LINKS[i];
    node.innerHTML = `<div class="muted small">Link ${i + 1} of ${LINKS.length} · score ${score}</div><div class="scam-msg mono">${esc(url)}</div>${fb || '<div class="order-row"><button class="fw-btn" data-a="1" style="flex:1">Unsafe</button><button class="fw-btn" data-a="0" style="flex:1">Safe</button></div>'}`;
    $$(node, '[data-a]').forEach((b) => b.addEventListener('click', () => { const ok = (b.dataset.a === '1') === bad; if (ok) score++; draw(`<div class="fw-msg ${ok ? 'ok' : 'err'}">${ok ? 'Correct.' : 'Not quite.'} ${esc(why)}</div><button class="fw-btn primary" data-next>Next</button>`); $(node, '[data-next]').addEventListener('click', () => { i++; draw(); }); }));
  };
  draw();
  return { node, destroy() {} };
}

// ---------------------------------------------------------------- Academy
function coursesService(ctx) {
  let open = null; const ans = {};
  return view(ctx, (node, render) => {
    const f = ctx.fin, l = L(ctx);
    if (open) {
      const c = courseById[open];
      node.innerHTML = `<div class="det-name">${esc(c.title)}</div><div class="small muted">Answer 4 of 5 correctly to earn the certificate${l.certs[open] ? ' (already earned)' : ` and ₹${c.reward.toLocaleString('en-IN')}`}.</div>
        ${c.qs.map((q, i) => `<div class="card-in"><b>${i + 1}. ${esc(q[0])}</b><div class="quiz-opts">${q[1].map((o, j) => `<button class="fw-btn sm ${ans[i] === j ? 'primary' : ''}" data-q="${i}:${j}">${esc(o)}</button>`).join('')}</div></div>`).join('')}
        <div class="order-row"><button class="fw-btn green" data-submit>Submit</button><button class="fw-btn" data-back>Back to courses</button></div>`;
      $$(node, '[data-q]').forEach((b) => b.addEventListener('click', () => { const [i, j] = b.dataset.q.split(':').map(Number); ans[i] = j; render(); }));
      $(node, '[data-back]').addEventListener('click', () => { open = null; render(); });
      $(node, '[data-submit]').addEventListener('click', () => {
        const r = act(ctx, () => f.submitQuiz(open, c.qs.map((_, i) => ans[i] ?? -1)), (x) => (x.pass ? `Passed with ${x.score}/5${x.first ? '. Certificate earned!' : ''}` : `${x.score}/5. You need 4 to pass. Try again.`));
        if (r && r.pass) { open = null; for (const k in ans) delete ans[k]; }
        render();
      });
      return;
    }
    node.innerHTML = `<div class="fw-msg info" style="margin-top:0">Short courses with a 5-question quiz. Certificates pay a one-time reward and unlock better jobs at the Job Centre and derivatives trading.</div>
      <div class="shop-grid">${COURSES.map((c) => `<div class="card-in shop-item"><b>${esc(c.title)}</b><div class="small muted">Reward ₹${c.reward.toLocaleString('en-IN')}</div>${l.certs[c.id] ? chip(`Certified ${l.certs[c.id]}`, 'green') : ''}<div class="small">${JOBS.filter((j) => j.needs.includes(c.id)).map((j) => `Unlocks ${esc(j.title)}`).join(' · ') || (c.id === 'derivatives' ? 'Unlocks F&O trading' : '')}</div><button class="fw-btn sm block ${l.certs[c.id] ? '' : 'green'}" data-open="${c.id}">${l.certs[c.id] ? 'Retake' : 'Start'}</button></div>`).join('')}</div>`;
    $$(node, '[data-open]').forEach((b) => b.addEventListener('click', () => { open = b.dataset.open; for (const k in ans) delete ans[k]; render(); }));
  });
}

// ---------------------------------------------------------------- SuperMart and bills
const SHOP_ITEMS = [['Weekly vegetables and fruit', 900], ['Snacks and drinks', 450], ['Household supplies', 1200], ['Festival sweets box', 1500], ['Dinner out with friends', 2400], ['Movie tickets for two', 700]];
function supermart(ctx) {
  return view(ctx, (node, render) => {
    const f = ctx.fin, l = L(ctx);
    const month = f.date.slice(0, 7), spent = f.ledger.filter((e) => e.date.startsWith(month) && ['spend', 'bill', 'fuel', 'rent'].includes(e.type)).reduce((s, e) => s + Math.abs(e.amount || 0) + (e.asset === 'card' ? num((e.note || '').split('₹')[1]) : 0), 0);
    node.innerHTML = `<div class="fw-msg info" style="margin-top:0">Every month brings groceries on the 7th and electricity and mobile bills on the 10th, plus rent if you rent. They are paid automatically with your chosen payment method. A credit card earns 1% back if you pay the bill in full.</div>
      <div class="section-h">Monthly grocery plan</div>
      <div class="seg">${Object.entries(LIFESTYLES).map(([k, v]) => `<button data-ls="${k}" class="${l.lifestyle === k ? 'on' : ''}">${v.name} · ${formatINR(v.groceries)}</button>`).join('')}</div>
      <div data-pay style="margin-top:.5rem"></div>
      <div class="section-h">Shop now</div>
      <div class="shop-grid">${SHOP_ITEMS.map(([n, p], i) => `<div class="card-in shop-item"><b>${esc(n)}</b><div class="mono">${formatINR(p)}</div><button class="fw-btn sm green block" data-buy="${i}">Buy</button></div>`).join('')}</div>
      <div class="section-h">This month so far</div>
      <div class="stat"><div class="k">Household spending in ${month}</div><div class="v">${formatINR(spent)}</div></div>
      <div class="small muted">Track it against the 50/30/20 idea: half of take-home on needs, 30% on wants, 20% saved. Aarya the Budget Coach in South Park can help.</div>`;
    $(node, '[data-pay]').appendChild(payPicker(ctx, render));
    $$(node, '[data-ls]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.setLifestyle(b.dataset.ls), 'Grocery plan updated') && render()));
    $$(node, '[data-buy]').forEach((b) => b.addEventListener('click', () => { const [n, p] = SHOP_ITEMS[Number(b.dataset.buy)]; act(ctx, () => f.shop(n, p), `Paid ${formatINR(p)}`) && render(); }));
  });
}

// ---------------------------------------------------------------- Fuel station
function fuelStation(ctx) {
  return view(ctx, (node, render) => {
    const f = ctx.fin, id = ctx.activeCar?.(), car = f.garage.find((g) => g.id === id), near = ctx.carNear?.() ?? true;
    const spec = car && carById[car.catalogId], fu = spec && FUEL[spec.energy], lvl = car ? f.carFuel(car.id) : 0, need = spec ? (1 - lvl) * spec.tank : 0;
    node.innerHTML = `<div class="fw-msg info" style="margin-top:0">FinVora Fuels (fictional): petrol ₹${FUEL.petrol.price}/litre, CNG ₹${FUEL.cng.price}/kg, EV fast charging ₹${FUEL.ev.price}/kWh (illustrative city prices). Your vehicle uses fuel as you drive. Running empty slows you to a crawl.</div>
      ${car ? `<div class="card-in"><div class="det-head"><div><div class="det-name">${esc(spec.name)}</div><div class="small muted">${fu.name} · tank ${spec.tank} ${fu.unit}s · about ${spec.eff} km per ${fu.unit}</div></div><div class="r"><div class="mono big ${lvl < 0.15 ? 'down' : ''}">${Math.round(lvl * 100)}%</div></div></div>
          <div class="fuel-bar"><div style="width:${Math.round(lvl * 100)}%"></div></div>
          ${near ? `<div class="order-row" style="margin-top:.5rem"><button class="fw-btn green" data-full>Fill up: ${fmtNum(need, 1)} ${fu.unit}s for ${formatINR(need * fu.price)}</button><button class="fw-btn" data-500>Add ₹500</button></div>` : '<div class="fw-msg err">Bring your vehicle to the pump first: park it within 30 m of the station.</div>'}</div>` : '<div class="muted">You have no vehicle selected.</div>'}
      <div data-pay></div>`;
    $(node, '[data-pay]').appendChild(payPicker(ctx, render));
    $(node, '[data-full]')?.addEventListener('click', () => act(ctx, () => f.refuel(car.id), (r) => `Filled ${r.units} for ${formatINR(r.cost)}`) && render());
    $(node, '[data-500]')?.addEventListener('click', () => act(ctx, () => f.refuel(car.id, { amount: 500 }), (r) => `Added ${r.units} for ${formatINR(r.cost)}`) && render());
  });
}

export const LIFE_TITLES = {
  'bank-accounts': 'Accounts and cards', 'credit-report': 'Your credit report', jobs: 'Jobs', careers: 'Careers', epf: 'EPF and pensions', 'bond-desk': 'Bonds and T-bills',
  'gold-desk': 'Gold, silver and SGBs', fno: 'F&O paper trading', 'insurance-desk': 'Buy insurance', property: 'Buy, rent and REITs', 'tax-filing': 'File your return',
  results: 'Quarterly results', ipo: 'IPOs', 'aft-investor': 'Investor relations', 'kyc-upi': 'KYC and UPI', 'link-lab': 'Safe or unsafe link?', courses: 'Courses and certificates',
  supermart: 'SuperMart and bills', 'fuel-station': 'Fuel and charging',
};
export const LIFE_FACTORIES = {
  'bank-accounts': bankAccounts, 'credit-report': creditReport, jobs: (ctx) => jobsService(ctx), careers: (ctx) => jobsService(ctx, 'AccoFinTra'), epf: epfService,
  'bond-desk': bondDesk, 'gold-desk': goldDesk, fno: fnoDesk, 'insurance-desk': insuranceDesk, property: propertyDesk, 'tax-filing': taxFiling,
  results: resultsService, ipo: ipoService, 'aft-investor': aftInvestor, 'kyc-upi': kycUpi, 'link-lab': linkLab, courses: coursesService, supermart, 'fuel-station': fuelStation,
};
