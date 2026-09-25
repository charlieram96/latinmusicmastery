-- ============================================
-- 043_studio_versions
--
-- Studio rework P6 (drafts, publish, history). An admin edit no longer writes
-- straight to the live rows (score_documents, score_time_maps / waypoints, the
-- section/class_item anchor): it autosaves into a DRAFT row here, and Publish
-- is what copies it into those live rows. This table also keeps PUBLISHED
-- snapshots, so it is both the draft store and the history log.
--
-- Admin-only end to end: students keep reading the live rows exactly as
-- today (score_documents, score_tracks, score_time_maps, score_time_waypoints,
-- the section and class_item columns). Nothing here is read by a student path.
-- ============================================

CREATE TABLE IF NOT EXISTS studio_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- section = class_item_score_sections.id, exercise = class_items.id,
  -- song = play_sense_songs.id (see the plan's owner-kind table).
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('section', 'exercise', 'song')),
  owner_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('draft', 'published')),
  score JSONB NOT NULL,
  timing JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Bumped in place by the once-a-minute draft upsert; the draft write policy
  -- reads this to decide whether an owner is unpublished.
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- SET NULL, so deleting an admin's account keeps the history they wrote.
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_studio_versions_owner
  ON studio_versions(owner_kind, owner_id, updated_at DESC);

-- RLS — admin-only, both ways. Unlike score_documents/score_time_maps there is
-- no student SELECT policy: this table is never read outside the Studio.
ALTER TABLE studio_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "studio_versions_admin_all"
  ON studio_versions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- draft_time_map_id is superseded by studio_versions: a section's draft sync is
-- now a studio_versions draft row, not a second score_time_maps row. Nothing
-- new writes this column; publishTimeMap only clears a legacy draft map it
-- still finds there. It is not dropped here so a rollback of the app code
-- alone still has somewhere to read from.
COMMENT ON COLUMN class_item_score_sections.draft_time_map_id IS
  'DEPRECATED (2026-09, Studio rework P6): superseded by studio_versions. Nothing new writes it; publishTimeMap still clears a legacy draft map found here.';
