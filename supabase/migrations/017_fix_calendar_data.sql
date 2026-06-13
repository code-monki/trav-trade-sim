-- ============================================================
-- Migration 017 — Backfill calendar year/day for all campaigns
--
-- create_campaign (migrations 007 and 014) used (tick * 7 / 365)
-- to seed the initial year/day, which disagrees with tick_year()
-- ((tick / 48) + 1105).  advance_tick() corrects the row on every
-- tick advance, so only campaigns that have never advanced a tick
-- are still wrong.  This one-time backfill is safe to run against
-- all campaigns: for already-correct rows it sets the same values.
-- ============================================================

update campaign_calendar
set year = tick_year(current_tick),
    day  = (current_tick % 48) * 7 + 1;
