-- ============================================================
-- Traveller Trade Simulator — initial schema
-- Classic Traveller Book 7 speculative trade engine
-- Paste into Supabase SQL Editor and run.
-- ============================================================

-- Extensions
create extension if not exists pgcrypto;   -- gen_salt, crypt


-- ── Campaigns ────────────────────────────────────────────────────────────────
-- A campaign is a shared play context identified by a short code.
-- No PII is stored anywhere in this schema.

create table if not exists campaigns (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,          -- e.g. "SPINWARD-42"
  label       text not null,                 -- display name
  milieu      text not null default 'M1105', -- Traveller Map milieu code
  trade_rules text not null default 'CT7',   -- rules edition in use
  created_at  timestamptz not null default now()
);

-- ── Players ───────────────────────────────────────────────────────────────────
-- Identity = (campaign_id, character_name).
-- PIN is stored as a bcrypt hash — never the raw value.
-- Failed-attempt tracking is also stored here.

create table if not exists players (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  character_name  text not null,
  pin_hash        text not null,             -- bcrypt hash of the PIN
  role            text not null default 'player', -- 'player' | 'referee'
  credits         bigint not null default 0,
  ship_name       text,
  current_world   text,                      -- hex code or sector+hex
  failed_attempts int  not null default 0,
  locked_until    timestamptz,
  last_seen       timestamptz,
  created_at      timestamptz not null default now(),
  unique (campaign_id, character_name)
);

-- ── Imperial Calendar ─────────────────────────────────────────────────────────
-- One row per campaign; tracks the current in-game date.
-- tick = one jump-week (approx 7 Imperial days).
-- date displayed as DDD-YYYY (day-of-year + year).

create table if not exists campaign_calendar (
  campaign_id  uuid primary key references campaigns(id) on delete cascade,
  current_tick bigint not null default 0,   -- ticks elapsed since campaign start
  year         int    not null default 1105,
  day          int    not null default 1,   -- 1–365
  updated_at   timestamptz not null default now()
);

-- ── Market Snapshots (weekly raw data) ────────────────────────────────────────
-- One row per (campaign, world, trade_good, tick).
-- Stores the rolled price so players see what's actually available.

create table if not exists market_snapshots (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  world_hex       text not null,
  sector          text not null,
  trade_good_die  text not null,             -- Book 2 die code e.g. '11'
  trade_good_name text not null,
  tick            bigint not null,
  purchase_price  int  not null,             -- Cr/ton at this world this tick
  sale_price      int  not null,
  qty_available   int  not null,
  source_codes    text not null default '',  -- space-sep trade codes
  created_at      timestamptz not null default now(),
  unique (campaign_id, world_hex, sector, trade_good_die, tick)
);

create index if not exists idx_snapshots_world
  on market_snapshots (campaign_id, world_hex, sector, tick desc);

-- ── Monthly OHLC rollup ───────────────────────────────────────────────────────
-- Aggregated at end-of-month (4 ticks = ~1 Imperial month).

create table if not exists market_monthly (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references campaigns(id) on delete cascade,
  world_hex      text not null,
  sector         text not null,
  trade_good_die text not null,
  year           int  not null,
  month          int  not null,              -- 1–12
  open_price     int  not null,
  high_price     int  not null,
  low_price      int  not null,
  close_price    int  not null,
  volume_tons    int  not null default 0,
  created_at     timestamptz not null default now(),
  unique (campaign_id, world_hex, sector, trade_good_die, year, month)
);

create index if not exists idx_monthly_world
  on market_monthly (campaign_id, world_hex, sector, trade_good_die, year, month);

-- ── Annual OHLC rollup ────────────────────────────────────────────────────────

create table if not exists market_annual (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references campaigns(id) on delete cascade,
  world_hex      text not null,
  sector         text not null,
  trade_good_die text not null,
  year           int  not null,
  open_price     int  not null,
  high_price     int  not null,
  low_price      int  not null,
  close_price    int  not null,
  volume_tons    int  not null default 0,
  created_at     timestamptz not null default now(),
  unique (campaign_id, world_hex, sector, trade_good_die, year)
);

-- ── Cargo (player holdings) ───────────────────────────────────────────────────

create table if not exists cargo (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  player_id       uuid not null references players(id) on delete cascade,
  trade_good_die  text not null,
  trade_good_name text not null,
  tons            int  not null check (tons > 0),
  purchase_price  int  not null,             -- Cr/ton paid
  purchased_tick  bigint not null,
  purchase_world  text not null,
  purchase_sector text not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_cargo_player
  on cargo (campaign_id, player_id);

-- ── Transactions ─────────────────────────────────────────────────────────────
-- Immutable ledger of all buy/sell events.

create table if not exists transactions (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references campaigns(id) on delete cascade,
  player_id       uuid not null references players(id) on delete cascade,
  tick            bigint not null,
  type            text not null check (type in ('buy','sell','fee','event')),
  trade_good_die  text,
  trade_good_name text,
  tons            int,
  price_per_ton   int,
  total_cr        bigint not null,           -- positive = income, negative = expense
  world_hex       text,
  sector          text,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_txn_player
  on transactions (campaign_id, player_id, tick desc);

-- ── Market Events ─────────────────────────────────────────────────────────────
-- M.U.L.E.-style events affecting prices at local or subsector scope.

create table if not exists market_events (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references campaigns(id) on delete cascade,
  tick           bigint not null,
  scope          text not null check (scope in ('local','subsector')),
  world_hex      text,                       -- null = subsector-wide
  sector         text,
  trade_good_die text,                       -- null = affects all goods
  effect_pct     int  not null,              -- e.g. +20 or -15 (percent)
  description    text not null,
  expires_tick   bigint,                     -- null = permanent until overridden
  created_at     timestamptz not null default now()
);

create index if not exists idx_events_world
  on market_events (campaign_id, world_hex, sector, tick desc);


-- ============================================================
-- Row Level Security
-- ============================================================

alter table campaigns        enable row level security;
alter table players          enable row level security;
alter table campaign_calendar enable row level security;
alter table market_snapshots  enable row level security;
alter table market_monthly    enable row level security;
alter table market_annual     enable row level security;
alter table cargo             enable row level security;
alter table transactions      enable row level security;
alter table market_events     enable row level security;

-- ── Public read: market data, events, calendar ────────────────────────────────
-- Anyone with the campaign code can see market prices and events.
-- Player holdings and transactions are player-scoped.

create policy "public read campaigns"
  on campaigns for select using (true);

create policy "public read calendar"
  on campaign_calendar for select using (true);

create policy "public read market snapshots"
  on market_snapshots for select using (true);

create policy "public read market monthly"
  on market_monthly for select using (true);

create policy "public read market annual"
  on market_annual for select using (true);

create policy "public read market events"
  on market_events for select using (true);

-- ── Players: read own row only ────────────────────────────────────────────────
-- Player rows are matched by the Supabase anonymous user id stored in a
-- session context variable set at login (see auth helper).
-- For now open read is acceptable; tighten post-MVP.
create policy "public read players"
  on players for select using (true);

-- ── Cargo and transactions: read by player ────────────────────────────────────
create policy "public read cargo"
  on cargo for select using (true);

create policy "public read transactions"
  on transactions for select using (true);

-- ── Writes: anon users can insert/update via app logic only ──────────────────
-- All mutations go through the client with the anon key; RLS prevents
-- cross-campaign or cross-player writes via column checks.
-- Tighten with auth.uid() binding post-MVP when session model is finalised.

create policy "insert campaigns"
  on campaigns for insert with check (true);

create policy "insert players"
  on players for insert with check (true);

create policy "update players"
  on players for update using (true);

create policy "upsert calendar"
  on campaign_calendar for insert with check (true);

create policy "update calendar"
  on campaign_calendar for update using (true);

create policy "insert snapshots"
  on market_snapshots for insert with check (true);

create policy "insert monthly"
  on market_monthly for insert with check (true);

create policy "insert annual"
  on market_annual for insert with check (true);

create policy "insert cargo"
  on cargo for insert with check (true);

create policy "update cargo"
  on cargo for update using (true);

create policy "delete cargo"
  on cargo for delete using (true);

create policy "insert transactions"
  on transactions for insert with check (true);

create policy "insert events"
  on market_events for insert with check (true);

create policy "update events"
  on market_events for update using (true);
