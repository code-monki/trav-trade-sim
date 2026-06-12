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

## Documentation TODO

A set of design and requirements documents needs to be produced before the project reaches a stable release. These do not need to be written immediately but should be addressed before public release.

Suggested documents:

| Document | Purpose |
|---|---|
| **Product Requirements Document (PRD)** | Goals, scope, non-goals, success criteria, non-commercial constraint |
| **Architecture Overview** | Component map, data flow, Supabase schema diagram, state management |
| **Data Dictionary** | All Supabase tables/views, columns, RLS policies, function signatures |
| **Trade Rules Reference** | CT Book 2 and CT Book 7 mechanics implemented; deviation notes |
| **Market Events Catalogue** | Full event table with severity tiers, effect ranges, trigger conditions |
| **Theme Specification** | CSS token set, WCAG contrast ratios per theme, user theme format (JSON schema) |
| **Accessibility Checklist** | WCAG 2.2 AA criteria mapped to implementation; known gaps |
| **Deployment Runbook** | GitHub Pages deploy process, Supabase migration order, env var requirements |
