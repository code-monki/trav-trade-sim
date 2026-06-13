-- ============================================================
-- Crew trading authorization — migration 012
--
-- Adds can_trade to crew so the referee can designate which
-- crew members are authorized to buy and sell speculative cargo.
-- Defaults to false; captains are backfilled to true since they
-- hold trading authority in standard Traveller rules.
-- ============================================================

alter table crew
  add column if not exists can_trade boolean not null default false;

-- Backfill: existing captains get trading rights
update crew set can_trade = true where role = 'captain';
