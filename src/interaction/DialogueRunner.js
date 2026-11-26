// Walks a branching dialogue tree. Pure logic; the view lives in ui/DialogueView.js.
//
// Extension point for AI conversations later: anything with the same shape as a node
// ({ text, choices, learn }) can be produced by a provider, e.g. an LLM call that is grounded
// on the scripted tree. Scripted trees remain the default and need no paid API.

export function fillText(text, ctx) {
  return text
    .replaceAll('{name}', ctx.firstName || 'friend')
    .replaceAll('{greeting}', ctx.greeting || 'Hello')
    .replaceAll('{self}', ctx.self || 'a FinVora resident')
    .replace(/\{npc:([a-z-]+)\}/g, (_, id) => (ctx.names && ctx.names[id]) || id);
}

export class DialogueRunner {
  constructor(tree, ctx = {}) {
    if (!tree || !tree.nodes || !tree.nodes[tree.start]) throw new Error('Invalid dialogue tree');
    this.tree = tree;
    this.ctx = ctx;
    this.nodeId = tree.start;
    this.history = [tree.start];
    this.ended = false;
  }

  get node() {
    const n = this.tree.nodes[this.nodeId];
    const text = n.text === '__NEWS__' ? (this.ctx.newsText?.() || 'Quiet day so far.') : fillText(n.text, this.ctx);
    return { id: this.nodeId, text, choices: n.choices || [], learn: n.learn || null, service: n.service || null };
  }

  /** Pick choice index. Returns { ended, node }. */
  choose(i) {
    const c = this.node.choices[i];
    if (!c) return { ended: this.ended, node: this.node };
    if (c.end || !c.next) { this.ended = true; return { ended: true, node: null }; }
    if (!this.tree.nodes[c.next]) throw new Error(`Missing dialogue node: ${c.next}`);
    this.nodeId = c.next;
    this.history.push(c.next);
    return { ended: false, node: this.node };
  }
}

/** Validation used by tests: every `next` resolves, every node reachable, every node can exit. */
export function validateTree(tree) {
  const errors = [];
  const ids = Object.keys(tree.nodes);
  if (!tree.nodes[tree.start]) errors.push(`start node "${tree.start}" missing`);
  const seen = new Set([tree.start]), q = [tree.start];
  while (q.length) {
    const id = q.shift(), n = tree.nodes[id];
    if (!n) continue;
    if (!n.text) errors.push(`${id}: empty text`);
    if (!n.choices?.length) errors.push(`${id}: no choices (dead end)`);
    for (const c of n.choices || []) {
      if (!c.label) errors.push(`${id}: choice without label`);
      if (c.next && !tree.nodes[c.next]) errors.push(`${id}: next "${c.next}" missing`);
      if (c.next && !seen.has(c.next)) { seen.add(c.next); q.push(c.next); }
    }
    if (n.learn && (!n.learn.id || !n.learn.title || !n.learn.summary)) errors.push(`${id}: incomplete learn entry`);
  }
  for (const id of ids) if (!seen.has(id)) errors.push(`${id}: unreachable`);
  return errors;
}
