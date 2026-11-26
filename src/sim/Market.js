// FICTIONAL SIMULATION. Every company, fund, ETF and price here is invented by FinVora and labelled
// as such in the UI. Nothing in this file is real market data.
//
// One step = one trading day. A common market factor drives all equities (with each instrument's beta),
// plus instrument-specific noise and occasional company news shocks. Debt and liquid instruments
// accrue a steady yield with small noise. Gold, silver and crude follow their own random walks.

export class RNG {
  constructor(state = 20261125) { this.state = state >>> 0; }
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  gauss() { let u = 0, v = 0; while (!u) u = this.next(); while (!v) v = this.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
}

const D = 1 / 252;

// Fundamentals are fictional and used by the Research Centre. Figures in ₹ crore; shares in crore.
export const COMPANIES = [
  // AccoFinTra: the strongest business in FinVora. Higher, steadier long-run growth (alpha) but it can still fall.
  { symbol: 'AFT', name: 'AccoFinTra', sector: 'Financial Services', cap: 'Large cap', price: 1500, beta: 0.8, vol: 0.13, alpha: 0.06, shares: 70, revenue: 18000, profit: 3600, debtEquity: 0.1, divYield: 1.4 },
  { symbol: 'STR', name: 'Star Pharma', sector: 'Healthcare', cap: 'Large cap', price: 1286.0, beta: 0.7, vol: 0.18, shares: 68, revenue: 21400, profit: 3350, debtEquity: 0.1, divYield: 1.2 },
  { symbol: 'JPM', name: 'JP Mojidra Bank', sector: 'Banking', cap: 'Large cap', price: 742.2, beta: 1.05, vol: 0.16, shares: 150, revenue: 48000, profit: 9800, debtEquity: 0, divYield: 1.0 },
  { symbol: 'MMA', name: 'Mama Motors', sector: 'Automobiles', cap: 'Large cap', price: 965.8, beta: 1.2, vol: 0.2, shares: 95, revenue: 62000, profit: 5400, debtEquity: 0.4, divYield: 1.5 },
  { symbol: 'SMNI', name: 'S-Mani Emberleaf Foods', sector: 'Consumer', cap: 'Mid cap', price: 318.4, beta: 0.6, vol: 0.15, shares: 55, revenue: 7400, profit: 610, debtEquity: 0.2, divYield: 2.1 },
  { symbol: 'BLU', name: 'BLU Energy', sector: 'Energy', cap: 'Small cap', price: 188.9, beta: 1.4, vol: 0.38, shares: 30, revenue: 1900, profit: 85, debtEquity: 2.3, divYield: 0 },
  { symbol: 'MJDR', name: 'Mojidra Tech', sector: 'Technology', cap: 'Large cap', price: 2210.0, beta: 1.1, vol: 0.26, shares: 60, revenue: 39000, profit: 7100, debtEquity: 0.05, divYield: 0.6 },
  { symbol: 'MOJI', name: 'MOJI Telecom', sector: 'Telecom', cap: 'Small cap', price: 96.35, beta: 1.3, vol: 0.32, shares: 240, revenue: 14500, profit: -380, debtEquity: 3.1, divYield: 0 },
];

export const COMMODITIES = [
  { symbol: 'GOLD', name: 'Gold', unit: 'per gram', price: 7000, drift: 0.07, vol: 0.14 },
  { symbol: 'SILVER', name: 'Silver', unit: 'per kg', price: 90000, drift: 0.06, vol: 0.24 },
  { symbol: 'CRUDE', name: 'Crude oil', unit: 'per barrel', price: 6200, drift: 0.02, vol: 0.32 },
];

export const ETFS = [
  { symbol: 'FWIDX', name: 'FinVora Market Index ETF', tracks: 'index', ratio: 1 / 100, er: 0.0005, desc: 'Holds all 8 listed FinVora companies in proportion to their market value.' },
  { symbol: 'FWGOLD', name: 'FinVora Gold ETF', tracks: 'GOLD', ratio: 1 / 100, er: 0.005, desc: 'Each unit tracks the simulated price of 0.01 g of gold.' },
  { symbol: 'FWSILV', name: 'FinVora Silver ETF', tracks: 'SILVER', ratio: 1 / 1000, er: 0.005, desc: 'Each unit tracks the simulated price of 1 g of silver.' },
  { symbol: 'FWLIQ', name: 'FinVora Liquid ETF', tracks: 'liquid', ratio: 1, er: 0.002, desc: 'Parks cash in very short-term debt; behaves almost like a savings account.' },
];

// Mutual funds. kind: equity | debt | hybrid | liquid | gold | intl. equityShare used for hybrids.
export const FUNDS = [
  { code: 'FWIF', name: 'AccoFinTra Index Fund', category: 'Index fund', kind: 'equity', beta: 1.0, extraVol: 0.005, er: 0.002, risk: 'Very High', exitLoad: 0, nav: 100 },
  { code: 'FWLC', name: 'AccoFinTra Bluechip Fund', category: 'Large cap', kind: 'equity', beta: 0.92, extraVol: 0.03, er: 0.009, risk: 'Very High', exitLoad: 0.01, nav: 86.4 },
  { code: 'FWFC', name: 'AccoFinTra Flexi Cap Fund', category: 'Flexi cap', kind: 'equity', beta: 1.02, extraVol: 0.04, er: 0.01, risk: 'Very High', exitLoad: 0.01, nav: 64.2 },
  { code: 'FWMC', name: 'AccoFinTra Midcap Opportunities Fund', category: 'Mid cap', kind: 'equity', beta: 1.22, extraVol: 0.06, er: 0.011, risk: 'Very High', exitLoad: 0.01, nav: 142.8 },
  { code: 'FWSC', name: 'AccoFinTra Small Cap Discovery Fund', category: 'Small cap', kind: 'equity', beta: 1.42, extraVol: 0.09, er: 0.012, risk: 'Very High', exitLoad: 0.01, nav: 51.7 },
  { code: 'FWTS', name: 'AccoFinTra Tax Saver (ELSS) Fund', category: 'ELSS', kind: 'equity', beta: 1.0, extraVol: 0.04, er: 0.01, risk: 'Very High', exitLoad: 0, lockInYears: 3, nav: 98.1 },
  { code: 'FWHY', name: 'AccoFinTra Aggressive Hybrid Fund', category: 'Aggressive hybrid', kind: 'hybrid', equityShare: 0.7, beta: 1.0, extraVol: 0.02, er: 0.01, risk: 'Very High', exitLoad: 0.01, nav: 73.5 },
  { code: 'FWSD', name: 'AccoFinTra Short Duration Fund', category: 'Short duration debt', kind: 'debt', yield: 0.072, vol: 0.015, er: 0.006, risk: 'Moderate', exitLoad: 0, nav: 31.2 },
  { code: 'FWLQ', name: 'AccoFinTra Liquid Fund', category: 'Liquid', kind: 'liquid', yield: 0.066, vol: 0.002, er: 0.002, risk: 'Low to Moderate', exitLoad: 0, nav: 1840.5 },
  { code: 'FWGF', name: 'AccoFinTra Gold Fund (FoF)', category: 'Gold fund', kind: 'gold', er: 0.004, risk: 'High', exitLoad: 0.01, nav: 24.6 },
  { code: 'FWIN', name: 'AccoFinTra Global Equity FoF', category: 'International', kind: 'intl', er: 0.012, extraVol: 0.04, risk: 'Very High', exitLoad: 0.01, nav: 18.9 },
];

export const NPS_SCHEME = { code: 'NPS', name: 'NPS Tier I (simulated, 50% equity / 50% debt)', nav: 10 };

const HEADLINES = {
  up: ['{n} wins a large new contract', '{n} reports profit well ahead of estimates', '{n} announces a debt-free balance sheet', '{n} launches a well-received new product'],
  down: ['{n} misses quarterly profit estimates', '{n} faces a regulatory inquiry', '{n} loses a key customer', '{n} warns of weaker demand ahead'],
  mktUp: ['Strong economic data lifts the whole market', 'Foreign investors buy heavily across sectors'],
  mktDown: ['Global sell-off drags the whole market lower', 'Rate worries trigger a broad market correction'],
};

const HIST = 260;

export class Market {
  constructor(saved) {
    if (saved) { Object.assign(this, structuredClone(saved)); this.rng = new RNG(saved.rngState); this._reconcile(); return; }
    this.rng = new RNG();
    this.day = 0;
    this.stocks = COMPANIES.map((c) => ({ symbol: c.symbol, price: c.price, prev: c.price, open: c.price, hist: [c.price] }));
    this.commodities = COMMODITIES.map((c) => ({ symbol: c.symbol, price: c.price, prev: c.price, hist: [c.price] }));
    this.indexLevel = 10000; this.indexHist = [10000];
    this.intlLevel = 100; this.liquidLevel = 1;
    this.etfs = ETFS.map((e) => ({ symbol: e.symbol, price: 0, prev: 0, hist: [] }));
    this.funds = FUNDS.map((f) => ({ code: f.code, nav: f.nav, prev: f.nav, hist: [f.nav] }));
    this.nps = { nav: NPS_SCHEME.nav, prev: NPS_SCHEME.nav, hist: [NPS_SCHEME.nav] };
    this.news = [];
    this._priceEtfs(true);
    // Pre-run one simulated year so charts and returns have history from day one.
    for (let i = 0; i < 252; i++) this.step('history');
    this.news = []; this.day = 0;
    for (const s of this.stocks) s.open = s.price;
  }

  /**
   * A save made before an update can hold old company or fund codes. Keep every instrument that still exists,
   * add any new one with fresh simulated history, and remember the last price of retired ones (in `retired`)
   * so the wallet can buy those holdings back.
   */
  _reconcile() {
    const lists = [['stocks', 'symbol', COMPANIES, 'symbol'], ['etfs', 'symbol', ETFS, 'symbol'], ['commodities', 'symbol', COMMODITIES, 'symbol'], ['funds', 'code', FUNDS, 'code']];
    const ok = lists.every(([k, id, cat]) => Array.isArray(this[k]) && this[k].length === cat.length && cat.every((c, i) => this[k][i]?.[id] === c[id]));
    if (ok && this.nps && Array.isArray(this.news)) return;
    const fresh = new Market();
    this.retired = {};
    for (const [k, id, cat] of lists) {
      const old = Array.isArray(this[k]) ? this[k] : [];
      for (const o of old) if (!cat.some((c) => c[id] === o[id])) this.retired[o[id]] = o.price ?? o.nav;
      this[k] = cat.map((c) => old.find((o) => o[id] === c[id]) || fresh[k].find((o) => o[id] === c[id]));
    }
    this.nps ||= fresh.nps; this.news ||= [];
    if (!(this.indexLevel > 0)) { this.indexLevel = fresh.indexLevel; this.indexHist = fresh.indexHist; }
    if (!(this.liquidLevel > 0)) this.liquidLevel = fresh.liquidLevel;
    if (!(this.intlLevel > 0)) this.intlLevel = fresh.intlLevel;
  }

  serialize() { const { rng, ...rest } = this; return { ...structuredClone(rest), rngState: rng.state }; }

  _push(h, v) { h.push(v); if (h.length > HIST) h.shift(); }

  _priceEtfs(init = false) {
    ETFS.forEach((e, i) => {
      const s = this.etfs[i];
      let base;
      if (e.tracks === 'index') base = this.indexLevel * e.ratio;
      else if (e.tracks === 'liquid') base = 100 * this.liquidLevel;
      else base = this.commodities.find((c) => c.symbol === e.tracks).price * e.ratio;
      if (init) s.drag = 1; else s.drag *= 1 - e.er * D;
      s.prev = s.price || base * s.drag;
      s.price = round2(base * s.drag);
      this._push(s.hist, s.price);
    });
  }

  /** Advance one trading day. `dateStr` labels any news. Returns news items generated today. */
  step(dateStr) {
    const r = this.rng, today = [];
    this.day++;
    // Market factor with occasional market-wide events
    let m = 0.11 * D + 0.15 * Math.sqrt(D) * r.gauss();
    const ev = r.next();
    if (ev < 0.004) { m -= 0.03 + r.next() * 0.03; today.push({ date: dateStr, kind: 'market', text: pick(r, HEADLINES.mktDown), move: m }); }
    else if (ev < 0.008) { m += 0.02 + r.next() * 0.02; today.push({ date: dateStr, kind: 'market', text: pick(r, HEADLINES.mktUp), move: m }); }

    // Stocks
    let capBefore = 0, capAfter = 0;
    COMPANIES.forEach((c, i) => {
      const s = this.stocks[i];
      let ret = c.beta * m + (c.alpha || 0) * D + c.vol * Math.sqrt(D) * r.gauss();
      if (r.next() < 0.012) {
        const up = r.next() < 0.5, size = 0.04 + r.next() * 0.08;
        ret += up ? size : -size;
        today.push({ date: dateStr, kind: 'company', symbol: c.symbol, text: pick(r, up ? HEADLINES.up : HEADLINES.down).replace('{n}', c.name), move: up ? size : -size });
      }
      capBefore += s.price * c.shares;
      s.prev = s.price;
      s.price = round2(Math.max(1, s.price * Math.exp(ret)));
      capAfter += s.price * c.shares;
      this._push(s.hist, s.price);
    });
    const idxRet = capAfter / capBefore - 1;
    this.indexLevel *= 1 + idxRet; this._push(this.indexHist, round2(this.indexLevel));

    // Commodities
    COMMODITIES.forEach((c, i) => {
      const s = this.commodities[i];
      s.prev = s.price;
      s.price = round2(s.price * Math.exp((c.drift - 0.5 * c.vol * c.vol) * D + c.vol * Math.sqrt(D) * r.gauss()));
      this._push(s.hist, s.price);
    });
    const gold = COMMODITIES.findIndex((c) => c.symbol === 'GOLD');
    const goldRet = this.commodities[gold].price / this.commodities[gold].prev - 1;
    const intlRet = 0.09 * D + 0.16 * Math.sqrt(D) * r.gauss();
    this.intlLevel *= 1 + intlRet;
    this.liquidLevel *= 1 + 0.066 * D;
    this._priceEtfs();

    // Mutual funds (NAV after expense ratio)
    FUNDS.forEach((f, i) => {
      const s = this.funds[i];
      let ret;
      const debtRet = (y, v) => y * D + v * Math.sqrt(D) * r.gauss();
      switch (f.kind) {
        case 'equity': ret = f.beta * idxRet + f.extraVol * Math.sqrt(D) * r.gauss(); break;
        case 'hybrid': ret = f.equityShare * (f.beta * idxRet) + (1 - f.equityShare) * debtRet(0.072, 0.015) + f.extraVol * Math.sqrt(D) * r.gauss(); break;
        case 'gold': ret = goldRet; break;
        case 'intl': ret = intlRet + f.extraVol * Math.sqrt(D) * r.gauss(); break;
        default: ret = debtRet(f.yield, f.vol);
      }
      ret -= f.er * D;
      s.prev = s.nav;
      s.nav = Math.round(s.nav * (1 + ret) * 10000) / 10000;
      this._push(s.hist, s.nav);
    });
    // NPS: 50/50 equity index and government-bond-like debt, low cost
    const npsRet = 0.5 * idxRet + 0.5 * (0.075 * D + 0.02 * Math.sqrt(D) * r.gauss()) - 0.001 * D;
    this.nps.prev = this.nps.nav; this.nps.nav = Math.round(this.nps.nav * (1 + npsRet) * 10000) / 10000; this._push(this.nps.hist, this.nps.nav);

    this.news.push(...today);
    if (this.news.length > 40) this.news.splice(0, this.news.length - 40);
    return today;
  }

  /** Current price of any tradable code (stock symbol, ETF symbol, fund code, 'NPS'). */
  price(code) {
    const s = this.stocks.find((x) => x.symbol === code) || this.etfs.find((x) => x.symbol === code);
    if (s) return s.price;
    const f = this.funds.find((x) => x.code === code);
    if (f) return f.nav;
    if (code === 'NPS') return this.nps.nav;
    throw new Error(`Unknown instrument ${code}`);
  }

  history(code) {
    const s = this.stocks.find((x) => x.symbol === code) || this.etfs.find((x) => x.symbol === code) || this.commodities.find((x) => x.symbol === code);
    if (s) return s.hist;
    const f = this.funds.find((x) => x.code === code);
    if (f) return f.hist;
    if (code === 'NPS') return this.nps.hist;
    if (code === 'INDEX') return this.indexHist;
    return [];
  }
}

export const instrumentInfo = (code) =>
  COMPANIES.find((c) => c.symbol === code) && { ...COMPANIES.find((c) => c.symbol === code), type: 'stock' } ||
  ETFS.find((e) => e.symbol === code) && { ...ETFS.find((e) => e.symbol === code), type: 'etf' } ||
  FUNDS.find((f) => f.code === code) && { ...FUNDS.find((f) => f.code === code), type: 'fund' } ||
  (code === 'NPS' ? { ...NPS_SCHEME, type: 'nps' } : null);

function pick(r, arr) { return arr[Math.floor(r.next() * arr.length)]; }
function round2(v) { return Math.round(v * 100) / 100; }
