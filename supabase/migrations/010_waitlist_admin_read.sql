-- Allow admins to read and delete waitlist entries.
-- The 006 migration only added an INSERT policy for anonymous signups,
-- which left the table unreadable from the admin panel.

CREATE POLICY "Admins can view waitlist"
  ON waitlist
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete waitlist entries"
  ON waitlist
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );
