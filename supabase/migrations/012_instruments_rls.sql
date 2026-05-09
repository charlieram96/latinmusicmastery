-- Enable RLS on instruments and instrument_styles. These tables were previously
-- exposed to the anon role for read AND write (RLS disabled). They power public
-- pages, so we need anonymous SELECT to keep working, but writes must be locked
-- down to admins.

ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instrument_styles ENABLE ROW LEVEL SECURITY;

-- Public read

CREATE POLICY "Public can view instruments"
  ON public.instruments
  FOR SELECT
  USING (true);

CREATE POLICY "Public can view instrument_styles"
  ON public.instrument_styles
  FOR SELECT
  USING (true);

-- Admin writes (matches the pattern from 010_waitlist_admin_read.sql)

CREATE POLICY "Admins can insert instruments"
  ON public.instruments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update instruments"
  ON public.instruments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete instruments"
  ON public.instruments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert instrument_styles"
  ON public.instrument_styles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update instrument_styles"
  ON public.instrument_styles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete instrument_styles"
  ON public.instrument_styles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );
