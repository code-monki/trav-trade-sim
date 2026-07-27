-- ============================================================
-- Migration 019: add 'broker_commission' to transactions.type
--
-- Part of the CT7 (Book 7 Merchant Prince) rules-accuracy pass (see
-- DEVLOG.md). A player using their own Broker skill to sell cargo nets
-- half the standard brokerage fee as pure profit (brokerSelfServiceGain),
-- added to proceeds rather than deducted — previously modeled backwards
-- as a 'fee'-type deduction. Recorded as its own income-side transaction
-- type so Reports/ledger render it correctly (src/lib/reports.js's
-- TYPE_LABEL/INCOME_TYPES).
--
-- transactions holds real transaction history (read by Reports/ledger),
-- so rebuilt via copy-and-rename rather than a destructive drop, since
-- SQLite can't ALTER a CHECK constraint in place and existing rows must
-- survive.
-- ============================================================

CREATE TABLE transactions_new (
  id              TEXT    PRIMARY KEY,
  campaign_id     TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  player_id       TEXT    NOT NULL REFERENCES players(id)   ON DELETE CASCADE,
  ship_id         TEXT    REFERENCES ships(id) ON DELETE SET NULL,
  tick            INTEGER NOT NULL,
  type            TEXT    NOT NULL CHECK (type IN (
                    'buy', 'sell', 'fee', 'event',
                    'fuel', 'passenger_fare', 'passenger_refund', 'mail',
                    'freight_charge', 'freight_refund', 'freight_penalty',
                    'broker_commission'
                  )),
  trade_good_die  TEXT,
  trade_good_name TEXT,
  tons            INTEGER,
  price_per_ton   INTEGER,
  total_cr        INTEGER NOT NULL,
  world_hex       TEXT,
  sector          TEXT,
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO transactions_new
  (id, campaign_id, player_id, ship_id, tick, type, trade_good_die, trade_good_name,
   tons, price_per_ton, total_cr, world_hex, sector, notes, created_at)
SELECT
  id, campaign_id, player_id, ship_id, tick, type, trade_good_die, trade_good_name,
  tons, price_per_ton, total_cr, world_hex, sector, notes, created_at
FROM transactions;

DROP TABLE transactions;
ALTER TABLE transactions_new RENAME TO transactions;

CREATE INDEX IF NOT EXISTS idx_txn_player
  ON transactions (campaign_id, player_id, tick DESC);
CREATE INDEX IF NOT EXISTS idx_txn_ship
  ON transactions (campaign_id, ship_id, tick DESC);

INSERT INTO schema_migrations (id, applied_at) VALUES ('019', unixepoch());
