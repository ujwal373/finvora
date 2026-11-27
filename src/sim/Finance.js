import { Market, instrumentInfo, FUNDS } from './Market.js';
import { STARTING_BALANCE } from '../config.js';
import { carById, clothById, CAR_LOAN, INSURANCE_PCT, carValue } from '../data/shop.js';
import { LIFE_METHODS } from './Life.js';

// The FinVora finance engine. Pure logic, no DOM, unit tested.
//
// * Money is VIRTUAL. The wallet is a simulated savings account that starts at ₹10,00,000.
// * The ledger is append-only: entries are frozen and never edited or deleted.
// * Every instrument has its own mechanics (no single generic return formula).
// * Time runs on a simulated calendar starting 1 April 2026 (start of FY 2026-27).
//
// Rates and rules. Government scheme rates are the rates notified for Oct–Dec 2026 and are held
// constant in the simulation (an assumption: real rates are reset every quarter). Bank FD/RD/loan
// rates belong to the fictional FinVora Bank and are illustrative only.

export const RATES = {
  savings: 0.025, // FinVora Bank savings account (illustrative)
  ppf: 0.071, nsc: 0.077, scss: 0.082, ssy: 0.082, // Govt notified, Oct–Dec 2026 quarter
  epf: 0.0825, // EPF rate declared for FY 2025-26
  personalLoan: 0.13, // FinVora Bank (illustrative)
  asOf: 'Oct–Dec 2026 quarter',
};

// FinVora Bank FD/RD rate card (illustrative, fictional bank)
export const FD_SLABS = [
  { minM: 1, maxM: 5, rate: 0.055 }, // < 6 months
  { minM: 6, maxM: 11, rate: 0.062 },
  { minM: 12, maxM: 23, rate: 0.068 },
  { minM: 24, maxM: 35, rate: 0.07 },
  { minM: 36, maxM: 59, rate: 0.0675 },
  { minM: 60, maxM: 120, rate: 0.065 },
];
export const fdRate = (months) => (FD_SLABS.find((s) => months >= s.minM && months <= s.maxM) || FD_SLABS[FD_SLABS.length - 1]).rate;
export const FD_PENALTY = 0.01; // premature withdrawal: 1% below the rate for the period actually held

export const LIMITS = {
  ppf: { min: 500, maxPerFY: 150000, years: 15 },
  nsc: { min: 1000, years: 5 },
  scss: { min: 1000, max: 3000000, years: 5, minAge: 60 },
  ssy: { min: 250, maxPerFY: 150000, depositYears: 15, maturityYears: 21, maxChildAge: 10 },
  nps: { min: 1000 },
  mf: { min: 100 },
};

// ---------------------------------------------------------------- dates
export const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const fmtDate = (dt) => dt.toISOString().slice(0, 10);
export const addDays = (s, n) => { const d = parseDate(s); d.setUTCDate(d.getUTCDate() + n); return fmtDate(d); };
export const addMonths = (s, n) => {
  const d = parseDate(s), day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return fmtDate(d);
};
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
export const yearsBetween = (a, b) => daysBetween(a, b) / 365;
const isWeekday = (s) => { const w = parseDate(s).getUTCDay(); return w !== 0 && w !== 6; };
const isMonthEnd = (s) => parseDate(addDays(s, 1)).getUTCDate() === 1;
export const fyOf = (s) => { const d = parseDate(s); const y = d.getUTCFullYear(); return d.getUTCMonth() >= 3 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`; };

export const emi = (P, annual, n) => { const r = annual / 12; return r === 0 ? P / n : (P * r * (1 + r) ** n) / ((1 + r) ** n - 1); };

// ---------------------------------------------------------------- XIRR
/** flows: [{date, amount}] with negatives for money put in. Returns annual rate or null. */
export function xirr(flows) {
  if (flows.length < 2 || !flows.some((f) => f.amount < 0) || !flows.some((f) => f.amount > 0)) return null;
  const t0 = flows[0].date;
  const npv = (r) => flows.reduce((s, f) => s + f.amount / (1 + r) ** (daysBetween(t0, f.date) / 365), 0);
  let lo = -0.9999, hi = 10, flo = npv(lo), fhi = npv(hi);
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, fm = npv(mid);
    if (Math.abs(fm) < 1e-7) return mid;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

export const cagr = (start, end, years) => (years > 0 && start > 0 ? (end / start) ** (1 / years) - 1 : null);

// ---------------------------------------------------------------- engine
export class Finance {
  constructor(saved) {
    if (saved) {
      const { market, ledger, ...rest } = saved;
      Object.assign(this, structuredClone(rest));
      this.ledger = (ledger || []).map((e) => Object.freeze({ ...e }));
      this.market = new Market(market);
      this.garage ||= [{ id: 'CAR0', catalogId: 'coupe', color: 0x1800ad, price: 0, bought: this.start, gift: true }];
      const gift = this.garage.find((c) => c.gift); if (gift && gift.color === 0xd4a846 && !gift.repainted) { gift.color = 0x1800ad; gift.repainted = true; } // company car now wears AccoFinTra colours
      this.wardrobe ||= [];
      this._settleRetired();
      this._initLife();
    } else {
      this.v = 1;
      this.start = '2026-04-01';
      this.date = this.start;
      this.cash = STARTING_BALANCE;
      this.ledger = [];
      this.holdings = {}; // code -> [{date, qty, price}] FIFO lots (stocks, ETFs, funds, NPS)
      this.realised = 0;
      this.sips = []; this.fds = []; this.rds = []; this.loans = [];
      this.ppf = null; this.nsc = []; this.scss = []; this.ssy = null;
      this.savingsAccrued = 0;
      this.declaredAge = null;
      this.seq = 0;
      this.garage = [{ id: 'CAR0', catalogId: 'coupe', color: 0x1800ad, price: 0, bought: this.start, gift: true }];
      this.wardrobe = [];
      this.market = new Market();
      this._log({ type: 'opening', name: 'Virtual wallet opened', amount: STARTING_BALANCE, note: 'Simulated money for learning. Not real.' });
      this._initLife();
    }
    this.listeners = new Set();
  }

  serialize() {
    const { market, listeners, ...rest } = this;
    return { ...structuredClone({ ...rest, ledger: this.ledger.map((e) => ({ ...e })) }), market: market.serialize() };
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(evt) { for (const fn of this.listeners) fn(evt); }

  /** Holdings in companies or funds removed by a game update are bought back at their last simulated price. */
  _settleRetired() {
    const r = this.market.retired;
    if (!r) return;
    for (const code of Object.keys(this.holdings || {})) {
      if (!(code in r)) continue;
      const lots = this.holdings[code] || [];
      const qty = lots.reduce((a, l) => a + l.qty, 0), cost = lots.reduce((a, l) => a + l.qty * l.price, 0);
      delete this.holdings[code];
      if (!(qty > 0)) continue;
      const price = r[code] || 0, amount = Math.round(qty * price * 100) / 100;
      this.cash = Math.round((this.cash + amount) * 100) / 100;
      const pl = Math.round((amount - cost) * 100) / 100; this.realised = (this.realised || 0) + pl;
      this._log({ type: 'sell', asset: 'stock', code, name: `${code} (retired in a game update)`, qty, price, amount, flow: amount, pl, note: 'This company or fund was renamed or removed in a FinVora update, so your holding was bought back at its last simulated price.' });
    }
    for (const s of this.sips || []) if (s.active && s.code in r) { s.active = false; this._log({ type: 'sip-stop', asset: 'fund', code: s.code, name: s.name, amount: 0, note: 'Stopped because this fund was removed in a FinVora update.' }); }
    delete this.market.retired;
  }

  _log(e) {
    const entry = Object.freeze({ id: ++this.seq || 1, date: this.date, cashAfter: Math.round(this.cash * 100) / 100, flow: 0, ...e });
    this.ledger.push(entry);
    return entry;
  }

  _debit(amount, what) {
    amount = Math.round(amount * 100) / 100;
    if (!(amount > 0)) throw new FinError('Enter an amount greater than zero.');
    if (amount > this.cash + 1e-6) throw new FinError(`Not enough balance for ${what}. Available: ₹${this.cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}.`);
    this.cash = Math.round((this.cash - amount) * 100) / 100;
    return amount;
  }
  _credit(amount) { this.cash = Math.round((this.cash + amount) * 100) / 100; }

  // ------------------------------------------------ units: stocks, ETFs, funds, NPS
  _addLot(code, qty, price) { (this.holdings[code] ||= []).push({ date: this.date, qty, price }); }

  /** FIFO removal; returns cost basis of removed qty and the lots touched. */
  _removeFIFO(code, qty) {
    const lots = this.holdings[code] || [];
    let left = qty, cost = 0; const used = [];
    while (left > 1e-9 && lots.length) {
      const l = lots[0], take = Math.min(l.qty, left);
      cost += take * l.price; used.push({ ...l, qty: take });
      l.qty -= take; left -= take;
      if (l.qty <= 1e-9) lots.shift();
    }
    if (!lots.length) delete this.holdings[code];
    return { cost, used };
  }

  qty(code) { return (this.holdings[code] || []).reduce((s, l) => s + l.qty, 0); }
  invested(code) { return (this.holdings[code] || []).reduce((s, l) => s + l.qty * l.price, 0); }

  // ---------------------------------------------------------------- exchange hours and charges
  /** Equity market hours: 9:15 am to 3:30 pm on weekdays (game clock). Without a clock (tests), always open. */
  marketOpen() {
    if (this.clockHour == null) return true;
    const w = parseDate(this.date).getUTCDay();
    return w !== 0 && w !== 6 && this.clockHour >= 9.25 && this.clockHour < 15.5;
  }

  /** Contract-note charges for a delivery trade (rates modelled on Indian exchanges; brokerage illustrative). */
  tradeCharges(side, value, type = 'stock') {
    const r = (v) => Math.round(v * 100) / 100;
    const brokerage = r(Math.min(20, value * 0.001));
    const stt = r(type === 'etf' ? (side === 'sell' ? value * 0.00001 : 0) : value * 0.001);
    const exch = r(value * 0.0000297), sebi = r(value * 0.000001);
    const stamp = side === 'buy' ? r(value * 0.00015) : 0;
    const gst = r((brokerage + exch + sebi) * 0.18);
    const dp = side === 'sell' ? 15.93 : 0;
    const total = r(brokerage + stt + exch + sebi + stamp + gst + dp);
    return { brokerage, stt, exch, sebi, stamp, gst, dp, total };
  }

  _amoQueue(side, code, qty) {
    const info = instrumentInfo(code);
    this.amo ||= [];
    const o = { id: `AMO${++this.seq}`, side, code, qty, placed: this.date };
    this.amo.push(o);
    this._emit({ type: 'trade' });
    this._log({ type: 'amo', asset: info?.type, code, name: `After-market order: ${side} ${qty} × ${code}`, amount: 0, note: 'Market is closed (open 9:15 am to 3:30 pm on weekdays). It will execute at the next open at that price.' });
    return { amo: true, ...o };
  }

  /** Run queued after-market orders once the market opens. Returns results for the HUD. */
  executeAMO() {
    if (!this.amo?.length || !this.marketOpen()) return [];
    const out = [], list = this.amo; this.amo = [];
    for (const o of list) {
      try { out.push({ ok: true, o, e: o.side === 'buy' ? this.buyShares(o.code, o.qty) : this.sellShares(o.code, o.qty) }); }
      catch (err) { out.push({ ok: false, o, msg: err.message }); this._log({ type: 'amo-rejected', code: o.code, name: `After-market order rejected: ${o.side} ${o.qty} × ${o.code}`, amount: 0, note: err.message }); }
    }
    return out;
  }
  cancelAMO(id) { this.amo = (this.amo || []).filter((o) => o.id !== id); this._emit({ type: 'trade' }); }

  buyShares(code, qty) {
    const info = instrumentInfo(code);
    if (!info || !['stock', 'etf'].includes(info.type)) throw new FinError('Unknown share or ETF.');
    if (!Number.isInteger(qty) || qty <= 0) throw new FinError('Quantity must be a whole number of at least 1.');
    if (!this.marketOpen()) return this._amoQueue('buy', code, qty);
    const price = this.market.price(code), value = qty * price, ch = this.tradeCharges('buy', value, info.type);
    if (value + ch.total > this.cash + 1e-6) throw new FinError(`Not enough cash: this order needs ${Math.ceil(value + ch.total).toLocaleString('en-IN')} including charges.`);
    const amount = this._debit(value + ch.total, `${qty} × ${code}`);
    this._addLot(code, qty, amount / qty); // charges become part of your cost
    this._emit({ type: 'trade' });
    return this._log({ type: 'buy', asset: info.type, code, name: info.name, qty, price, amount: -amount, flow: -amount, charges: ch.total, note: `Value ${value.toFixed(2)} + charges ${ch.total.toFixed(2)} (brokerage ${ch.brokerage}, STT ${ch.stt}, stamp ${ch.stamp}, exchange and SEBI ${(ch.exch + ch.sebi).toFixed(2)}, GST ${ch.gst})` });
  }

  sellShares(code, qty) {
    const info = instrumentInfo(code);
    if (!Number.isInteger(qty) || qty <= 0) throw new FinError('Quantity must be a whole number of at least 1.');
    if (qty > this.qty(code) + 1e-9) throw new FinError(`You hold only ${this.qty(code)} ${code}.`);
    if (!this.marketOpen()) return this._amoQueue('sell', code, qty);
    const price = this.market.price(code), value = qty * price, ch = this.tradeCharges('sell', value, info.type);
    const { cost, used } = this._removeFIFO(code, qty);
    this._gainFromCode(code, used, price - ch.total / qty);
    const amount = Math.round((value - ch.total) * 100) / 100;
    this._credit(amount);
    const pl = amount - cost; this.realised += pl;
    this._emit({ type: 'trade' });
    return this._log({ type: 'sell', asset: info.type, code, name: info.name, qty, price, amount, flow: amount, pl: Math.round(pl * 100) / 100, charges: ch.total, note: `Value ${value.toFixed(2)} − charges ${ch.total.toFixed(2)} (brokerage ${ch.brokerage}, STT ${ch.stt}, DP ${ch.dp}, GST ${ch.gst})` });
  }

  buyFund(code, amount, { via = 'lumpsum' } = {}) {
    const f = FUNDS.find((x) => x.code === code);
    if (!f) throw new FinError('Unknown fund.');
    if (amount < LIMITS.mf.min) throw new FinError(`Minimum investment is ₹${LIMITS.mf.min}.`);
    const nav = this.market.price(code);
    const paid = this._debit(amount, `${f.name}`);
    const units = Math.floor((paid / nav) * 1000) / 1000;
    this._addLot(code, units, nav);
    this._emit({ type: 'trade' });
    return this._log({ type: via === 'sip' ? 'sip' : 'buy', asset: 'fund', code, name: f.name, qty: units, price: nav, amount: -paid, flow: -paid });
  }

  /** Redeem fund units (FIFO). Applies ELSS lock-in and exit load rules. */
  redeemFund(code, units) {
    const f = FUNDS.find((x) => x.code === code);
    if (!f) throw new FinError('Unknown fund.');
    units = Math.floor(units * 1000) / 1000;
    if (!(units > 0) || units > this.qty(code) + 1e-6) throw new FinError(`You hold ${this.qty(code).toFixed(3)} units.`);
    const check = this.redeemable(code);
    if (units > check.free + 1e-6) throw new FinError(`Only ${check.free.toFixed(3)} units are free to redeem. ELSS units are locked for 3 years from each purchase.`);
    const nav = this.market.price(code);
    // Exit load per lot by holding period
    let load = 0, left = units;
    for (const l of this.holdings[code]) {
      if (left <= 0) break;
      const take = Math.min(l.qty, left);
      if (f.exitLoad && daysBetween(l.date, this.date) < 365) load += take * nav * f.exitLoad;
      left -= take;
    }
    const { cost, used } = this._removeFIFO(code, units);
    this._gainFromCode(code, used, nav - (load / units));
    const gross = units * nav, amount = Math.round((gross - load) * 100) / 100;
    this._credit(amount);
    const pl = amount - cost; this.realised += pl;
    this._emit({ type: 'trade' });
    return this._log({ type: 'redeem', asset: 'fund', code, name: f.name, qty: units, price: nav, amount, flow: amount, pl: Math.round(pl * 100) / 100, note: load ? `Exit load ₹${load.toFixed(2)} (units held under 1 year)` : undefined });
  }

  redeemable(code) {
    const f = FUNDS.find((x) => x.code === code);
    const lots = this.holdings[code] || [];
    if (!f?.lockInYears) return { free: this.qty(code), locked: 0 };
    let free = 0, locked = 0;
    for (const l of lots) (yearsBetween(l.date, this.date) >= f.lockInYears ? (free += l.qty) : (locked += l.qty));
    // FIFO: only a prefix of free lots can be redeemed
    let prefix = 0; for (const l of lots) { if (yearsBetween(l.date, this.date) >= f.lockInYears) prefix += l.qty; else break; }
    return { free: prefix, locked: locked + free - prefix };
  }

  startSIP(code, amount, day, stepUpPct = 0) {
    const f = FUNDS.find((x) => x.code === code);
    if (!f) throw new FinError('Unknown fund.');
    if (amount < LIMITS.mf.min) throw new FinError(`Minimum SIP is ₹${LIMITS.mf.min}.`);
    if (!(day >= 1 && day <= 28)) throw new FinError('Pick a SIP date between 1 and 28.');
    if (stepUpPct < 0 || stepUpPct > 50) throw new FinError('Step-up must be between 0% and 50% a year.');
    let next = this.date.slice(0, 8) + String(day).padStart(2, '0');
    if (next <= this.date) next = addMonths(next, 1);
    const sip = { id: `SIP${++this.seq}`, code, name: f.name, amount, base: amount, day, stepUpPct, start: this.date, next, count: 0, active: true };
    this.sips.push(sip);
    this._log({ type: 'sip-start', asset: 'fund', code, name: f.name, amount: 0, note: `₹${amount}/month on day ${day}${stepUpPct ? `, step-up ${stepUpPct}%/yr` : ''}. First instalment ${next}.` });
    return sip;
  }

  stopSIP(id) {
    const s = this.sips.find((x) => x.id === id && x.active);
    if (!s) throw new FinError('SIP not found.');
    s.active = false;
    this._log({ type: 'sip-stop', asset: 'fund', code: s.code, name: s.name, amount: 0, note: `Stopped after ${s.count} instalments. Units already bought stay invested.` });
  }

  // ------------------------------------------------ bank: FD, RD, loans
  openFD(principal, months) {
    if (principal < 1000) throw new FinError('Minimum FD is ₹1,000.');
    if (!(months >= 1 && months <= 120)) throw new FinError('Tenure must be 1 to 120 months.');
    const rate = fdRate(months);
    const amt = this._debit(principal, 'this FD');
    const fd = { id: `FD${++this.seq}`, principal: amt, rate, months, start: this.date, maturity: addMonths(this.date, months), status: 'active' };
    fd.maturityValue = fdValue(fd.principal, rate, months / 12);
    this.fds.push(fd);
    this._log({ type: 'fd-open', asset: 'deposit', code: fd.id, name: `Fixed deposit, ${months} months @ ${(rate * 100).toFixed(2)}%`, amount: -amt, flow: -amt, note: `Matures ${fd.maturity} for ₹${fd.maturityValue.toFixed(2)}` });
    return fd;
  }

  breakFD(id) {
    const fd = this.fds.find((x) => x.id === id && x.status === 'active');
    if (!fd) throw new FinError('FD not found.');
    const heldYears = yearsBetween(fd.start, this.date);
    const heldMonths = Math.max(0, Math.floor(daysBetween(fd.start, this.date) / 30.4));
    const applicable = heldMonths >= 1 ? fdRate(heldMonths) : 0;
    const rate = Math.max(0, applicable - FD_PENALTY);
    const value = heldMonths >= 1 ? fdValue(fd.principal, rate, heldYears) : fd.principal;
    fd.status = 'closed early'; fd.closed = this.date;
    this._credit(value);
    return this._log({ type: 'fd-break', asset: 'deposit', code: fd.id, name: 'FD closed early', amount: round2(value), flow: round2(value), note: `Paid at ${(rate * 100).toFixed(2)}% (rate for ${heldMonths} months held, minus 1% penalty)` });
  }

  openRD(installment, months) {
    if (installment < 100) throw new FinError('Minimum RD instalment is ₹100.');
    if (!(months >= 6 && months <= 120)) throw new FinError('RD tenure must be 6 to 120 months.');
    const rate = fdRate(months);
    const rd = { id: `RD${++this.seq}`, installment, rate, months, start: this.date, next: this.date, paid: [], missed: 0, status: 'active', maturity: addMonths(this.date, months) };
    this.rds.push(rd);
    this._log({ type: 'rd-open', asset: 'deposit', code: rd.id, name: `Recurring deposit ₹${installment}/month × ${months} @ ${(rate * 100).toFixed(2)}%`, amount: 0 });
    this._processRD(rd);
    return rd;
  }

  _processRD(rd) {
    while (rd.status === 'active' && rd.next <= this.date && rd.paid.length + rd.missed < rd.months) {
      if (this.cash >= rd.installment) {
        this._debit(rd.installment, 'RD instalment'); rd.paid.push(rd.next);
        this._log({ type: 'rd-pay', asset: 'deposit', code: rd.id, name: 'RD instalment', amount: -rd.installment, flow: -rd.installment });
      } else {
        rd.missed++;
        this._log({ type: 'rd-missed', asset: 'deposit', code: rd.id, name: 'RD instalment missed: not enough balance', amount: 0 });
      }
      rd.next = addMonths(rd.start, rd.paid.length + rd.missed);
    }
  }

  _newLoan(principal, rate, months, kind = 'personal') {
    const e = round2(emi(principal, rate, months));
    const loan = { id: `LN${++this.seq}`, kind, principal, rate, months, emi: e, start: this.date, next: addMonths(this.date, 1), balance: principal, paidCount: 0, interestPaid: 0, missed: 0, status: 'active' };
    this.loans.push(loan);
    return loan;
  }

  takeLoan(principal, months) {
    if (principal < 10000 || principal > 500000) throw new FinError('Personal loans here are ₹10,000 to ₹5,00,000.');
    if (!(months >= 6 && months <= 60)) throw new FinError('Tenure must be 6 to 60 months.');
    const rate = this.loanRateFor();
    if (rate === null) throw new FinError(`Loan declined: your credit score is ${this.creditScore().score}. Banks usually want 650 or more.`);
    const loan = this._newLoan(principal, rate, months);
    this._credit(principal);
    this._log({ type: 'loan-take', asset: 'loan', code: loan.id, name: `Personal loan ${months} months @ ${(loan.rate * 100).toFixed(1)}%`, amount: principal, note: `EMI ₹${loan.emi.toFixed(2)}. Total payable ₹${(loan.emi * months).toFixed(0)}.` });
    return loan;
  }

  // ------------------------------------------------ showrooms (spending, not investing)
  /** Buy a vehicle outright or with a car loan. First-year insurance is paid at purchase. */
  buyCar(catalogId, color, { loan = null } = {}) {
    const c = carById[catalogId];
    if (!c || c.gift) throw new FinError('That vehicle is not for sale.');
    const insurance = round2(c.price * (c.model === 'scooter' ? INSURANCE_PCT.scooter : INSURANCE_PCT.default));
    let down = c.price, ln = null;
    if (loan) {
      const pct = Number(loan.downPct), months = Number(loan.months);
      if (!(pct >= CAR_LOAN.minDownPct && pct <= 90)) throw new FinError(`Down payment must be ${CAR_LOAN.minDownPct}% to 90%.`);
      if (!(months >= CAR_LOAN.minMonths && months <= CAR_LOAN.maxMonths)) throw new FinError(`Car loan tenure is ${CAR_LOAN.minMonths} to ${CAR_LOAN.maxMonths} months.`);
      down = round2(c.price * pct / 100);
      if (down + insurance > this.cash) throw new FinError(`You need ₹${Math.ceil(down + insurance).toLocaleString('en-IN')} for the down payment and first-year insurance.`);
      ln = this._newLoan(round2(c.price - down), CAR_LOAN.rate, months, 'car');
    }
    if (down + insurance > this.cash + 1e-6) { if (ln) this.loans.pop(); throw new FinError(`You need ₹${Math.ceil(down + insurance).toLocaleString('en-IN')} including first-year insurance. Try a car loan, or a cheaper vehicle.`); }
    this._debit(down, c.name);
    const car = { id: `CAR${++this.seq}`, catalogId, color, price: c.price, bought: this.date, loanId: ln?.id || null, lastInsured: this.date };
    this.garage.push(car);
    this._log({ type: 'car-buy', asset: 'vehicle', code: car.id, name: `Bought ${c.name}`, amount: -down, note: ln ? `Down payment. Car loan ${ln.id}: ₹${ln.principal.toLocaleString('en-IN')} at ${(ln.rate * 100).toFixed(1)}%, EMI ₹${ln.emi.toFixed(0)} × ${ln.months}.` : 'Paid in full.' });
    this._debit(insurance, 'insurance');
    this._log({ type: 'car-insurance', asset: 'vehicle', code: car.id, name: `${c.name} insurance, year 1`, amount: -insurance });
    this._emit({ type: 'trade' });
    return car;
  }

  buyClothing(itemId, color) {
    const it = clothById[itemId];
    if (!it) throw new FinError('Unknown item.');
    if (this.wardrobe.some((w) => w.itemId === itemId && w.color === color)) throw new FinError('You already own this in that colour.');
    this._debit(it.price, it.name);
    const w = { id: `W${++this.seq}`, itemId, color, bought: this.date };
    this.wardrobe.push(w);
    this._log({ type: 'shop', asset: 'clothing', code: w.id, name: `Bought ${it.name}`, amount: -it.price });
    this._emit({ type: 'trade' });
    return w;
  }

  carValueNow(car) { return car.gift ? 0 : carValue(car.price, yearsBetween(car.bought, this.date)); }

  prepayLoan(id, amount) {
    const l = this.loans.find((x) => x.id === id && x.status === 'active');
    if (!l) throw new FinError('Loan not found.');
    amount = Math.min(amount, l.balance);
    this._debit(amount, 'prepayment');
    l.balance = round2(l.balance - amount);
    const left = l.months - l.paidCount;
    if (l.balance <= 0.5) { l.status = 'closed'; l.balance = 0; }
    else l.emi = round2(emi(l.balance, l.rate, left)); // keep tenure, reduce EMI
    return this._log({ type: 'loan-prepay', asset: 'loan', code: l.id, name: 'Loan prepayment', amount: -amount, note: l.status === 'closed' ? 'Loan fully repaid.' : `New EMI ₹${l.emi.toFixed(2)}` });
  }

  _processLoan(l) {
    while (l.status === 'active' && l.next <= this.date) {
      const interest = round2(l.balance * (l.rate / 12));
      const pay = Math.min(l.emi, round2(l.balance + interest));
      if (this.cash >= pay) {
        this._debit(pay, 'EMI');
        l.balance = round2(l.balance + interest - pay); l.interestPaid += interest; l.paidCount++;
        this._onEmi(l, interest, pay - interest);
        this._log({ type: 'emi', asset: 'loan', code: l.id, name: 'Loan EMI', amount: -pay, note: `Interest ₹${interest.toFixed(2)}, principal ₹${(pay - interest).toFixed(2)}` });
        if (l.balance <= 0.5 || l.paidCount >= l.months) { l.status = 'closed'; l.balance = 0; }
      } else {
        l.missed++; l.balance = round2(l.balance + interest);
        const fee = round2(Math.min(500, l.emi * 0.02));
        l.balance = round2(l.balance + fee);
        this._log({ type: 'emi-missed', asset: 'loan', code: l.id, name: 'EMI missed: not enough balance', amount: 0, note: `Interest still added, plus late fee ₹${fee} (illustrative). Missed EMIs hurt your credit score.` });
      }
      l.next = addMonths(l.start, l.paidCount + l.missed + 1);
    }
  }

  _carCost(car, amount, name) {
    if (this.cash >= amount) { this._debit(amount, name); this._log({ type: 'car-cost', asset: 'vehicle', code: car.id, name, amount: -amount }); }
    else this._log({ type: 'car-cost-missed', asset: 'vehicle', code: car.id, name: `${name}: not enough balance`, amount: 0, note: 'Running costs keep coming whether or not you can afford them.' });
  }

  // ------------------------------------------------ government schemes
  declareAge(age) {
    if (!(age >= 18 && age <= 100)) throw new FinError('Enter an age between 18 and 100.');
    this.declaredAge = Math.floor(age);
    this._log({ type: 'profile', name: `Simulation age set to ${this.declaredAge}`, amount: 0 });
  }

  depositPPF(amount) {
    if (amount < LIMITS.ppf.min) throw new FinError('Minimum PPF deposit is ₹500 a year.');
    if (!this.ppf) this.ppf = { opened: this.date, balance: 0, accrued: 0, fy: {}, low: 0 };
    const fy = fyOf(this.date), done = this.ppf.fy[fy] || 0;
    if (done + amount > LIMITS.ppf.maxPerFY) throw new FinError(`PPF limit is ₹1,50,000 per financial year. You can add ₹${LIMITS.ppf.maxPerFY - done} more in FY ${fy}.`);
    if (yearsBetween(this.ppf.opened, this.date) >= 15) throw new FinError('This PPF account has completed 15 years. Extensions are not simulated yet.');
    const a = this._debit(amount, 'PPF');
    this.ppf.fy[fy] = done + a; this.ppf.balance += a;
    if (parseDate(this.date).getUTCDate() <= 5) this.ppf.low = this.ppf.balance;
    return this._log({ type: 'ppf-deposit', asset: 'scheme', code: 'PPF', name: 'PPF deposit', amount: -a, flow: -a });
  }

  buyNSC(amount) {
    if (amount < LIMITS.nsc.min || amount % 100) throw new FinError('NSC: minimum ₹1,000, in multiples of ₹100.');
    const a = this._debit(amount, 'NSC');
    const n = { id: `NSC${++this.seq}`, amount: a, start: this.date, maturity: addMonths(this.date, 60), rate: RATES.nsc, status: 'active' };
    n.maturityValue = round2(a * (1 + n.rate) ** 5);
    this.nsc.push(n);
    return this._log({ type: 'nsc-buy', asset: 'scheme', code: n.id, name: `NSC @ ${(n.rate * 100).toFixed(1)}%`, amount: -a, flow: -a, note: `Matures ${n.maturity} for ₹${n.maturityValue.toFixed(2)}` });
  }

  openSCSS(amount) {
    if (this.declaredAge === null) throw new FinError('SCSS needs your age. Set your simulation age first.');
    if (this.declaredAge < LIMITS.scss.minAge) throw new FinError('SCSS is for people aged 60 or above (55–60 only for certain retirees, not simulated).');
    if (amount < 1000 || amount % 1000) throw new FinError('SCSS deposits are in multiples of ₹1,000.');
    const total = this.scss.filter((s) => s.status === 'active').reduce((t, s) => t + s.amount, 0);
    if (total + amount > LIMITS.scss.max) throw new FinError('SCSS limit is ₹30 lakh per person across accounts.');
    const a = this._debit(amount, 'SCSS');
    const s = { id: `SCSS${++this.seq}`, amount: a, start: this.date, lastPaid: this.date, maturity: addMonths(this.date, 60), rate: RATES.scss, status: 'active' };
    this.scss.push(s);
    return this._log({ type: 'scss-open', asset: 'scheme', code: s.id, name: `SCSS @ ${(s.rate * 100).toFixed(1)}%`, amount: -a, flow: -a, note: 'Interest paid out every quarter.' });
  }

  openSSY(childAge, amount) {
    if (this.ssy) throw new FinError('One Sukanya Samriddhi account is simulated per player.');
    if (!(childAge >= 0 && childAge < LIMITS.ssy.maxChildAge)) throw new FinError('SSY can be opened only for a girl child below 10 years.');
    this.ssy = { opened: this.date, childAge: Math.floor(childAge), balance: 0, accrued: 0, fy: {}, low: 0 };
    this._log({ type: 'ssy-open', asset: 'scheme', code: 'SSY', name: `Sukanya Samriddhi account opened (girl aged ${Math.floor(childAge)})`, amount: 0 });
    return this.depositSSY(amount);
  }

  depositSSY(amount) {
    if (!this.ssy) throw new FinError('Open an SSY account first.');
    if (amount < LIMITS.ssy.min) throw new FinError('Minimum SSY deposit is ₹250 a year.');
    if (yearsBetween(this.ssy.opened, this.date) >= LIMITS.ssy.depositYears) throw new FinError('Deposits are allowed only for 15 years from opening.');
    const fy = fyOf(this.date), done = this.ssy.fy[fy] || 0;
    if (done + amount > LIMITS.ssy.maxPerFY) throw new FinError(`SSY limit is ₹1,50,000 per financial year. You can add ₹${LIMITS.ssy.maxPerFY - done} more in FY ${fy}.`);
    const a = this._debit(amount, 'SSY');
    this.ssy.fy[fy] = done + a; this.ssy.balance += a;
    if (parseDate(this.date).getUTCDate() <= 5) this.ssy.low = this.ssy.balance;
    return this._log({ type: 'ssy-deposit', asset: 'scheme', code: 'SSY', name: 'SSY deposit', amount: -a, flow: -a });
  }

  contributeNPS(amount) {
    if (amount < LIMITS.nps.min) throw new FinError('Minimum NPS contribution here is ₹1,000.');
    if (this.declaredAge !== null && this.declaredAge >= 75) throw new FinError('New NPS contributions are not simulated beyond age 75.');
    const nav = this.market.price('NPS');
    const a = this._debit(amount, 'NPS');
    const units = Math.floor((a / nav) * 10000) / 10000;
    this._addLot('NPS', units, nav);
    return this._log({ type: 'nps', asset: 'nps', code: 'NPS', name: 'NPS Tier I contribution', qty: units, price: nav, amount: -a, flow: -a });
  }

  /** NPS exit for a non-government subscriber at 60+ (rules as amended Dec 2025). */
  exitNPS(lumpPct) {
    if (this.declaredAge === null || this.declaredAge < 60) throw new FinError('Normal NPS exit is at age 60. Set a simulation age of 60 or more to try it.');
    const units = this.qty('NPS'); if (!units) throw new FinError('No NPS balance.');
    const corpus = units * this.market.price('NPS');
    const maxLump = corpus <= 800000 ? 1 : 0.8;
    if (lumpPct / 100 > maxLump + 1e-9) throw new FinError(corpus <= 800000 ? 'Up to 100% is allowed for a corpus of ₹8 lakh or less.' : 'At least 20% must buy an annuity; lump sum up to 80%.');
    const { cost } = this._removeFIFO('NPS', units);
    const lump = round2(corpus * lumpPct / 100), annuity = round2(corpus - lump);
    this._credit(lump); this.realised += corpus - cost;
    if (annuity > 0) this._startAnnuity(annuity, 'NPS');
    return this._log({ type: 'nps-exit', asset: 'nps', code: 'NPS', name: 'NPS exit', amount: lump, flow: corpus, note: `Lump sum ₹${lump.toFixed(0)}; ₹${annuity.toFixed(0)} goes to an annuity (pension), not to cash.` });
  }

  // ------------------------------------------------ time
  /** Advance the simulated calendar by n days, running every scheduled event. Returns news. */
  advance(n = 1) {
    const news = [];
    for (let i = 0; i < n; i++) {
      this.date = addDays(this.date, 1);
      const d = this.date, dom = parseDate(d).getUTCDate(), mon = parseDate(d).getUTCMonth();
      if (isWeekday(d)) news.push(...this.market.step(d));
      this._lifeDay(d);
      // SIPs: run on the first weekday on/after the due date
      if (isWeekday(d)) for (const s of this.sips) if (s.active && s.next <= d) {
        try { this.buyFund(s.code, s.amount, { via: 'sip' }); s.count++; }
        catch { this._log({ type: 'sip-failed', asset: 'fund', code: s.code, name: `SIP instalment skipped: not enough balance`, amount: 0 }); }
        s.next = addMonths(s.next.slice(0, 8) + String(s.day).padStart(2, '0'), 1);
        if (s.stepUpPct && s.count && s.count % 12 === 0) s.amount = Math.round(s.amount * (1 + s.stepUpPct / 100));
      }
      for (const rd of this.rds) {
        this._processRD(rd);
        if (rd.status === 'active' && d >= rd.maturity) {
          const v = rdValue(rd, d); rd.status = 'matured'; rd.value = v; this._credit(v);
          this._log({ type: 'rd-mature', asset: 'deposit', code: rd.id, name: 'RD matured', amount: v, flow: v });
        }
      }
      for (const l of this.loans) this._processLoan(l);
      // Vehicle insurance renews on each purchase anniversary (fuel is bought at the pump)
      for (const car of this.garage) {
        if (car.gift) continue;
        const spec = carById[car.catalogId];
        if (yearsBetween(car.lastInsured, d) >= 1) {
          car.lastInsured = d;
          this._carCost(car, round2(this.carValueNow(car) * (spec.model === 'scooter' ? INSURANCE_PCT.scooter : INSURANCE_PCT.default) * (car.zeroDep ? 1.15 : 1)), `${spec.name} insurance renewal${car.zeroDep ? ' (with zero-dep)' : ''}`);
        }
      }
      for (const fd of this.fds) if (fd.status === 'active' && d >= fd.maturity) {
        fd.status = 'matured'; this._credit(fd.maturityValue);
        this._log({ type: 'fd-mature', asset: 'deposit', code: fd.id, name: 'FD matured', amount: fd.maturityValue, flow: fd.maturityValue });
      }
      for (const n2 of this.nsc) if (n2.status === 'active' && d >= n2.maturity) {
        n2.status = 'matured'; this._credit(n2.maturityValue);
        this._log({ type: 'nsc-mature', asset: 'scheme', code: n2.id, name: 'NSC matured', amount: n2.maturityValue, flow: n2.maturityValue });
      }
      // SCSS: interest on 1 Apr, 1 Jul, 1 Oct, 1 Jan; principal back at maturity
      for (const s of this.scss) if (s.status === 'active') {
        const due = dom === 1 && [0, 3, 6, 9].includes(mon);
        const mature = d >= s.maturity;
        if (due || mature) {
          const int = round2(s.amount * s.rate * daysBetween(s.lastPaid, d) / 365);
          if (int > 0) { this._credit(int); this._log({ type: 'scss-interest', asset: 'scheme', code: s.id, name: 'SCSS quarterly interest', amount: int, flow: int }); }
          s.lastPaid = d;
        }
        if (mature) { s.status = 'matured'; this._credit(s.amount); this._log({ type: 'scss-mature', asset: 'scheme', code: s.id, name: 'SCSS matured: principal returned', amount: s.amount, flow: s.amount }); }
      }
      // PPF and SSY: interest on the lowest balance between the 5th and month end, credited on 31 March
      for (const acc of [this.ppf, this.ssy]) if (acc) {
        if (dom === 5) acc.low = acc.balance;
        if (isMonthEnd(d)) acc.accrued += Math.min(acc.low, acc.balance) * (acc === this.ppf ? RATES.ppf : RATES.ssy) / 12;
        if (mon === 2 && dom === 31 && acc.accrued > 0) {
          const int = round2(acc.accrued); acc.balance += int; acc.accrued = 0;
          this._log({ type: acc === this.ppf ? 'ppf-interest' : 'ssy-interest', asset: 'scheme', code: acc === this.ppf ? 'PPF' : 'SSY', name: `${acc === this.ppf ? 'PPF' : 'SSY'} interest credited for the year`, amount: 0, note: `₹${int.toFixed(2)} added to the account (not to your wallet)` });
        }
        if (dom === 1) acc.low = acc.balance; // carried into the month until the 5th
      }
      // Savings account interest: daily accrual, credited at quarter end
      this.savingsAccrued += this.cash * RATES.savings / 365;
      if (isMonthEnd(d) && [2, 5, 8, 11].includes(mon) && this.savingsAccrued >= 0.01) {
        const int = round2(this.savingsAccrued); this.savingsAccrued = 0; this._credit(int);
        this._log({ type: 'interest', asset: 'cash', name: 'Savings account interest', amount: int });
      }
    }
    if (n) this._emit({ type: 'advance', news });
    return news;
  }

  // ------------------------------------------------ valuation
  snapshot() {
    const m = this.market, rows = [];
    for (const [code, lots] of Object.entries(this.holdings)) {
      const info = instrumentInfo(code), q = lots.reduce((s, l) => s + l.qty, 0);
      const cost = lots.reduce((s, l) => s + l.qty * l.price, 0), price = m.price(code);
      rows.push({ code, name: info.name, type: info.type, category: info.category || info.sector || '', qty: q, cost, price, value: q * price, pl: q * price - cost });
    }
    const byType = (t) => rows.filter((r) => r.type === t).reduce((s, r) => s + r.value, 0);
    const deposits = this.fds.filter((f) => f.status === 'active').reduce((s, f) => s + fdValue(f.principal, f.rate, yearsBetween(f.start, this.date)), 0)
      + this.rds.filter((r) => r.status === 'active').reduce((s, r) => s + rdValue(r, this.date), 0);
    const schemes = (this.ppf ? this.ppf.balance : 0) + (this.ssy ? this.ssy.balance : 0)
      + this.nsc.filter((n) => n.status === 'active').reduce((s, n) => s + n.amount * (1 + n.rate) ** yearsBetween(n.start, this.date), 0)
      + this.scss.filter((s) => s.status === 'active').reduce((t, s) => t + s.amount, 0);
    const loans = this.loans.filter((l) => l.status === 'active').reduce((s, l) => s + l.balance, 0) + (this.life?.card?.status === 'active' ? this.life.card.balance : 0);
    const vehicles = this.garage.reduce((t, c) => t + this.carValueNow(c), 0);
    const lw = this._lifeWorth();
    const alloc = { Cash: this.cash, Stocks: byType('stock'), ETFs: byType('etf'), 'Mutual funds': byType('fund'), NPS: byType('nps'), Deposits: deposits, 'Govt schemes': schemes, ...lw.assets, Vehicles: vehicles };
    const assets = Object.values(alloc).reduce((a, b) => a + b, 0);
    const invested = assets - this.cash - vehicles;
    const flows = this.ledger.filter((e) => e.flow).map((e) => ({ date: e.date, amount: e.flow }));
    if (invested > 0) flows.push({ date: this.date, amount: invested });
    const unrealised = rows.reduce((s, r) => s + r.pl, 0);
    return { date: this.date, rows, alloc, assets, loans, netWorth: assets - loans, invested, unrealised, realised: this.realised, xirr: flows.length > 1 && daysBetween(flows[0].date, this.date) >= 30 ? xirr(flows) : null };
  }
}

export class FinError extends Error {}

Object.assign(Finance.prototype, LIFE_METHODS);

export const fdValue = (P, r, years) => (years < 0.5 ? P * (1 + r * years) : P * (1 + r / 4) ** (4 * years));
export function rdValue(rd, date) {
  const end = date < rd.maturity ? date : rd.maturity;
  return round2(rd.paid.reduce((s, d) => s + rd.installment * (1 + rd.rate / 4) ** (4 * Math.max(0, yearsBetween(d, end))), 0));
}
const round2 = (v) => Math.round(v * 100) / 100;
