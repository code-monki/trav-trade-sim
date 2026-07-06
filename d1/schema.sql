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
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ships_campaign
  ON ships (campaign_id);

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

-- ── Passenger Manifests ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS passenger_manifests (
  id                TEXT    PRIMARY KEY,
  campaign_id       TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ship_id           TEXT    NOT NULL REFERENCES ships(id)     ON DELETE CASCADE,
  player_id         TEXT    REFERENCES players(id),
  passage_type      TEXT    NOT NULL CHECK (passage_type IN ('high', 'middle', 'low')),
  count             INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
  embark_world_hex  TEXT    NOT NULL,
  embark_sector     TEXT    NOT NULL,
  embark_world_name TEXT,
  embark_tick       INTEGER NOT NULL,
  dest_world_hex    TEXT    NOT NULL,
  dest_sector       TEXT    NOT NULL,
  dest_world_name   TEXT,
  fare_per_head     INTEGER NOT NULL,
  fare_total        INTEGER NOT NULL,
  status            TEXT    NOT NULL DEFAULT 'in_transit'
                    CHECK (status IN ('in_transit', 'delivered', 'refunded')),
  resolve_tick      INTEGER,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_passengers_ship
  ON passenger_manifests (campaign_id, ship_id, status);
CREATE INDEX IF NOT EXISTS idx_passengers_dest
  ON passenger_manifests (dest_world_hex, dest_sector)
  WHERE status = 'in_transit';

-- ── Mail Contracts ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mail_contracts (
  id                TEXT    PRIMARY KEY,
  campaign_id       TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ship_id           TEXT    NOT NULL REFERENCES ships(id)     ON DELETE CASCADE,
  player_id         TEXT    REFERENCES players(id),
  origin_world_hex  TEXT    NOT NULL,
  origin_sector     TEXT    NOT NULL,
  origin_world_name TEXT,
  accept_tick       INTEGER NOT NULL,
  dest_world_hex    TEXT    NOT NULL,
  dest_sector       TEXT    NOT NULL,
  dest_world_name   TEXT,
  parsecs           INTEGER NOT NULL DEFAULT 1 CHECK (parsecs > 0),
  payment           INTEGER NOT NULL,
  status            TEXT    NOT NULL DEFAULT 'in_transit'
                    CHECK (status IN ('in_transit', 'delivered')),
  resolve_tick      INTEGER,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mail_ship
  ON mail_contracts (campaign_id, ship_id, status);

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
