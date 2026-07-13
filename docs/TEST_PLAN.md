# Test Plan

**Project:** Traveller Trade Simulator  
**Version:** 0.4.0

---

## 1. Testing Approach

TTS uses a three-tier test strategy:

| Tier | Tool | Scope | Run condition |
|------|------|-------|---------------|
| Unit | Vitest + happy-dom | Pure library functions, store actions against local D1 (miniflare) | Every commit |
| Component | @vue/test-utils + Vitest | Vue component rendering and interaction | Every commit |
| E2E | Playwright | Full user flows against a running `wrangler dev` Worker + local D1 | Pre-release |

All tests are deterministic. The trade engine uses a seeded PRNG, so price output is predictable without randomness mocking.

---

## 2. Test Environment

### Unit / Component
```
npm test           # Vitest run (headless, happy-dom)
npm run coverage   # With V8 coverage report
```

Environment variable for tests that need the Worker API: `VITE_API_URL` points to a local `wrangler dev` instance (`cd worker && npx wrangler dev`, default `http://localhost:8787`), backed by a local D1 database (`.wrangler/state/v3/d1`, separate from the production database). All test data is isolated by campaign code prefix `TEST-`; manual verification/cleanup queries use `wrangler d1 execute trav-trade-sim --local --command "..."`.

### E2E
```
npx playwright test
```
Requires `PLAYWRIGHT_BASE_URL` (defaults to `http://localhost:5173`) with both the Vite dev server and local `wrangler dev` running. Tests create their own campaigns and clean up after themselves.

---

## 3. Unit Test Cases

### 3.1 `src/lib/market-tick.js`

| TC-ID | Function | Input | Expected Output |
|-------|----------|-------|-----------------|
| UT-101 | `tickToCalendar` | tick=0 | `{ year:1105, day:1, month:1 }` |
| UT-102 | `tickToCalendar` | tick=47 | `{ year:1105, day:323, month:12 }` |
| UT-103 | `tickToCalendar` | tick=48 | `{ year:1106, day:1, month:1 }` |
| UT-104 | `tickToCalendar` | tick=38160 | `{ year:1900, day:1, month:1 }` |
| UT-105 | `formatImperialDate` | tick=0 | `"001-1105"` |
| UT-106 | `formatImperialDate` | tick=48 | `"001-1106"` |
| UT-107 | `formatImperialDate` | tick=50 | `"015-1106"` |
| UT-108 | `makeRng` | same seed twice | Both sequences produce identical values |
| UT-109 | `makeRng` | different seeds | First values differ |
| UT-110 | `generateWorldSnapshot` | standard Ag world, tick=0 | Returns 36 rows, all prices > 0 |
| UT-111 | `generateWorldSnapshot` | same inputs twice | Identical output (determinism) |
| UT-112 | `generateWorldSnapshot` | with active +30% event | `sale_price` ≈ 130% of no-event price |
| UT-113 | `shouldRollupMonth` | tick=0 | false |
| UT-114 | `shouldRollupMonth` | tick=4 | true |
| UT-115 | `shouldRollupYear` | tick=48 | true |

### 3.2 `src/lib/trade-engine-ct7.js`

| TC-ID | Function | Input | Expected Output |
|-------|----------|-------|-----------------|
| UT-201 | `parseTradeCodes` | `"Ag Ni Ri"` | `Set{'Ag','Ni','Ri'}` |
| UT-202 | `parseTradeCodes` | `""` | empty Set |
| UT-203 | `parseTradeCodes` | `"Ag XX Ni"` (XX unknown) | `Set{'Ag','Ni'}` |
| UT-204 | `starportFromUWP` | `"A867A97-C"` | `"A"` |
| UT-205 | `techFromUWP` | `"A867A97-C"` | `"C"` |
| UT-206 | `costOfGoods` | empty codes, starport A, TL 12 | 4000 + starport mod + 1200 |
| UT-207 | `costOfGoods` | `{'Ag'}`, starport B, TL 6 | base + Ag mod + B mod + 600 |
| UT-208 | `marketBasePrice` | source `{'Ag'}`, market `{'In'}` | 5000 + CT7_MARKET_PRICE_TABLE['Ag']['In'] × 1000 |
| UT-209 | `tlAdjustment` | sourceTL=12, marketTL=8, base=10000 | 10000 - (4 × 0.1 × 10000) = 6000 |
| UT-210 | `tlAdjustment` | sourceTL ≤ marketTL | returns basePrice unchanged |
| UT-211 | `actualValueMultiplier` | roll=2 | CT7_ACTUAL_VALUE[2] |
| UT-212 | `actualValueMultiplier` | roll=7 | CT7_ACTUAL_VALUE[7] (≈1.0) |
| UT-213 | `actualValueMultiplier` | roll=20 | CT7_ACTUAL_VALUE[15] (clamped) |
| UT-214 | `rollQty` | `"3Dx5"`, rolls=[2,3,4] | (2+3+4)×5 = 45 |
| UT-215 | `rollQty` | `"1D"`, rolls=[5] | 5 |
| UT-216 | `brokerDM` | skill=3 | 3 |
| UT-217 | `brokerDM` | skill=6 | 4 (capped) |
| UT-218 | `brokerFee` | skill=2, finalPrice=100000 | 0.05 × 2 × 100000 = 10000 |

### 3.3 `src/lib/market-events.js`

| TC-ID | Function | Input | Expected |
|-------|----------|-------|----------|
| UT-301 | `maybeGenerateEvent` | same inputs twice | Identical result (deterministic) |
| UT-302 | `maybeGenerateEvent` | run 10000 times | Event rate ≈ 6% (±1%) |
| UT-303 | `activeEventsForWorld` | local event matching hex | Included |
| UT-304 | `activeEventsForWorld` | local event different hex | Excluded |
| UT-305 | `activeEventsForWorld` | subsector event | Always included |
| UT-306 | `activeEventsForWorld` | expired event (expires_tick ≤ tick) | Excluded |

### 3.5 `src/lib/passengers.js`

| TC-ID | Function | Input | Expected Output |
|-------|----------|-------|-----------------|
| UT-501 | `passengerFare` | High, 1 pax, CT7, parsecs=1 | `{ farePerHead: 10000, fareTotal: 10000 }` |
| UT-502 | `passengerFare` | High, 2 pax, CT7, parsecs=3 | `{ farePerHead: 10000, fareTotal: 20000 }` (CT7 flat, parsecs ignored) |
| UT-503 | `passengerFare` | High, 1 pax, T5, parsecs=3 | `{ farePerHead: 30000, fareTotal: 30000 }` (per parsec) |
| UT-504 | `passengerFare` | Low, 1 pax, T5, parsecs=3 | `{ farePerHead: 1000, fareTotal: 1000 }` (Low always flat) |
| UT-505 | `availableFuelTypes` | `'A'` | `{ refined: 500, unrefined: undefined }` |
| UT-506 | `availableFuelTypes` | `'B'` | `{ refined: 500, unrefined: undefined }` |
| UT-507 | `availableFuelTypes` | `'C'` | `{ refined: undefined, unrefined: 100 }` |
| UT-508 | `availableFuelTypes` | `'E'` | `{}` (no fuel) |
| UT-509 | `availableFuelTypes` | `'X'` | `{}` (no fuel) |
| UT-510 | `jumpFuelTons` | hull=200, parsecs=1 | `20` (ceil(200 × 0.1 × 1)) |
| UT-511 | `mailPayment` | CT7, parsecs=1 | `25000` |
| UT-512 | `mailPayment` | T5, parsecs=3 | `75000` (25000 × 3) |
| UT-513 | `passengerFare` | Basic, 1 pax, MgT2022, parsecs=1 | Cr2,000 (basic < middle at every parsec, see full comparison test) |
| UT-514 | `passageCapacityNeeded` | `'basic'`, count=3 | `{ stateroomsNeeded: 0, lowBerthsNeeded: 0, cargoTonsNeeded: 6 }` |
| UT-515 | `mailPayment` | MgT2022, containerCount=4 | Cr100,000 (25000 × 4) |

### 3.6 `src/lib/trade-engine-mgt2022.js`, `src/lib/traffic-tick.js`, `src/lib/market-tick.js` dispatch

Covers the new MgT2022 pricing/freight/mail/traffic pipeline (`tests/trade-engine-mgt2022.test.js`, 42 cases) and the new traffic-availability generator (`tests/traffic-tick.test.js`). Representative cases:

| TC-ID | Function | Input | Expected Output |
|-------|----------|-------|-----------------|
| UT-601 | `modifiedPricePct` | roll = -3 | `{ purchasePct: 300, salePct: 10 }` |
| UT-602 | `modifiedPricePct` | roll = 25 | `{ purchasePct: 15, salePct: 400 }` |
| UT-603 | `modifiedPricePct` | rolls -3..25 | Purchase% monotonically non-increasing, Sale% monotonically non-decreasing |
| UT-604 | `freightRate` | `'incidental'` vs `'major'`, same parsecs | Incidental > minor > major (smaller lots pay more per ton) |
| UT-605 | `freightLatePenaltyPct` / `freightNetAfterPenalty` | 1D=6, charge=1000 | penalty 100%, net Cr0 (never negative) |
| UT-606 | `mailAvailable` | 2D=11 vs 12 | `false` vs `true` (needs 12+) |
| UT-607 | `smugglingRiskDM` | higher Law Level vs higher Sale DM | Risk increases with Law Level, decreases with Sale DM |
| UT-608 | `generateWorldSnapshot` | `tradeRules: 'MgT2022'` | 36 rows from `MGT2022_TRADE_GOODS`, not `CT2_TRADE_GOODS` |
| UT-609 | `generateWorldSnapshot` | `tradeRules: 'CT7'` vs `'T5'`, same seed | Purchase prices diverge — confirms the pre-existing T5-uses-CT7-pricing bug is fixed |
| UT-610 | `generateTrafficSnapshot` | same inputs twice | Identical row (deterministic) |
| UT-611 | `generateTrafficSnapshot` | high-population vs low-population world, 30 ticks | High-population world's summed traffic ≥ low-population world's |

### 3.4 `src/utils/hexDistance.js`

| TC-ID | Input | Expected |
|-------|-------|----------|
| UT-401 | `hexDistance('0101', '0101')` | 0 |
| UT-402 | `hexDistance('0101', '0102')` | 1 |
| UT-403 | `hexDistance('0101', '0201')` | 1 |
| UT-404 | Known 3-hex diagonal | 3 |

---

## 4. Component Test Cases

### 4.1 `MarketTable`

| TC-ID | Scenario | Expected |
|-------|----------|----------|
| CT-101 | Render with loading=true | Shows "Generating market data…" |
| CT-102 | Render with empty rows | Shows "No market data" |
| CT-103 | Render with 36 rows | All rows present; columns: Plot, Good, Die, Buy, Sell, Spread, Qty |
| CT-104 | Click column header `Die` | Rows reorder by die code ascending |
| CT-105 | Click column header `Die` again | Rows reorder descending |
| CT-106 | Type in filter box | Visible rows reduce to those matching |
| CT-107 | Click a row | `select-good` emitted with snapshot row |
| CT-108 | Check Plot checkbox | `toggle-chart` emitted with die string |
| CT-109 | showBuyButton=false | No Buy column |
| CT-110 | showBuyButton=true, qty=0 | Buy button disabled |
| CT-111 | showBuyButton=true, qty>0 | Buy button enabled; click emits `buy-good` |

### 4.2 `BuyDialog`

| TC-ID | Scenario | Expected |
|-------|----------|----------|
| CT-201 | Open with 100t available, 50t free hold | Max = 50 |
| CT-202 | Open with 100t available, 200 credits, price=5000 | Max = 0 (can't afford); confirm disabled |
| CT-203 | Enter tons, click Confirm | Emits `confirm` with `{ tons }` |
| CT-204 | Click backdrop | Dialog closes (emits `update:modelValue: false`) |

### 4.3 `RecoveryCodeDialog`

| TC-ID | Scenario | Expected |
|-------|----------|----------|
| CT-301 | Render | Code displayed; Continue button disabled |
| CT-302 | Click Copy | "Copied!" feedback shown |
| CT-303 | Check acknowledgement | Continue button enabled |
| CT-304 | Click Continue | `close` emitted |
| CT-305 | Click backdrop | No dismiss (must use Continue) |

---

## 5. Store Test Cases

### 5.1 `useTickStore`

| TC-ID | Scenario | Expected |
|-------|----------|----------|
| ST-101 | `loadCalendar()` with the Worker returning tick=48 | `currentTick=48`, `imperialDate="001-1106"` |
| ST-102 | `ensureWorldSnapshot()` when rows exist in DB | No insert; returns cached rows |
| ST-103 | `ensureWorldSnapshot()` when no rows | Inserts 36 rows; caches result |
| ST-104 | Call `ensureWorldSnapshot()` twice with same args | Second call hits cache, no DB query |
| ST-105 | `advanceTick()` as non-referee | Returns `{ ok: false }` |

### 5.2 `useShipStore`

| TC-ID | Scenario | Expected |
|-------|----------|----------|
| ST-201 | `loadShip()` with no crew row | `ship = null`, `hasShip = false` |
| ST-202 | `buyCargo()` with insufficient credits | Returns `{ ok: false, error }` |
| ST-203 | `buyCargo()` with insufficient hold | Returns `{ ok: false, error }` |
| ST-204 | `buyCargo()` success | cargo row added with `purchase_world_name` set; credits debited; transaction inserted |
| ST-205 | `sellCargo()` success | cargo row removed; credits credited; trade_record inserted |

---

## 6. E2E Test Cases

### 6.1 Authentication

| TC-ID | Scenario | Steps | Expected |
|-------|----------|-------|----------|
| E2E-101 | Create campaign | Fill New Campaign form; submit | RecoveryCodeDialog appears; code shown; check box; Continue → map view |
| E2E-102 | Join campaign | Fill Join Campaign form | Map view shown |
| E2E-103 | Sign in | Fill Sign In form | Map view shown |
| E2E-104 | Wrong PIN | Enter wrong PIN 5× | "account locked" message; no further attempts |
| E2E-105 | Reset PIN | Use Reset PIN form with recovery code | Success message; can sign in with new PIN |
| E2E-106 | Session restore | Sign in; reload page | Map view still shown (session from localStorage) |

### 6.2 Market

| TC-ID | Scenario | Expected |
|-------|----------|----------|
| E2E-201 | Select sector + world, open Market tab | 36 rows visible |
| E2E-202 | Click Sort by Spread descending | Rows reorder |
| E2E-203 | Check Plot checkbox on two goods | Chart appears below table with two series |
| E2E-204 | Advance tick; re-open Market tab | Prices changed |

### 6.3 Trade Flow

| TC-ID | Scenario | Expected |
|-------|----------|----------|
| E2E-301 | Click Buy on a market row | BuyDialog opens with correct good name and prices |
| E2E-302 | Enter 5t and confirm | Cargo tab shows 5t row; ship credits reduced |
| E2E-303 | Select different world; open Cargo tab; sell item | Profit flash shown; cargo row removed; credits increased |

### 6.5 Campaign Deletion

| TC-ID | Scenario | Expected |
|-------|----------|----------|
| E2E-107 | Wrong PIN in delete form | Error message; campaign still exists |
| E2E-108 | Correct PIN in delete form | Session cleared; redirected to login; campaign code no longer valid |

### 6.4 Referee Panel

| TC-ID | Scenario | Expected |
|-------|----------|----------|
| E2E-401 | Non-referee navigates to /referee | Redirected to map |
| E2E-402 | Referee creates a ship | Ship appears in Ships tab |
| E2E-403 | Referee assigns player to ship as captain | `can_trade` automatically checked |
| E2E-404 | Referee creates a market event | Event banner appears on affected world's Market tab |
| E2E-405 | Referee expires event | Event no longer in banner |

---

## 7. Manual Test Scripts

### MTS-1: Full Trade Cycle
1. Referee creates campaign (code: `TEST-MANUAL-01`), notes recovery code
2. Player joins campaign (character: `Trader`)
3. Referee creates ship `Free Trader Beowulf` (200t hull, 80t cargo), starting credits 500,000
4. Referee assigns `Trader` as captain
5. Player selects Regina (Spinward Marches, hex 1910), opens Market tab
6. Player buys 20t Common Electronics
7. Referee advances tick 3×
8. Player selects Efate (hex 1705), opens Cargo tab
9. Player sells Common Electronics — verify profit flash and updated credits
10. Verify trade_record: `wrangler d1 execute trav-trade-sim --local --command "SELECT * FROM trade_records ORDER BY created_at DESC LIMIT 1"`

### MTS-2: Recovery Code Flow
1. Create campaign; save recovery code
2. Sign out; try wrong PIN 5×; verify lockout message
3. Go to Reset PIN tab; enter campaign code, character name, recovery code, new PIN
4. Sign in with new PIN — verify success
5. Referee: Manage Campaign → Campaign tab → Generate New Recovery Code
6. Verify old recovery code is rejected on Reset PIN form

### MTS-3: Event System
1. Open Market tab for a world with `Ag` trade code (e.g. Alell)
2. Advance tick repeatedly until a Minor event fires (expect ~6% per tick per world)
3. Verify event banner appears; verify affected row has amber border
4. Referee creates a Crisis subsector event manually
5. Check that multiple worlds in the same sector show the event in their banners
6. Expire the event; verify it disappears

### MTS-4: Route Analysis and Jump
1. Assign ship jump rating 2
2. Open Jump tab on origin world
3. Verify only worlds within 2 hexes are listed
4. Click Select on a destination — verify ship location updates and Market tab opens for that world

### MTS-7: Passengers, Fuel, and Mail

1. Referee creates a ship with stateroom_capacity=4, fuel_capacity=40, starting location Regina (1910)
2. Player opens Port > Services; verify fuel availability badge shows "Refined Cr500/t" (Class A starport)
3. Player purchases 20t refined fuel; verify ship credits decrease by Cr10,000 and fuel bar shows 20/40t
4. Click "Fill for jump" (J-2 ship, hull 200t); verify stepper sets to min(40, 40-20) = 20t (fills to capacity)
5. Player opens Port > Passengers; book 2 High passage to Efate (1705); verify staterooms show 2/4, credits increase by Cr20,000
6. Player accepts a mail contract to Efate; verify Contracts tab shows pending payment Cr25,000
7. Referee advances tick; player uses Jump tab to Select Efate
8. Verify passengers auto-deliver (Manifest tab shows no in-transit passengers)
9. Verify mail auto-delivers and ship credits increase by Cr25,000
10. Return to Regina; referee issues refund on a second booked passenger; verify ship credits decrease by fare amount

### MTS-8: Ship Templates
1. Referee opens Campaign Management → Ships → Templates
2. For a CT7 or MgT2022 campaign with no templates yet, verify one starter template (Type A Free Trader) is lazily seeded, flagged unverified in its notes; T5 campaigns start with no seed
3. Referee creates a new template (name, ruleset, stats)
4. Referee opens the New Ship form; selects the template from the Template dropdown; verify hull tons, cargo capacity, jump rating, and market value pre-fill
5. Switch back to "Custom Design"; verify the form clears to blank defaults
6. Referee opens an existing ship's detail view; clicks "Save as Template"; enters a name; verify a new template is created matching that ship's current stats
7. Attempt to create a second template with a duplicate name; verify rejection (409)

### MTS-9: Asset Valuation & Net Worth
1. Referee sets a ship's `market_value` via template selection or manual entry
2. Referee records a debt and a partial payment (see MTS-10)
3. Player opens Ship → Reports → Net Worth tab
4. Verify Net Worth = credits + market_value + cargo value (at cost) − total debt
5. Verify "Your Share" reflects the player's ownership percentage (100% by default with no `ship_ownership` rows recorded)

### MTS-10: Debt Tracking
1. Referee opens Campaign Management → Ships → Debts; creates a debt (type, principal, current_balance, due_tick, creditor_name)
2. Verify it appears in the player's Reports → Debts tab
3. Player makes a partial payment; verify the balance decreases and ship credits decrease by the same amount
4. Attempt a payment exceeding ship credits; verify rejection
5. Attempt a payment exceeding the remaining balance; verify rejection

### MTS-11: Ownership Tracking
1. Referee opens a ship's detail view → Ownership section; records a 40% share for a second player
2. Attempt to add another share that would push the total over 100%; verify rejection
3. Player (the ship's captain, with no explicit share recorded) opens the Net Worth tab; verify "Your Share" shows 60% (the recorded remainder), not a flat 100%

### MTS-12: Organizations
1. Player opens Ship → Organizations tab; founds an organization (name, treasury, dues rate); verify they're automatically listed as its officer
2. A second, non-officer player attempts to edit the organization or its membership; verify rejection
3. The first officer adds the second player as an officer; verify they can now manage it
4. Attempt to remove the organization's last officer; verify rejection
5. Add a ship as a member with "Owns Assets" unchecked, then attempt to mark a ship already owned outright by another organization as owned here too; verify rejection
6. Confirm the same organization state (officers, member ships) appears identically in RefereeView's Organizations tab

### MTS-13: Corporation/Fleet Financials
1. Referee (or an officer) sets a dues rate and collection frequency on an organization with member ships
2. Click "Collect Dues"; verify each member ship's credits decrease by the flat rate and the organization's treasury increases by the total collected
3. Immediately click "Collect Dues" again; verify rejection ("not due yet")
4. Disburse funds from the organization's treasury to a member ship; verify treasury decreases and ship credits increase; attempt to disburse more than the treasury balance and verify rejection
5. Record an equity stake for a player in the organization; verify the same 100%-ceiling validation as Ownership Tracking
6. Mark a member ship as owned outright by the organization; open that ship's Net Worth tab and verify "Your Share" now reflects the organization's equity percentage instead of the ship's own `ship_ownership` records
7. Open the organization's Fleet Report (officers/referee only) and verify per-ship and fleet-wide totals match the ships' actual credits/value/cargo/debt

### MTS-14: MgT2022 Trade Ruleset (Freight, Basic Passage, Traffic Availability)
1. Create a campaign with Trade Rules = MgT2022; verify the option appears in the New Campaign dropdown alongside CT7/T5
2. Open Campaign Management → Ships → Templates; verify a "Type A Free Trader" template is lazily seeded (parity with CT7)
3. Select a world with the Market tab open; verify the 36 goods shown are MgT2022's own names (e.g. "Common Electronics"), not CT7/T5's Book 2 names
4. Open Port → Passengers; verify a fourth "Basic Passage" tier appears, and booking it reduces cargo space (not stateroom/berth capacity)
5. Open Port → Freight (visible only for MgT2022 campaigns); book a Major/Minor/Incidental lot; verify the charge is collected upfront and the lot appears in Ship → Aboard → Freight in Transit
6. Advance the tick past the freight's due tick, then navigate the ship to its destination; verify a late-delivery penalty is deducted from credits at delivery and the obligation clears
7. Open Port → Services → Mail; verify mail acceptance is gated on the tick's rolled container count (take-all-or-none) rather than always available
8. Confirm all of the above availability counts (passengers per tier, freight lots per size, mail containers) are visible in their respective forms and change deterministically on tick advance
9. Create a T5 campaign and spot-check its market prices before/after this feature's dispatch-fix change — confirm T5 prices now genuinely differ from an equivalent CT7 campaign's (the pre-existing bug where T5 silently used CT7 pricing is fixed)

### MTS-15: Accessibility (WCAG 2.2 AA)
1. On each routed view (Login, Map, Referee), press Tab once on page load; verify the "Skip to main content" link becomes visible and focused, and activating it (Enter) moves focus into that view's `<main>` landmark
2. Using only the keyboard (Tab/Shift+Tab/Enter/Space/Arrow keys), complete a full trade: select a world, buy cargo, jump, sell — verify every control is reachable and a visible focus outline is present throughout
3. Repeat for booking a passenger and (MgT2022 campaigns) a freight lot, including the passage-type/lot-size button groups
4. Open and close a modal dialog (e.g. Recovery Code, Buy confirmation); verify focus is trapped inside while open and returns to the triggering control on close
5. Run an automated audit (Lighthouse or equivalent) against the production build (`vite build && vite preview`) for Login, Map, and Referee; verify no critical/serious violations — record the accessibility score
6. Visually confirm each color-coded indicator (market price deviation, travel-zone highlighting, ledger/trades/income net figures) also carries a non-color cue (text, icon, or symbol) — closed 2026-07-13: `MarketTable.vue` price cells show ▼/▲, world-list zones show an A/R badge, and `ReportsPanel.vue`/`RouteAnalysis.vue`'s previously sign-dropping (`Math.abs()`-only) profit/loss figures now always show an explicit +/− sign
7. Spot-check text/UI contrast on all three theme variants (including the redesigned `dark-imperium` charcoal palette) against WCAG 2.2 AA thresholds (4.5:1 normal text, 3:1 large text/UI components) using a contrast-checker tool or `npx lighthouse` — the charcoal repaint's default `--accent-dim` button text initially failed at 3.71:1 until the new `--accent-text` token was introduced (see DD.md)

### MTS-16: Schema-Drift Detection
1. Against a local D1 database seeded from `d1/schema.sql` only (migration `011` already folded in), start the Worker (`wrangler dev`) and hit `GET /api/health` — verify `200` with `schema_ok: true`
2. `wrangler d1 execute --local --command "DELETE FROM schema_migrations WHERE id='011'"` to simulate an unapplied migration, then re-hit `GET /api/health` — verify `503` with `schema_ok: false` and `missing_migrations` includes `'011'`
3. Load the frontend against this drifted database — verify the app shows the blocking "database schema is out of date" screen (not the generic error-boundary message) instead of continuing into the app
4. Re-apply `wrangler d1 execute --local --file=d1/011_schema_ledger.sql` (or re-run schema.sql) and reload — verify the app loads normally

### MTS-6: Campaign Deletion
1. Create campaign (code: `TEST-DELETE-01`)
2. Navigate to Manage Campaign → Campaign tab
3. Click "Delete Campaign…"
4. Enter an incorrect PIN — verify error message, no deletion
5. Enter correct Referee PIN — verify:
   - Redirect to login screen
   - Sign-in attempt with `TEST-DELETE-01` returns "Campaign not found"
   - `wrangler d1 execute trav-trade-sim --local --command "SELECT * FROM campaigns WHERE code='TEST-DELETE-01'"` returns no rows (cascade-deleted)

### MTS-5: Multi-Milieu Dates
1. Create campaign with Far Future milieu, starting year 1900
2. Verify header shows `001-1900`
3. Advance 48 ticks
4. Verify header shows `001-1901`
