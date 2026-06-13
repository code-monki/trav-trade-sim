-- ============================================================
-- Ships and Crew — migration 009
--
-- Promotes "ship" from a plain text field on players to a
-- first-class entity.  A ship has its own location, cargo
-- capacity, and operating account.  The crew manifest tracks
-- which players are assigned to which ship and in what role.
--
-- players.ship_name and players.current_world are now
-- superseded (see comments in migration 011).
-- ============================================================

-- ── Ships ─────────────────────────────────────────────────────────────────────

create table if not exists ships (
  id             uuid    primary key default gen_random_uuid(),
  campaign_id    uuid    not null references campaigns(id) on delete cascade,
  name           text    not null,
  hull_type      text,                          -- e.g. "Free Trader", "Scout/Courier"
  hull_tons      int     not null default 200,  -- total displacement in tons
  cargo_capacity int     not null default 80,   -- available cargo hold in tons
  current_world  text,                          -- hex of current location
  current_sector text,
  credits        bigint  not null default 0,    -- ship operating account (Cr)
  created_at     timestamptz not null default now(),

  unique (campaign_id, name)
);

create index if not exists idx_ships_campaign
  on ships (campaign_id);

-- ── Crew manifest ─────────────────────────────────────────────────────────────
-- left_tick null  → player is currently aboard
-- left_tick set   → player has left this ship (historical record preserved)
-- A player may rejoin a ship, producing a new row.

create table if not exists crew (
  id          uuid    primary key default gen_random_uuid(),
  campaign_id uuid    not null references campaigns(id) on delete cascade,
  ship_id     uuid    not null references ships(id)   on delete cascade,
  player_id   uuid    not null references players(id) on delete cascade,

  -- Traveller crew roles; open text so campaigns can use their own terms.
  -- Common values: captain, pilot, navigator, engineer, medic, steward,
  --                gunner, cargo-master, crew
  role        text    not null default 'crew',

  joined_tick bigint  not null default 0,
  left_tick   bigint,                           -- null = still aboard

  -- Allow the same player to rejoin a ship at a later tick
  unique (ship_id, player_id, joined_tick)
);

create index if not exists idx_crew_player
  on crew (campaign_id, player_id, left_tick nulls first);

create index if not exists idx_crew_ship
  on crew (campaign_id, ship_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table ships enable row level security;
alter table crew  enable row level security;

create policy "public read ships"
  on ships for select using (true);

create policy "insert ships"
  on ships for insert with check (true);

create policy "update ships"
  on ships for update using (true);

create policy "public read crew"
  on crew for select using (true);

create policy "insert crew"
  on crew for insert with check (true);

create policy "update crew"
  on crew for update using (true);
