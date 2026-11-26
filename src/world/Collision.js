// 2D (XZ-plane) collision world. Pure maths with no Three.js dependency, so it can be unit tested.
// Static colliders: axis-aligned boxes (buildings, benches) and circles (trees, fountain, lamps).

export class CollisionWorld {
  constructor(bound = Infinity) {
    this.boxes = []; // {minX,maxX,minZ,maxZ,h}
    this.circles = []; // {x,z,r}
    this.spheres = []; // camera-only occluders (tree crowns) {x,y,z,r}
    this.bound = bound;
    this.cellSize = 20;
    this.grid = new Map();
  }

  addBox(cx, cz, w, d, h = 10) {
    const b = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h };
    this.boxes.push(b);
    this._index(b, b.minX, b.maxX, b.minZ, b.maxZ);
    return b;
  }

  addCircle(x, z, r) {
    const c = { x, z, r, circle: true };
    this.circles.push(c);
    this._index(c, x - r, x + r, z - r, z + r);
    return c;
  }

  /** Camera occluder only: does not block walking. */
  addSphere(x, y, z, r) { this.spheres.push({ x, y, z, r }); }

  _key(i, j) { return i * 10007 + j; }

  _index(item, minX, maxX, minZ, maxZ) {
    const s = this.cellSize;
    for (let i = Math.floor(minX / s); i <= Math.floor(maxX / s); i++)
      for (let j = Math.floor(minZ / s); j <= Math.floor(maxZ / s); j++) {
        const k = this._key(i, j);
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(item);
      }
  }

  _nearby(x, z, r) {
    const s = this.cellSize, out = new Set();
    for (let i = Math.floor((x - r) / s); i <= Math.floor((x + r) / s); i++)
      for (let j = Math.floor((z - r) / s); j <= Math.floor((z + r) / s); j++) {
        const cell = this.grid.get(this._key(i, j));
        if (cell) for (const it of cell) out.add(it);
      }
    return out;
  }

  /** Push a circle of radius r at pos {x,z} out of all colliders. Mutates pos. Returns true if it hit anything. */
  resolve(pos, r) {
    let hit = false;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const c of this._nearby(pos.x, pos.z, r + 1)) {
        if (c.circle) {
          const dx = pos.x - c.x, dz = pos.z - c.z;
          const min = r + c.r, d2 = dx * dx + dz * dz;
          if (d2 < min * min) {
            const d = Math.sqrt(d2) || 1e-4;
            const push = min - d;
            pos.x += (dx / d) * push; pos.z += (dz / d) * push;
            moved = hit = true;
          }
        } else {
          const qx = Math.max(c.minX, Math.min(pos.x, c.maxX));
          const qz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
          const dx = pos.x - qx, dz = pos.z - qz, d2 = dx * dx + dz * dz;
          if (d2 > 1e-10) {
            if (d2 < r * r) {
              const d = Math.sqrt(d2), push = r - d;
              pos.x += (dx / d) * push; pos.z += (dz / d) * push;
              moved = hit = true;
            }
          } else {
            // Centre is inside the box: leave by the shortest side.
            const l = pos.x - c.minX, rr = c.maxX - pos.x, t = pos.z - c.minZ, bb = c.maxZ - pos.z;
            const m = Math.min(l, rr, t, bb);
            if (m === l) pos.x = c.minX - r; else if (m === rr) pos.x = c.maxX + r;
            else if (m === t) pos.z = c.minZ - r; else pos.z = c.maxZ + r;
            moved = hit = true;
          }
        }
      }
      if (!moved) break;
    }
    const B = this.bound - r;
    if (pos.x < -B) { pos.x = -B; hit = true; } if (pos.x > B) { pos.x = B; hit = true; }
    if (pos.z < -B) { pos.z = -B; hit = true; } if (pos.z > B) { pos.z = B; hit = true; }
    return hit;
  }

  /** True if the circle at x,z overlaps any collider. */
  blocked(x, z, r) {
    const p = { x, z };
    return this.resolve(p, r) && (Math.abs(p.x - x) > 1e-6 || Math.abs(p.z - z) > 1e-6);
  }

  /**
   * Distance along a 3D ray until it enters a building box (boxes treated as 0..h tall),
   * or maxDist if clear. Used to stop the camera from clipping into buildings.
   */
  raycastBoxes(ox, oy, oz, dx, dy, dz, maxDist, spheres = true) {
    let best = maxDist;
    for (const b of this.boxes) {
      let tmin = 0, tmax = best;
      const axes = [[ox, dx, b.minX, b.maxX], [oy, dy, 0, b.h], [oz, dz, b.minZ, b.maxZ]];
      let ok = true;
      for (const [o, d, lo, hi] of axes) {
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } continue; }
        let t1 = (lo - o) / d, t2 = (hi - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) { ok = false; break; }
      }
      if (ok && tmin < best) best = tmin;
    }
    if (spheres) for (const s of this.spheres) {
      const lx = ox - s.x, ly = oy - s.y, lz = oz - s.z;
      const b = lx * dx + ly * dy + lz * dz, c = lx * lx + ly * ly + lz * lz - s.r * s.r;
      const disc = b * b - c;
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t > 0.3 && t < best) best = t; // ignore crowns the focus point is already inside
    }
    return best;
  }
}
