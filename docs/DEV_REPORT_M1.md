# FINWORLD · Milestone 1 development report

Milestone: Playable 3D Foundation (plus the Section 18 account and cloud-save groundwork)
Date: 25 November 2026
Status: complete and tested, awaiting approval before Milestone 2

## What was built

The 3D city
A compact financial district on a 3 by 3 block grid with paved boulevards, crossings, street trees, lamps and a city-edge hedge. All 12 required locations stand in it as distinct low-poly buildings (classical Stock Exchange with a scrolling LED ticker, glass FinTech Hub, stepped Real Estate tower, domed Academy and others), each with a lit entrance, sign and glowing door marker. The central block is Compound Square, a park with paths, benches and a fountain topped by a spinning gold rupee coin. A full day and night cycle runs (one game day is 24 real minutes): sky, sun and fog shift colour, building windows light up and street lamps glow after dusk.

Player, camera and controls
One controllable character with procedural walk, run, idle and jump animation. Third-person orbit camera that never clips into buildings or tree crowns. PC: W A S D or arrows, Shift run, Space jump, mouse drag look, wheel zoom, E interact, 1 to 4 dialogue replies, M map, J journal, Esc menu. Touch: floating left-thumb joystick, right-side drag to look, TALK/ENTER, RUN toggle and JUMP buttons. Both drive one shared input snapshot, so game logic is identical on every platform.

Collision
Buildings, the fountain, benches, trees and lamps block movement. The player slides along walls instead of sticking. City bounds are enforced.

Interactive buildings (3 open in Milestone 1)
Stock Exchange: desk guide dialogue and a market board of 8 fictional companies whose simulated prices tick every 2 seconds, labelled as fictional simulation everywhere they appear, including on the façade ticker.
Banking District: customer desk dialogue (recurring deposits, credit card interest) and the Interest Wall: simple vs compound interest with live sliders, compounding frequency, a growth chart and the formulas shown with the player's numbers substituted in.
Financial Academy: admissions desk dialogue and the Doubling Lab: Rule of 72 against the exact formula ln 2 ÷ ln(1 + r), with a table showing where the shortcut drifts.
The other 9 buildings can be entered too. Each explains its purpose and lists its services with the milestone that opens them, so nothing is decorative and nothing pretends to work early.

Five independently moving NPCs
Each has a name, profession, look, name tag and a different movement pattern.
Meera Iyer, Bank Manager: hourly daily routine (bank, lunch in the park, evening at the Mutual Fund Centre).
Arjun Mehta, Stock Broker: hurried circuit between Exchange, Derivatives, Bond Market and Research.
Prof. Kavita Rao, Financial Professor: commutes between Academy and Research Centre.
Ravi Kumar, Retail Investor: wanders the whole city.
Insp. Sana Qureshi, Fraud Investigator: non-stop street patrol.
NPCs path-find with A* over the boulevard grid, keep to lanes, avoid each other, pause politely if you block them, and stop and turn to face you when you talk. Medium graphics adds 8 ambient residents (Low 4, High 14) who share one-line tips.

Dialogue and learning
Branching conversations (8 trees, 30 nodes) covering deposits and DICGC cover, EMIs, shares and T+1 settlement, compounding, inflation, the Rule of 72, diversification, beginner mistakes, emergency funds, fraud red flags, SEBI registration checks and the UPI PIN scam. Every idea picked up is added to a Knowledge Journal. The dialogue runner is data-driven with a provider seam so AI conversations can be added later without paid APIs being needed now.

Interface
Dark charcoal and gold design system. HUD with player card, virtual wallet labelled "simulated money", clock, minimap, save indicator and FPS counter. Interaction prompts, toasts, a 3-step tutorial, a full city map with waypoints and an in-world beacon, and a pause menu with Settings (Low/Medium/High graphics, sensitivity, invert Y, FPS), Journal, Controls and Account tabs.

Accounts and cloud save (Section 18)
Welcome screen with Create Account and Login, full-name/email/password/confirm registration, email verification, forgot password, reset password, resend verification, persistent sessions and logout, all through Supabase Auth. First login shows a welcome with the player ID and the ₹10,00,000 virtual wallet. The database schema creates profile, wallet and save slot exactly once at sign-up through a trigger, so logging in can never re-initialise a wallet. Row Level Security limits every player to their own rows; clients have no write access to wallets or transactions at all. Saving is debounced, checkpoint-based and versioned: an older device can never overwrite newer progress, conflicts keep a local backup, offline changes queue in IndexedDB and sync when the connection returns. The indicator shows Saving…, Saved to Cloud, Save Failed or Offline Mode, and only says saved after the database confirms.

## Testing

Unit tests (vitest): 34 passing. Collision maths and a check that no player can end up inside any building; building layout (12 locations, no overlaps, every door reachable); navigation routes between every pair of places sampled for collisions; patrol loop validity; all dialogue trees validated (every node reachable, no dead ends, links resolve, unique journal ids); interest and doubling maths checked against independent formulas, including every number quoted in dialogue; fictional market determinism and absence of real tickers; save-state migration; the SaveService cloud path against a fake Supabase (confirmation-before-"saved", offline queue and later upload, cloud-wins-on-conflict with backup).

Database tests: `supabase/schema.sql` run against PostgreSQL 16 with mocked Supabase auth. Verified: sign-up trigger creates rows with ₹10,00,000; RLS isolation between two players; direct wallet updates and transaction inserts are denied; `ensure_player` does not reset a wallet; versioned saves increment and stale saves are rejected; money fields are stripped from save blobs; anonymous users can read nothing; the script is safe to re-run.

Automated playtest: the production build driven in headless Chromium with software WebGL, desktop 1280×760 and an iPhone-sized touch viewport. 26 of 26 checks passing: auth gate blocks the world, welcome wallet, movement, mouse look, wall collision, all five NPCs moving, NPC dialogue and journal, all three open buildings plus a planned one, the Interest Wall result (₹1,00,000 at 10% yearly for 20 years gives ₹6,72,750), desk dialogue, map waypoint, graphics presets, save and restore after reload, mobile Low default, joystick movement, touch look, the TALK/ENTER button, and no horizontal overflow at 390 px. No page errors.

## Honest limitations

1. The Supabase sign-up, login and cloud-save flow has not run against a live Supabase project, because no project keys were available here. The SQL and the save logic are tested as described above; the end-to-end check needs your project (about 10 minutes, see README).
2. Supabase's built-in mailer only sends to members of your Supabase team and is heavily rate limited, so public registration needs a custom SMTP provider before launch.
3. Building interiors are lobby panels over the 3D scene, not walkable 3D rooms. Walkable interiors for the three open buildings would fit naturally into Milestone 2.
4. Performance was measured only in a software renderer. Real numbers on your i5-1335U laptop and on actual phones still need checking. Medium preset issues about 330 draw calls including the shadow pass; merging static building meshes is planned for Milestone 6 if needed.
5. No audio yet, so there is no audio setting rather than a dummy one.
6. Level and XP are displayed but nothing awards XP until Milestone 5.

## Proposed Milestone 2 (Living City), for approval

Walkable 3D interiors for the Exchange, Bank and Academy; full daily routines for all key NPCs including home/office schedules; the remaining five named NPCs (Mutual Fund Advisor, Financial Analyst, Fund Manager, Insurance Consultant, Tax Consultant); NPC-to-NPC idle conversations; richer branching dialogue with conditions based on what the player has learned; ambient audio with a real audio setting.
