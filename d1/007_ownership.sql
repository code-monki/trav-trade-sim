-- Migration 007: ownership tracking + Organization entity (Phase 1).
-- ship_ownership: multiple players jointly owning one ship (a partnership).
-- organizations / organization_members: generic Organization entity (corp/
-- confederation/trade-union as configuration) + ship affiliation. Phase 1 is
-- entity + membership only — no dues/disbursement actions yet.

CREATE TABLE ship_ownership (
  id          TEXT    PRIMARY KEY,
  campaign_id TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ship_id     TEXT    NOT NULL REFERENCES ships(id)   ON DELETE CASCADE,
  player_id   TEXT    NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  percentage  INTEGER NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (ship_id, player_id)
);

CREATE INDEX idx_ship_ownership_ship
  ON ship_ownership (ship_id);

CREATE TABLE organizations (
  id               TEXT    PRIMARY KEY,
  campaign_id      TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  treasury_credits INTEGER NOT NULL DEFAULT 0,
  dues_rate        INTEGER,
  notes            TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, name)
);

CREATE TABLE organization_members (
  id              TEXT    PRIMARY KEY,
  organization_id TEXT    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ship_id         TEXT    NOT NULL REFERENCES ships(id)         ON DELETE CASCADE,
  owns_ship       INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, ship_id)
);

CREATE INDEX idx_org_members_org
  ON organization_members (organization_id);
CREATE INDEX idx_org_members_ship
  ON organization_members (ship_id);
