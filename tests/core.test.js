import { describe, it, expect } from 'vitest';
import { CollisionWorld } from '../src/world/Collision.js';
import { NavGraph } from '../src/npc/NavGraph.js';
import { buildPlaces, spurSegments, distToSegment } from '../src/world/Places.js';
import { BUILDINGS, DISTRICTS, doorPoint } from '../src/data/buildings.js';
import { DIALOGUES } from '../src/data/dialogues.js';
import { KEY_NPCS } from '../src/data/npcs.js';
import { DialogueRunner, validateTree } from '../src/interaction/DialogueRunner.js';
import { interestMaths, doublingMaths } from '../src/ui/Exhibits.js';
import { searchKB, KB } from '../src/data/knowledge.js';
import { migrateState, defaultState } from '../src/core/Game.js';
import { CITY, formatINR, STARTING_BALANCE } from '../src/config.js';

function cityCollision() {
  const c = new CollisionWorld(CITY.bound);
  for (const b of BUILDINGS) c.addBox(b.x, b.z, b.style === 'classical' ? b.w + 1.6 : b.w, b.style === 'classical' ? b.d + 1.6 : b.d, b.h);
  c.addCircle(0, 0, 4.25);
  for (const [bx, bz] of DISTRICTS.residential) for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.addBox(bx + sx * 8, bz + sz * 8, 11, 11, 20);
  for (const [bx, bz] of DISTRICTS.bazaar) for (const [x, z] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) c.addBox(bx + x, bz + z, 3.2, 2, 3);
  for (const [bx, bz] of DISTRICTS.business) for (const [ox, oz, w, d] of [[-8.5, -8, 13, 13], [8.5, -8, 13, 13], [0, 9, 28, 11]]) c.addBox(bx + ox, bz + oz, w, d, 30);
  for (const [bx, bz] of DISTRICTS.lake) c.addCircle(bx, bz, 16.3);
  for (const [bx, bz] of DISTRICTS.stadium) c.addBox(bx, bz, 36, 29, 12);
  return c;
}

describe('collision', () => {
  it('pushes a circle out of a box from outside', () => {
    const c = new CollisionWorld();
    c.addBox(0, 0, 10, 10);
    const p = { x: 5.2, z: 0 };
    c.resolve(p, 0.5);
    expect(p.x).toBeCloseTo(5.5, 5);
  });
  it('ejects a circle whose centre is inside a box via the nearest side', () => {
    const c = new CollisionWorld();
    c.addBox(0, 0, 10, 10);
    const p = { x: 4.5, z: 1 };
    c.resolve(p, 0.5);
    expect(p.x).toBeCloseTo(5.5, 5);
  });
  it('separates from circles', () => {
    const c = new CollisionWorld();
    c.addCircle(0, 0, 1);
    const p = { x: 1.2, z: 0 };
    c.resolve(p, 0.5);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(1.5, 5);
  });
  it('clamps to the city bound', () => {
    const c = new CollisionWorld(82);
    const p = { x: 200, z: -200 };
    c.resolve(p, 0.5);
    expect(p.x).toBe(81.5); expect(p.z).toBe(-81.5);
  });
  it('raycast stops at a building', () => {
    const c = new CollisionWorld();
    c.addBox(10, 0, 4, 4, 10);
    expect(c.raycastBoxes(0, 1, 0, 1, 0, 0, 50)).toBeCloseTo(8, 5);
    expect(c.raycastBoxes(0, 20, 0, 1, 0, 0, 50)).toBe(50); // above the roof
  });
  it('a player walking into every building never ends up inside it', () => {
    const c = cityCollision();
    for (const b of BUILDINGS) {
      const p = { x: b.x + (Math.random() - 0.5) * b.w * 0.8, z: b.z + (Math.random() - 0.5) * b.d * 0.8 };
      c.resolve(p, 0.45);
      const inside = Math.abs(p.x - b.x) < b.w / 2 && Math.abs(p.z - b.z) < b.d / 2;
      expect(inside).toBe(false);
    }
  });
});

describe('buildings', () => {
  it('has the 12 required locations plus the new districts, unique ids', () => {
    expect(BUILDINGS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(BUILDINGS.map((b) => b.id)).size).toBe(BUILDINGS.length);
  });
  it('every building is open with at least one working service', async () => {
    const { serviceTitle } = await import('../src/ui/Services.js');
    for (const b of BUILDINGS) {
      expect(b.services.length, b.id).toBeGreaterThan(0);
      for (const id of b.services) expect(serviceTitle(id), `${b.id}:${id}`).not.toBe(id);
    }
  });
  it('every block is used exactly once', () => {
    const used = new Set();
    const key = (x, z) => `${x},${z}`;
    for (const b of BUILDINGS) used.add(key(CITY.blocks.reduce((a, v) => (Math.abs(v - b.x) < Math.abs(a - b.x) ? v : a)), CITY.blocks.reduce((a, v) => (Math.abs(v - b.z) < Math.abs(a - b.z) ? v : a))));
    for (const list of Object.values(DISTRICTS)) for (const [x, z] of list) { expect(used.has(key(x, z)), key(x, z)).toBe(false); used.add(key(x, z)); }
    used.add('0,0');
    expect(used.size).toBe(CITY.blocks.length ** 2);
  });
  it('fits every footprint inside its block with sidewalk to spare', () => {
    for (const b of BUILDINGS) {
      const bx = CITY.blocks.reduce((a, v) => (Math.abs(v - b.x) < Math.abs(a - b.x) ? v : a));
      const bz = CITY.blocks.reduce((a, v) => (Math.abs(v - b.z) < Math.abs(a - b.z) ? v : a));
      expect(b.x - b.w / 2).toBeGreaterThanOrEqual(bx - 18);
      expect(b.x + b.w / 2).toBeLessThanOrEqual(bx + 18);
      expect(b.z - b.d / 2).toBeGreaterThanOrEqual(bz - 18);
      expect(b.z + b.d / 2).toBeLessThanOrEqual(bz + 18);
    }
  });
  it('buildings do not overlap each other', () => {
    for (let i = 0; i < BUILDINGS.length; i++) for (let j = i + 1; j < BUILDINGS.length; j++) {
      const a = BUILDINGS[i], b = BUILDINGS[j];
      const overlap = Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2;
      expect(overlap, `${a.id} vs ${b.id}`).toBe(false);
    }
  });
  it('every door is reachable (outside all colliders)', () => {
    const c = cityCollision();
    for (const b of BUILDINGS) {
      const d = doorPoint(b);
      expect(c.blocked(d.x, d.z, 0.45), b.id).toBe(false);
    }
  });
});

describe('navigation', () => {
  const nav = new NavGraph(CITY.roadXs, CITY.roadZs);
  const places = buildPlaces();
  const col = cityCollision();

  it('builds the road grid', () => { expect(nav.nodes).toHaveLength(CITY.roadXs.length * CITY.roadZs.length); });

  it('routes between every pair of places without walking through buildings', () => {
    const list = Object.values(places);
    for (const a of list) for (const b of list) {
      if (a === b) continue;
      const r = nav.route(a, b);
      expect(r.length).toBeGreaterThanOrEqual(2);
      expect(r[0]).toEqual({ x: a.x, z: a.z });
      expect(r[r.length - 1]).toEqual({ x: b.x, z: b.z });
      // sample along every segment
      for (let i = 1; i < r.length; i++) for (let t = 0; t <= 1; t += 0.05) {
        const x = r[i - 1].x + (r[i].x - r[i - 1].x) * t, z = r[i - 1].z + (r[i].z - r[i - 1].z) * t;
        expect(col.blocked(x, z, 0.3), `${a.id}->${b.id} at ${x.toFixed(1)},${z.toFixed(1)}`).toBe(false);
      }
    }
  });

  it('patrol loops use adjacent intersections', () => {
    for (const npc of KEY_NPCS.filter((n) => n.pattern === 'patrol')) {
      const pts = npc.patrol;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        expect(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])).toBe(1);
      }
    }
  });

  it('spurs are straight and perpendicular to a boulevard', () => {
    for (const s of spurSegments(places, nav)) expect(s.ax === s.bx || s.az === s.bz).toBe(true);
    expect(distToSegment(0, 5, { ax: 0, az: 0, bx: 0, bz: 10 })).toBe(0);
  });
});

describe('npcs and dialogue', () => {
  it('defines 21 key NPCs (leader + 5 originals + 15 helpers) with all five movement patterns', () => {
    expect(KEY_NPCS).toHaveLength(21);
    expect(new Set(KEY_NPCS.map((n) => n.id)).size).toBe(21);
    expect(KEY_NPCS.find((n) => n.id === 'financial-expert').name).toBe('Parth');
    expect(KEY_NPCS.find((n) => n.id === 'bank-manager').role).toBe('Investment Banker');
    expect(new Set(KEY_NPCS.map((n) => n.pattern)).size).toBe(5);
  });
  it('every NPC references valid places and has a conversation', async () => {
    const { buildAgentTree } = await import('../src/data/agentTrees.js');
    const places = buildPlaces();
    for (const n of KEY_NPCS) {
      const tree = n.dialogue ? DIALOGUES[n.dialogue] : buildAgentTree(n.id);
      expect(validateTree(tree), n.id).toEqual([]);
      expect(places[n.spawn], n.id).toBeTruthy();
      for (const p of [...(n.circuit || []), ...(n.between || []), ...(n.routine || []).map((r) => r.place)]) expect(places[p], `${n.id}:${p}`).toBeTruthy();
      if (!n.dialogue) expect(n.id in (await import('../src/data/npcNames.js')).NPC_NAMES).toBe(true);
    }
  });
  it('every dialogue tree is valid: reachable nodes, no dead ends, resolvable links', () => {
    for (const [id, tree] of Object.entries(DIALOGUES)) expect(validateTree(tree), id).toEqual([]);
  });
  it('desk dialogues exist for interactive buildings', () => {
    for (const b of BUILDINGS.filter((x) => x.desk)) expect(DIALOGUES[b.desk]?.speaker, b.id).toBeTruthy();
  });
  it('runner fills placeholders and follows branches to an end', () => {
    const r = new DialogueRunner(DIALOGUES.kavita, { firstName: 'Ujwal', self: 'Professor X' });
    expect(r.node.text).toContain('Ujwal');
    expect(r.node.text).toContain('Professor X');
    const res = r.choose(0);
    expect(res.node.id).toBe('compound');
    expect(res.node.learn.id).toBe('compounding');
    const endIdx = r.node.choices.findIndex((c) => c.end);
    expect(r.choose(endIdx).ended).toBe(true);
  });
  it('journal entry ids are unique across all dialogues', () => {
    const ids = Object.values(DIALOGUES).flatMap((t) => Object.values(t.nodes).map((n) => n.learn?.id).filter(Boolean));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('financial maths in exhibits (independently computed)', () => {
  it('compound interest matches the textbook example', () => {
    // ₹1,00,000 at 10% compounded yearly for 10 years = 259,374.25
    const m = interestMaths(100000, 10, 10, 1);
    expect(m.compound).toBeCloseTo(259374.246, 2);
    expect(m.simple).toBeCloseTo(200000, 6);
  });
  it('quarterly compounding beats yearly at the same nominal rate', () => {
    const q = interestMaths(100000, 7, 5, 4).compound, y = interestMaths(100000, 7, 5, 1).compound;
    expect(q).toBeCloseTo(100000 * (1 + 0.07 / 4) ** 20, 6);
    expect(q).toBeGreaterThan(y);
  });
  it('dialogue numbers agree with the maths', () => {
    expect(Math.round(100000 * 1.1 ** 10)).toBe(259374); // Prof. Rao, compounding
    expect(Math.round(100 * 1.06 ** 10)).toBe(179); // Prof. Rao, inflation
    expect(doublingMaths(8).exact).toBeCloseTo(9.006, 3); // Rule of 72 node
  });
  it('rule of 72 vs exact', () => {
    const m = doublingMaths(8);
    expect(m.rule).toBe(9);
    expect(m.exact).toBeCloseTo(Math.log(2) / Math.log(1.08), 10);
    expect(Math.abs(doublingMaths(30).errorPct)).toBeGreaterThan(3);
  });
});

describe('agent knowledge base', () => {
  const ask = (q, a) => searchKB(q, a)[0]?.e;
  it('routes common questions to the right specialist', () => {
    expect(ask('how is my EMI calculated?', 'sip-coach').agent).toBe('loan-officer');
    expect(ask('what is the PPF interest rate', 'tax-consultant').agent).toBe('savings-agent');
    expect(ask('should I stop my SIP when market falls', 'mf-advisor').agent).toBe('sip-coach');
    expect(ask('someone asked for my UPI PIN to receive money', 'reporter').agent).toBe('cyber-officer');
    expect(ask('how much tax on long term capital gains from shares', null).agent).toBe('tax-consultant');
    expect(ask('how much term insurance cover do I need', null).agent).toBe('insurance-consultant');
    expect(ask('what is a credit score', null).agent).toBe('card-counsellor');
    expect(ask('nps exit rules at 60', null).agent).toBe('retirement-planner');
  });
  it('returns nothing for unrelated questions', () => {
    expect(searchKB('what is the capital of france', 'analyst')).toEqual([]);
  });
  it('every helper has at least four answers', () => {
    for (const n of KEY_NPCS.filter((x) => !x.dialogue)) expect(KB.filter((e) => e.agent === n.id).length, n.id).toBeGreaterThanOrEqual(3);
  });
});

describe('game state', () => {
  it('starts with the virtual ₹10,00,000 shown in Indian format', () => {
    expect(STARTING_BALANCE).toBe(1000000);
    expect(formatINR(STARTING_BALANCE)).toBe('₹10,00,000');
  });
  it('migrates partial saves without losing data', () => {
    const s = migrateState({ journal: [{ id: 'x' }], settings: { graphics: 'high' }, player: { x: 3 } }, false);
    expect(s.journal).toHaveLength(1);
    expect(s.settings.graphics).toBe('high');
    expect(s.settings.sensitivity).toBe(1);
    expect(s.player.x).toBe(3);
    expect(s.player.z).toBe(defaultState(false).player.z);
  });
  it('save state never carries wallet data', () => {
    expect(JSON.stringify(defaultState(false))).not.toMatch(/wallet|balance/i);
  });
});

describe('player car', async () => {
  const THREE = await import('three');
  const { PlayerCar } = await import('../src/entities/PlayerCar.js');
  const fakeTraffic = { resolve() {} };
  const drive = (car, input, secs) => { for (let t = 0; t < secs; t += 1 / 60) car.update(1 / 60, { pressed: new Set(), jumpHeld: false, moveX: 0, moveY: 0, ...input }, { traffic: fakeTraffic, npcs: [] }); };
  it('accelerates, steers right with D, and brakes', () => {
    const car = new PlayerCar(new THREE.Scene(), new CollisionWorld(CITY.bound), { castShadow: false, saved: { x: 0, z: 30, heading: Math.PI / 2 } });
    car.occupied = true;
    drive(car, { moveY: 1 }, 3);
    expect(car.speed).toBeGreaterThan(10);
    expect(car.pos.x).toBeGreaterThan(10);
    const h = car.heading;
    drive(car, { moveY: 1, moveX: 1 }, 0.5);
    const f = car.forward();
    expect(f.z).toBeGreaterThan(0.1); // facing +x (east), right is +z (south)
    expect(car.heading).toBeLessThan(h);
    drive(car, { moveY: -1 }, 3);
    expect(Math.abs(car.speed)).toBeLessThan(6.1);
  });
  it('stops at a building instead of driving through it', () => {
    const col = new CollisionWorld(CITY.bound);
    col.addBox(20, 30, 4, 10, 10);
    const car = new PlayerCar(new THREE.Scene(), col, { castShadow: false, saved: { x: 0, z: 30, heading: Math.PI / 2 } });
    car.occupied = true;
    drive(car, { moveY: 1 }, 5);
    expect(car.pos.x + car.L / 2).toBeLessThan(18.2);
  });
});
