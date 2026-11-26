# FINWORLD · Round 2 development report

Date: 25 November 2026
Scope requested: name all NPCs, add cars, bigger map with more investment features, everything free and open (use but not edit), 10 to 20 helper NPCs that act like real agents, a single HTML file, PC and mobile.

## Delivered

Single HTML file
`dist/index.html` (about 870 KB, 245 KB gzipped) contains the entire game: Three.js, styles, logic and generated textures. It runs from disk with no server and no internet.

Free and open, nothing editable
No login. Players enter a name (optional) and play as a guest; progress is saved in their browser. Every building is open from the start. Players can use every facility but cannot change game content, and their transaction history is an append-only ledger whose entries are frozen and cannot be edited or deleted. The Supabase account code and schema remain in the project, switched off, for when FINWORLD goes online.

Bigger city
The map grew from 3 × 3 to 5 × 5 blocks (about 262 m across instead of 162 m). New: Government Savings Office, Tax Office, Financial Calculator Centre, nine residential blocks where NPCs live, three gardens and a bazaar where they lunch. Pavements now line every road.

Traffic
Hatchbacks, sedans, black-and-yellow taxis, auto-rickshaws and buses drive the boulevards, keep left as in India, choose turns at junctions, slow for corners, queue behind each other and stop for the player and for pedestrians. Vehicles are solid: the player cannot walk through them. Low/Medium/High presets run 8/14/20 vehicles.

Investment features (all working with the ₹10,00,000 virtual wallet)
Stocks and ETFs: 8 fictional companies and 4 ETFs (market index, gold, silver, liquid), buy and sell by quantity, FIFO cost basis, realised and unrealised P&L, 1-month/6-month/1-year returns, price charts, a market board with simulated news, a Research Centre with each company's fundamentals and P/E, and a Commodities board.
Mutual funds: 11 fictional funds across index, large, flexi, mid and small cap, ELSS (3-year lock-in enforced), aggressive hybrid, short duration debt, liquid, gold and international. Lump sum, redemption with exit load, SIPs and step-up SIPs that run automatically on their dates.
Banking: FDs (quarterly compounding, premature penalty), RDs (monthly auto-debit, missed instalments recorded), personal loans with real EMI amortisation, auto-debit, late fees and prepayment, plus savings interest credited quarterly.
Government schemes: PPF (₹1.5 lakh per FY limit, interest on the lowest balance between the 5th and month end, credited 31 March), NSC, SCSS (age 60+, quarterly payouts), Sukanya Samriddhi (girl under 10) and NPS (market-linked, exit at 60 under the December 2025 80/20 rule).
Portfolio: net worth, allocation, holdings, XIRR, realised and unrealised P&L, the permanent ledger, and time controls (time runs at one simulated day per ~20 seconds; jump +1 day, week, month, 6 months or a year).
Calculators: 20, each showing inputs, formula with your numbers, chart and assumptions: SIP, step-up SIP, lump sum, SWP, CAGR, inflation, goal, FD, RD, EMI, credit card, PPF, EPF, retirement, rental yield vs REIT, bond price and yield, option payoff, life cover, emergency fund and 50/30/20 budget.
Also: Holding-period checker at the Tax Office (equity short vs long term using current rates), Scam-spotting lab at the FinTech Hub.

NPCs as agents
20 characters: the original 5 plus 15 helpers (Mutual Fund Advisor, SIP Coach, Fund Manager, Financial Analyst, ETF and Index Specialist, Loan Officer, Credit Card Counsellor, Deposits Officer, Small Savings Agent, Retirement Planner, Tax Consultant, Insurance Consultant, Budget Coach, Cyber Safety Officer, Market Reporter). Each lives a daily routine (home at night, desk by day, lunch at the bazaar or park, evening errands), stops to chat with colleagues (speech bubbles), and in conversation offers suggested questions plus a box to type any money question. Answers come from an offline knowledge base of 75 entries; if a colleague is the specialist, the agent says so, answers briefly and offers to guide you to them with a live waypoint, or to open the right building. The Market Reporter announces big simulated news.

Names
Every name lives in `src/data/npcNames.js`. All 20 are blank and show role titles until the owner supplies names.

## Testing

Unit tests: 59 passing (finance engine, SIP and step-up schedules, ELSS lock-in, exit loads, FD maturity and penalties, EMI amortisation, PPF limits and interest timing, SCSS and SSY eligibility, NPS exit rule, XIRR, all 20 calculators, market determinism, collision, navigation across the larger city, all 20 conversations, knowledge-base routing to the right specialist, saving).
Browser playtest of the single file opened from disk: 28 of 28 checks on desktop and an iPhone-sized touch screen, including traffic driving and braking for the player, buying shares, investing, starting a SIP and watching it run after a month fast-forward, opening an FD, PPF deposit, calculators, typed questions with referral, save and restore, joystick and touch controls, and no layout overflow at 390 px. No page errors.

## Honest limitations

1. Performance was measured in a software renderer only. Medium preset draws about 430 calls per frame including shadows; please check on your laptop and a real phone and use Low if needed.
2. The knowledge base matches keywords; it is not a language model. Unusual phrasing can miss, in which case the agent suggests topics.
3. Government scheme rates are held constant at today's notified rates; real rates reset every quarter.
4. Guest saves stay in one browser on one device until accounts are switched on.
5. Interiors are still panels over the 3D scene, and there is no sound yet.
