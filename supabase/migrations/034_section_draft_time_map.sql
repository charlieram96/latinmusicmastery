-- ============================================
-- Compás — draft time map per scored section
--
-- The sync workshop now AUTOSAVES a section's audio alignment to a hidden draft
-- as the admin drags markers, instead of only persisting on an explicit Publish.
-- Students keep reading `active_time_map_id` (the last Published alignment); the
-- draft is admin-only until Publish promotes it. One draft map per section, so
-- autosave updates it in place and Publish clears it — DB rows stay bounded.
--
-- Mirrors active_time_map_id (028): ON DELETE SET NULL so deleting the map row
-- just clears the pointer.
-- ============================================

ALTER TABLE class_item_score_sections
  ADD COLUMN IF NOT EXISTS draft_time_map_id UUID
    REFERENCES score_time_maps(id) ON DELETE SET NULL;
