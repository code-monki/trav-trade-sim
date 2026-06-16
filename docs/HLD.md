# High-Level Design

**Project:** Traveller Trade Simulator  
**Version:** 0.2.0

---

## 1. Architecture Overview

TTS is a single-page application (SPA) with a Backend-as-a-Service (BaaS) data layer. There is no custom server; all compute happens in the browser except for PIN hashing and atomic ledger writes, which execute inside Supabase SECURITY DEFINER RPCs.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (Vue 3 SPA)                                                │
│                                                                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────┐   │
│  │ LoginView │  │  MapView  │  │RefereeView│  │  Components   │   │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └───────┬───────┘   │
│        │               │               │                │           │
│  ┌─────▼───────────────▼───────────────▼────────────────▼───────┐  │
│  │                   Pinia Stores                                │  │
│  │  auth · map · tick · ship · referee · theme                  │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                       │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │             Trade Engine / Market Tick / Events               │  │
│  │    (pure JS — deterministic, no side effects)                 │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │ @supabase/supabase-js                 │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ HTTPS + PostgREST
┌─────────────────────────────▼───────────────────────────────────────┐
│  Supabase                                                           │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  PostgREST   │  │  Auth (anon  │  │  SECURITY DEFINER RPCs   │  │
│  │  (table API) │  │  key only)   │  │  create_campaign         │  │
│  └──────┬───────┘  └──────────────┘  │  join_campaign           │  │
│         │                            │  verify_pin              │  │
│  ┌──────▼───────────────────────────┐│  advance_tick            │  │
│  │  PostgreSQL                      ││  rollup_month/year       │  │
│  │  (schema, RLS policies,          ││  reset_pin_with_recovery │  │
│  │   pgcrypto extension)            ││  regenerate_recovery_code│  │
│  └──────────────────────────────────┘└──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │ REST API
┌─────────────────────────────▼───────────────────────────────────────┐
│  Traveller Map API (travellermap.com)                               │
│  Sector lists, world data, route data, UWP decode                   │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI framework | Vue 3 (Composition API) | ^3.5 |
| State management | Pinia | ^2.2 |
| Router | Vue Router 4 (hash history) | ^4.4 |
| Charts | lightweight-charts | ^4.1 |
| Backend | Supabase (PostgreSQL 15, PostgREST) | managed |
| Client SDK | @supabase/supabase-js | ^2.108 |
| Build tool | Vite | ^5.4 |
| Unit tests | Vitest + @vue/test-utils + happy-dom | ^2.1 |
| E2E tests | Playwright | ^1.60 |

## 3. Module Structure

```
src/
├── main.js                   Entry point; mounts Vue app
├── App.vue                   Root component; RouterView
├── router/
│   └── index.js              Routes + auth guards (always use push({ name }) not push('/path'))
├── stores/
│   ├── auth.js               Campaign/player session, login RPCs
│   ├── map.js                Sector/world data, Traveller Map API
│   ├── tick.js               Calendar, snapshots, price history, events
│   ├── ship.js               Ship, cargo, passengers, mail; buy/sell/fuel/passenger/mail actions;
│   │                         updateLocation auto-delivers passengers + mail when opts provided
│   ├── referee.js            Referee panel data (ships, crew, events, players); createShip
│   │                         includes fuelCapacity / fuelCurrent
│   └── theme.js              UI theme management
├── views/
│   ├── LoginView.vue         Sign In / Join / New Campaign / Reset PIN
│   ├── MapView.vue           Main dashboard — two-level tabs:
│   │                           TOP_TABS: overview / port / ship / events / jump
│   │                           PORT_TABS: market / passengers / services
│   │                           SHIP_TABS: cargo / manifest / contracts
│   └── RefereeView.vue       Campaign management; inline label edit; ship stat grid with
│                             fuel/stateroom/berth fields; passenger manifest + refund;
│                             events catalogue; auto-delivery on ship move
├── components/
│   ├── MarketTable.vue       Trade goods table with sort, filter, chart checkboxes, buy buttons
│   ├── PriceChart.vue        lightweight-charts chart — Weekly/Monthly/Annual/Realized tabs
│   ├── CargoHold.vue         Ship > Cargo sub-tab: hold display + sell flow
│   ├── PassengersPanel.vue   Port > Passengers sub-tab: booking form, capacity check, fare preview
│   ├── ShipServices.vue      Port > Services sub-tab: fuel purchase + mail contract booking
│   ├── PassengerManifest.vue Ship > Manifest sub-tab: occupancy + in-transit passengers
│   ├── ContractsPanel.vue    Ship > Contracts sub-tab: mail contracts + pending payment
│   ├── BuyDialog.vue         Purchase quantity dialog
│   ├── RouteAnalysis.vue     Jump range route table with profit projection
│   ├── EventsHistory.vue     World event log
│   ├── RecoveryCodeDialog.vue One-time recovery code display (teleported)
│   ├── CharacterDialog.vue   Character stats display
│   ├── HamburgerMenu.vue     Navigation menu
│   ├── HelpDialog.vue        In-app user manual (tabbed)
│   ├── TutorialDialog.vue    Sidebar-nav tutorial viewer with cross-ref links
│   ├── AboutDialog.vue       About/license information
│   └── ThemeDialog.vue       UI theme picker
├── lib/
│   ├── trade-engine-ct7.js   CT Book 7 price formulas (pure functions)
│   ├── trade-engine-t5.js    T5 price formulas (pure functions)
│   ├── market-tick.js        Snapshot generation, seeded RNG, calendar helpers
│   ├── market-events.js      Event table, probability engine, active event filter
│   ├── passengers.js         passengerFare, passageCapacityNeeded, availableFuelTypes,
│   │                         jumpFuelTons, fuelCost, mailPayment (all pure functions)
│   ├── traveller-data.js     CT2 trade goods, CT7 lookup tables, milieu list
│   ├── traveller-helpers.js  UWP decode, hex distance, subsector helpers
│   ├── tutorials.js          In-app tutorial content (HTML strings)
│   ├── supabase.js           Supabase client singleton
│   ├── theme-db.js           Theme persistence (IndexedDB)
│   └── theme-tokens.js       CSS variable generation from theme config
├── composables/
│   └── useFocusTrap.js       WCAG focus containment for modal dialogs
└── utils/
    └── hexDistance.js        Traveller hex coordinate distance (cube coordinates)
```

## 4. Data Flows

### 4.1 Login Flow

```
User → LoginView
  ├─► doCreate()  → auth.createCampaign() → supabase.rpc('create_campaign')
  │     └─► RecoveryCodeDialog (blocks navigation until acknowledged)
  │           └─► router.push({ name: 'map' })
  ├─► doJoin()   → auth.joinCampaign()    → supabase.rpc('join_campaign')
  │     └─► auth.login() → supabase.rpc('verify_pin') → router.push({ name: 'map' })
  └─► doLogin()  → auth.login()           → supabase.rpc('verify_pin')
        └─► localStorage.setItem(session) → router.push({ name: 'map' })
```

### 4.2 Map Load Flow

```
MapView.onMounted()
  ├─► map.selectedMilieu ← auth.campaign.milieu
  ├─► map.loadSectors()  → Traveller Map API /api/universe?milieu=...
  ├─► tick.loadCalendar() → supabase campaign_calendar
  ├─► tick.loadActiveEvents() → supabase market_events
  └─► ship.loadShip(playerId, campaignId) → supabase crew + ships + cargo
```

### 4.3 Market Snapshot Flow

```
User selects world → MarketTable.loadSnapshots()
  └─► tick.ensureWorldSnapshot(world, sector)
        ├─► Check cache: (campaignId:worldHex:sector:tick) == snapshotWorldKey?
        │     └─► Yes: return worldSnapshots (no network call)
        ├─► Check Supabase: market_snapshots WHERE tick=current_tick
        │     └─► Rows exist: fetch + cache + return
        └─► No rows:
              ├─► maybeGenerateEvent() — seeded RNG → maybe insert market_events
              ├─► Check prior visits: if none, backfill yearStartTick..currentTick
              ├─► generateWorldSnapshot() — pure JS, 36 rows
              ├─► supabase.from('market_snapshots').insert(rows)
              └─► cache + return
```

### 4.4 Tick Advancement Flow

```
Referee clicks "Advance Tick"
  └─► tick.advanceTick()
        └─► supabase.rpc('advance_tick', { p_campaign_id })
              ├─► UPDATE campaign_calendar SET current_tick = current_tick + 1
              ├─► UPDATE campaign_calendar SET year, day
              ├─► IF tick % 4 = 0: rollup_month()
              │     └─► INSERT market_monthly (OHLC aggregate of last 4 snapshots)
              ├─► IF tick % 48 = 0: rollup_year()
              │     └─► INSERT market_annual (OHLC aggregate of year's monthly rows)
              │     └─► DELETE expired events older than 1 prior year
              └─► Returns { tick, year, day, month }
        └─► Invalidate worldSnapshots cache
        └─► tick.loadActiveEvents()
```

### 4.5 Buy/Sell Flow

```
Buy:
  User clicks row Buy button
    └─► BuyDialog: enter tons → confirm
          └─► ship.buyCargo()
                ├─► supabase INSERT cargo row
                ├─► supabase INSERT transactions row (type='buy', total_cr=negative)
                └─► supabase UPDATE ships SET credits = credits - totalCost

Sell:
  User clicks Sell in CargoHold → confirm
    └─► ship.sellCargo()
          ├─► supabase DELETE cargo row
          ├─► supabase INSERT transactions row (type='sell', total_cr=positive)
          ├─► supabase INSERT trade_records row (full buy→sell history)
          └─► supabase UPDATE ships SET credits = credits + totalRevenue
```

## 5. Component Interactions

### 5.1 MapView Hierarchy

```
MapView
├── (header)
│   └── HamburgerMenu
├── (sidebar)
│   ├── sector select + filter
│   └── world list
└── (detail panel)
    ├── TOP TAB: Overview — world data sections (UWP, trade codes, routes)
    │
    ├── TOP TAB: Port
    │   ├── (sub-tab bar) [Market] [Passengers] [Services]
    │   ├── PORT SUB-TAB: Market
    │   │   ├── MarketTable (emits: select-good, toggle-chart, buy-good)
    │   │   ├── (resize handle)
    │   │   └── PriceChart (Weekly / Monthly / Annual / Realized)
    │   ├── PORT SUB-TAB: Passengers
    │   │   └── PassengersPanel
    │   └── PORT SUB-TAB: Services
    │       └── ShipServices (fuel + mail sections)
    │
    ├── TOP TAB: Ship
    │   ├── (sub-tab bar) [Cargo] [Manifest] [Contracts]
    │   ├── SHIP SUB-TAB: Cargo
    │   │   └── CargoHold
    │   ├── SHIP SUB-TAB: Manifest
    │   │   └── PassengerManifest
    │   └── SHIP SUB-TAB: Contracts
    │       └── ContractsPanel
    │
    ├── TOP TAB: Events
    │   └── EventsHistory
    │
    └── TOP TAB: Jump
        └── RouteAnalysis (emits: select-world → sets topTab='port', portTab='market')
```

### 5.2 Store Dependencies

```
MapView ──reads──► map, auth, tick, ship
tick    ──reads──► auth (campaignId)
ship    ──reads──► auth (player, campaign)
referee ──reads──► auth (campaignId, isReferee)
```

### 5.3 Router Guards

```
/              requiresAuth → if !isAuthenticated: redirect /login
/referee       requiresAuth + requiresReferee → if !isReferee: redirect /
/login         if isAuthenticated: redirect /
```

## 6. Security Architecture

All sensitive operations go through `SECURITY DEFINER` RPC functions which run as the Supabase `postgres` role, bypassing RLS for the specific rows they need to touch. The client uses only the anon key, which is safe to bundle.

```
Client (anon key)
  │
  ├── SELECT queries → PostgREST + RLS (public read on market, calendar, events, ships)
  │
  └── Mutations → SECURITY DEFINER RPCs only
        ├── create_campaign  — creates campaign + calendar + player (referee)
        ├── join_campaign    — creates player row
        ├── verify_pin       — bcrypt compare, lockout management, returns session
        ├── advance_tick     — atomic tick increment + rollups
        ├── reset_pin_with_recovery_code — verifies recovery hash, resets PIN + lockout
        └── regenerate_recovery_code — generates new code, hashes and stores it
```

PIN bcrypt parameters: `gen_salt('bf', 10)` — Blowfish, cost factor 10.

## 7. Deterministic Price Engine

The market price engine is a pure function chain:

```
makeRng(seed = `${campaignId}:${worldHex}:${goodDie}:${tick}`)
  └─► FNV-1a hash → mulberry32 PRNG

generateWorldSnapshot(world, sectorName, campaignId, tick, activeEvents)
  For each of 36 CT2_TRADE_GOODS:
    1. rng = makeRng(campaignId:worldHex:die:tick)
    2. purchaseDM = Σ CT2 DMs matching world trade codes
    3. saleDM     = Σ CT2 DMs matching world trade codes
    4. purchaseRoll = 2d6(rng) + purchaseDM
    5. saleRoll     = 2d6(rng) + saleDM
    6. costPerTon   = costOfGoods(tradeCodes, starport, tl)
    7. purchasePrice = costPerTon × actualValueMultiplier(purchaseRoll)
    8. marketBase    = marketBasePrice(tradeCodes, tradeCodes)
    9. tlAdjusted    = tlAdjustment(sourceTL, worldTL, marketBase)
   10. salePrice     = tlAdjusted × actualValueMultiplier(saleRoll)
   11. eventMod     = Σ effect_pct for active events matching die or '__all__'
   12. salePrice   *= (1 + eventMod/100)
   13. qty = rollQty(good.qty, [d6(rng), d6(rng), ...])
```

All inputs are deterministic; same seed = same price on every client.
