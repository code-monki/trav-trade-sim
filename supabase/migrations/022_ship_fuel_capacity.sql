-- Migration 022: Add fuel_capacity and fuel_current to ships
-- fuel_capacity = maximum fuel tank volume in tons (set by referee)
-- fuel_current  = current fuel level in tons (updated on purchase / manual referee adjustment)

ALTER TABLE ships
  ADD COLUMN IF NOT EXISTS fuel_capacity INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fuel_current  INT NOT NULL DEFAULT 0;
