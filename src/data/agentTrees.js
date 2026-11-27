// Builds a branching conversation for each helper agent from its knowledge-base entries,
// so every agent works with the same DialogueRunner, Knowledge Journal and typed-question box.
import { KB, entriesFor } from './knowledge.js';

const INTROS = {
  'financial-expert': "{greeting}, {name}. I'm {self}, Financial Expert, and I lead every helper in FinVora. Ask me anything about money, any topic at all. If a colleague can go deeper, I'll point you to them.",
  'mf-advisor': "{greeting}, {name}. I'm {self}, a mutual fund advisor. I help people match fund types to their goals. What would you like to know? You can also type your own question below.",
  'sip-coach': "Hi {name}! {self} here, SIP coach. Small amounts, every month, for a long time: that's my whole game. Ask me anything about SIPs.",
  'fund-manager': "{greeting}. I'm {self}; I run portfolios at AccoFinTra Mutual Fund. Curious how a fund works on the inside?",
  'analyst': "Hello {name}. {self}, financial analyst. I read company numbers so I can tell a strong business from a story. What can I explain?",
  'etf-specialist': "Hey {name}, I'm {self}. Index funds and ETFs are my thing: cheap, simple, diversified. What would you like to know?",
  'loan-officer': "{greeting}, {name}. {self}, loan officer. Before anyone borrows, I make sure they understand the EMI. Ask away.",
  'card-counsellor': "Hi {name}, I'm {self}. I help people use credit cards without getting trapped by them. What's on your mind?",
  'deposits-officer': "{greeting}. {self}, deposits desk. FDs, RDs and savings accounts: safe, simple, and still worth understanding properly.",
  'savings-agent': "Namaste, {name}. I'm {self} from the Small Savings counter in AccoFinTra Tower. PPF, NSC, SCSS and Sukanya Samriddhi are all here. What can I explain?",
  'retirement-planner': "{greeting}, {name}. {self}, retirement planner. The earlier you start, the easier this gets. What would you like to know?",
  'tax-consultant': "Hello {name}. {self}, tax consultant. I explain how investments are taxed; for your own return, always check with a qualified professional.",
  'insurance-consultant': "{greeting}. I'm {self}. Protect first, then grow: that's my motto. Ask me about life or health cover.",
  'budget-coach': "Hey {name}! {self}, budget coach. Every good plan starts with knowing where the money goes. What would you like help with?",
  'cyber-officer': "{greeting}, {name}. {self}, cyber safety. Most frauds succeed because someone was rushed. Let's make sure that isn't you.",
  'reporter': "{self} reporting from the streets of FinVora! Want the latest market news? Everything I report is simulated.",
};

export function buildAgentTree(agentId) {
  const entries = entriesFor(agentId);
  const nodes = {};
  const qChoices = (except) => entries.map((e, i) => ({ label: e.q, next: `a${i}` })).filter((c) => c.next !== except).slice(0, 4);
  nodes.hello = { text: INTROS[agentId] || "Hello {name}, I'm {self}. Ask me anything.", choices: [...qChoices(null), { label: 'Thanks, bye.', end: true }] };
  entries.forEach((e, i) => {
    const kbIndex = KB.indexOf(e);
    nodes[`a${i}`] = {
      text: e.a,
      ...(e.a === '__NEWS__' ? {} : { learn: { id: `kb-${kbIndex}`, title: e.q, summary: e.a.length > 220 ? e.a.slice(0, e.a.lastIndexOf(' ', 217)) + '…' : e.a } }),
      choices: [...[1, 2, 3].filter((k) => k < entries.length).map((k) => { const j = (i + k) % entries.length; return { label: entries[j].q, next: `a${j}` }; }), { label: 'Thanks, that helps.', end: true }],
      service: e.service,
    };
  });
  return { start: 'hello', nodes };
}

export const hasAgentTree = (agentId) => Boolean(INTROS[agentId]);
