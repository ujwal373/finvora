import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Minimal browser globals the SaveService touches
globalThis.window = globalThis.window || { addEventListener() {} };
let online = true;
Object.defineProperty(globalThis, 'navigator', { value: { get onLine() { return online; } }, configurable: true });

const { SaveService } = await import('../src/services/SaveService.js');
const { get, set, clear } = await import('idb-keyval');

/** Fake Supabase that mimics the save_game_state RPC's optimistic versioning. */
function fakeCloud(initial = { state: {}, version: 1 }) {
  const db = { ...initial };
  return {
    db,
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { ...db }, error: null }) }) }) }),
    rpc: vi.fn(async (fn, { p_state, p_base_version }) => {
      if (!online) throw new Error('Failed to fetch');
      if (p_base_version !== db.version) return { data: null, error: { message: 'version_conflict' } };
      db.state = p_state; db.version += 1;
      return { data: db.version, error: null };
    }),
  };
}
const profile = { mode: 'cloud', id: 'u1' };

describe('SaveService (cloud)', () => {
  beforeEach(async () => { await clear(); online = true; });

  it('reports Saved to Cloud only after the database confirms', async () => {
    const sb = fakeCloud(), statuses = [];
    const s = new SaveService({ supabase: sb, profile, onStatus: (x) => statuses.push(x) });
    await s.load();
    await s.schedule({ a: 1 }, { immediate: true });
    expect(sb.db.version).toBe(2);
    expect(statuses.slice(-2)).toEqual(['saving', 'saved']);
  });

  it('queues offline progress locally and uploads it on the next load', async () => {
    const sb = fakeCloud(), statuses = [];
    const s = new SaveService({ supabase: sb, profile, onStatus: (x) => statuses.push(x) });
    await s.load();
    online = false;
    await s.schedule({ step: 'offline' }, { immediate: true });
    expect(statuses.at(-1)).toBe('offline');
    expect((await get('finworld:pending:u1')).state.step).toBe('offline');
    online = true;
    const s2 = new SaveService({ supabase: sb, profile });
    const state = await s2.load();
    expect(state.step).toBe('offline');
    expect(sb.db.state.step).toBe('offline');
    expect(await get('finworld:pending:u1')).toBeUndefined();
  });

  it('never overwrites newer cloud data with older local data, and keeps a backup', async () => {
    const sb = fakeCloud({ state: { from: 'phone' }, version: 7 });
    await set('finworld:pending:u1', { state: { from: 'old-pc' }, baseVersion: 3 });
    const conflicts = [];
    const s = new SaveService({ supabase: sb, profile, onConflict: (c) => conflicts.push(c) });
    const state = await s.load();
    expect(state.from).toBe('phone');
    expect(sb.db.state.from).toBe('phone');
    expect((await get('finworld:backup:u1')).state.from).toBe('old-pc');
    expect(conflicts[0].reason).toBe('cloud-newer-on-load');
  });

  it('a second device saving first makes the stale session follow the cloud', async () => {
    const sb = fakeCloud();
    const pc = new SaveService({ supabase: sb, profile, onConflict: () => {} });
    await pc.load();
    sb.db.version = 5; sb.db.state = { from: 'phone' }; // phone saved meanwhile
    const conflicts = [];
    pc.onConflict = (c) => conflicts.push(c);
    await pc.schedule({ from: 'pc' }, { immediate: true });
    expect(sb.db.state.from).toBe('phone');
    expect(conflicts[0].cloudState.from).toBe('phone');
    expect(pc.version).toBe(5);
  });
});

describe('old saves after an update', () => {
  it('replaces retired stock codes and buys back their holdings', async () => {
    const { Finance } = await import('../src/sim/Finance.js');
    const f = new Finance();
    f.buyShares('AFT', 10);
    const saved = JSON.parse(JSON.stringify(f.serialize()));
    // Simulate a save from before the stocks were renamed: AFT was called OLD.
    saved.market.stocks[0].symbol = 'OLD';
    saved.holdings.OLD = saved.holdings.AFT; delete saved.holdings.AFT;
    const g = new Finance(saved);
    expect(g.market.stocks.map((s) => s.symbol)).toContain('AFT');
    expect(g.market.price('AFT')).toBeGreaterThan(0);
    expect(g.holdings.OLD).toBeUndefined();
    expect(g.ledger.at(-1).type).toBe('sell');
    expect(g.cash).toBeCloseTo(f.cash + 10 * f.market.price('AFT'), 0);
    expect(() => g.buyShares('AFT', 1)).not.toThrow();
  });
});
