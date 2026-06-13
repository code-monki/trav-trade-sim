# Detailed Design

**Project:** Traveller Trade Simulator  
**Version:** 0.1.0

---

## 1. Database Schema

### 1.1 Tables

#### `campaigns`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK, default gen_random_uuid() | Surrogate key |
| `code` | text | NOT NULL, UNIQUE | Shareable campaign identifier (uppercase, e.g. `SPINWARD-42`) |
| `label` | text | NOT NULL | Display name |
| `milieu` | text | NOT NULL, default `'M1105'` | Traveller Map milieu code |
| `trade_rules` | text | NOT NULL, default `'CT7'` | `'CT7'` or `'T5'` |
| `recovery_code_hash` | text | nullable | bcrypt hash of one-time recovery code |
| `created_at` | timestamptz | NOT NULL, default now() | Creation timestamp |

#### `players`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | |
| `campaign_id` | uuid | FK → campaigns(id) ON DELETE CASCADE | |
| `character_name` | text | NOT NULL | Unique within campaign |
| `pin_hash` | text | NOT NULL | bcrypt hash (bf, cost 10) |
| `role` | text | NOT NULL, default `'player'` | `'player'` or `'referee'` |
| `credits` | bigint | NOT NULL, default 0 | Legacy; ship credits are preferred |
| `ship_name` | text | nullable | Legacy; see `crew` table |
| `current_world` | text | nullable | Legacy; see `ships` table |
| `failed_attempts` | int | NOT NULL, default 0 | PIN failure counter |
| `locked_until` | timestamptz | nullable | Lockout expiry; null = not locked |
| `last_seen` | timestamptz | nullable | Updated on successful login |
| `created_at` | timestamptz | NOT NULL | |
| UNIQUE | `(campaign_id, character_name)` | | |

#### `campaign_calendar`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `campaign_id` | uuid | PK, FK → campaigns(id) | One row per campaign |
| `current_tick` | bigint | NOT NULL, default 0 | Ticks elapsed since campaign start |
| `year` | int | NOT NULL, default 1105 | Imperial year (derived: `1105 + tick / 48`) |
| `day` | int | NOT NULL, default 1 | Day of year 1–337 (derived: `(tick % 48) * 7 + 1`) |
| `updated_at` | timestamptz | NOT NULL | |

#### `market_snapshots`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | |
| `campaign_id` | uuid | FK → campaigns(id) | |
| `world_hex` | text | NOT NULL | 4-digit hex code (CCRR format) |
| `sector` | text | NOT NULL | Sector display name |
| `trade_good_die` | text | NOT NULL | d66 die code e.g. `'11'`, `'36'` |
| `trade_good_name` | text | NOT NULL | |
| `tick` | bigint | NOT NULL | |
| `purchase_price` | int | NOT NULL | Credits per ton |
| `sale_price` | int | NOT NULL | Credits per ton |
| `qty_available` | int | NOT NULL | Tons available |
| `source_codes` | text | NOT NULL, default `''` | Space-separated trade codes used |
| `created_at` | timestamptz | NOT NULL | |
| UNIQUE | `(campaign_id, world_hex, sector, trade_good_die, tick)` | | |

Index: `idx_snapshots_world (campaign_id, world_hex, sector, tick DESC)`

#### `market_monthly`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | |
| `campaign_id` | uuid | FK | |
| `world_hex` | text | NOT NULL | |
| `sector` | text | NOT NULL | |
| `trade_good_die` | text | NOT NULL | |
| `year` | int | NOT NULL | Imperial year |
| `month` | int | NOT NULL | 1–12 |
| `open_price` | int | NOT NULL | Price at first tick of month |
| `high_price` | int | NOT NULL | |
| `low_price` | int | NOT NULL | |
| `close_price` | int | NOT NULL | Price at last tick of month |
| `volume_tons` | int | NOT NULL, default 0 | Total tons available across month |
| `created_at` | timestamptz | NOT NULL | |
| UNIQUE | `(campaign_id, world_hex, sector, trade_good_die, year, month)` | | |

#### `market_annual`
Same structure as `market_monthly` but without `month` column.

#### `cargo`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | |
| `campaign_id` | uuid | FK | |
| `player_id` | uuid | FK → players(id) | Owner |
| `ship_id` | uuid | FK → ships(id) | Aboard which ship |
| `trade_good_die` | text | NOT NULL | |
| `trade_good_name` | text | NOT NULL | |
| `tons` | int | NOT NULL, CHECK > 0 | |
| `purchase_price` | int | NOT NULL | Cr/ton paid |
| `purchased_tick` | bigint | NOT NULL | |
| `purchase_world` | text | NOT NULL | Hex of source world |
| `purchase_world_name` | text | NOT NULL, default '' | Name of source world (migration 019) |
| `purchase_sector` | text | NOT NULL | |
| `created_at` | timestamptz | NOT NULL | |

#### `transactions`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | |
| `campaign_id` | uuid | FK | |
| `player_id` | uuid | FK | |
| `ship_id` | uuid | FK | |
| `tick` | bigint | NOT NULL | |
| `type` | text | CHECK IN ('buy','sell','fee','event') | |
| `trade_good_die` | text | nullable | |
| `trade_good_name` | text | nullable | |
| `tons` | int | nullable | |
| `price_per_ton` | int | nullable | |
| `total_cr` | bigint | NOT NULL | Positive = income, negative = expense |
| `world_hex` | text | nullable | |
| `sector` | text | nullable | |
| `notes` | text | nullable | |
| `created_at` | timestamptz | NOT NULL | |

Index: `idx_txn_player (campaign_id, player_id, tick DESC)`

#### `market_events`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | |
| `campaign_id` | uuid | FK | |
| `tick` | bigint | NOT NULL | Tick event fired |
| `scope` | text | CHECK IN ('local','subsector') | |
| `world_hex` | text | nullable | null = subsector-wide |
| `sector` | text | nullable | |
| `trade_good_die` | text | nullable | null = affects all goods |
| `effect_pct` | int | NOT NULL | e.g. +20 or -15 |
| `description` | text | NOT NULL | Human-readable event text |
| `expires_tick` | bigint | nullable | null = permanent |
| `severity` | text | nullable | `'minor'`, `'major'`, `'crisis'` |
| `created_at` | timestamptz | NOT NULL | |

#### `ships`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | |
| `campaign_id` | uuid | FK | |
| `name` | text | NOT NULL | Unique within campaign |
| `hull_type` | text | nullable | e.g. `'Free Trader'` |
| `hull_tons` | int | NOT NULL, default 200 | Total displacement |
| `cargo_capacity` | int | NOT NULL, default 80 | Hold in tons |
| `current_world` | text | nullable | Hex of current location |
| `current_sector` | text | nullable | |
| `credits` | bigint | NOT NULL, default 0 | Operating account |
| `jump_rating` | int | nullable | Jump drive rating (1–6) |
| `maneuver_rating` | int | nullable | Maneuver drive rating |
| `power_rating` | int | nullable | Power plant rating |
| `created_at` | timestamptz | NOT NULL | |
| UNIQUE | `(campaign_id, name)` | | |

#### `crew`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | |
| `campaign_id` | uuid | FK | |
| `ship_id` | uuid | FK → ships(id) | |
| `player_id` | uuid | FK → players(id) | |
| `role` | text | NOT NULL, default `'crew'` | captain, pilot, engineer, etc. |
| `can_trade` | boolean | NOT NULL, default false | Trading authorisation |
| `joined_tick` | bigint | NOT NULL, default 0 | |
| `left_tick` | bigint | nullable | null = currently aboard |
| UNIQUE | `(ship_id, player_id, joined_tick)` | | |

#### `player_skills`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | |
| `campaign_id` | uuid | FK | |
| `player_id` | uuid | FK → players(id) | |
| `skill_name` | text | NOT NULL | Free-form, e.g. `'Broker-2'` |
| `skill_level` | int | NOT NULL, default 1 | |
| `created_at` | timestamptz | NOT NULL | |

#### `trade_records`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | PK |
| `campaign_id` | uuid | FK |
| `player_id` | uuid | FK |
| `ship_id` | uuid | FK |
| `trade_rules` | text | `'CT7'` or `'T5'` |
| `trade_good_die` | text | |
| `trade_good_name` | text | |
| `tons` | int | |
| `source_world_hex` | text | Where purchased |
| `source_sector` | text | |
| `purchase_tick` | bigint | |
| `buy_price_per_ton` | int | |
| `total_cost` | bigint | |
| `market_world_hex` | text | Where sold |
| `market_sector` | text | |
| `sell_tick` | bigint | |
| `sell_price_per_ton` | int | |
| `total_revenue` | bigint | |
| `net_profit` | bigint | |
| `created_at` | timestamptz | |

### 1.2 PostgreSQL Helper Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `tick_year` | `(p_tick bigint)` | int | `1105 + p_tick / 48` |
| `tick_month` | `(p_tick bigint)` | int | `(p_tick % 48) / 4 + 1` |
| `tick_day` | `(p_tick bigint)` | int | `(p_tick % 48) * 7 + 1` |
| `create_campaign` | see migration 016 | json | Creates campaign + calendar + referee player; returns session + recovery code |
| `join_campaign` | `(p_code, p_char_name, p_pin)` | json | Registers new player in existing campaign |
| `verify_pin` | `(p_code, p_char_name, p_pin)` | json | Authenticates; enforces lockout; returns session |
| `advance_tick` | `(p_campaign_id uuid)` | json | Atomically increments tick; triggers rollups |
| `rollup_month` | `(p_campaign_id, p_year, p_month)` | void | Aggregates weekly snapshots into market_monthly |
| `rollup_year` | `(p_campaign_id, p_year)` | void | Aggregates monthly into market_annual; purges old events |
| `reset_pin_with_recovery_code` | `(p_code, p_char_name, p_recovery, p_new_pin)` | json | Resets PIN + clears lockout |
| `regenerate_recovery_code` | `(p_campaign_id uuid)` | json | Generates new code, stores hash, returns plaintext |
| `delete_campaign` | `(p_campaign_id uuid, p_pin text)` | json | Verifies referee PIN then deletes campaign + all cascade data |

---

## 2. Component API Reference

### `MarketTable`
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `world` | Object | required | Traveller Map world object |
| `sectorName` | String | required | Sector display name |
| `chartedDies` | Array | `[]` | Die codes currently checked for charting |
| `showBuyButton` | Boolean | `false` | Show per-row Buy buttons |

| Emit | Payload | Description |
|------|---------|-------------|
| `select-good` | snapshot row | User clicked a table row |
| `toggle-chart` | die string | User toggled the Plot checkbox |
| `buy-good` | snapshot row | User clicked the row Buy button |

### `PriceChart`
| Prop | Type | Description |
|------|------|-------------|
| `worldHex` | String | World hex code |
| `sectorName` | String | Sector name |
| `goods` | Array | `[{ die: string, name: string }]` — goods to plot |

Behaviour: single good → candlestick (monthly/annual) or line (weekly). Multiple goods → always line, one series per good, with a color-coded legend.

### `CargoHold`
| Prop | Type | Description |
|------|------|-------------|
| `world` | Object | Current world (for sell price lookup) |
| `sectorName` | String | |

No emits. Self-contained sell flow with two-click confirm.

### `BuyDialog`
| Prop | Type | Description |
|------|------|-------------|
| `modelValue` | Boolean | v-model open/close |
| `good` | Object | Snapshot row |
| `cargoAvailable` | Number | Free tons in hold |
| `credits` | Number | Current ship credits |
| `loading` | Boolean | |

| Emit | Payload |
|------|---------|
| `update:modelValue` | Boolean |
| `confirm` | `{ tons: number }` |

### `RouteAnalysis`
| Prop | Type | Description |
|------|------|-------------|
| `world` | Object | Current origin world |
| `sectorName` | String | |

| Emit | Payload |
|------|---------|
| `select-world` | (none) — fires after ship location committed |

### `RecoveryCodeDialog`
| Prop | Type | Description |
|------|------|-------------|
| `code` | String | Plaintext recovery code to display |

| Emit | Payload |
|------|---------|
| `close` | (none) |

Teleported to `<body>`. Requires the user to check an acknowledgement checkbox before the Continue button is enabled. Cannot be dismissed by clicking outside.

### `HelpDialog` / `AboutDialog` / `ThemeDialog` / `CharacterDialog`
All use `v-model` (`modelValue: Boolean`, emits `update:modelValue`).

---

## 3. Pinia Store API

### `useAuthStore`
| State | Type | Description |
|-------|------|-------------|
| `campaign` | Object\|null | `{ id, code, label, milieu, trade_rules }` |
| `player` | Object\|null | `{ id, character_name, role, credits }` |
| `loading` | Boolean | |
| `error` | String\|null | |

| Computed | Type | Description |
|----------|------|-------------|
| `isAuthenticated` | Boolean | |
| `isReferee` | Boolean | |

| Action | Returns | Description |
|--------|---------|-------------|
| `createCampaign(opts)` | `{ ok, recoveryCode }` | |
| `joinCampaign(opts)` | `{ ok }` | |
| `login(opts)` | `{ ok }` | |
| `resetPin(opts)` | `{ ok }` | |
| `regenerateRecoveryCode()` | `{ ok, recoveryCode }` | |
| `deleteCampaign({ pin })` | `{ ok }` | Calls delete_campaign RPC; on success calls logout() |
| `logout()` | void | Clears localStorage |
| `clearError()` | void | |

### `useTickStore`
| State | Description |
|-------|-------------|
| `currentTick` | bigint |
| `currentYear`, `currentDay`, `currentMonth` | int |
| `worldSnapshots` | `{ [die]: snapshotRow }` — current world at current tick |
| `activeEvents` | market_events rows |
| `worldEventHistory` | event log for current world |

| Computed | Description |
|----------|-------------|
| `imperialDate` | `"DDD-YYYY"` formatted string |

| Action | Description |
|--------|-------------|
| `loadCalendar()` | Fetches campaign_calendar row |
| `advanceTick()` | Calls advance_tick RPC |
| `ensureWorldSnapshot(world, sector)` | Lazy snapshot generation/fetch |
| `loadWeeklyHistory(hex, sector, die, limit)` | Weekly price series |
| `loadMonthlyHistory(hex, sector, die, limit)` | Monthly OHLC |
| `loadAnnualHistory(hex, sector, die)` | Annual OHLC |
| `eventsForWorld(worldHex)` | Filters active events for a world |
| `loadWorldEventHistory(hex, sector)` | Full event log |

### `useShipStore`
| State | Description |
|-------|-------------|
| `ship` | `{ ...shipRow, crew_role, can_trade }` or null |
| `cargo` | cargo rows array |

| Computed | Description |
|----------|-------------|
| `hasShip` | Boolean |
| `canTrade` | Boolean |
| `cargoUsed` | Total tons in hold |
| `cargoCapacity` | Ship max hold |
| `cargoAvailable` | `cargoCapacity - cargoUsed` |

| Action | Description |
|--------|-------------|
| `loadShip(playerId, campaignId)` | Joins crew → ships → cargo |
| `createShip(opts)` | Inserts ship + captain crew row |
| `updateLocation(worldHex, sector)` | Updates ships.current_world |
| `buyCargo(opts)` | INSERT cargo + transaction; UPDATE credits |
| `sellCargo(opts)` | DELETE cargo; INSERT transaction + trade_record; UPDATE credits |

---

## 4. Calendar Data Format

```
tick = integer, 0 = campaign start
year = 1105 + floor(tick / 48)           -- same formula in JS and SQL
day  = (tick % 48) * 7 + 1              -- 1, 8, 15, … 337
month = floor((tick % 48) / 4) + 1      -- 1–12

Display: String(day).padStart(3, '0') + '-' + year
Example: tick 50 → "015-1106"
```

---

## 5. Snapshot Row Format

Rows stored in `market_snapshots`:

```json
{
  "campaign_id": "uuid",
  "world_hex": "0101",
  "sector": "Spinward Marches",
  "trade_good_die": "11",
  "trade_good_name": "Common Electronics",
  "tick": 0,
  "purchase_price": 19200,
  "sale_price": 22400,
  "qty_available": 30,
  "source_codes": "In Hi"
}
```

`purchase_price` and `sale_price` are in Credits per ton (integer). They include trade code DMs, actual-value roll, TL adjustment, and active event modifiers.

---

## 6. RPC Response Formats

### `create_campaign` / `verify_pin` session payload
```json
{
  "campaign": {
    "id": "uuid",
    "code": "SPINWARD-42",
    "label": "Spinward Marches Run",
    "milieu": "M1105",
    "trade_rules": "CT7"
  },
  "player": {
    "id": "uuid",
    "character_name": "Gvoudzon",
    "role": "referee",
    "credits": 0
  },
  "recovery_code": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
}
```
`recovery_code` only present in `create_campaign` response.

### `advance_tick` response
```json
{ "tick": 5, "year": 1105, "day": 36, "month": 2 }
```

### Error response (any RPC)
```json
{ "error": "Human-readable message" }
```

---

## 7. UI Layout

### MapView (main dashboard)

```
┌────────────────── header (grid: left | center | right) ─────────────────────┐
│ TTS · Campaign Name   │  001-1105 Tick 0 · CT7  [Advance Tick]  │  User [≡]  │
└─────────────────────────────────────────────────────────────────────────────┘
┌────── sidebar ──────────┬──────────────── main panel ────────────────────────┐
│ Sector                  │ World Name                         UWP ↗            │
│ [filter] [select]       │ Sector · Hex · Subsector                           │
│                         │ [Overview] [Market] [Cargo] [Events] [Jump]        │
│ Worlds (n/total)        ├────────────────────────────────────────────────────┤
│ [filter]                │                                                    │
│ World/Hex               │  (tab content — see below)                         │
│ ─────────────────       │                                                    │
│ World list (scrollable) │                                                    │
└─────────────────────────┴────────────────────────────────────────────────────┘
```

### Market tab content

```
┌────────── market-layout (flex column, calc height) ────────────────────────┐
│ [events banner if active events]                                           │
│ [search input] [n/total goods]                                             │
│ ┌── table-scroll (overflow-y auto, flex 1) ────────────────────────────┐  │
│ │ Plot │ Good │ Die │ Buy(Cr/t) │ Sell(Cr/t) │ Spread │ Qty(t) │ [Buy] │  │
│ │ □    │ ...  │ 11  │  19,200   │   22,400   │ +3,200 │  30    │ [Buy] │  │
│ │ ■    │ ...  │ 12  │  ...      │   ...      │ ...    │  ...   │ [Buy] │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│ ══ resize handle ════════════════════════════════════════════════════════  │
│ ┌── PriceChart (height: chartHeight px) ──────────────────────────────┐  │
│ │ [Weekly] [Monthly] [Annual]    ● Good A  ● Good B                   │  │
│ │ [lightweight-charts canvas]                                         │  │
│ └─────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Referee Panel (RefereeView)

```
┌── Campaign │ Ships │ Events │ Players ──────────────────────────────────────┐
│                                                                             │
│  Campaign tab:  Campaign info, recovery code regeneration                  │
│  Ships tab:     Ship list → expand → crew table with can_trade checkboxes  │
│  Events tab:    Active event list, create event form                       │
│  Players tab:   Character list → expand → skill management                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Theme System

Themes are defined as token maps in `src/lib/themes-builtin.js` (name → CSS variable values). The active theme is stored in Supabase `user_preferences` table keyed by campaign+player, falling back to localStorage if Supabase is unavailable. CSS variables are injected into `:root` on theme change via `src/lib/theme-tokens.js`.

Core CSS variables: `--bg`, `--bg-panel`, `--bg-item`, `--bg-selected`, `--text`, `--text-dim`, `--border`, `--accent`, `--accent-dim`, `--code`, `--red`, `--green`, `--amber`, `--radius`.
