-- Add world name to cargo rows so the Source column in the hold display
-- is readable without the source sector being currently loaded.
alter table cargo
  add column if not exists purchase_world_name text not null default '';
