-- ============================================================
-- Migration 016: traffic_snapshots becomes per-ship
--
-- Part of the trade/traffic rules-accuracy rebuild (see DEVLOG.md). The
-- real MgT2022 "SEEKING PASSENGERS"/"FREIGHT"/"MAIL" rules feed a ship's
-- own crew skills (Steward, Broker, Carouse, Streetwise, Naval/Scout rank,
-- SOC) into the passenger/freight/mail traffic-availability roll — so
-- availability is now a function of (ship, world, tick), not just
-- (world, tick): two different ships docked at the same world can find
-- different amounts of business.
--
-- traffic_snapshots is pure deterministic cache data (regenerable from its
-- inputs, never referenced by any other table), and no existing row has a
-- meaningful ship_id under the new schema (traffic used to be
-- ship-independent) — so the simplest safe migration is to drop and
-- recreate it empty, with ship_id in both the row and the UNIQUE
-- constraint (SQLite can't ALTER a UNIQUE constraint in place). Booked
-- obligations (passengers/freight/mail actually accepted) live in
-- `obligations`, untouched by this.
-- ============================================================

DROP TABLE IF EXISTS traffic_snapshots;

CREATE TABLE traffic_snapshots (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id             TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ship_id                 TEXT    NOT NULL REFERENCES ships(id)     ON DELETE CASCADE,
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
  UNIQUE (campaign_id, ship_id, world_hex, sector, tick)
);

CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_lookup
  ON traffic_snapshots (campaign_id, ship_id, world_hex, sector, tick);

INSERT INTO schema_migrations (id, applied_at) VALUES ('016', unixepoch());
