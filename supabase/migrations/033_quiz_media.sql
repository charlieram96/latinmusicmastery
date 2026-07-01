-- 033_quiz_media.sql
-- Two new quiz question types need media:
--   * audio_choice        — a prompt audio clip students listen to before answering
--   * instrument_assembly — a background image parts get dragged onto
-- Add the primary-media columns to quiz_questions (per-option/per-part media
-- lives inside the existing `options` jsonb) and create a dedicated public
-- `quiz-media` bucket with the same admin-write / public-read pattern used by
-- instrument-images (009).

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS image_url text;

-- Dedicated public bucket for quiz media (audio clips + instrument images).
INSERT INTO storage.buckets (id, name, public)
VALUES ('quiz-media', 'quiz-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view quiz media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'quiz-media');

CREATE POLICY "Admins can upload quiz media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'quiz-media'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update quiz media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'quiz-media'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete quiz media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'quiz-media'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
