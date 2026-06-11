-- ============================================================
-- Tick calendar helpers and OHLC rollup functions.
-- Paste into Supabase SQL Editor and run after 002_auth_functions.sql.
-- ============================================================

-- Calendar constants (must match market-tick.js)
-- TICKS_PER_MONTH = 4,  TICKS_PER_YEAR = 48,  BASE_YEAR = 1105

-- ── Pure calendar helpers ─────────────────────────────────────────────────────

create or replace function tick_year(p_tick bigint) returns int
  language sql immutable as $$
    select (1105 + p_tick / 48)::int
$$;

create or replace function tick_month(p_tick bigint) returns int
  language sql immutable as $$
    select ((p_tick / 4) % 12 + 1)::int
$$;

create or replace function tick_day(p_tick bigint) returns int
  language sql immutable as $$
    select ((p_tick * 7) % 365 + 1)::int
$$;

-- ── Monthly OHLC rollup ───────────────────────────────────────────────────────
-- Aggregates raw market_snapshots into market_monthly for a completed month.
-- "Completed" means tick has advanced past the last tick of that month.

create or replace function rollup_month(
  p_campaign_id uuid,
  p_year        int,
  p_month       int   -- 1–12
) returns void language plpgsql security definer as $$
declare
  v_tick_min bigint;
  v_tick_max bigint;
begin
  -- tick range for this month
  v_tick_min := ((p_year - 1105)::bigint * 48) + ((p_month - 1)::bigint * 4);
  v_tick_max := v_tick_min + 3;

  insert into market_monthly (
    campaign_id, world_hex, sector, trade_good_die,
    year, month,
    open_price, high_price, low_price, close_price, volume_tons
  )
  with period as (
    select * from market_snapshots
    where campaign_id = p_campaign_id
      and tick between v_tick_min and v_tick_max
  ),
  bounds as (
    select
      campaign_id, world_hex, sector, trade_good_die,
      min(tick)            as open_tick,
      max(tick)            as close_tick,
      max(purchase_price)  as high_price,
      min(purchase_price)  as low_price,
      sum(qty_available)   as volume_tons
    from period
    group by campaign_id, world_hex, sector, trade_good_die
  )
  select
    b.campaign_id,
    b.world_hex,
    b.sector,
    b.trade_good_die,
    p_year,
    p_month,
    o.purchase_price  as open_price,
    b.high_price,
    b.low_price,
    c.purchase_price  as close_price,
    b.volume_tons
  from bounds b
  join period o on
    o.campaign_id    = b.campaign_id and
    o.world_hex      = b.world_hex   and
    o.sector         = b.sector      and
    o.trade_good_die = b.trade_good_die and
    o.tick           = b.open_tick
  join period c on
    c.campaign_id    = b.campaign_id and
    c.world_hex      = b.world_hex   and
    c.sector         = b.sector      and
    c.trade_good_die = b.trade_good_die and
    c.tick           = b.close_tick
  on conflict (campaign_id, world_hex, sector, trade_good_die, year, month)
  do update set
    open_price  = excluded.open_price,
    high_price  = excluded.high_price,
    low_price   = excluded.low_price,
    close_price = excluded.close_price,
    volume_tons = excluded.volume_tons;
end;
$$;

-- ── Annual OHLC rollup ────────────────────────────────────────────────────────
-- Aggregates market_monthly rows for a completed year into market_annual.

create or replace function rollup_year(
  p_campaign_id uuid,
  p_year        int
) returns void language plpgsql security definer as $$
begin
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
      min(month)          as open_month,
      max(month)          as close_month,
      max(high_price)     as high_price,
      min(low_price)      as low_price,
      sum(volume_tons)    as volume_tons
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
end;
$$;

-- ── advance_tick ──────────────────────────────────────────────────────────────
-- Atomically increments the campaign tick, updates the calendar, and
-- triggers any pending rollups. Only the referee (or authorized client) calls
-- this; RLS limits who can mutate campaign_calendar.

create or replace function advance_tick(
  p_campaign_id uuid
) returns json language plpgsql security definer as $$
declare
  v_old_tick bigint;
  v_new_tick bigint;
  v_year     int;
  v_day      int;
  v_month    int;
begin
  -- Read current tick with a row lock to prevent concurrent advances
  select current_tick into v_old_tick
  from campaign_calendar
  where campaign_id = p_campaign_id
  for update;

  if not found then
    return json_build_object('error', 'Campaign calendar not found');
  end if;

  v_new_tick := v_old_tick + 1;
  v_year     := tick_year(v_new_tick);
  v_day      := tick_day(v_new_tick);
  v_month    := tick_month(v_new_tick);

  update campaign_calendar
  set current_tick = v_new_tick,
      year         = v_year,
      day          = v_day,
      updated_at   = now()
  where campaign_id = p_campaign_id;

  -- Monthly rollup: fires when a full month has just completed
  -- (v_new_tick % 4 == 0 means the previous 4 ticks form a complete month)
  if v_new_tick % 4 = 0 then
    perform rollup_month(
      p_campaign_id,
      tick_year(v_new_tick - 4),
      tick_month(v_new_tick - 4)
    );
  end if;

  -- Annual rollup: fires when a full year (48 ticks) has just completed
  if v_new_tick % 48 = 0 then
    perform rollup_year(p_campaign_id, tick_year(v_new_tick - 48));
  end if;

  return json_build_object(
    'tick',  v_new_tick,
    'year',  v_year,
    'day',   v_day,
    'month', v_month
  );
end;
$$;
