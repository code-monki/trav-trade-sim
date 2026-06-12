-- ============================================================
-- Fix advance_tick: replace SELECT...FOR UPDATE with a single
-- atomic UPDATE...RETURNING. The FOR UPDATE row-lock is
-- unnecessary for single-referee use and can fail with
-- Supabase's Supavisor connection pooler.
-- Paste into Supabase SQL Editor and run.
-- ============================================================

create or replace function advance_tick(
  p_campaign_id uuid
) returns json language plpgsql security definer as $$
declare
  v_new_tick bigint;
  v_year     int;
  v_day      int;
  v_month    int;
begin
  -- Atomically increment the tick and read back the new value.
  update campaign_calendar
  set current_tick = current_tick + 1,
      updated_at   = now()
  where campaign_id = p_campaign_id
  returning current_tick into v_new_tick;

  if not found then
    return json_build_object('error', 'Campaign calendar not found');
  end if;

  v_year  := tick_year(v_new_tick);
  v_day   := tick_day(v_new_tick);
  v_month := tick_month(v_new_tick);

  -- Keep year/day columns current for convenience queries.
  update campaign_calendar
  set year = v_year,
      day  = v_day
  where campaign_id = p_campaign_id;

  -- Monthly rollup: fires after every 4th tick (completed month).
  if v_new_tick % 4 = 0 then
    perform rollup_month(
      p_campaign_id,
      tick_year(v_new_tick - 4),
      tick_month(v_new_tick - 4)
    );
  end if;

  -- Annual rollup: fires after every 48th tick (completed year).
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
