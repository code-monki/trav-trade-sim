-- ============================================================
-- Migration 015: Find a Supplier attempt tracking
--
-- Part of the trade/traffic rules-accuracy rebuild (see DEVLOG.md). "Find
-- a Supplier" is a real, character-based, one-click check (Broker/
-- Streetwise/Admin skill + starport DM, target 8+) gating whether a
-- player can see a world's market this tick — not an ambient world
-- property. The book applies DM-1 per previous attempt on the same world
-- in the same (game) month, which requires tracking attempts somewhere;
-- nothing in the schema did this before.
--
-- month_key is derived from the tick (see TICKS_PER_MONTH in
-- market-tick.js) rather than a calendar date, consistent with how the
-- rest of this app already buckets time.
-- ============================================================

CREATE TABLE IF NOT EXISTS supplier_search_attempts (
  id          TEXT    PRIMARY KEY,
  campaign_id TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  player_id   TEXT    NOT NULL REFERENCES players(id)   ON DELETE CASCADE,
  world_hex   TEXT    NOT NULL,
  sector      TEXT    NOT NULL,
  month_key   INTEGER NOT NULL, -- floor(tick / TICKS_PER_MONTH)
  attempts    INTEGER NOT NULL DEFAULT 0,
  succeeded   INTEGER NOT NULL DEFAULT 0 CHECK (succeeded IN (0, 1)),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (player_id, world_hex, sector, month_key)
);

CREATE INDEX IF NOT EXISTS idx_supplier_search_player
  ON supplier_search_attempts (campaign_id, player_id, world_hex, sector, month_key);

INSERT INTO schema_migrations (id, applied_at) VALUES ('015', unixepoch());
