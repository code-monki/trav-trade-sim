# AGENTS.md — Traveller Trade Simulator

Use this file as the restart primer when beginning a new conversation on this project.

---

## Project Summary

A Vite + Vue 3 single-page application for running speculative trade in Classic Traveller campaigns.
The Referee advances an in-game clock; commodity prices shift deterministically each tick based on
world trade codes, market events, and seeded RNG. Players identify profitable routes, trade cargo,
book passengers, purchase fuel, and accept mail contracts across the Third Imperium.

**Hosted on GitHub Pages. Non-commercial use only — Mongoose Publishing fan-site policy.**

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 Composition API + SFC, Pinia, Vue Router (hash mode) |
| Build | Vite; `src/` tree; `index.html` at root |
| Database | Supabase (PostgreSQL + RLS + pgcrypto) |
| Auth | Custom PIN-based auth via Supabase RPC (bcrypt, no email/PII) |
| Charting | `lightweight-charts` v4 (TradingView OSS) — canvas-based, theme via `applyOptions()` |
| Theming | CSS custom properties on `:root`; IndexedDB for user themes; 3 built-in themes |
| Static world data | TravellerMap public API (`https://travellermap.com/doc/api`) |

---

## Security constraints (MUST be preserved)

- PIN is **mandatory** — no optional skip
- PIN stored as bcrypt hash via pgcrypto, never reversible, never logged
- Rate limit: 5 failed attempts → 15-minute lock (enforced in `verify_pin` RPC)
- Supabase `anon`/publishable key is safe to expose in the client bundle (RLS enforces security)
- Service role key must **NEVER** be committed to the repo or included in the bundle
- No email or PII stored — identity is `(campaign_id, character_name, hashed_PIN)` only

---

## Source tree

```
src/
  assets/
    style.css               Global CSS custom properties, focus indicators
  components/
    AboutDialog.vue         Mongoose disclaimer + version + GitHub link
    BuyDialog.vue           Purchase quantity dialog (tons stepper, Max button, credit check)
    CargoHold.vue           Hold display + sell flow (ship status bar, inline sell confirm)
    CharacterDialog.vue     Character stats popup
    ContractsPanel.vue      Ship > Contracts sub-tab — mail contracts in transit + pending payout
    EventsHistory.vue       Event history list with severity filters
    HamburgerMenu.vue       Three-bar menu → Themes / About / Help / Sign Out
    HelpDialog.vue          User Manual + Keyboard Shortcuts (two tabs)
    MarketTable.vue         36-row trade goods table with sort, filter, event flags, chart checkboxes
    PassengerManifest.vue   Ship > Manifest sub-tab — stateroom/berth occupancy + in-transit passengers
    PassengersPanel.vue     Port > Passengers sub-tab — booking form with capacity check + fare preview
    PriceChart.vue          lightweight-charts chart (Weekly/Monthly/Annual/Realized tabs)
                            All colours read from CSS vars via cssVar(); re-themed on
                            themeStore.revision watch (covers both init() and setTheme())
    RecoveryCodeDialog.vue  One-time recovery code display (teleported to body)
    RouteAnalysis.vue       Jump range route table with profit projection
    ShipServices.vue        Port > Services sub-tab — fuel purchase (fill bar, cap check) + mail booking
    ThemeDialog.vue         Theme list, per-token colour editor, export/import JSON
    TutorialDialog.vue      Sidebar-nav tutorial viewer with cross-ref links + Prev/Next
  composables/
    useFocusTrap.js         Tab-trap composable used by all dialogs
  lib/
    market-events.js        43 market events (minor/major/crisis); maybeGenerateEvent()
    market-tick.js          Deterministic snapshot generation, Imperial calendar helpers
                            TICKS_PER_YEAR=48, BASE_YEAR=1105, makeRng() (FNV-1a + mulberry32)
    passengers.js           Pure functions: passengerFare, passageCapacityNeeded, availableFuelTypes,
                            jumpFuelTons, fuelCost, mailPayment — no randomness, callers supply inputs
    supabase.js             Supabase client initialisation
    theme-db.js             IndexedDB wrapper for user themes
    theme-tokens.js         Canonical CSS token list (used by ThemeDialog and applyTheme)
    themes-builtin.js       3 WCAG 2.2 AA verified built-in themes (dark/light/sepia)
    trade-engine-ct7.js     CT Book 7 trade engine — pure functions, no side-effects
    trade-engine-t5.js      T5 trade engine — pure functions, no side-effects
    traveller-data.js       Lookup tables: CT2_TRADE_GOODS, UWP decoders, trade code maps
    traveller-helpers.js    parseTabDelimited(), decodeUWP(), parseSectorRoutes()
    tutorials.js            In-app tutorial content (HTML strings, cross-ref links)
  router/
    index.js                Hash-mode router; / → MapView, /login → LoginView, /referee → RefereeView
                            ALWAYS use push({ name: 'routeName' }) — never push('/path')
  stores/
    auth.js                 Campaign/player session (localStorage), createCampaign/login/logout
    map.js                  Sector + world data from TravellerMap API; UWP/route computed
    referee.js              Referee panel data — ships, crew, events, players; createShip includes
                            fuelCapacity / fuelCurrent params
    ship.js                 Ship, cargo, passengers, mail; buy/sell/fuel/passenger/mail actions;
                            purchaseFuel validates against fuel_capacity - fuel_current and updates
                            fuel_current; updateLocation auto-delivers matching passengers + mail
    theme.js                Pinia theme store; revision ref increments on every applyTheme()
    tick.js                 Imperial calendar, tick advance, ensureWorldSnapshot (lazy + backfill),
                            price history queries, market events
  views/
    LoginView.vue           Sign In / Join Campaign / New Campaign / Reset PIN
    MapView.vue             Main layout — two-level tabs:
                              TOP_TABS: overview / port / ship / events / jump
                              PORT_TABS (port): market / passengers / services
                              SHIP_TABS (ship): cargo / manifest / contracts
                            Keyboard shortcuts: O=overview, M=port+market, C=ship+cargo,
                            E=events, J=jump
    RefereeView.vue         Campaign management — Campaign / Ships / Events / Players tabs
                            Ships: stat grid shows hull, cargo, staterooms, low berths,
                            fuel capacity + current, credits, drives, location
                            Events: EVENT_CATALOGUE (20 M.U.L.E.-style presets)
                            Campaign: inline label editing
supabase/
  migrations/
    001_schema.sql          Core tables: campaigns, players, cargo, transactions,
                            market_prices, market_monthly, market_events
    002_auth_functions.sql  bcrypt login/register RPCs, rate-limiting
    003_rollup_functions.sql  advance_tick(), monthly/annual OHLC rollup
    004_fix_advance_tick.sql  Bug fix for advance_tick edge cases
    005_events_severity.sql   Adds severity column to market_events
    006_event_compaction.sql  Prunes old expired events during annual rollup
    007_campaign_start_tick.sql  Adds start_tick to campaigns; affects tick store init
    008_trade_records.sql   trade_records table + realized_ohlcv view
    009_ships.sql           ships + crew tables with RLS
    010_player_skills.sql   player_skills table (generic, no fixed list)
    011_ship_references.sql ship_id FK added to cargo, transactions, trade_records
    012_crew_can_trade.sql  can_trade flag on crew rows
    013_ship_drive_ratings.sql  jump_rating, maneuver_drive_rating on ships
    014_recovery_code.sql   Recovery code for PIN reset
    015_regenerate_recovery_code.sql  RPC to regenerate recovery code
    016_fix_start_tick_calendar.sql   Calendar start tick fix
    017_fix_calendar_data.sql         Calendar data correction
    018_delete_campaign.sql           Campaign deletion RPC
    019_cargo_world_name.sql          World name stored on cargo rows
    020_split_event_modifiers.sql     Splits effect_pct into buy_modifier_pct / sell_modifier_pct
    021_passengers_fuel_mail.sql      passenger_manifests, mail_contracts tables;
                                      stateroom_capacity + low_berth_capacity on ships;
                                      extended transactions type constraint
    022_ship_fuel_capacity.sql        fuel_capacity + fuel_current on ships
```

---

## Key design decisions

### Router — always use named routes
```js
router.push({ name: 'map' })      // correct
router.push('/map')               // WRONG — breaks with hash history
```

### Two-level tab hierarchy
MapView uses two levels of tabs:
- **TOP_TABS**: overview, port, ship, events, jump
- **PORT_TABS** (shown when topTab === 'port'): market, passengers, services
- **SHIP_TABS** (shown when topTab === 'ship'): cargo, manifest, contracts

This replaced a flat single-level tab row. Keyboard shortcuts map to top+sub combos
(M → port/market, C → ship/cargo, etc.).

### Deterministic pricing
All market prices and event rolls are seeded by `campaignId:worldHex:goodDie:tick`.
Every client produces identical values for the same inputs — no server-side randomness needed.
`makeRng()` uses FNV-1a hash + mulberry32 PRNG.

### Lazy snapshot generation + backfill
`ensureWorldSnapshot()` generates and inserts snapshots only when a world is first viewed.
On the **first visit** to a world, it also backfills all ticks from the start of the
current Imperial year up to `currentTick - 1`, giving charts immediate price history context.
Max backfill: 47 ticks × 36 goods = 1,692 rows — fits in a single Supabase insert.

### Tick model
- 1 tick = 1 jump-week (7 days)
- 4 ticks = 1 Imperial month (28 days)
- 48 ticks = 1 Imperial year (336 days)
- `BASE_SEC = new Date('1985-01-07').getTime() / 1000` — epoch anchor for lightweight-charts UTCTimestamp

### Market events — split buy/sell modifiers
Events have separate `buy_modifier_pct` and `sell_modifier_pct` fields (migration 020).
Either can be null (no effect on that side of the trade). This allows asymmetric events
like a shortage that raises sell prices without affecting purchase prices.

### Passenger economics
- **CT7**: flat fare per jump regardless of distance (High Cr10,000 · Middle Cr8,000 · Low Cr1,000)
- **T5**: High + Middle charged per parsec; Low remains flat
- Fares pre-collected at embarkation. Refund reverses the credit (referee-only action).
- Ship stateroom/low berth capacity set by referee; booking validates against occupancy.
- Status lifecycle: `in_transit` → `delivered` (auto on arrival) or `refunded` (referee override).

### Fuel model
- **Imperial standard pricing**: Refined Cr500/t (Class A/B starports), Unrefined Cr100/t (C/D), none at E/X.
- Ships have `fuel_capacity` (tank size) and `fuel_current` (level), both set by referee.
- `purchaseFuel` validates tons ≤ fuel_capacity − fuel_current, writes a `'fuel'` transaction,
  debits ship credits, and increments `fuel_current`.
- Jump fuel = ceil(hull_tons × 0.1 × parsecs). ShipServices "Fill for jump" respects remaining tank space.
- Referee can manually adjust `fuel_current` after a jump via the ship edit form.

### Mail contracts
- CT7: flat Cr25,000 per contract. T5: Cr25,000 × parsecs.
- Accepted at origin, tracked in `mail_contracts` table (status `in_transit`).
- Payment credited to ship on delivery (not upfront). No referee cancellation (mail is an Imperial obligation).

### Auto-delivery on location change
When `ship.updateLocation()` is called with `{ tick, campaignId, playerId }` params, it
automatically runs `deliverPassengers` and `deliverMail` for the new world. The referee's
`submitEditShip()` has a parallel `autoDeliverOnMove()` that does the same via direct Supabase calls.

### Realized OHLCV chart tab
`PriceChart.vue` has a fourth tab "Realized" that queries the `realized_ohlcv` view (migration 008),
showing actual clearing prices from `trade_records` as candlestick/line series, distinct from the
deterministic available-price history.

### Pure function engine pattern
All calc libraries (`passengers.js`, `trade-engine-ct7.js`, `trade-engine-t5.js`, `market-events.js`,
`market-tick.js`) are pure functions with no randomness. Callers (stores) supply rolls. This makes
unit testing trivial — no mocks needed.

### Market events catalogue
RefereeView's Events tab includes `EVENT_CATALOGUE`: 20 M.U.L.E.-style presets (name, description,
scope, buy/sell modifiers, severity, duration). Clicking a preset pre-fills the "New Event" form.

### WCAG 2.2 AA
`:focus-visible` pattern for all interactive elements; `useFocusTrap` for all dialogs;
skip link; ARIA roles/labels on world list and dialogs; verified contrast ratios per theme.

---

## Campaign starting year
Referees choose an Imperial starting year (default 1105) when creating a campaign.
The client computes `startTick = (startYear - 1105) * 48` and passes it to the
`create_campaign` RPC as `p_start_tick`. On first world visit, the tick store backfills
the current year's price history automatically.

---

## Implemented trade rulesets
- **CT7** — Classic Traveller Book 7 (Merchant Prince) — fully implemented
- **T5** — Traveller 5th Edition — fully implemented; uses per-parsec passenger fares for High/Middle
- Rulesets are locked at campaign creation and cannot be changed

---

## Licensing
Traveller is a registered trademark of Mongoose Publishing Ltd.
Copyright 1977–Present Mongoose Publishing Ltd.
Full disclaimer must appear in the About dialog (currently implemented).
Notify Mongoose Publishing once the app is publicly accessible (see DEVLOG.md TODO).

---

## Running locally

```sh
npm install
npm run dev        # Vite dev server with HMR
npm test           # Vitest unit + component tests (282 passing)
```

Requires `.env.local` with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

The service role key must never be in `.env` files committed to the repo.
