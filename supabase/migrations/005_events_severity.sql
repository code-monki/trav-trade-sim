-- ============================================================
-- Add severity tier to market_events.
-- Existing rows default to 'minor'.
-- Paste into Supabase SQL Editor and run.
-- ============================================================

alter table market_events
  add column if not exists severity text not null default 'minor'
  check (severity in ('minor', 'major', 'crisis'));
