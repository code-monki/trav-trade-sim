# Software Requirements Specification

**Project:** Traveller Trade Simulator  
**Version:** 0.1.0  
**Status:** Active development

---

## 1. Constraints

| ID | Constraint |
|----|-----------|
| CON-1 | Non-commercial use only; no monetisation |
| CON-2 | Must run in a modern web browser with no installation |
| CON-3 | Backend is Supabase (PostgreSQL + PostgREST + pgcrypto); no custom server |
| CON-4 | Supabase anon key is safe to ship in the bundle; all auth is application-layer PIN |
| CON-5 | No PII is collected or stored; identity is (campaign code, character name, PIN hash) |
| CON-6 | Traveller IP requires fair use compliance; no copyrighted table data is redistributed verbatim |
| CON-7 | All mutations go through SECURITY DEFINER RPCs; client never writes directly to sensitive rows |

---

## 2. Functional Requirements

### 2.1 Campaign Management

| ID | Requirement |
|----|------------|
| FR-101 | The system shall allow a user to create a new campaign by supplying a label, unique campaign code, milieu, trade rules, starting year/day, referee character name, and PIN |
| FR-102 | Campaign creation shall generate a one-time recovery code, display it to the referee, and store only its bcrypt hash |
| FR-103 | The system shall allow additional characters to join an existing campaign using the campaign code, a unique character name, and a new PIN |
| FR-104 | The system shall authenticate a character with campaign code + character name + PIN |
| FR-105 | Failed PIN attempts shall be counted; five consecutive failures shall lock the account for 15 minutes |
| FR-106 | Any character's PIN in a campaign shall be resettable using the campaign recovery code |
| FR-107 | The referee shall be able to regenerate the campaign recovery code; the old code shall be immediately invalidated |
| FR-108 | Session state (campaign, player) shall be persisted to localStorage and restored on page reload |

### 2.2 Imperial Calendar

| ID | Requirement |
|----|------------|
| FR-201 | The system shall maintain one calendar per campaign, expressed in ticks (1 tick = 1 jump-week = 7 days) |
| FR-202 | The in-game date shall be displayed as `DDD-YYYY` (Imperial convention) |
| FR-203 | Only the referee shall be able to advance the tick |
| FR-204 | A monthly OHLC rollup shall fire automatically after every 4th tick |
| FR-205 | An annual OHLC rollup shall fire automatically after every 48th tick |
| FR-206 | The starting tick shall be derived from the campaign's chosen starting year and day |

### 2.3 World and Sector Navigation

| ID | Requirement |
|----|------------|
| FR-301 | The system shall load sector and world data from the Traveller Map API |
| FR-302 | The user shall be able to filter sectors by name and filter worlds within a sector by name or hex |
| FR-303 | The selected world shall be highlighted and its detail shown in the main panel |
| FR-304 | World detail shall include UWP decode, system data, routes, and T5 extensions where available |
| FR-305 | The UWP badge shall link to the corresponding Traveller Map page |
| FR-306 | The map milieu shall be seeded from the campaign's milieu at login |

### 2.4 Market

| ID | Requirement |
|----|------------|
| FR-401 | The market shall show current buy price, sell price, spread, and available quantity for all trade goods at the selected world |
| FR-402 | Prices shall be generated deterministically from `(campaignId, worldHex, goodDie, tick)` using a seeded PRNG |
| FR-403 | Market data shall be generated lazily on first visit to a world at a given tick and stored in Supabase |
| FR-404 | On the first-ever visit to a world, the system shall backfill price history for all prior ticks in the current year |
| FR-405 | Price colours shall indicate deviation from the CT7 base price (green = below base, red = above) |
| FR-406 | Active market events shall be displayed in a banner above the market table; affected rows shall be visually distinguished |
| FR-407 | The user shall be able to select multiple goods for simultaneous price charting via checkboxes |
| FR-408 | Price charts shall support weekly (line), monthly (candlestick), and annual (candlestick) time frames |
| FR-409 | A Buy button shall appear on each market row when the player has a ship and trading authorisation |

### 2.5 Trading — Buy

| ID | Requirement |
|----|------------|
| FR-501 | A player with a ship and `can_trade = true` shall be able to purchase cargo at the current world |
| FR-502 | The buy dialog shall display purchase price, available quantity, free hold space, and current credits |
| FR-503 | The system shall prevent purchase if credits are insufficient or hold space is unavailable |
| FR-504 | A successful purchase shall insert a cargo row, debit the ship's credit account, and insert an immutable transaction record |
| FR-505 | The ship's cargo hold display shall update immediately after purchase |

### 2.6 Trading — Sell

| ID | Requirement |
|----|------------|
| FR-601 | A player with `can_trade = true` shall be able to sell any held cargo item at the current world |
| FR-602 | The sell confirmation shall display the sale price, profit/loss versus purchase price, and require explicit confirmation |
| FR-603 | A successful sale shall delete the cargo row, credit the ship's account, insert a transaction record, and insert a trade record |
| FR-604 | Profit shall be displayed as a flash notification after a successful sale |

### 2.7 Route Analysis

| ID | Requirement |
|----|------------|
| FR-701 | From the Jump tab, the system shall show all worlds within the ship's jump range from the current world |
| FR-702 | Each route row shall show the destination world, UWP, best projected trade good, projected profit, and hex distance |
| FR-703 | Clicking Select on a route row shall commit the ship's location to the destination and switch to the Market tab |

### 2.8 Market Events

| ID | Requirement |
|----|------------|
| FR-801 | The system shall probabilistically generate a market event on a world's first market visit each tick (~6% chance) |
| FR-802 | Events shall be classified as Minor, Major, or Crisis, each with defined effect percentage ranges and durations |
| FR-803 | Events shall affect either one specific trade good or all goods, at local or subsector scope |
| FR-804 | The referee shall be able to manually create events with custom scope, good, effect, and expiry |
| FR-805 | The referee shall be able to expire an active event early |
| FR-806 | Event history shall be displayed on the Events tab; records older than one prior year shall be purged during annual rollup |

### 2.9 Ships and Crew

| ID | Requirement |
|----|------------|
| FR-901 | The referee shall be able to create ships with name, hull type, hull tonnage, cargo capacity, and starting credits |
| FR-902 | The referee shall be able to assign players to ships with a crew role |
| FR-903 | The referee shall be able to set or remove the `can_trade` flag on any crew member |
| FR-904 | Captains shall automatically receive `can_trade` when assigned or promoted |
| FR-905 | A player may only be assigned to one active ship at a time |
| FR-906 | The ship's current world/sector shall update when the player uses the Jump tab Select function |

### 2.10 Player Skills

| ID | Requirement |
|----|------------|
| FR-1001 | The referee shall be able to add, edit, and remove free-form skills for any player character |
| FR-1002 | Skills shall be visible to the referee in the Players tab |

---

## 3. Non-Functional Requirements

| ID | Requirement |
|----|------------|
| NFR-1 | **Performance:** Market snapshot generation for 36 goods shall complete and insert within 2 seconds on a standard broadband connection |
| NFR-2 | **Determinism:** Given the same inputs, all clients shall produce identical prices and event outcomes |
| NFR-3 | **Security:** PINs shall be stored as bcrypt hashes (cost factor 10) using pgcrypto; plaintext PINs shall never be stored or logged |
| NFR-4 | **Security:** The recovery code shall be generated server-side, stored only as a bcrypt hash, and returned in plaintext exactly once |
| NFR-5 | **Security:** All mutations to sensitive tables shall be performed through SECURITY DEFINER RPCs, never directly from client code |
| NFR-6 | **Accessibility:** The application shall provide keyboard shortcuts for all primary navigation actions; focus traps shall be applied to all modal dialogs |
| NFR-7 | **Usability:** The application shall function at viewport widths from 1024px and above |
| NFR-8 | **Reliability:** Loss of network connectivity during a trade operation shall not corrupt the ship's credit balance (atomic RPC design) |
| NFR-9 | **Portability:** The application shall run in current versions of Chrome, Firefox, and Safari without plugins |
| NFR-10 | **Maintainability:** All database schema changes shall be expressed as numbered migration files applied sequentially |

---

## 4. Acceptance Criteria

### AC-1: Campaign lifecycle
- Referee can create a campaign, receive a recovery code, log in, and see the map
- A second user can join the campaign with a different character name and PIN
- Both users see the same tick value and market prices for the same world

### AC-2: PIN recovery
- Entering an incorrect PIN 5 times locks the account for 15 minutes
- The Reset PIN form with the recovery code successfully changes the PIN
- Generating a new recovery code invalidates the old one (old code is rejected)

### AC-3: Market generation
- Opening the Market tab for a world at tick 0 shows 36 goods with non-zero prices
- Advancing the tick changes prices for that world
- Revisiting the same world at the same tick shows identical prices to the first visit

### AC-4: Buy/sell flow
- Buying 10t of a good deducts `purchase_price × 10` from ship credits and adds a cargo row
- Selling that cargo at a destination credits `sale_price × 10` and removes the cargo row
- Both operations appear in the transaction ledger

### AC-5: Events
- On the first market visit for a new world/tick, an event occasionally fires and is visible in the banner
- A manually created subsector event raises prices across all worlds in the sector
- Expiring an event removes it from the banner and stops price modification

### AC-6: Route analysis
- Jump tab shows worlds within jump range sorted by projected profit
- Clicking Select on a row updates the ship location and switches to Market tab with the destination world selected

### AC-7: Date display
- A campaign starting in year 1900 shows `001-1900` at tick 0
- After 48 ticks, the date shows `001-1901`
