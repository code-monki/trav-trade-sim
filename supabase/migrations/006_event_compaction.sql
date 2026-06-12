-- ============================================================
-- Event compaction: prune expired market_events during the
-- annual rollup to prevent unbounded table growth.
--
-- Retention policy:
--   Keep: all events for the current year and the prior year.
--   Delete: expired events whose expires_tick falls before the
--           start of year (p_year - 1).
--
-- "Start of year Y" in ticks = (Y - 1105) * 48
-- This fires once per campaign per in-game year (every 48 ticks).
--
-- Paste into Supabase SQL Editor and run after 005_events_severity.sql.
-- ============================================================

create or replace function rollup_year(
  p_campaign_id uuid,
  p_year        int
) returns void language plpgsql security definer as $$
declare
  v_cutoff_tick bigint;
begin
  -- ── Annual OHLC rollup (unchanged) ─────────────────────────────────────────
  insert into market_annual (
    campaign_id, world_hex, sector, trade_good_die,
    year,
    open_price, high_price, low_price, close_price, volume_tons
  )
  with months as (
    select * from market_monthly
    where campaign_id = p_campaign_id
      and year = p_year
  ),
  bounds as (
    select
      campaign_id, world_hex, sector, trade_good_die,
      min(month)       as open_month,
      max(month)       as close_month,
      max(high_price)  as high_price,
      min(low_price)   as low_price,
      sum(volume_tons) as volume_tons
    from months
    group by campaign_id, world_hex, sector, trade_good_die
  )
  select
    b.campaign_id,
    b.world_hex,
    b.sector,
    b.trade_good_die,
    p_year,
    o.open_price,
    b.high_price,
    b.low_price,
    c.close_price,
    b.volume_tons
  from bounds b
  join months o on
    o.campaign_id    = b.campaign_id and
    o.world_hex      = b.world_hex   and
    o.sector         = b.sector      and
    o.trade_good_die = b.trade_good_die and
    o.month          = b.open_month
  join months c on
    c.campaign_id    = b.campaign_id and
    c.world_hex      = b.world_hex   and
    c.sector         = b.sector      and
    c.trade_good_die = b.trade_good_die and
    c.month          = b.close_month
  on conflict (campaign_id, world_hex, sector, trade_good_die, year)
  do update set
    open_price  = excluded.open_price,
    high_price  = excluded.high_price,
    low_price   = excluded.low_price,
    close_price = excluded.close_price,
    volume_tons = excluded.volume_tons;

  -- ── Event compaction ────────────────────────────────────────────────────────
  -- Retain the current year (p_year) and the immediately prior year (p_year-1).
  -- Delete any event that expired before the start of year (p_year - 1).
  v_cutoff_tick := ((p_year - 1 - 1105)::bigint * 48);

  delete from market_events
  where campaign_id  = p_campaign_id
    and expires_tick is not null        -- never touch permanent events
    and expires_tick < v_cutoff_tick;
end;
$$;
