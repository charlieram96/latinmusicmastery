-- ============================================
-- Rename Compás → PlaySense Studio
--
-- Renames the compas_events table (+ indexes + RLS policies) and the
-- compas-scores storage bucket (+ policies). The other tables introduced
-- in migration 013 (score_documents, score_tracks, score_time_maps,
-- score_time_waypoints, score_clips, score_revisions) are already
-- neutrally named and need no rename.
--
-- Safe to apply mid-flight: all renames are atomic and preserve data.
-- The storage bucket rename relies on storage.objects(bucket_id)'s
-- ON UPDATE CASCADE foreign key (Supabase default).
-- ============================================

-- Events table
ALTER TABLE IF EXISTS compas_events RENAME TO playsense_studio_events;

-- Events indexes
ALTER INDEX IF EXISTS idx_compas_events_type_created
  RENAME TO idx_playsense_studio_events_type_created;
ALTER INDEX IF EXISTS idx_compas_events_class_item
  RENAME TO idx_playsense_studio_events_class_item;

-- Primary key and foreign key constraints (table rename leaves these alone)
ALTER INDEX IF EXISTS compas_events_pkey
  RENAME TO playsense_studio_events_pkey;
ALTER TABLE playsense_studio_events
  RENAME CONSTRAINT compas_events_class_item_id_fkey
  TO playsense_studio_events_class_item_id_fkey;
ALTER TABLE playsense_studio_events
  RENAME CONSTRAINT compas_events_user_id_fkey
  TO playsense_studio_events_user_id_fkey;

-- Events RLS policies (Postgres lacks ALTER POLICY ... RENAME TO across
-- all supported versions, so drop + recreate)
DROP POLICY IF EXISTS "compas_events_insert_authenticated" ON playsense_studio_events;
DROP POLICY IF EXISTS "compas_events_admin_read" ON playsense_studio_events;

CREATE POLICY "playsense_studio_events_insert_authenticated"
  ON playsense_studio_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "playsense_studio_events_admin_read"
  ON playsense_studio_events FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Storage bucket. bucket_id is the primary key and storage.objects
-- references it with ON UPDATE CASCADE in Supabase's default schema,
-- so updating in place migrates all existing objects.
UPDATE storage.buckets
  SET id = 'playsense-studio-scores',
      name = 'playsense-studio-scores'
  WHERE id = 'compas-scores';

-- Storage policies
DROP POLICY IF EXISTS "compas_scores_admin_write" ON storage.objects;
DROP POLICY IF EXISTS "compas_scores_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "compas_scores_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "compas_scores_authenticated_read" ON storage.objects;

CREATE POLICY "playsense_studio_scores_admin_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'playsense-studio-scores'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "playsense_studio_scores_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'playsense-studio-scores'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "playsense_studio_scores_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'playsense-studio-scores'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "playsense_studio_scores_authenticated_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'playsense-studio-scores');
