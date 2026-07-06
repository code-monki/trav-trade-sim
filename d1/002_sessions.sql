-- Migration 002: session tokens
-- Issued on login; validated on every authenticated request.
CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  player_id   TEXT NOT NULL REFERENCES players(id)   ON DELETE CASCADE,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions (player_id);
