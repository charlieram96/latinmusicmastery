-- 023_pricing_table.sql
-- Single source of truth for the three per-instrument pricing knobs
-- (base_monthly, base_annual, addon_monthly). Stripe price_ids are stored
-- alongside the amount so the admin keeps them in sync manually.

CREATE TABLE IF NOT EXISTS pricing (
  key TEXT PRIMARY KEY CHECK (key IN ('base_monthly', 'base_annual', 'addon_monthly')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_price_id TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;

-- Prices are public information shown on the marketing site, so SELECT is open.
CREATE POLICY "Anyone can read pricing"
  ON pricing FOR SELECT USING (true);

-- Only admins can change them.
CREATE POLICY "Admins can manage pricing"
  ON pricing FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Seed with the spec's values; stripe_price_id is blank until the admin
-- creates the prices in Stripe and pastes them in.
INSERT INTO pricing (key, amount_cents, stripe_price_id, description) VALUES
  ('base_monthly',  1999,  '', 'Base instrument subscription, billed monthly'),
  ('base_annual',   20390, '', 'Base instrument subscription, billed annually (15% off)'),
  ('addon_monthly', 999,   '', 'Each additional genre course, billed monthly')
ON CONFLICT (key) DO NOTHING;
