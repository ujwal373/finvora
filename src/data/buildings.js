// FinVora locations. Footprints are in world metres (centre x/z, width along x, depth along z).
// `door` is the side of the footprint holding the entrance; it faces a boulevard.
// `services` are the working features inside (see ui/Services.js). Every building is open to everyone.

export const BUILDINGS = [
  {
    id: 'stock-exchange', name: 'Stock Exchange', short: 'EXCHANGE', style: 'classical',
    x: -50, z: -48, w: 30, d: 24, h: 14, color: 0xd9d2c3, accent: 0xd4a846, door: '+z', desk: 'exchange-desk',
    blurb: 'Buy and sell shares of fictional listed companies and ETFs with your virtual wallet. Learn how orders, prices and risk work.',
    services: ['trade-stocks', 'trade-etfs', 'market-board'],
  },
  {
    id: 'bond-market', name: 'Bond Market', short: 'BONDS', style: 'block',
    x: -8.5, z: -50, w: 15, d: 26, h: 18, color: 0x8c9bab, accent: 0x5aa9e6, door: '+z',
    blurb: 'Government securities, T-bills and corporate bonds: coupons, maturity, yield and why bond prices fall when rates rise.',
    services: ['bond-desk', 'calc:bond'],
  },
  {
    id: 'derivatives', name: 'Derivatives Exchange', short: 'DERIVATIVES', style: 'tower',
    x: 9, z: -50, w: 14, d: 24, h: 30, color: 0x3b4352, accent: 0xe5534b, door: '+z',
    blurb: 'Futures and options as education only: premiums, expiry and payoff diagrams. Never trading tips.',
    services: ['fno', 'calc:option'],
  },
  {
    id: 'commodities', name: 'Commodities Exchange', short: 'COMMODITIES', style: 'block',
    x: 41, z: -50, w: 14, d: 26, h: 16, color: 0xb08a5a, accent: 0xf0c868, door: '-x',
    blurb: 'Gold, silver and crude oil, and why they move differently from shares. Gold and silver ETFs trade at the Stock Exchange.',
    services: ['gold-desk', 'commodity-board'],
  },
  {
    id: 'research', name: 'Investment Research Centre', short: 'RESEARCH', style: 'glass',
    x: 59, z: -50, w: 14, d: 26, h: 24, color: 0x4a6a7a, accent: 0x5aa9e6, door: '+z',
    blurb: 'Read the numbers behind each fictional company: revenue, profit, debt and valuation, before you decide.',
    services: ['results', 'ipo', 'company-research'],
  },
  {
    id: 'bank', name: 'Banking District', short: 'BANK', style: 'tower',
    x: -50, z: 0, w: 22, d: 22, h: 40, color: 0x2f3b4a, accent: 0x2fbf71, door: '+x', desk: 'bank-desk',
    blurb: 'Fixed and recurring deposits, personal loans with real EMI maths, and the interest calculators every borrower should see.',
    services: ['bank-accounts', 'bank-deposits', 'bank-loans', 'interest-wall', 'calc:fd', 'calc:rd', 'calc:emi', 'calc:card'],
  },
  {
    id: 'mutual-fund', name: 'Mutual Fund Centre', short: 'MUTUAL FUNDS', style: 'block',
    x: 50, z: -8, w: 26, d: 14, h: 22, color: 0x2e5a4c, accent: 0x2fbf71, door: '-x',
    blurb: 'Equity, debt, hybrid, index, ELSS and liquid funds. Invest a lump sum, start SIPs or step-up SIPs, and track NAVs.',
    services: ['mf-invest', 'mf-sip', 'calc:sip', 'calc:stepup', 'calc:lumpsum', 'calc:swp'],
  },
  {
    id: 'fintech', name: 'Financial Technology Hub', short: 'FINTECH HUB', style: 'glass',
    x: 50, z: 9, w: 26, d: 14, h: 20, color: 0x26303d, accent: 0x5aa9e6, door: '-x',
    blurb: 'UPI, digital payments and how to stay safe with digital money. Test yourself in the scam-spotting lab.',
    services: ['kyc-upi', 'scam-lab', 'link-lab'],
  },
  {
    id: 'academy', name: 'Financial Academy', short: 'ACADEMY', style: 'campus',
    x: -50, z: 50, w: 30, d: 24, h: 12, color: 0xc9b48a, accent: 0xd4a846, door: '-z', desk: 'academy-desk',
    blurb: 'The learning heart of FinVora. Interactive demos, your Knowledge Journal, and the maths behind money.',
    services: ['courses', 'doubling-lab', 'journal', 'calc:inflation', 'calc:cagr'],
  },
  {
    id: 'insurance', name: 'Insurance Centre', short: 'INSURANCE', style: 'block',
    x: -8.5, z: 50, w: 15, d: 26, h: 20, color: 0x6b5a7a, accent: 0xd4a846, door: '-z',
    blurb: 'Protect before you grow: term life cover, health cover, and why insurance and investment are different jobs.',
    services: ['insurance-desk', 'calc:cover'],
  },
  {
    id: 'retirement', name: 'Retirement Planning Centre', short: 'RETIREMENT', style: 'campus',
    x: 9, z: 50, w: 14, d: 24, h: 14, color: 0x9a8f7a, accent: 0x2fbf71, door: '-z',
    blurb: 'NPS, EPF and VPF, with their rules spelled out, plus a retirement corpus planner.',
    services: ['epf', 'nps', 'calc:retirement', 'calc:epf'],
  },
  {
    id: 'real-estate', name: 'Real Estate Investment Centre', short: 'REAL ESTATE', style: 'stepped',
    x: 50, z: 50, w: 24, d: 24, h: 30, color: 0x7d6a58, accent: 0xf0c868, door: '-z',
    blurb: 'REITs, InvITs, rental yield and the true cost of owning property, compared honestly with other assets.',
    services: ['property', 'calc:rental'],
  },
  // ---------------------------------------------------------------- outer districts
  {
    id: 'govt-savings', name: 'Government Savings Office', short: 'SMALL SAVINGS', style: 'campus',
    x: 0, z: -100, w: 26, d: 20, h: 13, color: 0xc7b08a, accent: 0xe5534b, door: '+z',
    blurb: 'Post office small savings schemes backed by the Government of India: PPF, NSC, Senior Citizen Savings Scheme and Sukanya Samriddhi.',
    services: ['govt-schemes', 'calc:ppf'],
  },
  {
    id: 'tax-office', name: 'Tax Office', short: 'TAX OFFICE', style: 'block',
    x: 100, z: 0, w: 22, d: 24, h: 18, color: 0x5e6a5a, accent: 0xd4a846, door: '-x',
    blurb: 'How investments are taxed, why holding period matters, and a checker for your own simulated holdings.',
    services: ['tax-filing', 'holding-periods'],
  },
  {
    id: 'calc-centre', name: 'Financial Calculator Centre', short: 'CALCULATORS', style: 'glass',
    x: -100, z: 0, w: 22, d: 24, h: 16, color: 0x2a3644, accent: 0xf0c868, door: '+x',
    blurb: 'Every FinVora calculator in one place, each showing its formula, inputs, assumptions and a full breakdown.',
    services: ['all-calcs'],
  },
  {
    id: 'car-showroom', name: 'FinVora Motors Showroom', short: 'MOTORS', style: 'glass',
    x: 100, z: -50, w: 28, d: 22, h: 12, color: 0x1f2630, accent: 0xd4a846, door: '-x',
    blurb: 'Scooters to sports cars. Pay in full or with a car loan, then live with insurance, fuel and depreciation. A car is a cost, not an investment.',
    services: ['car-showroom', 'calc:emi'],
  },
  {
    id: 'clothing-store', name: 'Style Studio', short: 'STYLE STUDIO', style: 'stepped',
    x: -100, z: 100, w: 24, d: 22, h: 14, color: 0x8a5a6a, accent: 0xf0c868, door: '+x',
    blurb: 'Outfits and accessories for your avatar. Everything you buy stays in your wardrobe; change looks any time from your phone.',
    services: ['clothing-store', 'calc:budget'],
  },
  {
    id: 'accofintra-hq', name: 'AccoFinTra Tower', short: 'ACCOFINTRA', style: 'tower',
    x: 0, z: -150, w: 26, d: 26, h: 110, color: 0x1a1f28, accent: 0xd4a846, door: '+z',
    blurb: 'Headquarters of AccoFinTra and the tallest building in FinVora. The market floor and company research live on the lower levels.',
    services: ['aft-investor', 'careers', 'market-board'],
  },
  {
    id: 'job-centre', name: 'FinVora Job Centre', short: 'JOB CENTRE', style: 'glass',
    x: 50, z: -100, w: 24, d: 20, h: 22, color: 0x2a4a5e, accent: 0x5aa9e6, door: '+z',
    blurb: 'Find a job, see your payslip and learn where your salary goes: PF, TDS and professional tax.',
    services: ['jobs'],
  },
  {
    id: 'credit-bureau', name: 'FinVora Credit Bureau', short: 'CREDIT BUREAU', style: 'block',
    x: -50, z: -100, w: 22, d: 20, h: 16, color: 0x3d4656, accent: 0x2fbf71, door: '+z',
    blurb: 'Check your credit score for free, see what raises or lowers it, and review every loan and card on your report.',
    services: ['credit-report', 'bank-accounts'],
  },
  {
    id: 'supermart', name: 'FinVora SuperMart', short: 'SUPERMART', style: 'block',
    x: 100, z: 100, w: 28, d: 22, h: 10, color: 0xc9643c, accent: 0xf0c868, door: '-z',
    blurb: 'Groceries, household shopping and your monthly bills. Choose a grocery plan and how you pay.',
    services: ['supermart'],
  },
  {
    id: 'fuel-station', name: 'FinVora Fuels and EV Charging', short: 'FUEL · EV', style: 'pump',
    x: -100, z: -50, w: 8, d: 7, h: 4.5, color: 0xe8e4da, accent: 0xe5534b, door: '+x',
    blurb: 'Petrol, CNG and EV fast charging. Park your vehicle under the canopy and fill up.',
    services: ['fuel-station'],
  },
];

// Block uses (block centre coordinates). The 5 × 5 core is hand-placed; the two outer rings are generated.
const CORE = {
  residential: [[-100, -100], [-100, 50], [100, 50], [-50, 100], [50, 100]],
  parks: [[100, -100]],
  bazaar: [[0, 100]],
};
const LANDMARKS = { lake: [[-150, 150]], stadium: [[150, 150]] };
const RING = [-200, -150, -100, -50, 0, 50, 100, 150, 200];
const extra = { residential: [], parks: [], business: [] };
const taken = (x, z) => [...Object.values(CORE), ...Object.values(LANDMARKS)].some((l) => l.some(([a, b]) => a === x && b === z)) || BUILDINGS.some((b) => Math.abs(b.x - x) < 25 && Math.abs(b.z - z) < 25);
for (const x of RING) for (const z of RING) {
  if (Math.max(Math.abs(x), Math.abs(z)) <= 100 || taken(x, z)) continue;
  const k = ((x * 7 + z * 13) / 50 + 100) % 9; // deterministic variety
  if (z <= -150 || (x >= 150 && z <= 50)) extra[k < 1.5 ? 'parks' : 'business'].push([x, z]);
  else extra[k < 2 ? 'parks' : 'residential'].push([x, z]);
}
export const DISTRICTS = {
  residential: [...CORE.residential, ...extra.residential],
  parks: [...CORE.parks, ...extra.parks],
  bazaar: CORE.bazaar,
  business: extra.business,
  ...LANDMARKS,
};

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
