-- ============================================
-- Sync the EXERCISE play-along video to the notation
--
-- The two-part exercise's play-along video (class_items.exercise_video_url) was
-- only crop-aligned: a single start offset, then a linear fixed-BPM mapping.
-- This adds an optional time map so the video can be precisely synced to the
-- graded score's beats — the same waypoint machinery the Watch sections use.
--
-- The map maps the EXERCISE score document's musical position to the EXERCISE
-- video's seconds. It is stored separately from active_time_map_id, which for an
-- exercise item already maps the score to the *Watch* demo video (the watch-mode
-- fallback). ON DELETE SET NULL so dropping the map (e.g. removing the video)
-- leaves the class item intact.
-- ============================================

ALTER TABLE class_items
  ADD COLUMN IF NOT EXISTS exercise_time_map_id UUID
    REFERENCES score_time_maps(id) ON DELETE SET NULL;
