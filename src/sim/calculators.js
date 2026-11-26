// Calculator definitions: inputs, pure compute functions, formulas and assumptions.
// Results are computed live from inputs; nothing is hard-coded. All amounts in ₹.

const r2 = (v) => Math.round(v * 100) / 100;

/** Future value of a monthly SIP paid at the start of each month. */
export function sipFV(P, annualPct, years) {
  const i = annualPct / 100 / 12, n = Math.round(years * 12);
  return i === 0 ? P * n : P * (((1 + i) ** n - 1) / i) * (1 + i);
}
export function stepUpFV(P, annualPct, years, stepPct) {
  const i = annualPct / 100 / 12; let bal = 0, amt = P, paid = 0;
  const yearly = [];
  for (let m = 0; m < Math.round(years * 12); m++) {
    if (m && m % 12 === 0) amt *= 1 + stepPct / 100;
    bal = (bal + amt) * (1 + i); paid += amt;
    if ((m + 1) % 12 === 0) yearly.push(bal);
  }
  return { value: bal, paid, yearly };
}
export const emiOf = (P, annualPct, months) => { const r = annualPct / 100 / 12; return r === 0 ? P / months : (P * r * (1 + r) ** months) / ((1 + r) ** months - 1); };
export function rdMaturity(P, annualPct, months) {
  const r = annualPct / 100; let s = 0;
  for (let k = 1; k <= months; k++) s += P * (1 + r / 4) ** (4 * (months - k + 1) / 12);
  return s;
}
export function bondPrice(face, couponPct, years, yieldPct) {
  const c = face * couponPct / 100, y = yieldPct / 100; let p = 0;
  for (let t = 1; t <= years; t++) p += c / (1 + y) ** t;
  return p + face / (1 + y) ** years;
}

const yearsSeries = (n, fn) => Array.from({ length: n + 1 }, (_, t) => fn(t));

export const CALCULATORS = [
  {
    id: 'sip', title: 'SIP Calculator', group: 'Investment',
    inputs: [['amount', 'Monthly SIP', 500, 200000, 500, 10000, '₹'], ['rate', 'Expected annual return', 1, 20, 0.5, 12, '%'], ['years', 'Years', 1, 40, 1, 15, 'yr']],
    compute: ({ amount, rate, years }) => {
      const fv = sipFV(amount, rate, years), paid = amount * years * 12;
      return {
        outputs: [['Total invested', paid], ['Estimated value', fv, 'good'], ['Estimated gain', fv - paid]],
        formula: `FV = P × [((1 + i)^n − 1) ÷ i] × (1 + i)\ni = ${rate}% ÷ 12 = ${(rate / 1200).toFixed(5)}, n = ${years * 12} months\nFV = ${amount} × [((1 + ${(rate / 1200).toFixed(5)})^${years * 12} − 1) ÷ ${(rate / 1200).toFixed(5)}] × (1 + ${(rate / 1200).toFixed(5)}) = ${Math.round(fv).toLocaleString('en-IN')}`,
        chart: { labels: 'year', series: [['Invested', yearsSeries(years, (t) => amount * 12 * t)], ['Value', yearsSeries(years, (t) => sipFV(amount, rate, t))]] },
        notes: 'Assumes the same return every month and instalments at the start of each month. Real returns vary and are not guaranteed.',
      };
    },
  },
  {
    id: 'stepup', title: 'Step-up SIP Calculator', group: 'Investment',
    inputs: [['amount', 'Starting monthly SIP', 500, 200000, 500, 10000, '₹'], ['step', 'Yearly increase', 0, 30, 1, 10, '%'], ['rate', 'Expected annual return', 1, 20, 0.5, 12, '%'], ['years', 'Years', 1, 40, 1, 15, 'yr']],
    compute: ({ amount, step, rate, years }) => {
      const s = stepUpFV(amount, rate, years, step), flat = sipFV(amount, rate, years);
      return {
        outputs: [['Total invested', s.paid], ['Estimated value', s.value, 'good'], ['Without step-up', flat], ['Extra from stepping up', s.value - flat, 'gold']],
        formula: `Each month: balance = (balance + SIP) × (1 + ${rate}%/12)\nSIP grows by ${step}% every 12 instalments, starting at ₹${amount}.`,
        chart: { labels: 'year', series: [['Flat SIP', yearsSeries(years, (t) => sipFV(amount, rate, t))], ['Step-up SIP', [0, ...s.yearly]]] },
        notes: 'Stepping up with salary rises is one of the most powerful habits in investing. Returns are assumptions.',
      };
    },
  },
  {
    id: 'lumpsum', title: 'Lump Sum Calculator', group: 'Investment',
    inputs: [['amount', 'One-time investment', 1000, 5000000, 1000, 100000, '₹'], ['rate', 'Expected annual return', 1, 20, 0.5, 12, '%'], ['years', 'Years', 1, 40, 1, 10, 'yr']],
    compute: ({ amount, rate, years }) => {
      const fv = amount * (1 + rate / 100) ** years;
      return { outputs: [['Invested', amount], ['Estimated value', fv, 'good'], ['Gain', fv - amount]], formula: `FV = P × (1 + r)^t = ${amount} × (1 + ${rate / 100})^${years} = ${Math.round(fv).toLocaleString('en-IN')}`, chart: { labels: 'year', series: [['Value', yearsSeries(years, (t) => amount * (1 + rate / 100) ** t)]] }, notes: 'Annual compounding at a constant assumed return.' };
    },
  },
  {
    id: 'swp', title: 'SWP Calculator', group: 'Investment',
    inputs: [['corpus', 'Starting corpus', 100000, 50000000, 50000, 2000000, '₹'], ['withdraw', 'Monthly withdrawal', 1000, 500000, 1000, 15000, '₹'], ['rate', 'Expected annual return', 0, 15, 0.5, 8, '%'], ['years', 'Years', 1, 40, 1, 20, 'yr']],
    compute: ({ corpus, withdraw, rate, years }) => {
      const i = rate / 1200; let bal = corpus, months = 0, taken = 0; const ser = [corpus];
      for (let m = 1; m <= years * 12; m++) { if (bal <= 0) break; const w = Math.min(withdraw, bal); bal -= w; taken += w; bal *= 1 + i; months = m; if (m % 12 === 0) ser.push(Math.max(0, bal)); }
      while (ser.length < years + 1) ser.push(0);
      return { outputs: [['Total withdrawn', taken], ['Balance left', Math.max(0, bal), bal > 0 ? 'good' : 'bad'], ['Money lasts', bal > 0 ? `${years}+ years` : `${(months / 12).toFixed(1)} years`]], formula: `Each month: balance = (balance − withdrawal) × (1 + ${rate}%/12)`, chart: { labels: 'year', series: [['Balance', ser]] }, notes: 'Systematic withdrawal from a fund. Market falls early in retirement shorten how long money lasts.' };
    },
  },
  {
    id: 'cagr', title: 'CAGR Calculator', group: 'Investment',
    inputs: [['start', 'Starting value', 1000, 10000000, 1000, 100000, '₹'], ['end', 'Ending value', 1000, 50000000, 1000, 250000, '₹'], ['years', 'Years', 1, 40, 1, 8, 'yr']],
    compute: ({ start, end, years }) => {
      const c = (end / start) ** (1 / years) - 1;
      return { outputs: [['CAGR', `${(c * 100).toFixed(2)}% a year`, c >= 0 ? 'good' : 'bad'], ['Absolute return', `${((end / start - 1) * 100).toFixed(1)}%`]], formula: `CAGR = (End ÷ Start)^(1/t) − 1 = (${end} ÷ ${start})^(1/${years}) − 1 = ${(c * 100).toFixed(2)}%`, notes: 'CAGR is the steady yearly rate that turns the start value into the end value. For several cash flows at different dates, use XIRR (shown in your Portfolio).' };
    },
  },
  {
    id: 'inflation', title: 'Inflation Calculator', group: 'Investment',
    inputs: [['cost', "Today's cost", 100, 10000000, 100, 100000, '₹'], ['inf', 'Inflation rate', 1, 12, 0.5, 6, '%'], ['years', 'Years', 1, 40, 1, 10, 'yr']],
    compute: ({ cost, inf, years }) => {
      const fut = cost * (1 + inf / 100) ** years, pp = cost / (1 + inf / 100) ** years;
      return { outputs: [['Future cost', fut, 'bad'], ['What ₹' + cost.toLocaleString('en-IN') + ' buys then (in today\'s money)', pp]], formula: `Future cost = C × (1 + i)^t = ${cost} × ${(1 + inf / 100).toFixed(3)}^${years}\nPurchasing power = C ÷ (1 + i)^t`, chart: { labels: 'year', series: [['Cost', yearsSeries(years, (t) => cost * (1 + inf / 100) ** t)]] }, notes: 'Inflation is an assumption; actual inflation varies year to year.' };
    },
  },
  {
    id: 'goal', title: 'Goal Planner', group: 'Investment',
    inputs: [['goal', "Goal cost in today's money", 10000, 50000000, 10000, 1000000, '₹'], ['years', 'Years to goal', 1, 30, 1, 10, 'yr'], ['inf', 'Inflation', 0, 12, 0.5, 6, '%'], ['rate', 'Expected return', 1, 18, 0.5, 11, '%']],
    compute: ({ goal, years, inf, rate }) => {
      const target = goal * (1 + inf / 100) ** years, unit = sipFV(1, rate, years);
      return { outputs: [['Goal in future rupees', target], ['Monthly SIP needed', target / unit, 'gold'], ['Lump sum needed today', target / (1 + rate / 100) ** years]], formula: `Target = ${goal} × (1 + ${inf}%)^${years} = ${Math.round(target).toLocaleString('en-IN')}\nSIP = Target ÷ ([((1 + i)^n − 1) ÷ i] × (1 + i))`, notes: 'Inflation-adjusted. Both inflation and return are assumptions.' };
    },
  },
  {
    id: 'fd', title: 'FD Calculator', group: 'Banking',
    inputs: [['amount', 'Deposit', 1000, 10000000, 1000, 100000, '₹'], ['rate', 'Interest rate', 2, 10, 0.05, 6.8, '%'], ['months', 'Tenure', 1, 120, 1, 24, 'mo']],
    compute: ({ amount, rate, months }) => {
      const t = months / 12, v = months < 6 ? amount * (1 + rate / 100 * t) : amount * (1 + rate / 400) ** (4 * t);
      return { outputs: [['Maturity value', v, 'good'], ['Interest earned', v - amount]], formula: months < 6 ? `Under 6 months, simple interest: A = P × (1 + r × t) = ${amount} × (1 + ${rate / 100} × ${t.toFixed(3)})` : `Quarterly compounding: A = P × (1 + r/4)^(4t) = ${amount} × (1 + ${(rate / 400).toFixed(5)})^${(4 * t).toFixed(2)}`, notes: 'Many Indian banks compound FDs quarterly and use simple interest for short tenures. Interest is taxable at your slab rate. Check your bank\'s actual terms.' };
    },
  },
  {
    id: 'rd', title: 'RD Calculator', group: 'Banking',
    inputs: [['amount', 'Monthly instalment', 100, 200000, 100, 5000, '₹'], ['rate', 'Interest rate', 2, 10, 0.05, 6.8, '%'], ['months', 'Tenure', 6, 120, 1, 24, 'mo']],
    compute: ({ amount, rate, months }) => {
      const v = rdMaturity(amount, rate, months);
      return { outputs: [['Total deposited', amount * months], ['Maturity value', v, 'good'], ['Interest earned', v - amount * months]], formula: `A = Σ P × (1 + r/4)^(4 × (n − k + 1)/12), k = 1…${months}\nEach instalment compounds quarterly for the months it stays deposited.`, notes: 'Illustrative; banks may round differently.' };
    },
  },
  {
    id: 'emi', title: 'EMI / Loan Calculator', group: 'Banking',
    inputs: [['amount', 'Loan amount', 10000, 20000000, 10000, 2500000, '₹'], ['rate', 'Interest rate', 5, 30, 0.1, 8.5, '%'], ['months', 'Tenure', 6, 360, 6, 240, 'mo']],
    compute: ({ amount, rate, months }) => {
      const e = emiOf(amount, rate, months), total = e * months, r = rate / 1200;
      const ser = []; let bal = amount;
      for (let m = 0; m <= months; m++) { if (m % 12 === 0 || m === months) ser.push(Math.max(0, bal)); bal = bal * (1 + r) - e; }
      const firstInt = amount * r;
      return { outputs: [['Monthly EMI', e, 'gold'], ['Total interest', total - amount, 'bad'], ['Total payable', total], ['Interest share of the first EMI', `${((firstInt / e) * 100).toFixed(0)}%`]], formula: `EMI = P × r × (1 + r)^n ÷ ((1 + r)^n − 1)\nr = ${rate}% ÷ 12 = ${r.toFixed(5)}, n = ${months}\nEMI = ${Math.round(e).toLocaleString('en-IN')}`, chart: { labels: 'year', series: [['Outstanding', ser]] }, notes: 'Early EMIs are mostly interest. A longer tenure lowers the EMI but raises total interest. Use this for home or personal loans.' };
    },
  },
  {
    id: 'card', title: 'Credit Card Interest', group: 'Banking',
    inputs: [['balance', 'Unpaid balance', 1000, 500000, 1000, 50000, '₹'], ['rate', 'Monthly interest', 1, 4.5, 0.05, 3.6, '%'], ['minpct', 'Minimum due', 2, 10, 1, 5, '%']],
    compute: ({ balance, rate, minpct }) => {
      let b = balance, months = 0, interest = 0;
      while (b > 1 && months < 600) { const i = b * rate / 100; interest += i; b += i; const pay = Math.min(b, Math.max(200, b * minpct / 100)); b -= pay; months++; }
      return { outputs: [['Annualised rate', `${(((1 + rate / 100) ** 12 - 1) * 100).toFixed(1)}% a year`, 'bad'], ['Months to clear paying only the minimum', months >= 600 ? '50+ years' : `${months} (${(months / 12).toFixed(1)} years)`], ['Total interest paid', interest, 'bad']], formula: `Each month: interest = balance × ${rate}%; payment = max(₹200, ${minpct}% of balance)`, notes: 'Illustrative. Real cards also charge GST on interest and late fees. Paying the full bill by the due date usually means no interest on purchases.' };
    },
  },
  {
    id: 'ppf', title: 'PPF Calculator', group: 'Government schemes',
    inputs: [['yearly', 'Yearly deposit (before 5 April)', 500, 150000, 500, 150000, '₹'], ['rate', 'Interest rate', 5, 10, 0.05, 7.1, '%'], ['years', 'Years', 15, 15, 1, 15, 'yr']],
    compute: ({ yearly, rate, years }) => {
      let bal = 0; const ser = [0];
      for (let y = 1; y <= years; y++) { bal = (bal + yearly) * (1 + rate / 100); ser.push(bal); }
      return { outputs: [['Total deposited', yearly * years], ['Maturity value', bal, 'good'], ['Interest (tax-free)', bal - yearly * years]], formula: `Each year: balance = (balance + deposit) × (1 + ${rate}%)\nInterest is worked out monthly on the lowest balance between the 5th and month end, credited every 31 March.`, chart: { labels: 'year', series: [['Balance', ser]] }, notes: `7.1% is the rate notified for Oct–Dec 2026; the government resets it every quarter, so long-run results will differ. Limit ₹1.5 lakh per financial year; 15-year term.` };
    },
  },
  {
    id: 'epf', title: 'EPF Calculator', group: 'Retirement',
    inputs: [['basic', 'Monthly basic + DA', 5000, 500000, 1000, 30000, '₹'], ['growth', 'Yearly salary growth', 0, 15, 0.5, 6, '%'], ['rate', 'EPF interest', 5, 10, 0.05, 8.25, '%'], ['years', 'Years of service left', 1, 40, 1, 25, 'yr']],
    compute: ({ basic, growth, rate, years }) => {
      let bal = 0, b = basic, contrib = 0; const ser = [0];
      for (let y = 1; y <= years; y++) {
        let yearInt = 0;
        for (let m = 0; m < 12; m++) { const c = b * 0.12 + b * 0.0367; bal += c; contrib += c; yearInt += bal * rate / 1200; }
        bal += yearInt; b *= 1 + growth / 100; ser.push(bal);
      }
      return { outputs: [['Your + employer contributions', contrib], ['Projected EPF balance', bal, 'good'], ['Interest earned', bal - contrib]], formula: `Monthly into EPF = 12% (you) + 3.67% (employer) of basic + DA\nThe employer's other 8.33% goes to the pension scheme (EPS), not this balance.\nInterest at ${rate}% is calculated monthly and credited yearly.`, chart: { labels: 'year', series: [['EPF balance', ser]] }, notes: '8.25% was the EPF rate for FY 2025-26; it is declared each year. EPS contributions are capped on a ₹15,000 wage ceiling (not modelled here). VPF lets you add more than 12% at the same rate.' };
    },
  },
  {
    id: 'retirement', title: 'Retirement Planner', group: 'Retirement',
    inputs: [['age', 'Current age', 18, 60, 1, 30, 'yr'], ['retire', 'Retirement age', 45, 70, 1, 60, 'yr'], ['life', 'Plan until age', 70, 100, 1, 85, 'yr'], ['expense', "Monthly expenses today", 5000, 500000, 1000, 40000, '₹'], ['inf', 'Inflation', 2, 10, 0.5, 6, '%'], ['pre', 'Return before retirement', 4, 15, 0.5, 11, '%'], ['post', 'Return after retirement', 3, 10, 0.5, 7, '%']],
    compute: ({ age, retire, life, expense, inf, pre, post }) => {
      const yrs = Math.max(1, retire - age), N = Math.max(1, life - retire);
      const A = expense * 12 * (1 + inf / 100) ** yrs, g = inf / 100, r = post / 100;
      const corpus = Math.abs(r - g) < 1e-9 ? A * N : A * (1 - ((1 + g) / (1 + r)) ** N) / (r - g) * (1 + r);
      const sip = corpus / sipFV(1, pre, yrs);
      return { outputs: [['Yearly expenses at retirement', A], ['Corpus needed at ' + retire, corpus, 'gold'], ['Monthly SIP needed from now', sip, 'good']], formula: `Expenses at retirement A = ${expense} × 12 × (1 + ${inf}%)^${yrs}\nCorpus = A × [1 − ((1 + g)/(1 + r))^N] ÷ (r − g) × (1 + r), N = ${N} years\nSIP = Corpus ÷ SIP-factor(${pre}%, ${yrs} years)`, notes: 'Withdrawals at the start of each retirement year, rising with inflation. Every rate here is an assumption; revisit the plan every year.' };
    },
  },
  {
    id: 'rental', title: 'Rental Yield vs REIT', group: 'Real estate',
    inputs: [['price', 'Property price', 1000000, 50000000, 100000, 8000000, '₹'], ['rent', 'Monthly rent', 1000, 500000, 500, 22000, '₹'], ['costs', 'Yearly costs (maintenance, tax, repairs)', 0, 500000, 1000, 40000, '₹'], ['vacant', 'Vacant months a year', 0, 6, 0.5, 1, 'mo']],
    compute: ({ price, rent, costs, vacant }) => {
      const gross = rent * 12 / price * 100, net = (rent * (12 - vacant) - costs) / price * 100;
      return { outputs: [['Gross rental yield', `${gross.toFixed(2)}%`], ['Net rental yield', `${net.toFixed(2)}%`, net >= 3 ? 'good' : 'bad'], ['Net yearly income', rent * (12 - vacant) - costs]], formula: `Gross = rent × 12 ÷ price\nNet = (rent × (12 − vacant months) − yearly costs) ÷ price`, notes: 'Residential rental yields in Indian cities are often low compared with deposit rates; the rest of any return must come from price growth. REITs offer rental income from commercial property in small amounts with exchange liquidity, with their own risks.' };
    },
  },
  {
    id: 'bond', title: 'Bond Price and Yield', group: 'Fixed income',
    inputs: [['face', 'Face value', 100, 100000, 100, 1000, '₹'], ['coupon', 'Coupon rate', 0, 15, 0.25, 7, '%'], ['years', 'Years to maturity', 1, 30, 1, 10, 'yr'], ['yld', 'Market yield', 1, 15, 0.25, 8, '%']],
    compute: ({ face, coupon, years, yld }) => {
      const p = bondPrice(face, coupon, years, yld);
      const ys = [yld - 2, yld - 1, yld, yld + 1, yld + 2].filter((y) => y > 0);
      return { outputs: [['Bond price', p, p >= face ? 'good' : 'bad'], ['Yearly coupon', face * coupon / 100], ['Price vs face value', `${((p / face - 1) * 100).toFixed(2)}%`]], formula: `Price = Σ C ÷ (1 + y)^t + F ÷ (1 + y)^n\nC = ${face * coupon / 100}, y = ${yld}%, n = ${years}\n` + ys.map((y) => `At ${y}% yield: ₹${bondPrice(face, coupon, years, y).toFixed(2)}`).join('\n'), notes: 'When market yields rise, existing bond prices fall, and longer bonds fall more. That is interest-rate risk. Zero-coupon bond: set the coupon to 0.' };
    },
  },
  {
    id: 'option', title: 'Option Payoff (education only)', group: 'Derivatives',
    inputs: [['type', 'Call (1) or Put (2)', 1, 2, 1, 1, ''], ['side', 'Buy (1) or Sell (2)', 1, 2, 1, 1, ''], ['strike', 'Strike price', 50, 5000, 10, 1000, '₹'], ['premium', 'Premium per unit', 1, 500, 1, 40, '₹'], ['lot', 'Lot size', 1, 1000, 1, 50, '']],
    compute: ({ type, side, strike, premium, lot }) => {
      const call = type === 1, buy = side === 1, sgn = buy ? 1 : -1;
      const pay = (S) => sgn * ((call ? Math.max(S - strike, 0) : Math.max(strike - S, 0)) - premium) * lot;
      const pts = Array.from({ length: 21 }, (_, k) => strike * (0.7 + k * 0.03));
      const be = call ? strike + premium : strike - premium;
      return { outputs: [['Break-even at expiry', be], ['Maximum loss', buy ? premium * lot : 'Unlimited', 'bad'], ['Maximum gain', buy ? (call ? 'Unlimited' : (strike - premium) * lot) : premium * lot, 'good']], formula: `${buy ? 'Long' : 'Short'} ${call ? 'call' : 'put'} payoff at expiry = ${buy ? '' : '−'}(${call ? 'max(S − K, 0)' : 'max(K − S, 0)'} − premium) × lot`, chart: { labels: 'price', x: pts.map((p) => p.toFixed(0)), series: [['Profit / loss at expiry', pts.map(pay)]] }, notes: 'Educational simulation, not a recommendation to trade. Most individual traders in futures and options lose money; option sellers can face losses far larger than the premium received.' };
    },
  },
  {
    id: 'cover', title: 'Life Cover Needed', group: 'Insurance',
    inputs: [['expense', "Family's yearly expenses", 50000, 10000000, 10000, 600000, '₹'], ['years', 'Years they need support', 1, 40, 1, 20, 'yr'], ['loans', 'Outstanding loans', 0, 50000000, 50000, 2000000, '₹'], ['goals', 'Future goals to fund (education etc.)', 0, 50000000, 50000, 1500000, '₹'], ['assets', 'Savings and existing cover', 0, 50000000, 50000, 1000000, '₹']],
    compute: ({ expense, years, loans, goals, assets }) => {
      const need = Math.max(0, expense * years + loans + goals - assets);
      return { outputs: [['Suggested term cover', need, 'gold']], formula: 'Cover ≈ yearly expenses × years of support + loans + goals − savings − existing cover', notes: 'A simple needs-based rule of thumb (it ignores inflation and investment returns on the payout). Pure term insurance is usually the cheapest way to buy cover; insurance and investment are better kept separate.' };
    },
  },
  {
    id: 'emergency', title: 'Emergency Fund', group: 'Personal finance',
    inputs: [['monthly', 'Essential monthly expenses', 5000, 500000, 1000, 35000, '₹'], ['months', 'Months to cover', 3, 12, 1, 6, 'mo'], ['have', 'Already set aside', 0, 5000000, 5000, 50000, '₹']],
    compute: ({ monthly, months, have }) => ({ outputs: [['Target emergency fund', monthly * months, 'gold'], ['Still to build', Math.max(0, monthly * months - have)]], formula: `Target = essential monthly expenses × months = ${monthly} × ${months}`, notes: 'Keep it somewhere safe and quick to withdraw, such as a savings account, sweep FD or liquid fund.' }),
  },
  {
    id: 'budget', title: '50/30/20 Budget', group: 'Personal finance',
    inputs: [['income', 'Monthly take-home income', 5000, 1000000, 1000, 60000, '₹']],
    compute: ({ income }) => ({ outputs: [['Needs (50%)', income * 0.5], ['Wants (30%)', income * 0.3], ['Savings and investing (20%)', income * 0.2, 'good']], formula: 'Needs 50% · Wants 30% · Savings 20% of take-home pay', notes: 'A starting guideline, not a rule. Pay yourself first: move the savings share on payday.' }),
  },
];

export const calcById = Object.fromEntries(CALCULATORS.map((c) => [c.id, c]));
export const defaults = (c) => Object.fromEntries(c.inputs.map(([k, , , , , v]) => [k, v]));
export { r2 };
