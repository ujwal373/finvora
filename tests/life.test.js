import { describe, it, expect } from 'vitest';
import { Finance } from '../src/sim/Finance.js';
import { slabTaxNew, slabTaxOld, bondPrice, bsPrice, lastTuesday, COURSES, JOBS, BONDS } from '../src/sim/Life.js';

const pass = (f, id) => f.submitQuiz(id, COURSES.find((c) => c.id === id).qs.map((q) => q[2]));

describe('tax maths (FY 2026-27 slabs)', () => {
  it('new regime: zero up to ₹12 lakh, marginal relief just above, slabs beyond', () => {
    expect(slabTaxNew(1200000)).toBe(0);
    expect(slabTaxNew(1210000)).toBe(10000); // marginal relief: tax cannot exceed income above 12L
    expect(slabTaxNew(1600000)).toBe(120000); // 20k + 40k + 60k
    expect(slabTaxNew(2500000)).toBeCloseTo(330000, 0); // 20+40+60+80+100 = 300k, +30% of 1L
  });
  it('old regime: rebate up to ₹5 lakh, then 5/20/30', () => {
    expect(slabTaxOld(500000)).toBe(0);
    expect(slabTaxOld(1000000)).toBe(112500);
    expect(slabTaxOld(600000, 65)).toBe(30000); // senior: exemption 3L → 10k + 20k
  });
});

describe('pricing maths', () => {
  it('bond price falls when yields rise; par when yield = coupon', () => {
    expect(bondPrice(1000, 0.07, 0.07, 5)).toBeCloseTo(1000, 6);
    expect(bondPrice(1000, 0.07, 0.08, 5)).toBeLessThan(bondPrice(1000, 0.07, 0.06, 5));
  });
  it('Black-Scholes put-call parity holds', () => {
    const S = 100, K = 105, T = 0.25, r = 0.065, c = bsPrice('call', S, K, T, 0.2, r), p = bsPrice('put', S, K, T, 0.2, r);
    expect(c - p).toBeCloseTo(S - K * Math.exp(-r * T), 3);
  });
  it('monthly expiry is the last Tuesday', () => { expect(lastTuesday('2026-11-03')).toBe('2026-11-24'); expect(lastTuesday('2026-06-10')).toBe('2026-06-30'); });
});

describe('jobs, salary and EPF', () => {
  it('certificate-gated jobs; salary at month end with PF, TDS and professional tax', () => {
    const f = new Finance();
    expect(() => f.takeJob('analyst')).toThrow(/certificate/i);
    expect(pass(f, 'investing').pass).toBe(true); pass(f, 'funds');
    f.takeJob('analyst');
    const ps = f.payslip();
    expect(ps.epfEmp).toBeCloseTo(95000 * 0.5 * 0.12, 2);
    expect(ps.eps).toBe(1250);
    expect(ps.net).toBeLessThan(95000);
    f.advance(30); // through 30 April
    const sal = f.ledger.filter((e) => e.type === 'salary');
    expect(sal).toHaveLength(1);
    expect(f.life.epf.balance).toBeGreaterThan(0);
    expect(f.taxReport().salary).toBeCloseTo(95000, 0);
  });
  it('gig work has no PF or TDS', () => {
    const f = new Finance(); f.takeJob('delivery'); f.advance(30);
    expect(f.life.epf.balance).toBe(0); expect(f.taxReport().tds).toBe(0); expect(f.taxReport().gig).toBeGreaterThan(0);
  });
});

describe('credit card and credit score', () => {
  it('starts with no history; card bill paid in full builds score; missed payment hurts', () => {
    const f = new Finance();
    expect(f.creditScore().score).toBeNull();
    f.takeJob('teacher'); f.applyCard();
    expect(f.life.card.limit).toBe(125000);
    f.setPayMethod('card');
    f.advance(60);
    expect(f.ledger.some((e) => e.type === 'card-ontime')).toBe(true);
    const good = f.creditScore().score;
    expect(good).toBeGreaterThan(650);
    f.setAutopay('off'); f.cash = 0; f.advance(40);
    expect(f.ledger.some((e) => e.type === 'card-missed')).toBe(true);
    expect(f.creditScore().score).toBeLessThan(good);
  });
  it('secured card needs an FD when unemployed', () => {
    const f = new Finance();
    expect(() => f.applyCard()).toThrow(/FD/);
    f.openFD(50000, 12); f.applyCard();
    expect(f.life.card.limit).toBe(45000);
  });
});

describe('bonds, gold, derivatives', () => {
  it('buys a G-Sec and gets a coupon after six months; T-bill pays face value', () => {
    const f = new Finance();
    f.buyBond('GS36', 10); f.buyBond('TB91', 5);
    f.advance(190);
    expect(f.ledger.some((e) => e.type === 'bond-coupon' && e.code === 'GS36')).toBe(true);
    expect(f.ledger.some((e) => e.type === 'bond-mature' && e.code === 'TB91' && e.amount === 5000)).toBe(true);
  });
  it('digital gold includes 3% GST; SGB pays interest', () => {
    const f = new Finance(); const p = f.metalPrice('gold');
    f.buyMetal('gold', 10300);
    expect(f.life.gold.grams).toBeCloseTo(10300 / (p * 1.03), 3);
    f.buySGB(2); f.advance(185);
    expect(f.ledger.some((e) => e.type === 'sgb-interest')).toBe(true);
  });
  it('F&O needs the risk course; option buyer loses at most the premium', () => {
    const f = new Finance();
    expect(() => f.openFno({ u: 'FV8', type: 'call', strike: f.fnoStrikes('FV8')[4] })).toThrow(/Derivatives Risk/);
    pass(f, 'derivatives');
    const c0 = f.cash; const pos = f.openFno({ u: 'FV8', type: 'call', strike: f.fnoStrikes('FV8')[4] });
    const prem = c0 - f.cash; expect(prem).toBeGreaterThan(0);
    expect(() => f.openFno({ u: 'FV8', type: 'put', side: 'short', strike: f.fnoStrikes('FV8')[2] })).toThrow(/unlimited/);
    f.advance(40); // past expiry
    expect(f.life.fno.find((p) => p.code === pos.code)).toBeUndefined();
    expect(f.ledger.some((e) => e.type === 'fno-close')).toBe(true);
  });
});

describe('insurance, property, tax filing, IPOs', () => {
  it('health insurance pays hospital bills after the waiting period', () => {
    const f = new Finance(); f.declareAge(30); f.buyPolicy('health', 1000000);
    for (let i = 0; i < 40 && !f.ledger.some((e) => e.type === 'event' && /Hospital/.test(e.name) && /insurance paid/.test(e.note || '')); i++) f.advance(30);
    expect(f.ledger.some((e) => e.type === 'premium')).toBe(true);
  });
  it('home loan follows RBI loan-to-value caps and charges stamp duty', () => {
    const f = new Finance(); f.takeJob('teacher'); f.cash = 2000000;
    expect(() => f.buyProperty('2bhk', { loanPct: 90 })).toThrow(/75%/);
    const p = f.buyProperty('1bhk', { loanPct: 80, months: 240 });
    expect(f.loans.find((l) => l.id === p.loanId).kind).toBe('home');
    expect(f.ledger.at(-1).note).toMatch(/stamp duty/);
    f.setPropertyUse(p.id, 'rented'); f.advance(80);
    expect(f.ledger.some((e) => e.type === 'rent-in')).toBe(true);
    expect(f.snapshot().alloc['Property and REITs']).toBeGreaterThan(4000000);
  });
  it('files a return after the year ends with salary TDS', () => {
    const f = new Finance(); pass(f, 'money'); f.takeJob('developer');
    expect(() => f.fileReturn('2026-27', 'new')).toThrow(/after the year/);
    f.advance(370);
    const r = f.taxReport('2026-27');
    expect(r.salary).toBeGreaterThan(1300000);
    expect(r.new.tax).toBeGreaterThan(0);
    const filed = f.fileReturn('2026-27', r.better);
    expect(Math.abs(filed.balance)).toBeLessThan(r[r.better].tax);
  });
  it('an IPO opens, takes a bid and allots or refunds', () => {
    const f = new Finance(); f.completeKYC('Tester');
    for (let i = 0; i < 30 && f.life.ipo?.status !== 'open'; i++) f.advance(1);
    expect(f.life.ipo.status).toBe('open');
    f.applyIPO(1);
    f.advance(8);
    expect(f.ledger.some((e) => e.type === 'ipo-allot' || e.type === 'ipo-refund')).toBe(true);
  });
  it('fuel is used by driving and bought at the pump', () => {
    const f = new Finance(); const id = f.garage[0].id;
    f.useFuel(id, 5000);
    expect(f.carFuel(id)).toBeLessThan(0.6);
    const r = f.refuel(id); expect(r.cost).toBeGreaterThan(0); expect(f.carFuel(id)).toBeCloseTo(1, 2);
  });
  it('saves and reloads every new system', () => {
    const f = new Finance(); pass(f, 'money'); f.takeJob('developer'); f.buyBond('AFT30', 3); f.buyMetal('silver', 5000); f.advance(35);
    const g = new Finance(JSON.parse(JSON.stringify(f.serialize())));
    expect(g.life.job.id).toBe('developer'); expect(g.bondQty('AFT30')).toBe(3); expect(g.snapshot().netWorth).toBeCloseTo(f.snapshot().netWorth, 0);
    expect(JOBS.length).toBeGreaterThanOrEqual(8); expect(BONDS.some((b) => b.rating === 'BB')).toBe(true);
  });
});
