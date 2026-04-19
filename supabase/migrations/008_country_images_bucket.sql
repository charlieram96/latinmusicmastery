-- 008_country_images_bucket.sql
-- Public storage bucket for country flag/landscape images shown in the
-- Explore pages. Admins write, everyone reads — mirrors the teacher-images
-- bucket policies.

INSERT INTO storage.buckets (id, name, public)
VALUES ('country-images', 'country-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view country images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'country-images');

CREATE POLICY "Admins can upload country images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'country-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update country images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'country-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete country images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'country-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
