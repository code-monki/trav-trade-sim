-- Migration 005: ship templates + ship market value.
-- Referee-managed catalogue of canonical ship designs for the New Ship form
-- (ruleset-tagged; no persistent link to ships created from one). Also adds
-- ships.market_value for Asset Valuation.

ALTER TABLE ships ADD COLUMN market_value INTEGER NOT NULL DEFAULT 0;

CREATE TABLE ship_templates (
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

CREATE INDEX idx_ship_templates_campaign
  ON ship_templates (campaign_id, trade_rules);
