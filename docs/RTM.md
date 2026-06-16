# Requirements Traceability Matrix

**Project:** Traveller Trade Simulator  
**Version:** 0.2.0

This matrix links each functional requirement to its design artefacts, implementation, and test coverage.

---

## Legend

| Column | Content |
|--------|---------|
| **FR-ID** | Functional requirement identifier (from SRS.md) |
| **Design** | HLD / DD sections where the requirement is addressed |
| **Implementation** | Files / functions / migrations |
| **Unit Tests** | TC-IDs from TEST_PLAN §3 |
| **Component Tests** | TC-IDs from TEST_PLAN §4 |
| **E2E Tests** | TC-IDs from TEST_PLAN §6 |
| **Manual** | MTS-IDs from TEST_PLAN §7 |

---

## 2.1 Campaign Management

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-101 | Create campaign | HLD §4.1, DD §1.2 | `auth.js:createCampaign`, migration 016 `create_campaign` | — | — | E2E-101 | MTS-1 |
| FR-102 | Recovery code generated once | HLD §6, DD §1.2 | migration 016, `RecoveryCodeDialog.vue`, `auth.js:createCampaign` | — | CT-301–305 | E2E-101 | MTS-2 |
| FR-103 | Join campaign | HLD §4.1 | `auth.js:joinCampaign`, migration 002 `join_campaign` | — | — | E2E-102 | MTS-1 |
| FR-104 | Authenticate with PIN | HLD §6 | `auth.js:login`, migration 002 `verify_pin` | — | — | E2E-103 | MTS-1 |
| FR-105 | Lockout after 5 failures | HLD §6, DD §1.1 `players` | migration 002 `verify_pin` (lockout logic) | — | — | E2E-104 | MTS-2 |
| FR-106 | Reset PIN with recovery code | HLD §6, DD §1.2 | migration 014 `reset_pin_with_recovery_code`, `auth.js:resetPin`, `LoginView.vue` | — | — | E2E-105 | MTS-2 |
| FR-107 | Regenerate recovery code | HLD §6 | migration 015 `regenerate_recovery_code`, `auth.js:regenerateRecoveryCode`, `RefereeView.vue` | — | — | — | MTS-2 |
| FR-108 | Session persistence | HLD §4.1 | `auth.js` (localStorage `tts_session`) | — | — | E2E-106 | — |
| FR-109 | Referee deletes campaign with PIN | HLD §6, DD §1.2 | migration 018 `delete_campaign`, `auth.js:deleteCampaign`, `RefereeView.vue` Campaign tab Danger Zone | — | — | E2E-107 | MTS-6 |

## 2.2 Imperial Calendar

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-201 | One calendar per campaign | DD §1.1 `campaign_calendar` | migration 001 schema, migrations 002/016 insert | — | — | — | — |
| FR-202 | Display as DDD-YYYY | DD §4 | `market-tick.js:formatImperialDate`, `tick.js:imperialDate`, `MapView.vue` header | UT-105–107 | — | — | MTS-5 |
| FR-203 | Only referee advances tick | HLD §4.4 | `tick.js:advanceTick` (isReferee guard), migration 004 `advance_tick` | — | — | — | MTS-1 |
| FR-204 | Monthly rollup at tick%4=0 | HLD §4.4 | migration 003 `rollup_month`, migration 004 `advance_tick` | UT-113–114 | — | — | — |
| FR-205 | Annual rollup at tick%48=0 | HLD §4.4 | migration 003 `rollup_year`, migration 004 `advance_tick` | UT-115 | — | — | — |
| FR-206 | Starting tick from year/day | HLD §4.1, DD §4 | `auth.js:createCampaign` (`startTick = (year-1105)*48 + week-1`), migration 016 | UT-101–104 | — | — | MTS-5 |

## 2.3 World and Sector Navigation

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-301 | Load sector/world data from Traveller Map | HLD §2, HLD §3 | `map.js:loadSectors`, `map.js:loadWorlds` | — | — | — | — |
| FR-302 | Filter sectors and worlds | HLD §3 | `MapView.vue` (sectorFilter, map.searchQuery) | — | — | — | — |
| FR-303 | Selected world highlighted | DD §7 | `MapView.vue` world-list `.selected` class | — | — | — | — |
| FR-304 | World detail with UWP decode | HLD §3, DD §7 | `map.js:decodedUWP`, `MapView.vue` Overview tab | — | — | — | — |
| FR-305 | UWP badge links to Traveller Map | DD §7 | `MapView.vue` `travellerMapUrl`, `.uwp-link` | — | — | — | — |
| FR-306 | Milieu seeded from campaign | HLD §4.2 | `MapView.vue:onMounted` (`map.selectedMilieu = auth.campaign.milieu`) | — | — | — | MTS-5 |

## 2.4 Market

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-401 | Show 36 goods with prices | DD §7 | `MarketTable.vue`, `tick.js:worldSnapshots` | — | CT-103 | E2E-201 | MTS-1 |
| FR-402 | Deterministic price generation | HLD §7, DD §5 | `market-tick.js:generateWorldSnapshot`, `makeRng` | UT-108–111 | — | — | — |
| FR-403 | Lazy snapshot generation | HLD §4.3 | `tick.js:ensureWorldSnapshot` | — | — | ST-102–103 | — |
| FR-404 | Backfill year history on first visit | HLD §4.3 | `tick.js:ensureWorldSnapshot` (backfill loop) | — | — | — | MTS-3 |
| FR-405 | Price colour coding | DD §7 | `MarketTable.vue` `priceClass()` | — | — | — | — |
| FR-406 | Event banner above table | DD §7 | `MarketTable.vue` `.events-banner`, `tick.js:eventsForWorld` | — | — | — | MTS-3 |
| FR-407 | Multi-good chart selection | HLD §5.1 | `MarketTable.vue` Plot column + `toggle-chart` emit, `MapView.vue:chartedGoods` | — | CT-108 | E2E-203 | — |
| FR-408 | Weekly/monthly/annual charts | HLD §4.3 | `PriceChart.vue`, `tick.js:loadWeeklyHistory/loadMonthlyHistory/loadAnnualHistory` | — | — | — | — |
| FR-409 | Per-row Buy button | DD §2, DD §7 | `MarketTable.vue` `showBuyButton` prop, `.buy-row-btn` | — | CT-109–111 | E2E-301 | MTS-1 |

## 2.5 Trading — Buy

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-501 | Only `can_trade` characters may buy | HLD §4.5, DD §1.1 `crew` | `ship.js:buyCargo` (canTrade guard) | — | — | — | MTS-1 |
| FR-502 | Buy dialog with price/qty/hold/credits | DD §2 `BuyDialog` | `BuyDialog.vue` | — | CT-201–203 | E2E-301 | MTS-1 |
| FR-503 | Prevent over-buy | DD §3 `useShipStore` | `ship.js:buyCargo` pre-checks | — | CT-202 | — | ST-202–203 |
| FR-504 | Buy inserts cargo + transaction, debits credits | HLD §4.5 | `ship.js:buyCargo` | — | — | E2E-302 | MTS-1 |
| FR-505 | Hold display updates after buy | DD §3 | `ship.js` cargo ref reactivity | — | — | E2E-302 | — |

## 2.6 Trading — Sell

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-601 | Only `can_trade` characters may sell | HLD §4.5 | `ship.js:sellCargo` (canTrade guard) | — | — | — | MTS-1 |
| FR-602 | Sell confirmation with profit/loss | HLD §4.5 | `CargoHold.vue` confirm row | — | — | E2E-303 | MTS-1 |
| FR-603 | Sell removes cargo, logs transaction + trade_record | HLD §4.5 | `ship.js:sellCargo` | — | — | E2E-303 | MTS-1 |
| FR-604 | Profit flash notification | DD §2 | `CargoHold.vue` flash animation | — | — | E2E-303 | MTS-1 |

## 2.7 Route Analysis

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-701 | Show worlds within jump range | HLD §5.1 | `RouteAnalysis.vue`, `hexDistance.js` | UT-401–404 | — | — | MTS-4 |
| FR-702 | Route row with profit projection | HLD §5.1 | `RouteAnalysis.vue` profit calculation | — | — | — | MTS-4 |
| FR-703 | Select commits location + navigates | HLD §4.5 | `RouteAnalysis.vue:selectWorld`, `ship.js:updateLocation` | — | — | — | MTS-4 |

## 2.8 Market Events

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-801 | Auto-generate events on market visit | HLD §4.3 | `tick.js:maybeInsertEvent`, `market-events.js:maybeGenerateEvent` | UT-301–302 | — | — | MTS-3 |
| FR-802 | Minor/Major/Crisis severity tiers | HLD §7 | `market-events.js` MARKET_EVENTS table + tier rates | UT-302 | — | — | — |
| FR-803 | Local or subsector scope | HLD §7 | `market-events.js` `scope` field | UT-303–306 | — | E2E-404 | MTS-3 |
| FR-804 | Referee creates events manually | HLD §5.1 | `RefereeView.vue` Events tab, `referee.js:createEvent` | — | — | E2E-404 | MTS-3 |
| FR-805 | Referee expires events early | HLD §5.1 | `RefereeView.vue` Expire button, `referee.js:expireEvent` | — | — | E2E-405 | MTS-3 |
| FR-806 | Event history + annual purge | HLD §4.4, DD §1.1 | `EventsHistory.vue`, migration 006 `rollup_year` purge | UT-306 | — | — | — |

## 2.9 Ships and Crew

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-901 | Referee creates ships | DD §1.1 `ships`, DD §3 | `RefereeView.vue` Ships tab, `referee.js:createShip` | — | — | E2E-402 | MTS-1 |
| FR-902 | Assign players to ships | DD §1.1 `crew` | `RefereeView.vue`, `referee.js:assignCrew` | — | — | E2E-403 | MTS-1 |
| FR-903 | Toggle can_trade | DD §1.1 `crew`, migration 012 | `RefereeView.vue` crew checkbox | — | — | — | MTS-1 |
| FR-904 | Captains auto-get can_trade | DD §1.1 | `RefereeView.vue:assignCrew` / `ship.js:createShip` (captain insert) | — | — | E2E-403 | MTS-1 |
| FR-905 | One ship per player | DD §3 `loadShip` | `ship.js:loadShip` (`is('left_tick', null).limit(1)`) | — | — | — | — |
| FR-906 | Ship location updated on jump | HLD §4.5 | `ship.js:updateLocation`, `RouteAnalysis.vue:selectWorld` | — | — | — | MTS-4 |

## 2.10 Player Skills

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-1001 | Referee manages skills | DD §1.1 `player_skills` | `RefereeView.vue` Players tab, migration 010 | — | — | — | — |
| FR-1002 | Skills visible to referee | HLD §5.1 | `RefereeView.vue` Players tab expand | — | — | — | — |

## 2.11 Passengers

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-1101 | Book passengers at Port > Passengers | DD §2 `PassengersPanel` | `PassengersPanel.vue`, `ship.js:bookPassengers`, migration 021 | — | — | — | — |
| FR-1102 | Validate capacity before booking | DD §3 | `ship.js:bookPassengers` (stateroomsAvailable check) | UT-501–504 | — | — | — |
| FR-1103 | CT7/T5 fare calculation | DD §1.1 `passenger_manifests` | `passengers.js:passengerFare` | UT-501–504 | — | — | — |
| FR-1104 | Booking creates manifest + transaction | HLD §4 | `ship.js:bookPassengers` | — | — | — | — |
| FR-1105 | Auto-deliver on arrival | HLD §5.1 | `ship.js:updateLocation`, `ship.js:deliverPassengers`, `RefereeView.vue:autoDeliverOnMove` | — | — | — | — |
| FR-1106 | Manifest tab shows occupancy + passengers | DD §2 `PassengerManifest` | `PassengerManifest.vue` | — | — | — | — |
| FR-1107 | Referee refund | HLD §5.1, DD §2 | `RefereeView.vue:doRefundPassenger`, `ship.js:refundPassenger` | — | — | — | — |

## 2.12 Fuel Purchasing

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-1201 | Fuel availability from starport class | DD §2 `ShipServices` | `passengers.js:availableFuelTypes`, `ShipServices.vue` | UT-505–509 | — | — | — |
| FR-1202 | Refined/unrefined pricing by starport | DD §2 | `passengers.js:FUEL_PRICES` | UT-505–509 | — | — | — |
| FR-1203 | Cap at remaining tank capacity | DD §3 | `ship.js:purchaseFuel` (capacity check), `ShipServices.vue` (stepper max) | — | — | — | — |
| FR-1204 | Fill for jump shortcut | DD §2 | `ShipServices.vue:fillForJump` | UT-510 | — | — | — |
| FR-1205 | Fuel purchase writes transaction + updates fuel_current | DD §3 | `ship.js:purchaseFuel`, migration 022 | — | — | — | — |
| FR-1206 | Fill-level indicator | DD §7 | `ShipServices.vue` `.fuel-bar` | — | — | — | — |

## 2.13 Mail Contracts

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-1301 | Accept mail at Port > Services | DD §2 `ShipServices` | `ShipServices.vue`, `ship.js:acceptMailContract`, migration 021 | — | — | — | — |
| FR-1302 | CT7/T5 payment calculation | DD §2 | `passengers.js:mailPayment` | UT-511–512 | — | — | — |
| FR-1303 | Track in mail_contracts table | DD §1.1 | migration 021, `ship.js:acceptMailContract` | — | — | — | — |
| FR-1304 | Auto-deliver + credit on arrival | HLD §4 | `ship.js:deliverMail`, `RefereeView.vue:autoDeliverOnMove` | — | — | — | — |
| FR-1305 | Contracts tab | DD §2 `ContractsPanel` | `ContractsPanel.vue` | — | — | — | — |

## 2.1 Campaign Management (additions)

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-110 | Referee edits campaign label | DD §7 | `RefereeView.vue` Campaign tab inline edit, supabase UPDATE campaigns SET label | — | — | — | — |

## 2.8 Market Events (additions)

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-807 | Pre-built event catalogue | DD §7 | `RefereeView.vue:EVENT_CATALOGUE` (20 entries) | — | — | — | — |

## 2.4 Market (additions)

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-408 (realized) | Realized OHLCV chart tab | DD §2 `PriceChart` | `PriceChart.vue` Realized tab, `realized_ohlcv` view (migration 008) | — | — | — | — |

---

## Non-Functional Requirements Coverage

| NFR-ID | Requirement (summary) | Verification Method |
|--------|----------------------|---------------------|
| NFR-1 | Snapshot generation < 2s | Manual timing (MTS-1); Playwright network tab |
| NFR-2 | Deterministic prices | UT-108–112 (same inputs → same output) |
| NFR-3 | PINs as bcrypt hash | Code review of migration 002; never appears in logs |
| NFR-4 | Recovery code one-time display | CT-301–305; E2E-101; MTS-2 |
| NFR-5 | Mutations via SECURITY DEFINER RPCs only | Code review; no direct table writes from client for auth data |
| NFR-6 | Keyboard shortcuts + focus traps | Manual testing; `useFocusTrap.js` review |
| NFR-7 | 1024px+ viewport | Manual testing at 1024px, 1280px, 1920px |
| NFR-8 | Atomic credit operations | Code review (`ship.js` sequential await chain); ST-204–205 |
| NFR-9 | Cross-browser support | Playwright test run in Chromium, Firefox, WebKit |
| NFR-10 | Numbered migration files | File-naming convention in `supabase/migrations/` |
