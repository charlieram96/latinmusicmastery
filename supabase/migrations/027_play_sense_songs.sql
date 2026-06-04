-- ============================================
-- 027_play_sense_songs
-- Standalone PlaySense songs are now score-backed: a ScoreDocument is the single
-- source of truth and the rhythm highway derives its events at runtime via
-- scoreToExerciseDefinition(). This table is the standalone owner of a score
-- (parallel to class_items.score_document_id), holding only the metadata the
-- clock-agnostic score model can't carry (difficulty / publish / order / which
-- track is graded).
--
-- The legacy play_sense_exercises table (raw events JSON, throwaway test data) is
-- dropped here. play_sense_attempts.exercise_id was an FK into it; CASCADE removes
-- that constraint. exercise_id stays as a plain string holding the score-derived
-- ExerciseDefinition.id (a song id or class_item id) so saveAttempt keeps working.
-- ============================================

CREATE TABLE IF NOT EXISTS play_sense_songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  score_document_id UUID NOT NULL UNIQUE REFERENCES score_documents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'intermediate'
    CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  track_index INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_play_sense_songs_published
  ON play_sense_songs(is_published, order_index);
CREATE INDEX IF NOT EXISTS idx_play_sense_songs_score_document_id
  ON play_sense_songs(score_document_id);

CREATE TRIGGER trg_play_sense_songs_updated_at
  BEFORE UPDATE ON play_sense_songs
  FOR EACH ROW EXECUTE FUNCTION update_compas_updated_at();

-- RLS: authenticated read, admin write (mirrors score_documents exactly).
ALTER TABLE play_sense_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "play_sense_songs_select_authenticated"
  ON play_sense_songs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "play_sense_songs_admin_all"
  ON play_sense_songs FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ============================================
-- Drop the legacy events-JSON table. Throwaway test data; CASCADE removes the
-- play_sense_attempts.exercise_id FK constraint (exercise_id remains a string).
-- ============================================
DROP TABLE IF EXISTS play_sense_exercises CASCADE;
