-- Migration 008: organization officers (multi-officer authorization).
-- Players authorized to manage an organization. Flat list, no role hierarchy —
-- any officer can manage the org fully, including adding/removing other
-- officers. Referees can always override regardless of officer status.

CREATE TABLE organization_officers (
  id              TEXT    PRIMARY KEY,
  organization_id TEXT    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_id       TEXT    NOT NULL REFERENCES players(id)       ON DELETE CASCADE,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, player_id)
);

CREATE INDEX idx_org_officers_org
  ON organization_officers (organization_id);
