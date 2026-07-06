-- Add has_stateroom flag to crew.
-- Default 1 = crew member occupies a stateroom (standard).
-- Set to 0 to double-bunk the crew member and free their stateroom for passengers.
ALTER TABLE crew ADD COLUMN has_stateroom INTEGER NOT NULL DEFAULT 1;
