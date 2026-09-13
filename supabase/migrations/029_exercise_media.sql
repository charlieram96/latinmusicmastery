-- ============================================
-- Two-part EXERCISE media
--
-- 1) Optional exercise-part video: plays muted alongside the rhythm highway,
--    synced to the engine's fixed-BPM clock. The admin crops it with a start
--    offset; the visible window is exactly the graded score's length, so only
--    a start point is stored. Independent of class_items.video_url (the Watch
--    part's demo video).
-- 2) Instrument backing tracks the student selects before playing. Tracks are
--    assumed equal-length and pre-synced with the notes; the engine starts all
--    selected tracks at the same AudioContext timestamp.
--
-- SUPERSEDED BY 040: backing tracks now carry their own position and trim, and
-- the crop in (1) was folded into exercise_video_trim_in_seconds. Neither
-- assumption above still holds; see 040_track_placement_and_trim.sql.
-- ============================================

ALTER TABLE class_items
  ADD COLUMN IF NOT EXISTS exercise_video_url TEXT,
  ADD COLUMN IF NOT EXISTS exercise_video_start_seconds DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS class_item_backing_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_item_id UUID NOT NULL REFERENCES class_items(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backing_tracks_class_item
  ON class_item_backing_tracks(class_item_id, order_index);

-- RLS — mirror class_item_score_sections (028): authenticated read, admin write.
ALTER TABLE class_item_backing_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_item_backing_tracks_select_authenticated" ON class_item_backing_tracks;
CREATE POLICY "class_item_backing_tracks_select_authenticated"
  ON class_item_backing_tracks
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "class_item_backing_tracks_admin_all" ON class_item_backing_tracks;
CREATE POLICY "class_item_backing_tracks_admin_all"
  ON class_item_backing_tracks
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
