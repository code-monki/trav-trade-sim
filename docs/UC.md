# Use Cases

**Project:** Traveller Trade Simulator  
**Version:** 0.11.0  
**Status:** Active development

This document enumerates the system's use cases, grouped under the same functional categories as `SRS.md` (§2.x) so each use case's "Related Requirements" can be cross-checked against a concrete FR-ID list. IDs are sequential (`UC-1`, `UC-2`, ...) rather than mirrored to FR numbering, since a single use case commonly satisfies several FR-IDs together.

---

## Actors

- **Referee** — One per campaign. Creates the campaign, manages ships/crew/templates/debts/events, and advances the in-game clock. Always retains override rights over every organization regardless of officer status.
- **Player** — One or more per campaign. Each controls a character, typically assigned to a ship. May additionally act as an **organization officer** for any organization they founded or were added to — this is a capability a Player can hold, not a separate top-level actor.

System-triggered behavior (e.g. automatic passenger delivery on ship arrival) is expressed as the **Trigger** field of the relevant use case, not as a third actor.

---

## 2.1 Campaign Management

### UC-1: Create a New Campaign

**Actor:** Referee
**Related Requirements:** FR-101, FR-102, FR-108, FR-111, FR-112
**Trigger:** A prospective referee opens the Login view and selects "Create Campaign"

**Preconditions:**
- No existing session

**Main Flow:**
1. Referee opens the Create Campaign form; the campaign name, campaign code, and referee character name arrive pre-filled with generated Traveller-flavored defaults (milieu, trade rules, and starting date keep their static defaults; the PIN is left blank)
2. Referee supplies or edits a label, campaign code, milieu, trade rules, starting year/day, referee character name, and PIN
3. System validates the campaign code is unique
4. System creates the campaign and the referee's player record
5. System generates a one-time recovery code and displays it to the referee
6. Referee acknowledges having saved the recovery code
7. System persists session state to localStorage and navigates to the map view

**Alternate / Exception Flows:**
- **A1 — Campaign code already in use:** System rejects the form with an error; no campaign is created
- **A2 — Randomize:** At any point before submitting, the referee presses 🎲 Randomize; the system re-rolls the name, code, milieu, trade rules, referee name, and a starting date consistent with the chosen milieu's canonical era. The PIN is never touched by this action

**Postconditions:**
- Campaign and referee player record exist
- Recovery code stored only as a hash; plaintext shown exactly once
- Session persisted to localStorage

### UC-2: Join an Existing Campaign

**Actor:** Player
**Related Requirements:** FR-103, FR-108
**Trigger:** A prospective player opens the Login view and selects "Join Campaign"

**Preconditions:**
- The target campaign already exists

**Main Flow:**
1. Player enters the campaign code
2. Player supplies a unique character name and a new PIN
3. System validates the campaign code exists and the character name is unique within it
4. System creates the player record
5. System persists session state and navigates to the map view

**Alternate / Exception Flows:**
- **A1 — Unknown campaign code:** Rejected with an error
- **A2 — Duplicate character name:** Rejected with an error

**Postconditions:**
- New player record exists in the campaign
- Session persisted to localStorage

### UC-3: Authenticate / Log In

**Actor:** Referee, Player
**Related Requirements:** FR-104, FR-105, FR-108
**Trigger:** A returning user opens the Login view

**Preconditions:**
- A player record already exists for the supplied campaign code + character name

**Main Flow:**
1. User supplies campaign code, character name, and PIN
2. System verifies the credentials
3. System issues a session token and persists it to localStorage
4. System navigates to the map view

**Alternate / Exception Flows:**
- **A1 — Incorrect PIN:** Attempt is counted; error shown
- **E1 — Five consecutive failed attempts:** Account is locked for 15 minutes; further attempts are rejected until the lockout expires

**Postconditions:**
- Valid session established, or lockout in effect

### UC-4: Recover a Forgotten PIN

**Actor:** Referee, Player
**Related Requirements:** FR-106, FR-107
**Trigger:** User selects "Reset PIN" on the Login view

**Preconditions:**
- User has the campaign's current recovery code

**Main Flow:**
1. User enters campaign code, character name, recovery code, and a new PIN
2. System verifies the recovery code hash matches
3. System updates the character's PIN and clears any active lockout

**Alternate / Exception Flows:**
- **A1 — Referee regenerates the recovery code instead:** The old code is immediately invalidated
- **E1 — Incorrect recovery code:** Rejected with an error; PIN unchanged

**Postconditions:**
- Character's PIN updated; old recovery code (if regenerated) invalidated

### UC-5: Delete a Campaign

**Actor:** Referee
**Related Requirements:** FR-109
**Trigger:** Referee opens Campaign Management > Campaign tab > Danger Zone

**Preconditions:**
- User is authenticated as the campaign's referee

**Main Flow:**
1. Referee opens the Delete Campaign form and enters their PIN
2. System verifies the PIN
3. System cascade-deletes the campaign and all associated data
4. System clears the local session and redirects to the Login view

**Alternate / Exception Flows:**
- **E1 — Incorrect PIN:** Rejected with an error; no deletion occurs

**Postconditions:**
- Campaign and all related records permanently removed
- Campaign code can no longer be used to sign in

---

## 2.2 Imperial Calendar

### UC-6: Advance the Campaign Tick

**Actor:** Referee
**Related Requirements:** FR-203, FR-204, FR-205, FR-206
**Trigger:** Referee clicks "Advance Tick" in the header toolbar

**Preconditions:**
- User is authenticated as referee

**Main Flow:**
1. Referee clicks Advance Tick
2. System increments the campaign's current tick and recomputes year/day/month
3. System updates the displayed Imperial date for all connected clients
4. If the new tick completes a 4-tick month boundary, system performs a monthly OHLC rollup
5. If the new tick completes a 48-tick year boundary, system performs an annual OHLC rollup and purges event history older than one prior year

**Alternate / Exception Flows:**
- None

**Postconditions:**
- `campaign_calendar.current_tick` incremented; monthly/annual rollups applied where due

---

## 2.3 World and Sector Navigation

### UC-7: Browse Sectors and Worlds

**Actor:** Referee, Player
**Related Requirements:** FR-301, FR-302, FR-303, FR-304, FR-305, FR-306
**Trigger:** User opens the map view

**Preconditions:**
- Authenticated session

**Main Flow:**
1. System loads sector/world data from the Traveller Map API for the campaign's milieu
2. User filters sectors and worlds by name or hex
3. User selects a world from the list
4. System highlights the world and displays its detail (UWP decode, system data, routes, T5 extensions where available)
5. User follows the UWP badge link to view the world on Traveller Map

**Alternate / Exception Flows:**
- None

**Postconditions:**
- Selected world persists as the active browsing context; no server-side state changes

---

## 2.4 Market

### UC-8: View Market Prices for a World

**Actor:** Referee, Player
**Related Requirements:** FR-401, FR-402, FR-403, FR-404, FR-405, FR-406, FR-407, FR-408, FR-409, FR-410, FR-411, FR-412
**Trigger:** User opens the Port > Market tab for a selected world

**Preconditions:**
- A world is selected
- For MgT2022 campaigns: the player has succeeded a "Find a Supplier" check at this world this game-month (see A4)

**Main Flow:**
1. System checks whether a market snapshot exists for this world at the current tick
2. If none exists, system generates prices deterministically and, on a world's first-ever visit, backfills price history for the current year. For MgT2022, the goods composing this snapshot are a randomized-per-world/tick subset (all Common Goods, Trade Goods matching the world's trade codes, plus population-code-count random extras) rather than the full goods table
3. System displays buy/sell price, spread, and quantity for the goods on offer (all 36 `CT2_TRADE_GOODS` for CT7/T5; the MgT2022 composition above for MgT2022), colour-coded against the campaign ruleset's base price (CT7's/T5's shared constant, or MgT2022's own per-good base price). For CT7 (sale price only) and MgT2022 (both prices), the displayed numbers already reflect this specific player's own Broker skill — another player viewing the same world/tick with a different skill level would see different numbers
4. Active market events are shown in a banner; affected goods are visually distinguished
5. User selects one or more goods to chart; system renders weekly/monthly/annual/realized price history

**Alternate / Exception Flows:**
- **A4 — MgT2022, supplier not yet found this month:** System shows a "Find a Supplier" prompt instead of the market table. Player clicks "Find a Supplier"; system rolls 2D6 + the player's Broker/Streetwise/Admin skill + a starport DM, minus DM-1 per prior attempt this world/month, against an Average (8+) target. On success, the market table becomes visible for the rest of the game-month; on failure, the prompt persists and the attempt count increments

**Postconditions:**
- A `market_snapshots` row exists for (world, tick); no player state changes
- For MgT2022, a successful Find-a-Supplier attempt persists in `supplier_search_attempts` for the rest of the game-month

---

## 2.5 Trading — Buy

### UC-9: Buy Cargo

**Actor:** Player
**Related Requirements:** FR-501, FR-502, FR-503, FR-504, FR-505, FR-506
**Trigger:** Player opens the Market tab for the current world and initiates a purchase

**Preconditions:**
- Player's character has `can_trade` on their assigned ship
- A world is selected with generated market prices for the current tick

**Main Flow:**
1. Player selects a trade good row on the Market tab and opens the Buy dialog
2. System displays current price/ton, an editable quantity, remaining cargo hold space, and ship credits
3. Player enters a quantity and confirms
4. System validates the quantity against available cargo capacity and ship credits
5. System debits `purchase_price × quantity` from ship credits, creates a cargo record, and writes a `buy` transaction
6. System updates the Cargo Hold view and remaining credits display

**Alternate / Exception Flows:**
- **A1 — Insufficient credits:** System rejects the purchase and displays an error; no state changes occur
- **A2 — Insufficient cargo capacity:** System rejects the purchase and displays an error; no state changes occur
- **A3 — Player lacks `can_trade`:** Buy dialog is not available to the player
- **A4 — Stock depleted by a concurrent buyer:** The stock decrement and availability check run as a single atomic operation; if another purchase already consumed the needed quantity between this player loading the market and confirming the buy, the system rejects the purchase with an error rather than allowing `qty_available` to go negative

**Postconditions:**
- Ship credits reduced by the purchase total
- A new cargo row exists at the purchased quantity and price
- A `buy` transaction is recorded in the ledger

---

## 2.6 Trading — Sell

### UC-10: Sell Cargo

**Actor:** Player
**Related Requirements:** FR-601, FR-602, FR-603, FR-604, FR-605, FR-606
**Trigger:** Player selects a held cargo item at the current world and opens Sell

**Preconditions:**
- Player's character has `can_trade`
- Player holds the cargo item being sold
- CT7 only: the cargo lot's purchase-world data has resolved (briefly unavailable — shown as "—", sell disabled — right after the lot appears in the hold at a newly-viewed market)

**Main Flow:**
1. Player selects a cargo row and opens the Sell confirmation
2. System displays the sale price — for CT7, computed from BOTH this specific lot's purchase-world trade codes/Tech Level and the current market's (Book 7's real mechanic; two lots of the same good bought at different worlds sell for different prices at the same market), further reflecting this player's own Broker skill; for MgT2022, reflecting this player's own Broker skill against a single-world price roll — and profit/loss versus purchase price
3. Player confirms the sale
4. System deletes the cargo row, credits the ship account (for CT7, plus any Broker self-service gain — see A2), writes a `sell` transaction, and inserts a trade record
5. System displays a profit flash notification (inclusive of any Broker self-service gain)

**Alternate / Exception Flows:**
- **A1 — Player lacks `can_trade`:** Sell action is not available
- **A2 — CT7 campaign, player has a Broker skill:** The player nets half the standard brokerage fee (5% × skill × sale value, capped at skill 4) as pure profit, added to proceeds and recorded as a separate income transaction, distinct from the per-ton sale price itself — this app has no NPC-hiring flow, so only the self-service case ever applies
- **A3 — CT7 campaign, cargo lot's purchase world hasn't resolved yet:** Sale price shown as unavailable; Sell action disabled until it resolves (typically immediate)

**Postconditions:**
- Cargo row removed
- Ship credits increased by the sale price, plus any CT7 Broker self-service gain
- A `sell` transaction (and, for CT7 with a Broker gain, a `broker_commission` transaction) and a trade record are recorded

---

## 2.7 Route Analysis

### UC-11: Analyze Jump Routes and Commit a Jump

**Actor:** Player
**Related Requirements:** FR-701, FR-702, FR-703, FR-906, FR-907, FR-1105, FR-1304
**Trigger:** Player opens the Jump tab

**Preconditions:**
- Ship has a current world and a jump rating

**Main Flow:**
1. System lists all worlds within the ship's jump range from its current world
2. Each row shows destination, UWP, best projected trade good, projected profit, and hex distance
3. Player clicks Select on a destination row
4. System commits the ship's location to the destination and switches to the Market tab
5. System automatically delivers any in-transit passengers or mail contracts whose destination matches

**Alternate / Exception Flows:**
- None

**Postconditions:**
- `ships.current_world`/`current_sector` updated
- Matching in-transit passengers/mail obligations resolved (fulfilled) and their payments credited

---

## 2.8 Market Events

### UC-12: Create a Market Event

**Actor:** Referee
**Related Requirements:** FR-801, FR-802, FR-803, FR-804, FR-807
**Trigger:** Referee opens Campaign Management > Events tab

**Preconditions:**
- User is authenticated as referee

**Main Flow:**
1. Referee optionally selects a catalogue preset, pre-filling scope/good/effect/duration
2. Referee sets or adjusts scope (local/subsector), affected good (or all goods), modifier percentages, and duration
3. System creates the event and applies its price modifiers immediately

**Alternate / Exception Flows:**
- None

**Postconditions:**
- A `market_events` row is created; affected prices are modified for its duration

### UC-13: Expire a Market Event Early

**Actor:** Referee
**Related Requirements:** FR-805, FR-806
**Trigger:** Referee selects an active event on the Events tab

**Preconditions:**
- An active event exists

**Main Flow:**
1. Referee selects "Expire Now" on an active event
2. System marks the event expired immediately
3. System removes it from the active banner and stops its price modification

**Alternate / Exception Flows:**
- None

**Postconditions:**
- The event's expiry is set to the current tick or earlier

---

## 2.9 Ships and Crew

### UC-14: Create a Ship

**Actor:** Referee
**Related Requirements:** FR-901
**Trigger:** Referee opens Campaign Management > Ships > New Ship, with Template set to "Custom Design"

**Preconditions:**
- User is authenticated as referee

**Main Flow:**
1. Referee opens the New Ship form
2. Referee supplies name, hull type, hull tonnage, cargo capacity, stateroom capacity, low berth capacity, fuel capacity, current fuel level, jump rating, maneuver rating, and starting credits
3. System creates the ship

**Alternate / Exception Flows:**
- None

**Postconditions:**
- A new ship row exists in the campaign

### UC-15: Assign Crew to a Ship

**Actor:** Referee
**Related Requirements:** FR-902, FR-903, FR-904, FR-905
**Trigger:** Referee opens a ship's detail view

**Preconditions:**
- Ship and player both exist in the campaign

**Main Flow:**
1. Referee selects a player and a crew role for the ship
2. System assigns the player to the ship, ending any prior active assignment for that player
3. If the role is Captain, system automatically grants `can_trade`
4. Referee may separately set or remove `can_trade` for any crew member

**Alternate / Exception Flows:**
- None

**Postconditions:**
- A crew record is created (`left_tick` null); any prior assignment for that player is ended

---

## 2.10 Player Skills

### UC-16: Manage Player Skills

**Actor:** Referee
**Related Requirements:** FR-1001, FR-1002
**Trigger:** Referee opens Campaign Management > Players tab and selects a character

**Preconditions:**
- User is authenticated as referee

**Main Flow:**
1. Referee adds a free-form skill name and level for the character
2. System records the skill
3. Referee may edit or remove any recorded skill

**Alternate / Exception Flows:**
- None

**Postconditions:**
- `player_skills` reflects the change

---

## 2.11 Passengers

### UC-17: Book Passengers

**Actor:** Player
**Related Requirements:** FR-1101, FR-1102, FR-1103, FR-1104, FR-1106, FR-1108
**Trigger:** Player opens Port > Passengers tab

**Preconditions:**
- Player's character has `can_trade`
- Sufficient stateroom/berth capacity is available for the requested passage type
- For MgT2022: sufficient traffic availability for the requested tier this tick (UC-38)

**Main Flow:**
1. Player selects passage type (High, Middle, or Low), passenger count, and a destination
2. System validates capacity is available (client-side)
3. System collects fare at embarkation (CT7: flat per jump; T5: per-parsec for High/Middle, flat for Low; MgT2022: per-parsec for all four tiers — High/Middle/Basic/Low — with Basic consuming cargo tonnage instead of a berth)
4. System independently re-validates stateroom/low-berth/cargo capacity and (MgT2022) the traffic-availability cap server-side before committing (FR-1108)
5. System creates an obligation record (kind = passenger), writes a `passenger_fare` transaction, and credits the ship account
6. System updates the Ship > Aboard tab occupancy display

**Alternate / Exception Flows:**
- **A1 — Insufficient stateroom/berth/cargo capacity, or traffic availability exceeded (MgT2022):** Booking rejected, server-side as well as client-side

**Postconditions:**
- An obligation (kind = passenger) exists as pending
- Ship credits increased by the fare total

### UC-18: Refund a Passenger

**Actor:** Referee
**Related Requirements:** FR-1107
**Trigger:** Referee selects an in-transit passenger booking

**Preconditions:**
- An in-transit passenger obligation exists

**Main Flow:**
1. Referee selects "Refund" on the booking
2. System debits the ship account by the original fare, writes a `passenger_refund` transaction, and marks the obligation cancelled

**Alternate / Exception Flows:**
- None

**Postconditions:**
- Obligation status = cancelled
- Ship credits decreased by the refunded fare

---

## 2.12 Fuel Purchasing

### UC-19: Purchase Fuel

**Actor:** Player
**Related Requirements:** FR-1201, FR-1202, FR-1203, FR-1204, FR-1205, FR-1206
**Trigger:** Player opens Port > Services tab

**Preconditions:**
- Player's character has `can_trade`
- A world is selected

**Main Flow:**
1. System displays fuel availability/pricing based on the world's starport class
2. Player enters tons to purchase, or clicks "Fill for jump" to auto-compute the tons needed for one jump
3. System caps the requested amount at the ship's remaining tank capacity
4. System debits ship credits, writes a `fuel` transaction, and increments `fuel_current`
5. System updates the fill-level indicator

**Alternate / Exception Flows:**
- **A1 — No commercial fuel available (Class E/X starport):** Purchase unavailable

**Postconditions:**
- `ships.fuel_current` increased
- A `fuel` transaction is recorded

---

## 2.13 Mail Contracts

### UC-20: Accept and Deliver a Mail Contract

**Actor:** Player (accepts); delivery is system-triggered on arrival
**Related Requirements:** FR-1301, FR-1302, FR-1303, FR-1304, FR-1305, FR-907
**Trigger:** Player opens Port > Mail tab and accepts a mail contract

**Preconditions:**
- Player's character has `can_trade`

**Main Flow:**
1. Player specifies a destination (and parsecs, for T5) and accepts the contract; for MgT2022, acceptance is take-all-or-none against the tick's rolled container count
2. System creates an obligation (kind = mail) with status `in_transit`, recording the container count (MgT2022); no upfront payment
3. When the ship arrives at the destination (Jump Select or referee move), system delivers the mail automatically
4. System credits the ship account (CT7: flat Cr25,000; T5: Cr25,000 × parsecs; MgT2022: Cr25,000 × rolled container count) and writes a `mail` transaction
5. Ship > Contracts tab reflects delivery; accepted containers' cargo-tonnage reservation (5t/container) is released now that the obligation is fulfilled

**Alternate / Exception Flows:**
- **A1 — MgT2022, insufficient cargo space for the tick's rolled container count:** Acceptance rejected — mail containers reserve cargo tonnage the same way Basic Passage does, and can't be accepted partially

**Postconditions:**
- Obligation resolved (fulfilled)
- Ship credits increased by the mail payment

---

## 2.14 Ship Templates

### UC-21: Manage Ship Templates

**Actor:** Referee
**Related Requirements:** FR-1401, FR-1402, FR-1405, FR-1406
**Trigger:** Referee opens Campaign Management > Ships > Templates

**Preconditions:**
- User is authenticated as referee

**Main Flow:**
1. If no templates exist yet for a CT7 or MgT2022 campaign, system lazily seeds one starter (Type A Free Trader)
2. Referee creates a new template with a name, ruleset, and stat values, or edits/deletes an existing one
3. System enforces name uniqueness per campaign

**Alternate / Exception Flows:**
- **A1 — Duplicate name:** Rejected with an error

**Postconditions:**
- `ship_templates` reflects the change

### UC-22: Create a Ship from a Template

**Actor:** Referee
**Related Requirements:** FR-1403
**Trigger:** Referee selects a template in the New Ship form's Template dropdown
**Extends:** UC-14 Create a Ship

**Preconditions:**
- At least one template exists for the campaign's ruleset

**Main Flow:**
1. Referee selects a template from the dropdown
2. System pre-fills hull tons, cargo capacity, stateroom/low berth capacity, fuel capacity, jump/maneuver rating, and market value from the template
3. Referee adjusts any field, supplies a name and starting credits, and confirms
4. System creates the ship; no persistent link back to the template is kept

**Alternate / Exception Flows:**
- **A1 — Referee switches back to "Custom Design":** Form clears to blank defaults

**Postconditions:**
- A new ship row exists, pre-filled from the template at creation time only

### UC-23: Save an Existing Ship as a Template

**Actor:** Referee
**Related Requirements:** FR-1404, FR-1405
**Trigger:** Referee opens an existing ship's detail view and selects "Save as Template"

**Preconditions:**
- User is authenticated as referee; the ship exists

**Main Flow:**
1. Referee selects "Save as Template" on a ship's detail view
2. Referee supplies a template name
3. System captures the ship's current stats as a new named template

**Alternate / Exception Flows:**
- **A1 — Name already in use:** Rejected with an error

**Postconditions:**
- A new `ship_templates` row is created from the ship's current stats

---

## 2.15 Asset Valuation & Net Worth

### UC-24: View Ship Net Worth

**Actor:** Player, Referee
**Related Requirements:** FR-1501, FR-1502, FR-1503, FR-1504, FR-1910
**Trigger:** Player opens Ship > Reports > Net Worth tab

**Preconditions:**
- A ship is assigned to the player

**Main Flow:**
1. System sums ship credits, market value, and cargo value (at purchase price)
2. System subtracts total outstanding debt
3. System determines the player's ownership share — from `ship_ownership`, or from the owning organization's equity (`organization_ownership`) if the ship is owned outright by an organization — and computes "Your Share"
4. System displays assets, liabilities, net worth, and your share

**Alternate / Exception Flows:**
- None

**Postconditions:**
- Read-only; no state changes

---

## 2.16 Debt Tracking

### UC-25: Record a Ship Debt

**Actor:** Referee
**Related Requirements:** FR-1601, FR-1602
**Trigger:** Referee opens Campaign Management > Ships > Debts

**Preconditions:**
- User is authenticated as referee

**Main Flow:**
1. Referee creates a debt with type (mortgage, loan, or obligation), principal, current balance, due tick, creditor name, and notes
2. Referee may edit the balance or details directly at any time (no automatic interest accrues)

**Alternate / Exception Flows:**
- None

**Postconditions:**
- A `ship_debts` row is created or updated

### UC-26: Pay Down a Ship Debt

**Actor:** Player
**Related Requirements:** FR-1603, FR-1604, FR-1605
**Trigger:** Player opens Ship > Reports > Debts tab

**Preconditions:**
- Player's character has `can_trade`
- An outstanding debt exists on the ship

**Main Flow:**
1. Player enters a payment amount against a debt
2. System validates the amount against both ship credits and the remaining balance
3. System decrements ship credits and the debt's current balance, and records the payment

**Alternate / Exception Flows:**
- **A1 — Amount exceeds ship credits:** Rejected
- **A2 — Amount exceeds remaining balance:** Rejected

**Postconditions:**
- Debt balance reduced
- A `debt_payments` row is recorded

---

## 2.17 Ownership Tracking

### UC-27: Record Ship Ownership Shares

**Actor:** Referee
**Related Requirements:** FR-1701, FR-1702, FR-1703
**Trigger:** Referee opens a ship's detail view > Ownership section

**Preconditions:**
- User is authenticated as referee

**Main Flow:**
1. Referee records a player and a percentage share for the ship
2. System validates the new total does not exceed 100%
3. Any player without an explicit share is treated as owning the remainder for Net Worth purposes

**Alternate / Exception Flows:**
- **A1 — Total would exceed 100%:** Rejected

**Postconditions:**
- `ship_ownership` reflects the recorded shares

---

## 2.18 Organizations

### UC-28: Found an Organization

**Actor:** Player
**Related Requirements:** FR-1801
**Trigger:** Player opens Ship > Organizations tab and selects "Found Organization"

**Preconditions:**
- Authenticated player

**Main Flow:**
1. Player supplies a name, starting treasury, flat dues rate, and notes
2. System creates the organization and adds the founder as its first officer

**Alternate / Exception Flows:**
- None

**Postconditions:**
- An `organizations` row and an `organization_officers` row (the founder) are created

### UC-29: Manage Organization Officers

**Actor:** Player (officer), Referee
**Related Requirements:** FR-1802, FR-1803, FR-1804
**Trigger:** An officer or the referee opens an organization's detail view

**Preconditions:**
- User is an officer of the organization, or the referee

**Main Flow:**
1. User adds another player as an officer, or removes an existing officer
2. System applies the change

**Alternate / Exception Flows:**
- **A1 — Removing the organization's last officer:** Rejected
- **A2 — Non-officer, non-referee attempts to manage:** Rejected

**Postconditions:**
- `organization_officers` reflects the change

### UC-30: Add or Remove a Member Ship

**Actor:** Player (officer), Referee
**Related Requirements:** FR-1805, FR-1806
**Trigger:** An officer or the referee opens an organization's detail view

**Preconditions:**
- User is an officer of the organization, or the referee

**Main Flow:**
1. User adds a ship as a member, choosing whether the organization owns it outright (`owns_ship`) or it stays independently affiliated
2. User may later toggle a membership's `owns_ship` flag, or remove the membership

**Alternate / Exception Flows:**
- **A1 — Marking a ship `owns_ship` when it is already owned outright by another organization:** Rejected

**Postconditions:**
- `organization_members` reflects the change

---

## 2.19 Corporation/Fleet Financials

### UC-31: Configure and Collect Organization Dues

**Actor:** Player (officer), Referee
**Related Requirements:** FR-1901, FR-1902, FR-1903, FR-1904, FR-1905, FR-1906
**Trigger:** An officer or the referee opens an organization's detail view

**Preconditions:**
- User is an officer of the organization, or the referee

**Main Flow:**
1. User sets the organization's flat dues rate and collection frequency (in ticks)
2. System indicates whether dues are currently due, based on the last collection tick and frequency
3. User clicks "Collect Dues"
4. System charges every member ship the flat rate independently, crediting the organization's treasury for each successful charge
5. System records the new last-collection tick

**Alternate / Exception Flows:**
- **A1 — A member ship lacks sufficient credits:** That ship is skipped and reported back; other ships still pay
- **E1 — Collection attempted before the configured period has elapsed since the last collection:** Rejected

**Postconditions:**
- Organization treasury increased by the total collected
- A `dues_payments` row is recorded for each ship charged
- `last_dues_tick` updated

### UC-32: Disburse Organization Funds

**Actor:** Player (officer), Referee
**Related Requirements:** FR-1907
**Trigger:** An officer or the referee opens an organization's detail view

**Preconditions:**
- User is an officer of the organization, or the referee
- The organization has treasury funds

**Main Flow:**
1. User selects a member ship, an amount, and an optional note
2. System validates the amount does not exceed the treasury balance
3. System debits the organization's treasury and credits the ship, recording the disbursement

**Alternate / Exception Flows:**
- **A1 — Amount exceeds treasury balance:** Rejected

**Postconditions:**
- Organization treasury decreased; ship credits increased
- A `disbursements` row is recorded

### UC-33: Record Organization Equity

**Actor:** Player (officer), Referee
**Related Requirements:** FR-1908
**Trigger:** An officer or the referee opens an organization's detail view > Equity section

**Preconditions:**
- User is an officer of the organization, or the referee

**Main Flow:**
1. User records a player and a percentage equity stake in the organization
2. System validates the new total does not exceed 100%

**Alternate / Exception Flows:**
- **A1 — Total would exceed 100%:** Rejected

**Postconditions:**
- `organization_ownership` reflects the recorded stakes

### UC-34: View the Consolidated Fleet Report

**Actor:** Player (officer), Referee
**Related Requirements:** FR-1909, FR-1910
**Trigger:** An officer or the referee opens an organization's Fleet Report

**Preconditions:**
- User is an officer of the organization, or the referee

**Main Flow:**
1. System aggregates each member ship's credits, market value, cargo value, and debt
2. System computes fleet-wide totals and an income/expense breakdown
3. System displays the per-ship breakdown and fleet totals

**Alternate / Exception Flows:**
- **A1 — Non-officer, non-referee attempts to view:** Not available

**Postconditions:**
- Read-only; no state changes

## 2.20 MgT2022 Freight & Traffic Availability

### UC-35: Book a Basic Passage Passenger (MgT2022)

**Actor:** Player
**Related Requirements:** FR-1101, FR-1102, FR-1103, FR-2007
**Trigger:** Player opens Port > Passengers on an MgT2022 campaign and selects the Basic tier

**Preconditions:**
- Player's character has `can_trade`
- Campaign's `trade_rules` is `MgT2022`

**Main Flow:**
1. Player selects Basic passage, a passenger count, and a destination
2. System validates general cargo tonnage is available (2 tons/passenger) and caps the count against the tick's rolled Basic-passage traffic availability
3. System collects the per-parsec fare upfront, creates an obligation (kind = passenger, passage_type = basic), and credits the ship account
4. Ship's `cargoAvailable` decreases by the reserved tonnage until the passenger is delivered or refunded

**Alternate / Exception Flows:**
- **A1 — Insufficient cargo space:** Booking rejected with the shortfall shown
- **A2 — No Basic passengers available this tick:** Booking rejected

**Postconditions:**
- Obligation created (pending); ship credits and cargo availability updated

### UC-36: Book Freight (MgT2022)

**Actor:** Player
**Related Requirements:** FR-2001, FR-2002, FR-2007
**Trigger:** Player opens Port > Freight (visible only for MgT2022 campaigns) and books a lot

**Preconditions:**
- Player's character has `can_trade`
- Campaign's `trade_rules` is `MgT2022`

**Main Flow:**
1. Player selects a lot size (Major, Minor, or Incidental) and a destination; the lot's tonnage is a fixed, seeded roll (Major 1D×10, Minor 1D×5, Incidental 1D) — not a value the player chooses, since a lot can't be split or resized
2. System validates cargo space and caps the lot count against the tick's rolled freight-lot traffic availability for this ship
3. System creates an obligation (kind = freight) recording the tonnage, lot size, rate, and a due tick, charges the agreed amount upfront, and credits the ship account. Rate/ton depends only on parsecs travelled, not on the chosen lot size — lot size affects availability (via traffic rolls) and typical tonnage, not price
4. Ship > Aboard > Freight in Transit reflects the new lot

**Alternate / Exception Flows:**
- **A1 — Insufficient cargo space:** Booking rejected
- **A2 — No lots of the selected size available this tick:** Booking rejected

**Postconditions:**
- Freight obligation created (pending); ship credits and cargo availability updated

### UC-37: Deliver Freight, Including Late Penalty (MgT2022)

**Actor:** System (triggered by ship arrival)
**Related Requirements:** FR-2003, FR-2004
**Trigger:** Ship arrives at a freight lot's destination world

**Preconditions:**
- A pending freight obligation exists for this ship with a matching destination

**Main Flow:**
1. System marks the obligation fulfilled
2. If the current tick is at or before the obligation's due tick, no further credit adjustment occurs (already paid upfront)
3. If the current tick is after the due tick, system rolls a late-delivery penalty ((1D+4)×10% of the charge), deducts it from the ship's credits, and records a `freight_penalty` transaction

**Alternate / Exception Flows:**
- None

**Postconditions:**
- Obligation resolved (fulfilled); ship credits reduced by any late penalty

### UC-38: View Traffic Availability (MgT2022)

**Actor:** Player, Referee
**Related Requirements:** FR-2006, FR-2007, FR-2008, FR-2009, FR-2010, FR-2011
**Trigger:** Player opens the Passengers, Mail, or Freight tab on an MgT2022 campaign and picks a destination world

**Preconditions:**
- Campaign's `trade_rules` is `MgT2022`
- Player has an assigned ship (the roll depends on that ship's own crew)

**Main Flow:**
1. Passage type/count, lot size, and mail's container count all stay hidden until the player picks a destination world — there is no ambient "how many passengers are waiting" number independent of where they're going
2. Once a destination is picked (and its full world data resolved), system deterministically rolls (or retrieves, if already rolled this tick) the current tick's passenger/freight/mail traffic-availability counts for the selected **route** (origin world → destination world) and the player's own ship — the roll incorporates population/starport DMs from *both* worlds, a distance penalty for each parsec past the first, that ship's current crew's highest Steward skill (Passengers, ambient) and an automatic Broker/Carouse/Streetwise or Broker/Streetwise check (best of crew, Effect can be negative), plus, for Mail, whether the ship is armed, the world's Tech Level, and the highest Naval/Scout rank and SOC among crew
3. System displays the rolled count next to each passage tier, freight lot size, and the mail contract form
4. Booking forms cap their inputs at the displayed availability
5. A successful booking atomically decrements the matching count for the rest of this tick

**Alternate / Exception Flows:**
- **A1 — CT7/T5 campaign:** This use case does not apply; booking remains unlimited-subject-to-ship-capacity, and the destination field keeps its pre-existing position in the form (not moved to the top)
- **A2 — A different ship at the same route/tick:** Gets its own, potentially different, availability counts, reflecting its own crew
- **A3 — The same ship considers a different destination, or the same destination at a different distance:** Gets an independent roll — the count is per-route, not per-origin-world alone
- **A4 — Two bookings race for the last seat/lot/container:** The atomic guarded decrement lets only one succeed; the other is rejected cleanly

**Postconditions:**
- `traffic_snapshots` has a row for this (campaign, **ship**, origin world, **destination world**, tick) if one didn't already exist

---

### UC-39: Manage MgT2022 Characteristics, Background, and Rank

**Actor:** Player, Referee
**Related Requirements:** FR-1003
**Trigger:** Player opens the Character dialog, or Referee opens Campaign Management > Players and selects a character (MgT2022 campaigns only)

**Preconditions:**
- Campaign's `trade_rules` is `MgT2022`
- Referee flow: user is authenticated as referee. Player flow: user is authenticated as the character's own player

**Main Flow:**
1. User opens the characteristics form, pre-filled with the character's current STR/DEX/END/INT/EDU/SOC, background, and rank (blank/null if never set)
2. User edits one or more fields and saves
3. System persists the change

**Alternate / Exception Flows:**
- **A1 — Player attempts to edit another character's characteristics:** Rejected (403) — the self-service route checks `session.player_id === player_id`

**Postconditions:**
- `players` reflects the updated characteristics/background/rank

---

### UC-40: Find a Supplier (MgT2022)

**Actor:** Player
**Related Requirements:** FR-410
**Trigger:** Player opens Port > Market at a world in an MgT2022 campaign, having not yet succeeded a Find-a-Supplier check there this game-month

**Preconditions:**
- Campaign's `trade_rules` is `MgT2022`
- Player's character has `can_trade` on their assigned ship (to make the search meaningful — the check itself has no `can_trade` gate)

**Main Flow:**
1. System shows a "Find a Supplier" prompt in place of the market table, along with the count of any prior attempts this world/month
2. Player clicks "Find a Supplier"
3. System reads the player's own Broker skill level and computes the world's starport DM
4. System rolls 2D6 (plain, non-seeded — a one-shot action, not required to be replay-deterministic), adds skill level + starport DM, subtracts 1 per prior attempt this world/month, and compares the total to the Average (8+) target
5. System records the attempt in `supplier_search_attempts`
6. On success, the market table becomes visible for the remainder of the game-month

**Alternate / Exception Flows:**
- **A1 — Check fails:** The Find-a-Supplier prompt remains; the player may retry (each retry is DM-1 harder) or wait for the next game-month, which resets `attempts`/`succeeded` for a new `month_key`
- **A2 — Another player already succeeded at this world this month:** Has no effect on this player — success is tracked per player, not per world, since different players may hold Broker/Streetwise at different levels

**Postconditions:**
- `supplier_search_attempts` reflects the new attempt count and, on success, `succeeded = 1` for (player, world, sector, month)

---

### UC-41: Seek and View the Black Market (MgT2022)

**Actor:** Player
**Related Requirements:** FR-2101, FR-2102, FR-2103
**Trigger:** Player opens Port > Market at a world in an MgT2022 campaign, with their ship not yet having succeeded a Black Market check there this game-month

**Preconditions:**
- Campaign's `trade_rules` is `MgT2022`
- Player has an assigned ship

**Main Flow:**
1. System shows a "Seek Black Market" button in the market table's controls, along with the count of any prior attempts by this ship at this world/month
2. Player clicks "Seek Black Market"
3. System looks up the highest Streetwise skill among the ship's current crew (server-side — no client-supplied skill level is trusted) and the world's starport DM
4. System rolls 2D6 (plain, non-seeded), adds skill level + starport DM, subtracts 1 per prior attempt this world/month by this ship, and compares the total to the Average (8+) target
5. System records the attempt in `black_market_search_attempts`, keyed by ship (not player)
6. On success, a "Black Market" toggle appears in the market table's controls; the check succeeds for the rest of the game-month for **every player on that ship**, not just whoever clicked
7. Player toggles to the Black Market view; system generates (or retrieves) a second, parallel composition for this world/tick whose random extra draws are forced into the illegal die range (61-66, excluding Exotics at 66), and displays those goods with the same per-player Broker-skill pricing overlay as the normal listing

**Alternate / Exception Flows:**
- **A1 — Check fails:** The "Seek Black Market" button remains; the player (or any other player on the same ship) may retry (each retry is DM-1 harder for that ship) or wait for the next game-month, which resets `attempts`/`succeeded` for a new `month_key`
- **A2 — A different ship at the same world:** Unaffected by this ship's success — tracked per ship, not per world or per player
- **A3 — Player toggles back to the normal listing:** No re-check needed; the normal listing was never gated by this check

**Postconditions:**
- `black_market_search_attempts` reflects the new attempt count and, on success, `succeeded = 1` for (ship, world, sector, month)
- `market_snapshots` has a row set with `is_black_market = 1` for this (world, tick) if one didn't already exist
