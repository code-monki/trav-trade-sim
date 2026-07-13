# Traveller Trade Simulator

A Morningstar-style speculative trade dashboard for Classic Traveller, built on live data from the [Traveller Map API](https://travellermap.com).

## Features

- **Sector & world browser** — browse all sectors across multiple milieus (1105 Classic Era through Year 1900)
- **Speculative trade engine** — Classic Traveller Book 7 and T5 rules; buy/sell cargo with deterministic pricing driven by world trade codes
- **Passengers** — book High, Middle, and Low passage with automatic fare collection; manifests auto-deliver on arrival; referee can issue refunds
- **Fuel purchasing** — refined/unrefined fuel priced by starport class with tank capacity tracking; fill-level bar and "Fill for jump" shortcut
- **Mail contracts** — accept Imperial mail contracts for on-delivery payment (CT7 flat; T5 per-parsec)
- **Price history charts** — candlestick charts with Weekly, Monthly, Annual, and Realized (actual trade prices) time frames
- **Campaign management** — multi-player campaigns with a short campaign code + mandatory PIN (no email, no PII stored)
- **Market events** — M.U.L.E.-style local and subsector events with independent buy/sell modifiers; 20-entry referee catalogue
- **Imperial Calendar** — DDD-YYYY format; 1 tick = 1 jump-week; auto-delivery of passengers and mail on ship arrival

## License & Copyright Notice

The **application code** in this repository is licensed under the [Apache License 2.0](LICENSE.md).

The **Traveller game rules and trade mechanics** implemented here are based on Classic Traveller Books 2 and 7, copyright © Game Designers' Workshop / Far Future Enterprises. Used with permission from Marc Miller for non-commercial purposes only.

**This application must remain non-commercial.** Do not use it as part of any paid product or service.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 (Composition API + SFC), Pinia, Vue Router |
| Build | Vite |
| API | Cloudflare Workers (Hono v4) |
| Database | Cloudflare D1 (SQLite at the edge) |
| Charts | lightweight-charts (TradingView OSS) |
| Hosting | GitHub Pages (frontend) + Cloudflare Workers (API) |

## Setup

### Prerequisites

- Node.js 20+
- A [Cloudflare](https://cloudflare.com) account (free tier is sufficient)
- Wrangler CLI: `npm install -g wrangler`

### Local development

Two terminals are required — one for the Worker API, one for the Vite dev server.

```bash
# Terminal 1 — API (uses the remote D1 database)
cd worker
npx wrangler dev --remote

# Terminal 2 — frontend
npm install
npm run dev
```

The frontend `.env` file points `VITE_API_URL` at `http://localhost:8787` by default.

### Deploy

```bash
# Deploy Worker
cd worker && npx wrangler deploy

# Deploy frontend (or push to master — GitHub Actions handles it)
npm run build
```

Add `VITE_API_URL=https://<your-worker>.workers.dev` as a GitHub Actions repository secret before deploying the frontend.

## Project Structure

```
src/
  lib/
    api.js               # HTTP client (replaces @supabase/supabase-js)
    traveller-data.js    # CT lookup tables, Book 2 goods, Book 7 price tables
    traveller-helpers.js # UWP decode, sector parsing, route parsing
    trade-engine-ct7.js  # CT Book 7 trade rules (pure functions)
  stores/
    map.js               # Pinia store — sector/world browser state
  assets/
    style.css            # Dark space theme
  App.vue
  main.js
worker/
  src/
    index.js             # Hono app entry point + CORS
    routes/              # campaigns, ships, market, referee, auth, reports
    middleware/auth.js   # Bearer token validation
    lib/hash.js          # PBKDF2 PIN hashing (Web Crypto API)
  wrangler.toml
d1/
  schema.sql             # Full D1 (SQLite) schema
  002_sessions.sql       # Sessions table migration
  003_crew_stateroom.sql # has_stateroom column on crew
  004_obligations.sql    # Unifies mail_contracts + passenger_manifests into obligations
  005_ship_templates.sql # ship_templates table + ships.market_value
  006_ship_debts.sql     # ship_debts + debt_payments tables
  007_ownership.sql      # ship_ownership + organizations + organization_members tables
  008_org_officers.sql   # organization_officers table (multi-officer authorization)
  009_org_financials.sql # dues, disbursement, organization_ownership (Corp/Fleet Phase 2)
  010_mgt2022_trade_rules.sql # MgT2022 ruleset (Basic Passage, Freight, traffic_snapshots)
  011_schema_ledger.sql  # schema_migrations ledger — powers GET /api/health drift detection
```
