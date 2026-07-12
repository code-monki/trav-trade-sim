-- ============================================================
-- Traveller Trade Simulator — D1 (SQLite) consolidated schema
-- Derived from Supabase migrations 001–022.
--
-- Key differences from the PostgreSQL schema:
--   - UUID primary keys are TEXT; generated in Worker code via
--     crypto.randomUUID() and passed in at INSERT time.
--   - TIMESTAMPTZ → TEXT (ISO 8601 UTC, e.g. "2026-07-05T12:00:00Z")
--   - BOOLEAN → INTEGER (0 = false, 1 = true)
--   - BIGINT / INT / SMALLINT → INTEGER
--   - No stored functions — all RPC logic lives in the Worker.
--   - No RLS — authorization is enforced in the Worker.
--   - D1 enables PRAGMA foreign_keys = ON for every connection.
--   - players.ship_name / players.current_world are omitted;
--     they were deprecated in migration 011.
-- ============================================================

-- ── Campaigns ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaigns (
  id                 TEXT    PRIMARY KEY,
  code               TEXT    NOT NULL UNIQUE,
  label              TEXT    NOT NULL,
  milieu             TEXT    NOT NULL DEFAULT 'M1105',
  trade_rules        TEXT    NOT NULL DEFAULT 'CT7',
  recovery_code_hash TEXT,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Imperial Calendar ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaign_calendar (
  campaign_id  TEXT    PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  current_tick INTEGER NOT NULL DEFAULT 0,
  year         INTEGER NOT NULL DEFAULT 1105,
  day          INTEGER NOT NULL DEFAULT 1,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Players ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS players (
  id              TEXT    PRIMARY KEY,
  campaign_id     TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  character_name  TEXT    NOT NULL,
  pin_hash        TEXT    NOT NULL,
  role            TEXT    NOT NULL DEFAULT 'player',
  credits         INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TEXT,
  last_seen       TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, character_name)
);

-- ── Ships ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ships (
  id                    TEXT    PRIMARY KEY,
  campaign_id           TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name                  TEXT    NOT NULL,
  hull_type             TEXT,
  hull_tons             INTEGER NOT NULL DEFAULT 200,
  cargo_capacity        INTEGER NOT NULL DEFAULT 80,
  current_world         TEXT,
  current_sector        TEXT,
  credits               INTEGER NOT NULL DEFAULT 0,
  jump_rating           INTEGER,
  maneuver_drive_rating INTEGER,
  stateroom_capacity    INTEGER NOT NULL DEFAULT 0,
  low_berth_capacity    INTEGER NOT NULL DEFAULT 0,
  fuel_capacity         INTEGER NOT NULL DEFAULT 0,
  fuel_current          INTEGER NOT NULL DEFAULT 0,
  market_value          INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ships_campaign
  ON ships (campaign_id);

-- ── Ship Templates ────────────────────────────────────────────────────────────
-- Referee-managed catalogue of canonical ship designs for the New Ship form.
-- Ruleset-tagged since hull tonnage/cost/drive ratings vary by edition even
-- for the "same" archetype. No persistent link to ships created from one —
-- it's a one-time form-fill; every field is independently editable after.

CREATE TABLE IF NOT EXISTS ship_templates (
  id                    TEXT    PRIMARY KEY,
  campaign_id           TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  trade_rules           TEXT    NOT NULL CHECK (trade_rules IN ('CT7', 'T5')),
  name                  TEXT    NOT NULL,
  hull_type             TEXT,
  hull_tons             INTEGER NOT NULL DEFAULT 200,
  cargo_capacity        INTEGER NOT NULL DEFAULT 80,
  jump_rating           INTEGER,
  maneuver_drive_rating INTEGER,
  stateroom_capacity    INTEGER NOT NULL DEFAULT 0,
  low_berth_capacity    INTEGER NOT NULL DEFAULT 0,
  fuel_capacity         INTEGER NOT NULL DEFAULT 0,
  market_value          INTEGER NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ship_templates_campaign
  ON ship_templates (campaign_id, trade_rules);

-- ── Ship Debts ────────────────────────────────────────────────────────────────
-- No interest — Traveller doesn't define compounding mechanics; Referee
-- manages the balance directly. ship_id is nullable so a future corporate/
-- fleet-level debt (not tied to one hull) can reuse this table.

CREATE TABLE IF NOT EXISTS ship_debts (
  id              TEXT    PRIMARY KEY,
  campaign_id     TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ship_id         TEXT    REFERENCES ships(id) ON DELETE CASCADE,
  type            TEXT    NOT NULL CHECK (type IN ('mortgage', 'loan', 'obligation')),
  creditor_name   TEXT,
  principal       INTEGER NOT NULL,
  current_balance INTEGER NOT NULL,
  due_tick        INTEGER,
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ship_debts_ship
  ON ship_debts (campaign_id, ship_id);

-- ── Debt Payments ─────────────────────────────────────────────────────────────
-- Separate from `transactions` since that table's `type` is a CHECK
-- constraint SQLite can't ALTER in place; a dedicated table avoids a
-- recreate-and-copy migration and gives a cleaner per-debt audit trail.

CREATE TABLE IF NOT EXISTS debt_payments (
  id          TEXT    PRIMARY KEY,
  debt_id     TEXT    NOT NULL REFERENCES ship_debts(id) ON DELETE CASCADE,
  campaign_id TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ship_id     TEXT    REFERENCES ships(id) ON DELETE SET NULL,
  tick        INTEGER NOT NULL,
  amount      INTEGER NOT NULL,
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt
  ON debt_payments (debt_id, tick DESC);

-- ── Ship Ownership ────────────────────────────────────────────────────────────
-- Multiple players jointly owning one ship (a partnership). Independent of
-- Organizations below — this is specifically player-shares-of-a-ship.

CREATE TABLE IF NOT EXISTS ship_ownership (
  id          TEXT    PRIMARY KEY,
  campaign_id TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ship_id     TEXT    NOT NULL REFERENCES ships(id)   ON DELETE CASCADE,
  player_id   TEXT    NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  percentage  INTEGER NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (ship_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_ship_ownership_ship
  ON ship_ownership (ship_id);

-- ── Organizations ─────────────────────────────────────────────────────────────
-- Generic entity — corporation, confederation, and trade union are all this,
-- differentiated only by configuration (see docs/financial-model-gap-analysis.md
-- "Future: Corporation / Fleet"). Phase 1: entity + membership only, no dues/
-- disbursement actions yet.

CREATE TABLE IF NOT EXISTS organizations (
  id               TEXT    PRIMARY KEY,
  campaign_id      TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  treasury_credits INTEGER NOT NULL DEFAULT 0,
  dues_rate        INTEGER,
  notes            TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, name)
);

-- ── Organization Members ──────────────────────────────────────────────────────
-- A ship's affiliation with an org. owns_ship=1 means the org owns this ship's
-- assets/debts outright (corporation/fleet); owns_ship=0 means the ship stays
-- independently owned, just dues/reporting-affiliated (confederation).

CREATE TABLE IF NOT EXISTS organization_members (
  id              TEXT    PRIMARY KEY,
  organization_id TEXT    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ship_id         TEXT    NOT NULL REFERENCES ships(id)         ON DELETE CASCADE,
  owns_ship       INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, ship_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org
  ON organization_members (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_ship
  ON organization_members (ship_id);

-- ── Organization Officers ─────────────────────────────────────────────────────
-- Players authorized to manage an organization. Flat list, no role hierarchy —
-- any officer can manage the org fully, including adding/removing other
-- officers. Referees can always override regardless of officer status.

CREATE TABLE IF NOT EXISTS organization_officers (
  id              TEXT    PRIMARY KEY,
  organization_id TEXT    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_id       TEXT    NOT NULL REFERENCES players(id)       ON DELETE CASCADE,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_org_officers_org
  ON organization_officers (organization_id);

-- ── Crew Manifest ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crew (
  id          TEXT    PRIMARY KEY,
  campaign_id TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ship_id     TEXT    NOT NULL REFERENCES ships(id)     ON DELETE CASCADE,
  player_id   TEXT    NOT NULL REFERENCES players(id)   ON DELETE CASCADE,
  role          TEXT    NOT NULL DEFAULT 'crew',
  can_trade     INTEGER NOT NULL DEFAULT 0,
  has_stateroom INTEGER NOT NULL DEFAULT 1,
  joined_tick   INTEGER NOT NULL DEFAULT 0,
  left_tick     INTEGER,
  UNIQUE (ship_id, player_id, joined_tick)
);

CREATE INDEX IF NOT EXISTS idx_crew_player
  ON crew (campaign_id, player_id, left_tick);
CREATE INDEX IF NOT EXISTS idx_crew_ship
  ON crew (campaign_id, ship_id);

-- ── Player Skills ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS player_skills (
  id          TEXT    PRIMARY KEY,
  campaign_id TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  player_id   TEXT    NOT NULL REFERENCES players(id)   ON DELETE CASCADE,
  skill       TEXT    NOT NULL,
  level       INTEGER NOT NULL DEFAULT 0 CHECK (level >= 0),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (player_id, skill)
);

CREATE INDEX IF NOT EXISTS idx_player_skills_player
  ON player_skills (campaign_id, player_id);

-- ── Market Snapshots ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_snapshots (
  id              TEXT    PRIMARY KEY,
  campaign_id     TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  world_hex       TEXT    NOT NULL,
  sector          TEXT    NOT NULL,
  trade_good_die  TEXT    NOT NULL,
  trade_good_name TEXT    NOT NULL,
  tick            INTEGER NOT NULL,
  purchase_price  INTEGER NOT NULL,
  sale_price      INTEGER NOT NULL,
  qty_available   INTEGER NOT NULL,
  source_codes    TEXT    NOT NULL DEFAULT '',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, world_hex, sector, trade_good_die, tick)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_world
  ON market_snapshots (campaign_id, world_hex, sector, tick DESC);

-- ── Monthly OHLC Rollup ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_monthly (
  id             TEXT    PRIMARY KEY,
  campaign_id    TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  world_hex      TEXT    NOT NULL,
  sector         TEXT    NOT NULL,
  trade_good_die TEXT    NOT NULL,
  year           INTEGER NOT NULL,
  month          INTEGER NOT NULL,
  open_price     INTEGER NOT NULL,
  high_price     INTEGER NOT NULL,
  low_price      INTEGER NOT NULL,
  close_price    INTEGER NOT NULL,
  volume_tons    INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, world_hex, sector, trade_good_die, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_world
  ON market_monthly (campaign_id, world_hex, sector, trade_good_die, year, month);

-- ── Annual OHLC Rollup ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_annual (
  id             TEXT    PRIMARY KEY,
  campaign_id    TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  world_hex      TEXT    NOT NULL,
  sector         TEXT    NOT NULL,
  trade_good_die TEXT    NOT NULL,
  year           INTEGER NOT NULL,
  open_price     INTEGER NOT NULL,
  high_price     INTEGER NOT NULL,
  low_price      INTEGER NOT NULL,
  close_price    INTEGER NOT NULL,
  volume_tons    INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, world_hex, sector, trade_good_die, year)
);

-- ── Market Events ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_events (
  id                TEXT    PRIMARY KEY,
  campaign_id       TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  tick              INTEGER NOT NULL,
  scope             TEXT    NOT NULL CHECK (scope IN ('local', 'subsector')),
  world_hex         TEXT,
  sector            TEXT,
  trade_good_die    TEXT,
  buy_modifier_pct  INTEGER,
  sell_modifier_pct INTEGER,
  description       TEXT    NOT NULL,
  expires_tick      INTEGER,
  severity          TEXT    NOT NULL DEFAULT 'minor'
                    CHECK (severity IN ('minor', 'major', 'crisis')),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_world
  ON market_events (campaign_id, world_hex, sector, tick DESC);

-- ── Cargo ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cargo (
  id                  TEXT    PRIMARY KEY,
  campaign_id         TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  player_id           TEXT    NOT NULL REFERENCES players(id)   ON DELETE CASCADE,
  ship_id             TEXT    REFERENCES ships(id) ON DELETE SET NULL,
  trade_good_die      TEXT    NOT NULL,
  trade_good_name     TEXT    NOT NULL,
  tons                INTEGER NOT NULL CHECK (tons > 0),
  purchase_price      INTEGER NOT NULL,
  purchased_tick      INTEGER NOT NULL,
  purchase_world      TEXT    NOT NULL,
  purchase_sector     TEXT    NOT NULL,
  purchase_world_name TEXT    NOT NULL DEFAULT '',
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cargo_player
  ON cargo (campaign_id, player_id);
CREATE INDEX IF NOT EXISTS idx_cargo_ship
  ON cargo (campaign_id, ship_id);

-- ── Transactions ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  id              TEXT    PRIMARY KEY,
  campaign_id     TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  player_id       TEXT    NOT NULL REFERENCES players(id)   ON DELETE CASCADE,
  ship_id         TEXT    REFERENCES ships(id) ON DELETE SET NULL,
  tick            INTEGER NOT NULL,
  type            TEXT    NOT NULL CHECK (type IN (
                    'buy', 'sell', 'fee', 'event',
                    'fuel', 'passenger_fare', 'passenger_refund', 'mail'
                  )),
  trade_good_die  TEXT,
  trade_good_name TEXT,
  tons            INTEGER,
  price_per_ton   INTEGER,
  total_cr        INTEGER NOT NULL,
  world_hex       TEXT,
  sector          TEXT,
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_txn_player
  ON transactions (campaign_id, player_id, tick DESC);
CREATE INDEX IF NOT EXISTS idx_txn_ship
  ON transactions (campaign_id, ship_id, tick DESC);

-- ── Trade Records ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trade_records (
  id                        TEXT    PRIMARY KEY,
  campaign_id               TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  player_id                 TEXT    NOT NULL REFERENCES players(id)   ON DELETE CASCADE,
  ship_id                   TEXT    REFERENCES ships(id) ON DELETE SET NULL,
  trade_rules               TEXT    NOT NULL CHECK (trade_rules IN ('CT7', 'T5')),
  trade_good_die            TEXT    NOT NULL,
  trade_good_name           TEXT    NOT NULL,
  tons                      INTEGER NOT NULL CHECK (tons > 0),
  cargo_id_t5               TEXT,
  source_world_hex          TEXT    NOT NULL,
  source_sector             TEXT    NOT NULL,
  purchase_tick             INTEGER NOT NULL,
  buy_price_per_ton         INTEGER NOT NULL,
  total_cost                INTEGER NOT NULL,
  market_world_hex          TEXT    NOT NULL,
  market_sector             TEXT    NOT NULL,
  sell_tick                 INTEGER NOT NULL,
  tc_adjusted_price_per_ton INTEGER,
  trade_price_per_ton       INTEGER NOT NULL,
  sell_price_per_ton        INTEGER NOT NULL,
  effective_flux            INTEGER,
  broker_dm                 INTEGER,
  broker_fee_total          INTEGER,
  total_revenue             INTEGER NOT NULL,
  net_profit                INTEGER NOT NULL,
  created_at                TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trade_records_market
  ON trade_records (campaign_id, market_world_hex, market_sector, trade_good_die, sell_tick DESC);
CREATE INDEX IF NOT EXISTS idx_trade_records_player
  ON trade_records (campaign_id, player_id, sell_tick DESC);
CREATE INDEX IF NOT EXISTS idx_trade_records_route
  ON trade_records (campaign_id, source_world_hex, market_world_hex, sell_tick DESC);
CREATE INDEX IF NOT EXISTS idx_trade_records_ship
  ON trade_records (campaign_id, ship_id, sell_tick DESC);

-- ── Obligations ───────────────────────────────────────────────────────────────
-- General pending-commercial-commitment table. Unifies what used to be two
-- separate tables (passenger_manifests, mail_contracts) under a `kind`
-- discriminator so future obligation types (charter deposits, insurance
-- claims, referee-issued IOUs, ...) don't need their own one-off table.

CREATE TABLE IF NOT EXISTS obligations (
  id                TEXT    PRIMARY KEY,
  campaign_id       TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ship_id           TEXT    NOT NULL REFERENCES ships(id)     ON DELETE CASCADE,
  player_id         TEXT    REFERENCES players(id),
  kind              TEXT    NOT NULL CHECK (kind IN ('mail', 'passenger')),
  status            TEXT    NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  amount            INTEGER NOT NULL,
  origin_world_hex  TEXT,
  origin_sector     TEXT,
  origin_world_name TEXT,
  dest_world_hex    TEXT    NOT NULL,
  dest_sector       TEXT    NOT NULL,
  dest_world_name   TEXT,
  accept_tick       INTEGER NOT NULL,
  resolve_tick      INTEGER,
  passage_type      TEXT,     -- passenger only: 'high' | 'middle' | 'low'
  passenger_count   INTEGER,  -- passenger only
  fare_per_head     INTEGER,  -- passenger only
  parsecs           INTEGER,  -- mail only
  notes             TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_obligations_ship
  ON obligations (campaign_id, ship_id, kind, status);
CREATE INDEX IF NOT EXISTS idx_obligations_dest
  ON obligations (dest_world_hex, dest_sector)
  WHERE status = 'pending';

-- ── Realized OHLCV View ───────────────────────────────────────────────────────
-- Inline equivalents of the Postgres helper functions:
--   tick_year(t)  = 1105 + t / 48   (integer division)
--   tick_month(t) = (t / 4) % 12 + 1

CREATE VIEW IF NOT EXISTS realized_ohlcv AS
SELECT
  campaign_id,
  market_world_hex                       AS world_hex,
  market_sector                          AS sector,
  trade_good_die,
  (1105 + sell_tick / 48)                AS year,
  ((sell_tick / 4) % 12 + 1)            AS month,
  first_value(sell_price_per_ton) OVER w AS open_price,
  max(sell_price_per_ton)         OVER w AS high_price,
  min(sell_price_per_ton)         OVER w AS low_price,
  last_value(sell_price_per_ton)  OVER w AS close_price,
  sum(tons)                       OVER w AS volume_tons,
  count(*)                        OVER w AS trade_count
FROM trade_records
WINDOW w AS (
  PARTITION BY
    campaign_id,
    market_world_hex,
    market_sector,
    trade_good_die,
    (1105 + sell_tick / 48),
    ((sell_tick / 4) % 12 + 1)
  ORDER BY sell_tick
  ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
);
