-- ============================================================
-- Migration 011: Schema-drift detection ledger
--
-- Migrations 002-010 were applied by hand with no bookkeeping table —
-- there was previously no way for the running Worker to tell whether a
-- given D1 database had actually received all of them. This creates that
-- ledger and backfills it with the migrations this database already has
-- (schema.sql's baseline is recorded as '001' for an unbroken sequence).
--
-- From this migration on, every new migration file must end with its own
-- INSERT into schema_migrations — see worker/src/lib/schema-version.js,
-- whose EXPECTED_MIGRATIONS list must be updated in the same commit.
-- ============================================================

CREATE TABLE schema_migrations (
  id         TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

INSERT INTO schema_migrations (id, applied_at) VALUES
  ('001', unixepoch()), ('002', unixepoch()), ('003', unixepoch()),
  ('004', unixepoch()), ('005', unixepoch()), ('006', unixepoch()),
  ('007', unixepoch()), ('008', unixepoch()), ('009', unixepoch()),
  ('010', unixepoch()), ('011', unixepoch());
