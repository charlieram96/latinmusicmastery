-- ============================================
-- Compás — multiple scored sections per video class_item
--
-- A VIDEO lesson is mostly the instructor talking, with a few stretches where
-- they demonstrate and we want notation on screen. Each such stretch is a
-- "section": it OWNS one score_document (1:1, like play_sense_songs) and points
-- at one active time map. The section's video range (start/end seconds) is
-- derived from its published waypoints and stored here for ordering, fast
-- active-section lookup, and scrubber markers.
--
-- This supersedes the single class_items.score_document_id / active_time_map_id
-- pair for VIDEO items (those columns are backfilled into one section below and
-- then cleared). EXERCISE / QUIZ / JAM keep the single-score columns.
-- ============================================

CREATE TABLE IF NOT EXISTS class_item_score_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_item_id UUID NOT NULL REFERENCES class_items(id) ON DELETE CASCADE,
  score_document_id UUID NOT NULL REFERENCES score_documents(id) ON DELETE CASCADE,
  active_time_map_id UUID REFERENCES score_time_maps(id) ON DELETE SET NULL,
  section_index INTEGER NOT NULL,
  label TEXT,
  -- Derived from the active time map's waypoints (min/max video_time_seconds)
  -- at publish time. NULL until first publish.
  video_start_seconds DOUBLE PRECISION,
  video_end_seconds DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (class_item_id, section_index)
);

CREATE INDEX IF NOT EXISTS idx_sections_class_item
  ON class_item_score_sections(class_item_id, section_index);

-- RLS — mirror score_time_maps: everyone authenticated can read; only admins write.
ALTER TABLE class_item_score_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_item_score_sections_select_authenticated" ON class_item_score_sections;
CREATE POLICY "class_item_score_sections_select_authenticated"
  ON class_item_score_sections
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "class_item_score_sections_admin_all" ON class_item_score_sections;
CREATE POLICY "class_item_score_sections_admin_all"
  ON class_item_score_sections
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ============================================
-- Backfill: each VIDEO class_item that already has a score becomes section 0.
-- Guarded by NOT EXISTS so it is safe to re-run.
-- ============================================

INSERT INTO class_item_score_sections (
  class_item_id, score_document_id, active_time_map_id, section_index,
  video_start_seconds, video_end_seconds
)
SELECT
  ci.id,
  ci.score_document_id,
  ci.active_time_map_id,
  0,
  wp.min_start,
  wp.max_end
FROM class_items ci
LEFT JOIN LATERAL (
  SELECT
    MIN(video_time_seconds) AS min_start,
    MAX(video_time_seconds) AS max_end
  FROM score_time_waypoints
  WHERE time_map_id = ci.active_time_map_id
) wp ON TRUE
WHERE ci.item_type = 'VIDEO'
  AND ci.score_document_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM class_item_score_sections s WHERE s.class_item_id = ci.id
  );

-- Sections are now the single source of truth for VIDEO items — clear the legacy
-- single-score pointers so nothing reads them by accident.
UPDATE class_items
SET score_document_id = NULL,
    active_time_map_id = NULL
WHERE item_type = 'VIDEO'
  AND score_document_id IS NOT NULL;
