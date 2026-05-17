-- ============================================
-- Compás — custom Soundslice replacement
-- Schema for score documents, tracks, time maps, waypoints, clips, revisions
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- score_documents
-- A score (notation) imported or authored in Compás.
-- parsed_score holds the normalized internal model (tracks → measures → voices → notes).
-- source_storage_path points into the compas-scores bucket when imported from MusicXML/MIDI/PDF/image.
-- ============================================
CREATE TABLE IF NOT EXISTS score_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  composer TEXT,
  source_format TEXT NOT NULL CHECK (source_format IN ('musicxml','midi','pdf','image','native')),
  source_storage_path TEXT,
  parsed_score JSONB NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_score_documents_created_by ON score_documents(created_by);
CREATE INDEX IF NOT EXISTS idx_score_documents_created_at ON score_documents(created_at DESC);

-- ============================================
-- score_tracks
-- One row per instrument track within a score (guitar 1, bass, conga, etc.).
-- track_index mirrors position in parsed_score.tracks[].
-- ============================================
CREATE TABLE IF NOT EXISTS score_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  score_document_id UUID NOT NULL REFERENCES score_documents(id) ON DELETE CASCADE,
  track_index INTEGER NOT NULL,
  instrument TEXT NOT NULL,
  display_name TEXT NOT NULL,
  tuning JSONB,
  string_multiplicity INTEGER DEFAULT 1,
  channel INTEGER,
  default_view TEXT CHECK (default_view IN ('staff','tab','fretboard','rhythm-grid','pdf')),
  UNIQUE(score_document_id, track_index)
);

CREATE INDEX IF NOT EXISTS idx_score_tracks_doc ON score_tracks(score_document_id, track_index);

-- ============================================
-- score_time_maps
-- A time-mapping definition (one of four methods: tempo, tap, drag, midi).
-- class_item_id is nullable — a "default" map for the score, OR a class-item-specific override.
-- params is method-specific tuning (e.g. {bpm: 120, offset_seconds: 0.5}).
-- ============================================
CREATE TABLE IF NOT EXISTS score_time_maps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  score_document_id UUID NOT NULL REFERENCES score_documents(id) ON DELETE CASCADE,
  class_item_id UUID REFERENCES class_items(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('tempo','tap','drag','midi')),
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_score_time_maps_doc ON score_time_maps(score_document_id);
CREATE INDEX IF NOT EXISTS idx_score_time_maps_class_item ON score_time_maps(class_item_id) WHERE class_item_id IS NOT NULL;

-- ============================================
-- score_time_waypoints
-- Dense (musicalPosition, videoTime) pairs that the player linearly interpolates.
-- All four sync methods materialize into this single table.
-- ============================================
CREATE TABLE IF NOT EXISTS score_time_waypoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  time_map_id UUID NOT NULL REFERENCES score_time_maps(id) ON DELETE CASCADE,
  musical_position_qn DOUBLE PRECISION NOT NULL,
  video_time_seconds DOUBLE PRECISION NOT NULL,
  measure_number INTEGER,
  beat_in_measure DOUBLE PRECISION,
  CHECK (video_time_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS idx_waypoints_time_map ON score_time_waypoints(time_map_id, musical_position_qn);

-- ============================================
-- score_clips
-- User-saved A/B loop ranges with optional rate.
-- ============================================
CREATE TABLE IF NOT EXISTS score_clips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_item_id UUID NOT NULL REFERENCES class_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_seconds DOUBLE PRECISION NOT NULL,
  end_seconds DOUBLE PRECISION NOT NULL,
  loop_count INTEGER,
  playback_rate DOUBLE PRECISION DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_seconds > start_seconds),
  CHECK (start_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS idx_clips_user_item ON score_clips(user_id, class_item_id);

-- ============================================
-- score_revisions
-- Editor versioning — point-in-time snapshots of parsed_score for recovery and undo across sessions.
-- ============================================
CREATE TABLE IF NOT EXISTS score_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  score_document_id UUID NOT NULL REFERENCES score_documents(id) ON DELETE CASCADE,
  parsed_score JSONB NOT NULL,
  edit_summary TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revisions_doc ON score_revisions(score_document_id, created_at DESC);

-- ============================================
-- updated_at triggers (mirrors existing pattern in earlier migrations)
-- ============================================
CREATE OR REPLACE FUNCTION update_compas_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_score_documents_updated_at
  BEFORE UPDATE ON score_documents
  FOR EACH ROW EXECUTE FUNCTION update_compas_updated_at();

CREATE TRIGGER trg_score_time_maps_updated_at
  BEFORE UPDATE ON score_time_maps
  FOR EACH ROW EXECUTE FUNCTION update_compas_updated_at();

-- ============================================
-- Row Level Security
-- Pattern: any authenticated user can SELECT (matches existing class_items behavior);
-- only admins (profiles.is_admin = true) can INSERT/UPDATE/DELETE.
-- score_clips is row-owner only.
-- score_revisions is admin-only (read + write).
-- Subscription gating happens at the class_items / classes level upstream and is checked
-- in application code; this RLS layer assumes that gate has already been crossed.
-- ============================================

ALTER TABLE score_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_time_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_time_waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_revisions ENABLE ROW LEVEL SECURITY;

-- score_documents: authenticated read, admin write
CREATE POLICY "score_documents_select_authenticated"
  ON score_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "score_documents_admin_all"
  ON score_documents FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- score_tracks: authenticated read, admin write
CREATE POLICY "score_tracks_select_authenticated"
  ON score_tracks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "score_tracks_admin_all"
  ON score_tracks FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- score_time_maps: authenticated read, admin write
CREATE POLICY "score_time_maps_select_authenticated"
  ON score_time_maps FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "score_time_maps_admin_all"
  ON score_time_maps FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- score_time_waypoints: authenticated read, admin write
CREATE POLICY "score_time_waypoints_select_authenticated"
  ON score_time_waypoints FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "score_time_waypoints_admin_all"
  ON score_time_waypoints FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- score_clips: row-owner only
CREATE POLICY "score_clips_owner_select"
  ON score_clips FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "score_clips_owner_insert"
  ON score_clips FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "score_clips_owner_update"
  ON score_clips FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "score_clips_owner_delete"
  ON score_clips FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- score_revisions: admin-only for both read and write
CREATE POLICY "score_revisions_admin_all"
  ON score_revisions FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ============================================
-- Storage bucket: compas-scores
-- Private bucket for raw notation source files (MusicXML, MIDI, PDF, image).
-- Public access is denied; the app serves files via signed URLs (issued by an Edge Function in M6).
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'compas-scores',
  'compas-scores',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/vnd.recordare.musicxml+xml',
    'application/vnd.recordare.musicxml',
    'application/xml',
    'text/xml',
    'audio/midi',
    'audio/x-midi',
    'application/x-midi',
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/zip' -- .mxl compressed MusicXML
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: admins write, authenticated users read (signed-URL gate happens at app layer)
CREATE POLICY "compas_scores_admin_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'compas-scores'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "compas_scores_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'compas-scores'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "compas_scores_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'compas-scores'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "compas_scores_authenticated_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'compas-scores');
