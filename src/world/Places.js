import { BUILDINGS, DISTRICTS, doorPoint } from '../data/buildings.js';

// Named spots NPCs walk between. `side` says which way to walk to reach a boulevard.
export function buildPlaces() {
  const places = {};
  const add = (id, x, z, side, label, loiter = 1.2, kind = 'spot') => { places[id] = { id, x, z, side, label, loiter, kind }; };
  for (const b of BUILDINGS) {
    // Staff wait a few steps out from the door so they never block the entrance.
    const p = doorPoint(b, 5.5);
    add(b.id, p.x, p.z, b.door, b.name, 2.2, 'work');
  }
  // Compound Square (central park). Spurs follow the park's cross paths.
  add('park-n', 0, -9, '-z', 'Compound Square', 1.2, 'leisure');
  // The heart of the city: FinVora's leaders stand together beside the fountain.
  add('plaza-a', -1.1, -6.3, '-z', 'Fountain', 0.25, 'post');
  add('plaza-b', 1.1, -6.3, '-z', 'Fountain', 0.25, 'post');
  add('park-s', 0, 9, '+z', 'Compound Square', 1.2, 'leisure');
  add('park-e', 9, 0, '+x', 'Compound Square', 1.2, 'leisure');
  add('park-w', -9, 0, '-x', 'Compound Square', 1.2, 'leisure');
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
