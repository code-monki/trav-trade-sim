# AGENTS.md — Traveller Trade Simulator

Use this file as the restart primer when beginning a new conversation on this project.

---

## Project Summary

A Vite + Vue 3 single-page application for running speculative trade in Classic Traveller campaigns.
The Referee advances an in-game clock; commodity prices shift deterministically each tick based on
world trade codes, market events, and seeded RNG. Players identify profitable routes and track
price history across the Third Imperium.

**Hosted on GitHub Pages. Non-commercial use only — Mongoose Publishing fan-site policy.**

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 Composition API + SFC, Pinia, Vue Router (hash mode) |
| Build | Vite; `src/` tree; `index.html` at root |
| Database | Supabase (PostgreSQL + RLS + pgcrypto) |
| Auth | Custom PIN-based auth via Supabase RPC (bcrypt, no email/PII) |
| Charting | `lightweight-charts` v4 (TradingView OSS) — canvas-based, theme via `applyOptions()` |
| Theming | CSS custom properties on `:root`; IndexedDB for user themes; 3 built-in themes |
| Static world data | TravellerMap public API (`https://travellermap.com/doc/api`) |

---

## Security constraints (MUST be preserved)

- PIN is **mandatory** — no optional skip
- PIN stored as bcrypt hash via pgcrypto, never reversible, never logged
- Rate limit: 5 failed attempts → 15-minute lock (enforced in `verify_pin` RPC)
- Supabase `anon`/publishable key is safe to expose in the client bundle (RLS enforces security)
- Service role key must **NEVER** be committed to the repo or included in the bundle
- No email or PII stored — identity is `(campaign_id, character_name, hashed_PIN)` only

---

## Source tree

```
src/
  assets/
    style.css               Global CSS custom properties, focus indicators
  components/
    AboutDialog.vue         Mongoose disclaimer + version + GitHub link
    EventsHistory.vue       Event history list with severity filters
    HamburgerMenu.vue       Three-bar menu → Themes / About / Help / Sign Out
    HelpDialog.vue          User Manual + Keyboard Shortcuts (two tabs)
    MarketTable.vue         36-row trade goods table with sort, filter, event flags
    PriceChart.vue          lightweight-charts price chart (Weekly/Monthly/Annual tabs)
                            All colours read from CSS vars via cssVar(); re-themed on
                            themeStore.revision watch (covers both init() and setTheme())
    ThemeDialog.vue         Theme list, per-token colour editor, export/import JSON
  composables/
    useFocusTrap.js         Tab-trap composable used by all dialogs
  lib/
    market-events.js        43 market events (minor/major/crisis); maybeGenerateEvent()
    market-tick.js          Deterministic snapshot generation, Imperial calendar helpers
                            TICKS_PER_YEAR=48, BASE_YEAR=1105, makeRng() (FNV-1a + mulberry32)
    supabase.js             Supabase client initialisation
    theme-db.js             IndexedDB wrapper for user themes
    theme-tokens.js         Canonical CSS token list (used by ThemeDialog and applyTheme)
    themes-builtin.js       3 WCAG 2.2 AA verified built-in themes (dark/light/sepia)
    trade-engine-ct7.js     CT Book 7 trade engine — pure functions, no side-effects
    traveller-data.js       Lookup tables: CT2_TRADE_GOODS, UWP decoders, trade code maps
    traveller-helpers.js    parseTabDelimited(), decodeUWP(), parseSectorRoutes()
  router/
    index.js                Hash-mode router; / → MapView, /login → LoginView
  stores/
    auth.js                 Campaign/player session (localStorage), createCampaign/login/logout
    map.js                  Sector + world data from TravellerMap API; UWP/route computed
    theme.js                Pinia theme store; revision ref increments on every applyTheme()
    tick.js                 Imperial calendar, tick advance, ensureWorldSnapshot (lazy + backfill),
                            price history queries, market events
  views/
    LoginView.vue           Sign In / Join Campaign / New Campaign (with starting-year field)
    MapView.vue             Main layout: sidebar world list + detail panel (Overview/Market/Events)
supabase/
  migrations/
    001_schema.sql          Tables: campaigns, players, campaign_calendar,
                            market_snapshots, market_events
                            Views: market_monthly, market_annual
    002_auth_functions.sql  create_campaign, join_campaign, verify_pin RPCs
    003_rollup_functions.sql  rollup_month, rollup_year (called by advance_tick)
    004_fix_advance_tick.sql  advance_tick RPC
    005_events_severity.sql   Adds severity column to market_events
    006_event_compaction.sql  Annual rollup deletes expired events older than prior year
    007_campaign_start_tick.sql  create_campaign gains p_start_tick (default 0)
```

---

## Key design decisions

### Deterministic pricing
All market prices and event rolls are seeded by `campaignId:worldHex:goodDie:tick`.
Every client produces identical values for the same inputs — no server-side randomness needed.
`makeRng()` uses FNV-1a hash + mulberry32 PRNG.

### Lazy snapshot generation + backfill
`ensureWorldSnapshot()` generates and inserts snapshots only when a world is first viewed.
On the **first visit** to a world, it also backfills all ticks from the start of the
current Imperial year up to `currentTick - 1`, giving charts immediate price history context.
Max backfill: 47 ticks × 36 goods = 1,692 rows — fits in a single Supabase insert.

### Tick model
- 1 tick = 1 jump-week (7 days)
- 4 ticks = 1 Imperial month (28 days)
- 48 ticks = 1 Imperial year (336 days)
- `BASE_SEC = new Date('1985-01-07').getTime() / 1000` — epoch anchor for lightweight-charts UTCTimestamp

### Market events
43 events in three severity tiers (minor/major/crisis) at ~6% total base rate.
Events affect purchase and sale prices by an `effect_pct` modifier.
Stored in `market_events`; expired events older than the prior year are compacted during
the annual rollup (`rollup_year`).

### Theme system
Three immutable built-in themes (dark-imperium, light-imperium, sepia-imperium).
User-defined themes stored in IndexedDB; current theme ID in localStorage.
Charts re-theme via `themeStore.revision` watch — this counter increments on every
`applyTheme()` call, including the initial `init()` which does not change `currentId`.

### WCAG 2.2 AA
`:focus-visible` pattern for all interactive elements; `useFocusTrap` for all dialogs;
skip link; ARIA roles/labels on world list and dialogs; verified contrast ratios per theme.

---

## Campaign starting year
Referees choose an Imperial starting year (default 1105) when creating a campaign.
The client computes `startTick = (startYear - 1105) * 48` and passes it to the
`create_campaign` RPC as `p_start_tick`. On first world visit, the tick store backfills
the current year's price history automatically.

---

## Implemented trade rulesets
- **CT7** — Classic Traveller Book 7 (Merchant Prince) — fully implemented
- CT2 (Book 2) dropped — CT7 is a superset; no value in a separate implementation

---

## Licensing
Traveller is a registered trademark of Mongoose Publishing Ltd.
Copyright 1977–Present Mongoose Publishing Ltd.
Full disclaimer must appear in the About dialog (currently implemented).
Notify Mongoose Publishing once the app is publicly accessible (see DEVLOG.md TODO).

---

## Running locally

```sh
npm install
npm run dev        # Vite dev server with HMR
```

Requires `.env.local` with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

The service role key must never be in `.env` files committed to the repo.
