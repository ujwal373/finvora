// FinVora daily life: jobs and salary, banking (cards, UPI, credit score), bonds, gold, derivatives,
// insurance, property, tax filing, company results, IPOs, dividends, bills and fuel.
//
// These are methods mixed into Finance.prototype (see the bottom of Finance.js). All state lives in
// `this.life` so it saves with the wallet. Everything is simulated money. Real rules are used where the
// note says so; everything marked "illustrative" is a made-up but realistic number.

import { COMPANIES, FUNDS, ETFS } from './Market.js';
import { carById, FUEL, DRIVE_SCALE, INSURANCE_PCT } from '../data/shop.js';
import { FinError, addDays, addMonths, daysBetween, yearsBetween, parseDate, fyOf, emi } from './Finance.js';

const SCORE_CACHE = new WeakMap();
const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isWeekday = (s) => { const w = parseDate(s).getUTCDay(); return w !== 0 && w !== 6; };
const isMonthEnd = (s) => parseDate(addDays(s, 1)).getUTCDate() === 1;
const fyEnd = (fy) => `${Number(fy.slice(0, 4)) + 1}-03-31`;
const fyDue = (fy) => `${Number(fy.slice(0, 4)) + 1}-07-31`;

// ---------------------------------------------------------------- catalogues
// Courses: certificates unlock some jobs and derivatives trading (like a broker's risk disclosure).
export const COURSES = [
  { id: 'money', title: 'Money Basics', reward: 2000, qs: [
    ['Your take-home pay is ₹50,000. The 50/30/20 rule suggests saving about…', ['₹10,000', '₹5,000', '₹25,000', '₹1,000'], 0],
    ['How many months of expenses is a common emergency-fund target?', ['3 to 6', 'Half a month', '24', 'None, use a credit card'], 0],
    ['Inflation is 6% a year. Money in a locker for one year…', ['Buys about 6% less', 'Buys 6% more', 'Is unaffected', 'Doubles'], 0],
    ['Which is a "need" rather than a "want"?', ['Rent', 'A new phone every year', 'Concert tickets', 'A sports car'], 0],
    ['The Rule of 72 at 8% a year doubles money in about…', ['9 years', '72 years', '3 years', '20 years'], 0]] },
  { id: 'banking', title: 'Banking and Credit', reward: 2000, qs: [
    ['A credit card bill paid in full by the due date costs…', ['No interest', '3.5% a month', '18% a year', 'A late fee'], 0],
    ['Paying only the minimum due on a card means…', ['Interest is charged on the unpaid balance', 'No interest at all', 'The card is closed', 'Your score jumps'], 0],
    ['Credit scores in India (like CIBIL) range from…', ['300 to 900', '0 to 100', '1 to 10', '500 to 1,000'], 0],
    ['Using more than about 30% of your card limit usually…', ['Lowers your score', 'Raises your score', 'Has no effect', 'Closes the card'], 0],
    ['A missed EMI is…', ['Reported to credit bureaus and hurts your score', 'Ignored after a month', 'Good for your score', 'Only a bank matter'], 0]] },
  { id: 'investing', title: 'Investing Basics', reward: 2500, qs: [
    ['Owning a share means owning…', ['A small part of a company', 'A loan to the company', 'A fixed deposit', 'A government bond'], 0],
    ['Diversification mainly reduces…', ['Company-specific risk', 'All risk completely', 'Taxes', 'Inflation'], 0],
    ['When interest rates rise, existing bond prices usually…', ['Fall', 'Rise', 'Stay fixed', 'Double'], 0],
    ['Long-term capital gains on listed shares are taxed at 12.5% above…', ['₹1.25 lakh a year', '₹10 lakh', '₹50,000', 'Nothing, always'], 0],
    ['A higher potential return usually comes with…', ['Higher risk', 'A guarantee', 'Lower risk', 'No tax'], 0]] },
  { id: 'funds', title: 'Mutual Funds', reward: 2500, qs: [
    ['NAV stands for…', ['Net Asset Value', 'New Account Value', 'Net Annual Volume', 'National Asset Vault'], 0],
    ['A SIP invests…', ['A fixed amount at regular intervals', 'Only once', 'Only in FDs', 'Only when markets fall'], 0],
    ['ELSS funds have a lock-in of…', ['3 years', '1 month', '15 years', 'None'], 0],
    ['The expense ratio is…', ['A yearly fee taken from the fund', 'A one-time joining fee', 'Your tax rate', 'The exit load'], 0],
    ['An index fund tries to…', ['Match an index at low cost', 'Beat the market every year', 'Guarantee returns', 'Avoid all shares'], 0]] },
  { id: 'tax', title: 'Tax Basics', reward: 2000, qs: [
    ['Under the new regime for FY 2026-27, income up to this is effectively tax free after the rebate:', ['₹12 lakh', '₹2.5 lakh', '₹5 lakh', '₹20 lakh'], 0],
    ['The standard deduction for salaried people in the new regime is…', ['₹75,000', '₹50,000', '₹1.5 lakh', 'Nil'], 0],
    ['Which regime allows the ₹1.5 lakh deduction for PPF, ELSS and EPF?', ['Old regime', 'New regime', 'Both', 'Neither'], 0],
    ['The usual due date for filing a salaried person\'s return is…', ['31 July', '31 March', '1 January', '15 August'], 0],
    ['TDS on salary means…', ['Your employer deducts tax every month', 'You pay no tax', 'Tax on dividends only', 'A bank fee'], 0]] },
  { id: 'insurance', title: 'Insurance and Risk', reward: 2000, qs: [
    ['Term insurance pays out…', ['Only if the insured person dies during the term', 'Every year', 'At maturity always', 'For car damage'], 0],
    ['A common rule of thumb for life cover is…', ['10 to 15 times yearly income', '1 month of salary', '₹10,000', 'Your car price'], 0],
    ['Health insurance policies usually have an initial waiting period of…', ['30 days for illness', '10 years', 'None', '1 day'], 0],
    ['A zero-depreciation car add-on means…', ['Parts are paid without deducting depreciation', 'The car never loses value', 'No premium', 'Free fuel'], 0],
    ['Insurance is mainly for…', ['Protection, not investment', 'Getting rich quickly', 'Avoiding all tax', 'Trading'], 0]] },
  { id: 'safety', title: 'Scams and Cyber Safety', reward: 2000, qs: [
    ['To RECEIVE money on UPI you need to enter your PIN…', ['Never', 'Always', 'Twice', 'Only at night'], 0],
    ['A bank will ask for your OTP on a phone call…', ['Never', 'Often', 'For KYC', 'For refunds'], 0],
    ['A link "finvora-bank.secure-login.xyz" is most likely…', ['A phishing site', 'The real bank', 'A government site', 'Safe'], 0],
    ['"Guaranteed 5% a day" investment offers are…', ['Almost always scams', 'Normal returns', 'Regulated deposits', 'Government schemes'], 0],
    ['In India, report cyber fraud quickly by calling…', ['1930', '100100', '911', '1800 FREE CASH'], 0]] },
  { id: 'derivatives', title: 'Derivatives Risk', reward: 3000, qs: [
    ['A SEBI study found that in FY22 to FY24 individual F&O traders who lost money were about…', ['9 in 10', '1 in 10', 'Half', 'None'], 0],
    ['A futures position can lose…', ['More than the margin you put in', 'At most the premium', 'Nothing', 'Only the brokerage'], 0],
    ['The most an option BUYER can lose is…', ['The premium paid', 'Unlimited', 'The lot value', 'Nothing'], 0],
    ['A lot size of 75 means one contract covers…', ['75 units of the underlying', '₹75', '75 contracts', '75 days'], 0],
    ['Options lose value as expiry approaches because of…', ['Time decay', 'Dividends', 'Stamp duty', 'Inflation only'], 0]] },
];
export const courseById = Object.fromEntries(COURSES.map((c) => [c.id, c]));

// Jobs (fictional employers). gross = monthly CTC-style gross salary. Basic is 50% of gross.
export const JOBS = [
  { id: 'delivery', title: 'Delivery Partner', employer: 'ZipDrop (gig app)', gross: 26000, gig: true, needs: [], desc: 'Paid per delivery as a contractor. No PF, no TDS: you handle your own tax.' },
  { id: 'retail', title: 'Store Associate', employer: 'FinVora SuperMart', gross: 22000, needs: [], desc: 'Entry-level salaried job with PF.' },
  { id: 'teacher', title: 'School Teacher', employer: 'FinVora Public School', gross: 42000, needs: [], desc: 'Steady salary and PF.' },
  { id: 'nurse', title: 'Staff Nurse', employer: 'Star Pharma Hospital', gross: 45000, needs: [], desc: 'Shift work, steady salary and PF.' },
  { id: 'bank', title: 'Bank Officer', employer: 'JP Mojidra Bank', gross: 52000, needs: ['banking'], desc: 'Needs the Banking and Credit certificate from the Academy counter in AccoFinTra Tower.' },
  { id: 'developer', title: 'Software Developer', employer: 'Mojidra Tech', gross: 110000, needs: ['money'], desc: 'High salary. Needs the Money Basics certificate.' },
  { id: 'analyst', title: 'Financial Analyst', employer: 'AccoFinTra', gross: 95000, needs: ['investing', 'funds'], desc: 'Research job at AccoFinTra Tower. Needs Investing Basics and Mutual Funds certificates.' },
  { id: 'manager', title: 'Operations Manager', employer: 'Mama Motors', gross: 140000, needs: ['money', 'tax'], desc: 'Senior role. Needs Money Basics and Tax Basics certificates.' },
];
export const jobById = Object.fromEntries(JOBS.map((j) => [j.id, j]));

// Bonds. Face value ₹1,000 each. Yields move with the simulated government bond yield.
export const BONDS = [
  { code: 'GS31', name: '6.90% Govt of India 2031', issuer: 'Government of India', rating: 'Sovereign', coupon: 0.069, years: 5, spread: -0.002, pd: 0 },
  { code: 'GS36', name: '7.10% Govt of India 2036', issuer: 'Government of India', rating: 'Sovereign', coupon: 0.071, years: 10, spread: 0, pd: 0 },
  { code: 'AFT30', name: 'AccoFinTra Capital 8.25% NCD 2030', issuer: 'AccoFinTra Capital', rating: 'AAA', coupon: 0.0825, years: 4, spread: 0.012, pd: 0 },
  { code: 'JPM29', name: 'JP Mojidra Bank 8.00% Bond 2029', issuer: 'JP Mojidra Bank', rating: 'AAA', coupon: 0.08, years: 3, spread: 0.011, pd: 0 },
  { code: 'MMA29', name: 'Mama Motors Finance 9.40% NCD 2029', issuer: 'Mama Motors Finance', rating: 'AA', coupon: 0.094, years: 3, spread: 0.025, pd: 0.004 },
  { code: 'BLU28', name: 'BLU Energy 11.75% NCD 2028', issuer: 'BLU Energy', rating: 'BBB', coupon: 0.1175, years: 2, spread: 0.05, pd: 0.03 },
  { code: 'MOJI28', name: 'MOJI Telecom 13.50% NCD 2028', issuer: 'MOJI Telecom', rating: 'BB', coupon: 0.135, years: 2, spread: 0.07, pd: 0.08 },
];
export const TBILLS = [{ code: 'TB91', name: '91-day Treasury Bill', days: 91, spread: -0.006 }, { code: 'TB182', name: '182-day Treasury Bill', days: 182, spread: -0.005 }, { code: 'TB364', name: '364-day Treasury Bill', days: 364, spread: -0.004 }];
export const bondByCode = Object.fromEntries([...BONDS, ...TBILLS].map((b) => [b.code, b]));

// Derivatives underlyings. Lot sizes are fixed when the game starts.
export const FNO = [{ u: 'FV8', name: 'FinVora 8 Index', lot: 75, vol: 0.15, step: 100 },
  ...['AFT', 'JPM', 'MJDR', 'MMA'].map((s) => { const c = COMPANIES.find((x) => x.symbol === s); return { u: s, name: c.name, lot: Math.max(25, Math.round(500000 / c.price / 25) * 25), vol: c.vol, step: c.price > 1500 ? 50 : c.price > 500 ? 20 : 10 }; })];

export const PROPERTIES = [
  { id: '1bhk', name: '1 BHK, Lakeview Residency', price: 4500000, rent: 22000, maint: 3000, area: 450 },
  { id: '2bhk', name: '2 BHK, Tower Heights', price: 9000000, rent: 38000, maint: 5000, area: 780 },
  { id: '3bhk', name: '3 BHK, Stadium View', price: 16500000, rent: 65000, maint: 8000, area: 1250 },
  { id: 'shop', name: 'Shop unit, FinVora Bazaar', price: 6000000, rent: 32000, maint: 2500, area: 300 },
];
export const propById = Object.fromEntries(PROPERTIES.map((p) => [p.id, p]));
export const HOME_LOAN = { rate: 0.085, maxMonths: 360 };
export const ltvMax = (price) => (price <= 3000000 ? 0.9 : price <= 7500000 ? 0.8 : 0.75); // RBI loan-to-value caps

export const LIFESTYLES = { basic: { name: 'Basic', groceries: 4500 }, standard: { name: 'Standard', groceries: 7500 }, premium: { name: 'Premium', groceries: 12000 } };
// IPO names are invented fresh every time from these parts (all fictional; never repeated in a save).
const IPO_PRE = ['Aarav', 'Shivam', 'Navya', 'Kaveri', 'Tarang', 'Vistaar', 'Nimbus', 'Konkan', 'Sahyog', 'Pragati', 'Indravati', 'Saffron', 'Meru', 'Ganga', 'Narmada', 'Vayu', 'Agni', 'Prithvi', 'Akash', 'Sarthi', 'Anant', 'Utkarsh', 'Samarth', 'Disha', 'Lakshya', 'Varun', 'Sanjivani', 'Kalpa', 'Tapti', 'Nilgiri', 'Aravali', 'Sahyadri', 'Chinar', 'Kesari', 'Mayur', 'Neelkanth', 'Pushpak', 'Rudra', 'Shaurya', 'Vihaan'];
const IPO_SECTORS = [['Logistics', 'Logistics'], ['Green Power', 'Renewable energy'], ['Agro Foods', 'Agriculture'], ['Payments', 'Fintech'], ['Care Hospitals', 'Healthcare'], ['Textiles', 'Textiles'], ['Data Centres', 'Technology'], ['Ports', 'Infrastructure'], ['Housing Finance', 'Financial services'], ['Lifesciences', 'Pharmaceuticals'], ['EV Motors', 'Automobiles'], ['Cement', 'Materials'], ['Retail', 'Consumer'], ['Softworks', 'Technology'], ['Solar', 'Renewable energy'], ['Speciality Chemicals', 'Chemicals'], ['Steel Tubes', 'Metals'], ['Snacks and Foods', 'FMCG'], ['Air Cargo', 'Aviation'], ['Hotels and Resorts', 'Hospitality'], ['Microfinance', 'Financial services'], ['Defence Systems', 'Capital goods'], ['Electronics', 'Electronics manufacturing'], ['Gaming', 'Media']];
const DIV_MONTH = { AFT: 7, STR: 6, JPM: 5, MMA: 6, SMNI: 8, MJDR: 9 }; // record date: 15th of this month (0 = Jan)

// ---------------------------------------------------------------- maths
const N = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
export function bsPrice(type, S, K, T, vol, r = 0.065) {
  if (T <= 0) return Math.max(0, type === 'call' ? S - K : K - S);
  const d1 = (Math.log(S / K) + (r + vol * vol / 2) * T) / (vol * Math.sqrt(T)), d2 = d1 - vol * Math.sqrt(T);
  return type === 'call' ? S * N(d1) - K * Math.exp(-r * T) * N(d2) : K * Math.exp(-r * T) * N(-d2) - S * N(-d1);
}
export function bondPrice(face, coupon, yld, years) {
  const n = Math.max(0, Math.round(years * 2)), c = face * coupon / 2, y = yld / 2;
  if (n === 0) return face;
  let p = 0; for (let k = 1; k <= n; k++) p += c / (1 + y) ** k;
  return p + face / (1 + y) ** n;
}
/** Last Tuesday of the month of `date` (string). */
export function lastTuesday(date) {
  const d = parseDate(date); const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  while (end.getUTCDay() !== 2) end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

// Tax: FY 2026-27 slabs (unchanged by Budget 2026). Surcharge for incomes above ₹50 lakh is not simulated.
export function slabTaxNew(income) {
  const slabs = [[400000, 0], [800000, 0.05], [1200000, 0.1], [1600000, 0.15], [2000000, 0.2], [2400000, 0.25], [Infinity, 0.3]];
  let tax = 0, prev = 0; for (const [cap, rate] of slabs) { if (income > prev) tax += (Math.min(income, cap) - prev) * rate; prev = cap; }
  if (income <= 1200000) return 0; // rebate
  return Math.min(tax, income - 1200000); // marginal relief just above ₹12 lakh
}
export function slabTaxOld(income, age = 30) {
  const ex = age >= 80 ? 500000 : age >= 60 ? 300000 : 250000;
  const slabs = [[ex, 0], [500000, 0.05], [1000000, 0.2], [Infinity, 0.3]];
  let tax = 0, prev = 0; for (const [cap, rate] of slabs) { if (income > prev) tax += (Math.min(income, cap) - prev) * rate; prev = cap; }
  return income <= 500000 ? 0 : tax;
}


// ---------------------------------------------------------------- city life (round 10): gym, hospital, pharmacy, school, gadgets
export const GYM_PLANS = { monthly: { name: 'Monthly', price: 1800, days: 30 }, quarterly: { name: 'Quarterly', price: 4800, days: 91 }, annual: { name: 'Annual', price: 14000, days: 365 } };
export const HOSPITAL = {
  opd: { name: 'Doctor consultation (OPD)', price: 800, covered: false, note: 'Outpatient consultations are usually not covered by a basic health policy.' },
  checkup: { name: 'Full-body health check-up', price: 3200, covered: 'checkup', note: 'Many health policies include one free preventive check-up a year.' },
  daycare: { name: 'Day-care procedure (minor surgery)', price: 38000, covered: true, note: 'Covered by health insurance after the 30-day waiting period, up to your cover.' },
};
export const MEDICINES = [
  { id: 'fever', name: 'Fever and pain tablets (strip of 15)', branded: 45, generic: 12 },
  { id: 'bp', name: 'Blood-pressure tablets, one month', branded: 620, generic: 140 },
  { id: 'vit', name: 'Vitamin D3 capsules, 8 weeks', branded: 380, generic: 110 },
  { id: 'cough', name: 'Cough syrup 100 ml', branded: 135, generic: 60 },
];
export const DIPLOMAS = [
  { id: 'dfp', name: 'Diploma in Financial Planning', fee: 60000, months: 6, skill: 'Plan budgets, insurance and investments for families.' },
  { id: 'dda', name: 'Diploma in Data Analytics', fee: 90000, months: 9, skill: 'Spreadsheets, SQL and dashboards for business.' },
  { id: 'cbm', name: 'Certificate in Small Business Management', fee: 45000, months: 4, skill: 'Costing, GST basics and running a shop.' },
];
export const EDU_LOAN = { rate: 0.105, months: 24 };
export const GADGETS = [
  { id: 'phone', name: 'Nova X5 smartphone', price: 32000 },
  { id: 'laptop', name: 'Nova Book 14 laptop', price: 68000 },
  { id: 'tv', name: 'Nova Vision 55-inch TV', price: 46000 },
];
export const NO_COST_EMI = { months: 6, fee: 199, cashDiscount: 0.075, gst: 0.18, hiddenRate: 0.15 };

// ---------------------------------------------------------------- the mixin
export const LIFE_METHODS = {
  _initLife() {
    const L = (this.life ||= {});
    L.v ||= 1;
    L.seed ??= 0x5eed1234;
    L.job ??= null; L.jobHistory ||= []; L.regime ||= 'new'; L.unemployedSince ??= this.date;
    L.epf ||= { balance: 0, accrued: 0, eps: 0 };
    L.kyc ??= null; L.payMethod ||= 'debit'; L.upiDay ||= { date: '', spent: 0 };
    L.card ??= null; L.scoreHist ||= [];
    L.gsec ??= 0.065; L.bonds ||= {}; L.tbills ||= []; L.defaulted ||= {};
    L.gold ||= { grams: 0, cost: 0, lots: [] }; L.silver ||= { grams: 0, cost: 0, lots: [] }; L.sgb ||= [];
    L.fno ||= [];
    L.policies ||= [];
    L.props ||= []; L.renting ??= null; L.propIdx ??= 1; L.reit ||= { price: 330, lots: [], hist: [330] };
    L.fy ||= {}; L.gains ||= []; L.filed ||= {};
    L.results ||= {}; L.ipo ??= null; L.ipoHold ||= []; L.ipoCount ||= 0; L.nextIpo ||= addDays(this.date, 10);
    L.divs ||= []; L.agm ??= null;
    L.certs ||= {}; L.annuities ||= [];
    L.lifestyle ||= 'standard'; L.alerts ||= []; L.events ||= [];
    L.gym ??= null; L.diplomas ||= []; L.checkups ||= {};
    if (!Object.keys(L.results).length) for (const c of COMPANIES) L.results[c.symbol] = [{ q: 'FY26 Q4', revenue: r2(c.revenue / 4), profit: r2(c.profit / 4), growth: 0, date: this.start }];
    for (const g of this.garage || []) g.fuel ??= 0.6;
  },

  _rand() { const L = this.life; let t = (L.seed = (L.seed + 0x6d2b79f5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; },
  _gauss() { const u = Math.max(1e-9, this._rand()), v = this._rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
  _alert(text, kind = 'info') { const a = this.life.alerts; a.push({ date: this.date, text, kind }); if (a.length > 40) a.shift(); this.life.events.push({ text, kind }); },
  /** New alerts since the game last asked (the HUD shows them as toasts). */
  takeEvents() { const e = this.life.events; this.life.events = []; return e; },
  _fy(fy = fyOf(this.date)) { return (this.life.fy[fy] ||= { salary: 0, tds: 0, epfEmp: 0, pt: 0, interest: 0, dividends: 0, rent: 0, gig: 0, eqST: 0, eqLT: 0, otherLT: 0, slab: 0, homeInt: 0, homePrin: 0, health: 0, term: 0 }); },

  // ---------------------------------------------------------- paying for things
  /** Pay a merchant or bill using the chosen method. Returns the method used. */
  _spend(amount, what, { method = this.life.payMethod, force = false, type = 'spend', asset = 'cash' } = {}) {
    amount = r2(amount);
    if (method === 'card' && this.life.card?.status === 'active') {
      const c = this.life.card;
      if (c.balance + amount > c.limit + 1e-6) { if (!force) throw new FinError(`Credit card limit reached. Available ₹${Math.floor(c.limit - c.balance).toLocaleString('en-IN')}.`); method = 'debit'; }
      else { c.balance = r2(c.balance + amount); c.unbilled = r2((c.unbilled || 0) + amount); this._log({ type, asset: 'card', name: `${what} (credit card)`, amount: 0, note: `₹${amount.toLocaleString('en-IN')} added to your card bill` }); return 'card'; }
    }
    if (method === 'upi') {
      if (!this.life.kyc) { if (!force) throw new FinError('Set up UPI at the FinTech counter in AccoFinTra Tower first (KYC needed).'); method = 'debit'; }
      else {
        const u = this.life.upiDay; if (u.date !== this.date) { u.date = this.date; u.spent = 0; }
        if (u.spent + amount > 100000) { if (!force) throw new FinError('UPI limit is ₹1,00,000 a day. Use a debit card for this payment.'); method = 'debit'; }
        else u.spent += amount;
      }
    }
    if (amount > this.cash + 1e-6) {
      if (!force) throw new FinError(`Not enough balance for ${what}. Available: ₹${Math.floor(this.cash).toLocaleString('en-IN')}.`);
      return this._emergency(amount, what);
    }
    this.cash = r2(this.cash - amount);
    this._log({ type, asset, name: `${what} (${method === 'upi' ? 'UPI' : 'debit card'})`, amount: -amount });
    return method;
  },
  /** A bill you cannot avoid and cannot afford becomes an expensive emergency loan. */
  _emergency(amount, what) {
    const short = r2(amount - Math.max(0, this.cash));
    const paid = Math.max(0, this.cash); this.cash = 0;
    const loan = this._newLoan(short, 0.16, 12, 'emergency');
    this._log({ type: 'spend', asset: 'cash', name: `${what}`, amount: -paid, note: `Wallet ran short by ₹${short.toLocaleString('en-IN')}. An emergency loan ${loan.id} at 16% covers the rest.` });
    this._alert(`Your wallet ran out paying ${what}. An emergency loan of ₹${Math.round(short).toLocaleString('en-IN')} at 16% was taken.`, 'bad');
    return 'loan';
  },
  /** Bus tickets and rickshaw fares. */
  travel(amount, what, { force = false } = {}) { return this._spend(amount, what, { type: 'travel', asset: 'travel', force }); },
  setPayMethod(m) {
    if (!['upi', 'debit', 'card'].includes(m)) throw new FinError('Unknown payment method.');
    if (m === 'upi' && !this.life.kyc) throw new FinError('Complete KYC and set up UPI at the FinTech counter in AccoFinTra Tower first.');
    if (m === 'card' && this.life.card?.status !== 'active') throw new FinError('Get a credit card at the Bank first.');
    this.life.payMethod = m;
  },

  // ---------------------------------------------------------- FinTech: KYC and UPI
  completeKYC(name) {
    if (this.life.kyc) throw new FinError('KYC is already complete.');
    const nm = String(name || 'Player').trim().slice(0, 30) || 'Player';
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ', L = () => letters[Math.floor(this._rand() * letters.length)];
    const pan = `${L()}${L()}${L()}P${nm[0].toUpperCase().replace(/[^A-Z]/, 'X')}${String(1000 + Math.floor(this._rand() * 9000))}${L()}`;
    const handle = nm.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'player';
    this.life.kyc = { name: nm, pan, upi: `${handle}@finvora`, date: this.date };
    this._log({ type: 'kyc', name: 'Video KYC completed, UPI ID created', amount: 0, note: `Fictional PAN ${pan} and UPI ID ${this.life.kyc.upi}. Never type your real PAN or Aadhaar into a game.` });
    if (this.life.payMethod === 'debit') this.life.payMethod = 'upi';
  },

  // ---------------------------------------------------------- jobs and salary
  takeJob(id) {
    const j = jobById[id]; if (!j) throw new FinError('Unknown job.');
    if (this.life.job?.id === id) throw new FinError('You already work here.');
    const miss = j.needs.filter((c) => !this.life.certs[c]);
    if (miss.length) throw new FinError(`This job needs: ${miss.map((c) => courseById[c].title).join(', ')}. Earn the certificates at the Academy counter in AccoFinTra Tower.`);
    if (this.life.job) this.life.jobHistory.push({ ...this.life.job, left: this.date });
    this.life.job = { id, gross: j.gross, start: this.date, paidUpTo: this.date, raises: 0 };
    this.life.unemployedSince = null;
    this._log({ type: 'job', name: `Joined ${j.employer} as ${j.title}`, amount: 0, note: `Gross salary ₹${j.gross.toLocaleString('en-IN')} a month, paid on the last day of each month.` });
    this._alert(`Welcome to ${j.employer}! Your first salary arrives at month end.`, 'good');
  },
  quitJob() {
    const jb = this.life.job; if (!jb) throw new FinError('You do not have a job.');
    this._paySalary(true);
    this.life.jobHistory.push({ ...jb, left: this.date }); this.life.job = null; this.life.unemployedSince = this.date;
    this._log({ type: 'job', name: `Resigned from ${jobById[jb.id].employer}`, amount: 0 });
  },
  setRegime(r) { if (!['new', 'old'].includes(r)) throw new FinError('Choose new or old.'); this.life.regime = r; },
  /** A month's payslip for the current job (also used to preview). */
  payslip(gross = this.life.job?.gross, jobId = this.life.job?.id) {
    const j = jobById[jobId]; if (!j || !gross) return null;
    if (j.gig) return { gross, basic: 0, epfEmp: 0, epfEr: 0, eps: 0, pt: 0, tds: 0, net: gross, gig: true };
    const basic = gross * 0.5, epfEmp = r2(basic * 0.12), eps = r2(Math.min(basic * 0.0833, 1250)), epfEr = r2(basic * 0.12 - eps);
    const mon = parseDate(this.date).getUTCMonth(), pt = gross > 10000 ? (mon === 1 ? 300 : 200) : 0; // Maharashtra-style professional tax
    const annual = gross * 12, age = this.declaredAge ?? 30;
    const est = this.life.regime === 'old'
      ? slabTaxOld(Math.max(0, annual - 50000 - 2500 - Math.min(150000, epfEmp * 12)), age)
      : slabTaxNew(Math.max(0, annual - 75000));
    const tds = r2(est * 1.04 / 12);
    return { gross, basic, epfEmp, epfEr, eps, pt, tds, net: r2(gross - epfEmp - pt - tds) };
  },
  _paySalary(partial = false) {
    const jb = this.life.job; if (!jb) return;
    const days = daysBetween(jb.paidUpTo, this.date); if (days <= 0) return;
    const frac = partial || days < 28 ? Math.min(1, days / 30) : 1;
    const ps = this.payslip(); const k = (v) => r2(v * frac);
    const fy = this._fy(), j = jobById[jb.id];
    this.cash = r2(this.cash + k(ps.net));
    if (j.gig) fy.gig += k(ps.gross); else {
      fy.salary += k(ps.gross); fy.tds += k(ps.tds); fy.epfEmp += k(ps.epfEmp); fy.pt += k(ps.pt);
      this.life.epf.balance = r2(this.life.epf.balance + k(ps.epfEmp) + k(ps.epfEr)); this.life.epf.eps = r2(this.life.epf.eps + k(ps.eps));
    }
    jb.paidUpTo = this.date;
    this._log({ type: 'salary', asset: 'cash', name: `${j.gig ? 'Payout' : 'Salary'} from ${j.employer}${frac < 1 ? ` (${Math.round(frac * 30)} days)` : ''}`, amount: k(ps.net),
      note: j.gig ? 'Gig income: no PF or TDS. Keep money aside for tax.' : `Gross ₹${k(ps.gross).toLocaleString('en-IN')} − PF ₹${k(ps.epfEmp)} − TDS ₹${k(ps.tds)} − prof. tax ₹${k(ps.pt)}` });
    this._alert(`${j.gig ? 'Payout' : 'Salary'} credited: ₹${Math.round(k(ps.net)).toLocaleString('en-IN')}`, 'good');
  },

  // ---------------------------------------------------------- EPF, annuities
  withdrawEPF() {
    const e = this.life.epf; if (!(e.balance > 0)) throw new FinError('No EPF balance.');
    const age = this.declaredAge ?? 0, out = this.life.unemployedSince && daysBetween(this.life.unemployedSince, this.date) >= 60;
    if (age < 58 && !out) throw new FinError('Full EPF withdrawal is allowed at 58, or after 2 months without a job.');
    const amt = r2(e.balance + e.accrued); e.balance = 0; e.accrued = 0; this._credit(amt);
    this._log({ type: 'epf-withdraw', asset: 'epf', name: 'EPF withdrawn', amount: amt, note: 'Tax-free after 5 years of continuous service (not tracked here).' });
  },
  _startAnnuity(corpus, source) {
    const rate = 0.065; const a = { id: `ANN${++this.seq}`, corpus: r2(corpus), monthly: r2(corpus * rate / 12), start: this.date, source };
    this.life.annuities.push(a);
    this._log({ type: 'annuity', asset: 'annuity', name: `Annuity started from ${source}`, amount: 0, note: `Pays ₹${a.monthly.toLocaleString('en-IN')} a month for life at an illustrative 6.5% a year. Pension income is taxable.` });
    return a;
  },
  buyAnnuity(amount) {
    if ((this.declaredAge ?? 0) < 60) throw new FinError('Annuities here are for age 60 and above. Set your simulation age at the Small Savings counter in AccoFinTra Tower.');
    if (amount < 100000) throw new FinError('Minimum annuity purchase is ₹1,00,000.');
    const a = this._debit(amount, 'annuity'); return this._startAnnuity(a, 'a lump sum');
  },

  // ---------------------------------------------------------- credit card and credit score
  applyCard() {
    if (this.life.card?.status === 'active') throw new FinError('You already have a credit card.');
    const sc = this.creditScore(), jb = this.life.job;
    if (sc.score !== null && sc.score < 650) throw new FinError(`Application declined: credit score ${sc.score} is below 650.`);
    let limit, secured = false;
    if (jb && !jobById[jb.id].gig) limit = Math.min(500000, Math.round(jb.gross * 3 / 5000) * 5000);
    else {
      const fd = this.fds.find((f) => f.status === 'active' && f.principal >= 20000);
      if (!fd) throw new FinError('Without a salaried job you need a secured card: open an FD of at least ₹20,000 first.');
      limit = Math.round(fd.principal * 0.9 / 1000) * 1000; secured = fd.id;
    }
    this.life.card = { status: 'active', limit, balance: 0, unbilled: 0, billed: 0, minDue: 0, due: null, paidThisCycle: 0, autopay: 'full', opened: this.date, secured, rewards: 0, statementDay: 15 };
    this._log({ type: 'card-open', asset: 'card', name: `Credit card issued${secured ? ' (secured against your FD)' : ''}`, amount: 0, note: `Limit ₹${limit.toLocaleString('en-IN')}. Statement on the 15th, due 20 days later. Interest 3.5% a month on unpaid amounts (illustrative).` });
  },
  setAutopay(mode) { if (!this.life.card) throw new FinError('No credit card.'); if (!['full', 'min', 'off'].includes(mode)) throw new FinError('Bad autopay option.'); this.life.card.autopay = mode; },
  payCard(amount) {
    const c = this.life.card; if (!c) throw new FinError('No credit card.');
    amount = r2(Math.min(amount, c.balance)); if (!(amount > 0)) throw new FinError('Nothing to pay.');
    this._debit(amount, 'card bill'); c.balance = r2(c.balance - amount); c.paidThisCycle = r2(c.paidThisCycle + amount);
    const fromBilled = Math.min(c.billed, amount); c.billed = r2(c.billed - fromBilled); c.unbilled = r2(Math.max(0, c.unbilled - (amount - fromBilled)));
    return this._log({ type: 'card-pay', asset: 'card', name: 'Credit card bill paid', amount: -amount });
  },
  closeCard() {
    const c = this.life.card; if (!c) throw new FinError('No credit card.');
    if (c.balance > 0.5) throw new FinError('Pay the full balance before closing the card.');
    c.status = 'closed'; this._log({ type: 'card-close', asset: 'card', name: 'Credit card closed', amount: 0, note: 'Closing your oldest card can shorten your credit history.' });
    if (this.life.payMethod === 'card') this.life.payMethod = this.life.kyc ? 'upi' : 'debit';
  },
  _cardDay(d, dom) {
    const c = this.life.card; if (!c || c.status !== 'active') return;
    if (dom === c.statementDay) {
      // interest on anything left unpaid from the last bill
      if (c.billed > 0.5) { const int = r2(c.billed * 0.035); c.balance = r2(c.balance + int); this._log({ type: 'card-interest', asset: 'card', name: 'Credit card interest', amount: 0, note: `₹${int} on an unpaid ₹${Math.round(c.billed).toLocaleString('en-IN')} (3.5% a month, about 42% a year)` }); }
      const cash = r2(c.unbilled * 0.01); // 1% reward points as cashback
      if (cash > 0) { c.balance = r2(Math.max(0, c.balance - cash)); c.rewards = r2(c.rewards + cash); }
      c.unbilled = 0; c.billed = c.balance; c.minDue = c.billed > 0 ? r2(Math.max(Math.min(200, c.billed), c.billed * 0.05)) : 0; c.due = addDays(d, 20); c.paidThisCycle = 0;
      if (c.billed > 0) this._alert(`Card statement: ₹${Math.round(c.billed).toLocaleString('en-IN')} due by ${c.due}, minimum ₹${Math.round(c.minDue)}.`);
    }
    if (c.due && d === c.due) {
      if (c.autopay !== 'off' && c.billed > 0) { const want = c.autopay === 'full' ? c.billed : Math.max(0, c.minDue - c.paidThisCycle); if (want > 0 && this.cash >= want) this.payCard(want); }
      if (c.minDue > 0 && c.paidThisCycle + 0.01 < c.minDue) {
        const fee = c.billed > 10000 ? 950 : c.billed > 500 ? 500 : 0; c.balance = r2(c.balance + fee);
        this._log({ type: 'card-missed', asset: 'card', name: 'Credit card payment missed', amount: 0, note: `Late fee ₹${fee}. Reported to the credit bureau.` });
        this._alert('You missed your credit card due date. Late fee charged and your credit score fell.', 'bad');
      } else if (c.minDue > 0) this._log({ type: 'card-ontime', asset: 'card', name: c.billed < 0.5 ? 'Card bill paid in full on time' : 'Card minimum paid on time', amount: 0, note: c.billed < 0.5 ? 'No interest charged.' : 'Interest will be charged on the rest at the next statement.' });
      c.due = null;
    }
  },

  /** CIBIL-style score (300–900) worked out from your ledger. null = no credit history yet. */
  creditScore() {
    const key = this.ledger.length + ':' + (this.life.card?.balance ?? 0) + ':' + this.date;
    const cached = SCORE_CACHE.get(this); if (cached?.key === key) return cached.v;
    const credit = this.ledger.filter((e) => ['loan-take', 'card-open'].includes(e.type) || (e.type === 'car-buy' && /Car loan/.test(e.note || '')) || e.type === 'home-buy' && /home loan LN/.test(e.note || ''));
    let v;
    if (!credit.length) v = { score: null, factors: [], label: 'No credit history (NH)' };
    else {
      const ontime = this.ledger.filter((e) => e.type === 'emi' || e.type === 'card-ontime').length;
      const missed = this.ledger.filter((e) => e.type === 'emi-missed' || e.type === 'card-missed').length;
      const recent = credit.filter((e) => daysBetween(e.date, this.date) <= 365).length;
      const age = Math.floor(daysBetween(credit[0].date, this.date) / 30);
      const c = this.life.card; const util = c && c.status === 'active' && c.limit ? c.balance / c.limit : 0;
      const kinds = new Set(this.loans.filter((l) => l.status === 'active').map((l) => (l.kind === 'home' || l.kind === 'car' ? 'secured' : 'unsecured')));
      if (c?.status === 'active') kinds.add('card');
      const f = [
        ['Payment history', Math.min(ontime, 40) * 3 - missed * 45, `${ontime} on-time payment${ontime === 1 ? '' : 's'}, ${missed} missed`],
        ['Credit utilisation', util > 0.3 ? -Math.round((util - 0.3) * 220) : 10, `${Math.round(util * 100)}% of your card limit in use${util > 0.3 ? ' (keep it under 30%)' : ''}`],
        ['Recent applications', -recent * 8, `${recent} loan or card application${recent === 1 ? '' : 's'} in the last 12 months`],
        ['Credit age', Math.min(age, 84), `${age} month${age === 1 ? '' : 's'} since your first credit account`],
        ['Credit mix', kinds.size >= 2 ? 15 : 0, kinds.size >= 2 ? 'A healthy mix of credit types' : 'Only one type of credit'],
      ];
      const score = clamp(Math.round(680 + f.reduce((s, x) => s + x[1], 0)), 300, 900);
      v = { score, factors: f.map(([name, pts, text]) => ({ name, pts, text })), label: score >= 750 ? 'Excellent' : score >= 700 ? 'Good' : score >= 650 ? 'Fair' : 'Poor' };
    }
    SCORE_CACHE.set(this, { key, v });
    return v;
  },
  /** Personal loan pricing by score (illustrative). */
  loanRateFor() { const s = this.creditScore().score; if (s !== null && s < 600) return null; return s === null ? 0.14 : s >= 750 ? 0.115 : s >= 700 ? 0.13 : 0.16; },

  // ---------------------------------------------------------- bonds and T-bills
  bondYield(code) { const b = bondByCode[code]; return clamp(this.life.gsec + b.spread, 0.03, 0.3); },
  bondMaturity(code) { const b = bondByCode[code]; return addMonths(this.start, b.years * 12); },
  bondPriceNow(code) {
    const b = bondByCode[code]; if (this.life.defaulted[code]) return 0;
    const left = Math.max(0, daysBetween(this.date, this.bondMaturity(code)) / 365);
    return r2(bondPrice(1000, b.coupon, this.bondYield(code), left));
  },
  tbillPrice(code) { const t = bondByCode[code]; return r2(1000 / (1 + this.bondYield(code) * t.days / 365)); },
  buyBond(code, qty) {
    const b = bondByCode[code]; if (!b) throw new FinError('Unknown bond.');
    if (!Number.isInteger(qty) || qty < 1) throw new FinError('Buy at least 1 bond (₹1,000 face value each).');
    if (b.days) {
      const price = this.tbillPrice(code), amt = this._debit(price * qty, b.name);
      const t = { id: `TB${++this.seq}`, code, qty, price, date: this.date, maturity: addDays(this.date, b.days) };
      this.life.tbills.push(t);
      return this._log({ type: 'bond-buy', asset: 'bond', code, name: b.name, qty, price, amount: -amt, flow: -amt, note: `Pays ₹${(qty * 1000).toLocaleString('en-IN')} on ${t.maturity}. The discount is your interest.` });
    }
    if (this.life.defaulted[code]) throw new FinError('This issuer has defaulted. Trading is suspended.');
    if (this.date >= this.bondMaturity(code)) throw new FinError('This bond has matured.');
    const price = this.bondPriceNow(code), amt = this._debit(price * qty, b.name);
    (this.life.bonds[code] ||= []).push({ date: this.date, qty, price });
    this._emit({ type: 'trade' });
    return this._log({ type: 'bond-buy', asset: 'bond', code, name: b.name, qty, price, amount: -amt, flow: -amt, note: `Yield ${(this.bondYield(code) * 100).toFixed(2)}%, rating ${b.rating}` });
  },
  bondQty(code) { return (this.life.bonds[code] || []).reduce((s, l) => s + l.qty, 0); },
  sellBond(code, qty) {
    const b = bondByCode[code]; const lots = this.life.bonds[code] || [];
    if (!Number.isInteger(qty) || qty < 1 || qty > this.bondQty(code)) throw new FinError(`You hold ${this.bondQty(code)} of these bonds.`);
    if (this.life.defaulted[code]) throw new FinError('This issuer has defaulted. Trading is suspended.');
    const price = r2(this.bondPriceNow(code) * 0.995); // dealers buy slightly below the quoted price
    let left = qty, cost = 0; const used = [];
    while (left > 0) { const l = lots[0], t = Math.min(l.qty, left); cost += t * l.price; used.push({ ...l, qty: t }); l.qty -= t; left -= t; if (!l.qty) lots.shift(); }
    const amt = r2(price * qty); this._credit(amt);
    this._recordGain(code, b.name, used, price, 'bond');
    this._emit({ type: 'trade' });
    return this._log({ type: 'bond-sell', asset: 'bond', code, name: b.name, qty, price, amount: amt, flow: amt, pl: r2(amt - cost) });
  },
  _bondDay(d) {
    const L = this.life;
    if (isWeekday(d)) L.gsec = clamp(L.gsec + (0.065 - L.gsec) * 0.004 + this._gauss() * 0.0006, 0.045, 0.09);
    for (const b of BONDS) {
      const lots = L.bonds[b.code]; const qty = (lots || []).reduce((s, l) => s + l.qty, 0);
      if (L.defaulted[b.code]) continue;
      if (b.pd && this._rand() < b.pd / 365) {
        L.defaulted[b.code] = d;
        if (qty) { const rec = r2(qty * 1000 * 0.35); this._credit(rec); this._recordGain(b.code, b.name, lots.splice(0), 350, 'bond');
          this._log({ type: 'bond-default', asset: 'bond', code: b.code, name: `${b.issuer} defaulted`, amount: rec, flow: rec, note: 'Bondholders recovered 35% of face value (illustrative). This is the risk behind a high coupon.' });
          this._alert(`${b.issuer} defaulted on its bonds. You recovered only 35% of face value.`, 'bad'); }
        continue;
      }
      const mat = addMonths(this.start, b.years * 12), sinceStart = daysBetween(this.start, d);
      if (qty && d === mat) { const amt = r2(qty * 1000); this._credit(amt); this._recordGain(b.code, b.name, lots.splice(0), 1000, 'bond'); this._log({ type: 'bond-mature', asset: 'bond', code: b.code, name: `${b.name} matured`, amount: amt, flow: amt }); continue; }
      if (qty && sinceStart > 0 && parseDate(d).getUTCDate() === parseDate(this.start).getUTCDate() && Math.round(sinceStart / 30.44) % 6 === 0) {
        const c = r2(qty * 1000 * b.coupon / 2); this._credit(c); this._fy().interest += c;
        this._log({ type: 'bond-coupon', asset: 'bond', code: b.code, name: `${b.name} coupon`, amount: c, flow: c, note: 'Half-yearly interest. Taxed at your slab rate.' });
      }
    }
    for (const t of L.tbills) if (!t.done && d >= t.maturity) {
      t.done = true; const amt = t.qty * 1000; this._credit(amt); this._fy().interest += r2(amt - t.qty * t.price);
      this._log({ type: 'bond-mature', asset: 'bond', code: t.code, name: `${bondByCode[t.code].name} matured`, amount: amt, flow: amt, note: `Interest earned ₹${r2(amt - t.qty * t.price)}` });
    }
  },

  // ---------------------------------------------------------- gold, silver, SGB
  metalPrice(m) { const c = this.market.commodities.find((x) => x.symbol === (m === 'gold' ? 'GOLD' : 'SILVER')); return m === 'gold' ? c.price : c.price / 1000; },
  buyMetal(m, amount) {
    if (amount < 100) throw new FinError('Minimum purchase is ₹100.');
    const price = this.metalPrice(m), paid = this._debit(amount, `digital ${m}`);
    const grams = Math.floor(paid / (price * 1.03) * 10000) / 10000; // 3% GST on purchase
    const h = this.life[m]; h.grams = Math.round((h.grams + grams) * 1e4) / 1e4; h.lots.push({ date: this.date, qty: grams, price: paid / grams });
    h.cost = r2(h.cost + paid);
    this._emit({ type: 'trade' });
    return this._log({ type: 'metal-buy', asset: m, code: m.toUpperCase(), name: `Digital ${m}`, qty: grams, price, amount: -paid, flow: -paid, note: `Includes 3% GST. ${grams} g stored in an insured vault (simulated).` });
  },
  sellMetal(m, grams) {
    const h = this.life[m]; grams = Math.floor(grams * 10000) / 10000;
    if (!(grams > 0) || grams > h.grams + 1e-6) throw new FinError(`You hold ${h.grams} g.`);
    const price = r2(this.metalPrice(m) * 0.985); // sell spread
    let left = grams, cost = 0; const used = [];
    while (left > 1e-6 && h.lots.length) { const l = h.lots[0], t = Math.min(l.qty, left); cost += t * l.price; used.push({ ...l, qty: t }); l.qty -= t; left -= t; if (l.qty < 1e-6) h.lots.shift(); }
    h.grams = Math.round(Math.max(0, h.grams - grams) * 1e4) / 1e4; h.cost = r2(Math.max(0, h.cost - cost));
    const amt = r2(grams * price); this._credit(amt); this._recordGain(m.toUpperCase(), `Digital ${m}`, used, price, 'metal');
    this._emit({ type: 'trade' });
    return this._log({ type: 'metal-sell', asset: m, code: m.toUpperCase(), name: `Digital ${m}`, qty: grams, price, amount: amt, flow: amt, pl: r2(amt - cost) });
  },
  buySGB(grams) {
    if (!Number.isInteger(grams) || grams < 1 || grams > 4000) throw new FinError('SGBs are bought in whole grams, 1 to 4,000 g a year.');
    const price = r2(this.metalPrice('gold') - 50); // ₹50 online discount
    const amt = this._debit(price * grams, 'SGB');
    const s = { id: `SGB${++this.seq}`, grams, price, date: this.date, maturity: addMonths(this.date, 96), last: this.date, status: 'active' };
    this.life.sgb.push(s);
    return this._log({ type: 'sgb-buy', asset: 'sgb', code: s.id, name: `Sovereign Gold Bond, ${grams} g`, qty: grams, price, amount: -amt, flow: -amt, note: '2.5% a year interest on the issue price, paid every 6 months. Maturity gain is tax-free. Simulated tranche: real new SGB issues have been paused since 2024.' });
  },
  sellSGB(id) {
    const s = this.life.sgb.find((x) => x.id === id && x.status === 'active'); if (!s) throw new FinError('Bond not found.');
    const price = r2(this.metalPrice('gold') * 0.97), amt = r2(price * s.grams); // trades below gold value on the exchange
    s.status = 'sold'; this._credit(amt); this._recordGain(s.id, 'Sovereign Gold Bond', [{ date: s.date, qty: s.grams, price: s.price }], price, 'metal');
    return this._log({ type: 'sgb-sell', asset: 'sgb', code: s.id, name: 'Sovereign Gold Bond sold on the exchange', qty: s.grams, price, amount: amt, flow: amt, pl: r2(amt - s.price * s.grams), note: 'SGBs often trade a little below the gold price.' });
  },
  _metalDay(d) {
    for (const s of this.life.sgb) if (s.status === 'active') {
      if (daysBetween(s.last, d) >= 182) { s.last = d; const c = r2(s.grams * s.price * 0.0125); this._credit(c); this._fy().interest += c; this._log({ type: 'sgb-interest', asset: 'sgb', code: s.id, name: 'SGB interest (2.5% a year)', amount: c, flow: c }); }
      if (d >= s.maturity) { s.status = 'matured'; const amt = r2(s.grams * this.metalPrice('gold')); this._credit(amt); this._log({ type: 'sgb-mature', asset: 'sgb', code: s.id, name: 'SGB matured', amount: amt, flow: amt, note: 'Gain on maturity is tax-free.' }); }
    }
  },

  // ---------------------------------------------------------- derivatives (paper trading)
  fnoSpot(u) { return u === 'FV8' ? this.market.indexLevel : this.market.price(u); },
  fnoExpiry() { let e = lastTuesday(this.date); if (daysBetween(this.date, e) < 2) e = lastTuesday(addMonths(this.date.slice(0, 8) + '01', 1)); return e; },
  fnoQuote(u, type, strike, expiry = this.fnoExpiry()) {
    const f = FNO.find((x) => x.u === u), S = this.fnoSpot(u), T = Math.max(0, daysBetween(this.date, expiry)) / 365;
    if (type === 'fut') return r2(S * (1 + 0.065 * T));
    return r2(Math.max(0.05, bsPrice(type, S, strike, T, f.vol)));
  },
  fnoStrikes(u) { const f = FNO.find((x) => x.u === u), S = this.fnoSpot(u), atm = Math.round(S / f.step) * f.step; return [-2, -1, 0, 1, 2].map((k) => atm + k * f.step); },
  openFno({ u, type, side = 'long', strike = null, lots = 1 }) {
    if (!this.life.certs.derivatives) throw new FinError('Pass the Derivatives Risk course at the Academy counter in AccoFinTra Tower first. Brokers make you read a risk disclosure too.');
    const f = FNO.find((x) => x.u === u); if (!f) throw new FinError('Unknown contract.');
    if (!Number.isInteger(lots) || lots < 1 || lots > 10) throw new FinError('1 to 10 lots.');
    if (type !== 'fut' && side !== 'long') throw new FinError('Selling options has unlimited risk and is not allowed in FinVora.');
    const expiry = this.fnoExpiry(), price = this.fnoQuote(u, type, strike, expiry), units = f.lot * lots;
    let margin;
    if (type === 'fut') margin = this._debit(price * units * 0.15, 'futures margin');
    else margin = this._debit(price * units, 'option premium');
    const p = { id: `FO${++this.seq}`, u, type, side, strike, lots, units, entry: price, expiry, margin, date: this.date };
    this.life.fno.push(p);
    this._emit({ type: 'trade' });
    return this._log({ type: 'fno-open', asset: 'fno', code: p.id, name: `${side === 'short' ? 'Sold' : 'Bought'} ${lots} lot${lots > 1 ? 's' : ''} ${u} ${type === 'fut' ? 'futures' : `${strike} ${type.toUpperCase()}`} (${expiry})`, amount: -margin, flow: -margin, note: type === 'fut' ? `Margin 15% of ₹${Math.round(price * units).toLocaleString('en-IN')}` : `Premium ₹${price} × ${units}` });
  },
  fnoValue(p) {
    if (p.type === 'fut') { const m = this.fnoQuote(p.u, 'fut', null, p.expiry); return { mark: m, pnl: r2((m - p.entry) * p.units * (p.side === 'short' ? -1 : 1)) }; }
    const m = this.fnoQuote(p.u, p.type, p.strike, p.expiry); return { mark: m, pnl: r2((m - p.entry) * p.units) };
  },
  closeFno(id, reason = 'Closed') {
    const p = this.life.fno.find((x) => x.id === id); if (!p) throw new FinError('Position not found.');
    const { mark, pnl } = this.fnoValue(p);
    const back = p.type === 'fut' ? r2(p.margin + pnl) : r2(mark * p.units * 0.99);
    this.life.fno = this.life.fno.filter((x) => x !== p);
    if (back >= 0) this._credit(back); else this._spend(-back, 'futures loss beyond margin', { force: true, method: 'debit', type: 'fno-loss', asset: 'fno' });
    const pl = r2(back - p.margin);
    this._fy().slab += pl; // F&O profit is business income, taxed at slab rates
    this._emit({ type: 'trade' });
    return this._log({ type: 'fno-close', asset: 'fno', code: p.id, name: `${reason}: ${p.u} ${p.type === 'fut' ? 'futures' : `${p.strike} ${p.type.toUpperCase()}`}`, amount: Math.max(0, back), flow: Math.max(0, back), pl });
  },
  _fnoDay(d) {
    for (const p of [...this.life.fno]) {
      if (d >= p.expiry) { this.closeFno(p.id, 'Expired and settled'); continue; }
      if (p.type === 'fut' && this.fnoValue(p).pnl <= -0.75 * p.margin) { this.closeFno(p.id, 'Margin call, auto square-off'); this._alert(`Margin call! Your ${p.u} futures were squared off at a loss.`, 'bad'); }
    }
  },

  // ---------------------------------------------------------- insurance
  insuranceQuote(kind, cover) {
    const age = this.declaredAge ?? 30;
    if (kind === 'term') { if (age >= 60) return null; return r2(cover / 1000 * 0.9 * 1.075 ** (age - 25)); }
    if (kind === 'health') { const base = { 500000: 8000, 1000000: 11500, 2500000: 16000 }[cover]; return base ? r2(base * 1.04 ** Math.max(0, age - 25)) : null; }
    return null;
  },
  buyPolicy(kind, cover) {
    if (!['term', 'health'].includes(kind)) throw new FinError('Unknown policy.');
    if (this.life.policies.some((p) => p.kind === kind && p.active)) throw new FinError(`You already have a ${kind} policy.`);
    const annual = this.insuranceQuote(kind, cover); if (!annual) throw new FinError(kind === 'term' ? 'Term cover is sold here up to age 59.' : 'Choose ₹5, 10 or 25 lakh cover.');
    const monthly = r2(annual * 1.04 / 12); // paying monthly costs a little more than yearly
    const p = { id: `POL${++this.seq}`, kind, cover, annual, monthly, start: this.date, next: this.date, active: true, used: 0, yearStart: this.date, claims: 0 };
    this.life.policies.push(p);
    this._payPremium(p);
    this._log({ type: 'policy', asset: 'insurance', code: p.id, name: `${kind === 'term' ? 'Term life' : 'Health'} insurance, cover ₹${(cover / 100000).toLocaleString('en-IN')} lakh`, amount: 0, note: kind === 'health' ? '30-day waiting period for illness claims (accidents covered at once).' : 'Pays your family if you die during the term. No maturity payout.' });
    return p;
  },
  cancelPolicy(id) { const p = this.life.policies.find((x) => x.id === id && x.active); if (!p) throw new FinError('Policy not found.'); p.active = false; this._log({ type: 'policy-cancel', asset: 'insurance', code: p.id, name: `${p.kind} policy cancelled`, amount: 0 }); },
  _payPremium(p) {
    if (this.cash < p.monthly) { p.active = false; this._log({ type: 'policy-lapse', asset: 'insurance', code: p.id, name: `${p.kind} policy lapsed: premium unpaid`, amount: 0 }); this._alert(`Your ${p.kind} insurance lapsed because the premium could not be paid.`, 'bad'); return; }
    this._spend(p.monthly, `${p.kind === 'term' ? 'Term' : 'Health'} insurance premium`, { method: 'debit', type: 'premium', asset: 'insurance' });
    this._fy()[p.kind === 'term' ? 'term' : 'health'] += p.monthly;
    p.next = addMonths(p.start, Math.round(daysBetween(p.start, this.date) / 30.44) + 1);
  },
  setZeroDep(carId, on) {
    const car = this.garage.find((g) => g.id === carId); if (!car) throw new FinError('Vehicle not found.');
    if (car.gift) throw new FinError('The company car is insured by AccoFinTra.');
    if (on && !car.zeroDep) { const spec = carById[car.catalogId]; const fee = r2(this.carValueNow(car) * (spec.model === 'scooter' ? INSURANCE_PCT.scooter : INSURANCE_PCT.default) * 0.15); this._debit(fee, 'zero-dep add-on'); this._log({ type: 'premium', asset: 'insurance', code: car.id, name: `Zero-depreciation add-on for ${spec.name}`, amount: -fee }); }
    car.zeroDep = !!on;
  },
  _lifeEvents(d) {
    const age = this.declaredAge ?? 30;
    if (this._rand() < 0.025 + Math.max(0, age - 40) * 0.001) {
      const bill = Math.round((25000 + this._rand() ** 2 * 225000) / 500) * 500;
      const pol = this.life.policies.find((p) => p.kind === 'health' && p.active);
      let covered = 0, why = 'no health insurance';
      if (pol) {
        if (daysBetween(pol.start, d) < 30) why = 'still in the 30-day waiting period';
        else { if (daysBetween(pol.yearStart, d) >= 365) { pol.yearStart = d; pol.used = 0; } covered = Math.min(bill, pol.cover - pol.used); pol.used += covered; pol.claims++; why = covered < bill ? 'cover used up for this year' : 'claim approved'; }
      }
      this._log({ type: 'event', asset: 'insurance', name: `Hospital bill ₹${bill.toLocaleString('en-IN')}`, amount: 0, note: covered ? `Health insurance paid ₹${covered.toLocaleString('en-IN')} (${why}).` : `Not covered: ${why}.` });
      if (bill - covered > 0) this._spend(bill - covered, 'Hospital bill', { method: 'debit', force: true, type: 'event', asset: 'insurance' });
      this._alert(covered ? `Hospital visit: bill ₹${bill.toLocaleString('en-IN')}, insurance paid ₹${covered.toLocaleString('en-IN')}.` : `Hospital visit: ₹${bill.toLocaleString('en-IN')} paid from your pocket (${why}).`, covered ? 'info' : 'bad');
    }
    const cars = this.garage.filter((g) => !g.sold);
    if (cars.length && this._rand() < 0.025) {
      const car = cars[Math.floor(this._rand() * cars.length)], spec = carById[car.catalogId];
      const dmg = Math.round((8000 + this._rand() * 70000) / 100) * 100;
      const deduct = car.gift ? 0 : 1000 + (car.zeroDep ? 0 : Math.round(dmg * 0.3));
      const you = Math.min(dmg, deduct);
      this._log({ type: 'event', asset: 'vehicle', code: car.id, name: `${spec.name} dented in a minor accident: repair ₹${dmg.toLocaleString('en-IN')}`, amount: 0, note: car.gift ? 'Company car: AccoFinTra paid the repair.' : `Motor insurance paid ₹${(dmg - you).toLocaleString('en-IN')}. You paid ₹${you.toLocaleString('en-IN')}: ₹1,000 compulsory deductible${car.zeroDep ? '' : ' plus 30% parts depreciation (no zero-dep add-on)'}.` });
      if (you > 0) this._spend(you, `${spec.name} repair`, { method: 'debit', force: true, type: 'event', asset: 'vehicle' });
      this._alert(`Minor accident: ${spec.name} repair ₹${dmg.toLocaleString('en-IN')}. You paid ₹${you.toLocaleString('en-IN')}.`, 'info');
    }
  },

  // ---------------------------------------------------------- property and REITs
  propValue(p) { return r2(p.price * this.life.propIdx / p.idx); },
  buyProperty(id, { loanPct = 0, months = 240 } = {}) {
    const t = propById[id]; if (!t) throw new FinError('Unknown property.');
    const price = r2(t.price * this.life.propIdx);
    const max = ltvMax(price); if (loanPct / 100 > max + 1e-9) throw new FinError(`Banks lend at most ${max * 100}% of this price (RBI loan-to-value rule).`);
    if (!(months >= 60 && months <= HOME_LOAN.maxMonths)) throw new FinError('Home loan tenure: 5 to 30 years.');
    const loanAmt = r2(price * loanPct / 100), stamp = r2(price * 0.06), reg = Math.min(30000, r2(price * 0.01));
    const today = r2(price - loanAmt + stamp + reg);
    if (today > this.cash + 1e-6) throw new FinError(`You need ₹${Math.ceil(today).toLocaleString('en-IN')} today: down payment plus 6% stamp duty and registration.`);
    let ln = null;
    if (loanAmt > 0) { if (this.creditScore().score !== null && this.creditScore().score < 650) throw new FinError('Home loan declined: credit score below 650.'); ln = this._newLoan(loanAmt, HOME_LOAN.rate, months, 'home'); }
    this._debit(today, 'property');
    const p = { id: `PR${++this.seq}`, typeId: id, price, idx: this.life.propIdx, bought: this.date, loanId: ln?.id || null, use: 'vacant', tenantFrom: null };
    this.life.props.push(p);
    this._log({ type: 'home-buy', asset: 'property', code: p.id, name: `Bought ${t.name}`, amount: -today, flow: -today, note: `Price ₹${Math.round(price).toLocaleString('en-IN')}; stamp duty ₹${Math.round(stamp).toLocaleString('en-IN')}; registration ₹${Math.round(reg).toLocaleString('en-IN')}${ln ? `; home loan ${ln.id} ₹${Math.round(loanAmt).toLocaleString('en-IN')} at ${(HOME_LOAN.rate * 100).toFixed(1)}%, EMI ₹${Math.round(ln.emi).toLocaleString('en-IN')}` : '; no loan'}` });
    this._emit({ type: 'trade' });
    return p;
  },
  setPropertyUse(pid, use) {
    const p = this.life.props.find((x) => x.id === pid); if (!p) throw new FinError('Property not found.');
    if (!['vacant', 'self', 'rented'].includes(use)) throw new FinError('Bad option.');
    if (use === 'self') { for (const q of this.life.props) if (q.use === 'self') q.use = 'vacant'; if (this.life.renting) this.stopRenting(); }
    p.use = use; p.tenantFrom = use === 'rented' ? addDays(this.date, 15 + Math.floor(this._rand() * 30)) : null;
    this._log({ type: 'home-use', asset: 'property', code: p.id, name: `${propById[p.typeId].name}: ${use === 'self' ? 'you moved in' : use === 'rented' ? 'listed for rent' : 'left vacant'}`, amount: 0, note: use === 'rented' ? `A tenant should move in around ${p.tenantFrom}.` : undefined });
  },
  sellProperty(pid) {
    const p = this.life.props.find((x) => x.id === pid); if (!p) throw new FinError('Property not found.');
    const value = this.propValue(p), net = r2(value * 0.99);
    const loan = p.loanId && this.loans.find((l) => l.id === p.loanId && l.status === 'active');
    const payoff = loan ? loan.balance : 0;
    if (loan) { loan.balance = 0; loan.status = 'closed'; }
    this.life.props = this.life.props.filter((x) => x !== p);
    this._credit(r2(net - payoff));
    this._recordGain(p.id, propById[p.typeId].name, [{ date: p.bought, qty: 1, price: p.price }], net, 'property');
    this._emit({ type: 'trade' });
    return this._log({ type: 'home-sell', asset: 'property', code: p.id, name: `Sold ${propById[p.typeId].name}`, amount: r2(net - payoff), flow: r2(net - payoff), pl: r2(net - p.price), note: `Sale ₹${Math.round(value).toLocaleString('en-IN')} − 1% brokerage${payoff ? ` − home loan repaid ₹${Math.round(payoff).toLocaleString('en-IN')}` : ''}` });
  },
  rentHome(id) {
    const t = propById[id]; if (!t || id === 'shop') throw new FinError('Choose a flat.');
    if (this.life.renting) throw new FinError('You already rent a home. Move out first.');
    const rent = r2(t.rent * this.life.propIdx), deposit = r2(rent * 3);
    this._debit(deposit, 'security deposit');
    for (const q of this.life.props) if (q.use === 'self') q.use = 'vacant';
    this.life.renting = { typeId: id, rent, deposit, since: this.date, next: this.date };
    this._log({ type: 'rent-start', asset: 'property', name: `Renting ${t.name}`, amount: -deposit, note: `Rent ₹${Math.round(rent).toLocaleString('en-IN')} a month. Deposit (3 months) is refundable when you move out.` });
    this._payRent();
  },
  stopRenting() {
    const r = this.life.renting; if (!r) throw new FinError('You are not renting.');
    this._credit(r.deposit); this.life.renting = null;
    this._log({ type: 'rent-stop', asset: 'property', name: 'Moved out; security deposit refunded', amount: r.deposit });
  },
  _payRent() { const r = this.life.renting; this._spend(r.rent, 'House rent', { force: true, type: 'rent', asset: 'property' }); r.next = addMonths(r.since, Math.round(daysBetween(r.since, this.date) / 30.44) + 1); },
  buyReit(amount) {
    const R = this.life.reit, units = Math.floor(amount / R.price); if (units < 1) throw new FinError(`One unit costs ₹${R.price}.`);
    const amt = this._debit(units * R.price, 'REIT units'); R.lots.push({ date: this.date, qty: units, price: R.price });
    this._emit({ type: 'trade' });
    return this._log({ type: 'reit-buy', asset: 'reit', code: 'FVREIT', name: 'FinVora Commercial REIT', qty: units, price: R.price, amount: -amt, flow: -amt, note: 'Owns rented office towers. Pays out most of its rent every quarter.' });
  },
  reitUnits() { return this.life.reit.lots.reduce((s, l) => s + l.qty, 0); },
  sellReit(units) {
    const R = this.life.reit; if (!Number.isInteger(units) || units < 1 || units > this.reitUnits()) throw new FinError(`You hold ${this.reitUnits()} units.`);
    let left = units, cost = 0; const used = [];
    while (left > 0) { const l = R.lots[0], t = Math.min(l.qty, left); cost += t * l.price; used.push({ ...l, qty: t }); l.qty -= t; left -= t; if (!l.qty) R.lots.shift(); }
    const amt = r2(units * R.price); this._credit(amt); this._recordGain('FVREIT', 'FinVora Commercial REIT', used, R.price, 'reit');
    this._emit({ type: 'trade' });
    return this._log({ type: 'reit-sell', asset: 'reit', code: 'FVREIT', name: 'FinVora Commercial REIT', qty: units, price: R.price, amount: amt, flow: amt, pl: r2(amt - cost) });
  },
  _propDay(d, dom, mon) {
    const L = this.life;
    L.propIdx = r2(L.propIdx * Math.exp(0.06 / 365 + this._gauss() * 0.002) * 10000) / 10000;
    if (isWeekday(d)) { const R = L.reit; R.price = r2(R.price * Math.exp(0.03 / 252 + this._gauss() * 0.15 / Math.sqrt(252))); R.hist.push(R.price); if (R.hist.length > 260) R.hist.shift(); }
    if (L.renting && d >= L.renting.next) this._payRent();
    for (const p of L.props) {
      const t = propById[p.typeId];
      if (dom === 1) {
        this._spend(t.maint, `${t.name} maintenance`, { method: 'debit', force: true, type: 'bill', asset: 'property' });
        if (p.use === 'rented' && p.tenantFrom && d >= p.tenantFrom) { const rent = r2(t.rent * L.propIdx); this._credit(rent); this._fy().rent += rent; this._log({ type: 'rent-in', asset: 'property', code: p.id, name: `Rent received: ${t.name}`, amount: rent, flow: rent }); }
      }
      if (dom === 1 && mon === 3) this._spend(r2(this.propValue(p) * 0.001), `${t.name} property tax`, { method: 'debit', force: true, type: 'bill', asset: 'property' });
    }
    if (dom === 1 && [0, 3, 6, 9].includes(mon) && this.reitUnits()) {
      const dist = r2(this.reitUnits() * this.life.reit.price * 0.07 / 4); this._credit(dist); this._fy().dividends += dist;
      this._log({ type: 'reit-dist', asset: 'reit', code: 'FVREIT', name: 'REIT quarterly distribution', amount: dist, flow: dist });
    }
  },

  // ---------------------------------------------------------- daily life: bills, groceries, fuel
  // ---------------------------------------------------------- city life: gym, hospital, pharmacy, school, gadgets
  gymJoin(plan) {
    const p = GYM_PLANS[plan]; if (!p) throw new FinError('Unknown plan.');
    if (this.gymActive()) throw new FinError(`Your ${this.life.gym.planName} plan runs until ${this.life.gym.until}.`);
    this._spend(p.price, `FinVora Fit ${p.name.toLowerCase()} membership`, { type: 'spend', asset: 'gym' });
    this.life.gym = { plan, planName: p.name, paid: p.price, since: this.date, until: addDays(this.date, p.days), visits: 0 };
    return this.life.gym;
  },
  gymActive() { const g = this.life.gym; return !!g && this.date <= g.until; },
  gymVisit() {
    if (!this.gymActive()) throw new FinError('No active membership. Pick a plan first.');
    const g = this.life.gym; if (g.lastVisit === this.date) throw new FinError('One visit a day counts. Come back tomorrow!');
    g.visits++; g.lastVisit = this.date; return r2(g.paid / g.visits);
  },
  /** A hospital service. Health insurance pays what the policy covers; the rest comes from you. */
  hospitalVisit(kind) {
    const h = HOSPITAL[kind]; if (!h) throw new FinError('Unknown service.');
    const pol = this.life.policies.find((p) => p.kind === 'health' && p.active);
    let covered = 0, why = pol ? 'not covered by your policy' : 'no health insurance';
    if (pol && h.covered === 'checkup') {
      const yr = fyOf(this.date);
      if (this.life.checkups[pol.id] === yr) why = 'free check-up already used this year';
      else { covered = h.price; this.life.checkups[pol.id] = yr; why = 'free annual check-up on your policy'; }
    } else if (pol && h.covered === true) {
      if (daysBetween(pol.start, this.date) < 30) why = 'policy still in its 30-day waiting period';
      else { if (daysBetween(pol.yearStart, this.date) >= 365) { pol.yearStart = this.date; pol.used = 0; } covered = Math.min(h.price, pol.cover - pol.used); pol.used += covered; pol.claims++; why = covered < h.price ? 'cover used up for this year' : 'cashless claim approved'; }
    }
    const pay = r2(h.price - covered);
    if (pay > 0) this._spend(pay, h.name, { type: 'spend', asset: 'health' });
    this._log({ type: 'event', asset: 'insurance', name: `${h.name}: bill ₹${h.price.toLocaleString('en-IN')}`, amount: 0, note: covered ? `Health insurance paid ₹${covered.toLocaleString('en-IN')} (${why}).` : `Paid by you (${why}).` });
    return { bill: h.price, covered, paid: pay, why };
  },
  buyMedicine(id, generic) {
    const m = MEDICINES.find((x) => x.id === id); if (!m) throw new FinError('Unknown medicine.');
    const price = generic ? m.generic : m.branded;
    this._spend(price, `${m.name} (${generic ? 'generic' : 'branded'})`, { type: 'spend', asset: 'health' });
    return { price, saved: generic ? m.branded - m.generic : 0 };
  },
  enrolDiploma(id, mode) {
    const d = DIPLOMAS.find((x) => x.id === id); if (!d) throw new FinError('Unknown course.');
    if (this.life.diplomas.some((x) => x.id === id)) throw new FinError('You are already enrolled in this course.');
    let loan = null;
    if (mode === 'loan') {
      const sc = this.creditScore().score; if (sc !== null && sc < 600) throw new FinError(`Education loan declined: credit score ${sc}.`);
      loan = this._newLoan(d.fee, EDU_LOAN.rate, EDU_LOAN.months, 'education');
      this._log({ type: 'loan', asset: 'loan', code: loan.id, name: `Education loan for ${d.name}`, amount: 0, note: `₹${d.fee.toLocaleString('en-IN')} paid to the college by the bank. EMI ₹${Math.round(loan.emi).toLocaleString('en-IN')} for ${EDU_LOAN.months} months at ${(EDU_LOAN.rate * 100).toFixed(1)}%.` });
    } else if (mode === 'full') this._spend(d.fee, `${d.name} fee`, { type: 'spend', asset: 'education' });
    else throw new FinError('Choose how to pay.');
    const rec = { id, name: d.name, start: this.date, ends: addMonths(this.date, d.months), loan: loan?.id || null };
    this.life.diplomas.push(rec);
    return rec;
  },
  /** Gadget price quotes: paying in full earns a cash discount that "no-cost EMI" quietly gives up. */
  gadgetQuote(id) {
    const g = GADGETS.find((x) => x.id === id); if (!g) throw new FinError('Unknown product.');
    const E = NO_COST_EMI, full = r2(g.price * (1 - E.cashDiscount));
    const interestInside = r2(g.price * E.hiddenRate * (E.months + 1) / 24); // interest the brand pays the lender, waived as a "discount"
    const emiTotal = r2(g.price + E.fee * (1 + E.gst) + interestInside * E.gst);
    return { g, full, emiTotal, monthly: r2(g.price / E.months), extra: r2(emiTotal - full), fee: E.fee, gstOnInterest: r2(interestInside * E.gst) };
  },
  buyGadget(id, mode) {
    const q = this.gadgetQuote(id), E = NO_COST_EMI;
    if (mode === 'full') { this._spend(q.full, `${q.g.name} (paid in full, ${E.cashDiscount * 100}% off)`, { type: 'spend', asset: 'shopping' }); return { paid: q.full }; }
    if (mode === 'emi') {
      if (!this.life.card || this.life.card.status !== 'active') throw new FinError('No-cost EMI needs a credit card. Get one at FinVora Bank.');
      const upfront = r2(E.fee * (1 + E.gst) + q.gstOnInterest);
      this._spend(upfront, `No-cost EMI processing fee and GST for ${q.g.name}`, { method: 'card', type: 'spend', asset: 'shopping' });
      const loan = this._newLoan(q.g.price, 0, E.months, 'consumer');
      this._log({ type: 'loan', asset: 'loan', code: loan.id, name: `No-cost EMI: ${q.g.name}`, amount: 0, note: `${E.months} EMIs of ₹${Math.round(loan.emi).toLocaleString('en-IN')}. You gave up the ₹${Math.round(q.g.price - q.full).toLocaleString('en-IN')} cash discount.` });
      return { paid: upfront, loan };
    }
    throw new FinError('Choose how to pay.');
  },
  setLifestyle(k) { if (!LIFESTYLES[k]) throw new FinError('Unknown plan.'); this.life.lifestyle = k; },
  shop(item, amount) { if (!(amount > 0)) throw new FinError('Nothing to buy.'); return this._spend(amount, item, { type: 'spend', asset: 'shopping' }); },
  _bills(d, dom, mon) {
    if (dom === 7) this._spend(LIFESTYLES[this.life.lifestyle].groceries, `Groceries (${LIFESTYLES[this.life.lifestyle].name} plan)`, { force: true, type: 'bill', asset: 'household' });
    if (dom === 10) {
      const summer = mon >= 3 && mon <= 5;
      const elec = Math.round((1500 + this._rand() * 1200 + (summer ? 1200 : 0)) / 10) * 10;
      this._spend(elec, 'Electricity bill', { force: true, type: 'bill', asset: 'household' });
      this._spend(999, 'Mobile and internet', { force: true, type: 'bill', asset: 'household' });
    }
  },
  carFuel(carId) { const c = this.garage.find((g) => g.id === carId); return c ? (c.fuel ?? 0.6) : 0; },
  /** Called by the game as the car moves. metres = in-game distance. */
  useFuel(carId, metres) {
    const c = this.garage.find((g) => g.id === carId); if (!c) return 0;
    const s = carById[c.catalogId]; const units = metres * DRIVE_SCALE / 1000 / s.eff;
    c.fuel = Math.max(0, (c.fuel ?? 0.6) - units / s.tank);
    return c.fuel;
  },
  refuel(carId, { amount = null } = {}) {
    const c = this.garage.find((g) => g.id === carId); if (!c) throw new FinError('Vehicle not found.');
    const s = carById[c.catalogId], f = FUEL[s.energy];
    let units = (1 - (c.fuel ?? 0)) * s.tank; if (amount) units = Math.min(units, amount / f.price);
    units = Math.floor(units * 100) / 100; if (units < 0.05) throw new FinError('The tank is already full.');
    const cost = r2(units * f.price);
    this._spend(cost, `${f.name} for ${s.name}: ${units} ${f.unit}${units === 1 ? '' : 's'}`, { type: 'fuel', asset: 'vehicle' });
    c.fuel = Math.min(1, (c.fuel ?? 0) + units / s.tank);
    return { units, cost };
  },

  // ---------------------------------------------------------- academy
  submitQuiz(id, answers) {
    const c = courseById[id]; if (!c) throw new FinError('Unknown course.');
    const score = c.qs.reduce((s, q, i) => s + (Number(answers[i]) === q[2] ? 1 : 0), 0);
    const pass = score >= 4, first = pass && !this.life.certs[id];
    if (first) { this.life.certs[id] = this.date; this._credit(c.reward); this._log({ type: 'certificate', name: `Certificate: ${c.title}`, amount: c.reward, note: `Scored ${score}/5. Reward paid in virtual money.` }); this._alert(`You earned the ${c.title} certificate and ₹${c.reward.toLocaleString('en-IN')}!`, 'good'); }
    return { score, pass, first };
  },

  // ---------------------------------------------------------- research: results, IPOs, dividends, AGM
  _resultsDay(d, dom, mon) {
    if (dom === 15 && [0, 3, 6, 9].includes(mon)) {
      const qn = { 0: 'Q3', 3: 'Q4', 6: 'Q1', 9: 'Q2' }[mon]; const fyLabel = `FY${String(Number(fyOf(addDays(d, -45)).slice(2, 4)) + 1)}`;
      const trend = { AFT: 0.14, STR: 0.1, JPM: 0.12, MMA: 0.08, SMNI: 0.09, BLU: 0.06, MJDR: 0.13, MOJI: 0.03 };
      for (const c of COMPANIES) {
        const hist = this.life.results[c.symbol], prev = hist[hist.length - 1];
        const g = trend[c.symbol] + this._gauss() * 0.08, surprise = this._gauss() * 0.06;
        const revenue = r2(prev.revenue * (1 + g / 4 + this._gauss() * 0.02));
        const profit = r2(prev.profit >= 0 ? prev.profit * (1 + g / 4 + surprise) : prev.profit * (1 - g / 2 - surprise * 2));
        hist.push({ q: `${fyLabel} ${qn}`, revenue, profit, growth: r2(g * 100), date: d, surprise: r2(surprise * 100) }); if (hist.length > 12) hist.shift();
        const s = this.market.stocks.find((x) => x.symbol === c.symbol); const jump = clamp(surprise * 0.8, -0.08, 0.08);
        s.price = r2(s.price * (1 + jump)); s.hist[s.hist.length - 1] = s.price;
        this.market.news.push({ date: d, sym: c.symbol, kind: 'company', move: jump, text: `${c.name} ${qn} results: profit ${surprise >= 0 ? 'beat' : 'missed'} estimates; shares ${jump >= 0 ? 'rose' : 'fell'} ${Math.abs(jump * 100).toFixed(1)}%` });
      }
      this._alert('Quarterly results are out. See the Research counter in AccoFinTra Tower.');
    }
    // dividends on the 15th of each company's record month
    if (dom === 15) for (const c of COMPANIES) if (DIV_MONTH[c.symbol] === mon && c.divYield) {
      const dps = r2(this.market.price(c.symbol) * c.divYield / 100); const q = this.qty(c.symbol);
      this.life.divs.push({ date: d, sym: c.symbol, dps });
      if (q) { const amt = r2(q * dps); this._credit(amt); this._fy().dividends += amt; this._log({ type: 'dividend', asset: 'stock', code: c.symbol, name: `${c.name} dividend ₹${dps}/share`, amount: amt, flow: amt, note: 'Dividends are taxed at your slab rate.' }); this._alert(`Dividend from ${c.name}: ₹${Math.round(amt).toLocaleString('en-IN')}`, 'good'); }
    }
    if (dom === 20 && mon === 7) {
      const h = this.life.results.AFT, last = h[h.length - 1];
      this.life.agm = { date: d, year: d.slice(0, 4), text: `Dear shareholders, AccoFinTra closed another year of steady growth. Our latest quarter brought revenue of ₹${Math.round(last.revenue).toLocaleString('en-IN')} crore and profit of ₹${Math.round(last.profit).toLocaleString('en-IN')} crore. We continue to invest in research, technology and financial education across FinVora, and we keep our balance sheet strong. Thank you for your trust. (Simulated letter from a fictional company.)` };
      this._alert('AccoFinTra held its Annual General Meeting. Read the shareholder letter at AccoFinTra Tower.');
    }
  },
  _ipoDay(d) {
    const L = this.life;
    if (!L.ipo && d >= L.nextIpo) {
      const { name, sector } = this._ipoName(); L.ipoCount++;
      const hi = Math.round((80 + this._rand() * 420) / 5) * 5, lo = Math.round(hi * 0.95), lot = Math.max(10, Math.round(15000 / hi));
      const open = addDays(d, 3), close = addDays(open, 2);
      L.ipo = { id: `IPO${L.ipoCount}`, name, sector, band: [lo, hi], lot, open, close, allot: addDays(close, 1), list: addDays(close, 3), status: 'upcoming', sub: null, applied: null, quality: this._gauss() };
      this._alert(`${name} IPO opens ${open}. Price band ₹${lo} to ₹${hi}. Details at the Research counter in AccoFinTra Tower.`);
    }
    const I = L.ipo; if (!I) return;
    if (I.status === 'upcoming' && d >= I.open) I.status = 'open';
    if (I.status === 'open') I.sub = r2(Math.exp(1 + I.quality * 1.2 + this._gauss() * 0.3) * (daysBetween(I.open, d) + 1) / 3);
    if (I.status === 'open' && d > I.close) {
      I.status = 'closed';
      if (I.applied) {
        const p = I.sub <= 1 ? 1 : 1 / I.sub; I.allotted = this._rand() < p ? 1 : 0;
        if (!I.allotted) { this._credit(I.applied.amount); this._log({ type: 'ipo-refund', asset: 'ipo', code: I.id, name: `${I.name} IPO: not allotted`, amount: I.applied.amount, note: `Oversubscribed ${I.sub}x. Retail allotment is a lottery of one lot. Blocked money released.` }); this._alert(`No allotment in ${I.name} (subscribed ${I.sub} times). Money released.`); }
        else { const extra = r2(I.applied.amount - I.lot * I.band[1]); if (extra > 0) this._credit(extra); this._log({ type: 'ipo-allot', asset: 'ipo', code: I.id, name: `${I.name} IPO: 1 lot allotted (${I.lot} shares @ ₹${I.band[1]})`, amount: extra > 0 ? extra : 0 }); this._alert(`You got 1 lot of ${I.name}! Listing on ${I.list}.`, 'good'); }
      }
    }
    if (I.status === 'closed' && d >= I.list) {
      const gain = clamp(0.18 * Math.log(Math.max(0.3, I.sub)) + I.quality * 0.08 + this._gauss() * 0.12, -0.35, 0.9);
      const listPrice = r2(I.band[1] * (1 + gain));
      if (I.allotted) L.ipoHold.push({ id: I.id, name: I.name, qty: I.lot, cost: I.band[1], price: listPrice, hist: [listPrice], vol: 0.45 });
      this.market.news.push({ date: d, kind: 'company', move: gain, text: `${I.name} lists at ₹${listPrice}, ${gain >= 0 ? 'up' : 'down'} ${Math.abs(gain * 100).toFixed(0)}% from its IPO price` });
      if (I.allotted) this._alert(`${I.name} listed at ₹${listPrice} (${gain >= 0 ? '+' : ''}${(gain * 100).toFixed(0)}%).`, gain >= 0 ? 'good' : 'bad');
      L.ipo = null; L.nextIpo = addDays(d, 30 + Math.floor(this._rand() * 30));
    }
    if (isWeekday(d)) for (const h of L.ipoHold) { h.price = r2(h.price * Math.exp(this._gauss() * h.vol / Math.sqrt(252))); h.hist.push(h.price); if (h.hist.length > 120) h.hist.shift(); }
  },
  /** A brand-new fictional company name for every IPO. */
  _ipoName() {
    const used = (this.life.ipoUsed ||= []);
    for (let k = 0; k < 200; k++) {
      const p = IPO_PRE[Math.floor(this._rand() * IPO_PRE.length)], [sec, sector] = IPO_SECTORS[Math.floor(this._rand() * IPO_SECTORS.length)];
      const name = `${p} ${sec} Ltd`;
      if (!used.includes(name)) { used.push(name); if (used.length > 300) used.shift(); return { name, sector }; }
    }
    return { name: `FinVora Listing ${used.length + 1} Ltd`, sector: 'Diversified' };
  },
  applyIPO(lots) {
    const I = this.life.ipo; if (!I || I.status !== 'open') throw new FinError('No IPO is open right now.');
    if (I.applied) throw new FinError('You have already applied.');
    if (!this.life.kyc) throw new FinError('IPO bids need KYC and UPI. Set them up at the FinTech counter in AccoFinTra Tower.');
    if (!Number.isInteger(lots) || lots < 1 || lots * I.lot * I.band[1] > 200000) throw new FinError('Retail investors can bid up to ₹2,00,000.');
    const amount = this._debit(lots * I.lot * I.band[1], 'IPO bid');
    I.applied = { lots, amount };
    return this._log({ type: 'ipo-bid', asset: 'ipo', code: I.id, name: `${I.name} IPO bid: ${lots} lot${lots > 1 ? 's' : ''} at ₹${I.band[1]} (cut-off)`, amount: -amount, note: 'Money is blocked via UPI until allotment.' });
  },
  sellIPOShares(id) {
    const h = this.life.ipoHold.find((x) => x.id === id); if (!h) throw new FinError('Holding not found.');
    const amt = r2(h.qty * h.price); this._credit(amt); this.life.ipoHold = this.life.ipoHold.filter((x) => x !== h);
    this._recordGain(h.id, h.name, [{ date: this.ledger.find((e) => e.code === id && e.type === 'ipo-allot')?.date || this.date, qty: h.qty, price: h.cost }], h.price, 'equity');
    this._emit({ type: 'trade' });
    return this._log({ type: 'sell', asset: 'stock', code: h.id, name: `${h.name} shares sold`, qty: h.qty, price: h.price, amount: amt, flow: amt, pl: r2(amt - h.qty * h.cost) });
  },
  analystView(sym) {
    const c = COMPANIES.find((x) => x.symbol === sym), price = this.market.price(sym), h = this.life.results[sym];
    const ttm = h.slice(-4).reduce((s, x) => s + x.profit, 0) * (4 / Math.min(4, h.length));
    const mcap = price * c.shares; const pe = ttm > 0 ? mcap / ttm : null; const g = h.slice(-4).reduce((s, x) => s + x.growth, 0) / Math.min(4, h.length);
    let rating = 'Hold', up = 0.08;
    if (!pe) { rating = 'Sell'; up = -0.15; } else if (pe < 22 && g > 8) { rating = 'Buy'; up = 0.18; } else if (pe > 45 || g < 3) { rating = 'Sell'; up = -0.1; }
    return { pe: pe && r2(pe), growth: r2(g), rating, target: r2(price * (1 + up)), mcap: r2(mcap) };
  },

  // ---------------------------------------------------------- tax
  _recordGain(code, name, used, price, kind) {
    for (const l of used) {
      const days = daysBetween(l.date, this.date), gain = r2((price - l.price) * l.qty);
      let bucket;
      if (kind === 'equity') bucket = days > 365 ? 'eqLT' : 'eqST';
      else if (kind === 'property') bucket = days > 730 ? 'otherLT' : 'slab';
      else if (kind === 'metal') bucket = code.startsWith('SGB') ? (days > 365 ? 'otherLT' : 'slab') : (days > 730 ? 'otherLT' : 'slab');
      else if (kind === 'bond' || kind === 'reit') bucket = days > 365 ? 'otherLT' : 'slab';
      else if (kind === 'debt') bucket = 'slab';
      else if (kind === 'fof') bucket = days > 730 ? 'otherLT' : 'slab';
      else if (kind === 'listedOther') bucket = days > 365 ? 'otherLT' : 'slab';
      this._fy()[bucket] += gain;
      this.life.gains.push({ date: this.date, code, name, qty: l.qty, buyDate: l.date, buy: l.price, sell: price, gain, bucket });
    }
    if (this.life.gains.length > 400) this.life.gains.splice(0, this.life.gains.length - 400);
  },
  /** Called by Finance.sellShares / redeemFund. */
  _gainFromCode(code, used, price) {
    const c = COMPANIES.find((x) => x.symbol === code), e = ETFS.find((x) => x.symbol === code), f = FUNDS.find((x) => x.code === code);
    let kind = 'equity';
    if (e) kind = e.tracks === 'index' ? 'equity' : e.tracks === 'liquid' ? 'debt' : 'listedOther';
    if (f) kind = f.kind === 'equity' || (f.kind === 'hybrid' && (f.equityShare || 0) >= 0.65) ? 'equity' : f.kind === 'gold' || f.kind === 'intl' ? 'fof' : 'debt';
    if (code === 'NPS') return;
    this._recordGain(code, (c || e || f)?.name || code, used, price, kind);
  },
  _onEmi(loan, interest, principal) { if (loan.kind === 'home') { const fy = this._fy(); fy.homeInt += interest; fy.homePrin += principal; } },
  /** Full tax computation for a financial year under both regimes. */
  taxReport(fy = fyOf(this.date)) {
    const a = this._fy(fy), age = this.declaredAge ?? 30;
    const inFy = (e) => fyOf(e.date) === fy;
    const led = this.ledger.filter(inFy);
    const sum = (t, code) => led.filter((e) => e.type === t && (!code || e.code === code)).reduce((s, e) => s + Math.abs(e.amount || 0), 0);
    const savInt = sum('interest') + sum('scss-interest');
    const fdInt = led.filter((e) => e.type === 'fd-mature' || e.type === 'fd-break').reduce((s, e) => { const fd = this.fds.find((f) => f.id === e.code); return s + (fd ? Math.max(0, e.amount - fd.principal) : 0); }, 0)
      + led.filter((e) => e.type === 'rd-mature').reduce((s, e) => { const rd = this.rds.find((r) => r.id === e.code); return s + (rd ? Math.max(0, e.amount - rd.paid.length * rd.installment) : 0); }, 0);
    const interest = r2(a.interest + savInt + fdInt);
    const pension = led.filter((e) => e.type === 'annuity-pay').reduce((s, e) => s + e.amount, 0);
    const c80 = r2(Math.min(150000, a.epfEmp + sum('ppf-deposit') + sum('ssy-deposit') + sum('nsc-buy') + led.filter((e) => (e.type === 'buy' || e.type === 'sip') && e.code === 'FWTS').reduce((s, e) => s + Math.abs(e.amount), 0) + a.term + a.homePrin));
    const d80 = r2(Math.min(age >= 60 ? 50000 : 25000, a.health));
    const homeInt = r2(Math.min(200000, a.homeInt));
    const rentNet = r2(a.rent * 0.7); // 30% standard deduction on rent received
    const other = r2(interest + a.dividends + pension + rentNet + a.gig + Math.max(0, a.slab));
    const special = (eqST, eqLT, otherLT) => r2(Math.max(0, eqST) * 0.2 + Math.max(0, eqLT - 125000) * 0.125 + Math.max(0, otherLT) * 0.125);
    const spec = special(a.eqST, a.eqLT, a.otherLT);
    const salNew = Math.max(0, a.salary - (a.salary ? 75000 : 0)), salOld = Math.max(0, a.salary - (a.salary ? 50000 : 0) - a.pt);
    const incNew = r2(salNew + other), incOld = r2(Math.max(0, salOld + other - c80 - d80 - homeInt));
    const tNew = r2((slabTaxNew(incNew) + spec) * 1.04), tOld = r2((slabTaxOld(incOld, age) + spec) * 1.04);
    return { fy, salary: a.salary, gig: a.gig, tds: r2(a.tds), interest, dividends: r2(a.dividends), rent: r2(a.rent), fno: r2(a.slab), pension, eqST: r2(a.eqST), eqLT: r2(a.eqLT), otherLT: r2(a.otherLT),
      c80, d80, homeInt, new: { taxable: incNew, tax: tNew }, old: { taxable: incOld, tax: tOld }, special: spec, better: tNew <= tOld ? 'new' : 'old', filed: this.life.filed[fy] || null, due: fyDue(fy), end: fyEnd(fy) };
  },
  fileReturn(fy, regime) {
    if (!['new', 'old'].includes(regime)) throw new FinError('Choose a regime.');
    if (this.date <= fyEnd(fy)) throw new FinError(`You can file for FY ${fy} from 1 April, after the year ends.`);
    if (this.life.filed[fy]) throw new FinError('Already filed for this year.');
    const r = this.taxReport(fy), tax = r[regime].tax, late = this.date > r.due ? (r[regime].taxable <= 500000 ? 1000 : 5000) : 0;
    const bal = r2(tax - r.tds + late);
    if (bal > 0) this._spend(bal, `Income tax for FY ${fy}`, { method: 'debit', force: true, type: 'tax', asset: 'tax' });
    else if (bal < 0) { this._credit(-bal); }
    this.life.filed[fy] = { date: this.date, regime, tax, late, balance: bal };
    this._log({ type: 'itr', asset: 'tax', name: `Income tax return filed for FY ${fy} (${regime} regime)`, amount: bal < 0 ? -bal : 0, note: `Tax ₹${Math.round(tax).toLocaleString('en-IN')}, TDS ₹${Math.round(r.tds).toLocaleString('en-IN')}${late ? `, late fee ₹${late}` : ''}. ${bal > 0 ? `Paid ₹${Math.round(bal).toLocaleString('en-IN')}.` : bal < 0 ? `Refund ₹${Math.round(-bal).toLocaleString('en-IN')} credited.` : 'Nothing more to pay.'}` });
    return this.life.filed[fy];
  },

  // ---------------------------------------------------------- the daily tick
  _lifeDay(d) {
    const dt = parseDate(d), dom = dt.getUTCDate(), mon = dt.getUTCMonth(), L = this.life;
    this._bondDay(d); this._metalDay(d); this._fnoDay(d); this._propDay(d, dom, mon); this._resultsDay(d, dom, mon); this._ipoDay(d); this._cardDay(d, dom);
    this._bills(d, dom, mon);
    for (const p of L.policies) if (p.active && d >= p.next) this._payPremium(p);
    if (dom === 20) this._lifeEvents(d);
    if (L.job) {
      if (isMonthEnd(d)) this._paySalary();
      if (daysBetween(L.job.start, d) > 0 && daysBetween(L.job.start, d) % 365 === 0) { L.job.gross = Math.round(L.job.gross * 1.07 / 100) * 100; L.job.raises++; this._alert(`Annual appraisal: your salary is now ₹${L.job.gross.toLocaleString('en-IN')} a month (+7%).`, 'good'); }
    }
    // EPF interest: accrues monthly, credited on 31 March (rate declared for FY 2025-26)
    if (isMonthEnd(d)) L.epf.accrued += L.epf.balance * 0.0825 / 12;
    if (mon === 2 && dom === 31 && L.epf.accrued > 0) { const i = r2(L.epf.accrued); L.epf.balance = r2(L.epf.balance + i); L.epf.accrued = 0; this._log({ type: 'epf-interest', asset: 'epf', name: 'EPF interest credited (8.25%)', amount: 0, note: `₹${i} added to your EPF account` }); }
    for (const a of L.annuities) if (dom === 1 && d > a.start) { this._credit(a.monthly); this._log({ type: 'annuity-pay', asset: 'annuity', code: a.id, name: 'Monthly pension (annuity)', amount: a.monthly }); }
    if (dom === 1) { const s = this.creditScore().score; if (s !== null) { L.scoreHist.push({ date: d, score: s }); if (L.scoreHist.length > 36) L.scoreHist.shift(); } }
    if (dom === 1 && mon === 3) { const prev = fyOf(addDays(d, -1)); if (!L.filed[prev] && (L.fy[prev]?.salary || L.fy[prev]?.gig)) this._alert(`FY ${prev} has ended. File your income tax return at the Tax Desk in AccoFinTra Tower by 31 July.`); }
  },

  /** Extra assets and liabilities for the net worth view. */
  _lifeWorth() {
    const L = this.life;
    const bonds = BONDS.reduce((s, b) => s + this.bondQty(b.code) * this.bondPriceNow(b.code), 0) + L.tbills.filter((t) => !t.done).reduce((s, t) => s + t.qty * this.tbillPrice(t.code), 0);
    const gold = L.gold.grams * this.metalPrice('gold') * 0.985 + L.silver.grams * this.metalPrice('silver') * 0.985 + L.sgb.filter((s) => s.status === 'active').reduce((t, s) => t + s.grams * this.metalPrice('gold'), 0);
    const fno = L.fno.reduce((s, p) => { const v = this.fnoValue(p); return s + (p.type === 'fut' ? p.margin + v.pnl : v.mark * p.units); }, 0);
    const property = L.props.reduce((s, p) => s + this.propValue(p), 0) + this.reitUnits() * L.reit.price + (L.renting ? L.renting.deposit : 0);
    const I = L.ipo, ipo = L.ipoHold.reduce((s, h) => s + h.qty * h.price, 0) + (I?.applied ? (I.status === 'open' ? I.applied.amount : I.allotted ? I.lot * I.band[1] : 0) : 0);
    const epf = L.epf.balance + L.epf.accrued;
    const card = L.card?.status === 'active' ? L.card.balance : 0;
    return { assets: { 'Bonds': r2(bonds), 'Gold and silver': r2(gold), 'F&O': r2(fno), 'Property and REITs': r2(property), 'IPO shares': r2(ipo), 'EPF': r2(epf) }, card: r2(card) };
  },
};
