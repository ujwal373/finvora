import { BUILDINGS, DISTRICTS, MOVED_TO_TOWER, doorPoint } from '../data/buildings.js';

// Named spots NPCs walk between. `side` says which way to walk to reach a boulevard.
export function buildPlaces() {
  const places = {};
  const add = (id, x, z, side, label, loiter = 1.2, kind = 'spot') => { places[id] = { id, x, z, side, label, loiter, kind }; };
  for (const b of BUILDINGS) {
    // Staff wait a few steps out from the door so they never block the entrance.
    const p = doorPoint(b, 5.5);
    add(b.id, p.x, p.z, b.door, b.name, 2.2, 'work');
  }
  // AccoFinTra Plaza in front of the tower. Parth and Aanya greet visitors either side of the walkway.
  add('plaza-a', -4.6, 10.5, '+z', 'AccoFinTra Plaza', 0.25, 'post');
  add('plaza-b', 4.6, 10.5, '+z', 'AccoFinTra Plaza', 0.25, 'post');
  add('park-n', -15, 13, '+z', 'AccoFinTra Plaza', 1.2, 'leisure');
  add('park-s', 0, 60, '+z', 'Central Park', 1.4, 'leisure');
  add('park-e', 15, 13, '+z', 'AccoFinTra Plaza', 1.2, 'leisure');
  add('park-w', -15, 6, '-x', 'AccoFinTra Plaza', 1.2, 'leisure');
  // Old service building ids now point to spots around the city (their services moved into the tower).
  const spots = [[-15, 13, '+z'], [15, 13, '+z'], [0, 60, '+z'], [-16, 33, '-z'], [16, 33, '-z']];
  MOVED_TO_TOWER.forEach((id, i) => { const [x, z, side] = spots[i % spots.length]; add(id, x + (i % 3) - 1, z, side, 'AccoFinTra Plaza', 1.6, 'leisure'); });
  DISTRICTS.residential.forEach(([bx, bz], i) => add(`home-${i}`, bx, bz + 16.5, '+z', 'Homes', 1.4, 'home'));
  DISTRICTS.parks.forEach(([bx, bz], i) => add(`garden-${i}`, bx, bz + 8, '+z', 'Garden', 1.6, 'leisure'));
  DISTRICTS.business.forEach(([bx, bz], i) => add(`office-${i}`, bx, bz - 17.5, '-z', 'Business district', 1.6, 'work'));
  for (const [bx, bz] of DISTRICTS.bazaar) {
    add('bazaar-n', bx, bz - 8, '-z', 'Bazaar', 1.8, 'food');
    add('bazaar-e', bx + 8, bz, '+x', 'Bazaar', 1.8, 'food');
    add('bazaar-w', bx - 8, bz, '-x', 'Bazaar', 1.8, 'food');
  }
  return places;
}

/** Straight spur segments from every place to its boulevard: kept clear of props. */
export function spurSegments(places, nav) {
  return Object.values(places).map((p) => {
    const r = nav.exitToRoad(p.x, p.z, p.side);
    return { ax: p.x, az: p.z, bx: r.x, bz: r.z };
  });
}

export function distToSegment(px, pz, s) {
  const vx = s.bx - s.ax, vz = s.bz - s.az;
  const L2 = vx * vx + vz * vz || 1;
  let t = ((px - s.ax) * vx + (pz - s.az) * vz) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (s.ax + t * vx), pz - (s.az + t * vz));
}
