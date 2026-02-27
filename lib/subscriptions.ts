import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

type Subscription = Database['public']['Tables']['subscriptions']['Row']

export async function getActiveSubscriptions(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Subscription[]> {
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')

  return data || []
}

export async function canAccessCourse(
  supabase: SupabaseClient<Database>,
  userId: string,
  courseInstrument: string | null,
  isAdmin: boolean
): Promise<boolean> {
  if (isAdmin) return true

  const subs = await getActiveSubscriptions(supabase, userId)
  if (subs.length === 0) return false

  // All-access grants everything
  if (subs.some((s) => s.plan_type === 'all_access')) return true

  // Courses with null or 'Various' instrument: any active sub grants access
  if (!courseInstrument || courseInstrument === 'Various') return true

  // Instrument-specific: must match
  return subs.some(
    (s) => s.plan_type === 'instrument' && s.instrument === courseInstrument
  )
}

export async function hasAnySubscription(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const { count } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active')

  return (count ?? 0) > 0
}
