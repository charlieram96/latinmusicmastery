-- 022_score_waveforms_bucket.sql
-- Public storage bucket for cached audio waveform peaks used by the PlaySense
-- Studio sync editor. The editor decodes a lesson video's audio once in the
-- admin's browser, computes a compact min/max peaks JSON, and uploads it here
-- so reopening the sync tool is instant. Peaks are non-sensitive numeric
-- summaries; admins write, authenticated users read. Mirrors 018_email_images.

INSERT INTO storage.buckets (id, name, public)
VALUES ('score-waveforms', 'score-waveforms', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view score waveforms"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'score-waveforms');

CREATE POLICY "Admins can upload score waveforms"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'score-waveforms'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update score waveforms"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'score-waveforms'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete score waveforms"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'score-waveforms'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
