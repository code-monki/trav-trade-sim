-- ============================================================
-- Migration 015 — Regenerate recovery code RPC
--
-- Allows a referee to generate a new recovery code from within
-- the app. The old code is immediately invalidated.
-- ============================================================

create or replace function regenerate_recovery_code(
  p_campaign_id uuid
) returns json language plpgsql security definer as $$
declare
  v_recovery_code text;
begin
  if not exists (select 1 from campaigns where id = p_campaign_id) then
    return json_build_object('error', 'Campaign not found');
  end if;

  v_recovery_code := upper(gen_random_uuid()::text);

  update campaigns
  set recovery_code_hash = crypt(v_recovery_code, gen_salt('bf', 10))
  where id = p_campaign_id;

  return json_build_object('recovery_code', v_recovery_code);
end;
$$;
