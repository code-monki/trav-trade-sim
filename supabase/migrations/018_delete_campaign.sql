-- ============================================================
-- Migration 018 — Delete campaign RPC
--
-- Allows the referee to permanently delete their campaign.
-- Requires PIN verification before deletion to prevent
-- accidental or unauthorised removal.
--
-- ON DELETE CASCADE on all child tables means a single
-- DELETE from campaigns removes everything: players,
-- calendar, snapshots, cargo, transactions, events,
-- ships, crew, trade_records, and player_skills.
-- ============================================================

create or replace function delete_campaign(
  p_campaign_id uuid,
  p_pin         text
) returns json language plpgsql security definer as $$
declare
  v_player players%rowtype;
begin
  -- Find the referee for this campaign
  select * into v_player
  from players
  where campaign_id = p_campaign_id
    and role = 'referee'
  limit 1;

  if not found then
    return json_build_object('error', 'Campaign not found');
  end if;

  -- Verify PIN
  if v_player.pin_hash != crypt(p_pin, v_player.pin_hash) then
    return json_build_object('error', 'Incorrect PIN');
  end if;

  -- Delete campaign — all child rows cascade
  delete from campaigns where id = p_campaign_id;

  return json_build_object('ok', true);
end;
$$;
