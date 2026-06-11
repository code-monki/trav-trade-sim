# AGENTS.md — Traveller Map Explorer

## Project Summary
A static Vue 3 single-page application for browsing Traveller Map sector and world data.
No build step required — open `index.html` directly in a browser or serve with any static file server.

## Architecture
- **index.html** — App shell, Vue 3 via CDN (`https://unpkg.com/vue@3`)
- **app.js** — Vue Composition API logic: API calls, data parsing, computed state
- **style.css** — Dark space-themed UI

## Data Flow
```
/api/universe?milieu=M1105
  → sectors[] = [{ name, abbreviation, x, y, tags }]

/api/sec?sector=NAME&type=TabDelimited&milieu=M1105
  → worlds[] = [{ Hex, Name, UWP, Bases, Remarks, Zone, PBG, Allegiance, Stars, ... }]
  (headers parsed dynamically from first line of response)
```

## API Endpoints Used
| Endpoint | Purpose |
|---|---|
| `GET /api/universe?milieu=M1105` | List all sectors with coordinates |
| `GET /api/sec?sector=NAME&type=TabDelimited&milieu=M1105` | World data for a sector (tab-delimited) |
| `GET /api/metadata?sector=NAME&milieu=M1105` | Sector metadata XML (routes, borders) |

Both `sec` and `metadata` are fetched in parallel on sector change.

All requests target `https://travellermap.com`. CORS is supported by the server.

## Key Files
| File | Responsibility |
|---|---|
| `app.js` — `FIELD_LABELS` | Human-readable names for data field keys |
| `app.js` — `UWP_*` tables | UWP digit/letter → description lookups |
| `app.js` — `BASE_CODES` | Base code letter → full name |
| `app.js` — `TRAVEL_ZONE` | Zone code → travel restriction label |
| `app.js` — `decodeUWP()` | Splits and decodes a UWP string into labeled rows |
| `app.js` — `parseTabDelimited()` | Parses the API's tab-delimited text into an object array |
| `app.js` — `parseSectorRoutes()` | Parses `<Routes><Route .../>` XML into plain objects |
| `app.js` — `routesByHex` | Computed Map of hex → enriched route array for that world |
| `app.js` — `selectedWorldRoutes` | Routes for the currently selected world |

## Extending
- **Add more milieus**: change `milieu=M1105` to another value (M0, M990, etc.)
- **Add world detail API**: wire up `/api/credits?sector=NAME&hex=HEX` for source attribution
- **Add jump map**: use `/api/jumpworlds` for nearby-world queries
- **Persist data**: export `worlds.value` or `selectedWorld.value` as JSON from the browser console

## Running
```sh
# Simple local server (Python)
python3 -m http.server 8080

# Or with Node
npx serve .
```
Then open `http://localhost:8080`.
