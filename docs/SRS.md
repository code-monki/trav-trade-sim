# Software Requirements Specification

**Project:** Traveller Trade Simulator  
**Version:** 0.4.0  
**Status:** Active development

---

## 1. Constraints

| ID | Constraint |
|----|-----------|
| CON-1 | Non-commercial use only; no monetisation |
| CON-2 | Must run in a modern web browser with no installation |
| CON-3 | Backend is Cloudflare Workers (Hono v4) + Cloudflare D1 (SQLite); no Supabase dependency |
| CON-4 | No secret is bundled in the frontend; `VITE_API_URL` is the Worker's public URL; auth uses Bearer session tokens |
| CON-5 | No PII is collected or stored; identity is (campaign code, character name, PIN hash) |
| CON-6 | Traveller IP requires fair use compliance; no copyrighted table data is redistributed verbatim |
| CON-7 | All mutations go through Worker endpoints; compound operations use `db.batch()` for atomicity |

---

## 2. Functional Requirements

### 2.1 Campaign Management

| ID | Requirement |
|----|------------|
| FR-101 | The system shall allow a user to create a new campaign by supplying a label, unique campaign code, milieu, trade rules, starting year/day, referee character name, and PIN |
| FR-102 | Campaign creation shall generate a one-time recovery code, display it to the referee, and store only its PBKDF2 hash |
| FR-103 | The system shall allow additional characters to join an existing campaign using the campaign code, a unique character name, and a new PIN |
| FR-104 | The system shall authenticate a character with campaign code + character name + PIN |
| FR-105 | Failed PIN attempts shall be counted; five consecutive failures shall lock the account for 15 minutes |
| FR-106 | Any character's PIN in a campaign shall be resettable using the campaign recovery code |
| FR-107 | The referee shall be able to regenerate the campaign recovery code; the old code shall be immediately invalidated |
| FR-108 | Session state (campaign, player) shall be persisted to localStorage and restored on page reload |
| FR-109 | The referee shall be able to permanently delete their campaign; deletion shall require PIN confirmation and shall cascade-delete all associated data |
| FR-110 | The referee shall be able to edit the campaign display label at any time; trade rules, milieu, and campaign code shall remain locked after creation |

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
| FR-402 | Prices shall be generated deterministically from `(campaignId, worldHex, goodDie, tick)` using a seeded PRNG, dispatched per-campaign to the CT7, T5, or MgT2022 pricing engine matching the campaign's `trade_rules` |
| FR-403 | Market data shall be generated lazily on first visit to a world at a given tick and stored in Cloudflare D1 |
| FR-404 | On the first-ever visit to a world, the system shall backfill price history for all prior ticks in the current year |
| FR-405 | Price colours shall indicate deviation from the campaign's ruleset base price (CT7's Cost of Goods table, T5's Trade Chart-2, or MgT2022's per-good Base Price) — green = below base, red = above |
| FR-406 | Active market events shall be displayed in a banner above the market table; affected rows shall be visually distinguished |
| FR-407 | The user shall be able to select multiple goods for simultaneous price charting via checkboxes |
| FR-408 | Price charts shall support weekly (line), monthly (candlestick), annual (candlestick), and realized (candlestick/line from trade records) time frames |
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
| FR-802 | Events shall be classified as Minor, Major, or Crisis, each with defined buy/sell modifier percentage ranges and durations |
| FR-803 | Events shall affect either one specific trade good or all goods, at local or subsector scope |
| FR-804 | The referee shall be able to manually create events with custom scope, good, effect, and expiry |
| FR-805 | The referee shall be able to expire an active event early |
| FR-806 | Event history shall be displayed on the Events tab; records older than one prior year shall be purged during annual rollup |
| FR-807 | The referee panel shall provide a pre-built event catalogue (≥15 entries) that pre-fills the event creation form |

### 2.9 Ships and Crew

| ID | Requirement |
|----|------------|
| FR-901 | The referee shall be able to create ships with name, hull type, hull tonnage, cargo capacity, stateroom capacity, low berth capacity, fuel capacity, current fuel level, jump rating, maneuver rating, and starting credits |
| FR-902 | The referee shall be able to assign players to ships with a crew role |
| FR-903 | The referee shall be able to set or remove the `can_trade` flag on any crew member |
| FR-904 | Captains shall automatically receive `can_trade` when assigned or promoted |
| FR-905 | A player may only be assigned to one active ship at a time |
| FR-906 | The ship's current world/sector shall update when the player uses the Jump tab Select function or when the referee moves the ship via the edit form |
| FR-907 | Moving the ship to a new world (via Jump Select or referee edit) shall automatically deliver matching in-transit passengers and mail contracts |

### 2.10 Player Skills

| ID | Requirement |
|----|------------|
| FR-1001 | The referee shall be able to add, edit, and remove free-form skills for any player character |
| FR-1002 | Skills shall be visible to the referee in the Players tab |

### 2.11 Passengers

| ID | Requirement |
|----|------------|
| FR-1101 | A player shall be able to book passengers (High, Middle, or Low passage; MgT2022 campaigns add a fourth tier, Basic passage) at the Port > Passengers tab |
| FR-1102 | The booking form shall validate that stateroom/berth capacity is available before accepting the booking; for MgT2022 Basic passage, general cargo tonnage shall be validated instead (2 tons/passenger), since Basic passage has no dedicated stateroom or berth |
| FR-1103 | Passenger fares shall be collected at embarkation: CT7 flat per jump; T5 and MgT2022 per-parsec for High/Middle (MgT2022 also scales Basic by parsec), flat for Low |
| FR-1104 | A passenger booking shall create an `obligations` record (kind='passenger'), write a `passenger_fare` transaction, and credit the ship account |
| FR-1105 | Passengers shall be automatically delivered when the ship arrives at their destination world |
| FR-1106 | The Ship > Manifest tab shall display stateroom/berth occupancy and all in-transit passengers |
| FR-1107 | The referee shall be able to issue a refund for any in-transit passenger; refund shall create a `passenger_refund` transaction and debit the ship account |

### 2.12 Fuel Purchasing

| ID | Requirement |
|----|------------|
| FR-1201 | The Port > Services tab shall display fuel availability and pricing based on the selected world's starport class |
| FR-1202 | Refined fuel (Cr500/t) shall be available at Class A and B starports; unrefined (Cr100/t) at Class C and D; no commercial fuel at E or X |
| FR-1203 | Fuel purchase shall be capped at the ship's remaining tank capacity (`fuel_capacity − fuel_current`) |
| FR-1204 | A "Fill for jump" shortcut shall compute the fuel required for one jump at the ship's jump rating, capped at available tank space |
| FR-1205 | A successful fuel purchase shall write a `fuel` transaction, debit the ship account, and increment `fuel_current` |
| FR-1206 | The Services tab shall display a visual fill-level indicator showing current/capacity fuel |

### 2.13 Mail Contracts

| ID | Requirement |
|----|------------|
| FR-1301 | A player shall be able to accept a mail contract at the Port > Services tab by specifying a destination and (for T5) parsecs; for MgT2022, acceptance is take-all-or-none for the tick's rolled container count |
| FR-1302 | Mail payment shall be CT7: flat Cr25,000; T5: Cr25,000 × parsecs; MgT2022: Cr25,000 × rolled 5-ton container count, only available when the world's 2D mail-availability roll meets or beats 12 |
| FR-1303 | Mail contracts shall be tracked in `obligations` (kind='mail') as `pending` until the ship arrives at the destination |
| FR-1304 | On delivery, the mail payment shall be credited to the ship account and a `mail` transaction written |
| FR-1305 | Active mail contracts shall be visible in the Ship > Contracts tab |

### 2.14 Ship Templates

| ID | Requirement |
|----|------------|
| FR-1401 | The referee shall be able to create, edit, and delete ship templates scoped to the campaign |
| FR-1402 | Each template shall be tagged with a ruleset (CT7, T5, or MgT2022) matching the campaign's trade rules |
| FR-1403 | The New Ship form shall offer a Template dropdown defaulting to "Custom Design"; selecting a template shall pre-fill hull tons, cargo capacity, stateroom/low berth capacity, fuel capacity, jump/maneuver rating, and market value |
| FR-1404 | The referee shall be able to save an existing ship's current stats as a new named template via a "Save as Template" action |
| FR-1405 | Template names shall be unique per campaign; creating or renaming to a conflicting name shall be rejected |
| FR-1406 | The system shall lazily seed one verified-unverified starter template (Type A Free Trader) the first time a CT7 or MgT2022 campaign's Templates panel is opened with none present; T5 campaigns start with no seed |

### 2.15 Asset Valuation & Net Worth

| ID | Requirement |
|----|------------|
| FR-1501 | Ships shall have a referee-entered `market_value` field, populated via template selection or manual entry |
| FR-1502 | The Cargo Hold view shall display a running total cargo value, valued at the currently viewed world's live sell price where available, falling back to purchase price for unappraised goods |
| FR-1503 | The system shall provide a "Net Worth" report combining ship credits, market value, and cargo value (valued at purchase price for report stability) minus total outstanding debt |
| FR-1504 | Net Worth shall be scaled by the current player's ownership share into a "Your Share" figure, per Ownership Tracking (§2.17) or Organization equity (§2.19) as applicable |

### 2.16 Debt Tracking

| ID | Requirement |
|----|------------|
| FR-1601 | The referee shall be able to create, edit, and delete per-ship debts, each with a type (mortgage, loan, or obligation), principal, current balance, due tick, creditor name, and notes |
| FR-1602 | Debts shall accrue no interest; the current balance shall change only via explicit referee edits or recorded payments |
| FR-1603 | A player with `can_trade` shall be able to pay down a debt from the ship's Reports > Debts tab |
| FR-1604 | A payment shall be rejected if it exceeds either the ship's available credits or the debt's remaining balance |
| FR-1605 | Each payment shall be recorded in a payment history separate from the main transaction ledger |

### 2.17 Ownership Tracking

| ID | Requirement |
|----|------------|
| FR-1701 | The referee shall be able to record one or more players jointly owning a percentage share of a single ship |
| FR-1702 | The system shall reject any recorded share that would push a ship's total ownership percentage over 100% |
| FR-1703 | A player's ownership share, when not explicitly recorded for that ship, shall default to the remainder (100% minus all other recorded shares) rather than a flat 100% |

### 2.18 Organizations

| ID | Requirement |
|----|------------|
| FR-1801 | Any authenticated player shall be able to found an organization by supplying a name, starting treasury, flat dues rate, and notes; the founder shall automatically become its first officer |
| FR-1802 | An organization shall support multiple officers; any officer may manage the organization fully, including adding or removing other officers |
| FR-1803 | Removing an organization's last remaining officer shall be rejected |
| FR-1804 | The referee shall always retain the ability to manage or delete any organization regardless of officer status |
| FR-1805 | Officers or the referee shall be able to add or remove member ships from an organization, marking each membership as organization-owned (`owns_ship`) or independently affiliated |
| FR-1806 | A ship shall be owned outright (`owns_ship`) by at most one organization at a time |

### 2.19 Corporation/Fleet Financials

| ID | Requirement |
|----|------------|
| FR-1901 | An organization's dues shall be expressed as a single flat rate, officer-configurable, defaulting to zero |
| FR-1902 | An organization shall have an officer-configurable dues collection frequency, expressed in ticks, defaulting to 4 (one month) |
| FR-1903 | The system shall indicate when an organization's dues are next due without collecting them automatically |
| FR-1904 | Officers or the referee shall be able to manually trigger dues collection, charging every member ship the flat rate independently |
| FR-1905 | A member ship without sufficient credits at collection time shall be skipped and reported back, without blocking collection from the organization's other member ships |
| FR-1906 | A dues collection attempt made before the configured collection period has elapsed since the last collection shall be rejected |
| FR-1907 | Officers or the referee shall be able to disburse funds ad hoc from an organization's treasury to any member ship, capped at the treasury's current balance |
| FR-1908 | Officers or the referee shall be able to record player equity percentages in an organization, subject to the same 100%-ceiling validation as ship ownership |
| FR-1909 | The system shall provide a consolidated fleet report showing each member ship's financials and fleet-wide totals, visible only to the organization's officers and the referee |
| FR-1910 | For a ship owned outright by an organization, personal Net Worth attribution shall be based on the player's equity percentage in that organization rather than the ship's own ownership records |

### 2.20 MgT2022 Freight & Traffic Availability

| ID | Requirement |
|----|------------|
| FR-2001 | MgT2022 campaigns shall offer a Port > Freight tab for booking bulk cargo lots (Major, Minor, or Incidental), priced per ton per parsec, with smaller lots charged a higher per-ton rate |
| FR-2002 | A freight booking shall create an `obligations` record (kind='freight') carrying the agreed tonnage, lot size, rate, and a due tick, write a `freight_charge` transaction, and credit the ship account upfront |
| FR-2003 | Freight shall be automatically delivered when the ship arrives at its destination world, mirroring passenger/mail auto-delivery |
| FR-2004 | Freight delivered after its due tick shall incur a randomized late-delivery penalty ((1D+4)×10% of the charge), clawed back from the ship's credits at delivery time and recorded as a `freight_penalty` transaction |
| FR-2005 | The referee or player shall be able to cancel a pending freight obligation for a full refund via a "refund freight" action, mirroring passenger refunds |
| FR-2006 | The system shall generate one deterministic, seeded traffic-availability roll per world per tick (population/starport-class driven), covering passenger counts per tier, freight lots per size, and mail container count — automatically, with no referee action required, following the same precedent as goods-quantity availability |
| FR-2007 | Passenger, freight, and mail booking forms shall display and enforce the current tick's rolled availability count for the selected tier/lot size, capping bookings at that count |
| FR-2008 | Traffic-availability data shall be scoped to MgT2022 campaigns only; CT7/T5 campaigns shall remain unlimited-subject-to-ship-capacity, unaffected by this feature |

---

## 3. Non-Functional Requirements

| ID | Requirement |
|----|------------|
| NFR-1 | **Performance:** Market snapshot generation for 36 goods shall complete and insert within 2 seconds on a standard broadband connection |
| NFR-2 | **Determinism:** Given the same inputs, all clients shall produce identical prices and event outcomes |
| NFR-3 | **Security:** PINs shall be stored as PBKDF2-SHA256 hashes (Web Crypto API, salted); plaintext PINs shall never be stored or logged |
| NFR-4 | **Security:** The recovery code shall be generated server-side, stored only as a PBKDF2 hash, and returned in plaintext exactly once |
| NFR-5 | **Security:** All mutations shall be performed through Worker route handlers behind session authentication, never directly from client code |
| NFR-6 | **Accessibility:** The application shall target WCAG 2.2 Level AA conformance. Keyboard shortcuts shall be provided for all primary navigation actions; focus traps shall be applied to all modal dialogs |
| NFR-6a | **Accessibility:** All interactive controls shall be reachable and operable via keyboard alone (no mouse-only interactions), with a visible focus indicator at all times |
| NFR-6b | **Accessibility:** Color shall never be the sole means of conveying status or information (e.g. market price deviation, travel zone warnings, profit/loss) — every color-coded indicator shall be accompanied by a text label, icon, or other non-color cue |
| NFR-6c | **Accessibility:** Text and meaningful UI component contrast ratios shall meet or exceed WCAG 2.2 AA thresholds (4.5:1 for normal text, 3:1 for large text and UI components) |
| NFR-6d | **Accessibility:** Every routed top-level view shall provide a `<main id="main-content">` landmark matching the global skip-link's target, and a logical heading/landmark structure for assistive technology |
| NFR-6e | **Accessibility:** Custom interactive controls without native semantics (e.g. tab bars, steppers, type-selector buttons) shall expose an accessible name and, where applicable, ARIA role/state matching their behavior |
| NFR-7 | **Usability:** The application shall function at viewport widths from 1024px and above |
| NFR-8 | **Reliability:** Loss of network connectivity during a trade operation shall not corrupt the ship's credit balance (atomic `db.batch()` design) |
| NFR-9 | **Portability:** The application shall run in current versions of Chrome, Firefox, and Safari without plugins |
| NFR-10 | **Maintainability:** All database schema changes shall be expressed as numbered migration files applied sequentially |

---

## 4. Acceptance Criteria

### AC-1: Campaign lifecycle
- Referee can create a campaign, receive a recovery code, log in, and see the map
- A second user can join the campaign with a different character name and PIN
- Both users see the same tick value and market prices for the same world
- Referee can edit the campaign label without affecting trade rules or campaign code

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
- Loading a catalogue preset pre-fills the event creation form

### AC-6: Route analysis
- Jump tab shows worlds within jump range sorted by projected profit
- Clicking Select on a row updates the ship location and switches to Market tab with the destination world selected

### AC-7: Campaign deletion
- Entering an incorrect PIN in the Delete Campaign form shows an error and does not delete
- Entering the correct PIN deletes the campaign, clears the session, and redirects to the login screen
- After deletion the campaign code cannot be used to sign in

### AC-8: Date display
- A campaign starting in year 1900 shows `001-1900` at tick 0
- After 48 ticks, the date shows `001-1901`

### AC-9: Passengers
- Booking 2 High passage passengers debits staterooms, creates a manifest row, and credits the ship fare
- Arriving at the destination automatically delivers the passengers
- Referee can refund a passenger; ship credits are debited by the original fare

### AC-10: Fuel
- Services tab shows fuel availability badges based on the world's starport class
- Purchasing fuel debits ship credits, increments fuel_current, and blocks over-fill
- "Fill for jump" sets tons to min(jump fuel needed, remaining tank space)

### AC-11: Mail
- Accepting a mail contract creates a contract record (status=in_transit) with no upfront payment
- Arriving at the destination delivers the mail and credits the ship
- Contracts tab lists all in-transit contracts with pending payment total

### AC-12: Ship Templates
- Selecting a template in the New Ship form pre-fills hull tons, cargo capacity, and market value
- Switching back to Custom Design clears the form to blank defaults
- Saving an existing ship as a template with a duplicate name is rejected

### AC-13: Asset Valuation & Net Worth
- Net Worth tab shows credits + market value + cargo value (at cost) minus total debt
- A 40%-partner ship shows the ship's own captain with a 60% "Your Share", not 100%

### AC-14: Debt Tracking
- Referee creates a debt; it appears in the player's Reports > Debts tab
- Player makes a partial payment; the balance decreases and the payment cannot exceed either the ship's credits or the remaining balance

### AC-15: Ownership Tracking
- Referee records a 40% partner share on a ship; the recorded total cannot exceed 100%
- The ship's own captain, with no explicit share recorded, is shown owning the 60% remainder

### AC-16: Organizations
- A player founds an organization and is automatically its first officer
- A second, non-officer player is rejected from editing the organization or its membership
- Removing an organization's last officer is rejected; the referee can still delete the organization outright

### AC-17: Corporation/Fleet Financials
- Collecting dues charges every member ship the flat rate; a ship with insufficient credits is skipped and reported, not blocking the others
- Collecting dues again before the configured period has elapsed is rejected
- Marking a ship as owned outright by a second organization, when it is already owned by another, is rejected
- A ship owned outright by an organization shows its Net Worth "Your Share" based on the player's organization equity, not ship ownership

### AC-18: Accessibility
- The skip-link on every routed view ("Skip to main content") moves keyboard focus to that view's `<main id="main-content">` landmark
- Every primary interactive control (buttons, form fields, tab bars, steppers) can be reached and operated using only the keyboard, in a logical tab order, with a visible focus indicator
- No status or data point (price deviation color, travel zone color, profit/loss color) is conveyed by color alone — each has an accompanying text or icon cue
- Automated accessibility audit (Lighthouse or equivalent) reports no critical/serious violations on the Login, Map, and Referee views
