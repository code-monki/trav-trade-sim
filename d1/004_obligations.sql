-- Migration 004: unify passenger_manifests + mail_contracts into obligations.
-- Both tables tracked a pending commercial commitment (fare / mail payment)
-- with near-identical shape; `obligations` generalizes this with a `kind`
-- discriminator so future obligation types don't need their own table.
--
-- DB holds test data only at time of writing — dropped, not migrated.

DROP TABLE IF EXISTS passenger_manifests;
DROP TABLE IF EXISTS mail_contracts;

CREATE TABLE obligations (
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
  passage_type      TEXT,
  passenger_count   INTEGER,
  fare_per_head     INTEGER,
  parsecs           INTEGER,
  notes             TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_obligations_ship
  ON obligations (campaign_id, ship_id, kind, status);
CREATE INDEX idx_obligations_dest
  ON obligations (dest_world_hex, dest_sector)
  WHERE status = 'pending';
