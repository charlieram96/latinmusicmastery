-- Add waitlist preference columns: instruments, genres/styles, expertise level.
-- All optional so existing rows remain valid; arrays default to empty,
-- expertise_level constrained to a fixed set.
ALTER TABLE waitlist
  ADD COLUMN instrument_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN style_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN expertise_level TEXT
    CHECK (expertise_level IN ('beginner', 'intermediate', 'advanced'));
