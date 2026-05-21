-- 019_course_fundamentals.sql
-- Introduce a genreless "fundamentals" course type for the new per-course
-- payment model: exactly one fundamentals course per instrument.

ALTER TABLE courses ALTER COLUMN musical_style_id DROP NOT NULL;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS is_fundamentals BOOLEAN NOT NULL DEFAULT false;

-- One fundamentals course per instrument.
CREATE UNIQUE INDEX IF NOT EXISTS courses_one_fundamentals_per_instrument
  ON courses (instrument)
  WHERE is_fundamentals;

-- Fundamentals ⇒ genreless + has instrument; genre course ⇒ has a style.
ALTER TABLE courses
  ADD CONSTRAINT courses_kind_valid CHECK (
    (is_fundamentals AND musical_style_id IS NULL AND instrument IS NOT NULL)
    OR (NOT is_fundamentals AND musical_style_id IS NOT NULL)
  );
