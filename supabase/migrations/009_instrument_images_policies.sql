-- 009_instrument_images_policies.sql
-- The `instrument-images` bucket existed but had no RLS policies, so every
-- upload failed with "new row violates row-level security policy". Add the
-- same admin-gated write + public-read pattern used by teacher-images and
-- country-images.

CREATE POLICY "Public can view instrument images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'instrument-images');

CREATE POLICY "Admins can upload instrument images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'instrument-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update instrument images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'instrument-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete instrument images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'instrument-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
