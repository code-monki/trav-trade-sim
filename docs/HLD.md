# High-Level Design

**Project:** Traveller Trade Simulator  
**Version:** 0.7.0

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
│   │                           PORT_TABS: market / passengers / services
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
    8. marketBase    = marketBasePrice(tradeCodes, tradeCodes)
    9. tlAdjusted    = tlAdjustment(sourceTL, worldTL, marketBase)
   10. salePrice     = tlAdjusted × actualValueMultiplier(saleRoll)
   11. eventMod     = Σ effect_pct for active events matching die or '__all__'
   12. salePrice   *= (1 + eventMod/100)
   13. qty = rollQty(good.qty, [d6(rng), d6(rng), ...])
```

All inputs are deterministic; same seed = same price on every client. (This pipeline is CT7's; T5 shares the same 36 `CT2_TRADE_GOODS` table but its own pricing formulas — see `trade-engine-t5.js` — and MgT2022 uses an entirely different table/pipeline, §7a below.)

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

CT7's Broker **fee** (`brokerFee(skill, finalPrice)` — 5% × skill × transaction value, paid regardless of profit/loss) is a lump deduction at the moment of sale, not a per-ton price term, mirroring the existing freight late-delivery-penalty pattern: `ship.js`'s `sellCargo()` computes it and sends `broker_fee_total`; `worker/src/routes/ships.js`'s `/sell-cargo` nets it out of the credited amount and records it as a distinct `'fee'`-type transaction.
