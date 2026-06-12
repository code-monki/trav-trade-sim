-- ============================================================
-- Migration 007 — Campaign starting tick
--
-- Allows create_campaign to receive a p_start_tick so referees
-- can open a campaign at the start of any Imperial year rather
-- than always defaulting to year 1105 tick 0.
--
-- Default is 0 (year 1105) for full backward compatibility.
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
  v_campaign campaigns%rowtype;
  v_player   players%rowtype;
  v_year     integer;
  v_day      integer;
begin
  if length(trim(p_pin)) < 4 then
    return json_build_object('error', 'PIN must be at least 4 characters');
  end if;

  if exists (select 1 from campaigns where code = upper(trim(p_code))) then
    return json_build_object('error', 'Campaign code already in use');
  end if;

  -- Derive year and day from start tick (1 tick = 7 days, base year 1105)
  v_year := 1105 + floor(p_start_tick * 7 / 365);
  v_day  := (p_start_tick * 7 % 365) + 1;

  insert into campaigns (label, code, milieu, trade_rules)
  values (trim(p_label), upper(trim(p_code)), p_milieu, p_trade_rules)
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
    )
  );
end;
$$;
