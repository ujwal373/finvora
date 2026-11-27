import { describe, it, expect } from 'vitest';
import { Finance } from '../src/sim/Finance.js';
import { GYM_PLANS, HOSPITAL, MEDICINES, DIPLOMAS, NO_COST_EMI } from '../src/sim/Life.js';
import { signalAt, isSignalised, CYCLE, SIGNAL } from '../src/world/Signals.js';
import { BUILDINGS, DISTRICTS, METRO_STATIONS, metroFare, buildingById } from '../src/data/buildings.js';
import { INTERIORS } from '../src/data/interiors.js';
import { CITY } from '../src/config.js';

describe('round 10 city layout', () => {
  it('is a 9 × 9 grid with the new landmarks on their own blocks', () => {
    expect(CITY.blocks.length).toBe(9);
    for (const id of ['mall', 'cinema', 'restaurant', 'hospital', 'school', 'gym']) expect(buildingById[id]).toBeTruthy();
    for (const b of BUILDINGS) { expect(Math.abs(b.x) + b.w / 2).toBeLessThan(CITY.bound); expect(Math.abs(b.z) + b.d / 2).toBeLessThan(CITY.bound); }
    // no two buildings overlap, and no district block sits under a building
    for (const a of BUILDINGS) for (const b of BUILDINGS) if (a !== b) expect(Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2).toBe(false);
    for (const list of [DISTRICTS.residential, DISTRICTS.business, DISTRICTS.parks]) for (const [x, z] of list) expect(BUILDINGS.some((b) => Math.abs(b.x - x) < 25 && Math.abs(b.z - z) < 25)).toBe(false);
    expect(DISTRICTS.centralPark).toEqual([[0, 50]]);
  });
  it('mall and cinema have walk-in interiors with working counters', () => {
    for (const k of ['mall', 'cinema']) { expect(INTERIORS[k].counters.length).toBeGreaterThan(1); expect(buildingById[INTERIORS[k].building].interior).toBe(k); }
  });
  it('metro fares rise with distance', () => {
    expect(METRO_STATIONS.length).toBe(4);
    expect(metroFare(1)).toBeLessThan(metroFare(3));
  });
});

describe('traffic signals', () => {
  it('never shows green both ways, and each way gets green every cycle', () => {
    for (let t = 0; t < CYCLE * 2; t += 0.25) {
      const x = signalAt(t, 25, -75, 'x'), z = signalAt(t, 25, -75, 'z');
      expect(x === 'green' && z === 'green').toBe(false);
      expect(x !== 'red' && z !== 'red').toBe(false);
    }
    const greens = Array.from({ length: Math.round(CYCLE * 4) }, (_, i) => signalAt(i / 4, -25, 25, 'z')).filter((s) => s === 'green').length;
    expect(greens / 4).toBeCloseTo(SIGNAL.green, 0);
  });
  it('the outer ring road has no signals', () => { expect(isSignalised(25, 25)).toBe(true); expect(isSignalised(225, 25)).toBe(false); });
});

describe('city life services', () => {
  it('gym: cost per visit falls the more you go', () => {
    const f = new Finance(); const c0 = f.cash;
    f.gymJoin('annual'); expect(f.cash).toBe(c0 - GYM_PLANS.annual.price);
    expect(f.gymVisit()).toBe(GYM_PLANS.annual.price);
    expect(() => f.gymVisit()).toThrow(/tomorrow/);
    f.advance(1); expect(f.gymVisit()).toBe(GYM_PLANS.annual.price / 2);
    expect(() => f.gymJoin('monthly')).toThrow(/runs until/);
  });
  it('hospital: no insurance means you pay; a health policy pays day care after the waiting period', () => {
    const f = new Finance();
    expect(f.hospitalVisit('daycare')).toMatchObject({ covered: 0, paid: HOSPITAL.daycare.price });
    f.buyPolicy('health', 500000);
    expect(f.hospitalVisit('daycare').why).toMatch(/waiting/);
    f.advance(31);
    expect(f.hospitalVisit('daycare')).toMatchObject({ covered: HOSPITAL.daycare.price, paid: 0 });
    expect(f.hospitalVisit('checkup').covered).toBe(HOSPITAL.checkup.price);
    expect(f.hospitalVisit('checkup').covered).toBe(0); // one free check-up a year
    expect(f.hospitalVisit('opd').covered).toBe(0);
  });
  it('pharmacy: generics save money', () => {
    const f = new Finance(), m = MEDICINES[1];
    expect(f.buyMedicine(m.id, true)).toEqual({ price: m.generic, saved: m.branded - m.generic });
  });
  it('school: pay upfront or with an education loan', () => {
    const f = new Finance(), d = DIPLOMAS[0], c0 = f.cash;
    f.enrolDiploma(d.id, 'loan'); expect(f.cash).toBe(c0); expect(f.loans.at(-1).kind).toBe('education');
    expect(() => f.enrolDiploma(d.id, 'full')).toThrow(/already/);
    f.enrolDiploma(DIPLOMAS[2].id, 'full'); expect(f.cash).toBe(c0 - DIPLOMAS[2].fee);
  });
  it('electronics: "no-cost" EMI costs more than paying in full', () => {
    const f = new Finance(), q = f.gadgetQuote('phone');
    expect(q.full).toBeCloseTo(q.g.price * (1 - NO_COST_EMI.cashDiscount), 2);
    expect(q.emiTotal).toBeGreaterThan(q.full);
    expect(() => f.buyGadget('phone', 'emi')).toThrow(/credit card/);
    const c0 = f.cash; f.buyGadget('phone', 'full'); expect(f.cash).toBeCloseTo(c0 - q.full, 2);
  });
});
