-- ============================================================
-- Player Skills — migration 010
--
-- Generic (skill, level) rows per player.  Intentionally open:
-- the schema does not enforce a fixed skill list so that CT7,
-- T5, and future editions can all use the same table.
--
-- Trade-relevant skills (primary use case):
--   Broker   — T5 DM on Actual Value Table flux roll (max +4)
--   Trader   — T5 price estimation (see one flux die before committing)
--   Liaison  — freight availability modifier
--   Admin    — mid-passenger availability
--   Steward  — high-passenger availability
--   Streetwise — low-passenger availability
--
-- Level 0 is a valid skill level in T5 (trained but unskilled).
-- Untrained (-3 DM in T5) is represented by the absence of a row.
-- ============================================================

create table if not exists player_skills (
  id          uuid     primary key default gen_random_uuid(),
  campaign_id uuid     not null references campaigns(id) on delete cascade,
  player_id   uuid     not null references players(id)   on delete cascade,
  skill       text     not null,
  level       smallint not null default 0 check (level >= 0),
  created_at  timestamptz not null default now(),

  unique (player_id, skill)
);

create index if not exists idx_player_skills_player
  on player_skills (campaign_id, player_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table player_skills enable row level security;

create policy "public read player skills"
  on player_skills for select using (true);

create policy "insert player skills"
  on player_skills for insert with check (true);

create policy "update player skills"
  on player_skills for update using (true);

create policy "delete player skills"
  on player_skills for delete using (true);
