-- ============================================================
-- Migration 014 — Referee PIN recovery code
--
-- Adds a recovery_code_hash to campaigns. The plaintext code is
-- generated once at campaign creation, shown to the referee, and
-- never stored in recoverable form. Knowing the code allows
-- resetting any character's PIN in the campaign.
-- ============================================================

alter table campaigns
  add column if not exists recovery_code_hash text;

-- ── create_campaign (updated) ─────────────────────────────────────────────────
-- Now generates a recovery code, stores its hash, and returns the
-- plaintext code in the response for one-time display.

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

  -- Generate a random recovery code (UUID, displayed uppercase to referee)
  v_recovery_code := upper(gen_random_uuid()::text);

  -- Derive year and day from start tick (1 tick = 7 days, base year 1105)
  v_year := 1105 + floor(p_start_tick * 7 / 365);
  v_day  := (p_start_tick * 7 % 365) + 1;

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


-- ── reset_pin_with_recovery_code ──────────────────────────────────────────────
-- Resets any character's PIN in a campaign given the campaign recovery code.
-- The recovery code is campaign-scoped so the referee can also help players.

create or replace function reset_pin_with_recovery_code(
  p_code         text,
  p_char_name    text,
  p_recovery     text,
  p_new_pin      text
) returns json language plpgsql security definer as $$
declare
  v_campaign campaigns%rowtype;
  v_player   players%rowtype;
begin
  if length(trim(p_new_pin)) < 4 then
    return json_build_object('error', 'PIN must be at least 4 characters');
  end if;

  select * into v_campaign from campaigns where code = upper(trim(p_code));
  if not found then
    return json_build_object('error', 'Campaign not found');
  end if;

  if v_campaign.recovery_code_hash is null or
     v_campaign.recovery_code_hash != crypt(upper(trim(p_recovery)), v_campaign.recovery_code_hash) then
    return json_build_object('error', 'Invalid recovery code');
  end if;

  select * into v_player
  from players
  where campaign_id = v_campaign.id
    and character_name = trim(p_char_name);

  if not found then
    return json_build_object('error', 'Character not found');
  end if;

  update players
  set pin_hash        = crypt(p_new_pin, gen_salt('bf', 10)),
      failed_attempts = 0,
      locked_until    = null
  where id = v_player.id;

  return json_build_object('ok', true);
end;
$$;
