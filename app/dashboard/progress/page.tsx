import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeRow } from '@/lib/i18n/localize'
import { ProgressView } from './progress-view'

export default async function MyProgressPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get all class item progress for this user
  const { data: itemProgress } = await supabase
    .from('class_item_progress')
    .select(`
      *,
      class_item:class_items(
        id,
        title,
        title_es,
        item_type,
        video_duration_seconds,
        class_id,
        class:classes(
          id,
          title,
          title_es,
          section:course_sections(
            course_id,
            courses(id, title, title_es, slug)
          )
        )
      )
    `)
    .eq('user_id', user.id)

  // Localize item / class / course titles to the viewer's language.
  const locale = await getServerLocale()
  for (const p of itemProgress ?? []) {
    const item = p.class_item as Record<string, unknown> | null
    if (!item) continue
    localizeRow(item, locale, ['title'])
    const cls = item['class'] as Record<string, unknown> | null
    if (!cls) continue
    localizeRow(cls, locale, ['title'])
    const section = cls['section'] as Record<string, unknown> | null
    const course = section?.['courses'] as Record<string, unknown> | null
    if (course) localizeRow(course, locale, ['title'])
  }

  // Get all exercise attempts
  const { data: exerciseAttempts } = await supabase
    .from('exercise_attempts')
    .select('*')
    .eq('user_id', user.id)

  // Calculate stats
  const totalItems = itemProgress?.length || 0
  const completedItems = itemProgress?.filter(p => p.completed).length || 0
  const inProgressItems = totalItems - completedItems

  const totalExercises = exerciseAttempts?.length || 0
  const correctExercises = exerciseAttempts?.filter(e => e.is_correct).length || 0
  const accuracyRate = totalExercises > 0
    ? Math.round((correctExercises / totalExercises) * 100)
    : 0

  // Calculate total learning time from completed video items
  const totalMinutes = itemProgress
    ?.filter(p => p.completed)
    .reduce((sum, p) => {
      const item = p.class_item as any
      return sum + Math.round((item?.video_duration_seconds || 0) / 60)
    }, 0) || 0
  const totalHours = Math.round(totalMinutes / 60)

  // Calculate streak from completed_at dates
  let currentStreak = 0
  if (itemProgress && itemProgress.length > 0) {
    const uniqueDates = new Set<string>()
    itemProgress.forEach((p) => {
      if (p.completed_at) {
        const date = new Date(p.completed_at).toISOString().split('T')[0]
        uniqueDates.add(date)
      }
    })
    const sortedDates = Array.from(uniqueDates).sort().reverse()
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    if (sortedDates[0] === today || sortedDates[0] === yesterday) {
      const currentDate = new Date(sortedDates[0])
      for (const dateStr of sortedDates) {
        const date = new Date(dateStr)
        const expectedDate = new Date(currentDate)
        expectedDate.setDate(expectedDate.getDate() - currentStreak)
        if (date.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
          currentStreak++
        } else {
          break
        }
      }
    }
  }

  // Recent activity
  const recentActivity = (itemProgress
    ?.filter(p => p.updated_at)
    .sort((a, b) => new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime())
    .slice(0, 5)) || []

  return (
    <ProgressView
      totalItems={totalItems}
      completedItems={completedItems}
      inProgressItems={inProgressItems}
      totalExercises={totalExercises}
      correctExercises={correctExercises}
      accuracyRate={accuracyRate}
      totalMinutes={totalMinutes}
      totalHours={totalHours}
      currentStreak={currentStreak}
      recentActivity={recentActivity}
    />
  )
}
