-- ============================================================
-- Migration 010: Mongoose Traveller 2022 (MgT2022) trade ruleset
--
-- Widens the two `trade_rules` CHECK constraints ('CT7','T5' only) to a
-- third value, 'MgT2022'. SQLite can't ALTER a CHECK constraint in place,
-- so both tables are rebuilt (create-new/copy/drop/rename).
--
-- Also extends `obligations` for the new 'freight' kind and MgT2022's
-- Basic Passage tier, and widens `transactions.type` for freight's three
-- new transaction kinds.
--
-- Finally adds `traffic_snapshots`, a MgT2022-only table for the new
-- population/starport-driven passenger/freight/mail availability rolls.
-- CT7/T5 campaigns never write or read this table — passengers/freight/
-- mail stay unlimited-subject-to-ship-capacity for those rulesets, same
-- as before this migration.
-- ============================================================

PRAGMA foreign_keys=OFF;

-- realized_ohlcv depends on trade_records — drop it first so rebuilding that
-- table below doesn't fail schema validation, then recreate it identically
-- at the end of this migration.
DROP VIEW IF EXISTS realized_ohlcv;

-- ── ship_templates: widen trade_rules CHECK ───────────────────────────────────

CREATE TABLE ship_templates_new (
  id                    TEXT    PRIMARY KEY,
  campaign_id           TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  trade_rules           TEXT    NOT NULL CHECK (trade_rules IN ('CT7', 'T5', 'MgT2022')),
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

INSERT INTO ship_templates_new
  SELECT id, campaign_id, trade_rules, name, hull_type, hull_tons, cargo_capacity,
         jump_rating, maneuver_drive_rating, stateroom_capacity, low_berth_capacity,
         fuel_capacity, market_value, notes, created_at
  FROM ship_templates;

DROP TABLE ship_templates;
ALTER TABLE ship_templates_new RENAME TO ship_templates;

CREATE INDEX IF NOT EXISTS idx_ship_templates_campaign
  ON ship_templates (campaign_id, trade_rules);

-- ── trade_records: widen trade_rules CHECK ────────────────────────────────────

CREATE TABLE trade_records_new (
  id                        TEXT    PRIMARY KEY,
  campaign_id               TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  player_id                 TEXT    NOT NULL REFERENCES players(id)   ON DELETE CASCADE,
  ship_id                   TEXT    REFERENCES ships(id) ON DELETE SET NULL,
  trade_rules               TEXT    NOT NULL CHECK (trade_rules IN ('CT7', 'T5', 'MgT2022')),
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

INSERT INTO trade_records_new SELECT * FROM trade_records;

DROP TABLE trade_records;
ALTER TABLE trade_records_new RENAME TO trade_records;

CREATE INDEX IF NOT EXISTS idx_trade_records_market
  ON trade_records (campaign_id, market_world_hex, market_sector, trade_good_die, sell_tick DESC);
CREATE INDEX IF NOT EXISTS idx_trade_records_player
  ON trade_records (campaign_id, player_id, sell_tick DESC);
CREATE INDEX IF NOT EXISTS idx_trade_records_route
  ON trade_records (campaign_id, source_world_hex, market_world_hex, sell_tick DESC);
CREATE INDEX IF NOT EXISTS idx_trade_records_ship
  ON trade_records (campaign_id, ship_id, sell_tick DESC);

-- ── obligations: widen kind CHECK, add freight + due_tick columns ─────────────

CREATE TABLE obligations_new (
  id                TEXT    PRIMARY KEY,
  campaign_id       TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ship_id           TEXT    NOT NULL REFERENCES ships(id)     ON DELETE CASCADE,
  player_id         TEXT    REFERENCES players(id),
  kind              TEXT    NOT NULL CHECK (kind IN ('mail', 'passenger', 'freight')),
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
  due_tick          INTEGER,  -- freight only: deadline tick for on-time delivery
  passage_type      TEXT,     -- passenger only: 'high' | 'middle' | 'basic' | 'low'
  passenger_count   INTEGER,  -- passenger only
  fare_per_head     INTEGER,  -- passenger only
  parsecs           INTEGER,  -- mail + freight
  freight_tons      INTEGER,  -- freight only
  freight_lot_size  TEXT,     -- freight only: 'major' | 'minor' | 'incidental'
  rate_per_ton      INTEGER,  -- freight only: agreed Cr/ton for the whole run
  notes             TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO obligations_new (
  id, campaign_id, ship_id, player_id, kind, status, amount,
  origin_world_hex, origin_sector, origin_world_name,
  dest_world_hex, dest_sector, dest_world_name,
  accept_tick, resolve_tick, passage_type, passenger_count, fare_per_head,
  parsecs, notes, created_at
)
SELECT
  id, campaign_id, ship_id, player_id, kind, status, amount,
  origin_world_hex, origin_sector, origin_world_name,
  dest_world_hex, dest_sector, dest_world_name,
  accept_tick, resolve_tick, passage_type, passenger_count, fare_per_head,
  parsecs, notes, created_at
FROM obligations;

DROP TABLE obligations;
ALTER TABLE obligations_new RENAME TO obligations;

CREATE INDEX IF NOT EXISTS idx_obligations_ship
  ON obligations (campaign_id, ship_id, kind, status);
CREATE INDEX IF NOT EXISTS idx_obligations_dest
  ON obligations (dest_world_hex, dest_sector)
  WHERE status = 'pending';

-- ── transactions: widen type CHECK for freight ────────────────────────────────

CREATE TABLE transactions_new (
  id              TEXT    PRIMARY KEY,
  campaign_id     TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  player_id       TEXT    NOT NULL REFERENCES players(id)   ON DELETE CASCADE,
  ship_id         TEXT    REFERENCES ships(id) ON DELETE SET NULL,
  tick            INTEGER NOT NULL,
  type            TEXT    NOT NULL CHECK (type IN (
                    'buy', 'sell', 'fee', 'event',
                    'fuel', 'passenger_fare', 'passenger_refund', 'mail',
                    'freight_charge', 'freight_refund', 'freight_penalty'
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

INSERT INTO transactions_new SELECT * FROM transactions;

DROP TABLE transactions;
ALTER TABLE transactions_new RENAME TO transactions;

CREATE INDEX IF NOT EXISTS idx_txn_player
  ON transactions (campaign_id, player_id, tick DESC);
CREATE INDEX IF NOT EXISTS idx_txn_ship
  ON transactions (campaign_id, ship_id, tick DESC);

PRAGMA foreign_keys=ON;

-- ── traffic_snapshots: MgT2022-only passenger/freight/mail scarcity rolls ─────
-- One row per (campaign, world, tick), generated automatically alongside the
-- market snapshot (see src/lib/traffic-tick.js), same deterministic-seeding
-- discipline as market_snapshots. CT7/T5 campaigns never populate this table.

CREATE TABLE IF NOT EXISTS traffic_snapshots (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id             TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  world_hex               TEXT    NOT NULL,
  sector                  TEXT    NOT NULL,
  tick                    INTEGER NOT NULL,
  high_passages           INTEGER NOT NULL DEFAULT 0,
  middle_passages         INTEGER NOT NULL DEFAULT 0,
  basic_passages          INTEGER NOT NULL DEFAULT 0,
  low_passages            INTEGER NOT NULL DEFAULT 0,
  major_freight_lots      INTEGER NOT NULL DEFAULT 0,
  minor_freight_lots      INTEGER NOT NULL DEFAULT 0,
  incidental_freight_lots INTEGER NOT NULL DEFAULT 0,
  mail_containers         INTEGER NOT NULL DEFAULT 0,
  created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, world_hex, sector, tick)
);

CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_lookup
  ON traffic_snapshots (campaign_id, world_hex, sector, tick);

-- ── Recreate realized_ohlcv (dropped above; identical to schema.sql) ─────────

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
