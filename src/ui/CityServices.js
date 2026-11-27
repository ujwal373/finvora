// Services for the round 10 city: mall shops (electronics, food court, books), cinema, restaurant,
// hospital, pharmacy, school and gym. Every price is illustrative and all money is simulated.
import { el, esc, $, $$ } from './dom.js';
import { formatINR } from '../config.js';
import { GYM_PLANS, HOSPITAL, MEDICINES, DIPLOMAS, EDU_LOAN, GADGETS, NO_COST_EMI } from '../sim/Life.js';
import { emi } from '../sim/Finance.js';
import { act, live } from './svcutil.js';

const PAY = { upi: 'UPI', debit: 'Debit card', card: 'Credit card' };
const note = (html) => `<div class="fw-msg info" style="margin-top:0">${html}</div>`;
const fv = (monthly, years, r = 0.12) => { const i = r / 12, n = years * 12; return monthly * (((1 + i) ** n - 1) / i); };

function view(ctx, draw) {
  const node = el('<div></div>');
  const render = () => { node.innerHTML = ''; draw(node, render); };
  render();
  return { node, destroy: live(ctx, node, render) };
}
function payLine(ctx) { return `<div class="small muted" style="margin:.3rem 0 .6rem">Paying by ${PAY[ctx.fin.life.payMethod] || 'debit card'}. Change it at any shop's payment picker or the bank.</div>`; }
function menu(ctx, items, render, what) {
  const wrap = el(`<div class="shop-grid">${items.map(([n, p, sub], i) => `<div class="card-in shop-item"><b>${esc(n)}</b>${sub ? `<div class="small muted">${esc(sub)}</div>` : ''}<div class="mono">${formatINR(p)}</div><button class="fw-btn sm green block" data-buy="${i}">Buy</button></div>`).join('')}</div>`);
  $$(wrap, '[data-buy]').forEach((b) => b.addEventListener('click', () => { const [n, p] = items[Number(b.dataset.buy)]; act(ctx, () => ctx.fin.shop(`${n}${what ? ` (${what})` : ''}`, p), `Paid ${formatINR(p)}`) && render(); }));
  return wrap;
}
/** "What if I invested this habit instead?" */
function habitBox(label, perDay, days = 22) {
  const m = perDay * days, y = m * 12;
  return `<div class="card-in"><div class="small muted">${esc(label)}</div>
    <div class="grid-3" style="margin-top:.4rem"><div class="stat"><div class="k">A month</div><div class="v">${formatINR(m)}</div></div><div class="stat"><div class="k">A year</div><div class="v">${formatINR(y)}</div></div><div class="stat"><div class="k">Invested 10 years at 12%</div><div class="v up">${formatINR(fv(m, 10))}</div></div></div>
    <div class="small muted" style="margin-top:.3rem">Illustrative: 12% a year is an assumption, not a promise. Enjoy treats on purpose, not on autopilot.</div></div>`;
}

// ---------------------------------------------------------------- mall: electronics
function electronics(ctx) {
  return view(ctx, (node, render) => {
    const f = ctx.fin, E = NO_COST_EMI;
    node.innerHTML = note(`TechNova (fictional). Paying in full gets a ${E.cashDiscount * 100}% instant discount. "No-cost EMI" (${E.months} months, credit card only) keeps the list price, adds a ₹${E.fee} processing fee plus 18% GST, and GST on the interest the brand quietly pays the lender. Not free, just hidden.`) +
      `<div class="section-h">Compare before you buy</div>
      <div class="stack">${GADGETS.map((g) => { const q = f.gadgetQuote(g.id); return `<div class="card-in">
        <div class="det-head"><div><div class="det-name">${esc(g.name)}</div><div class="small muted">List price ${formatINR(g.price)}</div></div></div>
        <div class="grid-3" style="margin-top:.4rem"><div class="stat"><div class="k">Pay in full</div><div class="v up">${formatINR(q.full)}</div></div><div class="stat"><div class="k">No-cost EMI total</div><div class="v down">${formatINR(q.emiTotal)}</div></div><div class="stat"><div class="k">EMI costs you extra</div><div class="v">${formatINR(q.extra)}</div></div></div>
        <div class="small muted">${E.months} EMIs of ${formatINR(q.monthly)} on your card, plus ${formatINR(E.fee * (1 + E.gst) + q.gstOnInterest)} charged upfront.</div>
        <div class="order-row" style="margin-top:.5rem"><button class="fw-btn green" data-full="${g.id}">Pay ${formatINR(q.full)} now</button><button class="fw-btn" data-emi="${g.id}">No-cost EMI</button></div></div>`; }).join('')}</div>
      ${payLine(ctx)}<div class="small muted">Rule of thumb: if you cannot pay for a want in full today, an EMI only hides that. Save first, buy later.</div>`;
    $$(node, '[data-full]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.buyGadget(b.dataset.full, 'full'), (r) => `Bought for ${formatINR(r.paid)}`) && render()));
    $$(node, '[data-emi]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.buyGadget(b.dataset.emi, 'emi'), (r) => `EMI started: ${formatINR(r.loan.emi)} a month`) && render()));
  });
}

// ---------------------------------------------------------------- mall: food court, bookstore
function foodCourt(ctx) {
  return view(ctx, (node, render) => {
    node.innerHTML = note('Mall food court (fictional prices, GST included). Food courts are where small, frequent spends hide.') + payLine(ctx);
    node.appendChild(menu(ctx, [['Veg thali', 220], ['Chicken biryani', 340], ['Masala dosa and filter coffee', 180], ['Cold coffee, large', 260], ['Pizza slice and cola', 290], ['Kulfi', 90]], render, 'food court'));
    node.appendChild(el(`<div><div class="section-h">The daily coffee test</div>${habitBox('One ₹260 cold coffee every working day', 260)}</div>`));
  });
}
function bookstore(ctx) {
  return view(ctx, (node, render) => {
    node.innerHTML = note('BookNook (fictional titles). A good money book is often the highest-return thing in the mall.') + payLine(ctx);
    node.appendChild(menu(ctx, [['The Patient Investor', 399, 'Index funds and staying invested'], ['Budget Like You Mean It', 299, 'The 50/30/20 idea in practice'], ['Insure, Then Invest', 349, 'Term, health and emergency funds'], ['Taxes Made Simple (India)', 449, 'Old vs new regime, explained']], render, 'BookNook'));
  });
}

// ---------------------------------------------------------------- cinema
function cinemaTickets(ctx) {
  return view(ctx, (node, render) => {
    node.innerHTML = note('Cineplex FinVora (fictional films). Morning shows are cheaper than evening shows for the same film. All prices include GST.') + payLine(ctx);
    node.appendChild(menu(ctx, [['The Last Sip · morning show', 180, 'Standard seat · 10:30 am'], ['Bull Run · evening show', 320, 'Standard seat · 6:45 pm'], ['Compound · recliner', 620, 'Recliner with blanket · 9:30 pm'], ['The EMI Trap · two tickets', 560, 'Standard seats · 4:00 pm']], render, 'Cineplex'));
    node.appendChild(el(`<div><div class="section-h">Movie night maths</div>${habitBox('Two evening tickets and a combo every weekend (₹1,300)', 1300, 4.3)}</div>`));
  });
}
function cinemaSnacks(ctx) {
  return view(ctx, (node, render) => {
    node.innerHTML = note('Popcorn costs the cinema a few rupees to make and sells for hundreds: that markup is how multiplexes earn. A treat is fine; just know what you pay for.') + payLine(ctx);
    node.appendChild(menu(ctx, [['Salted popcorn, regular', 260], ['Caramel popcorn, large', 420], ['Combo: popcorn and two colas', 640], ['Nachos with cheese', 330], ['Water bottle', 60]], render, 'cinema snacks'));
  });
}

// ---------------------------------------------------------------- restaurant
function restaurant(ctx) {
  return view(ctx, (node, render) => {
    node.innerHTML = note('Spice Route (fictional). Restaurant bills carry 5% GST. A service charge is optional: you may ask for it to be removed.') + payLine(ctx);
    node.appendChild(menu(ctx, [['Lunch thali', 280], ['Dinner for two', 1650, 'Starters, mains, dessert'], ['Rooftop family dinner (4)', 3800], ['Filter coffee', 90], ['Birthday cake, 1 kg', 950]], render, 'Spice Route'));
    node.appendChild(el(`<div><div class="section-h">Eating out vs cooking</div>${habitBox('Ordering a ₹350 lunch every working day instead of a ₹90 home tiffin (₹260 difference)', 260)}</div>`));
  });
}

// ---------------------------------------------------------------- hospital and pharmacy
function hospital(ctx) {
  return view(ctx, (node, render) => {
    const f = ctx.fin, pol = f.life.policies.find((p) => p.kind === 'health' && p.active);
    node.innerHTML = note(`FinVora City Hospital (fictional, illustrative prices). ${pol ? `Your health policy ${pol.id} covers ₹${(pol.cover / 100000).toLocaleString('en-IN')} lakh a year (used ₹${Math.round(pol.used).toLocaleString('en-IN')}).` : 'You have no health insurance: every bill comes from your pocket. Buy cover at the Insurance tab here or in AccoFinTra Tower.'}`) +
      `<div class="stack">${Object.entries(HOSPITAL).map(([k, h]) => `<div class="card-in"><div class="det-head"><div><div class="det-name">${esc(h.name)}</div><div class="small muted">${esc(h.note)}</div></div><div class="r mono">${formatINR(h.price)}</div></div><button class="fw-btn sm" data-h="${k}" style="margin-top:.4rem">Book</button></div>`).join('')}</div>
      <div class="small muted" style="margin-top:.5rem">Cashless claims: show your policy at a network hospital and the insurer pays the hospital directly. Elsewhere you pay first and claim back.</div>`;
    $$(node, '[data-h]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.hospitalVisit(b.dataset.h), (r) => (r.covered ? `Bill ${formatINR(r.bill)}: insurance paid ${formatINR(r.covered)}, you paid ${formatINR(r.paid)}` : `Bill ${formatINR(r.bill)} paid by you (${r.why})`)) && render()));
  });
}
function pharmacy(ctx) {
  return view(ctx, (node, render) => {
    const f = ctx.fin;
    node.innerHTML = note('24 × 7 pharmacy (fictional prices). Generic medicines contain the same active ingredient as branded ones and usually cost far less. Ask your doctor or pharmacist before switching.') + payLine(ctx) +
      `<div class="stack">${MEDICINES.map((m) => `<div class="card-in"><b>${esc(m.name)}</b><div class="order-row" style="margin-top:.4rem"><button class="fw-btn sm" data-m="${m.id}" data-g="0">Branded ${formatINR(m.branded)}</button><button class="fw-btn sm green" data-m="${m.id}" data-g="1">Generic ${formatINR(m.generic)}</button><span class="small muted">save ${Math.round((1 - m.generic / m.branded) * 100)}%</span></div></div>`).join('')}</div>`;
    $$(node, '[data-m]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.buyMedicine(b.dataset.m, b.dataset.g === '1'), (r) => (r.saved ? `Paid ${formatINR(r.price)}, saved ${formatINR(r.saved)}` : `Paid ${formatINR(r.price)}`)) && render()));
  });
}

// ---------------------------------------------------------------- school and college
function school(ctx) {
  return view(ctx, (node, render) => {
    const f = ctx.fin, mine = f.life.diplomas;
    node.innerHTML = note(`FinVora Public School and College (fictional) runs evening courses for working adults. Pay the fee upfront or take an education loan at ${(EDU_LOAN.rate * 100).toFixed(1)}% for ${EDU_LOAN.months} months. Under the old tax regime, education-loan interest is deductible (Section 80E) for up to 8 years.`) +
      `<div class="stack">${DIPLOMAS.map((d) => { const on = mine.find((x) => x.id === d.id); const e = emi(d.fee, EDU_LOAN.rate, EDU_LOAN.months); return `<div class="card-in">
        <div class="det-head"><div><div class="det-name">${esc(d.name)}</div><div class="small muted">${esc(d.skill)} · ${d.months} months</div></div><div class="r mono">${formatINR(d.fee)}</div></div>
        ${on ? `<div class="holding">Enrolled ${on.start} · finishes ${on.ends}${on.loan ? ` · loan ${on.loan}` : ''}</div>` : `<div class="small muted">Loan: EMI ${formatINR(e)} × ${EDU_LOAN.months} = ${formatINR(e * EDU_LOAN.months)} (interest ${formatINR(e * EDU_LOAN.months - d.fee)})</div>
        <div class="order-row" style="margin-top:.4rem"><button class="fw-btn sm green" data-full="${d.id}">Pay fee now</button><button class="fw-btn sm" data-loan="${d.id}">Education loan</button></div>`}</div>`; }).join('')}</div>`;
    $$(node, '[data-full]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.enrolDiploma(b.dataset.full, 'full'), 'Enrolled. Classes start this week.') && render()));
    $$(node, '[data-loan]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.enrolDiploma(b.dataset.loan, 'loan'), 'Loan approved and enrolled') && render()));
  });
}

// ---------------------------------------------------------------- gym
function gym(ctx) {
  return view(ctx, (node, render) => {
    const f = ctx.fin, g = f.life.gym, on = f.gymActive();
    node.innerHTML = note('FinVora Fit (fictional). The annual plan looks cheapest per month, but the real price is cost per visit: a plan you stop using is the most expensive one.') +
      (on ? `<div class="card-in"><div class="det-head"><div><div class="det-name">${esc(g.planName)} member</div><div class="small muted">Valid until ${g.until} · paid ${formatINR(g.paid)}</div></div><div class="r"><div class="mono big">${g.visits}</div><div class="small muted">visits</div></div></div>
        <div class="small" style="margin:.3rem 0">Cost per visit so far: <b>${g.visits ? formatINR(g.paid / g.visits) : formatINR(g.paid)}</b></div><button class="fw-btn green" data-visit>Work out today</button></div>` : '') +
      `<div class="section-h">Plans</div><div class="grid-3">${Object.entries(GYM_PLANS).map(([k, p]) => `<div class="card-in"><b>${p.name}</b><div class="mono">${formatINR(p.price)}</div><div class="small muted">${formatINR(p.price / (p.days / 30.4))} a month</div><button class="fw-btn sm block" data-plan="${k}" ${on ? 'disabled' : ''}>Join</button></div>`).join('')}</div>
      <div class="small muted" style="margin-top:.5rem">Free option: the open-air gym and jogging track in Central Park.</div>`;
    $(node, '[data-visit]')?.addEventListener('click', () => act(ctx, () => f.gymVisit(), (c) => `Workout logged. Cost per visit now ${formatINR(c)}`) && render());
    $$(node, '[data-plan]').forEach((b) => b.addEventListener('click', () => act(ctx, () => f.gymJoin(b.dataset.plan), 'Welcome to FinVora Fit!') && render()));
  });
}

export const CITY_TITLES = {
  electronics: 'Electronics', 'food-court': 'Food court', bookstore: 'Books', 'cinema-tickets': 'Movie tickets', 'cinema-snacks': 'Snacks',
  restaurant: 'Restaurant', hospital: 'Hospital services', pharmacy: 'Pharmacy', school: 'Courses and fees', gym: 'Memberships',
};
export const CITY_FACTORIES = {
  electronics, 'food-court': foodCourt, bookstore, 'cinema-tickets': cinemaTickets, 'cinema-snacks': cinemaSnacks,
  restaurant, hospital, pharmacy, school, gym,
};
