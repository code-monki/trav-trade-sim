-- ============================================================
-- Trade Records — realized speculative trade log
-- Migration 008
--
-- Captures the complete round-trip of a speculative cargo trade:
-- where it was bought, where it was sold, and the full pricing
-- breakdown for both CT7 and T5 rules.
--
-- Two distinct OHLCV sources now exist:
--   market_monthly    → from market_snapshots (simulated available prices)
--   (future)          → from trade_records    (realized clearing prices)
--
-- Solo play: even a single ship's trades build a meaningful route-
-- profitability history. Multi-campaign: pooled data drives realistic
-- price drift via future rollup functions.
-- ============================================================

-- ── trade_records ─────────────────────────────────────────────────────────────
-- One row per completed speculative trade (cargo bought AND sold).
-- Written at point of sale; references both source and market worlds.
-- The transactions table still receives individual buy/sell credit entries.

create table if not exists trade_records (
  id                        uuid    primary key default gen_random_uuid(),
  campaign_id               uuid    not null references campaigns(id) on delete cascade,
  player_id                 uuid    not null references players(id)   on delete cascade,
  trade_rules               text    not null check (trade_rules in ('CT7','T5')),

  -- Cargo identity
  trade_good_die            text    not null,
  trade_good_name           text    not null,
  tons                      int     not null check (tons > 0),
  cargo_id_t5               text,              -- T5 only: "D Hi In Cr2,300"; null for CT7

  -- Purchase side
  source_world_hex          text    not null,
  source_sector             text    not null,
  purchase_tick             bigint  not null,
  buy_price_per_ton         int     not null,
  total_cost                bigint  not null,  -- buy_price_per_ton × tons

  -- Sale side
  market_world_hex          text    not null,
  market_sector             text    not null,
  sell_tick                 bigint  not null,

  -- Pricing breakdown
  -- tc_adjusted_price: T5 only — TC cross-reference result before TL delta.
  --   For CT7 leave null (trade_price_per_ton already captures the full calc).
  tc_adjusted_price_per_ton int,
  trade_price_per_ton       int     not null,  -- expected sell price (CT7/T5, before flux)
  sell_price_per_ton        int     not null,  -- realized price after AVT / flux

  -- T5-specific flux and broker details (null for CT7 trades)
  effective_flux            smallint,          -- clamped roll that hit the AVT
  broker_dm                 smallint,          -- 0–4; null if no broker used
  broker_fee_total          int,               -- Cr paid in commission; null for CT7

  -- Totals
  total_revenue             bigint  not null,  -- sell_price_per_ton × tons
  net_profit                bigint  not null,  -- revenue − total_cost − broker_fee_total

  created_at                timestamptz not null default now()
);

-- For OHLCV rollup: scan by campaign + market world + good + sell time
create index if not exists idx_trade_records_market
  on trade_records (campaign_id, market_world_hex, market_sector, trade_good_die, sell_tick desc);

-- For player P&L queries
create index if not exists idx_trade_records_player
  on trade_records (campaign_id, player_id, sell_tick desc);

-- For route analysis (source → market pairs)
create index if not exists idx_trade_records_route
  on trade_records (campaign_id, source_world_hex, market_world_hex, sell_tick desc);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table trade_records enable row level security;

-- All members of a campaign can read its trade records (shared market intel).
create policy "public read trade records"
  on trade_records for select using (true);

create policy "insert trade records"
  on trade_records for insert with check (true);

-- ── realized_ohlcv view ───────────────────────────────────────────────────────
-- Convenience view: trade-based OHLCV aggregated by campaign, market world,
-- good, and in-game month. Parallels market_monthly but sourced from realized
-- clearing prices instead of simulated snapshot prices.
--
-- Sparse data (solo play, few trades) shows narrow candles or single-point
-- ticks — accurate, not misleading.

create or replace view realized_ohlcv as
select
  campaign_id,
  market_world_hex                              as world_hex,
  market_sector                                 as sector,
  trade_good_die,
  tick_year(sell_tick)                          as year,
  tick_month(sell_tick)                         as month,
  -- OHLCV over sell_price_per_ton within the in-game month
  first_value(sell_price_per_ton) over w        as open_price,
  max(sell_price_per_ton)         over w        as high_price,
  min(sell_price_per_ton)         over w        as low_price,
  last_value(sell_price_per_ton)  over w        as close_price,
  sum(tons)                       over w        as volume_tons,
  count(*)                        over w        as trade_count
from trade_records
window w as (
  partition by
    campaign_id,
    market_world_hex,
    market_sector,
    trade_good_die,
    tick_year(sell_tick),
    tick_month(sell_tick)
  order by sell_tick
  rows between unbounded preceding and unbounded following
);
