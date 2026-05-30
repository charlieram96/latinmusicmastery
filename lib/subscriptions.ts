import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * The fields canAccessCourse needs from the `courses` row.
 * Callers should pass these (typically already loaded for rendering).
 */
export interface AccessCourse {
  id: string
  instrument: string | null
  is_fundamentals: boolean | null
}

/**
 * Per-course access check (Phase 3). Mirrors the SQL `has_course_access`
 * SECURITY DEFINER function — kept in sync so app-layer redirects and the
 * RLS backstop agree on who can see a course.
 *
 *   1. Admins → allow.
 *   2. Course without an instrument → deny (orphan content; nothing to gate against).
 *   3. Fundamentals → allow iff an active instrument_subscription for the instrument.
 *   4. Genre course → allow iff an active subscription_courses row, whose parent
 *      instrument_subscription is active.
 */
export async function canAccessCourse(
  supabase: SupabaseClient<Database>,
  userId: string,
  course: AccessCourse,
  isAdmin: boolean
): Promise<boolean> {
  if (isAdmin) return true
  if (!course.instrument) return false

  if (course.is_fundamentals) {
    const { count } = await supabase
      .from('instrument_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('instrument', course.instrument)
      .eq('status', 'active')
    return (count ?? 0) > 0
  }

  // Genre course: must hold a subscription_courses row, joined to an active
  // instrument_subscription. PostgREST returns the join only if both rows
  // satisfy the filters, so we count the rows here.
  const { count } = await supabase
    .from('subscription_courses')
    .select('id, instrument_subscriptions!inner(status)', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('course_id', course.id)
    .eq('instrument_subscriptions.status', 'active')
  return (count ?? 0) > 0
}

/** Convenience: does the user have ANY active instrument subscription? */
export async function hasAnyInstrumentSubscription(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const { count } = await supabase
    .from('instrument_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active')
  return (count ?? 0) > 0
}

/**
 * Does the user have an active subscription for a specific instrument?
 * Used to decide whether to show "Add to my plan" vs "Subscribe to unlock"
 * on a course detail page.
 */
export async function hasInstrumentSubscription(
  supabase: SupabaseClient<Database>,
  userId: string,
  instrument: string
): Promise<boolean> {
  const { count } = await supabase
    .from('instrument_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('instrument', instrument)
    .eq('status', 'active')
  return (count ?? 0) > 0
}
