# Developer Log — Traveller Map Explorer

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
