CREATE TABLE waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
-- Allow anonymous inserts (anon key), no reads
CREATE POLICY "Anyone can join waitlist" ON waitlist FOR INSERT WITH CHECK (true);
