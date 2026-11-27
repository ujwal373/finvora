# FinVora by AccoFinTra

Enter the World of Finance. An interactive 3D financial city that runs in any modern browser on Windows, Mac, Android, iPhone and tablets.

FinVora is an educational simulation. All money in it is virtual and every price is simulated. Nothing in it is financial advice.

## Play it

`dist/index.html` is the whole game in ONE file. Double-click it, or send it to a phone and open it in the browser. No server, no login, no internet needed. Progress is saved in that browser.

To put it online later, upload that single file to any free static host (GitHub Pages, Netlify, Cloudflare Pages, Vercel) and share the link.

## Name the NPCs

Open `src/data/npcNames.js`, type a name between the quotes for each character, then run `npm run build`. Empty names show the role title.

## Develop

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173 (reachable from your phone on the same Wi-Fi)
npm test             # 86 unit tests: maths, finance and life engine, tax, collision, navigation, agents, saving
npm run build        # produces the single-file dist/index.html
python3 tests/playtest.py file://$PWD/dist/index.html ./shots   # headless browser playtest (needs Playwright)
```

## What's inside

A 13 × 13 block city (about 660 m across) with AccoFinTra Tower at the centre where you spawn, a business district, two lakes, a stadium, homes, parks and a bazaar. Every landmark has its own design: the glass AccoFinTra Tower with its logo, a tall exchange tower with a bronze bull (inspired by Mumbai's historic exchange building), a classical domed bank, a glass car showroom, a fashion boutique with mannequins, a supermarket with parking, a petrol and EV station, and your own house with a garage.

Walk-in interiors with counters, token numbers and staff: AccoFinTra Tower (16 counters for funds, SIPs, bonds and derivatives, gold, research and IPOs, small savings, insurance, retirement, tax, property, jobs, credit bureau, FinTech and cyber safety, the academy, calculators and investor relations), FinVora Bank (accounts and cards, deposits, loans, manager), the Stock Exchange trading hall (share trading, ETFs, listings and IPOs, a giant index board and ticker ribbon) and your home (laptop, wardrobe, bed, TV, garage). Named agents serve at their counters from 9 am to 6 pm and walk the city after hours; a desk team covers the rest of the day.

21 named agents led by Parth, with Aanya, greet you in front of the tower. Traffic keeps left; city buses stop at 7 shelters (₹10 to ₹30) and you can call an auto-rickshaw from the phone (meter fare). Trading follows market hours (9:15 am to 3:30 pm on weekdays, after-market orders otherwise) with realistic charges (brokerage, STT, exchange and SEBI fees, stamp duty, GST, DP). Every IPO is a newly invented fictional company.

Plus everything from earlier rounds: jobs and salary, credit card and credit score, bonds, gold, F&O paper trading, insurance with life events, property and REITs, tax filing, the phone, vehicles with fuel, and clothes.

Controls on PC: click once for mouse look, WASD to move, E to interact, Up arrow or T for the phone, Down arrow or Backspace to go back, P for the portfolio, M for the map, Esc to free the cursor.

## Accounts later (optional)

Guest play needs nothing. When FinVora goes online, Supabase accounts can be switched on for cross-device saving: run `supabase/schema.sql` in a free Supabase project and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to `.env.local`. Guest play stays available. Public sign-ups need a custom SMTP provider, because Supabase's built-in mailer only sends to your own team.

## Data honesty

Companies, funds, ETFs, prices and news are fictional and labelled as such. Government scheme rates are the ones notified for Oct–Dec 2026 (PPF 7.1%, NSC 7.7%, SCSS 8.2%, SSY 8.2%) and the EPF rate is the FY 2025-26 rate (8.25%), held constant inside the simulation. FinVora Bank's FD, RD and loan rates are illustrative.
