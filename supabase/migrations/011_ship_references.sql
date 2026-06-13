-- ============================================================
-- Add ship_id to transactional tables — migration 011
--
-- Ties cargo holdings, the credit ledger, and realized trade
-- records to the ship that made them.  Nullable so that rows
-- predating this migration and referee-only records remain
-- valid without a ship assignment.
--
-- Also deprecates the now-superseded columns on players:
--   players.ship_name    → replaced by ships.name + crew table
--   players.current_world → replaced by ships.current_world
-- The columns are retained for the current release and will be
-- removed once the UI is updated to use the ship store.
-- ============================================================

-- ── cargo ─────────────────────────────────────────────────────────────────────

alter table cargo
  add column if not exists ship_id uuid
    references ships(id) on delete set null;

create index if not exists idx_cargo_ship
  on cargo (campaign_id, ship_id);

-- ── transactions ──────────────────────────────────────────────────────────────

alter table transactions
  add column if not exists ship_id uuid
    references ships(id) on delete set null;

create index if not exists idx_txn_ship
  on transactions (campaign_id, ship_id, tick desc);

-- ── trade_records ─────────────────────────────────────────────────────────────

alter table trade_records
  add column if not exists ship_id uuid
    references ships(id) on delete set null;

create index if not exists idx_trade_records_ship
  on trade_records (campaign_id, ship_id, sell_tick desc);

-- ── Deprecation comments on players ──────────────────────────────────────────

comment on column players.ship_name is
  'Deprecated (migration 011): use ships.name + crew table instead.';

comment on column players.current_world is
  'Deprecated (migration 011): use ships.current_world + crew table instead.';
