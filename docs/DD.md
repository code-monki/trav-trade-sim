# Detailed Design

**Project:** Traveller Trade Simulator  
**Version:** 0.4.0

---

## 1. Database Schema

The backend is Cloudflare D1 (SQLite), not PostgreSQL/Supabase. UUID primary keys are `TEXT`, generated in Worker code via `crypto.randomUUID()`; timestamps are `TEXT` ISO 8601 strings (`datetime('now')`); booleans are `INTEGER` (0/1). There are no stored functions and no RLS — all business logic and authorization live in the Worker (`worker/src/routes/*.js`, `worker/src/middleware/auth.js`). The consolidated baseline is `d1/schema.sql`; incremental changes are applied via numbered migrations `d1/002_*.sql` through `d1/010_mgt2022_trade_rules.sql`.

### 1.1 Tables

#### `campaigns`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | App-generated UUID |
| `code` | TEXT | NOT NULL, UNIQUE | Shareable campaign identifier |
| `label` | TEXT | NOT NULL | Display name |
| `milieu` | TEXT | NOT NULL, default `'M1105'` | Traveller Map milieu code |
| `trade_rules` | TEXT | NOT NULL, default `'CT7'` | `'CT7'`, `'T5'`, or `'MgT2022'`; locked after creation (no CHECK constraint on this column) |
| `recovery_code_hash` | TEXT | nullable | PBKDF2 hash of the one-time recovery code |
| `created_at` | TEXT | NOT NULL, default `datetime('now')` | |

#### `sessions`
*(defined in `d1/002_sessions.sql`; not yet folded into the consolidated `d1/schema.sql` baseline — a known gap, not a documentation error)*
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `token` | TEXT | PK | Bearer session token, issued on login |
| `player_id` | TEXT | FK → players(id) ON DELETE CASCADE | |
| `campaign_id` | TEXT | FK → campaigns(id) ON DELETE CASCADE | |
| `expires_at` | TEXT | NOT NULL | 30-day TTL |
| `created_at` | TEXT | NOT NULL | |

Index: `idx_sessions_player (player_id)`

#### `campaign_calendar`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `campaign_id` | TEXT | PK, FK → campaigns(id) ON DELETE CASCADE | One row per campaign |
| `current_tick` | INTEGER | NOT NULL, default 0 | Ticks elapsed since campaign start (1 tick = 1 jump-week) |
| `year` | INTEGER | NOT NULL, default 1105 | Imperial year — `1105 + tick / 48` |
| `day` | INTEGER | NOT NULL, default 1 | Day of year 1–337 — `(tick % 48) * 7 + 1` |
| `updated_at` | TEXT | NOT NULL | |

#### `players`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `campaign_id` | TEXT | FK → campaigns(id) ON DELETE CASCADE | |
| `character_name` | TEXT | NOT NULL | Unique within campaign |
| `pin_hash` | TEXT | NOT NULL | `pbkdf2:<iterations>:<saltHex>:<hashHex>` (Web Crypto API) |
| `role` | TEXT | NOT NULL, default `'player'` | `'player'` or `'referee'` |
| `credits` | INTEGER | NOT NULL, default 0 | **Currently dead** — always 0, never read or written by any transaction logic; every real credit movement is on `ships.credits`. Earmarked as the field to repurpose for a future personal-wallet feature, not yet built |
| `failed_attempts` | INTEGER | NOT NULL, default 0 | PIN failure counter |
| `locked_until` | TEXT | nullable | Lockout expiry; null = not locked |
| `last_seen` | TEXT | nullable | |
| `created_at` | TEXT | NOT NULL | |
| UNIQUE | `(campaign_id, character_name)` | | |

#### `ships`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `campaign_id` | TEXT | FK → campaigns(id) ON DELETE CASCADE | |
| `name` | TEXT | NOT NULL | Unique within campaign |
| `hull_type` | TEXT | nullable | e.g. `'Free Trader'` |
| `hull_tons` | INTEGER | NOT NULL, default 200 | |
| `cargo_capacity` | INTEGER | NOT NULL, default 80 | Hold in tons |
| `current_world` | TEXT | nullable | Hex of current location |
| `current_sector` | TEXT | nullable | |
| `credits` | INTEGER | NOT NULL, default 0 | Ship's operating treasury |
| `jump_rating` | INTEGER | nullable | |
| `maneuver_drive_rating` | INTEGER | nullable | |
| `stateroom_capacity` | INTEGER | NOT NULL, default 0 | High/Middle passenger berths |
| `low_berth_capacity` | INTEGER | NOT NULL, default 0 | Low passage berths |
| `fuel_capacity` | INTEGER | NOT NULL, default 0 | Tons |
| `fuel_current` | INTEGER | NOT NULL, default 0 | Tons |
| `market_value` | INTEGER | NOT NULL, default 0 | Referee-entered valuation, populated via Ship Template selection or manual entry (§Asset Valuation) |
| `created_at` | TEXT | NOT NULL | |
| UNIQUE | `(campaign_id, name)` | | |

Index: `idx_ships_campaign (campaign_id)`

#### `ship_templates`
*(`d1/005_ship_templates.sql`)* — referee-managed catalogue for the New Ship form's dropdown; no persistent link to ships created from one.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `campaign_id` | TEXT | FK → campaigns(id) ON DELETE CASCADE | |
| `trade_rules` | TEXT | NOT NULL, CHECK IN ('CT7','T5','MgT2022') | Ruleset this template's stats are tagged for |
| `name` | TEXT | NOT NULL | |
| `hull_type` | TEXT | nullable | |
| `hull_tons` | INTEGER | NOT NULL, default 200 | |
| `cargo_capacity` | INTEGER | NOT NULL, default 80 | |
| `jump_rating` | INTEGER | nullable | |
| `maneuver_drive_rating` | INTEGER | nullable | |
| `stateroom_capacity` | INTEGER | NOT NULL, default 0 | |
| `low_berth_capacity` | INTEGER | NOT NULL, default 0 | |
| `fuel_capacity` | INTEGER | NOT NULL, default 0 | |
| `market_value` | INTEGER | NOT NULL, default 0 | |
| `notes` | TEXT | nullable | Flags the lazily-seeded CT7/MgT2022 starter template as unverified |
| `created_at` | TEXT | NOT NULL | |
| UNIQUE | `(campaign_id, name)` | | |

Index: `idx_ship_templates_campaign (campaign_id, trade_rules)`

#### `ship_debts`
*(`d1/006_ship_debts.sql`)* — no interest; Referee adjusts `current_balance` directly.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `campaign_id` | TEXT | FK → campaigns(id) ON DELETE CASCADE | |
| `ship_id` | TEXT | FK → ships(id) ON DELETE CASCADE, nullable | Nullable so a future corporate/fleet-level debt can reuse this table without a new one |
| `type` | TEXT | NOT NULL, CHECK IN ('mortgage','loan','obligation') | |
| `creditor_name` | TEXT | nullable | |
| `principal` | INTEGER | NOT NULL | |
| `current_balance` | INTEGER | NOT NULL | |
| `due_tick` | INTEGER | nullable | |
| `notes` | TEXT | nullable | |
| `created_at` | TEXT | NOT NULL | |

Index: `idx_ship_debts_ship (campaign_id, ship_id)`

#### `debt_payments`
*(`d1/006_ship_debts.sql`)* — separate from `transactions` because that table's `type` `CHECK` constraint can't be `ALTER`ed in place in SQLite.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `debt_id` | TEXT | FK → ship_debts(id) ON DELETE CASCADE | |
| `campaign_id` | TEXT | FK → campaigns(id) ON DELETE CASCADE | |
| `ship_id` | TEXT | FK → ships(id) ON DELETE SET NULL, nullable | |
| `tick` | INTEGER | NOT NULL | |
| `amount` | INTEGER | NOT NULL | |
| `notes` | TEXT | nullable | |
| `created_at` | TEXT | NOT NULL | |

Index: `idx_debt_payments_debt (debt_id, tick DESC)`

#### `ship_ownership`
*(`d1/007_ownership.sql`)* — multiple players jointly owning one ship (a partnership); independent of Organizations below. Referee-managed only — closer to a debt/contract the referee arbitrates than a business a player runs.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `campaign_id` | TEXT | FK → campaigns(id) ON DELETE CASCADE | |
| `ship_id` | TEXT | FK → ships(id) ON DELETE CASCADE | |
| `player_id` | TEXT | FK → players(id) ON DELETE CASCADE | |
| `percentage` | INTEGER | NOT NULL, CHECK (0 < percentage ≤ 100) | Server-validated so a ship's shares never sum past 100% |
| `created_at` | TEXT | NOT NULL | |
| UNIQUE | `(ship_id, player_id)` | | |

Index: `idx_ship_ownership_ship (ship_id)`

#### `organizations`
*(`d1/007_ownership.sql`, extended `d1/009_org_financials.sql`)* — the generic Organization entity; corporation, confederation, and trade union are all this, differentiated only by configuration.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `campaign_id` | TEXT | FK → campaigns(id) ON DELETE CASCADE | |
| `name` | TEXT | NOT NULL | |
| `treasury_credits` | INTEGER | NOT NULL, default 0 | |
| `dues_rate` | INTEGER | nullable | Flat rate charged per member ship per collection; null/0 = no dues |
| `dues_frequency_ticks` | INTEGER | NOT NULL, default 4 | Collection interval — drives a "due" indicator only, never automatic collection |
| `last_dues_tick` | INTEGER | nullable | Tick of last collection; null = never collected (first collection is always allowed regardless of frequency) |
| `notes` | TEXT | nullable | |
| `created_at` | TEXT | NOT NULL | |
| UNIQUE | `(campaign_id, name)` | | |

#### `organization_members`
*(`d1/007_ownership.sql`)* — a ship's affiliation with an org.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `organization_id` | TEXT | FK → organizations(id) ON DELETE CASCADE | |
| `ship_id` | TEXT | FK → ships(id) ON DELETE CASCADE | |
| `owns_ship` | INTEGER | NOT NULL, default 0 | 1 = org owns this ship's assets/debts outright (corporation/fleet); 0 = ship stays independently owned, just dues/reporting-affiliated (confederation) |
| `created_at` | TEXT | NOT NULL | |
| UNIQUE | `(organization_id, ship_id)` | | |

Indexes: `idx_org_members_org (organization_id)`, `idx_org_members_ship (ship_id)`, `idx_org_members_single_owner (ship_id) WHERE owns_ship = 1` (**UNIQUE** — a ship can be owned outright by at most one organization at a time; enforced here at the DB level plus an app-level `409` check in the Worker for a friendly error message)

#### `organization_officers`
*(`d1/008_org_officers.sql`)* — players authorized to manage an organization. Flat list, no role hierarchy: any officer can manage the org fully, including adding/removing other officers. Referees always retain override rights regardless of officer status.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `organization_id` | TEXT | FK → organizations(id) ON DELETE CASCADE | |
| `player_id` | TEXT | FK → players(id) ON DELETE CASCADE | |
| `created_at` | TEXT | NOT NULL | |
| UNIQUE | `(organization_id, player_id)` | | |

Index: `idx_org_officers_org (organization_id)`

#### `organization_ownership`
*(`d1/009_org_financials.sql`)* — player equity in an org that owns ships outright. Mirrors `ship_ownership`'s 100%-ceiling validation exactly, but is **officer-manageable**, not referee-only — officers run the business day-to-day, equity included.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `campaign_id` | TEXT | FK → campaigns(id) ON DELETE CASCADE | |
| `organization_id` | TEXT | FK → organizations(id) ON DELETE CASCADE | |
| `player_id` | TEXT | FK → players(id) ON DELETE CASCADE | |
| `percentage` | INTEGER | NOT NULL, CHECK (0 < percentage ≤ 100) | |
| `created_at` | TEXT | NOT NULL | |
| UNIQUE | `(organization_id, player_id)` | | |

Index: `idx_org_ownership_org (organization_id)`

#### `dues_payments`
*(`d1/009_org_financials.sql`)* — audit trail, one row per ship per collection event.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `organization_id` | TEXT | FK → organizations(id) ON DELETE CASCADE | |
| `ship_id` | TEXT | FK → ships(id) ON DELETE CASCADE | |
| `campaign_id` | TEXT | FK → campaigns(id) ON DELETE CASCADE | |
| `tick` | INTEGER | NOT NULL | |
| `amount` | INTEGER | NOT NULL | |
| `created_at` | TEXT | NOT NULL | |

Index: `idx_dues_payments_org (organization_id, tick DESC)`

#### `disbursements`
*(`d1/009_org_financials.sql`)* — ad hoc org-treasury → member-ship transfers, officer-triggered.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `organization_id` | TEXT | FK → organizations(id) ON DELETE CASCADE | |
| `ship_id` | TEXT | FK → ships(id) ON DELETE CASCADE | |
| `campaign_id` | TEXT | FK → campaigns(id) ON DELETE CASCADE | |
| `tick` | INTEGER | NOT NULL | |
| `amount` | INTEGER | NOT NULL | |
| `notes` | TEXT | nullable | |
| `created_at` | TEXT | NOT NULL | |

Index: `idx_disbursements_org (organization_id, tick DESC)`

#### `crew`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `campaign_id` | TEXT | FK → campaigns(id) ON DELETE CASCADE | |
| `ship_id` | TEXT | FK → ships(id) ON DELETE CASCADE | |
| `player_id` | TEXT | FK → players(id) ON DELETE CASCADE | |
| `role` | TEXT | NOT NULL, default `'crew'` | Free-form: captain, pilot, engineer, etc. |
| `can_trade` | INTEGER | NOT NULL, default 0 | Trading authorization |
| `has_stateroom` | INTEGER | NOT NULL, default 1 | 0 = double-bunked, frees a stateroom for a paying passenger |
| `joined_tick` | INTEGER | NOT NULL, default 0 | |
| `left_tick` | INTEGER | nullable | null = currently aboard |
| UNIQUE | `(ship_id, player_id, joined_tick)` | | |

Indexes: `idx_crew_player (campaign_id, player_id, left_tick)`, `idx_crew_ship (campaign_id, ship_id)`

#### `player_skills`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `campaign_id` | TEXT | FK → campaigns(id) ON DELETE CASCADE | |
| `player_id` | TEXT | FK → players(id) ON DELETE CASCADE | |
| `skill` | TEXT | NOT NULL | Free-form, e.g. `'Broker'` |
| `level` | INTEGER | NOT NULL, default 0, CHECK (level ≥ 0) | |
| `created_at` | TEXT | NOT NULL | |
| UNIQUE | `(player_id, skill)` | | |

Index: `idx_player_skills_player (campaign_id, player_id)`

#### `market_snapshots`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `campaign_id` | TEXT | FK → campaigns(id) ON DELETE CASCADE | |
| `world_hex` | TEXT | NOT NULL | 4-digit hex code |
| `sector` | TEXT | NOT NULL | |
| `trade_good_die` | TEXT | NOT NULL | d66 die code, e.g. `'11'` |
| `trade_good_name` | TEXT | NOT NULL | |
| `tick` | INTEGER | NOT NULL | |
| `purchase_price` | INTEGER | NOT NULL | Cr/ton |
| `sale_price` | INTEGER | NOT NULL | Cr/ton |
| `qty_available` | INTEGER | NOT NULL | Tons |
| `source_codes` | TEXT | NOT NULL, default `''` | Space-separated trade codes applied |
| `created_at` | TEXT | NOT NULL | |
| UNIQUE | `(campaign_id, world_hex, sector, trade_good_die, tick)` | | |

Index: `idx_snapshots_world (campaign_id, world_hex, sector, tick DESC)`

#### `market_monthly`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `campaign_id` | TEXT | FK | |
| `world_hex` | TEXT | NOT NULL | |
| `sector` | TEXT | NOT NULL | |
| `trade_good_die` | TEXT | NOT NULL | |
| `year` | INTEGER | NOT NULL | |
| `month` | INTEGER | NOT NULL | 1–12 |
| `open_price` / `high_price` / `low_price` / `close_price` | INTEGER | NOT NULL | |
| `volume_tons` | INTEGER | NOT NULL, default 0 | |
| `created_at` | TEXT | NOT NULL | |
| UNIQUE | `(campaign_id, world_hex, sector, trade_good_die, year, month)` | | |

Index: `idx_monthly_world (campaign_id, world_hex, sector, trade_good_die, year, month)`

#### `market_annual`
Same structure as `market_monthly` but no `month` column; `UNIQUE (campaign_id, world_hex, sector, trade_good_die, year)`.

#### `market_events`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `campaign_id` | TEXT | FK | |
| `tick` | INTEGER | NOT NULL | Tick the event fired |
| `scope` | TEXT | NOT NULL, CHECK IN ('local','subsector') | |
| `world_hex` | TEXT | nullable | null = subsector-wide |
| `sector` | TEXT | nullable | |
| `trade_good_die` | TEXT | nullable | null = affects all goods |
| `buy_modifier_pct` / `sell_modifier_pct` | INTEGER | nullable | |
| `description` | TEXT | NOT NULL | |
| `expires_tick` | INTEGER | nullable | null = permanent |
| `severity` | TEXT | NOT NULL, default `'minor'`, CHECK IN ('minor','major','crisis') | |
| `created_at` | TEXT | NOT NULL | |

Index: `idx_events_world (campaign_id, world_hex, sector, tick DESC)`

#### `cargo`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `campaign_id` | TEXT | FK | |
| `player_id` | TEXT | FK → players(id) ON DELETE CASCADE | Owner |
| `ship_id` | TEXT | FK → ships(id) ON DELETE SET NULL, nullable | Aboard which ship |
| `trade_good_die` | TEXT | NOT NULL | |
| `trade_good_name` | TEXT | NOT NULL | |
| `tons` | INTEGER | NOT NULL, CHECK (tons > 0) | |
| `purchase_price` | INTEGER | NOT NULL | Cr/ton paid |
| `purchased_tick` | INTEGER | NOT NULL | |
| `purchase_world` | TEXT | NOT NULL | Hex of source world |
| `purchase_sector` | TEXT | NOT NULL | |
| `purchase_world_name` | TEXT | NOT NULL, default `''` | |
| `created_at` | TEXT | NOT NULL | |

Indexes: `idx_cargo_player (campaign_id, player_id)`, `idx_cargo_ship (campaign_id, ship_id)`

#### `transactions`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `campaign_id` | TEXT | FK | |
| `player_id` | TEXT | FK → players(id) ON DELETE CASCADE | |
| `ship_id` | TEXT | FK → ships(id) ON DELETE SET NULL, nullable | |
| `tick` | INTEGER | NOT NULL | |
| `type` | TEXT | NOT NULL, CHECK IN (`buy`,`sell`,`fee`,`event`,`fuel`,`passenger_fare`,`passenger_refund`,`mail`,`freight_charge`,`freight_refund`,`freight_penalty`) | This `CHECK` can't be `ALTER`ed in place — why `debt_payments`/`dues_payments`/`disbursements` are separate tables rather than new `type` values (the three `freight_*` values were added via a table-rebuild migration, `d1/010_mgt2022_trade_rules.sql`, since a straight `ALTER` isn't possible in SQLite either) |
| `trade_good_die` / `trade_good_name` / `tons` / `price_per_ton` | — | nullable | |
| `total_cr` | INTEGER | NOT NULL | Positive = income, negative = expense |
| `world_hex` / `sector` / `notes` | TEXT | nullable | |
| `created_at` | TEXT | NOT NULL | |

Indexes: `idx_txn_player (campaign_id, player_id, tick DESC)`, `idx_txn_ship (campaign_id, ship_id, tick DESC)`

#### `trade_records`
Records a completed buy+sell round trip; feeds the `realized_ohlcv` view below.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `campaign_id` | TEXT | FK | |
| `player_id` | TEXT | FK → players(id) ON DELETE CASCADE | |
| `ship_id` | TEXT | FK → ships(id) ON DELETE SET NULL, nullable | |
| `trade_rules` | TEXT | NOT NULL, CHECK IN ('CT7','T5','MgT2022') | |
| `trade_good_die` / `trade_good_name` | TEXT | NOT NULL | |
| `tons` | INTEGER | NOT NULL, CHECK (tons > 0) | |
| `cargo_id_t5` | TEXT | nullable | |
| `source_world_hex` / `source_sector` | TEXT | NOT NULL | Where purchased |
| `purchase_tick` | INTEGER | NOT NULL | |
| `buy_price_per_ton` / `total_cost` | INTEGER | NOT NULL | |
| `market_world_hex` / `market_sector` | TEXT | NOT NULL | Where sold |
| `sell_tick` | INTEGER | NOT NULL | |
| `tc_adjusted_price_per_ton` | INTEGER | nullable | T5-specific (name predates MgT2022's Modified Price % fields, which are not separately persisted) |
| `trade_price_per_ton` / `sell_price_per_ton` | INTEGER | NOT NULL | |
| `effective_flux` / `broker_dm` / `broker_fee_total` | INTEGER | nullable | T5-specific |
| `total_revenue` / `net_profit` | INTEGER | NOT NULL | |
| `created_at` | TEXT | NOT NULL | |

Indexes: `idx_trade_records_market`, `idx_trade_records_player`, `idx_trade_records_route`, `idx_trade_records_ship`

#### `obligations`
*(`d1/004_obligations.sql`)* — general pending-commercial-commitment table. **Replaces** the two former tables `passenger_manifests` and `mail_contracts`, unified under a `kind` discriminator so future obligation types (charter deposits, insurance claims, referee-issued IOUs, ...) can reuse it without a new one-off table.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PK | |
| `campaign_id` | TEXT | FK → campaigns(id) ON DELETE CASCADE | |
| `ship_id` | TEXT | FK → ships(id) ON DELETE CASCADE | |
| `player_id` | TEXT | FK → players(id), nullable | |
| `kind` | TEXT | NOT NULL, CHECK IN ('mail','passenger','freight') | `'freight'` added via `d1/010_mgt2022_trade_rules.sql` (MgT2022 only) |
| `status` | TEXT | NOT NULL, default `'pending'`, CHECK IN ('pending','fulfilled','cancelled') | `fulfilled` on arrival at destination (all three kinds); `cancelled` on referee/player refund (passenger and freight only — mail has no cancel path) |
| `amount` | INTEGER | NOT NULL | Fare (passenger), payment (mail), or full agreed charge (freight — charged upfront at booking) |
| `origin_world_hex` / `origin_sector` / `origin_world_name` | TEXT | nullable | |
| `dest_world_hex` / `dest_sector` | TEXT | NOT NULL | |
| `dest_world_name` | TEXT | nullable | |
| `accept_tick` | INTEGER | NOT NULL | |
| `resolve_tick` | INTEGER | nullable | |
| `due_tick` | INTEGER | nullable | freight only: deadline tick for on-time delivery; late delivery applies a (1D+4)×10% penalty computed at delivery time (never stored — see `trade-engine-mgt2022.js`'s `freightLatePenaltyPct`) |
| `passage_type` | TEXT | nullable | passenger only: `'high'` \| `'middle'` \| `'basic'` \| `'low'` (`'basic'` is MgT2022-only, no `CHECK` constraint on this column) |
| `passenger_count` | INTEGER | nullable | passenger only |
| `fare_per_head` | INTEGER | nullable | passenger only |
| `parsecs` | INTEGER | nullable | mail and freight |
| `freight_tons` | INTEGER | nullable | freight only |
| `freight_lot_size` | TEXT | nullable | freight only: `'major'` \| `'minor'` \| `'incidental'` (no `CHECK` constraint) |
| `rate_per_ton` | INTEGER | nullable | freight only: agreed Cr/ton for the whole run |
| `notes` | TEXT | nullable | |
| `created_at` | TEXT | NOT NULL | |

Indexes: `idx_obligations_ship (campaign_id, ship_id, kind, status)`, `idx_obligations_dest (dest_world_hex, dest_sector) WHERE status = 'pending'`

#### `traffic_snapshots`
*(`d1/010_mgt2022_trade_rules.sql`)* — MgT2022-only passenger/freight/mail traffic-availability rolls, one row per (campaign, world, tick), generated deterministically alongside the market snapshot (see `src/lib/traffic-tick.js`). CT7/T5 campaigns never populate this table.
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTOINCREMENT | |
| `campaign_id` | TEXT | FK → campaigns(id) ON DELETE CASCADE | |
| `world_hex` / `sector` | TEXT | NOT NULL | |
| `tick` | INTEGER | NOT NULL | |
| `high_passages` / `middle_passages` / `basic_passages` / `low_passages` | INTEGER | NOT NULL, default 0 | Rolled availability count per passage tier this tick |
| `major_freight_lots` / `minor_freight_lots` / `incidental_freight_lots` | INTEGER | NOT NULL, default 0 | Rolled availability count per freight lot size this tick |
| `mail_containers` | INTEGER | NOT NULL, default 0 | Rolled container count (0 if the 2D mail-availability roll didn't meet 12+) |
| `created_at` | TEXT | NOT NULL | |
| UNIQUE | `(campaign_id, world_hex, sector, tick)` | | |

Index: `idx_traffic_snapshots_lookup (campaign_id, world_hex, sector, tick)`

Worker routes alias these columns back to the pre-refactor field names in SQL (`amount AS fare_total`, `origin_world_hex AS embark_world_hex`, `passenger_count AS count`, etc. — see `PASSENGER_SELECT`/`MAIL_SELECT` in `worker/src/routes/ships.js` and `referee.js`), so the frontend store (`useShipStore`'s `passengers`/`mailContracts` state, `bookPassengers`/`acceptMailContract` actions — §3) needed zero changes when the tables were unified.

#### `realized_ohlcv` (view, not a table)
Window functions over `trade_records`, partitioned by `(campaign_id, market_world_hex, market_sector, trade_good_die, year, month)` with `year`/`month` computed inline from `sell_tick` — SQLite has no stored functions, so the `1105 + tick/48` / `(tick/4)%12+1` arithmetic that a Postgres helper function used to encapsulate is inlined directly into the view's `SELECT`. Exposes `open_price`, `high_price`, `low_price`, `close_price`, `volume_tons`, `trade_count`.

### 1.2 Worker Routes

D1 has no stored procedures — business logic that a Postgres-era design would put in `SECURITY DEFINER` RPC functions instead lives in Cloudflare Worker route handlers, gated by `worker/src/middleware/auth.js` (`requireAuth` — any authenticated session; `requireReferee` — session role must be `'referee'`). Financial-model routes additionally use an `isOfficerOrReferee(db, session, orgId)` helper (in `organizations.js`) for officer-or-referee gating.

| Route file | Mounted at | Covers |
|------------|-----------|--------|
| `auth.js` | `/api/auth` | Create/join campaign, login, PIN reset, recovery code regeneration, delete campaign |
| `campaigns.js` | `/api/campaigns` | Campaign label edit |
| `calendar.js` | `/api/campaigns/:id/calendar`, `/advance-tick`, `/rollup-repair` | Tick advancement (`requireReferee`), monthly/annual rollup, gap-backfill repair (`requireAuth`) |
| `market.js` | `/api/campaigns/:id/events`, `/snapshots`, `/market/*` | Market snapshot lazy generation/backfill, price history, market events |
| `ships.js` | `/api/ships` | Player-facing ship view, buy/sell cargo, fuel, obligations (passengers/mail), pay-debt |
| `referee.js` | `/api/referee` | Ships, crew, players, skills, ship templates, ship debts, ship ownership (all `requireReferee`) |
| `organizations.js` | `/api/organizations` | Organization CRUD, officers, members, equity, dues collection, disbursement, fleet report (all `requireAuth`; mutations additionally gated by `isOfficerOrReferee`) |
| `reports.js` | `/api/reports` | Ledger, trades, income breakdown, debts, ownership (branches to `organization_ownership` instead of `ship_ownership` when a ship is org-owned) |

Derived-value formulas (client-duplicated in `src/lib/market-tick.js` for display, computed server-side in `worker/src/lib/rollup.js`):

```
tickYear(tick)  = 1105 + Math.floor(tick / 48)
tickMonth(tick) = Math.floor((tick % 48) / 4) + 1
tickDay(tick)   = (tick % 48) * 7 + 1
```

---

## 2. Component API Reference

### `MarketTable`
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `world` | Object | required | Traveller Map world object |
| `sectorName` | String | required | |
| `chartedDies` | Array | `[]` | Die codes currently checked for charting |
| `showBuyButton` | Boolean | `false` | |

| Emit | Payload | Description |
|------|---------|-------------|
| `select-good` | snapshot row | |
| `toggle-chart` | die string | |
| `buy-good` | snapshot row | |

### `PriceChart`
| Prop | Type | Description |
|------|------|-------------|
| `worldHex` | String | |
| `sectorName` | String | |
| `goods` | Array | `[{ die, name }]` — goods to plot |

Single good → candlestick (monthly/annual) or line (weekly). Multiple goods → always line, one series per good.

### `CargoHold`
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `world` | Object | `null` | Current world (sell price lookup) |
| `sectorName` | String | `''` | |

No emits. Reads `useTickStore().worldSnapshots` for sell prices; calls `ship.sellCargo`. Footer row sums cargo value at the currently-viewed world's live sell price, falling back to purchase price for goods not yet appraised there.

### `BuyDialog`
| Prop | Type | Description |
|------|------|-------------|
| `modelValue` | Boolean | v-model open/close |
| `good` | Object | Snapshot row |
| `cargoAvailable` | Number | Free tons in hold |
| `credits` | Number | |
| `loading` | Boolean | |

| Emit | Payload |
|------|---------|
| `update:modelValue` | Boolean |
| `confirm` | `{ tons }` |

### `RouteAnalysis`
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `world` | Object | `null` | Current origin world |
| `sectorName` | String | `''` | |

| Emit | Payload |
|------|---------|
| `select-world` | (none) — fires after ship location committed |

Anchors reachable-worlds computation to the ship's actual `current_world`/`current_sector` (not whichever world happens to be browsed in the sidebar). Uses `src/lib/market-tick.js`'s `generateWorldSnapshot` client-side for projected-profit estimates.

### `PassengersPanel`
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `world` | Object | `null` | Current world (embark metadata) |
| `sectorName` | String | `''` | |

No emits. Booking form: passage type selector (High/Middle/Low, plus Basic for MgT2022), count stepper, parsecs input (shown for T5 and MgT2022), destination fields, real-time fare preview. Validates stateroom/berth/cargo-tonnage availability and (for MgT2022) the tick's rolled traffic-availability count before submitting; calls `ship.bookPassengers`.

### `ShipServices`
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `world` | Object | `null` | Determines fuel availability |
| `sectorName` | String | `''` | |

No emits. Two sections: **Fuel** (availability badges, tonnage stepper capped at tank space, fill-level bar, one-click "Fill for jump" that computes and immediately purchases the tons needed for one jump) and **Mail Contract** (destination fields, T5 parsecs, payment preview; MgT2022 instead shows the tick's rolled container count and gates acceptance on it being > 0). Embeds `WorldPicker.vue` for destination selection; calls `ship.purchaseFuel`/`ship.acceptMailContract`.

### `AboardPanel`
No props, no emits. Ship's "Aboard" sub-tab — composes `PassengerManifest` and `ContractsPanel` under one view (occupancy + in-transit passengers, and in-transit mail contracts).

### `PassengerManifest`
No props, no emits. Stateroom/berth occupancy summary + table of in-transit passengers from `useShipStore().passengers`. Shows total booked revenue.

### `ContractsPanel`
No props, no emits. Table of in-transit mail contracts from `useShipStore().mailContracts`. Shows total pending payment.

### `ReportsPanel`
No props, no emits. Ship's "Reports" sub-tab, five report modes (Ledger, Trades, Income, Debts, Net Worth) selected via an internal tab bar. Calls `/api/reports/{ledger,trades,income,debts,ownership}` directly via `api.js` (bypasses the Pinia store). Net Worth combines `ship.credits` + `ship.market_value` + cargo value (at purchase price) − total debt, scaled by the player's ownership share (from `ship_ownership`, or from `organization_ownership` if the ship is org-owned — see `GET /api/reports/ownership`'s branch in §1.2) into a "Your Share" figure. Debts mode lets a `can_trade` player pay down a debt via `ship.payDebt`.

### `OrganizationsPanel`
No props, no emits. Ship's "Organizations" sub-tab — player-facing organization browser and management panel. Calls `/api/organizations*` directly via `api.js` (bypasses the Pinia store, matching `ReportsPanel`'s pattern). Any player can found an org (becoming its first officer); a `canManage(org)` helper (`org.is_officer || auth.isReferee`) gates edit/officer/member/dues/disbursement/equity controls, while org browsing and membership lists are visible to all. Fleet Report is fetched on demand and rendered only for officers/referee.

### `RecoveryCodeDialog`
| Prop | Type | Description |
|------|------|-------------|
| `code` | String | Plaintext recovery code to display |

| Emit | Payload |
|------|---------|
| `close` | (none) |

Teleported to `<body>`. Requires an acknowledgement checkbox before Continue is enabled; cannot be dismissed by clicking outside.

### `EventsHistory`
No props beyond world/sector context, no emits. Renders the active-events banner and per-world event log; referee-only controls (create/expire) live in `RefereeView.vue`'s Events tab instead.

### `WorldPicker`
Embedded in `ShipServices.vue` for mail-contract destination selection. Dropdown-with-filter mode plus a manual hex-entry fallback mode.

### `HamburgerMenu`
No props. Emits one event per menu item selected: `themes`, `about`, `tutorials`, `help`, `manage-character`, `manage-campaign` (referee-only), `signout`.

### `HelpDialog` / `AboutDialog` / `ThemeDialog` / `CharacterDialog` / `TutorialDialog`
All use `v-model` (`modelValue: Boolean`, emits `update:modelValue`). `HelpDialog`/`TutorialDialog` content is static/hardcoded (see `src/lib/tutorials.js` for tutorial step data); both are known to be stale relative to the financial-model feature set and are flagged for a separate revisit.

### Top-level views: `LoginView`, `MapView`, `RefereeView`
Routed views, no props/emits (mounted by `src/router/index.js` under names `login`, `map`, `referee`). `MapView.vue` hosts the two-level tab system (§7) and every player-facing sub-component above. `RefereeView.vue` hosts the five campaign-management tabs (Ships, Players, Organizations, Events, Campaign) and makes many direct `api.js` calls beyond what `useRefereeStore` covers (ship debts, ship ownership, organizations sub-resources) — the store holds only the "core CRUD" state for each area; sub-resource management is component-local, a deliberate pattern carried consistently from the Organizations work onward.

---

## 3. Pinia Store API

### `useAuthStore`
| State | Description |
|-------|-------------|
| `campaign` | `{ id, code, label, milieu, trade_rules }` or null |
| `player` | `{ id, character_name, role, credits }` or null |
| `loading`, `error` | |

| Computed | Description |
|----------|-------------|
| `isAuthenticated` | |
| `isReferee` | `player?.role === 'referee'` |

| Action | Description |
|--------|-------------|
| `createCampaign(opts)` | Bootstraps a new campaign + referee character; returns `{ ok, recoveryCode }` |
| `joinCampaign(opts)` | Registers a new character in an existing campaign, then logs in |
| `login(opts)` | PIN auth; persists session to localStorage |
| `resetPin(opts)` | Via recovery code |
| `regenerateRecoveryCode()` | Invalidates the old code |
| `deleteCampaign({ pin })` | Referee-only, PIN-gated; calls `logout()` on success |
| `logout()` | Clears localStorage session + the ship store |
| `clearError()` | |

Session persisted to `localStorage` key **`tts_session`**: `{ campaign, player, token }`.

### `useMapStore`
| State | Description |
|-------|-------------|
| `sectors`, `selectedMilieu`, `selectedSectorName`, `worlds`, `worldHeaders`, `sectorRoutes`, `subsectorNames`, `selectedWorld`, `loading`, `error`, `searchQuery`, `showRaw` | |

| Computed | Description |
|----------|-------------|
| `selectedSectorInfo`, `filteredWorlds`, `decodedUWP`, `travelZoneLabel`, `zoneBadgeClass`, `decodedBases`, `extensionFields`, `hasExtensions`, `worldByHex`, `routesByHex`, `selectedWorldRoutes` | |

| Action | Description |
|--------|-------------|
| `loadSectors()` | Fetches the sector list directly from `travellermap.com` (not the app's own Worker API) |
| `onSectorChange()` | Fetches worlds + routes for the chosen sector |
| `onMilieuChange()` | Resets and reloads for a new milieu |
| `selectWorld(world)` | |

### `useTickStore`
| State | Description |
|-------|-------------|
| `currentTick`, `currentYear`, `currentDay`, `currentMonth` | |
| `worldSnapshots` | `{ [die]: snapshotRow }` for the currently-viewed world/tick |
| `snapshotWorldKey`, `activeEvents`, `worldEventHistory`, `loading`, `error` | |

| Computed | Description |
|----------|-------------|
| `imperialDate` | `"DDD-YYYY"` formatted string |

| Action | Description |
|--------|-------------|
| `loadCalendar()` | |
| `advanceTick()` | Referee-only |
| `loadActiveEvents()` | |
| `maybeInsertEvent()` | Seeds a deterministic market event for the current tick, if the roll hits |
| `ensureWorldSnapshot(world, sector)` | Lazy generation/backfill/fetch of market prices for a world — backfills every gap since the world's last visit, not just its first-ever visit |
| `loadWeeklyHistory` / `loadMonthlyHistory` / `loadAnnualHistory` | |
| `eventsForWorld(worldHex)` | |
| `loadWorldEventHistory(hex, sector)` | |

### `useShipStore`
| State | Description |
|-------|-------------|
| `ship` | `{ ...shipRow, crew_role, can_trade }` or null |
| `cargo` | cargo rows |
| `passengers` | `obligations` rows, `kind='passenger'`, `status='pending'` (name kept from the pre-refactor `passenger_manifests` shape — see §1.1 `obligations`) |
| `mailContracts` | `obligations` rows, `kind='mail'`, `status='pending'` (name kept from the pre-refactor `mail_contracts` shape) |
| `loading`, `error` | |

| Computed | Description |
|----------|-------------|
| `hasShip`, `canTrade` | |
| `cargoUsed`, `cargoCapacity`, `cargoAvailable` | |
| `stateroomsTotal`, `crewStateroomsUsed`, `stateroomsUsed`, `stateroomsAvailable` | |
| `lowBerthsTotal`, `lowBerthsUsed`, `lowBerthsAvailable` | |

| Action | Description |
|--------|-------------|
| `clearError()` | |
| `loadShip(playerId, campaignId)` | One-call fetch of ship + cargo + passengers + mail |
| `createShip(...)` | |
| `updateLocation(worldHex, sector, opts?)` | Moves the ship; if `{tick, campaignId, playerId}` given, also auto-delivers matching passengers/mail |
| `buyCargo(opts)` / `sellCargo(opts)` | |
| `bookPassengers(opts)` / `refundPassenger(...)` | |
| `purchaseFuel(opts)` | Capped at `fuel_capacity − fuel_current` |
| `payDebt(opts)` | Atomic decrement of `ships.credits` + `ship_debts.current_balance`, inserts a `debt_payments` row |
| `acceptMailContract(opts)` | |
| `clear()` | |

### `useRefereeStore`
| State | Description |
|-------|-------------|
| `ships`, `players`, `templates`, `organizations` | Core CRUD lists; ship debts/ownership and organization officers/members/equity/dues/disbursement are **not** store state — managed via direct `api.js` calls in `RefereeView.vue`/`OrganizationsPanel.vue` instead (a deliberate, consistently-applied pattern) |
| `loading`, `error` | |

| Action | Description |
|--------|-------------|
| `clearError()`, `clear()` | |
| `loadShips()`, `createShip(...)`, `updateShip(...)` | |
| `loadShipTemplates()`, `createShipTemplate(...)`, `updateShipTemplate(...)`, `deleteShipTemplate(...)` | |
| `loadOrganizations()`, `createOrganization(...)`, `updateOrganization(...)`, `deleteOrganization(...)` | Core org CRUD only — see `OrganizationsPanel`/`RefereeView` in §2 for officer/member/equity/dues/disbursement calls |
| `assignCrew(...)`, `removeCrew(...)`, `setCrewCanTrade(...)`, `setCrewStateroomOccupancy(...)`, `updateCrewRole(...)` | |
| `loadPlayers()`, `upsertSkill(...)`, `removeSkill(...)` | |
| `createEvent(...)`, `expireEvent(...)` | Manual market events |

### `useThemeStore`
| State | Description |
|-------|-------------|
| `currentId` | Active theme id, seeded from `localStorage` |
| `userThemes` | Custom user-defined themes |
| `revision` | Bump counter forcing reactivity on CSS-variable changes |

| Computed | Description |
|----------|-------------|
| `allThemes` | Builtin + user themes |
| `currentTheme` | |

| Action | Description |
|--------|-------------|
| `applyTheme(theme)` | Writes CSS variables to `:root` |
| `setTheme(id)` | Sets id, persists to `localStorage`, applies |
| `init()` | Loads user themes from IndexedDB, applies the saved preference |
| `saveUserTheme(...)`, `deleteUserTheme(...)` | |
| `exportTheme(...)`, `importTheme(...)` | JSON |

See §8 for the persistence mechanism.

---

## 4. Calendar Data Format

```
tick = integer, 0 = campaign start
year = 1105 + floor(tick / 48)           -- same formula in JS and SQL
day  = (tick % 48) * 7 + 1               -- 1, 8, 15, … 337
month = floor((tick % 48) / 4) + 1       -- 1–12

Display: String(day).padStart(3, '0') + '-' + year
Example: tick 50 → "015-1106"
```

---

## 5. Snapshot Row Format

Rows stored in `market_snapshots`:

```json
{
  "campaign_id": "...",
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

`purchase_price`/`sale_price` are Credits per ton (integer), including trade-code DMs, actual-value roll, TL adjustment, and active event modifiers.

---

## 6. Worker API Response Formats

Every Worker route returns a plain JSON body; the frontend's `src/lib/api.js` normalizes it into a `{ data, error }` envelope regardless of success/failure, so no caller ever needs to branch on HTTP status directly:

```js
// src/lib/api.js
async function request(method, path, body, params) {
  // ... fetch, then:
  if (!res.ok) return { data: null, ...json, error: json.error ?? `HTTP ${res.status}` }
  return { data: json.data ?? null, error: null }
}

export const api = {
  get:    (path, params) => request('GET',    path, undefined, params),
  post:   (path, body)   => request('POST',   path, body),
  patch:  (path, body)   => request('PATCH',  path, body),
  delete: (path, body)   => request('DELETE', path, body),
}
```

Error bodies may carry extra fields beyond `error` (e.g. `locked_until`, `attempts_remaining` on a login lockout) — these are spread directly into the returned object.

### Example: `POST /api/auth/login`
```json
{
  "data": {
    "campaign": { "id": "...", "code": "SPINWARD-42", "label": "...", "milieu": "M1105", "trade_rules": "CT7" },  // or "T5" / "MgT2022"
    "player": { "id": "...", "character_name": "Gvoudzon", "role": "referee", "credits": 0 },
    "token": "..."
  }
}
```

### Example: `POST /api/campaigns/:id/advance-tick`
```json
{ "data": { "tick": 5, "year": 1105, "day": 36, "month": 2 } }
```

### Example: `POST /api/organizations/:id/collect-dues`
```json
{
  "data": {
    "organization": { "id": "...", "treasury_credits": 2000, "last_dues_tick": 20, "...": "..." },
    "collected_total": 1000,
    "paid_ship_ids": ["..."],
    "failed_ship_ids": []
  }
}
```

### Error response (any route)
```json
{ "error": "Human-readable message" }
```

---

## 7. UI Layout

### MapView (main dashboard)

Two-level tab system: **TOP_TABS** select the major section; a second **sub-tab bar** appears when the top tab is Port or Ship.

```
┌────────────────── header (grid: left | center | right) ─────────────────────┐
│ TTS · Campaign Name   │  001-1105 Tick 0 · CT7  [Advance Tick]  │  User [≡]  │  (badge shows CT7/T5/MgT2022)
└─────────────────────────────────────────────────────────────────────────────┘
┌────── sidebar ──────────┬──────────────── main panel ────────────────────────┐
│ Sector                  │ World Name                         UWP ↗            │
│ [filter] [select]       │ Sector · Hex · Subsector                           │
│                         │ [Overview] [Port ▾] [Ship ▾] [Events] [Jump]       │
│ Worlds (n/total)        │ ── sub-tab bar (when Port selected) ───────────── │
│ [filter]                │ [Market] [Passengers] [Services]                   │
│ World/Hex               │ ── sub-tab bar (when Ship selected) ───────────── │
│ ─────────────────       │ [Cargo] [Aboard] [Reports] [Organizations]         │
│ World list (scrollable) ├────────────────────────────────────────────────────┤
│                         │  (sub-tab content — see below)                     │
└─────────────────────────┴────────────────────────────────────────────────────┘
```

Keyboard shortcuts: `O` = Overview, `M` = Port/Market, `C` = Ship/Cargo, `E` = Events, `J` = Jump

### Port sub-tabs

| Sub-tab | Component | Content |
|---------|-----------|---------|
| Market | MarketTable + PriceChart | Trade goods, buy buttons, price chart |
| Passengers | PassengersPanel | Booking form, capacity check, fare preview |
| Services | ShipServices | Fuel purchase + mail contract form |

### Ship sub-tabs

| Sub-tab | Component | Content |
|---------|-----------|---------|
| Cargo | CargoHold | Hold contents, sell flow, live cargo valuation |
| Aboard | AboardPanel (PassengerManifest + ContractsPanel) | Occupancy, in-transit passengers, in-transit mail |
| Reports | ReportsPanel | Ledger, Trades, Income, Debts, Net Worth |
| Organizations | OrganizationsPanel | Browse/found/manage organizations, dues, disbursement, equity, fleet report |

### Referee Panel (RefereeView)

```
┌── Ships │ Players │ Organizations │ Events │ Campaign ─────────────────────┐
│                                                                             │
│  Ships tab:         Ship list → expand → stat grid → crew table            │
│                     Templates sub-panel, Debts sub-panel, Ownership section │
│                     Edit form auto-delivers matching passengers/mail on move│
│  Players tab:       Character list → expand → skill management             │
│  Organizations tab: Org list → expand → treasury/dues edit, Officers table, │
│                     Member Ships table (Owned toggle), Disbursement form,   │
│                     Equity table, Fleet Report                             │
│  Events tab:        Active event list, create event form, event catalogue  │
│  Campaign tab:      Campaign label edit, recovery code regeneration,       │
│                     danger zone (delete campaign)                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Theme System

Themes are defined as token maps in `src/lib/themes-builtin.js` (name → CSS variable values). **Persistence is entirely client-side** — there is no server component to theming and no Supabase involvement:

- The active theme **id** is persisted to `localStorage` under key **`tts-theme-id`**.
- Custom user-created themes (full token definitions) are persisted in **IndexedDB**, database `traveller-trade-sim` (v1), object store `user-themes` (keyPath `id`), via `src/lib/theme-db.js`.
- The Pinia `theme.js` store's `init()` action loads both on app start and applies the saved preference; `currentId`/`userThemes` are its in-memory reactive mirror of that persisted state, not a separate source of truth.

CSS variables are injected into `:root` on theme change via `src/lib/theme-tokens.js`. Core variables: `--bg`, `--bg-panel`, `--bg-item`, `--bg-selected`, `--text`, `--text-dim`, `--border`, `--accent`, `--accent-dim`, `--accent-text`, `--code`, `--red`, `--green`, `--amber`, `--surface-error`, `--text-error`, `--radius`.

`--accent-text` (added 2026-07-13) is the text color used on `--accent`/`--accent-dim` buttons — it exists as its own token, rather than every component hardcoding a literal `#fff`, because the correct choice (light or dark text) depends on the accent color's own brightness and is theme-specific: `dark-imperium`'s charcoal-and-gold palette needs dark text (`#1c1c1c`) for AA contrast, while `light-merchant`/`sepia-ancients` still need light text (`#ffffff`). All three built-in themes are WCAG 2.2 AA verified via computed relative-luminance contrast ratios (normal text ≥ 4.5:1, UI components ≥ 3:1) — see the inline ratio comments in `themes-builtin.js`. `dark-imperium` was repainted from a navy palette to a charcoal/graphite one on 2026-07-13; the redesign required re-verifying every token pairing from scratch, which is how the `--accent-text` gap was caught (plain white button text on the new, lighter `--accent-dim` gold measured only 3.71:1).
