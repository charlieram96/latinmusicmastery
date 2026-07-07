-- 035_lesson_subtitles.sql
-- Subtitle tracks for lesson videos. Admin uploads .srt files (converted to
-- WebVTT client-side); the player renders them as <track> elements. Both
-- language URLs are stored side by side — deliberately NOT a base/_es localize
-- pair, because the player needs both tracks simultaneously so the student can
-- switch caption language independently of the UI locale.

ALTER TABLE public.class_items
  ADD COLUMN IF NOT EXISTS subtitles_en_url text,
  ADD COLUMN IF NOT EXISTS subtitles_es_url text;

-- Dedicated public bucket for WebVTT files (course-videos' MIME allowlist is
-- dashboard-managed, so we don't touch it). Same admin-write / public-read
-- pattern as quiz-media (033).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lesson-subtitles', 'lesson-subtitles', true, 2097152, ARRAY['text/vtt'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view lesson subtitles"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lesson-subtitles');

CREATE POLICY "Admins can upload lesson subtitles"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'lesson-subtitles'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update lesson subtitles"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'lesson-subtitles'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete lesson subtitles"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'lesson-subtitles'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
