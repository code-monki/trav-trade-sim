-- ============================================================
-- Migration 016 — Fix calendar year/day at campaign creation
--
-- Migrations 007 and 014 derived year and day from the start tick
-- using (tick * 7 / 365), which disagrees with the tick_year()
-- helper that correctly uses (tick / 48).  For a Classic-era
-- campaign (start_tick = 0) both formulas give year 1105, so the
-- bug was invisible until milieux with non-zero start ticks were
-- added (e.g. Far Future 1900 → start_tick ≈ 38160, giving year
-- 1836 instead of 1900).
--
-- Fix: use tick_year() and the same week-in-year arithmetic as the
-- JavaScript tickToCalendar() helper.
-- ============================================================

create or replace function create_campaign(
  p_label        text,
  p_code         text,
  p_milieu       text,
  p_trade_rules  text,
  p_char_name    text,
  p_pin          text,
  p_start_tick   integer default 0
) returns json language plpgsql security definer as $$
declare
  v_campaign      campaigns%rowtype;
  v_player        players%rowtype;
  v_year          integer;
  v_day           integer;
  v_recovery_code text;
begin
  if length(trim(p_pin)) < 4 then
    return json_build_object('error', 'PIN must be at least 4 characters');
  end if;

  if exists (select 1 from campaigns where code = upper(trim(p_code))) then
    return json_build_object('error', 'Campaign code already in use');
  end if;

  v_recovery_code := upper(gen_random_uuid()::text);

  -- Use the same formula as tick_year(): 1105 + tick / 48
  v_year := tick_year(p_start_tick);
  v_day  := (p_start_tick % 48) * 7 + 1;

  insert into campaigns (label, code, milieu, trade_rules, recovery_code_hash)
  values (
    trim(p_label),
    upper(trim(p_code)),
    p_milieu,
    p_trade_rules,
    crypt(v_recovery_code, gen_salt('bf', 10))
  )
  returning * into v_campaign;

  insert into campaign_calendar (campaign_id, current_tick, year, day)
  values (v_campaign.id, p_start_tick, v_year, v_day);

  insert into players (campaign_id, character_name, pin_hash, role)
  values (
    v_campaign.id,
    trim(p_char_name),
    crypt(p_pin, gen_salt('bf', 10)),
    'referee'
  )
  returning * into v_player;

  return json_build_object(
    'campaign', json_build_object(
      'id',          v_campaign.id,
      'code',        v_campaign.code,
      'label',       v_campaign.label,
      'milieu',      v_campaign.milieu,
      'trade_rules', v_campaign.trade_rules
    ),
    'player', json_build_object(
      'id',             v_player.id,
      'character_name', v_player.character_name,
      'role',           v_player.role,
      'credits',        v_player.credits
    ),
    'recovery_code', v_recovery_code
  );
end;
$$;
