-- ============================================================
-- Migration 018: Black Market support
--
-- Part of the trade/traffic rules-accuracy rebuild (see DEVLOG.md).
-- `isRerollRequired()`/`resolveGood()` in trade-engine-mgt2022.js already
-- support a `seekingBlackMarket` flag (skips the 61-65 reroll, exposing
-- illegal goods) but nothing has ever set it to true. Black-market access
-- works like Find a Supplier's existing one-click check, but ship-wide
-- rather than per-player: whichever crew member has the highest
-- Streetwise skill is used automatically, and success unlocks a black-
-- market goods view for the whole ship's crew for the rest of the game-
-- month.
--
-- market_snapshots keeps its (campaign_id, world_hex, sector, tick)
-- grain for pricing/history — black-market rows are a SECOND, parallel
-- composition for the same world/tick, distinguished by is_black_market,
-- not a per-ship concept (the goods/prices themselves aren't ship-
-- dependent, only whether a given ship has found access to them).
--
-- Unlike traffic_snapshots (pure current-tick scarcity, safely dropped
-- and recreated in migrations 016/017), market_snapshots holds real
-- price HISTORY that price charts already read — rebuilt via a copy-and-
-- rename instead of a destructive drop, since SQLite can't ALTER a
-- UNIQUE constraint in place and existing rows must survive.
-- ============================================================

CREATE TABLE market_snapshots_new (
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
  is_black_market INTEGER NOT NULL DEFAULT 0 CHECK (is_black_market IN (0, 1)),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, world_hex, sector, trade_good_die, tick, is_black_market)
);

INSERT INTO market_snapshots_new
  (id, campaign_id, world_hex, sector, trade_good_die, trade_good_name, tick,
   purchase_price, sale_price, qty_available, source_codes, is_black_market, created_at)
SELECT
  id, campaign_id, world_hex, sector, trade_good_die, trade_good_name, tick,
  purchase_price, sale_price, qty_available, source_codes, 0, created_at
FROM market_snapshots;

DROP TABLE market_snapshots;
ALTER TABLE market_snapshots_new RENAME TO market_snapshots;

CREATE INDEX IF NOT EXISTS idx_snapshots_world
  ON market_snapshots (campaign_id, world_hex, sector, tick DESC);

CREATE TABLE black_market_search_attempts (
  id          TEXT    PRIMARY KEY,
  campaign_id TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ship_id     TEXT    NOT NULL REFERENCES ships(id)     ON DELETE CASCADE,
  world_hex   TEXT    NOT NULL,
  sector      TEXT    NOT NULL,
  month_key   INTEGER NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  succeeded   INTEGER NOT NULL DEFAULT 0 CHECK (succeeded IN (0, 1)),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (ship_id, world_hex, sector, month_key)
);

CREATE INDEX IF NOT EXISTS idx_black_market_ship
  ON black_market_search_attempts (campaign_id, ship_id, world_hex, sector, month_key);

INSERT INTO schema_migrations (id, applied_at) VALUES ('018', unixepoch());
