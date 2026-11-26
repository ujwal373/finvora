import { describe, it, expect } from 'vitest';
import { Finance, FinError, xirr, addMonths, fyOf, emi, fdValue, RATES } from '../src/sim/Finance.js';
import { Market, COMPANIES, FUNDS } from '../src/sim/Market.js';
import { CALCULATORS, defaults, sipFV, emiOf, rdMaturity, bondPrice, calcById } from '../src/sim/calculators.js';

describe('dates', () => {
  it('adds months clamping to month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-04-15', 12)).toBe('2027-04-15');
  });
  it('knows the Indian financial year', () => {
    expect(fyOf('2026-04-01')).toBe('2026-27');
    expect(fyOf('2027-03-31')).toBe('2026-27');
  });
});

describe('maths', () => {
  it('xirr of a single 10% year', () => {
    expect(xirr([{ date: '2026-01-01', amount: -100 }, { date: '2027-01-01', amount: 110 }])).toBeCloseTo(0.1, 4);
  });
  it('EMI matches the standard formula (₹1L, 12%, 12m = 8884.88)', () => {
    expect(emi(100000, 0.12, 12)).toBeCloseTo(8884.88, 2);
    expect(emiOf(100000, 12, 12)).toBeCloseTo(8884.88, 2);
  });
  it('SIP FV: ₹1,000/month, 12%, 1 year (annuity due) = 12,809.33', () => {
    expect(sipFV(1000, 12, 1)).toBeCloseTo(12809.33, 2);
  });
  it('FD quarterly compounding', () => {
    expect(fdValue(100000, 0.07, 1)).toBeCloseTo(100000 * 1.0175 ** 4, 6);
  });
  it('bond at par when coupon equals yield; falls when yield rises', () => {
    expect(bondPrice(1000, 7, 10, 7)).toBeCloseTo(1000, 6);
    expect(bondPrice(1000, 7, 10, 8)).toBeLessThan(1000);
  });
  it('RD maturity is above total deposits', () => {
    expect(rdMaturity(1000, 7, 12)).toBeGreaterThan(12000);
  });
  it('every calculator computes finite outputs at its defaults', () => {
    for (const c of CALCULATORS) {
      const r = c.compute(defaults(c));
      expect(r.outputs.length, c.id).toBeGreaterThan(0);
      for (const [, v] of r.outputs) if (typeof v === 'number') expect(Number.isFinite(v), `${c.id}`).toBe(true);
      expect(r.formula, c.id).toBeTruthy();
    }
    expect(calcById.option.compute({ type: 1, side: 1, strike: 1000, premium: 40, lot: 50 }).outputs[0][1]).toBe(1040);
  });
});

describe('market', () => {
  it('is deterministic and round-trips through serialize', () => {
    const a = new Market();
    for (let i = 0; i < 50; i++) a.step('2026-04-01');
    const b = new Market(a.serialize());
    for (let i = 0; i < 50; i++) { a.step('x'); b.step('x'); }
    expect(b.stocks.map((s) => s.price)).toEqual(a.stocks.map((s) => s.price));
    expect(b.funds.map((s) => s.nav)).toEqual(a.funds.map((s) => s.nav));
  });
  it('liquid fund barely moves, small cap moves a lot', () => {
    const m = new Market();
    for (let i = 0; i < 252; i++) m.step('d');
    const vol = (h) => { const r = h.slice(1).map((v, i) => Math.log(v / h[i])); const mu = r.reduce((a, b) => a + b, 0) / r.length; return Math.sqrt(r.reduce((a, b) => a + (b - mu) ** 2, 0) / r.length * 252); };
    expect(vol(m.history('FWLQ'))).toBeLessThan(0.02);
    expect(vol(m.history('FWSC'))).toBeGreaterThan(0.12);
  });
});

describe('finance engine', () => {
  it('starts with ₹10,00,000 and an opening ledger entry', () => {
    const f = new Finance();
    expect(f.cash).toBe(1000000);
    expect(f.ledger[0].type).toBe('opening');
  });
  it('buys and sells shares with FIFO P&L and cash checks', () => {
    const f = new Finance();
    const p = f.market.price('JPM');
    f.buyShares('JPM', 10);
    expect(f.cash).toBeCloseTo(1000000 - 10 * p, 2);
    expect(() => f.buyShares('JPM', 1e9)).toThrow(FinError);
    expect(() => f.sellShares('JPM', 11)).toThrow(FinError);
    f.sellShares('JPM', 10);
    expect(f.cash).toBeCloseTo(1000000, 2);
    expect(f.qty('JPM')).toBe(0);
  });
  it('ledger entries are frozen (cannot be edited)', () => {
    const f = new Finance();
    const e = f.buyShares('AFT', 1);
    expect(Object.isFrozen(e)).toBe(true);
    expect(() => { 'use strict'; e.amount = 5; }).toThrow();
  });
  it('runs SIPs monthly with step-up', () => {
    const f = new Finance();
    f.startSIP('FWIF', 5000, 10, 10);
    f.advance(365 * 2 + 10);
    const sip = f.sips[0];
    expect(sip.count).toBeGreaterThanOrEqual(24);
    expect(sip.amount).toBe(Math.round(Math.round(5000 * 1.1) * 1.1));
    expect(f.qty('FWIF')).toBeGreaterThan(0);
  });
  it('locks ELSS units for 3 years and charges exit load under 1 year', () => {
    const f = new Finance();
    f.buyFund('FWTS', 10000);
    expect(() => f.redeemFund('FWTS', f.qty('FWTS'))).toThrow(/locked/);
    f.buyFund('FWLC', 10000);
    const e = f.redeemFund('FWLC', f.qty('FWLC'));
    expect(e.note).toMatch(/Exit load/);
    f.advance(3 * 365 + 2);
    expect(() => f.redeemFund('FWTS', f.qty('FWTS'))).not.toThrow();
  });
  it('FD matures with quarterly compounding; early break pays less', () => {
    const f = new Finance();
    const fd = f.openFD(100000, 12);
    f.advance(366);
    expect(fd.status).toBe('matured');
    expect(f.ledger.at(-1).type === 'fd-mature' || f.ledger.some((e) => e.type === 'fd-mature')).toBe(true);
    const g = new Finance();
    const fd2 = g.openFD(100000, 24);
    g.advance(200);
    const before = g.cash;
    g.breakFD(fd2.id);
    expect(g.cash - before).toBeLessThan(fdValue(100000, fd2.rate, 200 / 365));
    expect(g.cash - before).toBeGreaterThan(100000);
  });
  it('loan EMIs fully repay the principal plus interest', () => {
    const f = new Finance();
    const l = f.takeLoan(120000, 12);
    f.advance(370);
    expect(l.status).toBe('closed');
    expect(l.interestPaid).toBeCloseTo(l.emi * 12 - 120000, -1);
  });
  it('PPF respects the ₹1.5L FY limit and credits interest on 31 March', () => {
    const f = new Finance();
    f.depositPPF(150000);
    expect(() => f.depositPPF(500)).toThrow(/1,50,000/);
    f.advance(365); // to 1 Apr 2027
    expect(f.ppf.balance).toBeCloseTo(150000 * (1 + RATES.ppf / 12 * 12), 0);
    f.depositPPF(100000); // new FY allows deposits again
  });
  it('SCSS needs age 60+ and pays quarterly interest', () => {
    const f = new Finance();
    expect(() => f.openSCSS(100000)).toThrow(/age/);
    f.declareAge(45);
    expect(() => f.openSCSS(100000)).toThrow(/60/);
    f.declareAge(62);
    f.openSCSS(100000);
    f.advance(95);
    expect(f.ledger.some((e) => e.type === 'scss-interest')).toBe(true);
  });
  it('SSY only for a girl under 10; NPS exit only at 60 with 80/20 rule', () => {
    const f = new Finance();
    expect(() => f.openSSY(11, 1000)).toThrow();
    f.openSSY(4, 50000);
    f.contributeNPS(900000);
    expect(() => f.exitNPS(80)).toThrow(/60/);
    f.declareAge(60);
    expect(() => f.exitNPS(100)).toThrow(/annuity/);
    f.exitNPS(80);
    expect(f.qty('NPS')).toBe(0);
  });
  it('snapshot net worth equals cash plus holdings minus loans and survives save/load', () => {
    const f = new Finance();
    f.buyShares('MJDR', 5); f.buyFund('FWFC', 25000); f.openFD(50000, 12); f.takeLoan(50000, 12);
    f.advance(60);
    const s = f.snapshot();
    const sum = Object.values(s.alloc).reduce((a, b) => a + b, 0);
    expect(s.netWorth).toBeCloseTo(sum - s.loans, 4);
    const g = new Finance(JSON.parse(JSON.stringify(f.serialize())));
    expect(g.snapshot().netWorth).toBeCloseTo(s.netWorth, 4);
    expect(g.ledger.length).toBe(f.ledger.length);
    expect(Object.isFrozen(g.ledger[0])).toBe(true);
  });
  it('fictional instruments only', () => {
    const real = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'NIFTYBEES', 'GOLDBEES'];
    expect([...COMPANIES.map((c) => c.symbol), ...FUNDS.map((f) => f.code)].some((s) => real.includes(s))).toBe(false);
  });
});

describe('showrooms', async () => {
  const { carValue, CARS } = await import('../src/data/shop.js');
  it('depreciates about 15% in year one then 10% a year', () => {
    expect(carValue(1000000, 0)).toBe(1000000);
    expect(carValue(1000000, 1)).toBeCloseTo(850000, 6);
    expect(carValue(1000000, 3)).toBeCloseTo(850000 * 0.81, 6);
  });
  it('buys a car in full with first-year insurance, counts it as a shrinking asset', () => {
    const f = new Finance();
    const car = f.buyCar('zippy', 0xc0392b);
    expect(f.cash).toBeCloseTo(1000000 - 620000 - 620000 * 0.03, 2);
    expect(f.garage).toHaveLength(2);
    const s0 = f.snapshot().alloc.Vehicles;
    f.advance(400);
    expect(f.snapshot().alloc.Vehicles).toBeLessThan(s0 * 0.86);
    expect(f.ledger.filter((e) => e.type === 'car-cost').length).toBeGreaterThanOrEqual(1); // insurance renewal (fuel is bought at the pump)
    expect(f.ledger.some((e) => e.type === 'car-cost' && /insurance/.test(e.name))).toBe(true);
    expect(car.id).toMatch(/^CAR/);
  });
  it('car loan: down payment now, EMIs later; too expensive without a loan', () => {
    const f = new Finance();
    expect(() => f.buyCar('gt', 0xc0392b)).toThrow(/car loan/);
    const car = f.buyCar('gt', 0xc0392b, { loan: { downPct: 15, months: 60 } });
    const loan = f.loans.find((l) => l.id === car.loanId);
    expect(loan.kind).toBe('car');
    expect(loan.principal).toBeCloseTo(4800000 * 0.85, 2);
    f.advance(40);
    expect(loan.paidCount + loan.missed).toBe(1);
  });
  it('clothing is spending, not an asset, and cannot be bought twice', () => {
    const f = new Finance();
    const nw = f.snapshot().netWorth;
    f.buyClothing('suit', 0x1b1d22);
    expect(f.snapshot().netWorth).toBeCloseTo(nw - 12000, 2);
    expect(() => f.buyClothing('suit', 0x1b1d22)).toThrow(/already own/);
    expect(CARS.find((c) => c.gift)).toBeTruthy();
  });
});
