# Financial Model — Gap Analysis

*Generated 2026-06-15 — revised 2026-07-11 (Ship Templates, Asset Valuation, Debt Tracking, Net Worth, Ownership Tracking + Organizations Phase 1 implemented; Organizations authorization corrected same day — see below)*

---

## Already Implemented

| Requirement             | Status      | Where                                                                                                                                          |
| ----------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Cash balance            | **Full**    | `ships.credits` — per-ship treasury                                                                                                            |
| Trade transactions      | **Full**    | `transactions` table (8 types) + Ledger report                                                                                                 |
| Income tracking         | **Full**    | sell, passenger_fare, mail types in transactions                                                                                               |
| Expense tracking        | **Full**    | buy, fuel, passenger_refund, fee types                                                                                                         |
| Income Breakdown report | **Full**    | Reports sub-tab — aggregated by type with All Time / Year Range filter                                                                         |
| Cargo                   | **Full**    | `cargo` table with tons, price_per_ton                                                                                                         |
| Commercial obligations  | **Full**    | `obligations` table — general pending-commercial-commitment model with a `kind` discriminator (`mail`, `passenger` today). Replaces the old separate `mail_contracts`/`passenger_manifests` tables; new obligation types (charter deposits, insurance claims, referee IOUs) can reuse it without a new table. |
| Ship Templates          | **Full**    | `ship_templates` table (`d1/005_ship_templates.sql`), ruleset-tagged (CT7/T5), referee CRUD via Campaign Management → Ships → Templates. New Ship form's Template dropdown pre-fills all fields from a selection; **"Custom Design"** keeps today's fully-manual flow. A **"Save as Template"** button on any existing ship's detail view captures its current stats as a new named template (name uniqueness enforced server-side, `409` on conflict). No persistent link between a ship and the template it came from. Lazily seeds one CT7 starter reference (Type A Free Trader) the first time a CT7 campaign opens the panel — its `notes` field flags it as unverified against the actual book. T5 campaigns start empty (no verified T5 reference stats to seed yet). |
| Asset Valuation         | **Full**    | **Ship value**: `ships.market_value` field, populated via Ship Template selection or manual entry (Custom Design) — sidesteps needing a CT7/T5 costing *engine* by moving the work to "referee enters a known value once, on the template." **Cargo value**: `CargoHold.vue` footer row sums each item at the currently-viewed world's live sell price, falling back to purchase price for goods not yet appraised there. |
| Debt Tracking           | **Full**    | `ship_debts` table (`d1/006_ship_debts.sql`) — type (mortgage/loan/obligation), principal, current_balance, due_tick, creditor_name, notes. `ship_id` nullable for future corporate-level debt. **No interest** (Referee manages the balance directly). Referee CRUD via Campaign Management → Ships → Debts; player pays down via Reports → Debts (atomic: decrements `ships.credits` + `ship_debts.current_balance`, validates against both insufficient credits and overpayment past the remaining balance). Payment history lives in a separate `debt_payments` table rather than the `transactions` ledger, since that table's `type` is a `CHECK` constraint SQLite can't `ALTER` in place. |
| Net Worth Calculation   | **Full**    | "Net Worth" tab in Ship → Reports: `credits + ship market value + cargo value (at cost) − total debt`, then scaled by the player's ownership share (see Ownership Tracking below) into a "Your Share" figure. Cargo is valued at purchase price rather than live market price — this panel has no world context (unlike `CargoHold.vue`'s per-market "Est. Hold Value"), and net worth should be a stable snapshot, not swing with whichever world was last viewed. |
| Ownership Tracking      | **Full** (Phase 1) | `ship_ownership` table (`d1/007_ownership.sql`) — multiple players jointly owning one ship, referee-managed via a new "Ownership" section on the ship detail view (100%-ceiling enforced server-side, `409` if a share would push the total over). Net Worth reads this via `GET /api/reports/ownership`: a player's share defaults to 100% minus whatever's explicitly recorded for others (not a flat 100%) when they have no row of their own — so a partner ship correctly shows the *other* owner's remainder, not an overstated full share. See Organizations below for the corporate-ownership half. |
| Organizations (Phase 1) | **Full** (entity + membership only) | `organizations` + `organization_members` tables — the generic **Organization** entity (corporation/confederation/trade-union as configuration, not separate tables) from the Corporation/Fleet exploration below. Create an org (name, treasury, flat dues rate, notes — name uniqueness enforced, `409` on conflict), add/remove member ships with an `owns_ship` flag (org owns the ship's assets/debts outright vs. ship stays independently owned, just affiliated). **No financial mechanics yet** — dues collection, disbursement, and fleet-level P&L are explicitly Phase 2, below. **Authorization corrected same day (`organization_officers` table, `d1/008_org_officers.sql`):** the initial pass gated all of this behind Referee-only CRUD, copying the Debts/Templates pattern — wrong, since a corporation is something a *player* actively runs (like a ship), not a fact the referee arbitrates (like a debt). Any authenticated player can now found an organization (becoming its first officer automatically) via a new player-facing "Organizations" tab (`OrganizationsPanel.vue`, under Ship in `MapView.vue`); management (edit, officers, member ships) requires being one of the org's officers — a flat list, no role hierarchy — or the referee, who always retains override rights on every org regardless of officer status (same safety-net principle as editing any ship). A guard rejects removing an organization's last officer. Ship Ownership (the % split of one ship, above) deliberately stays Referee-only — it's closer to a debt/contract the referee adjudicates than a business a player runs. All CRUD now lives at `/api/organizations/*` (`worker/src/routes/organizations.js`), replacing the old `/api/referee/organizations*` routes. |

---

## Not Implemented — with Effort Estimates

Only Corporation/Fleet **Phase 2** remains — the financial mechanics layered on top of the Organization entity built in Phase 1 (above). Not designed in detail yet; each of these needs its own pass:

### 1. Dues collection + disbursement actions

Scheduled ship→org and org→ship treasury transfers. The mechanism itself is trivial (reuses the same credit-adjustment pattern as `POST /:id/pay-debt`), but needs a UI decision (where does a referee trigger a dues collection across all member ships at once?) and confirmation of the existing direction: flat-rate dues (not percentage-of-something), both dues and disbursement Referee-adjudicated rather than automatic — see Corporation/Fleet notes below.

### 2. Fleet-level P&L / consolidated reporting

Aggregate Net Worth/income across an org's member ships. Trivial query-wise (`organization_members` already links ships to orgs — per-ship is a `WHERE`, fleet total is `SUM(...) GROUP BY`), but needs a home in the UI (a referee-facing report, most likely, alongside or inside the Organizations tab).

### 3. Chained ownership when an org owns a ship outright

When `organization_members.owns_ship = 1`, whose personal Net Worth does that ship's value flow into? Presumably a player's stake *in the organization* — which needs a third ownership table (`organization_ownership`: player % of an org, mirroring `ship_ownership`) that doesn't exist yet. Until this is built, an org-owned ship's value doesn't attribute to any player's personal Net Worth — a real gap, flagged rather than silently decided.

---

## Recommended Sequencing

| Order | Feature                      | Rationale                                                                                  |
| ----- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| ~~1~~ | ~~Ship Templates~~             | **Done**                                                                                   |
| ~~2~~ | ~~Asset Valuation~~            | **Done**                                                                                   |
| ~~3~~ | ~~Debt Tracking~~              | **Done**                                                                                   |
| ~~4~~ | ~~Net Worth~~                  | **Done**                                                                                   |
| ~~5~~ | ~~Ownership + Organizations (Phase 1)~~ | **Done**                                                                        |
| 6     | Dues / disbursement (Phase 2) | Needs its own design pass on top of the Phase 1 entities                                    |
| 7     | Fleet-level reporting (Phase 2) | Trivial query-wise; needs a UI home                                                       |
| 8     | Chained org-ownership attribution (Phase 2) | Needs the `organization_ownership` question above resolved first             |

---

## Future: Corporation / Fleet — Phase 2 (Deferred)

Phase 1 (the generic **Organization** entity — corporation/confederation/trade-union as configuration, not separate tables — plus membership and plain player-partnership ship ownership) is done; see Already Implemented above. Phase 2 is the financial mechanics that build on it:

- optional **dues** — a scheduled transfer from each member ship's treasury into the org's treasury (e.g. a trade-union membership fee)
- optional **disbursement** — a transfer the other way, from the org's shared fund into a member ship in hardship (a "rainy day fund")
- **fleet-level reporting** and **chained ownership attribution** (see Not Implemented above)

Dues and disbursement both reuse the existing credit-adjustment mechanism — no new financial primitive needed. Dues-as-a-percentage raises the same kind of undefined-math question as debt interest (percentage *of what*? — flat rate, current credits, period income/profit are all plausible and Traveller defines none of them), so the current direction is a **flat rate set by whoever runs the organization** (the "union boss," who may just be the referee) rather than a formula, and both dues collection and disbursement should stay Referee-adjudicated rather than automated on tick advance — consistent with the no-interest decision on debt.

**Do not implement now** — revisit once there's an actual campaign need for dues/disbursement/fleet reporting, rather than building it speculatively ahead of one.
