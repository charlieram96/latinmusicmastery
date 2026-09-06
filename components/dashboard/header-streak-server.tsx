import { createClient } from '@/lib/supabase/server'
import { computeStreaks } from '@/lib/dashboard/streak'
import { dateKeyFor, todayKey } from '@/lib/dashboard/time-zone'
import { HeaderStreakClient } from './header-streak'

/** Same source and math as the home page: completed lessons in class_item_progress. */
export async function HeaderStreak({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('class_item_progress')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('completed', true)
    .not('completed_at', 'is', null)

  const keys = (data ?? []).map((row) => dateKeyFor(row.completed_at as string))
  const { current } = computeStreaks(keys, todayKey())
  return <HeaderStreakClient streak={current} />
}
