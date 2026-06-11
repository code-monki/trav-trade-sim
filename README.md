# Traveller Trade Simulator

A Morningstar-style speculative trade dashboard for Classic Traveller, built on live data from the [Traveller Map API](https://travellermap.com).

## Features

- **Sector & world browser** — browse all sectors across multiple milieus (1105 Classic Era through Year 1900)
- **Speculative trade engine** — Classic Traveller Book 7 rules (Book 2 goods table included); pluggable engine architecture for future editions (TNE, T4, etc.)
- **Price history charts** — candlestick charts per world/trade-good using weekly snapshots with monthly and annual OHLC rollups
- **Campaign management** — multi-player campaigns identified by a short campaign code + mandatory PIN (no email, no PII stored)
- **Market events** — M.U.L.E.-style local and subsector events that affect pricing
- **Imperial Calendar** — DDD-YYYY format; 1 tick = 1 jump-week

## License & Copyright Notice

The **application code** in this repository is licensed under the [Apache License 2.0](LICENSE.md).

The **Traveller game rules and trade mechanics** implemented here are based on Classic Traveller Books 2 and 7, copyright © Game Designers' Workshop / Far Future Enterprises. Used with permission from Marc Miller for non-commercial purposes only.

**This application must remain non-commercial.** Do not use it as part of any paid product or service.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 (Composition API + SFC), Pinia, Vue Router |
| Build | Vite |
| Database | Supabase (PostgreSQL + RLS) |
| Charts | lightweight-charts (TradingView OSS) |
| Hosting | GitHub Pages (via GitHub Actions) |

## Setup

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier is sufficient)

### Local development

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in your Supabase credentials
cp .env.example .env
# Edit .env with your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Run the schema
# Paste supabase/migrations/001_schema.sql into the Supabase SQL Editor and run it.

# 4. Start dev server
npm run dev
```

### GitHub Pages deployment

Push to `main`. The [GitHub Actions workflow](.github/workflows/deploy.yml) builds and deploys automatically.

Add these repository secrets before the first deploy:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Project Structure

```
src/
  lib/
    supabase.js          # Supabase client
    traveller-data.js    # CT lookup tables, Book 2 goods, Book 7 price tables
    traveller-helpers.js # UWP decode, sector parsing, route parsing
    trade-engine-ct7.js  # CT Book 7 trade rules (pure functions)
  stores/
    map.js               # Pinia store — sector/world browser state
  assets/
    style.css            # Dark space theme
  App.vue
  main.js
supabase/
  migrations/
    001_schema.sql       # Full database schema with RLS
```
