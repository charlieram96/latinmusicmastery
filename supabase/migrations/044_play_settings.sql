-- ============================================
-- 044_play_settings
--
-- Studio rework P5: graded play-along placement (EXERCISE + JAM_SESSION).
--
-- Bar 1 replaces the exercise drag map for placing the play-along media: a
-- graded owner's grid (score.initialTempo / confirmed tempo marks) already
-- knows every bar's length, so all it needs from the admin is WHERE bar 1
-- lands on the video/audio timeline. Graded owners stop publishing time maps;
-- exercise_time_map_id stays read-only for older code.
--
--   play_bar1_seconds  -- media seconds where bar 1 begins. Nullable: unset
--                          until an admin places it (or until backfilled below).
--   play_count_in_bars -- 1 or 2 bars of count-in before playback starts.
--   play_preroll       -- whether the video/audio pre-rolls before the count-in
--                          (see the plan's pre-roll clamp rules) or waits at bar 1.
--
-- Backfill: existing play-alongs already have a musical anchor for bar 1 --
-- the first waypoint (lowest musical_position_qn) of their exercise time map,
-- same source 042 used to seed the exercise metronome anchor. Seeding
-- play_bar1_seconds from it preserves today's placement exactly. Guarded on
-- IS NULL so it is safe to re-run.
-- ============================================

ALTER TABLE class_items
  ADD COLUMN IF NOT EXISTS play_bar1_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS play_count_in_bars SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS play_preroll BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE class_items DROP CONSTRAINT IF EXISTS class_items_play_count_in_valid;
ALTER TABLE class_items ADD CONSTRAINT class_items_play_count_in_valid
  CHECK (play_count_in_bars BETWEEN 1 AND 2);

-- Bar 1 of existing play-alongs: the first waypoint of their exercise time map.
UPDATE class_items ci
SET play_bar1_seconds = w.video_time_seconds
FROM score_time_waypoints w
WHERE ci.exercise_time_map_id IS NOT NULL
  AND ci.play_bar1_seconds IS NULL
  AND w.time_map_id = ci.exercise_time_map_id
  AND w.musical_position_qn = (
    SELECT MIN(w2.musical_position_qn) FROM score_time_waypoints w2 WHERE w2.time_map_id = ci.exercise_time_map_id
  );

-- No RLS change: 029's policies are FOR ALL / FOR SELECT and column-agnostic.
