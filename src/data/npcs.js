// FinVora residents. Names come from NPC_NAMES (data/npcNames.js); until a name is set the
// role title is shown. Movement patterns:
//   routine  – follows an hourly schedule (home → office → lunch → office → evening → home)
//   circuit  – loops through places with short stops (hurried)
//   commuter – shuttles between two places with long stops
//   wanderer – picks random places across the city
//   patrol   – walks a loop of boulevard intersections without stopping
// Hours use the in-game 24 h clock.
import { NPC_NAMES } from './npcNames.js';

const workday = (office, home, lunch, evening) => [
  { from: 0, place: home }, { from: 8.5, place: office }, { from: 13, place: lunch },
  { from: 14, place: office }, { from: 19, place: evening }, { from: 21.5, place: home },
];

const RAW = [
  // ---- the leader
  { id: 'financial-expert', role: 'Financial Expert', leader: true, office: 'plaza-a', spawn: 'plaza-a', partner: 'fund-manager', speed: 1.2, pattern: 'routine',
    routine: [{ from: 0, place: 'plaza-a' }],
    look: { skin: 0xb98a62, shirt: 0x111318, pants: 0x111318, hair: 0x0e0b09, hairStyle: 'short', accessory: 'tie' } },
  // ---- the original five
  { id: 'bank-manager', role: 'Investment Banker', dialogue: 'meera', office: 'bank', speed: 1.35, pattern: 'routine',
    routine: workday('bank', 'home-3', 'park-n', 'mutual-fund'),
    look: { skin: 0xc68e62, shirt: 0x1f6f4a, pants: 0x22262c, hair: 0x1b1410, hairStyle: 'bun', accessory: 'badge' } },
  { id: 'stock-broker', role: 'Stock Broker', dialogue: 'arjun', office: 'stock-exchange', speed: 2.1, pattern: 'circuit', dwell: [3, 7],
    circuit: ['stock-exchange', 'derivatives', 'bond-market', 'research', 'stock-exchange', 'park-n'],
    look: { skin: 0xb07a52, shirt: 0xe8e4da, pants: 0x1c2333, hair: 0x15110d, hairStyle: 'short', accessory: 'tie' } },
  { id: 'professor', role: 'Financial Professor', dialogue: 'kavita', office: 'academy', speed: 1.15, pattern: 'commuter', dwell: [25, 45],
    between: ['academy', 'research'],
    look: { skin: 0xa8734f, shirt: 0x7a3b52, pants: 0x3a3430, hair: 0x9a9590, hairStyle: 'long', accessory: 'glasses' } },
  { id: 'retail-investor', role: 'Retail Investor', dialogue: 'ravi', speed: 1.45, pattern: 'wanderer', dwell: [6, 14],
    look: { skin: 0x8d5a3b, shirt: 0xd88a2b, pants: 0x34507a, hair: 0x111111, hairStyle: 'short', accessory: 'cap' } },
  { id: 'fraud-investigator', role: 'Fraud Investigator', dialogue: 'sana', office: 'fintech', speed: 1.7, pattern: 'patrol',
    patrol: [[2, 2], [3, 2], [4, 2], [4, 3], [3, 3], [3, 4], [2, 4], [1, 4], [1, 3], [2, 3], [2, 2], [2, 1], [3, 1], [3, 2]],
    look: { skin: 0xb98563, shirt: 0x2a3340, pants: 0x1a1d22, hair: 0x120e0b, hairStyle: 'bob', accessory: 'coat' } },
  // ---- helper agents
  { id: 'mf-advisor', role: 'Mutual Fund Advisor', office: 'mutual-fund', speed: 1.3, pattern: 'routine', routine: workday('mutual-fund', 'home-5', 'bazaar-e', 'park-e'),
    look: { skin: 0xc49067, shirt: 0x2fbf71, pants: 0x2a2f36, hair: 0x1a120c, hairStyle: 'bob', accessory: 'badge' } },
  { id: 'sip-coach', role: 'SIP Coach', office: 'mutual-fund', speed: 1.5, pattern: 'routine', routine: workday('mutual-fund', 'home-6', 'park-e', 'car-showroom'),
    look: { skin: 0x9c6844, shirt: 0x58c48b, pants: 0x3a3f46, hair: 0x0f0c0a, hairStyle: 'short', accessory: 'cap' } },
  { id: 'fund-manager', role: 'Fund Manager', office: 'mutual-fund', spawn: 'plaza-b', partner: 'financial-expert', speed: 1.25, pattern: 'routine', routine: [{ from: 0, place: 'plaza-b' }],
    look: { skin: 0xc8916a, shirt: 0x7a1f3d, pants: 0x7a1f3d, hair: 0x1a120c, hairStyle: 'long', top: 'saree', accessory: 'badge', accs: ['badge'] } },
  { id: 'analyst', role: 'Financial Analyst', office: 'research', speed: 1.4, pattern: 'routine', routine: workday('research', 'home-4', 'bazaar-n', 'stock-exchange'),
    look: { skin: 0xd1a27c, shirt: 0x5aa9e6, pants: 0x2b2f38, hair: 0x18110b, hairStyle: 'long', accessory: 'glasses' } },
  { id: 'etf-specialist', role: 'ETF and Index Specialist', office: 'stock-exchange', speed: 1.35, pattern: 'routine', routine: workday('stock-exchange', 'home-1', 'park-n', 'commodities'),
    look: { skin: 0xa0704c, shirt: 0xd4a846, pants: 0x262a31, hair: 0x15100c, hairStyle: 'short', accessory: 'badge' } },
  { id: 'loan-officer', role: 'Loan Officer', office: 'bank', speed: 1.3, pattern: 'routine', routine: workday('bank', 'home-0', 'park-w', 'bazaar-w'),
    look: { skin: 0x8f5d3c, shirt: 0x3d5a80, pants: 0x1f2329, hair: 0x0d0d0d, hairStyle: 'short', accessory: 'tie' } },
  { id: 'card-counsellor', role: 'Credit Card Counsellor', office: 'bank', speed: 1.3, pattern: 'routine', routine: workday('bank', 'home-2', 'bazaar-w', 'park-w'),
    look: { skin: 0xc8946b, shirt: 0xc0392b, pants: 0x2a2a2e, hair: 0x2a1a10, hairStyle: 'bun', accessory: 'badge' } },
  { id: 'deposits-officer', role: 'Deposits Officer', office: 'bank', speed: 1.2, pattern: 'routine', routine: workday('bank', 'home-3', 'park-w', 'govt-savings'),
    look: { skin: 0xb5845c, shirt: 0x16a085, pants: 0x30343c, hair: 0x6b6b6b, hairStyle: 'short', accessory: 'glasses' } },
  { id: 'savings-agent', role: 'Small Savings Agent', office: 'govt-savings', speed: 1.2, pattern: 'routine', routine: workday('govt-savings', 'home-1', 'park-n', 'bank'),
    look: { skin: 0x9a6a47, shirt: 0xe5534b, pants: 0x3b3328, hair: 0x111111, hairStyle: 'long', accessory: 'none' } },
  { id: 'retirement-planner', role: 'Retirement Planner', office: 'retirement', speed: 1.15, pattern: 'routine', routine: workday('retirement', 'home-6', 'bazaar-n', 'park-s'),
    look: { skin: 0xc29068, shirt: 0x8e7d5c, pants: 0x2d2a26, hair: 0xb0aca6, hairStyle: 'short', accessory: 'glasses' } },
  { id: 'tax-consultant', role: 'Tax Consultant', office: 'tax-office', speed: 1.3, pattern: 'routine', routine: workday('tax-office', 'home-5', 'bazaar-e', 'mutual-fund'),
    look: { skin: 0xab7650, shirt: 0xf5f5f0, pants: 0x262a31, hair: 0x1c140e, hairStyle: 'short', accessory: 'tie' } },
  { id: 'insurance-consultant', role: 'Insurance Consultant', office: 'insurance', speed: 1.3, pattern: 'routine', routine: workday('insurance', 'home-7', 'bazaar-n', 'park-s'),
    look: { skin: 0xc8916a, shirt: 0x6b5a7a, pants: 0x25222a, hair: 0x241811, hairStyle: 'bob', accessory: 'badge' } },
  { id: 'budget-coach', role: 'Budget Coach', office: 'park-s', speed: 1.4, pattern: 'routine', routine: workday('park-s', 'home-8', 'bazaar-w', 'clothing-store'),
    look: { skin: 0x8b5a3a, shirt: 0xf08a3c, pants: 0x34507a, hair: 0x0d0d0d, hairStyle: 'bun', accessory: 'none' } },
  { id: 'cyber-officer', role: 'Cyber Safety Officer', office: 'fintech', speed: 1.4, pattern: 'routine', routine: workday('fintech', 'home-4', 'park-e', 'tax-office'),
    look: { skin: 0xa77450, shirt: 0x1e2a3a, pants: 0x14171c, hair: 0x0f0f0f, hairStyle: 'short', accessory: 'coat' } },
  { id: 'reporter', role: 'Market Reporter', speed: 1.7, pattern: 'wanderer', dwell: [5, 10],
    look: { skin: 0xd0a07a, shirt: 0xc96bd4, pants: 0x2a2a2e, hair: 0x3a2414, hairStyle: 'long', accessory: 'cap' } },
];

export const KEY_NPCS = RAW.map((n) => ({
  ...n,
  name: (NPC_NAMES[n.id] || '').trim() || n.role,
  hasName: Boolean((NPC_NAMES[n.id] || '').trim()),
  spawn: n.spawn || n.office || (n.routine ? n.routine[1].place : 'park-s'),
}));
export const npcById = Object.fromEntries(KEY_NPCS.map((n) => [n.id, n]));

// Ambient residents: count depends on the graphics preset. They wander and share one-liners.
export const CITIZEN_LOOKS = [
  { skin: 0xd2a07a, shirt: 0x5aa9e6, pants: 0x2c2c34, hair: 0x2a1a10 },
  { skin: 0x9b6a48, shirt: 0xc94f4f, pants: 0x3a3a40, hair: 0x101010 },
  { skin: 0xc08a64, shirt: 0x6d8f3c, pants: 0x4a3c2c, hair: 0x3b2a1e },
  { skin: 0x7d4f33, shirt: 0xe0c060, pants: 0x23303f, hair: 0x0c0c0c },
  { skin: 0xe0b48f, shirt: 0x8a6fbf, pants: 0x2a2a2a, hair: 0x6b4a2b },
  { skin: 0xa77450, shirt: 0xdedede, pants: 0x5a4636, hair: 0x1a1410 },
  { skin: 0x8a5a3a, shirt: 0x2f9e8f, pants: 0x30343c, hair: 0x141414 },
];

export const CITIZEN_LINES = [
  'Lovely day. I just set up an automatic transfer to my savings on payday.',
  'Someone promised me 3% a day returns. That sounded wrong, so I asked the Fraud Investigator.',
  'I keep six months of expenses aside before I invest anything. Peace of mind.',
  'The Academy is free to walk into. The Professor explains things simply.',
  'Somebody told me FDs and shares are the same. They really are not.',
  'I check whether an adviser is SEBI-registered before I listen to them.',
  'Busy day at the Exchange. Remember, every price in FinVora is simulated.',
  'I learned the hard way: paying only the minimum on a credit card is expensive.',
  'The Calculator Centre on the west side has every calculator you could want.',
  'My SIP runs on the 5th of every month. I barely notice it any more.',
];
