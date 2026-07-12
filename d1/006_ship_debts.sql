-- Migration 006: ship debt tracking.
-- No interest — Traveller doesn't define compounding mechanics; Referee
-- manages the balance directly. ship_id is nullable so a future corporate/
-- fleet-level debt (not tied to one hull) can reuse this table. Payment
-- history gets its own table rather than the `transactions` ledger, since
-- that table's `type` is a CHECK constraint SQLite can't ALTER in place.

CREATE TABLE ship_debts (
  id              TEXT    PRIMARY KEY,
  campaign_id     TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ship_id         TEXT    REFERENCES ships(id) ON DELETE CASCADE,
  type            TEXT    NOT NULL CHECK (type IN ('mortgage', 'loan', 'obligation')),
  creditor_name   TEXT,
  principal       INTEGER NOT NULL,
  current_balance INTEGER NOT NULL,
  due_tick        INTEGER,
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ship_debts_ship
  ON ship_debts (campaign_id, ship_id);

CREATE TABLE debt_payments (
  id          TEXT    PRIMARY KEY,
  debt_id     TEXT    NOT NULL REFERENCES ship_debts(id) ON DELETE CASCADE,
  campaign_id TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ship_id     TEXT    REFERENCES ships(id) ON DELETE SET NULL,
  tick        INTEGER NOT NULL,
  amount      INTEGER NOT NULL,
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_debt_payments_debt
  ON debt_payments (debt_id, tick DESC);
