-- ============================================
-- 045_ticketed_events
--
-- Simple ticketing on the existing Stripe account.
--
--   ticketed_events       -- an event (concert, workshop) with venue, time, and
--                            the admin-designed ticket template (ticket_design).
--   ticket_tiers          -- priced ticket types per event (General, VIP...),
--                            each with an optional capacity and sale window.
--   ticket_orders         -- one purchase (Stripe Checkout, free RSVP, or an
--                            admin-issued comp). Buyers may be guests or users.
--   ticket_order_items    -- tier quantities in an order; this is what holds
--                            inventory while a Checkout Session is open.
--   tickets               -- one admission each: ticket number (printed and
--                            typed by staff) + secret code (in the QR).
--   ticket_scanner_links  -- shareable door-scanner links for non-admin staff.
--   ticket_scans          -- audit log of every scan / manual check-in.
--
-- Every write goes through server code using the service role. The reserve
-- and availability functions are therefore service-role only; RLS grants
-- admins full read/write and buyers read access to their own orders.
-- ============================================

CREATE TABLE IF NOT EXISTS ticketed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'closed', 'cancelled')),
  title TEXT NOT NULL,
  title_es TEXT,
  subtitle TEXT,
  subtitle_es TEXT,
  description TEXT,
  description_es TEXT,
  venue_name TEXT,
  venue_address TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  doors_at TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  currency TEXT NOT NULL DEFAULT 'usd',
  -- Optional cap across all tiers (venue capacity). NULL = only tier caps apply.
  capacity INTEGER CHECK (capacity IS NULL OR capacity >= 0),
  max_per_order INTEGER NOT NULL DEFAULT 10 CHECK (max_per_order BETWEEN 1 AND 50),
  image_url TEXT,
  ticket_design JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_message TEXT,
  email_message_es TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticketed_events_starts_at_idx ON ticketed_events (starts_at);

CREATE TABLE IF NOT EXISTS ticket_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES ticketed_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_es TEXT,
  description TEXT,
  description_es TEXT,
  -- 0 = free. Stripe rejects charges under $0.50, so paid tiers start there.
  price_cents INTEGER NOT NULL CHECK (price_cents = 0 OR price_cents >= 50),
  capacity INTEGER CHECK (capacity IS NULL OR capacity >= 0),
  sales_start_at TIMESTAMPTZ,
  sales_end_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_tiers_event_idx ON ticket_tiers (event_id, sort_order);

CREATE TABLE IF NOT EXISTS ticket_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: an event with orders is cancelled or closed, never deleted.
  event_id UUID NOT NULL REFERENCES ticketed_events(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'comp', 'expired', 'cancelled', 'refunded')),
  source TEXT NOT NULL DEFAULT 'stripe' CHECK (source IN ('stripe', 'free', 'admin')),
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'es')),
  -- Secret for the buyer's order page and PDF download link.
  access_token TEXT NOT NULL UNIQUE,
  amount_total_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_total_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  -- Pending orders hold inventory until this moment.
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  email_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  email_sent_at TIMESTAMPTZ,
  email_error TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_orders_event_status_idx ON ticket_orders (event_id, status);
CREATE INDEX IF NOT EXISTS ticket_orders_user_idx ON ticket_orders (user_id);
CREATE INDEX IF NOT EXISTS ticket_orders_payment_intent_idx ON ticket_orders (stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS ticket_orders_email_idx ON ticket_orders (lower(buyer_email));

CREATE TABLE IF NOT EXISTS ticket_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ticket_orders(id) ON DELETE CASCADE,
  -- RESTRICT: a tier that has sold is deactivated, never deleted.
  tier_id UUID NOT NULL REFERENCES ticket_tiers(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  UNIQUE (order_id, tier_id)
);

CREATE INDEX IF NOT EXISTS ticket_order_items_tier_idx ON ticket_order_items (tier_id);

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ticket_orders(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES ticketed_events(id) ON DELETE RESTRICT,
  tier_id UUID NOT NULL REFERENCES ticket_tiers(id) ON DELETE RESTRICT,
  -- Position within the order; UNIQUE(order_id, seq) makes fulfillment
  -- idempotent when Stripe delivers the same event twice.
  seq INTEGER NOT NULL CHECK (seq > 0),
  ticket_number TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  attendee_name TEXT,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'checked_in', 'void')),
  checked_in_at TIMESTAMPTZ,
  checked_in_by TEXT,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, seq)
);

CREATE INDEX IF NOT EXISTS tickets_event_idx ON tickets (event_id, status);
CREATE INDEX IF NOT EXISTS tickets_tier_idx ON tickets (tier_id);

CREATE TABLE IF NOT EXISTS ticket_scanner_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES ticketed_events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  -- Kept readable (admin-only RLS) so admins can re-send a link to staff.
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_scanner_links_event_idx ON ticket_scanner_links (event_id);

CREATE TABLE IF NOT EXISTS ticket_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES ticketed_events(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  scanner_link_id UUID REFERENCES ticket_scanner_links(id) ON DELETE SET NULL,
  admin_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  scanned_value TEXT,
  result TEXT NOT NULL CHECK (result IN (
    'admitted', 'already_checked_in', 'void', 'refunded', 'wrong_event',
    'not_found', 'verified', 'undone'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_scans_event_idx ON ticket_scans (event_id, created_at DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- Inventory
-- ──────────────────────────────────────────────────────────────────────────

-- Admissions a tier has committed: paid/comp quantities minus voided tickets,
-- plus pending orders whose hold has not expired.
CREATE OR REPLACE FUNCTION public.ticket_tier_taken(p_tier_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (
    COALESCE((
      SELECT SUM(oi.quantity)
      FROM ticket_order_items oi
      JOIN ticket_orders o ON o.id = oi.order_id
      WHERE oi.tier_id = p_tier_id
        AND (o.status IN ('paid', 'comp') OR (o.status = 'pending' AND o.expires_at > now()))
    ), 0)
    - (
      SELECT COUNT(*)
      FROM tickets t
      JOIN ticket_orders o ON o.id = t.order_id
      WHERE t.tier_id = p_tier_id
        AND t.status = 'void'
        AND o.status IN ('paid', 'comp')
    )
  )::INTEGER;
$$;

-- Per-tier counts for an event: taken (incl. live holds), sold (paid/comp,
-- excluding void), and checked in.
CREATE OR REPLACE FUNCTION public.ticket_event_availability(p_event_id UUID)
RETURNS TABLE (tier_id UUID, taken INTEGER, sold INTEGER, checked_in INTEGER)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    tt.id,
    public.ticket_tier_taken(tt.id),
    (SELECT COUNT(*)::INTEGER FROM tickets t JOIN ticket_orders o ON o.id = t.order_id
      WHERE t.tier_id = tt.id AND t.status <> 'void' AND o.status IN ('paid', 'comp')),
    (SELECT COUNT(*)::INTEGER FROM tickets t WHERE t.tier_id = tt.id AND t.status = 'checked_in')
  FROM ticket_tiers tt
  WHERE tt.event_id = p_event_id;
$$;

-- Atomically checks capacity and creates an order with its items. The event
-- row lock serialises concurrent checkouts for the same event, so two buyers
-- can never both take the last ticket. Raises:
--   event_not_found | tier_not_found | invalid_quantity | empty_order
--   sold_out:<tier_id> | event_sold_out
CREATE OR REPLACE FUNCTION public.reserve_ticket_order(
  p_event_id UUID,
  p_items JSONB,
  p_buyer_name TEXT,
  p_buyer_email TEXT,
  p_user_id UUID,
  p_locale TEXT,
  p_access_token TEXT,
  p_status TEXT,
  p_source TEXT,
  p_expires_at TIMESTAMPTZ,
  p_enforce_capacity BOOLEAN DEFAULT TRUE,
  p_created_by UUID DEFAULT NULL
)
RETURNS ticket_orders
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_event ticketed_events%ROWTYPE;
  v_order ticket_orders%ROWTYPE;
  v_line RECORD;
  v_tier ticket_tiers%ROWTYPE;
  v_total_qty INTEGER := 0;
  v_amount INTEGER := 0;
  v_event_taken INTEGER;
BEGIN
  SELECT * INTO v_event FROM ticketed_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'empty_order';
  END IF;

  -- Duplicate tier lines are merged before checking.
  FOR v_line IN
    SELECT (e->>'tier_id')::UUID AS tier_id, SUM((e->>'quantity')::INTEGER)::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) e
    GROUP BY 1
  LOOP
    IF v_line.quantity IS NULL OR v_line.quantity < 1 THEN
      RAISE EXCEPTION 'invalid_quantity';
    END IF;
    SELECT * INTO v_tier FROM ticket_tiers WHERE id = v_line.tier_id AND event_id = p_event_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'tier_not_found';
    END IF;
    IF p_enforce_capacity AND v_tier.capacity IS NOT NULL
       AND public.ticket_tier_taken(v_tier.id) + v_line.quantity > v_tier.capacity THEN
      RAISE EXCEPTION 'sold_out:%', v_tier.id;
    END IF;
    v_total_qty := v_total_qty + v_line.quantity;
    v_amount := v_amount + v_line.quantity * v_tier.price_cents;
  END LOOP;

  IF p_enforce_capacity AND v_event.capacity IS NOT NULL THEN
    SELECT COALESCE(SUM(public.ticket_tier_taken(id)), 0) INTO v_event_taken
    FROM ticket_tiers WHERE event_id = p_event_id;
    IF v_event_taken + v_total_qty > v_event.capacity THEN
      RAISE EXCEPTION 'event_sold_out';
    END IF;
  END IF;

  INSERT INTO ticket_orders (
    event_id, status, source, buyer_name, buyer_email, user_id, locale,
    access_token, amount_total_cents, currency, expires_at, paid_at, created_by
  ) VALUES (
    p_event_id, p_status, p_source, p_buyer_name, p_buyer_email, p_user_id, p_locale,
    p_access_token, CASE WHEN p_status = 'comp' THEN 0 ELSE v_amount END, v_event.currency,
    p_expires_at, CASE WHEN p_status IN ('paid', 'comp') THEN now() END, p_created_by
  )
  RETURNING * INTO v_order;

  INSERT INTO ticket_order_items (order_id, tier_id, quantity, unit_price_cents)
  SELECT v_order.id, l.tier_id, l.quantity,
         CASE WHEN p_status = 'comp' THEN 0 ELSE t.price_cents END
  FROM (
    SELECT (e->>'tier_id')::UUID AS tier_id, SUM((e->>'quantity')::INTEGER)::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) e
    GROUP BY 1
  ) l
  JOIN ticket_tiers t ON t.id = l.tier_id;

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.ticket_tier_taken(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ticket_event_availability(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_ticket_order(UUID, JSONB, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ticket_tier_taken(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.ticket_event_availability(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_ticket_order(UUID, JSONB, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, BOOLEAN, UUID) TO service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- Row level security
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE ticketed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_scanner_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read listed events"
  ON ticketed_events FOR SELECT USING (status <> 'draft');
CREATE POLICY "Admins can manage events"
  ON ticketed_events FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Anyone can read tiers of listed events"
  ON ticket_tiers FOR SELECT
  USING (EXISTS (SELECT 1 FROM ticketed_events e WHERE e.id = event_id AND e.status <> 'draft'));
CREATE POLICY "Admins can manage tiers"
  ON ticket_tiers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Buyers can read their orders"
  ON ticket_orders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can manage orders"
  ON ticket_orders FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Buyers can read their order items"
  ON ticket_order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM ticket_orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Admins can manage order items"
  ON ticket_order_items FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Buyers can read their tickets"
  ON tickets FOR SELECT
  USING (EXISTS (SELECT 1 FROM ticket_orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Admins can manage tickets"
  ON tickets FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can manage scanner links"
  ON ticket_scanner_links FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can read scans"
  ON ticket_scans FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ──────────────────────────────────────────────────────────────────────────
-- Event images (event page hero, ticket logo/background). Public read so the
-- server can fetch them into the PDF and email clients can load them.
-- ──────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view event images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-images');

CREATE POLICY "Admins can upload event images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'event-images'
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

CREATE POLICY "Admins can update event images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'event-images'
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

CREATE POLICY "Admins can delete event images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'event-images'
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );
