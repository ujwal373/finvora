// FinVora locations. Footprints are in world metres (centre x/z, width along x, depth along z).
// `door` is the side of the footprint holding the entrance; it faces a boulevard.
// `services` are the working features inside (see ui/Services.js). Every building is open to everyone.

export const BUILDINGS = [
  {
    id: 'accofintra-hq', name: 'AccoFinTra Tower', short: 'ACCOFINTRA', style: 'tower', interior: 'tower',
    x: 0, z: -6, w: 28, d: 20, h: 120, color: 0x141a24, accent: 0xd4a846, door: '+z',
    blurb: 'The heart of FinVora and the tallest building in the city. Walk in: agents at 16 counters handle funds, SIPs, bonds and derivatives, gold, research and IPOs, savings schemes, insurance, retirement, tax, property, jobs, your credit report, KYC and UPI, courses, calculators and AccoFinTra investor relations.',
    services: [],
  },
  {
    id: 'stock-exchange', name: 'FinVora Stock Exchange', short: 'STOCK EXCHANGE', style: 'bse', interior: 'exchange',
    x: -50, z: -50, w: 30, d: 28, h: 92, color: 0xcfc8b8, accent: 0xd4a846, door: '+z', desk: 'exchange-desk',
    blurb: 'A tall exchange tower with a trading hall, inspired by Mumbai\'s historic exchange building. Trade shares and ETFs at the counters, watch the giant index board, and bid for IPOs at the listings desk.',
    services: [],
  },
  {
    id: 'bank', name: 'FinVora Bank', short: 'FINVORA BANK', style: 'bank', interior: 'bank',
    x: -50, z: 0, w: 30, d: 24, h: 15, color: 0xe6dfd0, accent: 0x2fbf71, door: '+x', desk: 'bank-desk',
    blurb: 'A classic banking hall with separate counters: accounts and cards, deposits, loans, and the manager\'s cabin.',
    services: [],
  },
  {
    id: 'car-showroom', name: 'FinVora Motors Showroom', short: 'MOTORS', style: 'showroom',
    x: 100, z: -50, w: 30, d: 20, h: 9, color: 0x1f2630, accent: 0xd4a846, door: '-x',
    blurb: 'Scooters to sports cars. Pay in full or with a car loan, then live with insurance, fuel and depreciation. A car is a cost, not an investment.',
    services: ['car-showroom', 'calc:emi'],
  },
  {
    id: 'clothing-store', name: 'Style Studio', short: 'STYLE STUDIO', style: 'boutique',
    x: -100, z: 100, w: 22, d: 18, h: 11, color: 0xf1e9e4, accent: 0xc0577a, door: '+x',
    blurb: 'Outfits and accessories for your avatar. Everything you buy stays in your wardrobe; change looks any time from your phone.',
    services: ['clothing-store', 'calc:budget'],
  },
  {
    id: 'supermart', name: 'FinVora SuperMart', short: 'SUPERMART', style: 'mart',
    x: 100, z: 104, w: 32, d: 22, h: 9, color: 0xeeeae2, accent: 0xe5534b, door: '-z',
    blurb: 'Groceries, household shopping and your monthly bills. Choose a grocery plan and how you pay.',
    services: ['supermart'],
  },
  {
    id: 'fuel-station', name: 'FinVora Fuels and EV Charging', short: 'FUEL · EV', style: 'pump',
    x: -100, z: -50, w: 8, d: 7, h: 4.5, color: 0xe8e4da, accent: 0xe5534b, door: '+x',
    blurb: 'Petrol, CNG and EV fast charging. Park your vehicle under the canopy and fill up.',
    services: ['fuel-station'],
  },
  {
    id: 'home', name: 'Your Home', short: 'HOME', style: 'house', interior: 'home',
    x: 46, z: 46, w: 16, d: 12, h: 7.5, color: 0xf0e6d6, accent: 0xb5563c, door: '-z',
    blurb: 'Your own house with a garage. Check your portfolio on the laptop, change clothes, rest, or take a car out of the garage.',
    services: [],
  },
  {
    id: 'mall', name: 'FinVora Central Mall', short: 'CENTRAL MALL', style: 'mall', interior: 'mall',
    x: 50, z: 0, w: 36, d: 36, h: 17, color: 0xe9e5dc, accent: 0x5aa9e6, door: '-x',
    blurb: 'Three floors of shops under a glass atrium. Gadgets on no-cost EMI (read the fine print), fashion, a food court and a cash machine.',
    services: [],
  },
  {
    id: 'cinema', name: 'Cineplex FinVora', short: 'CINEPLEX', style: 'cinema', interior: 'cinema',
    x: -50, z: 50, w: 30, d: 28, h: 16, color: 0x1b1d24, accent: 0xe5534b, door: '+x',
    blurb: 'A four-screen multiplex. Tickets, snacks, and a lesson in how much the popcorn really costs.',
    services: [],
  },
  {
    id: 'restaurant', name: 'Spice Route Restaurant', short: 'SPICE ROUTE', style: 'restaurant',
    x: -50, z: 100, w: 24, d: 18, h: 9, color: 0xc9845a, accent: 0xf08a3c, door: '+x',
    blurb: 'Thalis, biryani and filter coffee with a rooftop terrace. See what eating out every day really adds up to.',
    services: ['restaurant', 'calc:budget'],
  },
  {
    id: 'hospital', name: 'FinVora City Hospital', short: 'HOSPITAL', style: 'hospital',
    x: 100, z: 0, w: 30, d: 26, h: 26, color: 0xf4f4f2, accent: 0xe5534b, door: '-x',
    blurb: 'Outpatient doctors, health check-ups, day-care treatment and a 24 × 7 pharmacy. See how health insurance changes the bill.',
    services: ['hospital', 'pharmacy', 'insurance-desk'],
  },
  {
    id: 'school', name: 'FinVora Public School and College', short: 'SCHOOL', style: 'school',
    x: -100, z: -100, w: 34, d: 24, h: 12, color: 0xb5563c, accent: 0xf2f2ee, door: '+x',
    blurb: 'Evening diploma courses for adults, with fees paid upfront or through an education loan (and its tax benefit).',
    services: ['school', 'calc:emi'],
  },
  {
    id: 'gym', name: 'FinVora Fit Gym', short: 'FINVORA FIT', style: 'gym',
    x: 50, z: -100, w: 24, d: 18, h: 9, color: 0x1c1f24, accent: 0x9be15d, door: '+z',
    blurb: 'Treadmills, weights and classes. Monthly or annual plans: the cheaper one is the one you actually use.',
    services: ['gym'],
  },
];

// Services that used to have their own buildings now live at counters inside AccoFinTra Tower.
// Old ids still resolve (waypoints, agent "show me" buttons) and lead to the tower.
export const MOVED_TO_TOWER = ['bond-market', 'derivatives', 'commodities', 'research', 'mutual-fund', 'fintech', 'academy', 'insurance', 'retirement', 'real-estate', 'govt-savings', 'tax-office', 'calc-centre', 'job-centre', 'credit-bureau'];

// Bus stops (shelters on the pavement). The city bus loops through them in this order.
export const BUS_STOPS = [
  { id: 'bs-tower', name: 'AccoFinTra Tower', x: 12, z: 20.5, road: 'z', at: 25 },
  { id: 'bs-bank', name: 'Bank, Exchange and Cinema', x: -62, z: 20.5, road: 'z', at: 25 },
  { id: 'bs-style', name: 'Style Studio and Spice Route', x: -79.5, z: 112, road: 'x', at: -75 },
  { id: 'bs-bazaar', name: 'Bazaar', x: 12, z: 120.5, road: 'z', at: 125 },
  { id: 'bs-mart', name: 'SuperMart and Home', x: 79.5, z: 62, road: 'x', at: 75 },
  { id: 'bs-motors', name: 'Hospital and Motors', x: 79.5, z: -38, road: 'x', at: 75 },
  { id: 'bs-north', name: 'School and Gym', x: 12, z: -120.5, road: 'z', at: -125 },
];

// Block uses (block centre coordinates). The 5 × 5 core is hand-placed; the outer ring is generated.
// Blocks holding a landmark building are left out automatically. (0, 50) is Central Park (built separately).
const CORE = {
  residential: [[-100, -100], [-100, 0], [-100, 50], [100, 50], [-50, 100], [50, 100], [-150, 100], [-150, 0]],
  parks: [[100, -100]],
  bazaar: [[0, 100]],
  business: [[0, -50], [50, -50], [-50, -100], [0, -100], [50, -100], [100, 0], [100, -50]],
};
const LANDMARKS = { lake: [[-150, 150]], stadium: [[150, 150]], centralPark: [[0, 50]] };
const RING = [-200, -150, -100, -50, 0, 50, 100, 150, 200];
const hasBuilding = (x, z) => BUILDINGS.some((b) => Math.abs(b.x - x) < 25 && Math.abs(b.z - z) < 25);
const extra = { residential: [], parks: [], business: [] };
const taken = (x, z) => [...Object.values(CORE), ...Object.values(LANDMARKS)].some((l) => l.some(([a, b]) => a === x && b === z)) || hasBuilding(x, z);
for (const x of RING) for (const z of RING) {
  if (Math.max(Math.abs(x), Math.abs(z)) <= 100 || taken(x, z)) continue;
  const k = ((x * 7 + z * 13) / 50 + 100) % 9; // deterministic variety
  if (z <= -150 || (x >= 150 && z <= 50)) extra[k < 1.5 ? 'parks' : 'business'].push([x, z]);
  else extra[k < 2 ? 'parks' : 'residential'].push([x, z]);
}
const free = (l) => l.filter(([x, z]) => !hasBuilding(x, z));
export const DISTRICTS = {
  residential: free([...CORE.residential, ...extra.residential]),
  parks: free([...CORE.parks, ...extra.parks]),
  bazaar: CORE.bazaar,
  business: free([...CORE.business, ...extra.business]),
  ...LANDMARKS,
};

// FinVora Metro Blue Line: an elevated line over the boulevard at z = -25 (behind AccoFinTra Tower).
// Each station has a street entrance on the north pavement. Fares are illustrative.
export const METRO_Z = -25;
export const METRO_STATIONS = [
  { id: 'm-west', name: 'West End', x: -150 },
  { id: 'm-exchange', name: 'Exchange and Bank', x: -50, side: 1 },
  { id: 'm-mall', name: 'Central Mall', x: 50 },
  { id: 'm-east', name: 'Hospital and East Park', x: 150 },
];
export const metroFare = (stops) => [0, 20, 30, 40][Math.min(3, stops)];

/** Entrance point (outside the door) and the yaw a player faces when walking in. */
export function doorPoint(b, offset = 1.9) {
  switch (b.door) {
    case '+z': return { x: b.x, z: b.z + b.d / 2 + offset, face: Math.PI };
    case '-z': return { x: b.x, z: b.z - b.d / 2 - offset, face: 0 };
    case '+x': return { x: b.x + b.w / 2 + offset, z: b.z, face: -Math.PI / 2 };
    case '-x': return { x: b.x - b.w / 2 - offset, z: b.z, face: Math.PI / 2 };
    default: throw new Error(`bad door side ${b.door}`);
  }
}

export const buildingById = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
for (const id of MOVED_TO_TOWER) buildingById[id] = buildingById['accofintra-hq'];
