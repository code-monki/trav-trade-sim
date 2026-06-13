# Test Plan

**Project:** Traveller Trade Simulator  
**Version:** 0.1.0

---

## 1. Testing Approach

TTS uses a three-tier test strategy:

| Tier | Tool | Scope | Run condition |
|------|------|-------|---------------|
| Unit | Vitest + happy-dom | Pure library functions, store actions with mocked Supabase | Every commit |
| Component | @vue/test-utils + Vitest | Vue component rendering and interaction | Every commit |
| E2E | Playwright | Full user flows against a real (test) Supabase project | Pre-release |

All tests are deterministic. The trade engine uses a seeded PRNG, so price output is predictable without randomness mocking.

---

## 2. Test Environment

### Unit / Component
```
npm test           # Vitest run (headless, happy-dom)
npm run coverage   # With V8 coverage report
```

Environment variables for component tests that need Supabase: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` point to a dedicated test project (separate from production). All test data is isolated by campaign code prefix `TEST-`.

### E2E
```
npx playwright test
```
Requires `PLAYWRIGHT_BASE_URL` (defaults to `http://localhost:5173`) and test Supabase credentials. Tests create their own campaigns and clean up after themselves.

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
| ST-101 | `loadCalendar()` with Supabase returning tick=48 | `currentTick=48`, `imperialDate="001-1106"` |
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
10. Verify trade_record in Supabase dashboard

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

### MTS-6: Campaign Deletion
1. Create campaign (code: `TEST-DELETE-01`)
2. Navigate to Manage Campaign → Campaign tab
3. Click "Delete Campaign…"
4. Enter an incorrect PIN — verify error message, no deletion
5. Enter correct Referee PIN — verify:
   - Redirect to login screen
   - Sign-in attempt with `TEST-DELETE-01` returns "Campaign not found"
   - Supabase dashboard shows no rows for this campaign_id in any table

### MTS-5: Multi-Milieu Dates
1. Create campaign with Far Future milieu, starting year 1900
2. Verify header shows `001-1900`
3. Advance 48 ticks
4. Verify header shows `001-1901`
