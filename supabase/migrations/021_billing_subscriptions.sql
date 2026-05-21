-- 021_billing_subscriptions.sql
-- Per-course payment model: one subscription per (user, instrument) plus the
-- set of genre courses entitled under it. Runs in parallel with the legacy
-- `subscriptions` table (0 rows, removed in Phase 3). Does NOT touch the
-- existing access-tracking `course_enrollments` table.

CREATE TABLE IF NOT EXISTS instrument_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  instrument TEXT NOT NULL,
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year')),
  stripe_customer_id TEXT,
  stripe_base_subscription_id TEXT,
  stripe_addon_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'incomplete'
    CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete')),
  base_current_period_end TIMESTAMPTZ,
  addon_current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  pending_interval TEXT CHECK (pending_interval IN ('month', 'year')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, instrument)
);

CREATE INDEX IF NOT EXISTS idx_instrument_subscriptions_user
  ON instrument_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS subscription_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_subscription_id UUID NOT NULL
    REFERENCES instrument_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_courses_sub
  ON subscription_courses(instrument_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_courses_course
  ON subscription_courses(course_id);

ALTER TABLE instrument_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_courses ENABLE ROW LEVEL SECURITY;

-- Users read their own rows; admins read all. Writes go through the service
-- role (Stripe webhooks / server actions), which bypasses RLS.
CREATE POLICY "Users read own instrument subscriptions"
  ON instrument_subscriptions FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

CREATE POLICY "Users read own subscription courses"
  ON subscription_courses FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );
