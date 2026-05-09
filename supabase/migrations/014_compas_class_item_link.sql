-- ============================================
-- Compás — link class_items to scores
-- Adds nullable score_document_id and active_time_map_id columns to class_items.
-- Existing class_items are unaffected (legacy soundslice_embed_url path remains).
-- The renderer prioritizes score_document_id > soundslice_embed_url > video_url.
-- ============================================

ALTER TABLE class_items
  ADD COLUMN IF NOT EXISTS score_document_id UUID REFERENCES score_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_time_map_id UUID REFERENCES score_time_maps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_class_items_score_document_id
  ON class_items(score_document_id)
  WHERE score_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_class_items_active_time_map_id
  ON class_items(active_time_map_id)
  WHERE active_time_map_id IS NOT NULL;
