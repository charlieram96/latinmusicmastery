import { createClient } from '@/lib/supabase/server'
import { HeaderStreakClient } from './header-streak'

async function calculateStreak(userId: string): Promise<number> {
  const supabase = await createClient()

  // Get distinct activity dates ordered by most recent
  const { data: activities } = await supabase
    .from('user_progress_legacy')
    .select('updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (!activities || activities.length === 0) {
    return 0
  }

  // Get unique dates (in user's local date format)
  const uniqueDates = new Set<string>()
  activities.forEach((activity) => {
    if (activity.updated_at) {
      const date = new Date(activity.updated_at).toISOString().split('T')[0]
      uniqueDates.add(date)
    }
  })

  const sortedDates = Array.from(uniqueDates).sort().reverse()

  // Check if there's activity today or yesterday
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
    return 0 // Streak is broken
  }

  // Count consecutive days
  let streak = 0
  let currentDate = new Date(sortedDates[0])

  for (const dateStr of sortedDates) {
    const date = new Date(dateStr)
    const expectedDate = new Date(currentDate)
    expectedDate.setDate(expectedDate.getDate() - streak)

    if (date.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
      streak++
    } else {
      break
    }
  }

  return streak
}

export async function HeaderStreak({ userId }: { userId: string }) {
  const streak = await calculateStreak(userId)
  return <HeaderStreakClient streak={streak} />
}
