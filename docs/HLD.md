# High-Level Design

**Project:** Traveller Trade Simulator  
**Version:** 0.12.0

---

## 1. Architecture Overview

TTS is a single-page application (SPA) backed by a Cloudflare Worker API and a Cloudflare D1 database. All trade math happens in the browser (pure JS, deterministic); PIN hashing and atomic ledger writes happen in the Worker.

The original backend was Supabase (PostgreSQL + PostgREST + SECURITY DEFINER RPCs). It was replaced in July 2026 because **Supabase free-tier projects are automatically paused after seven days of inactivity** and require a manual dashboard restore before users can log in again. Cloudflare D1 has no inactivity pause.

![Architecture overview: the browser SPA (views → Pinia stores → deterministic trade engine) makes two independent outbound calls — one to the Cloudflare Worker, which is the only thing that talks to D1, and a separate direct client-side call to the third-party Traveller Map API that never touches the Worker at all](wireframes/hld-architecture.svg)

Two independent external dependencies, not one pipeline: the browser calls the Cloudflare Worker (which alone talks to D1) via `src/lib/api.js`, and separately fetches `travellermap.com` directly, client-side — the Worker never proxies or sees Traveller Map traffic. This matters operationally: a Traveller Map outage and a D1/Worker outage are unrelated failure modes (see `src/lib/travellermap-cache.js`'s IndexedDB fallback, which exists precisely because that dependency isn't behind the Worker's control).

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
│   ├── auth.js               Campaign/player session, login/join/PIN-reset actions
│   ├── map.js                Sector/world data, Traveller Map API
│   ├── tick.js               Calendar, snapshots, price history, events
│   ├── ship.js               Ship, cargo, passengers, mail (both backed by the unified
│   │                         `obligations` table — field/action names kept as-is for
│   │                         frontend compat); buy/sell/fuel/passenger/mail/payDebt actions;
│   │                         updateLocation auto-delivers passengers + mail when opts provided
│   ├── referee.js            Referee panel core CRUD: ships, players, ship templates,
│   │                         organizations. Ship debts/ownership and organization
│   │                         officers/members/equity/dues/disbursement are NOT store state —
│   │                         managed via direct api.js calls in RefereeView.vue/
│   │                         OrganizationsPanel.vue instead (a deliberate pattern)
│   └── theme.js              UI theme management (persistence: DD.md §8)
├── views/
│   ├── LoginView.vue         Sign In / Join / New Campaign / Reset PIN
│   ├── MapView.vue           Main dashboard — two-level tabs:
│   │                           TOP_TABS: overview / port / ship / events / jump
│   │                           PORT_TABS: market / passengers / mail / services / freight (MgT2022, CT7)
│   │                           SHIP_TABS: cargo / aboard / reports / organizations
│   └── RefereeView.vue       Campaign management, five tabs: Ships (incl. Templates,
│                             Debts, Ownership sub-panels) / Players / Organizations
│                             (officers, members, dues, disbursement, equity, fleet
│                             report) / Events / Campaign
├── components/
│   ├── MarketTable.vue       Trade goods table with sort, filter, chart checkboxes, buy buttons
│   ├── FindSupplierPanel.vue (MgT2022 only) "Find a Supplier" gate shown instead of MarketTable
│   │                         until the player succeeds this game-month
│   ├── PriceChart.vue        lightweight-charts chart — Weekly/Monthly/Annual/Realized tabs
│   ├── CargoHold.vue         Ship > Cargo sub-tab: hold display + sell flow + live valuation
│   ├── PassengersPanel.vue   Port > Passengers sub-tab: booking form, capacity check, fare preview
│   ├── MailPanel.vue         Port > Mail sub-tab: mail contract booking, fare preview
│   ├── ShipServices.vue      Port > Services sub-tab: fuel purchase
│   ├── FreightPanel.vue      Port > Freight sub-tab (MgT2022 only): lot booking, cargo capacity check
│   ├── AboardPanel.vue       Ship > Aboard sub-tab: composes PassengerManifest + ContractsPanel + Freight-in-transit
│   ├── PassengerManifest.vue Occupancy + in-transit passengers
│   ├── ContractsPanel.vue    In-transit mail contracts + pending payment
│   ├── ReportsPanel.vue      Ship > Reports sub-tab: Ledger/Trades/Income/Debts/Net Worth
│   ├── OrganizationsPanel.vue Ship > Organizations sub-tab: player-facing org browse/found/manage
│   ├── BuyDialog.vue         Purchase quantity dialog
│   ├── ChartSheet.vue        Mobile-only (≤640px) bottom sheet hosting PriceChart: peek/half/full
│   │                         detents, velocity-aware snap, gesture disambiguation vs. chart pan
│   ├── RouteAnalysis.vue     Jump range route table with profit projection
│   ├── EventsHistory.vue     World event log
│   ├── WorldPicker.vue       Destination picker (dropdown or manual hex), used by PassengersPanel/MailPanel/FreightPanel
│   ├── RecoveryCodeDialog.vue One-time recovery code display (teleported)
│   ├── CharacterDialog.vue   Character stats display (skills; MgT2022 also editable characteristics)
│   ├── HamburgerMenu.vue     Navigation menu
│   ├── HelpDialog.vue        In-app user manual (tabbed)
│   ├── TutorialDialog.vue    Sidebar-nav tutorial viewer with cross-ref links
│   ├── AboutDialog.vue       About/license information
│   └── ThemeDialog.vue       UI theme picker
├── lib/
│   ├── trade-engine-ct7.js       CT Book 7 price formulas (pure functions)
│   ├── trade-engine-t5.js        T5 price formulas (pure functions)
│   ├── trade-engine-mgt2022.js   MgT2022 price/freight/mail/traffic formulas (pure functions)
│   ├── market-tick.js        Snapshot generation dispatch (CT7/T5/MgT2022), seeded RNG, calendar helpers
│   ├── traffic-tick.js       MgT2022-only passenger/freight/mail traffic-availability roll generation
│   ├── ct7-traffic-tick.js   CT7-only passenger/freight traffic-availability roll generation (§7e)
│   ├── market-events.js      Event table, probability engine, active event filter
│   ├── passengers.js         passengerFare, passageCapacityNeeded, availableFuelTypes,
│   │                         jumpFuelTons, fuelCost, mailPayment (all pure functions)
│   ├── campaign-generator.js Pre-fill/randomize New Campaign form (name, code, milieu-consistent
│   │                         starting date, referee name) — pure functions, injected rng, same
│   │                         pattern as market-tick.js. Never generates a PIN.
│   ├── traveller-data.js         CT2 trade goods, CT7 lookup tables, milieu list, trade ruleset list
│   ├── traveller-data-mgt2022.js MgT2022 D66 trade goods, price/fare/freight/traffic tables
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

Event and price generation are lazy — deterministic seeding (campaign + world
+ tick) means it doesn't matter *when* a tick's data is computed, only that it
eventually is, so a world's data is only generated the first time someone
actually looks at it for a given tick. To keep that cheap for a whole sector
of mostly-unvisited worlds, `ensureWorldSnapshot` also gap-fills — not just a
world's very first visit, but *any* gap since it was last snapshotted,
replaying skipped ticks in order so events with multi-tick durations are
correctly still "active" for the ticks that follow them.

```
User selects world → MarketTable.loadSnapshots()
  └─► tick.ensureWorldSnapshot(world, sector)
        ├─► Check cache: (campaignId:worldHex:sector:tick) == snapshotWorldKey?
        │     └─► Yes: return worldSnapshots (no network call)
        ├─► GET /api/campaigns/:id/snapshots?world_hex=&sector=&tick=
        │     └─► Rows exist: cache + return
        └─► No rows for the current tick:
              ├─► maybeInsertEvent(world, sector, currentTick) — seeded RNG →
              │     POST /api/campaigns/:id/events (check_duplicate)
              ├─► loadActiveEvents() — refresh so this tick's own price gen sees it
              ├─► GET /api/campaigns/:id/snapshots/last-tick?world_hex=&sector=
              │     └─► backfillStart = max(yearStartTick, lastTick + 1)
              ├─► If backfillStart < currentTick — gap-fill loop, ascending tick:
              │     ├─► GET /api/campaigns/:id/events?world_hex=&sector= (seed event pool, once)
              │     ├─► per tick t: maybeInsertEvent(t) → append to pool if fired
              │     ├─► activeEventsForWorld(pool, ..., t, ...) → generateWorldSnapshot(t)
              │     ├─► POST /api/campaigns/:id/snapshots (batch insert, once at the end)
              │     └─► for each t crossing a month/year boundary:
              │           POST /api/campaigns/:id/rollup-repair { tick: t }
              ├─► generateWorldSnapshot() — pure JS, 36 rows, for the current tick
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
  └─► MapView.doAdvanceTick() also calls tick.ensureWorldSnapshot() for the
        currently-selected world, so its event (if any) fires immediately
        rather than waiting for a separate visit.
```

Rollup here runs immediately against whatever `market_snapshots` rows exist
*right now* — if a world's data for the just-completed month hasn't been
lazily generated yet, the rollup finds nothing and doesn't retry. This is
repaired later, if that world is eventually visited, by the
`POST /rollup-repair` step in §4.3 (the rollup SQL is `ON CONFLICT DO UPDATE`,
so re-running it against now-complete data is safe).

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

### 4.6 Financial Model Flows (Ship Templates → Corp/Fleet Financials)

Six features layered on top of the core ship/credits model, in the order they were built. All financial mutations follow the same atomic `db.batch()` pattern as Buy/Sell above — a JS-side pre-check (D1 has no interactive transactions) followed by one batched write.

**Ship Templates → Net Worth** are straightforward form-fill and read-only aggregation:
```
New Ship form: Template dropdown (default "Custom Design")
  └─► selecting a template pre-fills hull/cargo/berth/fuel/drive/market_value fields
        (no persistent link kept between the created ship and the template)

Ship > Reports > Net Worth
  └─► GET /api/reports/{debts,ownership} + ship.credits + ship.market_value + cargo value
        └─► netWorth = credits + market_value + cargoValue(at cost) − Σ debt.current_balance
              └─► "Your Share" = netWorth × ownershipPercentage (see chained-ownership branch below)
```

**Debt Tracking** — referee CRUD plus a player-facing payment identical in shape to Buy/Sell's atomic pattern:
```
Ship > Reports > Debts: player enters payment amount
  └─► ship.payDebt()
        └─► POST /api/ships/:id/pay-debt  (atomic db.batch(), validated against both
              insufficient ship credits AND overpayment past current_balance)
              ├─► UPDATE ships SET credits = credits - amount
              ├─► UPDATE ship_debts SET current_balance = current_balance - amount
              └─► INSERT debt_payments row
```

**Ownership Tracking** is referee-only CRUD on `ship_ownership` with server-validated 100%-ceiling (rejects any share that would push a ship's total over 100%).

**Organizations** — any authenticated player can found one (auto-becoming its first officer); day-to-day management (edit, officers, members, dues, disbursement, equity) requires being an officer of that specific org, or the referee (who always overrides regardless of officer status — the same safety-net principle already used for editing any ship). This is a materially different authorization model from Ownership Tracking above, which stays strictly referee-only — a ship-ownership share is closer to a debt/contract the referee arbitrates, while an Organization is something a player actively runs, like a ship.
```
POST /api/organizations  (any authenticated player)
  └─► INSERT organizations row
  └─► INSERT organization_officers row (creator)

isOfficerOrReferee(session, orgId) gates all mutations:
  session.role === 'referee'  OR  EXISTS organization_officers WHERE (orgId, session.player_id)
```

**Corp/Fleet Financials** — dues collection is the one flow with a deliberate anti-automation guard, added specifically because "nothing financial happens automatically on Advance Tick" is a standing project rule (§4.4 already established this for market rollups):
```
POST /api/organizations/:id/collect-dues { tick }
  ├─► 400 if dues_rate is null/0
  ├─► 409 if last_dues_tick != null AND tick < last_dues_tick + dues_frequency_ticks
  │     (first-ever collection always allowed; guards only against re-collecting early)
  ├─► for each member ship: charge dues_rate if ship.credits ≥ dues_rate,
  │     else skip (reported back as failed_ship_ids, doesn't block the others)
  └─► atomic db.batch(): N ship credit decrements + 1 organizations update
        (treasury_credits += collected, last_dues_tick = tick) + N dues_payments inserts

POST /api/organizations/:id/disburse { ship_id, amount, notes }
  └─► ad hoc, capped at organization.treasury_credits — no schedule, unlike dues
```

**Chained ownership** — the one cross-cutting design decision that touches Net Worth itself: for a ship with `organization_members.owns_ship = 1`, `GET /api/reports/ownership` transparently reads that organization's `organization_ownership` equity instead of the ship's own `ship_ownership` rows, in the identical response shape — so `ReportsPanel.vue`'s Net Worth computation needed no changes to support it:
```
GET /api/reports/ownership?ship_id=X
  ├─► organization_members WHERE ship_id=X AND owns_ship=1 exists?
  │     ├─► Yes → SELECT organization_ownership WHERE organization_id=<that org>
  │     └─► No  → SELECT ship_ownership WHERE ship_id=X  (unchanged, original behavior)
  └─► both branches return { id, player_id, character_name, percentage } rows
```

## 5. Component Interactions

### 5.1 MapView Hierarchy

```
MapView
├── (header) — ≤640px: collapses to one row (title→"TTS", short advance label);
│   │           milieu picker + session readout move into HamburgerMenu's mobile-extras slot
│   └── HamburgerMenu (mobile-extras slot: milieu select + session readout, ≤640px only)
├── (sidebar) — ≤640px: collapsible via a "Sectors & Worlds" toggle, starts collapsed,
│   │           auto-collapses again after a world is selected
│   ├── sector select + filter
│   └── world list
└── (detail panel)
    ├── TOP TAB: Overview — world data sections (UWP, trade codes, routes)
    │
    ├── TOP TAB: Port
    │   ├── (sub-tab bar) [Market] [Passengers] [Mail] [Services] [Freight — MgT2022 only]
    │   ├── PORT SUB-TAB: Market
    │   │   ├── MarketTable (emits: select-good, toggle-chart, buy-good, view-chart, clear-chart)
    │   │   │     — desktop: permanent Plot checkbox column
    │   │   │     — ≤640px (`mobile` prop): Plot column replaced by a Compare toggle /
    │   │   │       long-press selection mode with a plotted-count toolbar
    │   │   ├── (resize handle) — desktop only
    │   │   ├── PriceChart (Weekly / Monthly / Annual / Realized) — desktop: inline split
    │   │   └── ChartSheet — ≤640px only: hosts PriceChart in a bottom sheet instead of
    │   │         the inline split (emits: dismiss, inset-change)
    │   ├── PORT SUB-TAB: Passengers
    │   │   └── PassengersPanel
    │   ├── PORT SUB-TAB: Mail
    │   │   └── MailPanel
    │   ├── PORT SUB-TAB: Services
    │   │   └── ShipServices (fuel only)
    │   └── PORT SUB-TAB: Freight (MgT2022 only)
    │       └── FreightPanel
    │
    ├── TOP TAB: Ship
    │   ├── (sub-tab bar) [Cargo] [Aboard] [Reports] [Organizations]
    │   ├── SHIP SUB-TAB: Cargo
    │   │   └── CargoHold
    │   ├── SHIP SUB-TAB: Aboard
    │   │   └── AboardPanel (composes PassengerManifest + ContractsPanel + Freight-in-transit)
    │   ├── SHIP SUB-TAB: Reports
    │   │   └── ReportsPanel (Ledger / Trades / Income / Debts / Net Worth)
    │   └── SHIP SUB-TAB: Organizations
    │       └── OrganizationsPanel
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
    8. marketBase    = marketBasePrice(tradeCodes, tradeCodes)   # self-referenced — see note below
    9. salePrice     = marketBase × actualValueMultiplier(saleRoll)   # no TL adjustment here — see note below
   10. eventMod     = Σ effect_pct for active events matching die or '__all__'
   11. salePrice   *= (1 + eventMod/100)
   12. qty = rollQty(good.qty, [d6(rng), d6(rng), ...])
```

All inputs are deterministic; same seed = same price on every client. (This pipeline is CT7's; T5 shares the same 36 `CT2_TRADE_GOODS` table but its own pricing formulas — see `trade-engine-t5.js` — and MgT2022 uses an entirely different table/pipeline, §7a below.)

**Deliberate self-reference, and why it's a baseline only.** `marketBasePrice(tradeCodes, tradeCodes)` treats this world as both source and market — a reasonable stand-in for the *ambient* MarketTable listing, where no specific owned cargo lot is in play, so there's no real "source world" to ask about. Because source==market here, `tlAdjustment`'s delta is always 0 and applying it would be a no-op, so this baseline never calls it at all. This is **not** what a real owned cargo lot sells for, though: `marketBasePrice` and `tlAdjustment` are both genuinely two-world Book 7 functions (source codes/TL vs. market codes/TL), and a real lot has a real, known purchase world (`cargo.purchase_world`/`purchase_sector`). `ct7CargoLotSalePrice()` in `market-tick.js` is the function that does this correctly — it reuses this same seed's sale-roll dice (so "market luck" is shared across every lot of the same good sold at the same market/tick) but threads the *lot's actual* source codes/TL through `marketBasePrice`/`tlAdjustment` instead of self-referencing. `CargoHold.vue` calls it once each cargo lot's purchase world resolves (via `map.fetchWorldsForSector`, cached locally); until then `sellPriceFor` returns `null`, same as any other not-yet-appraised good. `ct7PlayerSalePrice()` (§7b) keeps the self-referenced baseline behavior — it's for the ambient listing, not a specific lot.

## 7a. MgT2022 Price/Composition Engine

MgT2022 does not reuse CT7's pipeline — different goods table (`MGT2022_TRADE_GOODS`, 35 entries; D66=66 "Exotics" is deliberately excluded and treated as a GM-adjudicated special case, never part of the roll), different DM-combination rule, and an added goods-availability gate the CT7 pipeline has no equivalent of:

```
generateMgT2022Snapshot(world, sectorName, campaignId, tick, activeEvents)
  codes = parseTradeCodes(world.Remarks) + Zone pseudo-codes ('Am'/'Rz' from world.Zone)
  popDigit = UWP population digit; qtyDM = goodsAvailableDM(popDigit)
  worldLaw = lawFromUWP(world.UWP)

  # Composition uses its OWN seeded RNG stream, separate from any good's
  # price/qty rolls — so which goods appear never shifts another good's
  # price-roll seed position.
  compositionRng = makeRng(`${campaignId}:${worldHex}:composition:${tick}:v1`)
  hits = mgt2022Composition(compositionRng, codes, popDigit)
    # Common Goods: always included.
    # Trade Goods: included if `availability` matches a code in `codes`.
    # Then roll D66 once per Population *code* digit (not a DM) for random
    # extras, rerolling 61-65 unless seeking black market; duplicate hits
    # stack quantity rather than duplicating the row.

  For each good in MGT2022_TRADE_GOODS where hits.has(good.die):
    rng = makeRng(`${campaignId}:${worldHex}:${good.die}:${tick}:v1`)

    # "Use only the largest DM from each column" — not a sum.
    purchaseDM  = maxTradeCodeDMs(good.purchaseDMs, codes)
    saleDM      = maxTradeCodeDMs(good.saleDMs,     codes)
    lawLevelDM  = smugglingRiskDM(good.bannedLawLevel, worldLaw)  # max(0, worldLaw - bannedLawLevel)

    # Both directions apply BOTH columns, with opposite signs.
    netPurchaseDM = purchaseDM - saleDM
    netSaleDM     = saleDM - purchaseDM + lawLevelDM

    purchaseRoll  = 3d6(rng) + brokerSkill + netPurchaseDM   # brokerSkill = 0 here — see §7b
    purchasePrice = good.basePriceCr × modifiedPricePct(purchaseRoll)   # exact per-roll % table, not banded
    saleRoll      = 3d6(rng) + brokerSkill + netSaleDM       # brokerSkill = 0 here — see §7b
    salePrice     = good.basePriceCr × modifiedPricePct(saleRoll)

    apply active-event buy/sell modifiers (same mechanism as CT7)

    qty = Σ over each "hit" on this good: rollQty(good.qty, 8×d6(rng), qtyDM)
```

**Find a Supplier** is a separate, non-seeded gate in front of this pipeline, not part of it: a character-based one-click check (`findSupplierRoll` — 2D6 + Broker/Streetwise/Admin skill + starport DM (`starportBrokerDM`, from `MGT2022_STARPORT_SUPPLIER_DM`, distinct from the Freight/Mail traffic-DM table) − 1 per previous attempt this world/month, target Average 8+) tracked per `(player, world, sector, month)` in `supplier_search_attempts`. `MapView.vue`'s Market tab renders `FindSupplierPanel.vue` instead of `MarketTable.vue` until the current player has succeeded this game-month — deliberately plain `Math.random()` dice server-side, not `makeRng`, since a one-shot player action has no replay-determinism requirement.

## 7b. Per-player pricing (CT7 sale-only, MgT2022 both)

§7/§7a above describe the **shared baseline** stored in `market_snapshots` — generated once per (campaign, world, tick), `brokerSkill` fixed at `0` (no live buyer to ask), used for the stock pool (`qty_available`) and for price/OHLC history charts (an impartial market index, not any one player's negotiated price). Two standalone functions in `market-tick.js` recompute one good's price for a *specific acting player's* real Broker skill, live, at display/transaction time:

```
mgt2022PlayerGoodPrice(campaignId, world, tick, goodDie, activeEvents, brokerSkill)
  rebuilds codes/worldLaw/netPurchaseDM/netSaleDM exactly as §7a
  rng = makeRng(same seed §7a used for this good)   # reproduces the identical 3D rolls
  purchaseRoll = 3d6(rng) + brokerSkill + netPurchaseDM   # supplier's assumed Broker stays 2 (no live NPC)
  saleRoll     = 3d6(rng) + brokerSkill + netSaleDM       # purchaser's assumed Broker stays 2
  → { purchasePrice, salePrice }

ct7PlayerSalePrice(campaignId, world, tick, goodDie, activeEvents, brokerSkill)
  rng = makeRng(same seed §7 used for this good)
  discard the purchase roll's 2 dice (order must match §7 — CT7 has no purchase-side Broker term)
  saleRoll = 2d6(rng) + saleDM + brokerDM(brokerSkill)    # brokerDM caps at skill 4
  → salePrice via actualPrice(marketBasePrice(codes, codes), saleRoll) + event mod
```

Because `makeRng(seed)` is a pure function of its seed string, drawing the same dice in the same order from a fresh call reproduces the exact roll §7/§7a's shared baseline drew — no raw dice are persisted anywhere, and `brokerSkill: 0` reproduces the baseline exactly (this is exactly what locks the two independent implementations together in `tests/market-tick.test.js`).

`tick.js`'s `displaySnapshots` computed overlays `worldSnapshots` with these per-player numbers (MgT2022: both prices; CT7: sale only) for the current player's own `brokerSkill` (fetched via `GET /api/reports/skills`, cached in `tick.brokerSkill`); `MarketTable.vue`/`CargoHold.vue` read `displaySnapshots` instead of `worldSnapshots`, so `BuyDialog.vue` and the actual `buy-cargo`/`sell-cargo` calls — which already send whatever price the client computed, unchanged since the Phase 1 concurrency fix — automatically use the adjusted number.

CT7's Broker commission is a lump adjustment at the moment of sale, not a per-ton price term, mirroring the existing freight late-delivery-penalty pattern's use of a separate transaction row. Book 7 draws a real distinction between *hiring* an NPC broker (pays the full `brokerFee(skill, finalPrice)` — 5% × skill × transaction value, regardless of profit/loss) and a player-character using their *own* Broker skill to arrange the sale (receives that same fee, but is assumed to spend half of it arranging the sale — nets `brokerSelfServiceGain()`, exactly half, as pure profit *on top of* the sale). This app has no NPC-hiring flow — every Broker skill used is the acting player's own — so the self-service case is the only one that applies: `ship.js`'s `sellCargo()` computes `brokerSelfServiceGain()` and sends it as `broker_gain_total`; `worker/src/routes/ships.js`'s `/sell-cargo` **adds** it to the credited amount and records it as a distinct `'broker_commission'`-type transaction (income, not a fee).

## 7c. Traffic Availability (Passengers/Freight/Mail)

Distinct from §7/§7a/§7b above — this isn't goods pricing, it's the "how
many passengers/cargo-lots/mail-containers exist to be booked this tick"
scarcity mechanic (`src/lib/traffic-tick.js`, `traffic_snapshots`). Per the
rulebook's own "SEEKING PASSENGERS"/"FREIGHT"/"MAIL" sections, this
depends on the **ship's own current crew** (Steward, Broker, Carouse,
Streetwise, Naval/Scout rank, SOC), not just the world, *and* on the
chosen **destination** — population/starport DMs apply from both the
origin and destination world, plus a distance penalty ("each parsec of
destination past the first: DM-1"). So the roll is generated per **(ship,
origin world, destination world, tick)**, not just (ship, world, tick):
two ships docked at the same world, or the same ship considering two
different destinations, can get different numbers.

Because the true count is inherently per-*route*, there is no meaningful
"how many passengers are waiting, independent of where they're going"
number — `ensureTrafficSnapshot` is therefore never called ambiently on
world visit. `PassengersPanel.vue`/`FreightPanel.vue`/`MailPanel.vue`
(MgT2022 only; CT7/T5 keep their pre-existing field order and behavior,
since they have no traffic-availability concept to gate on) show the
destination picker first and gate the rest of the form behind having
picked one, resolving the destination's full world object via
`map.fetchWorldsForSector()` and re-rolling whenever the destination or
parsec distance changes.

`generateTrafficSnapshot(world, sectorName, destWorld, destSectorName, parsecs, campaignId, tick, shipId, crew*)`
uses **three independent seeded RNG streams** — one each for Passengers,
Freight, and Mail (`...traffic:passenger:...`, `...traffic:freight:...`,
`...traffic:mail:...`), keyed by both the origin and destination hex so
two different destinations from the same origin/tick produce independent
rolls. This isn't incidental: each tier's dice-*count* is data-dependent (a
DM of +2 might sum 3 dice, +4 might sum 5), so a single shared stream
would let a change that should only affect one category (e.g. Steward,
which per RAW only ever touches Passenger traffic) shift where the *next*
category's draws start from — the same composition-vs-pricing
contamination problem §7a's `compositionRng` already solves, discovered
again here via a failing test before shipping.

```
distanceDM = -max(0, parsecs - 1)   # 1 parsec is the baseline; never positive

# Passengers — own stream
passengerBaseDM = passengerPopulationDM(popDigit) + passengerPopulationDM(destPopDigit)
                + starportDM(starport) + starportDM(destStarport)
                + passengerZoneTrafficDM(zone)   # origin only
                + distanceDM
passengerCheckEffect = (2d6(passengerRng) + crewPassengerCheckMax) - 8   # best of Broker/Carouse/Streetwise among crew; can be negative
for tier in {high, middle, basic, low}:
  tierDM = passengerBaseDM + crewStewardMax + passengerCheckEffect + MGT2022_PASSENGER_TIER_DM[tier]
  count  = passengerTrafficDiceCount(2d6(passengerRng) + tierDM) dice, rolled and summed from passengerRng

# Freight — own stream, genuinely different Population/Zone DM table and
# dice-count table from Passengers' (confirmed divergent at rolls 6, 9, 10, 12, 13, 15).
# TL/Zone DMs stay origin-only — the book lists them outside the "both
# source and destination" bullet, unlike population/starport.
freightBaseDM = freightPopulationDM(popDigit) + freightPopulationDM(destPopDigit)
              + starportDM(starport) + starportDM(destStarport)
              + techLevelTrafficDM(tl) + freightZoneTrafficDM(zone)
              + distanceDM
freightCheckEffect = (2d6(freightRng) + crewFreightCheckMax) - 8   # best of Broker/Streetwise among crew
for tier in {major, minor, incidental}:
  tierDM = freightBaseDM + freightCheckEffect + MGT2022_FREIGHT_TIER_DM[tier]
  count  = freightTrafficDiceCount(2d6(freightRng) + tierDM) dice, rolled and summed from freightRng

# Mail — own stream; "Freight Traffic DM" means the un-tiered freight DM
# VALUE computed above (now itself route-aware), reused — not a shared RNG stream.
mailDM = bandedMapping(freightBaseDM + freightCheckEffect)
       + (shipArmed ? +2 : 0) + mailTechLevelDM(tl)
       + crewNavalScoutRankMax + characteristicDM(crewSocialStandingMax)
mailContainers = mailAvailable(2d6(mailRng) + mailDM) ? mailContainerCount(d6(mailRng)) : 0
```

The five crew-derived inputs (`crewStewardMax`, `crewPassengerCheckMax`,
`crewFreightCheckMax`, `crewNavalScoutRankMax`, `crewSocialStandingMax`)
and `shipArmed` are computed **server-side**, not by this pure function —
`worker/src/routes/ships.js`'s ship-loading route runs `MAX(...)`
aggregate queries over `crew` joined to `player_skills`/`players`
(mirroring its pre-existing `crew_staterooms` `COUNT(*)` query exactly),
attached to the returned ship object; `ship.js` exposes thin computed
passthroughs, and `tick.js`'s `ensureTrafficSnapshot` (which imports
`useShipStore` directly — mutual Pinia store imports are safe as long as
`useXStore()` is only called lazily inside each store's own `defineStore`
body, as both already do) reads them at generation time.

**Known limitation, not introduced or fixed by this phase**: `hexDistance()`
is sector-relative coordinate math with no cross-sector offset awareness,
so cross-sector manual-entry destinations get an inaccurate parsec count —
T5 fares already had this exact gap.

**Freight lot tonnage is rolled, not chosen**: `FreightPanel.vue`'s
`lotTons` computed rolls `MGT2022_FREIGHT_LOT_SIZE_DICE[lotSize]` (Major
1D×10, Minor 1D×5, Incidental 1D) via a seeded RNG keyed by
`...freight-lot:${lotSize}:${tick}:v1`, fixed and non-editable per lot
size/tick — "a freight lot cannot be broken up."

`book-passengers`/`book-freight`/`accept-mail` all validate server-side:
stateroom (High+Middle), low-berth (Low), cargo tons (Basic Passage,
booked-but-undelivered Freight, and accepted Mail containers all count
against `cargoAvailable`), and the `traffic_snapshots` cap for the
requested tier/lot-size/container count — previously these routes
validated nothing at all, relying entirely on the client's own checks. All
three additionally run an atomic guarded decrement against the matching
`traffic_snapshots` row (`UPDATE ... SET x = x - ? WHERE ... AND x >= ?`,
checked via `meta.changes`, the same pattern as `buy-cargo`'s
`qty_available` guard), keyed by destination as well as origin/ship, so
availability actually depletes as bookings happen and two concurrent
bookings racing for the last seat/lot/container can't both win.

## 7d. Black Market (MgT2022 only)

A new, additive mechanic — not a fix to something broken. Goods
composition already supported a `seekingBlackMarket` flag
(`mgt2022Composition`'s reroll-avoidance for die range 61-65) but nothing
ever set it. Per the user's choice, black-market access resolves like
Find a Supplier's one-click check, but **ship-wide** rather than
per-player: whichever crew member has the ship's single highest
Streetwise skill (`crew_streetwise_max`, looked up server-side — the
route does not trust a client-supplied skill level, since there's no one
acting player to trust) is used automatically, and success unlocks the
black-market view for the *whole ship's crew* for the rest of the
game-month, tracked in `black_market_search_attempts` (mirrors
`supplier_search_attempts`, keyed by `ship_id` instead of `player_id`).

**Composition mechanic.** Black-market extras don't roll the full D66
range and hope to land in the illegal band — each of a world's
population-code extra draws instead rolls 1D and prepends a forced `'6'`
leading digit (`rollBlackMarketDie`), always landing in 61-66. Landing on
66 (Exotics) is simply skipped, the same as the normal path's existing
"die not in the priced-goods table" guard. This replaces (for
black-market composition only) the normal path's `rollD66` + reroll-
avoidance; `isRerollRequired(die, seekingBlackMarket)` still exists but is
now moot for the black-market path (its own dice can only ever be 61-66).
`generateWorldSnapshot`'s dispatcher forwards `seekingBlackMarket` through
to `generateMgT2022Snapshot`, which gives the black-market roll its own
`:composition:blackmarket:` seed segment, distinct from the normal
listing's, so the two don't collide for the same world/tick.

Goods pricing itself stays world/tick-scoped, not ship-scoped: a second,
parallel row set per (world, tick) in `market_snapshots`
(`is_black_market = 1`), generated lazily via `tick.ensureBlackMarketSnapshot()`
the same way normal snapshots are — mirrors how Find a Supplier gates
visibility into already-shared data, just swapping "per-player" for
"per-ship." `tick.js`'s `displayBlackMarketSnapshots` computed mirrors
§7b's per-player `displaySnapshots` overlay, sourced from the black-market
row set instead of the normal one. `MarketTable.vue` shows a "Seek Black
Market" one-click button (with an attempts-so-far hint, mirroring
`FindSupplierPanel.vue`) until success, then a toggle switching the
table's row source between `displaySnapshots` and
`displayBlackMarketSnapshots`.

## 7e. CT7 Passenger/Freight Availability

Distinct from §7c's MgT2022 mechanic — same underlying motivation (the
user's own hypothesis that CT had an unmodeled destination-DM traffic gap,
confirmed correct on inspection), but Book 7's own "Passengers"/"Cargo"
tables have a genuinely different shape: the SOURCE world's Population
digit picks a dice EXPRESSION directly (no intermediate 2D6+DM → dice-
count lookup, unlike MgT2022), and flat DMs from the destination world
apply on top of the rolled sum. No Basic passage tier and no Mail
availability roll exist in this text — Mail stays a flat Cr25,000
payment, unaffected.

```
# Passengers — own stream. Population row picked directly (not via 2D+DM).
row = CT7_PASSENGER_AVAILABILITY[originPopDigit]   # {high, middle, low} dice expressions
for tier in {high, middle, low}:
  if ct7PassengerZoneBlocked(destZone, tier): count = 0; continue   # Red blocks Middle/Low
  dm = ct7PassengerPopulationDM(destPopDigit) + ct7PassengerZoneDM(destZone)
     + ct7TrafficTLDM(sourceTL, destTL) + crewSkillDM[tier]   # Steward/Admin/Streetwise
  count = rollCT7Availability(row[tier], rollDiceBatch(passengerRng, 8), dm)

# Freight — own stream, same dice-batch-per-tier discipline.
row = CT7_CARGO_AVAILABILITY[originPopDigit]   # {major, minor, incidental}
for tier in {major, minor, incidental}:
  if ct7CargoZoneBlocked(destZone, tier): count = 0; continue   # Red blocks all, Amber blocks Major
  dm = ct7CargoPopulationDM(destPopDigit) + ct7TrafficTLDM(sourceTL, destTL) + crewLiaisonMax (Minor only)
  count = rollCT7Availability(row[tier], rollDiceBatch(freightRng, 8), dm)
```

`rollCT7Availability(expr, rolls, dm)` handles two Book 7 dice notations:
flat `"XD+N"`/`"XD-N"` (sum X dice, add/subtract a flat modifier) and
`"XD-YD"` (sum X dice, sum a SEPARATE Y dice, subtract the second from the
first) — both floor at 0. Each tier evaluation draws a FIXED 8-dice batch
from its stream regardless of which dice the expression actually
consumes or what DM applies — this makes the RNG-isolation discipline
that MgT2022's traffic mechanic needed dedicated per-tier streams for
(§7c) automatic here: since dice consumption per tier never varies, one
tier's DM can never shift where the next tier's draws start from, even
within the same stream. Passengers and Freight still use separate
streams from each other, same reasoning as always.

**Destination DM values**: Population 4- is DM-3 for both Passengers and
Freight; Population 8+ is DM+3 (Passengers) or DM+1 (Freight) — Book 7's
own asymmetry, distinct from MgT2022's. Red Zone: DM-12 and Middle/Low
passengers blocked outright (High still rolls); all Freight blocked
outright. Amber Zone: DM-6 for Passengers (no block); Major Freight
blocked, Minor/Incidental unaffected. Tech Level: `sourceTL - marketTL`
(`ct7TrafficTLDM`) — the rulebook text doesn't give a worked example to
pin the sign down, so this mirrors the one Book 7 mechanic that does
(§7, `tlAdjustment`) rather than guessing independently.

**Crew skill DMs** reuse `crew_steward_max`/`crew_streetwise_max` (already
computed for MgT2022) and add two new aggregates,
`crew_admin_max`/`crew_liaison_max`, at the same ship-load `MAX(...)`
query site. Steward → High passengers, Admin → Middle, Streetwise → Low,
Liaison → Minor cargo (Major/Incidental have no skill DM per the text).

**Freight has no discrete "lot" concept.** Book 7's Major/Minor/Incidental
are continuous tonnage *pools* — "how much cargo of this size class exists
to be booked," not "how many indivisible lots." `FreightPanel.vue` shows a
tonnage stepper (bounded by whichever is smaller: the pool remaining this
tick, or the ship's free cargo space) instead of MgT2022's fixed rolled
lot size. Rate is a flat Cr1,000/ton (`CT7_FREIGHT_RATE_PER_TON`) regardless
of distance or tier — Book 7's Ship Revenues table, no per-parsec scaling.
Book-freight's traffic-availability decrement (`worker/src/routes/ships.js`)
now takes a `traffic_consumed` amount instead of a hardcoded `1`: MgT2022
still sends nothing (defaults to 1 lot), CT7 sends the actual tonnage
booked. No due-tick or late-delivery-penalty mechanic exists in this
text, so CT7 bookings pass `due_tick: null` — `deliver-freight`'s existing
`isLate` check already treats a null due_tick as never late, so no worker
change was needed there.

`PassengersPanel.vue`/`FreightPanel.vue` gate on `tradeRules === 'MgT2022'
|| tradeRules === 'CT7'` for the shared destination-first flow, branching
internally on `tradeRules` only where the mechanics actually diverge
(parsecs field, lot tonnage display, due-tick note). T5 is unaffected —
still flagged for its own future pass.
