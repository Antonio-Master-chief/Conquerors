# CONQUERORS — Real-Time Strategy

A 2D isometric RTS in the spirit of *Age of Empires II*. Runs in any modern browser, optimized for mobile (iPhone 12 baseline).

## How to run

Open a terminal in this folder and serve it statically, e.g.:

```
npx serve .
```

or just double-click `index.html` (everything is dependency-free vanilla JS — no build step, no internet needed).

## Phase 1 (this build)

- Isometric procedural map: grass, forests, sand, shallow & deep water, cliffs of resources
- Resources: **Food, Wood, Gold, Stone, Iron + Knowledge** (from traders/ruins/towns)
- Settlers gather / build / repair; farms; full economy
- **Population grows ONLY by capturing neutral NPC towns** (the core differentiator)
- Fog of war, minimap, exploration encounters (traders grant Knowledge, ruins give bonuses)
- 4 Ages: Settlement → Bronze → Imperial → Conquest, advanced from the Town Center for
  gold + food (Bronze is resource-only; Imperial/Conquest also want captured towns)
- **Storehouses + ox carts**: build a drop-off near forests/mines so settlers don't trek
  to the Town Center; ox carts haul batches home (resources dip in transit, restored on
  delivery — raid a cart to cut the supply line)
- **Two kinds of water**: the salty **sea** (build docks, fish) and inland **freshwater
  lakes** (tinted green — the only water that feeds farms & canals). Every start gets a
  freshwater pond
- **24-direction unit facing** — units turn smoothly, always facing where they move
- Click any building to open its panel: train settlers/units, advance ages, dispatch carts
- Mouse map navigation: **edge-pan** (push cursor to a screen edge) + arrow/WASD; left-click
  to command, drag to box-select, double-click to select all of a type. Full touch controls
  for mobile (tap-select, tap-command, drag-pan, pinch-zoom)
- University tech tree fueled by Knowledge (blades, armor, masonry, Greek Fire, Wootz Steel…)
- Veterancy: combat XP + Training Grounds drill aura (Recruit → Veteran → Elite, chevron insignia)
- 3 civilizations, fully asymmetric:
  - **Romans** — Legionaries, Centurion command aura, faster drilling, Greek Fire (Age IV)
  - **Chinese** — Chu Ko Nu repeating crossbows, stronger/faster buildings, passive Knowledge
  - **Indians** — War Elephants, Chariot Runners, Ayurvedic regeneration, gold bonus
- 2 AI opponents with economy, scouting, town-capture racing, counter-composition attack waves
- **Irrigation**: farms only grow with water — build near lakes/rivers or chain **Canals**
  from a water source; if an enemy cuts the canal line, your farms dry up (a pond is
  guaranteed near every start)
- Day/night cycle, coastline foam, chimney smoke, dry-crop visuals
- **Adaptive soundtrack** — calm harp & flute theme in peace, war drums and horns in battle —
  plus wind/birdsong ambience (all WebAudio-synthesized, no assets)
- **Voice-overs** (speech synthesis) for attacks, captures, age-ups, research, victory/defeat,
  and vocal acknowledgments when commanding units
- Idle-settler button above the minimap
- Procedural sprite art (8-ish directions, walk/attack animation, distinct silhouettes per unit)
- Mouse/keyboard + full touch controls (tap select, drag pan, pinch zoom)

## Phase 2 (this build) — NAVAL

- **Docks** built on shallow shore water; train ships and act as fish drop-off
- **Fishing Boats** work fish shoals (major coastal food source)
- **Transport Ships** carry up to 5 population of troops — tap a shore to beach-land them
- **War Galleys** (all civs) plus unique warships:
  - Rome: **Quinquereme** — heavy artillery platform with archer tower
  - China: **Fire Ship** — rams and burns enemy fleets (single use)
  - India: **War Catamaran** — fast, cheap twin-hull skirmisher
- **Island towns**: 1-2 neutral towns spawn on ocean islands with rich fishing grounds
  and gold — reachable only by transport, a naval route to population
- Ships bob on the water, leave foam wakes; AI builds docks, fishes, and floats patrol ships

## Phase 3 (this build) — SIEGE, SABOTAGE & STATECRAFT

- **Realistic sieges**: surround an enemy settlement with 5+ troops and it falls *Under Siege* —
  defenders starve (-25% attack, no healing, HP decay on long sieges). Starve them out
  or assault the walls: both are real strategies now
- **Poison Wells** (Age III tech): scouts can foul an enemy water source — troops near it
  sicken for 90s (-20% damage, health drain). Cut supplies, poison water, then strike
- **Terrain advantage**: *highlands* give +20% attack, reduced damage taken, and +0.6 range
  for archers; standing by trees gives forest cover (-30% from arrows)
- **Merchants 2.0**: wandering merchants remember every kingdom they visit.
  **Bribe one (100 gold)** to buy his travel maps (explored map area), the **location of
  every rival kingdom he's seen**, and his loyalty — he becomes your trade caravan,
  paying gold each round trip. Merchants are untouchable inside kingdom borders,
  but can be hunted in the wilderness to deny rivals his knowledge
- Game speed toggle (1×/2×/3×)

## Phase 4 (the vision) — ONE WORLD multiplayer

- One massive persistent map; players spawn at random locations and explore
- **Kingdoms of up to 5 players**: one King rules the capital, up to 4 Generals
  each govern a colony of the kingdom
- Trade routes between kingdoms; merchant intel economy; espionage
- Full siege warfare between kingdoms; terrain, supply lines and naval blockades
- Walls & gates, save/load, Wonders, AI amphibious assaults, market, per-age architecture

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Select | Left-click a unit (sprite hit-test) / drag box | Tap a unit |
| Select all of one type on screen | Double-click a unit | Double-tap a unit |
| Command (move/attack/gather/board) | **Left-click or right-click** the map/target | Tap target with units selected |
| Set rally point (production building selected) | Right-click ground | Tap ground |
| Deselect / cancel | Escape | Long-press (hold ~half a second) |
| Pan camera | WASD / arrows / middle-drag | One-finger drag |
| Zoom | Mouse wheel | Pinch |
| Jump camera | Click/drag minimap | Tap/drag minimap |

Every command answers with a ground marker (green move, red attack, gold gather,
blue rally) and units respond instantly.

To play on your iPhone: run the server on this PC, find the PC's local IP
(`ipconfig` → IPv4), then open `http://<that-ip>:8123` in Safari on the phone
(both devices on the same Wi-Fi).
