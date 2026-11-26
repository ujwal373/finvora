# FINWORLD architecture

## Stack and why

| Layer | Choice | Reason |
|---|---|---|
| Rendering | Three.js (WebGL), no game engine | Smallest runtime that gives full 3D on every browser, including iPhone Safari and integrated GPUs. |
| Language | Modern JavaScript (ES modules) | Matches the brief, no compile step beyond Vite. Moving to TypeScript later is mechanical; the modules are already typed by shape. |
| Build | Vite | Fast dev server reachable from phones on the LAN, code splitting (login screen loads before the 3D engine). |
| Auth and cloud save | Supabase Auth + PostgreSQL with Row Level Security | Required by Section 18. Free tier, no password storage on our side. |
| Local persistence | IndexedDB (idb-keyval) | Offline queue, conflict backups, Local Preview saves. |
| Charts | Inline SVG for now | Milestone 1 only needs one tiny chart; Chart.js or uPlot can come in Milestone 3 for portfolio charts. |
| Assets | Generated at runtime | Every texture (windows, signs, pavers, grass, labels) is drawn on small canvases. Zero image downloads. |

## Folder structure

```
finworld/
  index.html               single page, canvas + HUD + overlay + auth layers
  src/
    main.js                boot: auth gate, then lazy-load the game
    config.js              world constants, graphics presets, ₹ formatting
    core/                  Game loop, Input (keyboard, mouse, touch), CameraRig
    world/                 City builder, Collision (pure maths), Places
    entities/              Character (procedural low-poly humans), Player
    npc/                   NavGraph (A* over the boulevard grid), NPCManager (brains)
    interaction/           DialogueRunner (branching trees, AI-ready provider seam)
    sim/                   FictionalMarket (clearly labelled simulated prices)
    data/                  buildings, NPC roster, dialogue trees (content, no logic)
    services/              supabase client, account (auth/profile), SaveService
    ui/                    HUD, AuthScreen, DialogueView, Panels, Exhibits, design-system CSS
    styles/main.css        design tokens and components
  supabase/schema.sql      tables, RLS, triggers, RPCs
  supabase/tests/          schema verification against plain PostgreSQL
  tests/                   unit tests (vitest) and a headless browser playtest
  docs/                    this file and milestone reports
```

Future districts plug in as more entries in `data/buildings.js` plus another block on the grid. Future instruments become modules under `sim/` with their own mechanics (never one generic return formula).

## Data honesty

Every number shown is one of four kinds, and the UI says which: real market data (none yet), historical data (none yet), fictional simulation (the Exchange board), or the player's own assumptions (calculator inputs). Real NSE/BSE prices and AMFI NAVs need licensing review before integration and are not used anywhere in Milestone 1.

## Security model

The browser holds only the publishable key. Players can read only their own rows. There is no client write path to wallets or transactions at all: those change only through server-side SQL functions, which Milestone 3 will add for trades with validation. Saves go through `save_game_state`, which uses optimistic versioning so an older device can never overwrite newer progress, and which strips any money fields from the save blob.

## Performance

Low / Medium / High presets control pixel ratio, shadows, crowd size, tree density and draw distance. Phones default to Low. An adaptive resolution loop lowers render scale if frame rate stays under 28 FPS and recovers when there is headroom. Characters are 6 draw calls each with one shared vertex-coloured material. Trees, lamps and road markings are instanced.
