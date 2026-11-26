// Pedestrian navigation over the boulevard grid. Pure maths, unit tested.
// Nodes are boulevard intersections. A "place" is a spot off the grid (a doorway, a park bench)
// joined to the grid by a straight, collision-free spur that meets a boulevard at right angles.

export class NavGraph {
  constructor(xs, zs) {
    this.xs = [...xs].sort((a, b) => a - b);
    this.zs = [...zs].sort((a, b) => a - b);
    this.nodes = [];
    for (let j = 0; j < this.zs.length; j++)
      for (let i = 0; i < this.xs.length; i++) this.nodes.push({ id: this.nodes.length, i, j, x: this.xs[i], z: this.zs[j] });
    this.adj = this.nodes.map(() => []);
    const id = (i, j) => j * this.xs.length + i;
    for (const n of this.nodes) {
      if (n.i + 1 < this.xs.length) this._link(n.id, id(n.i + 1, n.j));
      if (n.j + 1 < this.zs.length) this._link(n.id, id(n.i, n.j + 1));
    }
    this.nodeAt = id;
  }

  _link(a, b) { this.adj[a].push(b); this.adj[b].push(a); }

  /** Snap a point onto a boulevard by walking out of `side` ('+x','-x','+z','-z'). Returns road point + segment ends. */
  exitToRoad(x, z, side) {
    const { xs, zs } = this;
    let rx = x, rz = z;
    if (side === '+z') rz = zs.find((v) => v > z) ?? zs[zs.length - 1];
    else if (side === '-z') rz = [...zs].reverse().find((v) => v < z) ?? zs[0];
    else if (side === '+x') rx = xs.find((v) => v > x) ?? xs[xs.length - 1];
    else if (side === '-x') rx = [...xs].reverse().find((v) => v < x) ?? xs[0];
    else throw new Error(`bad side ${side}`);
    let ends;
    if (side === '+z' || side === '-z') {
      const j = zs.indexOf(rz);
      let i = xs.findIndex((v) => v >= rx);
      if (i <= 0) i = 1;
      ends = [this.nodeAt(i - 1, j), this.nodeAt(i, j)];
    } else {
      const i = xs.indexOf(rx);
      let j = zs.findIndex((v) => v >= rz);
      if (j <= 0) j = 1;
      ends = [this.nodeAt(i, j - 1), this.nodeAt(i, j)];
    }
    return { x: rx, z: rz, ends };
  }

  dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

  /** A* between two node ids. Returns list of node ids. */
  nodePath(from, to) {
    if (from === to) return [from];
    const open = new Set([from]);
    const g = new Map([[from, 0]]), f = new Map([[from, this.dist(this.nodes[from], this.nodes[to])]]);
    const came = new Map();
    while (open.size) {
      let cur = null, best = Infinity;
      for (const n of open) { const v = f.get(n); if (v < best) { best = v; cur = n; } }
      if (cur === to) {
        const path = [cur];
        while (came.has(cur)) { cur = came.get(cur); path.unshift(cur); }
        return path;
      }
      open.delete(cur);
      for (const nb of this.adj[cur]) {
        const tg = g.get(cur) + this.dist(this.nodes[cur], this.nodes[nb]);
        if (tg < (g.get(nb) ?? Infinity)) {
          came.set(nb, cur); g.set(nb, tg);
          f.set(nb, tg + this.dist(this.nodes[nb], this.nodes[to]));
          open.add(nb);
        }
      }
    }
    return null;
  }

  _len(pts) { let s = 0; for (let k = 1; k < pts.length; k++) s += this.dist(pts[k - 1], pts[k]); return s; }

  /** Full walking route between two places ({x,z,side}). Returns array of {x,z}. */
  route(a, b) {
    const ra = this.exitToRoad(a.x, a.z, a.side);
    const rb = this.exitToRoad(b.x, b.z, b.side);
    const sameSeg = ra.ends[0] === rb.ends[0] && ra.ends[1] === rb.ends[1];
    if (sameSeg) return [{ x: a.x, z: a.z }, { x: ra.x, z: ra.z }, { x: rb.x, z: rb.z }, { x: b.x, z: b.z }];
    let best = null, bestLen = Infinity;
    for (const ea of ra.ends) for (const eb of rb.ends) {
      const np = this.nodePath(ea, eb);
      if (!np) continue;
      const pts = [{ x: a.x, z: a.z }, { x: ra.x, z: ra.z }, ...np.map((id) => ({ x: this.nodes[id].x, z: this.nodes[id].z })), { x: rb.x, z: rb.z }, { x: b.x, z: b.z }];
      const L = this._len(pts);
      if (L < bestLen) { bestLen = L; best = pts; }
    }
    return dedupe(best);
  }
}

function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 0.05) out.push(p);
  }
  return out;
}
