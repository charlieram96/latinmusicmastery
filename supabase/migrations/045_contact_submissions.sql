-- Messages sent from the public /contact form.
-- Rows are written by /api/contact with the service-role client, so there is
-- no public INSERT policy; only admins can read or delete them.

CREATE TABLE contact_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  email TEXT NOT NULL CHECK (char_length(email) <= 254),
  subject TEXT NOT NULL CHECK (subject IN ('General Inquiry', 'Technical Support', 'Billing', 'Partnership', 'Feedback')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 5000),
  -- Set once the notification email to the team has been accepted by SendGrid.
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX contact_submissions_created_at_idx ON contact_submissions (created_at DESC);

ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view contact submissions"
  ON contact_submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete contact submissions"
  ON contact_submissions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.is_admin = true
    )
  );
