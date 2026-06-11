-- ============================================================
-- Auth RPC functions — PIN hashing stays server-side in pgcrypto.
-- All three functions are SECURITY DEFINER so they can write
-- through RLS on behalf of the anon client.
-- Paste into Supabase SQL Editor and run after 001_schema.sql.
-- ============================================================


-- ── create_campaign ───────────────────────────────────────────────────────────
-- Creates a new campaign and its first player (referee role).
-- Returns the campaign and player data, or an error key.

create or replace function create_campaign(
  p_label        text,
  p_code         text,
  p_milieu       text,
  p_trade_rules  text,
  p_char_name    text,
  p_pin          text
) returns json language plpgsql security definer as $$
declare
  v_campaign campaigns%rowtype;
  v_player   players%rowtype;
begin
  if length(trim(p_pin)) < 4 then
    return json_build_object('error', 'PIN must be at least 4 characters');
  end if;

  if exists (select 1 from campaigns where code = upper(trim(p_code))) then
    return json_build_object('error', 'Campaign code already in use');
  end if;

  insert into campaigns (label, code, milieu, trade_rules)
  values (trim(p_label), upper(trim(p_code)), p_milieu, p_trade_rules)
  returning * into v_campaign;

  insert into campaign_calendar (campaign_id, current_tick, year, day)
  values (v_campaign.id, 0, 1105, 1);

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


-- ── join_campaign ─────────────────────────────────────────────────────────────
-- Registers a new player character in an existing campaign.
-- Referee must create the campaign first; players join with the code.

create or replace function join_campaign(
  p_code      text,
  p_char_name text,
  p_pin       text
) returns json language plpgsql security definer as $$
declare
  v_campaign_id uuid;
  v_player      players%rowtype;
begin
  if length(trim(p_pin)) < 4 then
    return json_build_object('error', 'PIN must be at least 4 characters');
  end if;

  select id into v_campaign_id from campaigns where code = upper(trim(p_code));
  if not found then
    return json_build_object('error', 'Campaign not found');
  end if;

  if exists (
    select 1 from players
    where campaign_id = v_campaign_id and character_name = trim(p_char_name)
  ) then
    return json_build_object('error', 'Character name already taken in this campaign');
  end if;

  insert into players (campaign_id, character_name, pin_hash, role)
  values (
    v_campaign_id,
    trim(p_char_name),
    crypt(p_pin, gen_salt('bf', 10)),
    'player'
  )
  returning * into v_player;

  return json_build_object(
    'player', json_build_object(
      'id',             v_player.id,
      'campaign_id',    v_player.campaign_id,
      'character_name', v_player.character_name,
      'role',           v_player.role,
      'credits',        v_player.credits
    )
  );
end;
$$;


-- ── verify_pin ────────────────────────────────────────────────────────────────
-- Verifies a player's PIN and returns their session data.
-- Enforces rate limiting: 5 failed attempts → 15-minute lockout.

create or replace function verify_pin(
  p_code      text,
  p_char_name text,
  p_pin       text
) returns json language plpgsql security definer as $$
declare
  v_campaign_id uuid;
  v_player      players%rowtype;
  v_campaign    campaigns%rowtype;
begin
  select id into v_campaign_id from campaigns where code = upper(trim(p_code));
  if not found then
    return json_build_object('error', 'Campaign not found');
  end if;

  select * into v_player
  from players
  where campaign_id = v_campaign_id and character_name = trim(p_char_name);

  if not found then
    return json_build_object('error', 'Character not found');
  end if;

  -- rate limit check
  if v_player.locked_until is not null and v_player.locked_until > now() then
    return json_build_object(
      'error',        'Too many failed attempts — account locked',
      'locked_until', v_player.locked_until
    );
  end if;

  -- PIN check
  if v_player.pin_hash = crypt(p_pin, v_player.pin_hash) then
    update players
    set failed_attempts = 0, locked_until = null, last_seen = now()
    where id = v_player.id;

    select * into v_campaign from campaigns where id = v_campaign_id;

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
        'credits',        v_player.credits,
        'ship_name',      v_player.ship_name,
        'current_world',  v_player.current_world
      )
    );
  else
    -- increment failure counter; lock on 5th failure
    update players
    set
      failed_attempts = failed_attempts + 1,
      locked_until = case
        when failed_attempts + 1 >= 5
        then now() + interval '15 minutes'
        else null
      end
    where id = v_player.id;

    return json_build_object(
      'error',             'Invalid PIN',
      'attempts_remaining', greatest(0, 4 - v_player.failed_attempts)
    );
  end if;
end;
$$;
