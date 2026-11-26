import { el, esc, $, $$, hex, initials } from './dom.js';
import { DialogueRunner } from '../interaction/DialogueRunner.js';
import { searchKB, KB, entriesFor, LEADER } from '../data/knowledge.js';
import { npcById } from '../data/npcs.js';
import { buildingById } from '../data/buildings.js';

// Conversation panel. Scripted branches (1–4 / click / tap) plus, for FinVora's helpers,
// a box to type any money question. Questions are answered from the offline knowledge base;
// if another helper is the specialist, the agent says so and offers to show where to find them.

export class DialogueView {
  constructor(root) { this.root = root; this.node = null; }

  get open() { return !!this.node; }

  show(tree, speaker, ctx, { onLearn, onClose, agentId = null, onFind, onService }) {
    this.close(true);
    this.runner = new DialogueRunner(tree, ctx);
    Object.assign(this, { speaker, ctx, onLearn, onClose, agentId, onFind, onService });
    this.node = el(`<div class="glass dlg" role="dialog" aria-live="polite">
      <div class="dlg-head">
        <div class="dlg-portrait" style="background:${hex(speaker.color || 0xd4a846)}">${esc(initials(speaker.name))}</div>
        <div style="flex:1;min-width:0"><div class="dlg-name">${esc(speaker.name)}</div><div class="dlg-role">${esc(speaker.role)}</div></div>
        <button class="close-x" aria-label="Leave conversation">✕</button>
      </div>
      <div class="dlg-scroll">
        <div class="dlg-text"></div>
        <div class="dlg-learn"></div>
        <div class="dlg-extra"></div>
        <div class="dlg-choices"></div>
      </div>
      ${agentId ? `<form class="dlg-ask" autocomplete="off"><input class="fw-input" maxlength="160" placeholder="Type any money question…" aria-label="Ask a question"><button class="fw-btn primary" type="submit">Ask</button></form>` : ''}
    </div>`);
    $(this.node, '.close-x').addEventListener('click', () => this.close());
    if (agentId) {
      const form = $(this.node, '.dlg-ask'), input = $(form, 'input');
      form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value.trim(); if (q) { this.ask(q); input.value = ''; } });
      input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') input.blur(); });
    }
    this.root.appendChild(this.node);
    this._render(this.runner.node);
  }

  _learn(l) {
    const box = $(this.node, '.dlg-learn');
    box.innerHTML = '';
    if (!l) return;
    const isNew = this.onLearn?.(l);
    box.innerHTML = `<span class="fw-chip ${isNew ? 'gold' : ''}">${isNew ? '✦ Added to Journal' : 'In your Journal'} · ${esc(l.title)}</span>`;
  }

  _serviceButton(service) {
    const extra = $(this.node, '.dlg-extra');
    extra.innerHTML = '';
    if (!service || !this.onService || !buildingById[service]) return;
    const b = el(`<button class="fw-btn sm" style="margin-top:.6rem">Show me at the ${esc(buildingById[service].name)} →</button>`);
    b.addEventListener('click', () => { const s = service; this.close(); this.onService(s); });
    extra.appendChild(b);
  }

  _render(node) {
    $(this.node, '.dlg-text').textContent = node.text;
    this._learn(node.learn);
    this._serviceButton(node.service);
    const box = $(this.node, '.dlg-choices');
    box.innerHTML = node.choices.map((c, i) => `<button class="dlg-choice" data-i="${i}"><span class="n">${i + 1}</span><span>${esc(c.label)}</span></button>`).join('');
    $$(box, '.dlg-choice').forEach((b) => b.addEventListener('click', () => this.choose(Number(b.dataset.i))));
    $(this.node, '.dlg-scroll').scrollTop = 0;
  }

  /** Free-text question answered from the knowledge base. */
  ask(question) {
    const hits = searchKB(question, this.agentId);
    const text = $(this.node, '.dlg-text');
    const extra = $(this.node, '.dlg-extra');
    extra.innerHTML = '';
    const youAsked = `<div class="dlg-q">You asked: “${esc(question)}”</div>`;
    if (!hits.length) {
      text.innerHTML = `${youAsked}I'm not sure about that one. I can talk about the topics below, or try asking another FinVora helper.`;
      this._learn(null);
      const own = entriesFor(this.agentId).slice(0, 4);
      extra.innerHTML = `<div class="chips">${own.map((e) => `<button class="chip" data-q="${esc(e.q)}">${esc(e.q)}</button>`).join('')}</div>`;
      $$(extra, '[data-q]').forEach((b) => b.addEventListener('click', () => this.ask(b.dataset.q)));
      return;
    }
    const best = hits[0].e;
    const answer = best.a === '__NEWS__' ? (this.ctx.newsText?.() || 'Quiet day so far.') : best.a;
    const leader = this.agentId === LEADER;
    const mine = best.agent === this.agentId || leader;
    const spec = npcById[best.agent];
    text.innerHTML = youAsked + (mine ? '' : `<div class="dlg-ref">That's really ${esc(spec?.name || 'a colleague')}'s area${spec && spec.name !== spec.role ? `, our ${esc(spec.role)}` : ''}. Here's the short version:</div>`) + esc(answer);
    if (best.a !== '__NEWS__') this._learn({ id: `kb-${KB.indexOf(best)}`, title: best.q, summary: answer.length > 220 ? answer.slice(0, answer.lastIndexOf(' ', 217)) + '…' : answer });
    const btns = [];
    if ((!mine || (leader && best.agent !== LEADER)) && spec && this.onFind) btns.push(`<button class="fw-btn sm" data-find>${leader ? `Go deeper with ${esc(spec.name)}` : `Show me where ${esc(spec.name)} is`}</button>`);
    if (best.service && this.onService) btns.push(`<button class="fw-btn sm" data-svc>Open the ${esc(buildingById[best.service].name)} →</button>`);
    const more = hits.slice(1).filter((h) => h.e !== best).map((h) => `<button class="chip" data-q="${esc(h.e.q)}">${esc(h.e.q)}</button>`).join('');
    extra.innerHTML = `${btns.length ? `<div class="dlg-btns">${btns.join('')}</div>` : ''}${more ? `<div class="muted" style="font-size:.8rem;margin-top:.5rem">Related</div><div class="chips">${more}</div>` : ''}`;
    $(extra, '[data-find]')?.addEventListener('click', () => { this.onFind(best.agent); });
    $(extra, '[data-svc]')?.addEventListener('click', () => { const s = best.service; this.close(); this.onService(s); });
    $$(extra, '[data-q]').forEach((b) => b.addEventListener('click', () => this.ask(b.dataset.q)));
  }

  choose(i) {
    if (!this.node) return;
    const r = this.runner.choose(i);
    if (r.ended) this.close(); else if (r.node) this._render(r.node);
  }

  /** Route edge-triggered input while open (number keys ignored while typing). */
  handle(pressed) {
    if (document.activeElement?.tagName === 'INPUT') return;
    for (let k = 1; k <= 5; k++) if (pressed.has(`c${k}`)) { this.choose(k - 1); return; }
    if (pressed.has('pause') || pressed.has('back')) this.close();
  }

  close(silent = false) {
    if (!this.node) return;
    this.node.remove(); this.node = null;
    if (!silent) this.onClose?.();
  }
}
