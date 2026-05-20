-- 018_email_images_bucket.sql
-- Public storage bucket for header/hero images attached to waitlist emails.
-- Admins write, everyone reads — mirrors the country-images / instrument-images
-- bucket policies. Public read is required so the images load inside email
-- clients (referenced by their public URL).

INSERT INTO storage.buckets (id, name, public)
VALUES ('email-images', 'email-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view email images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'email-images');

CREATE POLICY "Admins can upload email images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'email-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update email images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'email-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete email images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'email-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
