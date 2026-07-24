-- ============================================================
-- Migration 013: Reusable event definitions
--
-- Decouples "what an event does" (description, buy/sell modifiers,
-- duration, trade good die, scope, severity) from "where/when it's
-- applied" (market_events' world_hex/sector/tick/expires_tick). A
-- definition can be manually assigned to a world by the referee
-- (RefereeView.vue), or picked up by the deterministic per-tick
-- auto-generator (maybeGenerateEvent in src/lib/market-events.js) the same
-- way a built-in MARKET_EVENTS entry is — either way it lands in
-- market_events with source 'manual' or 'auto' respectively. No lasting
-- link is kept from a market_events row back to the definition it came
-- from; assignment copies the definition's fields at that moment.
--
-- The built-in "Quick Events" catalogue (RefereeView.vue's
-- EVENT_CATALOGUE) stays a static, hardcoded list — not seeded here.
-- ============================================================

CREATE TABLE event_definitions (
  id                TEXT    PRIMARY KEY,
  campaign_id       TEXT    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  description       TEXT    NOT NULL,
  scope             TEXT    NOT NULL DEFAULT 'local' CHECK (scope IN ('local', 'subsector')),
  severity          TEXT    NOT NULL DEFAULT 'minor'  CHECK (severity IN ('minor', 'major', 'crisis')),
  buy_modifier_pct  INTEGER,
  sell_modifier_pct INTEGER,
  duration_ticks    INTEGER NOT NULL DEFAULT 4,
  trade_good_die    TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (campaign_id, description)
);

CREATE INDEX idx_event_definitions_campaign ON event_definitions (campaign_id);

INSERT INTO schema_migrations (id, applied_at) VALUES ('013', unixepoch());
