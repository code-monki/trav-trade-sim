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
