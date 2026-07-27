-- ============================================================
-- Migration 017: traffic_snapshots becomes per-route
--
-- Part of the trade/traffic rules-accuracy rebuild (see DEVLOG.md). The
-- real MgT2022 "SEEKING PASSENGERS"/"FREIGHT" rules apply population/
-- starport DMs from BOTH the origin AND destination world, plus a
-- distance penalty ("each parsec of destination past the first: DM-1") —
-- so traffic availability is a function of (ship, origin world,
-- destination world, tick), not just (ship, origin world, tick) as
-- migration 016 left it. Two players asking about different destinations
-- from the same world/tick can get different numbers.
--
-- traffic_snapshots remains pure deterministic cache data (regenerable
-- from its inputs, never referenced by any other table) — no existing
-- row has a meaningful destination under the new schema (traffic used to
-- be destination-independent), so the simplest safe migration is again to
-- drop and recreate it empty, with dest_world_hex/dest_sector in both the
-- row and the UNIQUE constraint (SQLite can't ALTER a UNIQUE constraint
-- in place). Booked obligations live in `obligations`, untouched by this.
-- ============================================================

DROP TABLE IF EXISTS traffic_snapshots;

CREATE TABLE traffic_snapshots (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id             TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ship_id                 TEXT    NOT NULL REFERENCES ships(id)     ON DELETE CASCADE,
  world_hex               TEXT    NOT NULL,
  sector                  TEXT    NOT NULL,
  dest_world_hex          TEXT    NOT NULL,
  dest_sector             TEXT    NOT NULL,
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
  UNIQUE (campaign_id, ship_id, world_hex, sector, dest_world_hex, dest_sector, tick)
);

CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_lookup
  ON traffic_snapshots (campaign_id, ship_id, world_hex, sector, dest_world_hex, dest_sector, tick);

INSERT INTO schema_migrations (id, applied_at) VALUES ('017', unixepoch());
