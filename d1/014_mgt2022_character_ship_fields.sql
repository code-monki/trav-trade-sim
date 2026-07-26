-- ============================================================
-- Migration 014: MgT2022 rules-accuracy — characteristics, background,
-- ship armament, mail tonnage
--
-- Part of the trade/traffic rules-accuracy rebuild (see DEVLOG.md): several
-- book mechanics reference data that didn't exist anywhere in this schema —
-- a character's characteristics (Mail's SOC DM), service background/rank
-- (Mail's "highest Naval or Scout rank"), whether a ship is armed (Mail's
-- DM+2), and mail's per-container tonnage (5 tons/container, previously
-- never reserved against cargo capacity at all).
--
-- All columns nullable/defaulted so existing rows are unaffected — a
-- referee fills characteristics/background in per-character over time,
-- same as skills today.
-- ============================================================

ALTER TABLE players ADD COLUMN strength        INTEGER;
ALTER TABLE players ADD COLUMN dexterity       INTEGER;
ALTER TABLE players ADD COLUMN endurance       INTEGER;
ALTER TABLE players ADD COLUMN intelligence    INTEGER;
ALTER TABLE players ADD COLUMN education       INTEGER;
ALTER TABLE players ADD COLUMN social_standing INTEGER;
ALTER TABLE players ADD COLUMN background      TEXT;    -- e.g. 'Scout', 'Navy', 'Merchant'...
ALTER TABLE players ADD COLUMN rank            INTEGER; -- rank within that background

ALTER TABLE ships         ADD COLUMN armed INTEGER NOT NULL DEFAULT 0 CHECK (armed IN (0, 1));
ALTER TABLE ship_templates ADD COLUMN armed INTEGER NOT NULL DEFAULT 0 CHECK (armed IN (0, 1));

ALTER TABLE obligations ADD COLUMN mail_containers INTEGER; -- mail only; 5 tons/container

INSERT INTO schema_migrations (id, applied_at) VALUES ('014', unixepoch());
