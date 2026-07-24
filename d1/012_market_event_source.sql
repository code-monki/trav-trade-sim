-- ============================================================
-- Migration 012: Distinguish manual (referee-created) events
--
-- market_events previously had no way to tell a referee-created "custom"
-- event apart from an auto-generated per-tick market event — both go
-- through the same table via the same insert path (maybeInsertEvent vs.
-- referee.createEvent). This adds a `source` column so the Referee's
-- events grid can show only manual events, not auto-generated noise.
--
-- Caveat: this can't retroactively distinguish events already in a live
-- campaign's DB — anything created before this migration is backfilled as
-- 'auto' (including any pre-existing manual events) and won't appear in
-- the new grid.
--
-- SQLite/D1 supports ADD COLUMN with a CHECK here (no table rebuild
-- needed) since the constraint only references the new column with a
-- constant default.
-- ============================================================

ALTER TABLE market_events
  ADD COLUMN source TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual'));

INSERT INTO schema_migrations (id, applied_at) VALUES ('012', unixepoch());
