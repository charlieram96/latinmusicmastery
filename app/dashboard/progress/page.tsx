import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeRow } from '@/lib/i18n/localize'
import { buildPracticeCalendar, WEEK_GOAL } from '@/lib/dashboard/practice-calendar'
import { byCourse, weeklyBuckets, type ProgressActivity, type ProgressData } from '@/lib/dashboard/progress'
import { computeStreaks } from '@/lib/dashboard/streak'
import { dateKeyFor, todayKey } from '@/lib/dashboard/time-zone'
import { ProgressView } from './progress-view'

const CHART_WEEKS = 12
const CALENDAR_WEEKS = 8

interface ProgressRow {
  id: string
  completed: boolean | null
  completed_at: string | null
  updated_at: string | null
  created_at: string | null
  class_item: {
    id: string
    title: string | null
    item_type: string | null
    video_duration_seconds: number | null
    class: {
      id: string
      title: string | null
      section: { course_id: string; courses: { id: string; title: string; slug: string | null } | null } | null
    } | null
  } | null
}

export default async function MyProgressPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: progressRaw }, { data: attempts }] = await Promise.all([
    supabase
      .from('class_item_progress')
      .select(
        `
        id, completed, completed_at, updated_at, created_at,
        class_item:class_items(
          id, title, title_es, item_type, video_duration_seconds,
          class:classes(
            id, title, title_es,
            section:course_sections(course_id, courses(id, title, title_es, slug))
          )
        )
      `
      )
      .eq('user_id', user.id),
    supabase.from('exercise_attempts').select('is_correct').eq('user_id', user.id),
  ])

  const locale = await getServerLocale()
  const rows = (progressRaw ?? []) as unknown as ProgressRow[]
  for (const p of rows) {
    const item = p.class_item as unknown as Record<string, unknown> | null
    if (!item) continue
    localizeRow(item, locale, ['title'])
    const cls = item['class'] as Record<string, unknown> | null
    if (!cls) continue
    localizeRow(cls, locale, ['title'])
    const section = cls['section'] as Record<string, unknown> | null
    const course = section?.['courses'] as Record<string, unknown> | null
    if (course) localizeRow(course, locale, ['title'])
  }

  const today = todayKey()
  const completedRows = rows.filter((p) => p.completed && p.completed_at)
  const minutesOf = (p: ProgressRow) => (p.class_item?.video_duration_seconds ?? 0) / 60

  const dateKeys = completedRows.map((p) => dateKeyFor(p.completed_at as string))
  const { current: streak, best: bestStreak } = computeStreaks(dateKeys, today)
  const { cells: calendar, weekDoneCount: weekDone } = buildPracticeCalendar(dateKeys, today, CALENDAR_WEEKS)

  const weeks = weeklyBuckets(
    completedRows.map((p) => ({ dateKey: dateKeyFor(p.completed_at as string), minutes: minutesOf(p) })),
    today,
    CHART_WEEKS
  )

  const courses = byCourse(
    rows.flatMap((p) => {
      const course = p.class_item?.class?.section?.courses
      if (!course) return []
      const touched = p.completed_at ?? p.updated_at ?? p.created_at
      return [
        {
          courseId: course.id,
          title: course.title,
          slug: course.slug,
          completed: !!p.completed,
          minutes: minutesOf(p),
          dateKey: touched ? dateKeyFor(touched) : null,
        },
      ]
    })
  )

  const recent: ProgressActivity[] = rows
    .filter((p) => p.updated_at)
    .sort((a, b) => new Date(b.updated_at as string).getTime() - new Date(a.updated_at as string).getTime())
    .slice(0, 8)
    .map((p) => {
      const cls = p.class_item?.class ?? null
      const course = cls?.section?.courses ?? null
      return {
        id: p.id,
        title: p.class_item?.title || cls?.title || '',
        lessonTitle: cls?.title ?? null,
        courseTitle: course?.title ?? null,
        href: course && cls ? `/dashboard/course/${course.slug || course.id}/class/${cls.id}` : null,
        completed: !!p.completed,
        at: p.updated_at as string,
      }
    })

  const attemptRows = attempts ?? []
  const correct = attemptRows.filter((a) => a.is_correct).length

  const data: ProgressData = {
    streak,
    bestStreak,
    completedItems: completedRows.length,
    startedItems: rows.length,
    totalMinutes: Math.round(completedRows.reduce((sum, p) => sum + minutesOf(p), 0)),
    weekMinutes: weeks[weeks.length - 1]?.minutes ?? 0,
    accuracy: attemptRows.length > 0 ? Math.round((correct / attemptRows.length) * 100) : null,
    correct,
    attempts: attemptRows.length,
    weeks,
    calendar,
    weekDone,
    weekGoal: WEEK_GOAL,
    courses,
    recent,
  }

  return <ProgressView data={data} />
}
