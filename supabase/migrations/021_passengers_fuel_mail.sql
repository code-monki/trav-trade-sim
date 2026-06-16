-- ============================================================
-- Passengers, Fuel, and Mail Contracts — migration 021
--
-- Adds passenger manifest and mail contract tables, expands the
-- transactions type constraint to cover the new expense/income
-- types, and adds stateroom + low berth capacity fields to ships.
-- ============================================================

-- ── Ships: passenger capacity columns ────────────────────────────────────────

alter table ships
  add column if not exists stateroom_capacity int not null default 0,
  add column if not exists low_berth_capacity int not null default 0;

-- ── Passenger Manifests ───────────────────────────────────────────────────────
-- Tracks booked passengers from embarkation to delivery (or refund).
-- Status lifecycle: in_transit → delivered (auto on location match)
--                               or refunded (referee override)

create table if not exists passenger_manifests (
  id                uuid   primary key default gen_random_uuid(),
  campaign_id       uuid   not null references campaigns(id) on delete cascade,
  ship_id           uuid   not null references ships(id)     on delete cascade,
  player_id         uuid   references players(id),

  passage_type      text   not null check (passage_type in ('high','middle','low')),
  count             int    not null default 1 check (count > 0),

  embark_world_hex  text   not null,
  embark_sector     text   not null,
  embark_world_name text,
  embark_tick       bigint not null,

  dest_world_hex    text   not null,
  dest_sector       text   not null,
  dest_world_name   text,

  fare_per_head     bigint not null,   -- Cr per passenger
  fare_total        bigint not null,   -- fare_per_head × count

  status            text   not null default 'in_transit'
                    check (status in ('in_transit','delivered','refunded')),

  resolve_tick      bigint,            -- tick when delivered or refunded

  created_at        timestamptz not null default now()
);

create index if not exists idx_passengers_ship
  on passenger_manifests (campaign_id, ship_id, status);

create index if not exists idx_passengers_dest
  on passenger_manifests (dest_world_hex, dest_sector)
  where status = 'in_transit';

-- ── Mail Contracts ────────────────────────────────────────────────────────────

create table if not exists mail_contracts (
  id                uuid   primary key default gen_random_uuid(),
  campaign_id       uuid   not null references campaigns(id) on delete cascade,
  ship_id           uuid   not null references ships(id)     on delete cascade,
  player_id         uuid   references players(id),

  origin_world_hex  text   not null,
  origin_sector     text   not null,
  origin_world_name text,
  accept_tick       bigint not null,

  dest_world_hex    text   not null,
  dest_sector       text   not null,
  dest_world_name   text,

  parsecs           int    not null default 1 check (parsecs > 0),
  payment           bigint not null,   -- total Cr on delivery

  status            text   not null default 'in_transit'
                    check (status in ('in_transit','delivered')),

  resolve_tick      bigint,

  created_at        timestamptz not null default now()
);

create index if not exists idx_mail_ship
  on mail_contracts (campaign_id, ship_id, status);

-- ── Transactions: extend type constraint ─────────────────────────────────────
-- Drop the existing check and replace with one that includes the new types.
-- 'fuel'              — fuel purchase (debit, negative total_cr)
-- 'passenger_fare'    — passenger fare collected on delivery (credit)
-- 'passenger_refund'  — fare refunded on early disembarkation (debit/zero)
-- 'mail'              — mail contract payment on delivery (credit)

alter table transactions
  drop constraint if exists transactions_type_check;

alter table transactions
  add  constraint transactions_type_check
    check (type in ('buy','sell','fee','event','fuel','passenger_fare','passenger_refund','mail'));

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table passenger_manifests enable row level security;
alter table mail_contracts       enable row level security;

create policy "public read passenger_manifests"
  on passenger_manifests for select using (true);

create policy "insert passenger_manifests"
  on passenger_manifests for insert with check (true);

create policy "update passenger_manifests"
  on passenger_manifests for update using (true);

create policy "public read mail_contracts"
  on mail_contracts for select using (true);

create policy "insert mail_contracts"
  on mail_contracts for insert with check (true);

create policy "update mail_contracts"
  on mail_contracts for update using (true);
