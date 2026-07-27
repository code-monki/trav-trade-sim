# Developer Log — Traveller Trade Simulator

---

## 2026-06-11 — Initial build

### Goal
Create a static Vue 3 app to browse Traveller Map sector and world data from the public API at https://travellermap.com/doc/api.

### Decisions

**Vue 3 via CDN, no build step.**
Keeps the project portable — open `index.html` directly or serve from any static host. No npm, no bundler.

**Tab-delimited format for world data (`type=TabDelimited`).**
The API offers several sector data formats (Legacy, SecondSurvey, TabDelimited). TabDelimited is easiest to parse in plain JS and includes T5 Second Survey fields like `{Ix}`, `(Ex)`, `[Cx]` when present. Headers are parsed dynamically from the first non-comment line so the app handles any field set the server returns.

**Milieu fixed to M1105 (the "classic" Third Imperium era).**
Easy to change — swap the `milieu=M1105` query param in `onSectorChange` and `loadSectors`. Other valid values include `M0`, `M990`, `M1120`, `M1201`.

**UWP decoded client-side from lookup tables.**
The API doesn't return decoded UWP fields. All eight UWP digits (Starport, Size, Atmosphere, Hydrographics, Population, Government, Law, TechLevel) are decoded using local lookup tables in `app.js`.

**World list filter is client-side.**
After loading a sector's worlds, filtering by name/hex is instant and requires no additional API calls.

**"All Fields" section collapsed by default.**
The raw field dump is available but hidden to keep the UI clean.

### Files created
- `index.html` — Vue app shell
- `app.js` — Composition API logic + data tables
- `style.css` — Dark space-themed layout
- `AGENTS.md` — Architecture reference
- `DEVLOG.md` — This log

---

## 2026-06-11 — Routes data added

### Goal
Show routes (trade/comm/X-boat corridors) defined for each world in the sector metadata.

### Approach
Routes live in `<Routes><Route .../></Routes>` inside the sector's XML metadata, fetched from `/api/metadata?sector=NAME`. Each `<Route>` has `Start` and `End` hex attributes, an optional `Allegiance`, and optional `StartOffsetX/Y`/`EndOffsetX/Y` attributes for cross-sector connections.

`onSectorChange` now fires two requests in parallel (`sec` + `metadata`) and combines results. Routes are parsed via `parseSectorRoutes()` using the browser's `DOMParser`, stored in `sectorRoutes`, and then indexed by hex in the `routesByHex` computed. The `selectedWorldRoutes` computed filters to just the routes touching the selected world.

**Cross-sector routes**: when offset attributes are non-zero, the partner world is in an adjacent sector. Those routes are displayed with a "cross-sector" badge; the partner name field will be `null` (not in the worlds list) and the hex is shown as-is.

**Route colour**: the `Color` attribute (e.g. `#FF0000`) is applied as a left-border accent on the route card when present.

Metadata fetch failure is silently swallowed — sectors without metadata still load normally.

### Known limitations / future work
- No pagination on world list (sectors can have 500+ worlds; virtual scrolling would help)
- No offline/cache layer — every sector load hits the network
- `/api/credits` (source attribution per world) not yet wired up
- No jump-route or jump-world visualisation
- Milieu is hardcoded; could be a UI selector

---

## Licensing & Attribution

### Trademark holder
Traveller is a registered trademark of Mongoose Publishing Ltd.  
Copyright 1977 – Present Mongoose Publishing Ltd.

### Required disclaimer (Mongoose fan-site policy)
The full text below must appear in the app's About dialog (or equivalent) before public release.
Mongoose Publishing must also be notified of the site's existence; permission is subject to 90 days' withdrawal notice.

> **Mongoose Publishing**
>
> The Traveller game in all forms is owned by Mongoose Publishing Ltd.. Copyright 1977 - Present Mongoose Publishing Ltd. Traveller is a registered trademark of Mongoose Publishing, Ltd. Mongoose Publishing permits web sites and fanzines for this game, provided it contains this notice, that Mongoose Publishing is notified, and subject to a withdrawal of permission on 90 days notice. The contents of this site are for personal, non-commercial use only.
>
> Any use of Mongoose Publishing's copyrighted material or trademarks anywhere on this web site and its files should not be viewed as a challenge to those copyrights or trademarks. In addition, any program/articles/file on this site cannot be republished or distributed without the consent of the author who contributed it.

### TODO — About dialog
- [x] Build an About dialog / modal (accessible from hamburger menu)
- [x] Display the full Mongoose disclaimer text above verbatim
- [x] Include app version (from `package.json`) and a link to the GitHub repo
- [ ] Notify Mongoose Publishing once the app is publicly accessible

---

## 2026-06-12 — Campaign starting year, market backfill, column docs

### Campaign starting year (Feature)
Referees can now choose an Imperial starting year when creating a campaign
(default 1105, range 1100–1201). The client computes
`startTick = (startYear - 1105) * 48` and passes it to the `create_campaign`
RPC as `p_start_tick` (migration 007). The RPC derives `year` and `day` from the
tick and inserts them into `campaign_calendar`.

### Lazy price history backfill (Feature)
On the first visit to any world, `ensureWorldSnapshot()` now detects that no prior
snapshots exist and generates price history for every tick from the start of the
current Imperial year up to the tick before the current one. This gives price charts
immediate context (up to 47 weeks of history) without any upfront bulk computation.
Backfill rows carry no market-event modifiers since those events did not fire.
Maximum backfill: 47 ticks × 36 goods = 1,692 rows — fits in a single Supabase insert.

### Market table column definitions (Help system)
Added a column-definition table to the Market Tab section of the User Manual
explaining Good, Die, Buy, Sell, Spread, Qty (t), and Event columns.
Qty (t) entry explicitly documents the per-tick expiry rule (no rollover).

### CT2 ruleset removed
Dropped the disabled CT2 option from the Trade Rules dropdown — CT7 is a superset
and there is no value in a separate CT2 implementation.

### AGENTS.md rewritten
The file was stale from the prior travmap-export project. Replaced with a complete
architecture reference for trav-trade-sim covering stack, file tree, key design
decisions, security constraints, and restart instructions.

---

## 2026-07-05 — Migrate from Supabase to Cloudflare D1 + Workers

### Rationale

Supabase free-tier projects are **automatically paused after seven consecutive days of inactivity**. Resuming requires the project owner to log in to the Supabase dashboard and click "Restore" — users cannot resume the database themselves, and the app is completely unavailable until it is done. For a campaign tool that may sit idle between gaming sessions, this is unacceptable.

Cloudflare D1 has no inactivity pause. Free-tier D1 databases remain always-available and there is no manual intervention required after periods of no use.

### What changed

**Backend replaced entirely.** The Supabase project (PostgreSQL + PostgREST + SECURITY DEFINER RPCs) has been replaced by:
- **Cloudflare D1** — SQLite at the edge; schema in `d1/schema.sql`; migrations numbered `002_`, `003_`, etc.
- **Cloudflare Workers** — a Hono v4 API at `https://trav-trade-sim.codemonki.workers.dev`; source in `worker/src/`

**Frontend API client replaced.** `@supabase/supabase-js` and `src/lib/supabase.js` have been removed. All stores now import `api` from `src/lib/api.js`, a thin fetch wrapper that reads the Bearer session token from localStorage and targets `VITE_API_URL`.

**Authentication model changed.** Supabase's anon key + RLS model is replaced by session tokens (UUID) stored in the D1 `sessions` table. Login returns a token; all subsequent requests carry `Authorization: Bearer <token>`. PIN hashing uses PBKDF2-SHA256 (10,000 iterations) via the Web Crypto API — reduced from an initial 200,000 to stay within the Workers free-tier 10 ms CPU budget.

**Atomic writes via `db.batch()`.** Every compound operation (buy cargo, sell cargo, book passengers, etc.) uses a D1 batch so credits/credits and inventory are updated atomically without database transactions.

### New features shipped at the same time

- **Stateroom occupancy accounts for crew.** Each active crew member occupies one stateroom by default. The referee can mark any crew member as "double-bunked" (`has_stateroom = 0`) to free that stateroom for passengers. `stateroomsAvailable` now reflects both crew and passenger occupancy.
- **Fuel deducted on jump.** `updateLocation` now accepts a `fuelCost` parameter; fuel is atomically deducted from `ships.fuel_current` before the location update commits.
- **Passengers and mail auto-deliver on arrival.** When `updateLocation` is called with `{ tick, campaignId, playerId }`, the store calls `autoDeliver`, which settles any manifests or mail contracts whose destination matches the new world.
- **`qty_available` enforced server-side.** The Worker's `buy-cargo` route checks and atomically decrements `market_snapshots.qty_available`; the client can no longer over-purchase.

### D1 migrations applied to production

| File | Description |
|------|-------------|
| `d1/schema.sql` | Full initial schema (all tables, indexes, views) |
| `d1/002_sessions.sql` | `sessions` table for Bearer token auth |
| `d1/003_crew_stateroom.sql` | `has_stateroom INTEGER NOT NULL DEFAULT 1` on `crew` |

### Deleted

- `supabase/` directory (22 migration files + `ADMIN_NOTES.md`)
- `src/lib/supabase.js`
- `@supabase/supabase-js` npm dependency

---

## 2026-07-11 — Unify mail contracts + passenger fares into `obligations`

### Rationale

`docs/financial-model-gap-analysis.md` flagged "Commercial obligations" as only partially implemented: `mail_contracts` and `passenger_manifests` each tracked a pending commercial commitment independently, with no shared concept. Adding a future obligation type (charter deposit, insurance claim, referee IOU) would have meant another one-off table.

### What changed

**`mail_contracts` and `passenger_manifests` replaced by a single `obligations` table**, discriminated by a `kind` column (`mail` | `passenger`). Status lifecycle generalized: `in_transit → delivered` became `pending → fulfilled`; passenger `refunded` became `cancelled` (mail still has no cancellation path — same as before).

**Worker routes updated, response shape unchanged.** `worker/src/routes/ships.js` and `worker/src/routes/referee.js` now query `obligations` with `kind`/`status` filters and column aliases (`amount AS fare_total`, `origin_world_hex AS embark_world_hex`, etc.) that reproduce the exact JSON shape the frontend already expected — no frontend changes were needed.

**D1 database only held test data**, so the migration (`d1/004_obligations.sql`) drops and recreates rather than backfilling.

---

## 2026-07-11 — Ship Templates + Asset Valuation

### Rationale

First two items off `docs/financial-model-gap-analysis.md`'s Not Implemented list. Ship value was originally scoped as "calculate from CT7 hull-tonnage cost tables," but CT7's costing is a simple lookup while T5's is a full component-based design system — building a costing *engine* per ruleset wasn't worth it just for a valuation display. Moving the work to Ship Templates (referee enters a known value once, when the template is created) solves both at once.

### What changed

**New `ship_templates` table** (`d1/005_ship_templates.sql`) — ruleset-tagged (CT7/T5), referee CRUD via a new "Templates" panel in Campaign Management → Ships. The New Ship form gained a Template dropdown that pre-fills every field (including the new `ships.market_value`) from a selection; **"Custom Design"** keeps today's fully-manual flow untouched. No persistent link between a ship and the template it came from — every field remains independently editable after creation, same as before.

**Lazy-seeded starter template.** `GET /api/referee/ship-templates` inserts one CT7 reference design (Type A Free Trader) the first time a CT7 campaign has none — same "generate on first access" pattern as market snapshots/events. Its `notes` field flags it as unverified against the actual rulebook. T5 campaigns start empty; no verified T5 reference stats to seed yet.

**Cargo value display.** `CargoHold.vue` gained a footer row summing the hold at the currently-viewed world's live sell price, falling back to purchase price for goods not yet appraised there.

**Save as Template (added later the same day).** Any existing ship's detail view now has a "Save as Template" button that captures its current stats into a new named template — the reverse direction of the dropdown above. Surfaced a real gap while adding it: `POST`/`PATCH /ship-templates` had no duplicate-name pre-check, so a collision with the table's `UNIQUE(campaign_id, name)` constraint would have bubbled up as a raw D1 error instead of a clean message. Fixed to match the existing convention elsewhere in the codebase (e.g. campaign character-name conflicts) — a pre-check `SELECT` returning a `409` with a friendly error.

### Verified

Full CRUD (seed idempotency, custom template create/edit/delete, ship creation with template-derived fields) tested directly against a local D1 instance via curl, plus an actual headless-browser pass (Playwright, already a project dependency) against the running dev server confirming the dropdown, pre-fill, and Custom Design reset all work with zero console errors. Save as Template + duplicate-name rejection verified the same way.

---

## 2026-07-11 — Debt Tracking

### Rationale

Third item off `docs/financial-model-gap-analysis.md`'s Not Implemented list. Needed independent of the deferred Corporation/Fleet feature — even a single independently-owned ship needs a basic debt ledger.

### What changed

**New `ship_debts` + `debt_payments` tables** (`d1/006_ship_debts.sql`). `ship_debts.ship_id` is nullable so a future corporate-level debt (not tied to one hull) can reuse the table without a migration. **No interest** — Traveller doesn't define compounding mechanics; the Referee manages `current_balance` directly, same bias as everything else added this session.

**Payment history is a separate table, not `transactions`.** `transactions.type` is a `CHECK` constraint SQLite can't `ALTER` in place — recreating that table just to add a `debt_payment` type was more risk than a small dedicated `debt_payments` table, which also gives a cleaner per-debt audit trail.

**Referee CRUD** via a new "Debts" section in Campaign Management → Ships (same component-local state pattern as the existing "Passengers In Transit" section — not the referee store). **Player-facing view + payment** via a new "Debts" tab in the Ship → Reports panel: `POST /:id/pay-debt` atomically decrements `ships.credits` and `ship_debts.current_balance` and inserts a `debt_payments` row, rejecting both insufficient credits and overpayment past the remaining balance.

### Verified

Referee CRUD, player view, and payment (including both rejection paths) tested directly against local D1 via curl, plus a Playwright pass against the running dev server: created a debt as referee, confirmed it appeared in the player's Reports → Debts tab, made a partial payment, confirmed the balance updated correctly (Cr40,000 → Cr25,000) with zero console errors.

---

## 2026-07-11 — Net Worth

### Rationale

Final item off `docs/financial-model-gap-analysis.md`'s Not Implemented list (excluding Ownership Tracking, deliberately deferred alongside Corporation/Fleet). Falls out mostly as a computed display once Asset Valuation and Debt Tracking exist.

### What changed

**New "Net Worth" tab** in Ship → Reports: `credits + ship market value + cargo value − total debt`. Cargo is valued at **purchase price**, not live market price — `ReportsPanel.vue` has no world-context prop (unlike `CargoHold.vue`, which values the hold at whatever market is currently being viewed), and net worth is meant to be a stable snapshot rather than swing with whichever world was last browsed.

**Bug found and fixed while verifying this:** `GET /api/ships/current` (the player-facing "load my ship" endpoint) used an explicit column allowlist that predated the Ship Templates work and never picked up `market_value` — every player's own view of their ship silently showed Cr0 ship value regardless of what was actually set, even though the referee-facing `GET /api/referee/ships` (`SELECT *`) was correct all along. Caught because Net Worth's Cr37,680,000 test fixture rendered as Cr0. Fixed in `worker/src/routes/ships.js`.

### Verified

Playwright pass against the running dev server with a temporary market value and debt applied directly to the real ship — confirmed Cr100,198,600 credits + Cr37,680,000 ship value + Cr0 cargo − Cr12,000,000 debt = Cr125,878,600 net worth, matching the display exactly. Test fixtures reverted afterward.

---

## 2026-07-11 — Ownership Tracking + Organizations (Phase 1)

### Rationale

Last item on `docs/financial-model-gap-analysis.md`, explicitly deferred earlier because it's "the most architecturally coupled to the future Corporation/Fleet feature." Rather than build plain ship-partnership ownership in isolation and risk redesigning it once Corporation/Fleet landed, this pass started the generic **Organization** concept (from the Corporation/Fleet exploration — corporation/confederation/trade-union as configuration, not separate entities) alongside it. Scoped deliberately as **Phase 1**: the entities and CRUD everything else builds on, without the financial mechanics (dues, disbursement, fleet-level P&L) that depend on them — those are an explicit, flagged Phase 2, not silently dropped.

### What changed

**`ship_ownership`** (`d1/007_ownership.sql`) — multiple players jointly owning one ship. Referee-managed via a new "Ownership" section on the ship detail view; percentage validated server-side so a ship's shares can never exceed 100% (`409` if they would).

**`organizations` + `organization_members`** — the Organization entity (name, optional treasury, optional flat dues rate) and ship affiliation, with an `owns_ship` flag distinguishing "org owns this ship outright" (corporation/fleet) from "ship stays independently owned, just affiliated" (confederation/trade-union). Referee CRUD via a new "Organizations" tab.

**Net Worth updated** to read ownership shares (`GET /api/reports/ownership`) and show a "Your Share" figure scaling the *whole* net worth, not just ship value as the original gap-analysis draft formula had it.

**Bug found and fixed while verifying this:** the "Your Share" calculation initially defaulted to 100% whenever the current player had no `ship_ownership` row of their own — correct for a ship with no ownership records at all, but wrong the moment *any* partner share existed without the current player also having an explicit row (e.g. a 40% partner recorded, nothing recorded for the ship's own captain) — it should fall back to the *remainder* (100% minus other recorded shares), not a flat 100%. Caught via the Playwright pass: a 40%-partner test case rendered "Your Share (100%)" instead of the correct 60%. Fixed in `ReportsPanel.vue`.

### Verified

Full CRUD (ownership 100%-ceiling validation, organization name uniqueness, membership add/remove) tested directly against local D1 via curl, plus a Playwright pass against the running dev server: referee added a 40% partner share and an Organization with the ship as a member, player's Net Worth tab correctly showed both the ownership breakdown and a 60%-scaled "Your Share" after the fix. Test fixtures (including a temporary second player) reverted afterward.

---

## 2026-07-11 — Organizations: player-founded, multi-officer authorization

### Rationale

Phase 1 (above) gated all Organization CRUD behind `requireReferee`, copying the Debts/Templates pattern without examining whether a corporation is the same *kind* of thing. It isn't: a debt is a fact the referee arbitrates about the world; a corporation is something a player actively runs, like a ship. In multiplayer a player may want to found and run their own corp/fleet, recruiting other players as ship captains — solo play stays effectively GM-controlled simply because there's usually only one player-character to found one, not because the app enforces it.

### What changed

**`organization_officers`** (`d1/008_org_officers.sql`) — a flat, no-hierarchy list of players authorized to manage an organization (any officer can manage it fully, including adding/removing other officers). A guard rejects removing an organization's last officer, avoiding an orphaned, unmanageable org.

**New unified route surface**, `worker/src/routes/organizations.js` mounted at `/api/organizations`, replacing the old `requireReferee`-only `/api/referee/organizations*` routes. All endpoints run under `requireAuth`; an `isOfficerOrReferee` helper gates mutations (create is open to any authenticated player, who becomes the org's first officer automatically). The referee retains full override rights on every org regardless of officer status — the same safety-net principle as being able to edit any ship. A new `GET /campaign-players` roster endpoint (character names only, no financial data) supports the officer picker for non-referee players who can't call the referee-only player list.

**New player-facing `OrganizationsPanel.vue`**, wired in as a "Organizations" sub-tab under Ship in `MapView.vue`: browse all of the campaign's organizations, found a new one, and — if an officer of it (or the referee) — edit its treasury/dues/notes, manage its officer list, and add/remove ship members (a player adds *their own* ship, not an arbitrary one, since players have no endpoint listing every ship in the campaign). `RefereeView.vue`'s existing Organizations tab gained a matching "Officers" mini-section and had its API calls repointed at the new endpoints.

**Key distinction preserved:** Ship Ownership (the % split of one ship among players, Phase 1 above) stays referee-only — it's closer to a debt/contract the referee arbitrates than a business a player runs.

**Deliberately deferred, not part of this pass:** a personal player-wallet mechanism (`players.credits`, currently dead) and a referee-triggered "Distribute Profits" action moving ship treasury into individual owners' wallets — raised during this design discussion but scoped out to its own future pass.

### Verified

`npx vitest run` (302 tests) and `npx vite build` both clean. Local D1 + curl exercised the full authorization flow as a temporary non-officer player session: rejected from editing an org or managing its membership (`403`), promoted to officer by the referee and then able to manage it, rejected from removing the organization's last officer (`409`), and confirmed the referee could still delete the org outright despite not being one of its officers. Playwright pass against the running dev server: founded an organization via the new MapView Organizations tab (as the referee's own session, which auto-received officer status), added the ship as a member, and confirmed the same organization — name, officer, and member ship — appeared identically in RefereeView's Organizations tab, with zero console errors. All test fixtures (temporary player, session, and organization) reverted afterward.

---

## 2026-07-12 — Corporation/Fleet Phase 2: dues, disbursement, fleet P&L, chained ownership

### Rationale

Closes out `docs/financial-model-gap-analysis.md`'s last deferred section. User specified the shape directly: one flat dues rate per org (not per-ship) set by the org head, a configurable collection frequency driving a "due" indicator but never automatic collection, disbursement as a fully separate ad hoc action, org equity that officers (not just the referee) can manage, and fleet P&L restricted to officers + referee since it exposes every member ship's private financials. Mid-implementation, the user added one more requirement: a guard preventing an officer from accidentally collecting dues more than once within a single period.

### What changed

**Schema** (`d1/009_org_financials.sql`): `organizations` gains `dues_frequency_ticks` (default 4) and `last_dues_tick`. New tables `dues_payments` and `disbursements` (audit trails, kept separate from `transactions` for the same reason `debt_payments` is — that table's `type` `CHECK` constraint can't be `ALTER`ed in place). New `organization_ownership` table — a player's equity % in an org, mirroring `ship_ownership`'s 100%-ceiling validation exactly, but officer-manageable rather than referee-only. A partial `UNIQUE` index (`organization_members(ship_id) WHERE owns_ship = 1`) enforces that a ship can be owned outright by at most one org at a time.

**Dues collection** (`POST /:id/collect-dues`, officer-or-referee): charges every member ship the org's flat rate independently — a ship without enough credits is skipped and reported back rather than blocking the rest of the fleet or the schedule. Guarded with a `409` against collecting again before `dues_frequency_ticks` have elapsed since `last_dues_tick` (first-ever collection always allowed, since `last_dues_tick` starts `NULL`).

**Disbursement** (`POST /:id/disburse`, officer-or-referee): an ad hoc org-treasury-to-ship-treasury transfer, capped at the org's current balance.

**Fleet P&L** (`GET /:id/fleet-report`, officer-or-referee only): per-ship credits/market value/cargo value/debt/net-contribution plus fleet-wide totals and an income/expense breakdown, reusing the same in-JS `byType` reduction pattern as the existing per-ship Income report, widened to `ship_id IN (...)` across an org's members. Surfaced in both `OrganizationsPanel.vue` (player-facing, gated to officers) and `RefereeView.vue`'s Organizations tab (referee always sees it).

**Chained ownership**: `GET /api/reports/ownership` now checks whether the requested ship is owned outright by an org (`organization_members.owns_ship = 1`) and, if so, transparently returns that org's `organization_ownership` rows instead of the ship's own `ship_ownership` rows — identical response shape either way, so `ReportsPanel.vue`'s existing Net Worth / "Your Share" computation needed **zero changes**. Confederation-style ships (`owns_ship = 0`) are unaffected.

**Shared label maps extracted**: `TYPE_LABEL`/`INCOME_TYPES`/`EXPENSE_TYPES`/`DEBT_TYPE_LABEL`, previously local consts in `ReportsPanel.vue`, moved to `src/lib/reports.js` so the new Fleet Report (in both `OrganizationsPanel.vue` and `RefereeView.vue`) could reuse them instead of triplicating the same maps.

**Bug found and fixed while verifying this:** `POST /:id/members` (adding a ship to an org) had no app-level check for the new ship-exclusivity rule — only `PATCH /:id/members/:memberId` did. Trying to add a ship as `owns_ship: true` to a second org hit the raw SQLite partial-unique-index violation and returned a `500` instead of a clean `409`. Fixed by adding the same pre-check to `POST /:id/members`.

### Verified

`npx vitest run` (302 tests) and `npx vite build` both clean. Local D1 + curl exercised the full flow: dues collection at tick 16 succeeded, an immediate re-collection at tick 17 was correctly rejected (`409`, "next collection available at tick 20"), collection at tick 20 succeeded; disbursement succeeded and over-treasury disbursement was rejected (`400`); org equity 100%-ceiling rejected an over-limit share (`409`); a ship marked `owns_ship=1` in one org was correctly rejected when a second org tried to claim it the same way (`409`, after the fix above); `GET /api/reports/ownership` correctly switched from empty `ship_ownership` results to the org's `organization_ownership` rows the moment `owns_ship` was set. Playwright pass against the running dev server: founded an org with dues via the MapView Organizations tab, added the ship, collected dues, disbursed part of it back, added equity, marked the ship org-owned, confirmed the ship's own Net Worth tab immediately reflected the org-equity share instead of an empty ownership section, opened the Fleet Report and confirmed the totals matched the ship's actual credits, and confirmed RefereeView's Organizations tab showed identical state throughout — zero console errors. All test fixtures (temporary organizations, ship credit deltas) reverted afterward.

---

## 2026-07-23 — Mobile-responsive UI + one-click campaign setup (external contribution, PRs #1–#4)

### Rationale

Four community PRs from an external contributor (gavmor) landed together: a New Campaign form that pre-fills/randomizes itself instead of requiring four hand-typed fields, and a three-part mobile pass (collapsible sidebar, decluttered header, bottom-sheet price chart) addressing the fact that the app was effectively unusable on a phone — the sidebar crushed the world detail pane, the header overflowed and wrapped onto three lines, and checking "Plot" mounted the price chart as a fixed panel that crushed the market table.

### What changed

**Campaign quick-start** (`src/lib/campaign-generator.js`, `LoginView.vue`): New Campaign now seeds campaign name, code, and referee character name with generated Traveller-flavored values on first visit (never clobbering anything already typed), plus a 🎲 Randomize button that re-rolls every field including a starting date consistent with the chosen milieu's canonical era. The PIN is deliberately never generated.

**Mobile sidebar** (`MapView.vue`, `style.css`, ≤640px only): the sector/world sidebar becomes a collapsible panel (starts collapsed so the world detail gets the full screen), auto-collapsing again after picking a world.

**Mobile header** (`MapView.vue`, ≤640px only): collapses to one row — title abbreviates to "TTS" (full name kept for screen readers via a clip-based visually-hidden span, not `display:none`), date+tick share a line, "Advance Tick ›" shrinks to "Advance ›", and the milieu picker + session readout move into the hamburger menu via a new generic `mobile-extras` slot.

**Mobile price chart** (`ChartSheet.vue`, new; `MarketTable.vue`, `PriceChart.vue`, ≤640px only): the chart moves into a bottom sheet with three drag-to-resize detents (peek/half/full), velocity-aware snapping, and gesture disambiguation so vertical drags move the sheet while horizontal drags still pan the chart. The market table's checkbox column is replaced on mobile by a "Compare" selection mode (header toggle or long-press) so plotting a good doesn't take a permanent column. Desktop is untouched in all three of these.

**Cross-PR bug found and fixed while merging:** PRs #2 and #4 each independently added a `NARROW_VIEWPORT_QUERY`/mobile-viewport-detection block to `MapView.vue`'s script setup, in non-overlapping line ranges. Git (and GitHub's merge check) auto-merged both with no conflict markers, but the result was a duplicate `const` declaration — invalid JS that broke the Vite build and made `MapView.test.js` fail to collect any tests at all. Neither PR could have caught this in isolation. Fixed by consolidating onto #4's reactive `isNarrow`/`narrowMq` implementation (it already tracks resize/rotation via a `matchMedia` change listener) and pointing #2's `sidebarOpen`/`onWorldSelect` at it instead of re-declaring their own one-shot check.

**Accessibility bug found and fixed:** #3's mobile header shrank "Advance Tick ›" to "Advance ›" by hiding the full label with `display:none` and marking the short label `aria-hidden="true"` — leaving the button with no accessible name at all on narrow screens (not caught by the PR's own tests, since jsdom doesn't apply media queries). Fixed by mirroring the title's clip-based visually-hidden technique instead of `display:none`, so "Advance Tick" stays the accessible name while "Advance ›" is what's shown.

### Verified

Each PR was checked out into an isolated worktree and independently build+test+e2e verified before merging, plus a full four-way test-merge to catch cross-PR interactions ahead of time (this is where the duplicate-const bug above was actually caught, before it ever reached `master`). Post-merge, with both fixes applied: `npm run build` clean, `npx vitest run` 448/454 (the 6 failures are pre-existing, in `api.test.js`/`health-check.test.js`, reproduce identically on the pre-PR `master`, and are unrelated to any of these changes — a local-env issue, not a regression), and `npx playwright test` 16/16 non-skipped tests passing. All four PRs merged via merge commit (#1–#4); the two fixes above shipped as a single direct follow-up commit immediately after, to minimize how long `master` sat in a broken state.

---

## 2026-07-24 — Reusable event definitions; deploy orchestration; stale test env fixed

### Rationale

Started as a one-line bug report: a referee-created custom market event didn't
show up on the Events tab without a manual refresh. The fix for that turned
out to be trivial (`submitEvent()` created the row via the API but never
touched the local Pinia cache backing the list — a one-line patch mirroring
the existing `doExpireEvent()` pattern). But testing it live surfaced the
real problem: the Events tab's "Active Events" list and the player-facing
`EventsHistory.vue` are two *separate* caches, each scoped to a specific
world/sector, so a freshly created event for an unvisited world was
invisible regardless of refresh — you had to already be looking at the right
world on the map.

Talking through the actual UX gap led to a bigger, deliberate redesign: today,
creating an event always means hand-typing a one-off row with free-text
World Hex/Sector fields, and the 20 built-in "Quick Events" are just a
client-side pre-fill, not a first-class concept. The decision was to decouple
"what an event does" (description, modifiers, duration, trade good die,
scope, severity) from "where/when it's applied" (world/sector/tick), and —
since scope/severity now live on the definition — let the same definitions
feed the deterministic per-tick auto-generator too, not just manual
assignment. "All events are just events; any event can be manually assigned
to a specific location" was the guiding statement for the whole redesign.

### What changed

**`event_definitions` table** (`d1/013_event_definitions.sql`, per-campaign,
mirrors `ship_templates`' shape): description, scope, severity, buy/sell
modifiers, duration, trade good die — no world/sector/tick fields, those stay
assignment-time-only on `market_events`. The built-in Quick Events catalogue
stays a static, hardcoded list in `RefereeView.vue` rather than being seeded
into the table — it's merged into the same picker at the UI level, but stays
fixed/uneditable, since seeding it would mean managing per-campaign seed
logic for no real benefit.

**`market_events.source`** (`d1/012_market_event_source.sql`, `'auto'` /
`'manual'`, default `'auto'`): needed first, since there was previously no
way to tell a referee-created event apart from an auto-generated one — both
go through the same table via the same insert path. The Referee's new events
grid filters to `source: 'manual'` only; the "show every event" alternative
was rejected because it would also surface auto-generated noise and hit the
existing 200-row API cap sooner in a long campaign.

**Custom definitions join the auto-generator's pool**
(`maybeGenerateEvent` in `src/lib/market-events.js`): now takes an optional
`customDefinitions` array (default `[]`, so every existing call site is
unaffected) and merges it into the same severity-tiered weighted pool as the
built-in `MARKET_EVENTS` table, normalized to the same shape. Custom
definitions don't get trade-code relevance weighting (no `affectsCodes`
field) — a deliberate simplification to avoid a trade-code multi-select in
the definition form. `tick.js` fetches the campaign's definitions once per
session/backfill run (not per tick) to keep the seeded-RNG generation pure
and fast. **Accepted tradeoff, written down so it isn't rediscovered as a
surprise later:** editing or deleting a definition after some ticks have
rolled against it can change what a *fresh recompute* would produce for that
historical tick — but the row already written to `market_events` never
changes, since `maybeInsertEvent`'s duplicate-check means a given tick is
only ever rolled once for real.

**`RefereeView.vue` Events tab, rebuilt in place:** the old single "Active
Events" card list is now a full grid of manual events (`tick.allEvents`)
with Sector/World filters sourced from the loaded rows themselves (not the
full Traveller universe, since that keeps the filter option lists small and
needs no extra network calls). "Create Event" became "Assign Event to
World": pick a definition (custom + built-in, merged into one dropdown) to
fill the form, then Sector/World dropdowns instead of free text. A third
new "Manage Event Definitions" panel does CRUD on the reusable library.
The Sector/World dropdowns are deliberately **not** built on the existing
`WorldPicker.vue`/`map.selectedSectorName` pattern used by `MapView.vue` —
that shared state is a single global selection, and the Events tab now
needs two independent pickers (grid filter, assign form) at once, which
would clobber each other and the player's own map browsing state if they
shared it. Solved with one small additive, non-mutating `map` store helper
(`fetchWorldsForSector`) instead of touching the shared component.

**Deploy orchestration (`Makefile`):** applying the two new migrations
surfaced that this project has no backend CI at all —
`.github/workflows/deploy.yml` only builds/deploys the frontend to GitHub
Pages; the Worker has always been deployed by hand. That's exactly how a
step gets missed: migrations were applied to remote D1 directly via
`wrangler d1 execute`, but the Worker itself — carrying the updated
`EXPECTED_MIGRATIONS` list the schema-drift check compares against — never
got redeployed, so the live app briefly showed "database schema is out of
date" even though the database was actually fine. New `worker-install`,
`worker-dev`, `migrate-status`, `migrate`, and `worker-deploy` targets, plus
a `deploy` target that chains `test` → `migrate` → `worker-deploy` so
shipping a backend change is one command. `migrate`/`migrate-status` diff
`d1/*.sql` against the remote `schema_migrations` ledger rather than
blindly re-running every file, since several migrations (e.g. `012`'s
`ALTER TABLE ADD COLUMN`) aren't idempotent. Recipes use portable
`\`-continued shell rather than `.ONESHELL:`, since macOS ships GNU Make
3.81 (frozen pre-GPLv3) which predates that directive entirely (3.82+) —
discovered when the first draft failed with a cryptic `/bin/sh: syntax
error: unexpected end of file` because each recipe line was silently
running in its own disconnected shell.

**Six pre-existing test failures fixed as a side effect of building
`deploy`'s test gate:** `2026-07-23`'s entry above already noted 6 failures
in `api.test.js`/`health-check.test.js` as "a local-env issue, not a
regression" and moved on. Root cause, finally chased down: `src/lib/api.js`
short-circuits with an `errorKind: 'config'` guard when `VITE_API_URL` is
unset, before ever reaching the mocked `fetch` those tests stub — and no
`.env`/`.env.test` file existed to set it for Vitest's `test` mode (only
`.env.production`, loaded only in `production` mode, and `.env.example`,
which is itself stale — it still documents the old Supabase setup this app
migrated away from). Added `.env.test` with a placeholder `VITE_API_URL`;
the actual value is never hit over the network since every affected test
stubs `fetch` regardless.

### Verified

`npx vitest run` — 464/464 passing (up from 456; the 8 new tests cover the
live-update fix, the events grid/filters/pickers, and the definitions CRUD
round-trip in `RefereeView.test.js`, plus `maybeGenerateEvent`'s custom-pool
merge in `market-events.test.js`), including the 6 that were failing at the
start of this session with no relation to any of today's other changes.
`make deploy` run end-to-end against the live database: `test` passes,
`migrate` correctly reports all 13 migrations already applied (skip, not
re-run), `worker-deploy` redeploys and confirms `/api/health` reports
`schema_ok: true`. Manually verified in the live app: creating a custom
definition, assigning it to a world via the new Sector/World dropdowns, and
seeing it appear in the grid immediately; expiring it flips its status in
place rather than removing the row.

### Known gap, not addressed this session

`AGENTS.md` and `.env.example` both still describe the pre-migration
Supabase architecture (this app now runs on Cloudflare D1/Workers, per the
Tech Stack table in `README.md` and `src/lib/api.js`'s own "replaces
@supabase/supabase-js" comment) — stale documentation debt, noticed while
tracking down the `.env.test` issue above, but out of scope for this pass.

---

## 2026-07-25 — MgT2022 trade/traffic rules-accuracy rebuild (Phases 1-3)

### Goal

Playtesting against the actual Mongoose Traveller 2022 Core Rulebook (not
the reconstructed approximation this app shipped with) surfaced that most
of the MgT2022 trade/traffic engine didn't match the book: wrong tables,
inverted DM signs, mechanics that existed as unit-tested pure functions but
were never wired into the live pipeline, and required data (characteristics,
background/rank, ship armament) that didn't exist in the schema at all.
`src/lib/traveller-data-mgt2022.js` even carried a header comment admitting
it was "a best-effort reconstruction drafted without a live copy of the
rulebook text." This is a full rebuild, done in 7 phases (plan:
`hazy-conjuring-cerf`); this entry covers Phases 1-3, which are complete.
Phases 4-7 (per-player pricing, Steward passenger-capacity gate, Freight
overhaul, Mail DMs) are designed but not yet started.

### Decisions

**Rebuild, not patch.** The findings were too interconnected to fix one at
a time — e.g. per-player Broker pricing (Phase 4) needs the buy-cargo
concurrency bug fixed first (Phase 1); Mail's SOC/rank DMs (Phase 7) need
the same characteristics/background schema Passengers' Steward gate (Phase
5) needs. Phases are ordered so each is independently shippable.

**Phase 1 — data correctness, no new mechanics.** Replaced
`MGT2022_PASSAGE_FARES`, `MGT2022_MODIFIED_PRICE_TABLE`, and
`MGT2022_FREIGHT_RATES` with exact rulebook values (freight rate collapsed
from three lot-size tiers to one flat per-parsec table — the book prices by
distance only). Replaced all 30 priced `MGT2022_TRADE_GOODS` entries: dice
formulas, DM codes, and specifically a systematic **purchase-DM sign
inversion** (e.g. Common Electronics' Industrial DM was `-2`, book says
`+2` — this didn't just misprice goods, it made a good *more* expensive on
the world that produces it). Added `availability` (which trade codes gate
whether a world offers the good) and `bannedLawLevel` (nullable) fields,
neither of which existed before. Removed Exotics (D66=66) from the priced
pool entirely — GM-adjudicated special case per this session's design
decision, never part of the normal buy/sell roll. Renamed
`sumTradeCodeDMs()` → `maxTradeCodeDMs()` ("use only the largest DM from
each column," not the sum). Fixed purchase/sale roll assembly so both
directions apply *both* DM columns with opposite signs (previously each
direction discarded the opposing column). Added real `lawFromUWP()` and
replaced the invented `smugglingRiskDM()` heuristic with the book's actual
formula (`world's Law Level − bannedLawLevel`, added as Sale DM when
positive). Fixed a **pre-existing, unrelated concurrency bug** found while
reasoning about per-player pricing: `buy-cargo` (`worker/src/routes/
ships.js`) used a separate `SELECT` then a blind decrement — classic
check-then-act race. Now a single guarded `UPDATE ... WHERE qty_available
>= ?`, checked via `meta.changes`, rejects the purchase before touching
cargo/credits/transactions if someone else already took the stock.

**Illegal-goods Law-Level DM only applies where the book gives (or implies)
a concrete threshold.** Advanced Weapons (LL3, the book's own worked
example), Illegal Weapons (LL1), and Pharmaceuticals (LL8, anagathics/
medicinal drugs — legal but Law-Level-sensitive above that threshold). The
other four illegal-band goods (Biochemicals, Cybernetics, Drugs, Luxuries)
keep their existing flat elevated Sale DM — no per-good threshold data
exists for those in the book. The richer "legal / licensed-medical /
military / black-market channel" model for drugs discussed during review
is **explicitly deferred**, not part of this rebuild's RAW-accuracy scope.

**Phase 2 — schema: characteristics, background, ship armament, mail
tonnage.** New migration `014`: `players` gains all six characteristics
(STR/DEX/END/INT/EDU/SOC) rather than just SOC — decided up front to avoid
a second migration once other characteristic-based checks (Steward, EDU-
gated skills, etc.) come up later — plus `background`/`rank`; `ships` and
`ship_templates` gain `armed`; `obligations` gains `mail_containers`. All
nullable/defaulted, so existing rows are unaffected. Editing follows the
**existing dual-path pattern** already used for skills rather than a new
one: referee-management routes under `/api/referee/...` plus a player
self-service pair (`GET`/`PATCH /api/reports/characteristics`) with the
same `session.player_id === player_id` ownership check `/skills` already
uses.

**Phase 3 — goods composition + Find a Supplier.**

*Composition* (`market-tick.js`): replaced "show all ~35 goods
unconditionally" with the book's actual "DETERMINE GOODS AVAILABLE"
algorithm — Common Goods always present, Trade Goods whose `availability`
matches one of the world's trade codes, plus a number of random D66 rolls
equal to the world's Population *code* (not a DM), rerolling 61-65 unless
seeking black market. Duplicate hits stack quantity rather than duplicating
the row. This is a deliberate **narrowing** of what Phase 1 shipped (which
showed everything) — resolves a filed issue asking for "show all the goods,
only the available ones" in the RAW-accurate direction the rulebook
actually specifies, at the cost of no longer matching that issue's literal
ask; flagged as the user's call, not re-litigated here. Composition draws
from a **separate seeded RNG stream** (`...composition:${tick}:v1`) from
each good's own price-roll stream, so whether a good is randomly selected
never shifts any other good's price-roll RNG position — determinism is
preserved even though the row count is now variable per world/tick instead
of fixed.

*Find a Supplier*: modeled as a **character-based, one-click player
action**, not an ambient world DM — the review specifically flagged that
multiple players might hold Broker/Streetwise at different levels, so a
world-level DM couldn't represent that. New table
`supplier_search_attempts` (migration `015`) tracks attempts/success per
`(player, world, sector, month)` — **month, not tick**: once a player finds
a supplier, that relationship persists for the rest of the game-month
rather than needing a fresh roll every tick, a refinement beyond the
original plan sketch ("per world/tick"), made during implementation. No
in-game time cost is modeled (the book's "1D days" doesn't map onto this
app's tick granularity) — success/fail is immediate. `GET`/`POST
/api/campaigns/:id/find-supplier` + `tick` store's `loadSupplierStatus`/
`attemptFindSupplier` back a new `FindSupplierPanel.vue`, shown in
`MapView.vue`'s Market tab instead of `MarketTable` whenever
`auth.campaign.trade_rules === 'MgT2022'` and the player hasn't yet
succeeded this month; switching worlds resets the local `supplierFound`/
`supplierAttempts` state immediately (before the async status check
resolves) so the previous world's result can't flash while the new one
loads.

**Black-market view scope-down.** Building a full black-market-exclusive
goods view raises the same per-player-vs-shared-world-data tension flagged
for Phase 4, and wasn't resolved during review. Scoped down to implementing
just the underlying primitive — `mgt2022Composition()` already accepts a
`seekingBlackMarket` flag, wired through `isRerollRequired()`/
`resolveGood()` — without building the user-facing route/UI. Follow-up, not
blocking.

### Files changed

`src/lib/traveller-data-mgt2022.js` (tables rewritten), `src/lib/
trade-engine-ct7.js` (`lawFromUWP`, extended `KNOWN_TRADE_CODES`, `rollQty`
DM param), `src/lib/trade-engine-mgt2022.js` (`maxTradeCodeDMs`,
`characteristicDM`, `starportBrokerDM`, `findSupplierRoll`,
`smugglingRiskDM` corrected), `src/lib/market-tick.js` (composition
algorithm, dual-DM roll assembly), `worker/src/routes/ships.js` (buy-cargo
race fix), `worker/src/routes/market.js` (Find-a-Supplier routes),
`worker/src/routes/reports.js` + `referee.js` (characteristics dual-path),
`d1/014_mgt2022_character_ship_fields.sql`, `d1/
015_supplier_search_attempts.sql` (both mirrored into `d1/schema.sql` and
`worker/src/lib/schema-version.js`'s `EXPECTED_MIGRATIONS`), `src/stores/
tick.js` (`loadSupplierStatus`/`attemptFindSupplier`), `src/stores/
referee.js`, `src/components/CharacterDialog.vue` (characteristics form),
`src/components/FindSupplierPanel.vue` (new), `src/views/MapView.vue`
(gating), `src/views/RefereeView.vue` (Armed checkbox), `src/components/
FreightPanel.vue` (flat freight-rate signature).

### Verified

`npx vitest run` — 498/498 passing across 26 files, including a rewritten
`tests/trade-engine-mgt2022.test.js` (54 tests — most fixtures asserted the
*old wrong* values and needed rewriting, not extending), a rewritten
`tests/market-tick.test.js` composition suite (bounds/presence checks
rather than a brittle fixed-length assertion, since row count is now
RNG-dependent), and new `findSupplierRoll` coverage (target, skill/starport
DM stacking, per-attempt penalty).

### Known gaps, not yet addressed

Phases 4-7 (per-player pricing, Steward capacity gate, Freight overhaul,
Mail DMs) are designed in the plan but not started. Migrations `014`/`015`
have **not** been applied to the remote D1 database and the Worker has
**not** been redeployed with any of this rebuild — nothing from Phases 1-3
is live yet, only committed to the working tree. The black-market UI and
the richer legal/licensed/military/black-market drug-channel model are
both deferred, as noted above. Freight's "DMs for both source and
destination world" and Law Level's per-route distance DM are not modeled
(flagged in the plan as a follow-up, not blocking Phase 6).

### Documentation

Scanned all six formal docs (`docs/SRS.md`, `RTM.md`, `HLD.md`, `DD.md`,
`UC.md`, `TEST_PLAN.md`) for staleness against this rebuild and updated
each: corrected requirements/test fixtures that described the *old wrong*
behavior (goods-shown count, freight lot-size pricing, the smuggling-DM
formula, Low-passage flat-fare claim), filled schema-reference gaps (new
`players`/`ships`/`ship_templates`/`obligations` fields, the new
`supplier_search_attempts` table, migration count now 15), added a new
HLD §7a documenting the MgT2022 price/composition pipeline (previously
undocumented — HLD §7 only ever covered CT7), and added new
requirements/use cases/test cases for Find-a-Supplier, MgT2022
characteristics editing, and the buy-cargo concurrency guard. All six
docs' version bumped 0.5.0 → 0.6.0 together, per this project's existing
convention of bumping them as a set.

---

## 2026-07-25 — Per-player trade pricing (Phase 4) + CT7's parallel Broker gap

### Goal

Phase 4 of the MgT2022 rules-accuracy rebuild (plan: `hazy-conjuring-cerf`):
move trade pricing from "one shared number every player at a world/tick
sees" to "reflects the acting player's own Broker skill," per the review's
decision back at the start of this rebuild. Playtesting had originally
flagged this as "player Broker skill doesn't adjust trade rolls."

### Discovery: the mechanism already existed, just wasn't wired up

Designing this phase surfaced that `trade-engine-mgt2022.js`'s
`purchaseRollTotal()`/`saleRollTotal()` **already accept a `brokerSkill`
parameter** (added back in Phase 1, per the book's "3D + Broker skill +
[Purchase/Sale] DM − opposing party's assumed Broker skill (2)" formula) —
`market-tick.js`'s shared snapshot generator was just calling them with
`brokerSkill: 0` by design (no live buyer to ask, for the automatic
per-tick baseline). Phase 4 didn't need to invent the mechanic, only plug
the real acting player's skill into a parameter that was already there.

Tracing this surfaced a **second, independent instance of the identical
gap**: CT7's `trade-engine-ct7.js` has a fully-implemented, unit-tested
`brokerDM(skill)` (added to the Actual Value roll, capped at skill 4) and
`brokerFee(skill, finalPrice)` (5% × skill × transaction value, paid
regardless of profit/loss), bundled together in a `tradeResult()` helper —
all three with zero callers anywhere outside their own tests.
`generateCT7Snapshot()` computed its sale roll with no Broker term at all.
Per RAW (confirmed by `tradeResult()`'s own design), CT7's Broker DM only
ever applies to the **sale** roll, never purchase. Flagged this to the user
alongside a third, smaller finding (below); asked which to bundle into this
phase — approved: fix both, plus the color-coding issue.

### Mechanism: replay the same seeded dice, swap only the skill term

The world-luck dice for a given (world, good, tick) must stay identical for
every player — only the Broker skill term added on top should differ.
Since `makeRng(seed)` is a pure function of its seed string, calling it
fresh and drawing dice in the same order the shared baseline generator
draws them reproduces the exact same roll from anywhere, with nothing
persisted. Added two new **standalone** functions to `market-tick.js`
(`mgt2022PlayerGoodPrice`, `ct7PlayerSalePrice`) rather than refactoring the
existing generators to share code with them — duplicating ~15 lines of
already-correct, already-tested DM/roll logic was judged a smaller, safer
diff than restructuring two working generators; a parity test (brokerSkill
0 must reproduce the shared baseline exactly) locks the two independent
implementations together and would catch any future drift.

Since `buy-cargo`/`sell-cargo` already trust whatever price the client
sends (true for every ruleset since Phase 1), and the client already has
everything needed to recompute a good's price (the world object, the
player's own skill), no schema change and no worker-side price validation
was needed — only a new `tick.js` store computed (`displaySnapshots`)
overlaying `worldSnapshots` with the per-player numbers, read by
`MarketTable.vue` and `CargoHold.vue` instead of the raw snapshot. A new
`tick.brokerSkill` + `loadBrokerSkill()` (fetched via the existing
self-service `GET /api/reports/skills`) also **replaced**
`FindSupplierPanel.vue`'s own independent copy of the same fetch — one
source of truth for "the current player's Broker level" instead of two.

CT7's Broker **fee** (the commission, distinct from the DM) is a lump
deduction at the moment of sale, not a per-ton price adjustment — mirrors
the existing freight late-delivery-penalty precedent (a separate clawback
transaction, not baked into a rate). `ship.js`'s `sellCargo()` computes it
client-side and sends `broker_fee_total`; `worker/src/routes/ships.js`'s
`/sell-cargo` nets it out of the credited amount and records it as its own
`'fee'`-type transaction (the generic type `src/lib/reports.js`'s
`TYPE_LABEL`/`EXPENSE_TYPES` already renders and totals — deliberately not
a new unmapped `'broker_fee'` type, which would silently fall through those
the way `freight_penalty` already does today).

### Bundled fix: MgT2022's price-color-coding used CT7's reference base

`MarketTable.vue`'s "below/above base price" cell coloring compared every
ruleset's price against a hardcoded `4000`/`5000` — exactly correct for
CT7 (they're literally `costOfGoods()`/`marketBasePrice()`'s own starting
constants) but meaningless for MgT2022, whose per-good `basePriceCr` ranges
20,000–150,000+. Fixed by building a `die → basePriceCr` lookup from
`MGT2022_TRADE_GOODS` (mirrors the file's existing `goodNameMap` pattern)
and using each good's own base price as the reference for MgT2022 rows;
CT7/T5 unchanged.

### Explicitly out of scope

- **T5**'s own already-unwired `t5BrokerFee` — the approved scope was CT7's
  gap specifically, not T5's. Logged as a further follow-up.
- Price/OHLC **charts** intentionally keep showing the shared baseline
  (`brokerSkill = 0`) — an impartial market-index line, not any one
  player's negotiated price; a chart that moved depending on who's looking
  wouldn't be a sensible "history."
- `CargoHold.vue`'s live profit-per-ton/hold-value estimates stay pre-fee
  for CT7 — a close approximation shown before committing to a sale; the
  fee-inclusive true figure surfaces in the post-sale flash (already
  displays the server's `net_profit`) and in Reports, with no new UI added.
- No automated worker-route test for the `sell-cargo` fee change — this
  repo's Vitest suite covers pure functions and components; route-level
  behavior needs a live `wrangler dev` + local D1, consistent with how
  Phase 1's buy-cargo fix and Phase 3's Find-a-Supplier routes were also
  verified manually rather than via an automated integration test.

### Files changed

`src/lib/market-tick.js` (`mgt2022PlayerGoodPrice`, `ct7PlayerSalePrice`),
`src/stores/tick.js` (`brokerSkill`, `loadBrokerSkill`, `snapshotWorld`/
`snapshotSector`, `displaySnapshots`), `src/stores/ship.js` (`sellCargo`'s
`brokerSkill`/fee param), `worker/src/routes/ships.js` (`/sell-cargo`'s
`broker_fee_total` handling), `src/components/MarketTable.vue`
(`displaySnapshots` read site, `purchaseInfo`/`saleInfo` reference-base
fix), `src/components/CargoHold.vue` (`displaySnapshots` read site,
`brokerSkill` passthrough), `src/components/FindSupplierPanel.vue`
(dropped its own skill fetch in favor of the store's), `src/views/
MapView.vue` (`loadBrokerSkill()` call in the world-selection watcher).

### Verified

`npx vitest run` — 506/506 passing (up from 498; 8 new cases in
`tests/market-tick.test.js` covering both new functions' parity with their
respective shared baselines, skill-direction correctness, the `brokerDM`
cap flowing through, and unknown-`goodDie` handling). `npx vite build`
compiles cleanly.

### Known gap, not addressed this session

Migrations 014/015 (from Phases 2-3) are still not applied to the remote D1
database and the Worker still hasn't been redeployed with any of this
rebuild — Phase 4 adds no new migration, but nothing from Phases 1-4 is
live yet, only committed to the working tree.

*(Update, same day: the user asked for this to be committed and deployed.
Migrations 014/015 were applied to the remote D1 database and the Worker
was redeployed via `make deploy` — `/api/health` confirmed `schema_ok: true`
with all 15 migrations present. Phases 1-4 are live as of this point.)*

---

## 2026-07-26 — Traffic Availability rebuild: Passengers + Freight + Mail (Phase 5)

### Goal

Continue the MgT2022 rebuild into what the plan had called Phase 5
("Passenger Steward capacity gate"). That plan entry turned out to be
based on a misremembered rule from earlier in this conversation, before it
was compacted — there is no "Steward caps how many passengers a ship can
carry" mechanic in the book. The user pasted the actual rulebook text
("SEEKING PASSENGERS", "FREIGHT", "MAIL") mid-session, which revealed the
real mechanic: Steward, Broker, Carouse, and Streetwise all feed DMs into
the **Traffic Availability** roll — how many passengers/cargo-lots/mail-
containers exist to be booked at a world this tick — which is the same
mechanic the plan's Phase 6/7 already targeted for Freight/Mail, just with
several DM values that turned out to be wrong once checked against the
real text. Re-planned and executed all three (Passengers/Freight/Mail)
together as one unified "Phase 5" rather than three separate passes, since
they share one generation function and were about to gain the same kind
of crew-skill inputs.

### What the real text changed

The already-coded `MGT2022_POPULATION_TRAFFIC_DM` (`Pop6-7:+2, Pop8+:+4`)
and `zoneTrafficDM()` (`Amber:-2, Red:-6`) turned out to be **correct for
Freight** but **wrong for Passengers**, which has its own, less punishing
table (`Pop6-7:+1, Pop8+:+3`; `Amber:+1, Red:-4` — Amber is actually a
*bonus* for passenger traffic, a *penalty* for freight). Renamed to
`MGT2022_FREIGHT_POPULATION_TRAFFIC_DM`/`freightZoneTrafficDM()` and added
the Passenger-specific versions alongside. Also discovered the Passenger
and Freight Traffic *dice-count* tables (2D+DM → "roll N dice for the
count") genuinely diverge at rolls 6, 9, 10, 12, 13, and 15 — not the same
table reused, as the existing (unused) `freightTrafficDiceCount` might have
suggested; added `passengerTrafficDiceCount` as its own table. Confirmed
`freightTrafficDiceCount` itself, `techLevelTrafficDM`, the Mail DM-banding
table, and Mail's own availability/payment constants were all already
correct from earlier work — Phase 5 was mostly about *wiring these in* and
*not* reusing them for the wrong traffic type.

### Design decisions made with the user during planning

- The Broker/Carouse/Streetwise check's Effect (2D+skill−8, can be
  negative) is a **shared, automatic DM** — computed once per (ship,
  world, tick) using whichever crew member has the single highest relevant
  skill, folded into the same deterministic generation. Not a per-player
  live overlay (unlike Phase 4's pricing) and not a manual one-click action
  (unlike Find a Supplier) — the user's own suggestion, which resolved an
  open question about "whose check" cleanly: check everyone aboard
  automatically and take the best, mirroring how Steward's DM ("highest
  Steward skill on ship") already worked with no check at all.
- Because these DMs depend on *this ship's* own crew, traffic availability
  became a function of **(ship, world, tick)**, not just (world, tick) —
  confirmed explicitly with the user before touching schema, since it's a
  real, if narrow, architectural change: two different ships docked at the
  same world can now get different numbers.
- Destination-world DMs and the "past first parsec" distance DM remain
  deferred, extending the plan's original decision for Freight to
  Passengers too — no destination is known at traffic-generation time.
- The known `ship.js` `stateroomsUsed` bug (Basic Passage double-counted
  against staterooms) surfaced again while touching this area; confirmed
  with the user it stays a separate, already-logged follow-up.

### A real bug this session's own test suite caught

Initially wrote `generateTrafficSnapshot` with **one shared RNG stream**
for Passengers, Freight, and Mail in sequence (mirroring the old code's
structure). A new test asserting "Steward only affects Passengers, never
Freight" failed: since each tier's dice-*count* is data-dependent (a DM of
+2 might sum 3 dice, +4 might sum 5), changing an input that only logically
affects Passengers still shifted *how many dice got drawn* during the
Passenger phase — which shifted the RNG's position for every draw after
it, contaminating Freight's results despite no rule connecting the two.
Fixed by giving Passengers, Freight, and Mail **separate seeded RNG
streams** (`...traffic:passenger:...`, `...traffic:freight:...`,
`...traffic:mail:...`) — the identical fix already applied to goods
composition vs. price rolls back in Phase 3, for the identical reason.
Caught by the test before shipping, not by inspection — a good reminder
that "shared stream, variable draw count" is a recurring trap in this
codebase's style of seeded generation, worth checking for explicitly
whenever a new variable-length draw is added anywhere near an existing one.

### Schema migration `016` — `traffic_snapshots` becomes per-ship

Dropped and recreated `traffic_snapshots` with a `ship_id` column added to
the row and its `UNIQUE` constraint (SQLite can't `ALTER` a `UNIQUE`
constraint in place). Safe to drop: this table is pure deterministic cache
data, regenerable from its inputs, never referenced by any other table —
booked obligations live in `obligations`, untouched. **Not yet applied to
the remote database** — flagged for explicit go-ahead at deploy time, same
as any migration, but worth calling out again here since `DROP TABLE` is
irreversible against a live database.

### Crew-derived inputs

`worker/src/routes/ships.js`'s ship-loading route gained five new aggregate
queries (`MAX(level)`/`MAX(rank)`/`MAX(social_standing)` joins over `crew`
+ `player_skills`/`players`), mirroring the existing `crew_staterooms`
`COUNT(*)` query's shape exactly. Also fixed a real, unrelated gap found
while reading this route: `ships.armed` (added back in Phase 2) was never
actually selected or returned by it — needed now for Mail's "ship is
armed" DM, but it was a pre-existing hole regardless.

### Other changes

- **Freight lot tonnage is now rolled, not typed.** `FreightPanel.vue`'s
  free-typed tons stepper is gone — a lot's tonnage (Major 1D×10, Minor
  1D×5, Incidental 1D) is now a seeded roll (`...freight-lot:${lotSize}:...`),
  fixed and non-editable once a lot size is picked, matching "a freight lot
  cannot be broken up." Reused the existing `MGT2022_FREIGHT_LOT_SIZE_DICE`
  constant and `trade-engine-ct7.js`'s `rollQty`, both already correct from
  earlier work and simply never wired in here.
- **`POST /:id/book-passengers` gained its first server-side validation
  ever** — stateroom (high+middle), low-berth (low), cargo tons (basic,
  MgT2022), and the traffic-availability cap for the requested tier.
  Previously this route validated nothing, not even the pre-existing
  stateroom/low-berth caps the client already enforced client-side. The
  cargo-tons check needed `MGT2022_BASIC_PASSAGE_TONS`, a small MgT2022
  domain constant — hardcoded directly in the worker rather than imported,
  consistent with this file's existing precedent (the late-delivery-penalty
  formula above it does the same) that the worker package never shares code
  with the frontend bundle.
- `book-freight`/`accept-mail` have the identical missing-validation gap,
  logged as a further follow-up rather than fixed here (matches the scope
  the user actually asked for).

### Verified

`npx vitest run` — 516/516 passing (up from 506; 17 in a substantially
rewritten `tests/traffic-tick.test.js`, covering the dice-table divergence,
the Passenger/Freight DM tables, the RNG-isolation fix above, and each
crew-derived DM's directional effect). `npx vite build` compiles cleanly
(confirms the new `tick.js` ⇄ `ship.js` mutual import — mirroring `ship.js`'s
pre-existing reverse import of `useTickStore` — resolves fine, since both
only call `useOtherStore()` lazily inside their own `defineStore` body).

### Known gaps, not addressed this session

Migration `016` is committed but **not yet applied** to remote D1, and the
Worker hasn't been redeployed with any of this phase — nothing from Phase 5
is live yet. `book-freight`/`accept-mail`'s missing server-side validation,
`ship.js`'s stateroom double-counting bug, and mail's cargo-space
reservation gap (from Phase 2/7) all remain separate, already-logged
follow-ups.

*(Update, same day: committed, pushed, and deployed via `make deploy`.
`migrate` initially failed on a transient hiccup — `wrangler d1 execute
--json`'s output didn't parse cleanly on the first attempt, so the status
check misread the ledger as empty and tried re-applying already-applied
migrations from `002` onward; `002` happened to be idempotent and no-op'd,
but `003`'s `ALTER TABLE ADD COLUMN` isn't, and failed outright with
`duplicate column name`, aborting before any real damage. Verified via
direct queries that the remote ledger and schema were both untouched and
correct (001-015 intact, no duplicate/partial columns) before retrying;
the retry applied `016` cleanly with no recurrence. `/api/health` confirms
`schema_ok: true` with `001`-`016` all present.)*

---

## 2026-07-26 — Mail cargo-space reservation (Phase 5 follow-up)

### Goal

First of the three follow-ups logged at the end of Phase 5's entry above:
`obligations.mail_containers` (added back in Phase 2) was never actually
populated by `POST /:id/accept-mail`, so accepted MgT2022 mail contracts
consumed no tracked cargo space at all — a ship could accept unlimited
mail regardless of how full its hold already was.

### Fix

Mirrors Basic Passage's existing pattern exactly (`ship.js`'s
`basicPassageTonsUsed`): `MailPanel.vue` now computes `mailTonsNeeded`
(rolled container count × `MGT2022_MAIL_CONTAINER_TONS`, MgT2022 only),
gates acceptance on `ship.cargoAvailable` covering it, and passes the
container count through `ship.acceptMailContract`'s new `mailContainers`
param. `worker/src/routes/ships.js`'s `/accept-mail` now stores it in
`obligations.mail_containers` (column already existed, just never
written) and `MAIL_SELECT` now returns it. `ship.js` gained a
`mailContainerTonsUsed` computed, folded into `cargoAvailable` alongside
`basicPassageTonsUsed` — releases automatically on delivery, since
delivery already filters the fulfilled contract out of `mailContracts`.

Deliberately did **not** add server-side validation to `/accept-mail`
(mirroring `book-passengers`'s new check) — that's a separate, still-open
follow-up the user chose not to bundle into this pass; this fix is scoped
to making the reservation actually happen, client-side, matching what was
asked.

While back in `DD.md` for this, fixed three more stale "not yet wired —
Phase 7" notes (`players.social_standing`, `players.background`,
`ships.armed`) that Phase 5 itself had already wired in but the doc pass
at the time missed updating.

### Verified

`npx vitest run` — 516/516 (no new dedicated tests — this codebase has no
existing direct unit tests for `ship.js`'s computed properties at all, not
even `basicPassageTonsUsed`, so adding one just for this would be
inconsistent with the established boundary; covered instead by existing
component/manual-test conventions). `npx vite build` compiles cleanly.

### Known gaps, still open

`book-freight`/`accept-mail` still have no server-side capacity
validation, and `ship.js`'s stateroom double-counting bug (Basic Passage
wrongly counted against staterooms) remains — both explicitly deferred
by the user's own choice this pass, not overlooked.

---

## 2026-07-26 — Phase 5 follow-ups completed: stateroom bug, book-freight/accept-mail validation, traffic depletion

### Goal

Close out the two follow-ups left open at the end of the previous "Mail
cargo-space reservation" entry, plus a third gap noticed alongside them:
Traffic Availability counts never actually went *down* as bookings were
made, so the same rolled passengers/freight lots/mail containers could be
booked repeatedly within one tick.

### Fixes

- **`ship.js`'s `stateroomsUsed`** filtered `p.passage_type !== 'low'`,
  which wrongly counted Basic Passage against stateroom capacity (Basic
  Passage occupies cargo tons, not a stateroom, per RAW). Now filters
  `passage_type === 'high' || passage_type === 'middle'` — the only two
  tiers that actually use one.
- **`book-freight`/`accept-mail` gained the same server-side validation
  `book-passengers` already had** (Phase 5): cargo-space checks against
  `ship.js`'s `cargoAvailable`. Building this surfaced a real, previously
  unknown bug — booked-but-undelivered freight tonnage and accepted mail
  containers were never subtracted from `cargoAvailable` at all, so a ship
  could over-commit its hold indefinitely. Fixed by adding a
  `freightTonsUsed` computed (mirroring the existing `mailContainerTonsUsed`
  pattern) and folding both into `cargoAvailable`.
- **Traffic availability now depletes as bookings happen.** All three
  booking routes (`book-passengers`, `book-freight`, `accept-mail`) run an
  atomic guarded-decrement against `traffic_snapshots`
  (`UPDATE ... SET x = x - ? WHERE ... AND x >= ?`, checked via
  `meta.changes`) — the same pattern already established for `buy-cargo`'s
  `qty_available` guard — so two concurrent bookings racing for the last
  seat/lot/container can't both win, and the number shown to players
  actually goes down tick over tick.

### Verified

`npx vitest run` — all passing. `npx vite build` compiles cleanly.

### Known gaps, not addressed this session

Destination-world traffic DMs and Black Market remained deferred — see the
next entry, where both were taken up as "Phase 6."

---

## 2026-07-26 — Destination-aware Traffic + Black Market (Phase 6)

### Goal

Two items logged as "deferred" at the end of Phase 5 turned out, on
discussion with the user, to warrant real implementation:

- **Destination-world traffic DMs.** RAW applies population/starport DMs
  from *both* the origin and destination world to the Passenger/Freight
  Traffic rolls, plus a distance penalty ("each parsec of destination past
  the first: DM−1"). Phase 5 rolled availability once per (ship, origin
  world, tick), before any destination was known — a simplification, not
  RAW. The user's explicit call: conform to the rules even though it means
  a real UX change (destination must be picked before availability can be
  shown, since the true count is inherently per-*route*, not per-origin-
  world) — and flagged that CT7/T5 likely have the same kind of unmodeled
  mechanic, to be checked in an upcoming CT7/T5 pass, not this one.
- **Black Market.** `isRerollRequired()`/`resolveGood()` already supported
  a `seekingBlackMarket` flag but nothing ever set it. Per the user's
  choice, black-market access works like Find a Supplier's one-click
  check, but **ship-wide** rather than per-player — whichever crew member
  has the highest Streetwise skill is used automatically, and success
  unlocks the black-market view for the whole ship's crew for the rest of
  the game-month.

### Part A — Destination-aware Traffic Availability

`traffic_snapshots` became keyed by (ship, **origin**, **destination**,
tick) instead of just (ship, origin, tick) — migration `017` drops and
recreates the table (safe: pure deterministic cache data, never referenced
by another table) with `dest_world_hex`/`dest_sector` added to the row and
the `UNIQUE` constraint.

`traffic-tick.js`'s `generateTrafficSnapshot` now takes `destWorld` and
`parsecs`. New DM terms, additive to Phase 5's: Passenger and Freight both
gain the destination's population/starport DM (mirroring the origin's) and
a `distanceDM = -(parsecs - 1)` term. Freight's TL/Zone DMs stay
origin-only, per the book's bullet structure. Mail needed no direct
change — it already reuses Freight's un-tiered `baseDM + checkEffect`,
which is now itself route-aware. The seed gained the destination hex
(`${origin}:${dest}:${shipId}:traffic:...`) so two different destinations
from the same origin/tick produce independent rolls.

Since there's no meaningful "how many passengers are waiting, independent
of where they're going" number under this model, `ensureTrafficSnapshot`
is no longer called ambiently on world visit — `PassengersPanel.vue`,
`FreightPanel.vue`, and `MailPanel.vue` (MgT2022 only; CT7/T5 keep today's
order and behavior unchanged) now show the Destination World picker first,
gate the rest of the form behind having picked one, resolve the
destination's full world object via `map.fetchWorldsForSector()`, and roll
traffic fresh whenever the destination or parsecs changes. Cross-sector
manual-entry destinations inherit `hexDistance()`'s existing sector-relative
limitation (T5 fares already have this same gap) — not introduced or fixed
here.

Worker: `market.js`'s traffic `GET`/`POST` routes and all three booking
routes' guarded-decrement UPDATE + fallback re-query gained
`dest_world_hex`/`dest_sector` in their `WHERE` clauses, alongside the
existing `ship_id`.

### Part B — Black Market

Migration `018`: a new `black_market_search_attempts` table (mirrors
`supplier_search_attempts` exactly, keyed by `ship_id` instead of
`player_id` — a separate table rather than a `kind` column, since the two
have genuinely different keys, not just a different value of the same
shape) plus an `is_black_market` column on `market_snapshots` (added via
the safer create-new-table/copy-rows/rename pattern, since — unlike
`traffic_snapshots` — this table holds real price history read by charts,
so a destructive drop was off the table).

`worker/src/routes/ships.js`'s ship-load route gained a
`crew_streetwise_max` aggregate (Streetwise alone, not pooled with
Broker/Carouse — black market specifically wants it). The new
`GET`/`POST /:id/black-market` routes mirror `find-supplier`'s
Average(8+)-target check exactly, except the server looks up
`crew_streetwise_max` itself rather than trusting a client-supplied skill
level (find-supplier's original per-player design trusts the client
because a specific player is making the attempt; black market is
ship-wide, so there's no single player's skill to trust).

**Composition mechanic.** Initially wired `seekingBlackMarket` to simply
disable the existing 61-65 reroll-avoidance on an otherwise-normal D66
roll — which would only let illegal goods survive by chance, not
specifically deal in them. Corrected to a dedicated roll instead: each of
a black-market world's population-code extra draws rolls 1D and prepends
a forced `'6'` leading digit (`rollBlackMarketDie`), always landing in
61-66 — landing on 66 (Exotics) is simply skipped, the same as the normal
path's existing "die not in table" guard. `generateWorldSnapshot`'s
dispatcher now forwards a `seekingBlackMarket` flag through to the
MgT2022 generator, which gives black-market composition its own
`:composition:blackmarket:` seed segment so it doesn't collide with the
normal listing for the same world/tick.

Goods pricing itself stays world/tick-scoped, not ship-scoped — a second,
parallel row set per (world, tick) with `is_black_market = 1`, generated
lazily via `tick.ensureBlackMarketSnapshot()` the same way normal
snapshots are. `tick.js` gained a `displayBlackMarketSnapshots` computed,
mirroring Phase 4's per-player `displaySnapshots` overlay but sourced from
the black-market row set.

**UI**: `MarketTable.vue` gained a "Seek Black Market"/"Black Market"
toggle in its controls row (MgT2022 only) — before success, a one-click
check button with an attempts-so-far hint (mirrors `FindSupplierPanel.vue`);
after success, a toggle that switches the table between
`displaySnapshots` and `displayBlackMarketSnapshots`. `MapView.vue`'s
world-change watcher resets and reloads `blackMarketFound`/
`blackMarketAttempts` alongside the existing supplier-status reset.

### Tests

`tests/traffic-tick.test.js`: new cases for route-awareness (same
origin/tick, different destinations → independent results), destination
population/starport DMs increasing traffic on average, and the per-parsec
distance penalty reducing it on average (parsecs 1 vs. 6). 21/21 passing
(up from 17).

`tests/market-tick.test.js`: new cases confirming black-market composition
surfaces illegal-band goods (die 61-65) across many ticks on a
no-trade-codes world (isolating the black-market roll from the guaranteed
baseline, which can otherwise legitimately include illegal goods whose own
availability happens to match the world's codes), that the normal market
never does on the same world, that Exotics (66) never surfaces even when
seeking, and that the black-market composition seed is deterministic and
independent from the normal one. 47/47 passing (up from 43).

### Verified

`npx vitest run` — 524/524 passing. `npx vite build` compiles cleanly.
Manual pass not yet done in a running `wrangler dev` session — same
established precedent as Phase 3's Find-a-Supplier routes (worker-route
behavior needs live D1, not covered by this repo's Vitest suite).

### Known gaps, not addressed this session

The user's own flagged hypothesis — that CT7/T5 likely have similar
unmodeled destination-dependent traffic/availability mechanics — has not
been researched or scoped; next up now that this phase is deployed. The
richer legal/licensed-medical/military/black-market-channel drug economy
model remains deferred, per the user's explicit choice.

*(Update, same day: committed, pushed, and deployed via `make deploy`.
Migrations `017`/`018` applied cleanly to remote D1 on the first attempt —
no repeat of the earlier transient `jq`-parsing hiccup. `/api/health`
confirms `schema_ok: true` with `001`-`018` all present.)*

---

## Documentation TODO

A set of design and requirements documents needs to be produced before the project reaches a stable release. These do not need to be written immediately but should be addressed before public release.

Suggested documents:

| Document | Purpose |
|---|---|
| **Product Requirements Document (PRD)** | Goals, scope, non-goals, success criteria, non-commercial constraint |
| **Architecture Overview** | Component map, data flow, D1 schema diagram, state management |
| **Data Dictionary** | All D1 tables/views, columns, Worker route signatures |
| **Trade Rules Reference** | CT Book 2 and CT Book 7 mechanics implemented; deviation notes |
| **Market Events Catalogue** | Full event table with severity tiers, effect ranges, trigger conditions |
| **Theme Specification** | CSS token set, WCAG contrast ratios per theme, user theme format (JSON schema) |
| **Accessibility Checklist** | WCAG 2.2 AA criteria mapped to implementation; known gaps |
| **Deployment Runbook** | GitHub Pages + Cloudflare Workers deploy process, D1 migration order, env var requirements |
