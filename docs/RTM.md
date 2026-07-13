# Requirements Traceability Matrix

**Project:** Traveller Trade Simulator  
**Version:** 0.4.0

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

Implementation citations reference the current Cloudflare D1/Workers codebase (`worker/src/routes/*.js`, `d1/*.sql`) — the backend migrated off Supabase 2026-07-05, and no `supabase/migrations/` directory or stored-procedure layer exists in this project.

---

## 2.1 Campaign Management

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-101 | Create campaign | HLD §4.1, DD §1.2 | `auth.js:createCampaign`, `worker/src/routes/auth.js`, `d1/schema.sql` (campaigns, campaign_calendar, players) | — | — | E2E-101 | MTS-1 |
| FR-102 | Recovery code generated once | HLD §6, DD §1.1 | `RecoveryCodeDialog.vue`, `auth.js:createCampaign`, `d1/schema.sql` (campaigns.recovery_code_hash) | — | CT-301–305 | E2E-101 | MTS-2 |
| FR-103 | Join campaign | HLD §4.1 | `auth.js:joinCampaign`, `worker/src/routes/auth.js`, `d1/schema.sql` (players) | — | — | E2E-102 | MTS-1 |
| FR-104 | Authenticate with PIN | HLD §6 | `auth.js:login`, `worker/src/routes/auth.js`, `d1/002_sessions.sql` | — | — | E2E-103 | MTS-1 |
| FR-105 | Lockout after 5 failures | HLD §6, DD §1.1 `players` | `worker/src/routes/auth.js:login` (lockout logic), `d1/schema.sql` (players.failed_attempts/locked_until) | — | — | E2E-104 | MTS-2 |
| FR-106 | Reset PIN with recovery code | HLD §6, DD §1.1 | `auth.js:resetPin`, `worker/src/routes/auth.js`, `LoginView.vue` | — | — | E2E-105 | MTS-2 |
| FR-107 | Regenerate recovery code | HLD §6 | `auth.js:regenerateRecoveryCode`, `worker/src/routes/auth.js`, `RefereeView.vue` Campaign tab | — | — | — | MTS-2 |
| FR-108 | Session persistence | HLD §4.1 | `auth.js` (localStorage `tts_session`), `d1/002_sessions.sql` | — | — | E2E-106 | — |
| FR-109 | Referee deletes campaign with PIN | HLD §6, DD §1.1 | `auth.js:deleteCampaign`, `worker/src/routes/auth.js`, `RefereeView.vue` Campaign tab Danger Zone, `ON DELETE CASCADE` (`d1/schema.sql`) | — | — | E2E-107 | MTS-6 |
| FR-110 | Referee edits campaign label | DD §7 | `worker/src/routes/campaigns.js`, `RefereeView.vue` Campaign tab inline edit | — | — | — | — |

## 2.2 Imperial Calendar

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-201 | One calendar per campaign | DD §1.1 `campaign_calendar` | `d1/schema.sql`, `auth.js:createCampaign` (initial row insert) | — | — | — | — |
| FR-202 | Display as DDD-YYYY | DD §4 | `market-tick.js:formatImperialDate`, `tick.js:imperialDate`, `MapView.vue` header | UT-105–107 | — | — | MTS-5 |
| FR-203 | Only referee advances tick | HLD §4.4 | `tick.js:advanceTick` (isReferee guard), `worker/src/routes/calendar.js` (`requireReferee`) | — | — | — | MTS-1 |
| FR-204 | Monthly rollup at tick%4=0 | HLD §4.4 | `worker/src/lib/rollup.js:doRollupMonth`, `advanceTick` | UT-113–114 | — | — | — |
| FR-205 | Annual rollup at tick%48=0 | HLD §4.4 | `worker/src/lib/rollup.js:doRollupYear`, `advanceTick` | UT-115 | — | — | — |
| FR-206 | Starting tick from year/day | HLD §4.1, DD §4 | `auth.js:createCampaign` (`startTick = (year-1105)*48 + week-1`), `worker/src/routes/auth.js` | UT-101–104 | — | — | MTS-5 |

## 2.3 World and Sector Navigation

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-301 | Load sector/world data from Traveller Map | HLD §2, HLD §3 | `map.js:loadSectors`, `map.js:onSectorChange` | — | — | — | — |
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
| FR-404 | Backfill gaps since last visit | HLD §4.3 | `tick.js:ensureWorldSnapshot` (gap-fill loop, not just first-ever visit) | — | — | — | MTS-3 |
| FR-405 | Price colour coding | DD §7 | `MarketTable.vue` `priceClass()` | — | — | — | — |
| FR-406 | Event banner above table | DD §7 | `MarketTable.vue` `.events-banner`, `tick.js:eventsForWorld` | — | — | — | MTS-3 |
| FR-407 | Multi-good chart selection | HLD §5.1 | `MarketTable.vue` Plot column + `toggle-chart` emit, `MapView.vue:chartedGoods` | — | CT-108 | E2E-203 | — |
| FR-408 | Weekly/monthly/annual charts | HLD §4.3 | `PriceChart.vue`, `tick.js:loadWeeklyHistory/loadMonthlyHistory/loadAnnualHistory` | — | — | — | — |
| FR-408 (realized) | Realized OHLCV chart tab | DD §2 `PriceChart` | `PriceChart.vue` Realized tab, `realized_ohlcv` view (`d1/schema.sql`) | — | — | — | — |
| FR-409 | Per-row Buy button | DD §2, DD §7 | `MarketTable.vue` `showBuyButton` prop, `.buy-row-btn` | — | CT-109–111 | E2E-301 | MTS-1 |

## 2.5 Trading — Buy

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-501 | Only `can_trade` characters may buy | HLD §4.5, DD §1.1 `crew` | `ship.js:buyCargo` (canTrade guard) | — | — | — | MTS-1 |
| FR-502 | Buy dialog with price/qty/hold/credits | DD §2 `BuyDialog` | `BuyDialog.vue` | — | CT-201–203 | E2E-301 | MTS-1 |
| FR-503 | Prevent over-buy | DD §3 `useShipStore` | `ship.js:buyCargo` pre-checks | — | CT-202 | — | ST-202–203 |
| FR-504 | Buy inserts cargo + transaction, debits credits | HLD §4.5 | `ship.js:buyCargo`, `worker/src/routes/ships.js:buy-cargo` (atomic `db.batch()`) | — | — | E2E-302 | MTS-1 |
| FR-505 | Hold display updates after buy | DD §3 | `ship.js` cargo ref reactivity | — | — | E2E-302 | — |

## 2.6 Trading — Sell

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-601 | Only `can_trade` characters may sell | HLD §4.5 | `ship.js:sellCargo` (canTrade guard) | — | — | — | MTS-1 |
| FR-602 | Sell confirmation with profit/loss | HLD §4.5 | `CargoHold.vue` confirm row | — | — | E2E-303 | MTS-1 |
| FR-603 | Sell removes cargo, logs transaction + trade_record | HLD §4.5 | `ship.js:sellCargo`, `worker/src/routes/ships.js:sell-cargo` | — | — | E2E-303 | MTS-1 |
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
| FR-806 | Event history + annual purge | HLD §4.4, DD §1.1 | `EventsHistory.vue`, `worker/src/lib/rollup.js:doRollupYear` (event purge) | UT-306 | — | — | — |
| FR-807 | Pre-built event catalogue | DD §7 | `RefereeView.vue:EVENT_CATALOGUE` (20 entries) | — | — | — | — |

## 2.9 Ships and Crew

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-901 | Referee creates ships | DD §1.1 `ships`, DD §3 | `RefereeView.vue` Ships tab, `referee.js:createShip` | — | — | E2E-402 | MTS-1 |
| FR-902 | Assign players to ships | DD §1.1 `crew` | `RefereeView.vue`, `referee.js:assignCrew` | — | — | E2E-403 | MTS-1 |
| FR-903 | Toggle can_trade | DD §1.1 `crew` | `RefereeView.vue` crew checkbox, `d1/schema.sql` (crew.can_trade) | — | — | — | MTS-1 |
| FR-904 | Captains auto-get can_trade | DD §1.1 | `RefereeView.vue:assignCrew` / `ship.js:createShip` (captain insert) | — | — | E2E-403 | MTS-1 |
| FR-905 | One ship per player | DD §3 `loadShip` | `worker/src/routes/ships.js` (SQL: `WHERE left_tick IS NULL LIMIT 1`) | — | — | — | — |
| FR-906 | Ship location updated on jump | HLD §4.5 | `ship.js:updateLocation`, `RouteAnalysis.vue:selectWorld` | — | — | — | MTS-4 |
| FR-907 | Moving ship auto-delivers matching obligations | HLD §5.1 | `ship.js:updateLocation`, `worker/src/routes/ships.js` | — | — | — | MTS-4 |

## 2.10 Player Skills

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-1001 | Referee manages skills | DD §1.1 `player_skills` | `RefereeView.vue` Players tab, `d1/schema.sql` | — | — | — | — |
| FR-1002 | Skills visible to referee | HLD §5.1 | `RefereeView.vue` Players tab expand | — | — | — | — |

## 2.11 Passengers

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-1101 | Book passengers at Port > Passengers | DD §2 `PassengersPanel` | `PassengersPanel.vue`, `ship.js:bookPassengers`, `d1/004_obligations.sql` (kind='passenger') | — | — | — | — |
| FR-1102 | Validate capacity before booking | DD §3 | `ship.js:bookPassengers` (stateroomsAvailable check) | UT-501–504 | — | — | — |
| FR-1103 | CT7/T5/MgT2022 fare calculation | DD §1.1 `obligations` | `passengers.js:passengerFare` | UT-501–504, UT-513 | — | — | — |
| FR-1104 | Booking creates obligation + transaction | HLD §4 | `ship.js:bookPassengers`, `worker/src/routes/ships.js` | — | — | — | — |
| FR-1105 | Auto-deliver on arrival | HLD §5.1 | `ship.js:updateLocation`, `worker/src/routes/ships.js` | — | — | — | — |
| FR-1106 | Aboard tab shows occupancy + passengers | DD §2 `AboardPanel`/`PassengerManifest` | `AboardPanel.vue`, `PassengerManifest.vue` | — | — | — | — |
| FR-1107 | Referee refund | HLD §5.1, DD §2 | `RefereeView.vue:doRefundPassenger`, `ship.js:refundPassenger` | — | — | — | — |

## 2.12 Fuel Purchasing

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-1201 | Fuel availability from starport class | DD §2 `ShipServices` | `passengers.js:availableFuelTypes`, `ShipServices.vue` | UT-505–509 | — | — | — |
| FR-1202 | Refined/unrefined pricing by starport | DD §2 | `passengers.js:FUEL_PRICES` | UT-505–509 | — | — | — |
| FR-1203 | Cap at remaining tank capacity | DD §3 | `ship.js:purchaseFuel` (capacity check), `ShipServices.vue` (stepper max) | — | — | — | — |
| FR-1204 | Fill for jump shortcut (one-click) | DD §2 | `ShipServices.vue:fillForJump` (sets tons then immediately submits) | UT-510 | — | — | — |
| FR-1205 | Fuel purchase writes transaction + updates fuel_current | DD §3 | `ship.js:purchaseFuel`, `d1/schema.sql` (ships.fuel_current) | — | — | — | — |
| FR-1206 | Fill-level indicator | DD §7 | `ShipServices.vue` `.fuel-bar` | — | — | — | — |

## 2.13 Mail Contracts

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-1301 | Accept mail at Port > Services | DD §2 `ShipServices` | `ShipServices.vue`, `ship.js:acceptMailContract`, `d1/004_obligations.sql` (kind='mail') | — | — | — | — |
| FR-1302 | CT7/T5/MgT2022 payment calculation | DD §2 | `passengers.js:mailPayment` | UT-511–512, UT-515 | — | — | — |
| FR-1303 | Track in obligations table | DD §1.1 `obligations` | `d1/004_obligations.sql`, `ship.js:acceptMailContract` | — | — | — | — |
| FR-1304 | Auto-deliver + credit on arrival | HLD §4 | `ship.js:updateLocation`, `worker/src/routes/ships.js` | — | — | — | — |
| FR-1305 | Contracts tab | DD §2 `ContractsPanel` | `ContractsPanel.vue` (composed within `AboardPanel.vue`) | — | — | — | — |

## 2.14 Ship Templates

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-1401 | Referee CRUD on ship templates | HLD §4.6, DD §1.1 `ship_templates` | `worker/src/routes/referee.js` (ship-templates routes), `RefereeView.vue` Templates sub-panel | — | — | — | MTS-8 |
| FR-1402 | Ruleset tagging (CT7/T5/MgT2022) | DD §1.1 `ship_templates` | `d1/010_mgt2022_trade_rules.sql` (`trade_rules` CHECK, widened from `d1/005_ship_templates.sql`'s 2-value original) | — | — | — | MTS-8 |
| FR-1403 | New Ship form template pre-fill | DD §2 | `RefereeView.vue` New Ship form Template dropdown | — | — | — | MTS-8 |
| FR-1404 | Save existing ship as template | DD §1.2 | `RefereeView.vue` "Save as Template" action | — | — | — | MTS-8 |
| FR-1405 | Template name uniqueness | DD §1.1 | `d1/005_ship_templates.sql` (`UNIQUE(campaign_id, name)`), `worker/src/routes/referee.js` pre-check (409) | — | — | — | MTS-8 |
| FR-1406 | Lazy CT7/MgT2022 starter seed | DD §1.1 | `worker/src/routes/referee.js` (seed-on-first-open logic) | — | — | — | MTS-8 |

## 2.15 Asset Valuation & Net Worth

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-1501 | Ship market_value field | DD §1.1 `ships` | `d1/schema.sql` (ships.market_value), `worker/src/routes/ships.js` (`GET /current`) | — | — | — | MTS-9 |
| FR-1502 | Live/fallback cargo valuation | DD §2 `CargoHold` | `CargoHold.vue` footer row | — | — | — | MTS-9 |
| FR-1503 | Net Worth report formula | HLD §4.6 | `ReportsPanel.vue` Net Worth mode, `worker/src/routes/reports.js` | — | — | — | MTS-9 |
| FR-1504 | "Your Share" scaled by ownership | HLD §4.6 | `ReportsPanel.vue` `myPercentage`/`myShare` computed | — | — | — | MTS-9 |

## 2.16 Debt Tracking

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-1601 | Referee CRUD on ship debts | DD §1.1 `ship_debts` | `worker/src/routes/referee.js` (ship-debts routes), `RefereeView.vue` Debts sub-panel | — | — | — | MTS-10 |
| FR-1602 | No interest, referee-adjusted balance | DD §1.1 | `d1/006_ship_debts.sql` | — | — | — | MTS-10 |
| FR-1603 | Player pays down a debt | HLD §4.6 | `ship.js:payDebt`, `worker/src/routes/ships.js:pay-debt`, `ReportsPanel.vue` Debts mode | — | — | — | MTS-10 |
| FR-1604 | Payment validated against credits/balance | HLD §4.6 | `worker/src/routes/ships.js:pay-debt` (dual validation) | — | — | — | MTS-10 |
| FR-1605 | Separate payment history | DD §1.1 `debt_payments` | `d1/006_ship_debts.sql` | — | — | — | MTS-10 |

## 2.17 Ownership Tracking

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-1701 | Referee records ship ownership shares | DD §1.1 `ship_ownership` | `worker/src/routes/referee.js` (ship-ownership routes), `RefereeView.vue` Ownership section | — | — | — | MTS-11 |
| FR-1702 | 100%-ceiling validation | DD §1.1 | `worker/src/routes/referee.js` (409 on over-100%) | — | — | — | MTS-11 |
| FR-1703 | Default remainder share | HLD §4.6, DD §3 | `ReportsPanel.vue` `myPercentage` fallback | — | — | — | MTS-11 |

## 2.18 Organizations

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-1801 | Player founds organization, becomes officer | HLD §4.6, DD §1.1 `organizations`/`organization_officers` | `worker/src/routes/organizations.js` (`POST /`), `OrganizationsPanel.vue` | — | — | — | MTS-12 |
| FR-1802 | Multiple officers, flat authority | DD §1.1 `organization_officers` | `worker/src/routes/organizations.js:isOfficerOrReferee` | — | — | — | MTS-12 |
| FR-1803 | Cannot remove last officer | DD §1.1 | `worker/src/routes/organizations.js` (409 guard) | — | — | — | MTS-12 |
| FR-1804 | Referee always retains override | HLD §4.6 | `worker/src/routes/organizations.js:isOfficerOrReferee` | — | — | — | MTS-12 |
| FR-1805 | Add/remove member ships, owns_ship flag | DD §1.1 `organization_members` | `worker/src/routes/organizations.js` (members routes), `OrganizationsPanel.vue`/`RefereeView.vue` | — | — | — | MTS-12 |
| FR-1806 | Ship owned outright by at most one org | DD §1.1 | `d1/009_org_financials.sql` (partial `UNIQUE` index), `worker/src/routes/organizations.js` (409 checks in both `POST`/`PATCH` members) | — | — | — | MTS-12 |

## 2.19 Corporation/Fleet Financials

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-1901 | Flat, officer-configurable dues rate | DD §1.1 `organizations.dues_rate` | `worker/src/routes/organizations.js` (`PATCH /:id`) | — | — | — | MTS-13 |
| FR-1902 | Configurable dues frequency | DD §1.1 `organizations.dues_frequency_ticks` | `worker/src/routes/organizations.js` | — | — | — | MTS-13 |
| FR-1903 | "Due" indicator, no automatic collection | HLD §4.6 | `OrganizationsPanel.vue`/`RefereeView.vue` (`isDue`/`nextDueTick` computed) | — | — | — | MTS-13 |
| FR-1904 | Manual dues collection | HLD §4.6, DD §6 | `worker/src/routes/organizations.js:collect-dues` | — | — | — | MTS-13 |
| FR-1905 | Insufficient-credit ships skipped, reported | HLD §4.6 | `worker/src/routes/organizations.js:collect-dues` (`failed_ship_ids`) | — | — | — | MTS-13 |
| FR-1906 | Re-collection guard before period elapses | HLD §4.6 | `worker/src/routes/organizations.js:collect-dues` (409 guard) | — | — | — | MTS-13 |
| FR-1907 | Ad hoc disbursement | HLD §4.6 | `worker/src/routes/organizations.js:disburse` | — | — | — | MTS-13 |
| FR-1908 | Organization equity, 100%-ceiling | DD §1.1 `organization_ownership` | `worker/src/routes/organizations.js` (ownership routes) | — | — | — | MTS-13 |
| FR-1909 | Consolidated fleet report, officer/referee only | HLD §4.6, DD §6 | `worker/src/routes/organizations.js:fleet-report` | — | — | — | MTS-13 |
| FR-1910 | Chained ownership for org-owned ships | HLD §4.6 | `worker/src/routes/reports.js` (`GET /ownership` org-equity branch) | — | — | — | MTS-13 |

## 2.20 MgT2022 Freight & Traffic Availability

| FR-ID | Requirement (summary) | Design Ref | Implementation | Unit | Component | E2E | Manual |
|-------|-----------------------|------------|----------------|------|-----------|-----|--------|
| FR-2001 | Port > Freight tab (MgT2022 only) | HLD §4 | `FreightPanel.vue`, `MapView.vue` (`PORT_TABS` computed) | UT-604 | — | — | MTS-14 |
| FR-2002 | Freight obligation + upfront charge | DD §1.1 `obligations` (kind='freight') | `worker/src/routes/ships.js:book-freight`, `ship.js:bookFreight` | — | — | — | MTS-14 |
| FR-2003 | Auto-deliver on arrival | HLD §5.1 | `ship.js:autoDeliver` (freight branch), `worker/src/routes/ships.js:deliver-freight` | — | — | — | MTS-14 |
| FR-2004 | Late-delivery penalty | DD §1.1 `obligations.due_tick` | `trade-engine-mgt2022.js:freightLatePenaltyPct`/`freightNetAfterPenalty`, `worker/src/routes/ships.js:deliver-freight` | UT-605 | — | — | MTS-14 |
| FR-2005 | Freight refund | HLD §5.1 | `worker/src/routes/ships.js:refund-freight`, `ship.js:refundFreight` | — | — | — | MTS-14 |
| FR-2006 | Deterministic per-tick traffic-availability roll | HLD §4.6 | `traffic-tick.js:generateTrafficSnapshot`, `tick.js:ensureTrafficSnapshot` | UT-610–611 | — | — | MTS-14 |
| FR-2007 | Availability count shown + enforced in booking forms | DD §2 | `PassengersPanel.vue`, `FreightPanel.vue`, `ShipServices.vue` (`trafficAvailability` reads) | — | — | — | MTS-14 |
| FR-2008 | Traffic data scoped to MgT2022 only | DD §1.1 `traffic_snapshots` | `tick.js:ensureTrafficSnapshot` (`trade_rules === 'MgT2022'` guard) | — | — | — | MTS-14 |

---

## Non-Functional Requirements Coverage

| NFR-ID | Requirement (summary) | Verification Method |
|--------|----------------------|---------------------|
| NFR-1 | Snapshot generation < 2s | Manual timing (MTS-1); Playwright network tab |
| NFR-2 | Deterministic prices | UT-108–112 (same inputs → same output) |
| NFR-3 | PINs as strong salted hash | Code review of `worker/src/lib/hash.js` (PBKDF2-SHA256 via Web Crypto API); never appears in logs |
| NFR-4 | Recovery code one-time display | CT-301–305; E2E-101; MTS-2 |
| NFR-5 | Mutations only via Worker routes | Code review; no direct D1 access from client, all writes go through `worker/src/routes/*.js` behind `requireAuth`/`requireReferee` |
| NFR-6 | WCAG 2.2 AA target; keyboard shortcuts + focus traps | Manual testing; `useFocusTrap.js` review; Lighthouse accessibility audit (97/100 on the production build as of 2026-07-13) |
| NFR-6a | Keyboard-operable, visible focus | MTS-15 (manual). **Partial** — verified for primary flows (Login, Passengers/Freight/Services forms, Referee panel tabs); not yet audited for every dialog/table row action |
| NFR-6b | Color not the sole information channel | MTS-15 (manual). **Open gap** — `MarketTable.vue` price coloring, world-list travel-zone coloring, and `CargoHold.vue` profit/loss coloring are currently color-only; no text/icon pairing yet |
| NFR-6c | WCAG 2.2 AA contrast ratios | MTS-15 (manual, no automated contrast-checker run yet). **Not yet verified** |
| NFR-6d | `<main id="main-content">` on every routed view | Code review: `LoginView.vue`, `MapView.vue`, `RefereeView.vue` all confirmed (fixed 2026-07-13 — Login/Referee were previously missing the skip-link target) |
| NFR-6e | Accessible names/ARIA on custom controls | Code review. **Partial** — ~10 of 25 components use `aria-`/`role` attributes (e.g. `WorldPicker.vue`'s listbox, resize handles); several interactive surfaces (`MarketTable.vue`, `CargoHold.vue`, `PassengersPanel.vue`, `FreightPanel.vue`, `ShipServices.vue`) have none yet |
| NFR-7 | 1024px+ viewport | Manual testing at 1024px, 1280px, 1920px |
| NFR-8 | Atomic credit operations | Code review (`db.batch()` usage in `worker/src/routes/*.js`); ST-204–205 |
| NFR-9 | Cross-browser support | Playwright test run in Chromium, Firefox, WebKit |
| NFR-10 | Numbered migration files | File-naming convention in `d1/00X_*.sql` |
