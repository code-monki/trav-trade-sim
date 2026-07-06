# High-Level Design

**Project:** Traveller Trade Simulator  
**Version:** 0.2.0

---

## 1. Architecture Overview

TTS is a single-page application (SPA) backed by a Cloudflare Worker API and a Cloudflare D1 database. All trade math happens in the browser (pure JS, deterministic); PIN hashing and atomic ledger writes happen in the Worker.

The original backend was Supabase (PostgreSQL + PostgREST + SECURITY DEFINER RPCs). It was replaced in July 2026 because **Supabase free-tier projects are automatically paused after seven days of inactivity** and require a manual dashboard restore before users can log in again. Cloudflare D1 has no inactivity pause.

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
│                             │ src/lib/api.js (fetch + Bearer token) │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ HTTPS JSON API
┌─────────────────────────────▼───────────────────────────────────────┐
│  Cloudflare Worker (Hono v4)                                        │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Routes: /api/auth  /api/campaigns  /api/ships               │  │
│  │          /api/market  /api/referee  /api/reports             │  │
│  └────────────────────────────┬─────────────────────────────────┘  │
│                               │ D1 binding                          │
│  ┌────────────────────────────▼─────────────────────────────────┐  │
│  │  Cloudflare D1 (SQLite)                                      │  │
│  │  campaigns · players · sessions · ships · crew               │  │
│  │  cargo · passenger_manifests · mail_contracts                │  │
│  │  market_snapshots · market_events · trade_records            │  │
│  │  market_monthly · market_annual · realized_ohlcv (view)      │  │
│  └──────────────────────────────────────────────────────────────┘  │
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
| API runtime | Cloudflare Workers (Hono v4) | managed |
| Database | Cloudflare D1 (SQLite) | managed |
| API client | src/lib/api.js (fetch wrapper) | — |
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
│   ├── api.js                HTTP client (fetch + Bearer token; replaces @supabase/supabase-js)
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
  ├─► doCreate()  → auth.createCampaign() → POST /api/campaigns
  │     └─► RecoveryCodeDialog (blocks navigation until acknowledged)
  │           └─► router.push({ name: 'map' })
  ├─► doJoin()   → auth.joinCampaign()    → POST /api/campaigns/:code/join
  │     └─► auth.login() → POST /api/auth/login → { token } → router.push({ name: 'map' })
  └─► doLogin()  → auth.login()           → POST /api/auth/login
        └─► localStorage.setItem('tts_session', { campaign, player, token })
              └─► router.push({ name: 'map' })
```

All subsequent API calls carry `Authorization: Bearer <token>`. The Worker validates the token against the `sessions` table.

### 4.2 Map Load Flow

```
MapView.onMounted()
  ├─► map.selectedMilieu ← auth.campaign.milieu
  ├─► map.loadSectors()  → Traveller Map API /api/universe?milieu=...
  ├─► tick.loadCalendar() → GET /api/campaigns/:id/calendar
  ├─► tick.loadActiveEvents() → GET /api/campaigns/:id/events?active=true
  └─► ship.loadShip(playerId, campaignId) → GET /api/ships/current
```

### 4.3 Market Snapshot Flow

```
User selects world → MarketTable.loadSnapshots()
  └─► tick.ensureWorldSnapshot(world, sector)
        ├─► Check cache: (campaignId:worldHex:sector:tick) == snapshotWorldKey?
        │     └─► Yes: return worldSnapshots (no network call)
        ├─► GET /api/campaigns/:id/snapshots?world_hex=&sector=&tick=
        │     └─► Rows exist: cache + return
        └─► No rows:
              ├─► maybeGenerateEvent() — seeded RNG → POST /api/campaigns/:id/events (check_duplicate)
              ├─► Check prior visits: GET /api/campaigns/:id/snapshots/prior-count
              │     └─► If none: backfill yearStartTick..currentTick
              ├─► generateWorldSnapshot() — pure JS, 36 rows
              ├─► POST /api/campaigns/:id/snapshots (batch insert)
              └─► cache + return
```

### 4.4 Tick Advancement Flow

```
Referee clicks "Advance Tick"
  └─► tick.advanceTick()
        └─► POST /api/campaigns/:id/advance-tick
              ├─► UPDATE campaign_calendar SET current_tick = current_tick + 1
              ├─► UPDATE campaign_calendar SET year, day
              ├─► IF tick % 4 = 0: INSERT market_monthly (OHLC of last 4 snapshots)
              ├─► IF tick % 48 = 0: INSERT market_annual; DELETE expired events
              └─► Returns { tick, year, day }
        └─► Invalidate worldSnapshots cache
        └─► tick.loadActiveEvents()
```

### 4.5 Buy/Sell Flow

```
Buy:
  User clicks row Buy button
    └─► BuyDialog: enter tons → confirm
          └─► ship.buyCargo()
                └─► POST /api/ships/:id/buy-cargo  (atomic db.batch())
                      ├─► INSERT cargo row
                      ├─► INSERT transactions row (type='buy')
                      ├─► UPDATE ships SET credits = credits - totalCost
                      └─► UPDATE market_snapshots SET qty_available = qty_available - tons

Sell:
  User clicks Sell in CargoHold → confirm
    └─► ship.sellCargo()
          └─► POST /api/ships/:id/sell-cargo  (atomic db.batch())
                ├─► DELETE cargo row
                ├─► INSERT transactions row (type='sell')
                ├─► INSERT trade_records row (full buy→sell history)
                └─► UPDATE ships SET credits = credits + totalRevenue
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

All API calls carry a Bearer token issued at login and stored server-side in the `sessions` table. The Worker's `requireAuth` middleware validates the token on every request. There is no client-side secret — `VITE_API_URL` points to the Worker URL, which is public.

```
Client (no embedded secret)
  │
  └── All requests → Authorization: Bearer <session_token>
        │
        └── Worker middleware: SELECT sessions WHERE token=? AND expires_at > now()
              ├── Valid   → c.var.session = { campaign_id, player_id, role }
              └── Invalid → 401 Unauthorized

Referee-only endpoints additionally check:
  session.role === 'referee'  (set at campaign creation)
```

PIN hashing: PBKDF2-SHA256, 10,000 iterations, 16-byte random salt, via the Web Crypto API. Format stored: `pbkdf2:10000:<saltHex>:<hashHex>`. Iterations are set low to fit within the Cloudflare Workers free-tier 10 ms CPU budget per request; 10k iterations is still ~100× harder to brute-force than a bare SHA-256.

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
