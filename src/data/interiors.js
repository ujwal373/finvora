// Walk-in interiors. Each counter is staffed by its named agent during office hours (9 am to 6 pm in game
// time) and by a desk colleague the rest of the day, so every service works around the clock.
// `services` are the screens that open at the counter (see ui/Services.js and ui/LifeServices.js).

export const OFFICE_HOURS = [9, 18];
export const onDuty = (hour) => hour >= OFFICE_HOURS[0] && hour < OFFICE_HOURS[1];

export const INTERIORS = {
  tower: {
    building: 'accofintra-hq', title: 'AccoFinTra Tower · Service Hall', w: 52, d: 36, h: 7.5, theme: 'tower', token: 'A',
    counters: [
      // back wall (north), left to right
      { id: 'mutual-fund', name: 'Mutual Funds', agent: 'mf-advisor', accent: 0x2fbf71, services: ['mf-invest', 'calc:lumpsum', 'calc:swp'], blurb: 'Invest a lump sum in AccoFinTra funds, track NAVs and redeem.' },
      { id: 'sip-desk', name: 'SIP Desk', agent: 'sip-coach', accent: 0x58c48b, services: ['mf-sip', 'calc:sip', 'calc:stepup'], blurb: 'Start, step up or stop SIPs.' },
      { id: 'bonds-fno', name: 'Bonds and Derivatives', agent: 'etf-specialist', accent: 0x5aa9e6, services: ['bond-desk', 'fno', 'calc:bond', 'calc:option'], blurb: 'G-Secs, T-bills and corporate bonds on one side; futures and options paper trading on the other.' },
      { id: 'commodities', name: 'Gold and Commodities', agent: null, accent: 0xf0c868, services: ['gold-desk', 'commodity-board'], blurb: 'Digital gold and silver, Sovereign Gold Bonds and commodity prices.' },
      { id: 'research', name: 'Research and IPOs', agent: 'analyst', accent: 0x5aa9e6, services: ['results', 'ipo', 'company-research'], blurb: 'Quarterly results, analyst views and the IPO desk.' },
      { id: 'govt-savings', name: 'Small Savings', agent: 'savings-agent', accent: 0xe5534b, services: ['govt-schemes', 'calc:ppf'], blurb: 'PPF, NSC, SCSS and Sukanya Samriddhi.' },
      // east wall
      { id: 'insurance', name: 'Insurance', agent: 'insurance-consultant', accent: 0x9b7fd4, services: ['insurance-desk', 'calc:cover'], blurb: 'Term, health and motor cover.' },
      { id: 'retirement', name: 'Retirement and EPF', agent: 'retirement-planner', accent: 0x2fbf71, services: ['epf', 'nps', 'calc:retirement', 'calc:epf'], blurb: 'EPF, NPS and annuities.' },
      { id: 'tax-office', name: 'Tax Desk', agent: 'tax-consultant', accent: 0xd4a846, services: ['tax-filing', 'holding-periods'], blurb: 'Compare regimes, file your return and see your capital gains.' },
      { id: 'real-estate', name: 'Property and REITs', agent: null, accent: 0xb5563c, services: ['property', 'calc:rental'], blurb: 'Buy, rent or sell homes and invest in a REIT.' },
      { id: 'job-centre', name: 'Jobs and Budgeting', agent: 'budget-coach', accent: 0xf08a3c, services: ['jobs', 'calc:budget'], blurb: 'Find a job, read your payslip and plan your budget.' },
      // west wall
      { id: 'credit-bureau', name: 'Credit Bureau', agent: null, accent: 0x2fbf71, services: ['credit-report'], blurb: 'Your credit score and report, free to check.' },
      { id: 'fintech', name: 'FinTech and Cyber Safety', agent: 'cyber-officer', accent: 0x5aa9e6, services: ['kyc-upi', 'scam-lab', 'link-lab'], blurb: 'KYC, UPI, the scam lab and link safety.' },
      { id: 'academy', name: 'Financial Academy', agent: 'professor', accent: 0xd4a846, desk: 'academy-desk', services: ['courses', 'doubling-lab', 'journal', 'calc:inflation', 'calc:cagr'], blurb: 'Courses, certificates and money maths.' },
      { id: 'calc-centre', name: 'Calculators', agent: null, accent: 0xf0c868, services: ['all-calcs'], blurb: 'Every FinVora calculator with its formula.' },
      { id: 'aft-ir', name: 'AccoFinTra Investor Relations', agent: null, accent: 0xd4a846, services: ['aft-investor', 'careers', 'market-board'], blurb: 'AccoFinTra results, dividends, the AGM letter and careers.' },
    ],
  },
  bank: {
    building: 'bank', title: 'FinVora Bank · Banking Hall', w: 34, d: 24, h: 7, theme: 'bank', token: 'B',
    counters: [
      { id: 'bank-accounts', name: 'Accounts, UPI and Cards', agent: 'card-counsellor', accent: 0x2fbf71, services: ['bank-accounts', 'credit-report', 'calc:card'], blurb: 'Savings, debit card, UPI and credit card.' },
      { id: 'bank-deposits', name: 'Fixed and Recurring Deposits', agent: 'deposits-officer', accent: 0x16a085, services: ['bank-deposits', 'calc:fd', 'calc:rd'], blurb: 'Open or break FDs and RDs.' },
      { id: 'bank-loans', name: 'Loans', agent: 'loan-officer', accent: 0x3d5a80, services: ['bank-loans', 'calc:emi'], blurb: 'Personal loans priced by your credit score, EMI maths.' },
      { id: 'bank-manager', name: 'Manager\'s Cabin', agent: 'bank-manager', accent: 0xd4a846, desk: 'bank-desk', services: ['interest-wall', 'calc:fd', 'calc:emi'], blurb: 'The interest wall and a chat with the manager.' },
    ],
  },
  exchange: {
    building: 'stock-exchange', title: 'FinVora Stock Exchange · Trading Hall', w: 46, d: 34, h: 11, theme: 'exchange', token: 'E',
    counters: [
      { id: 'trading', name: 'Share Trading', agent: 'stock-broker', accent: 0xd4a846, desk: 'exchange-desk', services: ['trade-stocks', 'market-board'], blurb: 'Buy and sell shares of the eight listed FinVora companies.' },
      { id: 'etf-desk', name: 'ETFs', agent: null, accent: 0x5aa9e6, services: ['trade-etfs'], blurb: 'Index, gold, silver and liquid ETFs.' },
      { id: 'listings', name: 'Listings and IPOs', agent: null, accent: 0x2fbf71, services: ['ipo', 'company-research'], blurb: 'Bid for IPOs and read company fundamentals.' },
    ],
  },
  mall: {
    building: 'mall', title: 'FinVora Central Mall · Atrium', w: 50, d: 40, h: 12, theme: 'mall', token: 'M',
    counters: [
      { id: 'mall-tech', name: 'TechNova Electronics', agent: null, accent: 0x5aa9e6, services: ['electronics', 'calc:emi'], blurb: 'Phones and laptops: pay in full, on a credit card, or on "no-cost EMI" (and see what it really costs).' },
      { id: 'mall-fashion', name: 'Urban Thread Fashion', agent: null, accent: 0xc0577a, services: ['clothing-store'], blurb: 'Outfits and accessories for your avatar.' },
      { id: 'mall-food', name: 'Food Court', agent: null, accent: 0xf08a3c, services: ['food-court'], blurb: 'Quick meals, coffee and the true yearly cost of a daily habit.' },
      { id: 'mall-books', name: 'BookNook', agent: null, accent: 0x2fbf71, services: ['bookstore'], blurb: 'Personal-finance books: the cheapest high-return purchase in the mall.' },
      { id: 'mall-atm', name: 'FinVora Bank ATM and Help Desk', agent: null, accent: 0x2fbf71, services: ['bank-accounts'], blurb: 'Check your balance, set up UPI and cards.' },
    ],
  },
  cinema: {
    building: 'cinema', title: 'Cineplex FinVora · Lobby', w: 40, d: 30, h: 9, theme: 'cinema', token: 'C',
    counters: [
      { id: 'cine-tickets', name: 'Box Office', agent: null, accent: 0xe5534b, services: ['cinema-tickets'], blurb: 'Book seats for today\'s shows.' },
      { id: 'cine-snacks', name: 'Popcorn and Snacks', agent: null, accent: 0xf0c868, services: ['cinema-snacks'], blurb: 'Combos, and what they cost you over a year of movie nights.' },
    ],
  },
  home: { building: 'home', title: 'Your Home', w: 22, d: 16, h: 3.2, theme: 'home', counters: [] },
};

/** Which interior and counter each named agent works at. */
export const AGENT_COUNTER = {};
for (const [key, def] of Object.entries(INTERIORS)) for (const c of def.counters) if (c.agent) AGENT_COUNTER[c.agent] = { interior: key, counter: c.id, name: c.name };
/** Where each moved service now lives. */
export const COUNTER_OF_SERVICE_BUILDING = {};
for (const c of INTERIORS.tower.counters) COUNTER_OF_SERVICE_BUILDING[c.id] = c.id;

// Desk colleagues who cover counters outside office hours or where no named agent is assigned.
export const COLLEAGUE_LOOKS = [
  { skin: 0xc08a64, shirt: 0xf2f2ee, pants: 0x23303f, hair: 0x15110d, hairStyle: 'short', accessory: 'badge', top: 'shirt' },
  { skin: 0xa77450, shirt: 0x3d5a80, pants: 0x22262c, hair: 0x1a120c, hairStyle: 'bun', accessory: 'badge', top: 'shirt' },
  { skin: 0xd1a27c, shirt: 0xe8e4da, pants: 0x1c2333, hair: 0x241811, hairStyle: 'bob', accessory: 'badge', top: 'shirt' },
  { skin: 0x8f5d3c, shirt: 0x2a3340, pants: 0x1a1d22, hair: 0x0d0d0d, hairStyle: 'short', accessory: 'tie', top: 'suit', outer: 0x2a3340 },
];
