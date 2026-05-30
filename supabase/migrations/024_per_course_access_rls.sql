-- 024_per_course_access_rls.sql
-- Phase 3: per-course access oracle + lock the lesson-content tables.
-- Before this migration class_items SELECT was USING(true), so paid videos
-- could be pulled directly from the data API bypassing the in-app gate.

-- ── Access oracle ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_course_access(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH c AS (
    SELECT id, instrument, is_fundamentals
    FROM courses
    WHERE id = p_course_id
  )
  SELECT
    -- Admins see everything.
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    OR
    -- Fundamentals: any active instrument_subscription for that instrument unlocks it.
    EXISTS (
      SELECT 1
      FROM c
      JOIN instrument_subscriptions s
        ON s.user_id = auth.uid()
       AND s.status = 'active'
       AND s.instrument = c.instrument
      WHERE c.is_fundamentals = true
    )
    OR
    -- Genre course: a subscription_courses row whose parent sub is active.
    EXISTS (
      SELECT 1
      FROM c
      JOIN subscription_courses sc
        ON sc.user_id = auth.uid() AND sc.course_id = c.id
      JOIN instrument_subscriptions s
        ON s.id = sc.instrument_subscription_id
       AND s.status = 'active'
      WHERE c.is_fundamentals = false
    );
$$;

REVOKE ALL ON FUNCTION public.has_course_access(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.has_course_access(uuid) TO authenticated, anon;

-- ── Lock down class_items (the security hole) ────────────────────────────
DROP POLICY IF EXISTS "Anyone can view class items" ON class_items;

CREATE POLICY "Users see class items they may access"
  ON class_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM classes cl
      JOIN course_sections sec ON sec.id = cl.section_id
      WHERE cl.id = class_items.class_id
        AND (cl.is_free = true OR public.has_course_access(sec.course_id))
    )
  );

-- ── Replace the legacy lessons SELECT policy (it referenced the
--     soon-to-be-deleted `subscriptions` table). ──────────────────────────
DROP POLICY IF EXISTS "Subscribers can view lessons" ON lessons;

CREATE POLICY "Users see lessons they may access"
  ON lessons FOR SELECT
  USING (is_free = true OR public.has_course_access(course_id));
