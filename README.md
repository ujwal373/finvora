# FinVora by AccoFinTra

Enter the World of Finance. An interactive 3D financial city that runs in any modern browser on Windows, Mac, Android, iPhone and tablets.

FinVora is an educational simulation. All money in it is virtual and every price is simulated. Nothing in it is financial advice.

## Play it

`dist/index.html` is the whole game in ONE file. Double-click it, or send it to a phone and open it in the browser. No server, no login, no internet needed. Progress is saved in that browser.

To put it online, see HOSTING.md. A ready-built copy is in site/index.html: drag the site folder onto Netlify Drop for a live link in a minute, or push this folder to GitHub and the included workflow publishes it to GitHub Pages.

## Name the NPCs

Open `src/data/npcNames.js`, type a name between the quotes for each character, then run `npm run build`. Empty names show the role title.

## Develop

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173 (reachable from your phone on the same Wi-Fi)
npm test             # 84 unit tests: maths, finance and life engine, tax, collision, navigation, agents, saving
npm run build        # produces the single-file dist/index.html
python3 tests/playtest.py file://$PWD/dist/index.html ./shots   # headless browser playtest (needs Playwright)
```

## What's inside

A 9 × 9 block city with 22 working buildings, a business district, lake, stadium, homes, parks and a bazaar; traffic that keeps left and brakes for people; 21 named agents who answer typed money questions offline, led by Parth with Aanya at the central fountain; and a ₹10,00,000 virtual wallet.

Every building does something real:
Stock Exchange (shares, ETFs), Bond Market (G-Secs, T-bills, rated corporate bonds with defaults), Derivatives Exchange (paper futures and options, gated by a risk course), Commodities (digital gold and silver, Sovereign Gold Bonds), Research Centre (quarterly results, analyst views, IPOs with lottery allotment), Bank (savings, UPI and debit, credit card with statements and autopay, FDs, RDs, loans priced by credit score), Credit Bureau (300 to 900 score built from your history), Mutual Fund Centre (funds, SIPs), FinTech Hub (simulated KYC and UPI, scam and link safety labs), Academy (8 courses with quizzes and certificates), Insurance (term, health, motor with zero-dep; random life events test your cover), Retirement (EPF from salary, NPS, annuities), Real Estate (buy with RBI loan-to-value rules and stamp duty, rent, REITs), Government Savings (PPF, NSC, SCSS, SSY), Tax Office (FY 2026-27 slabs, both regimes, return filing with TDS, capital gains statement), Job Centre (8 jobs, payslips with PF, TDS and professional tax), SuperMart (grocery plans and monthly bills), FinVora Fuels (petrol, CNG, EV charging; vehicles use fuel as you drive), Motors showroom, Style Studio, Calculator Centre and AccoFinTra Tower (investor relations, AGM letter, careers, logo on the tower).

Controls on PC: click once for mouse look, WASD to move, E to interact, Up arrow or T for the phone, Down arrow or Backspace to go back, P for the portfolio, M for the map, Esc to free the cursor.

## Accounts later (optional)

Guest play needs nothing. When FinVora goes online, Supabase accounts can be switched on for cross-device saving: run `supabase/schema.sql` in a free Supabase project and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to `.env.local`. Guest play stays available. Public sign-ups need a custom SMTP provider, because Supabase's built-in mailer only sends to your own team.

## Data honesty

Companies, funds, ETFs, prices and news are fictional and labelled as such. Government scheme rates are the ones notified for Oct–Dec 2026 (PPF 7.1%, NSC 7.7%, SCSS 8.2%, SSY 8.2%) and the EPF rate is the FY 2025-26 rate (8.25%), held constant inside the simulation. FinVora Bank's FD, RD and loan rates are illustrative.
