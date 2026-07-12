-- Migration 009: Corporation/Fleet Phase 2 — dues, disbursement, org equity.
-- dues_frequency_ticks/last_dues_tick drive a "dues due" indicator only —
-- collection is always a manual officer action, guarded server-side against
-- re-collecting before the period elapses, never automatic on tick advance.

ALTER TABLE organizations ADD COLUMN dues_frequency_ticks INTEGER NOT NULL DEFAULT 4;
ALTER TABLE organizations ADD COLUMN last_dues_tick INTEGER;

-- A ship can be owned outright by at most one org at a time.
CREATE UNIQUE INDEX idx_org_members_single_owner
  ON organization_members (ship_id) WHERE owns_ship = 1;

-- Player equity in an org that owns ships outright — mirrors ship_ownership's
-- 100%-ceiling validation, but officer-manageable (not referee-only).
CREATE TABLE organization_ownership (
  id              TEXT    PRIMARY KEY,
  campaign_id     TEXT    NOT NULL REFERENCES campaigns(id)     ON DELETE CASCADE,
  organization_id TEXT    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_id       TEXT    NOT NULL REFERENCES players(id)       ON DELETE CASCADE,
  percentage      INTEGER NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, player_id)
);

CREATE INDEX idx_org_ownership_org
  ON organization_ownership (organization_id);

-- Audit trail for dues collection events, one row per ship per collection.
-- Separate from transactions since that table's `type` CHECK can't be ALTERed
-- in place (same reason debt_payments is its own table).
CREATE TABLE dues_payments (
  id              TEXT    PRIMARY KEY,
  organization_id TEXT    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ship_id         TEXT    NOT NULL REFERENCES ships(id)         ON DELETE CASCADE,
  campaign_id     TEXT    NOT NULL REFERENCES campaigns(id)     ON DELETE CASCADE,
  tick            INTEGER NOT NULL,
  amount          INTEGER NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_dues_payments_org
  ON dues_payments (organization_id, tick DESC);

-- Ad hoc org treasury -> member ship transfers, officer-triggered.
CREATE TABLE disbursements (
  id              TEXT    PRIMARY KEY,
  organization_id TEXT    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ship_id         TEXT    NOT NULL REFERENCES ships(id)         ON DELETE CASCADE,
  campaign_id     TEXT    NOT NULL REFERENCES campaigns(id)     ON DELETE CASCADE,
  tick            INTEGER NOT NULL,
  amount          INTEGER NOT NULL,
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_disbursements_org
  ON disbursements (organization_id, tick DESC);
