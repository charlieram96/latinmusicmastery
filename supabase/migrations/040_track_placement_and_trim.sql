-- ============================================
-- 040_track_placement_and_trim
--
-- 1) Backing tracks stop being "equal-length, pre-synced" (the assumption
--    stated in 029's header). Each track becomes a CLIP: it lands at an
--    explicit position on the exercise video's visible timeline and may be
--    trimmed at both ends.
-- 2) Main-track trim for the two studios that HAVE a main track: the VIDEO
--    lesson's demo video and the EXERCISE part's play-along video. Both are
--    class_items columns, but they are DIFFERENT videos, hence two pairs.
--
-- Trim is NON-DESTRUCTIVE: offsets only. Source uploads are never rewritten,
-- and clearing a trim restores the original exactly. Synced time-map waypoints
-- keep their absolute media positions -- nothing here rebases them.
-- ============================================

ALTER TABLE class_item_backing_tracks
  -- Where the clip's trimmed-in point sits on the exercise video's timeline
  -- (the same axis as score_time_waypoints.video_time_seconds).
  ADD COLUMN IF NOT EXISTS timeline_start_seconds  DOUBLE PRECISION NOT NULL DEFAULT 0,
  -- Offsets INTO THE SOURCE FILE. NULL trim_out = "play to the end of the file".
  ADD COLUMN IF NOT EXISTS trim_in_seconds         DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trim_out_seconds        DOUBLE PRECISION,
  -- Learned from the first successful waveform decode. NULL = not yet probed;
  -- the clip model treats an unknown duration as "don't clamp the out-point".
  ADD COLUMN IF NOT EXISTS source_duration_seconds DOUBLE PRECISION,
  -- The musical position timeline_start_seconds MEANT, plus the map it was
  -- measured against. Re-dragging markers and republishing is the studio's core
  -- loop; without these, every republish would silently move every backing
  -- track relative to the music -- the exact misalignment this feature removes.
  -- position_qn is authoritative for student playback; when time_map_id no
  -- longer matches the active map, timeline_start_seconds is recomputed from it.
  ADD COLUMN IF NOT EXISTS position_qn             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS time_map_id             UUID REFERENCES score_time_maps(id) ON DELETE SET NULL;

ALTER TABLE class_item_backing_tracks
  DROP CONSTRAINT IF EXISTS backing_track_placement_valid;
ALTER TABLE class_item_backing_tracks
  ADD CONSTRAINT backing_track_placement_valid CHECK (
    timeline_start_seconds >= 0
    AND trim_in_seconds >= 0
    AND (trim_out_seconds IS NULL OR trim_out_seconds > trim_in_seconds)
    AND (source_duration_seconds IS NULL OR source_duration_seconds > 0)
  );

ALTER TABLE class_items
  -- Watch / VIDEO-lesson demo video (class_items.video_url).
  ADD COLUMN IF NOT EXISTS video_trim_in_seconds           DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_trim_out_seconds          DOUBLE PRECISION,
  -- EXERCISE play-along video (class_items.exercise_video_url).
  ADD COLUMN IF NOT EXISTS exercise_video_trim_in_seconds  DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exercise_video_trim_out_seconds DOUBLE PRECISION;

-- Fold the existing linear crop into the new trim so nothing regresses. The
-- crop-start slider is replaced by the timeline trim handles; keeping both
-- would give the exercise video a THIRD windowing mechanism alongside
-- exercise_time_map_id (032), which already supersedes the crop when set.
UPDATE class_items
   SET exercise_video_trim_in_seconds = exercise_video_start_seconds
 WHERE exercise_video_start_seconds > 0
   AND exercise_video_trim_in_seconds = 0;

ALTER TABLE class_items
  DROP CONSTRAINT IF EXISTS class_items_trim_valid;
ALTER TABLE class_items
  ADD CONSTRAINT class_items_trim_valid CHECK (
    video_trim_in_seconds >= 0
    AND (video_trim_out_seconds IS NULL OR video_trim_out_seconds > video_trim_in_seconds)
    AND exercise_video_trim_in_seconds >= 0
    AND (exercise_video_trim_out_seconds IS NULL
         OR exercise_video_trim_out_seconds > exercise_video_trim_in_seconds)
  );

-- No new index: idx_backing_tracks_class_item (class_item_id, order_index)
-- already covers the only read path.
-- No RLS change: 029's policies are FOR ALL / FOR SELECT on the table and are
-- column-agnostic.
