-- ============================================================
-- Split market_events.effect_pct into buy_modifier_pct and
-- sell_modifier_pct so events can have asymmetric impacts on
-- the buy side vs the sell side.
-- Existing rows: both columns inherit the old effect_pct value.
-- ============================================================

alter table market_events
  add column if not exists buy_modifier_pct  int,
  add column if not exists sell_modifier_pct int;

update market_events
  set buy_modifier_pct  = effect_pct,
      sell_modifier_pct = effect_pct
  where buy_modifier_pct is null;

alter table market_events
  drop column if exists effect_pct;
