import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeRow, localizeRows, COURSE_FIELDS } from '@/lib/i18n/localize'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { computeStreaks } from '@/lib/dashboard/streak'
import { buildPracticeCalendar } from '@/lib/dashboard/practice-calendar'
import { dateKeyFor, todayKey } from '@/lib/dashboard/time-zone'
import { isNew, reasonFor, type RecContext } from '@/lib/dashboard/recommendations'
import { GreetingRow } from '@/components/dashboard/home/greeting-row'
import { ContinueCard } from '@/components/dashboard/home/continue-card'
import { CourseList } from '@/components/dashboard/home/course-list'
import { RecommendedSection } from '@/components/dashboard/home/recommended-section'
import { FeedbackCard } from '@/components/dashboard/home/feedback-card'
import { PracticeCalendar } from '@/components/dashboard/home/practice-calendar'
import { MasterClassCard } from '@/components/dashboard/home/master-class-card'
import { ToolTiles } from '@/components/dashboard/home/tool-tiles'
import { MilestonesCard } from '@/components/dashboard/home/milestones-card'
import { UpgradeCard } from '@/components/dashboard/home/upgrade-card'
import type {
  ContinueCard as ContinueCardData,
  FeedbackSummary,
  HomeCourseSummary,
  HomeData,
  MasterClassSummary,
  MilestoneItem,
  RecommendedCourse,
  SegmentState,
} from '@/types/dashboard'

/** Lessons per week the dashboard treats as the goal. */
const WEEK_GOAL = 6

/* ── Row shapes returned by the queries below ─────────────────────── */
interface ItemRow {
  id: string
  order_index: number | null
  video_duration_seconds: number | null
}
interface ClassRow {
  id: string
  title: string
  order_index: number | null
  items: ItemRow[] | null
}
interface SectionRow {
  id: string
  order_index: number | null
  classes: ClassRow[] | null
}
interface StyleRow {
  name: string
  name_es?: string | null
}
interface CourseRow {
  id: string
  title: string
  slug: string
  thumbnail_url: string | null
  instrument: string | null
  teacher_id: string | null
  teacher_name: string | null
  teacher_image_url: string | null
  difficulty?: string | null
  created_at?: string | null
  teacher: { id: string; name: string; image_url: string | null } | null
  musical_style: StyleRow | null
  course_sections: SectionRow[] | null
}
interface EnrollmentRow {
  last_accessed_at: string | null
  course: CourseRow | null
}
interface ProgressRow {
  class_item_id: string
  completed: boolean | null
  completed_at: string | null
  updated_at: string | null
  created_at: string | null
}

const byOrder = <T extends { order_index: number | null }>(a: T, b: T) => (a.order_index ?? 0) - (b.order_index ?? 0)

/** Classes of a course in section/class order, each with its items. */
function orderedClasses(course: CourseRow): ClassRow[] {
  const sections = [...(course.course_sections ?? [])].sort(byOrder)
  return sections.flatMap((s) => [...(s.classes ?? [])].sort(byOrder))
}

function classIsDone(cls: ClassRow, completed: Set<string>): boolean {
  const items = cls.items ?? []
  return items.length > 0 && items.every((it) => completed.has(it.id))
}

function courseHref(course: CourseRow) {
  return `/dashboard/course/${course.slug || course.id}`
}

const progressTime = (p: ProgressRow) => new Date(p.updated_at ?? p.created_at ?? 0).getTime()

/**
 * The class the learner is "on": the one holding their most recent progress row,
 * or the next unfinished class when that one is complete. `null` when the course
 * has no progress at all, or when every class is done.
 */
function currentClassIndexFor(classes: ClassRow[], progress: ProgressRow[], completed: Set<string>): number | null {
  const itemToIndex = new Map<string, number>()
  classes.forEach((c, i) => (c.items ?? []).forEach((it) => itemToIndex.set(it.id, i)))
  const latest = progress
    .filter((p) => itemToIndex.has(p.class_item_id))
    .sort((a, b) => progressTime(b) - progressTime(a))[0]
  if (!latest) return null
  const idx = itemToIndex.get(latest.class_item_id) ?? 0
  if (!classIsDone(classes[idx], completed)) return idx
  const next = classes.findIndex((c, i) => i > idx && !classIsDone(c, completed))
  if (next !== -1) return next
  const anyOpen = classes.findIndex((c) => !classIsDone(c, completed))
  return anyOpen === -1 ? null : anyOpen
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const locale = await getServerLocale()
  const now = new Date()
  const today = todayKey(now)
  const nowIso = now.toISOString()

  // ── Batch 1: independent queries ─────────────────────────────────
  const [
    { data: profile },
    { data: subscription },
    { data: enrollmentsRaw },
    { data: recentAchievements },
    { data: completionRows },
    { data: feedbackRows },
    { data: masterClassRows },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase
      .from('instrument_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('course_enrollments')
      .select(
        `
        last_accessed_at,
        course:courses(
          id, title, title_es, slug, thumbnail_url, instrument, teacher_id, teacher_name, teacher_image_url,
          teacher:teachers(id, name, image_url),
          musical_style:musical_styles(name, name_es),
          course_sections(
            id, order_index,
            classes(id, title, title_es, order_index, items:class_items(id, order_index, video_duration_seconds))
          )
        )
      `
      )
      .eq('user_id', user.id)
      .order('last_accessed_at', { ascending: false }),
    supabase
      .from('user_achievements')
      .select('achievement_key, unlocked_at')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })
      .limit(20),
    supabase
      .from('class_item_progress')
      .select('completed_at')
      .eq('user_id', user.id)
      .eq('completed', true)
      .not('completed_at', 'is', null),
    supabase
      .from('feedback_requests')
      .select('status, message, response_message, response_video_url, created_at, teachers(name, image_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('courses')
      .select('id, title, title_es, slug, thumbnail_url, teacher_name, teacher:teachers(name), musical_style:musical_styles(name, name_es)')
      .eq('is_master_class', true)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const enrollments = (enrollmentsRaw ?? []) as unknown as EnrollmentRow[]
  const courses: CourseRow[] = []
  for (const e of enrollments) {
    if (!e.course) continue
    localizeRow(e.course as unknown as Record<string, unknown>, locale, COURSE_FIELDS)
    if (e.course.musical_style) localizeRow(e.course.musical_style as unknown as Record<string, unknown>, locale, ['name'])
    for (const s of e.course.course_sections ?? []) {
      if (s.classes) localizeRows(s.classes as unknown as Record<string, unknown>[], locale, ['title'])
    }
    courses.push(e.course)
  }

  // ── Batch 2: progress for the enrolled items ─────────────────────
  const itemToClass = new Map<string, { course: CourseRow; cls: ClassRow }>()
  for (const course of courses) {
    for (const cls of orderedClasses(course)) {
      for (const it of cls.items ?? []) itemToClass.set(it.id, { course, cls })
    }
  }
  let progress: ProgressRow[] = []
  if (itemToClass.size > 0) {
    const { data } = await supabase
      .from('class_item_progress')
      .select('class_item_id, completed, completed_at, updated_at, created_at')
      .eq('user_id', user.id)
      .in('class_item_id', [...itemToClass.keys()])
    progress = (data ?? []) as ProgressRow[]
  }
  const completed = new Set(progress.filter((p) => p.completed).map((p) => p.class_item_id))

  // ── Streak and practice calendar (all completions, local day keys) ─
  const dateKeys = (completionRows ?? []).map((r) => dateKeyFor(r.completed_at as string))
  const { current: streak, best: bestStreak } = computeStreaks(dateKeys, today)
  const { cells: calendar, weekDoneCount: weekDone } = buildPracticeCalendar(dateKeys, today, 5)

  // ── Course summaries ─────────────────────────────────────────────
  const courseSummaries: HomeCourseSummary[] = courses.map((course) => {
    const classes = orderedClasses(course)
    const items = classes.flatMap((c) => c.items ?? [])
    const doneItems = items.filter((it) => completed.has(it.id)).length
    const doneClasses = classes.filter((c) => classIsDone(c, completed)).length
    const currentClassIndex = currentClassIndexFor(classes, progress, completed)
    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      thumbnailUrl: course.thumbnail_url,
      styleName: course.musical_style?.name ?? null,
      teacherName: course.teacher?.name ?? course.teacher_name ?? null,
      totalClasses: classes.length,
      doneClasses,
      currentClassIndex,
      currentClassTitle: currentClassIndex === null ? null : classes[currentClassIndex].title,
      pct: items.length > 0 ? Math.round((doneItems / items.length) * 100) : 0,
      href: courseHref(course),
    }
  })

  // ── Continue card ────────────────────────────────────────────────
  let continueCard: ContinueCardData | null = null
  {
    const latest = [...progress].sort((a, b) => progressTime(b) - progressTime(a))[0]
    const hit = latest ? itemToClass.get(latest.class_item_id) : undefined
    const course = hit?.course ?? courses[0] ?? null
    if (course) {
      const classes = orderedClasses(course)
      // A fresh enrollment (no progress) starts at the first class.
      const index = currentClassIndexFor(classes, progress, completed) ?? (hit ? -1 : 0)
      if (index >= 0 && classes.length > 0) {
        const cls = classes[index]
        const items = cls.items ?? []
        const doneInClass = items.filter((it) => completed.has(it.id)).length
        const seconds = items.reduce((sum, it) => sum + (it.video_duration_seconds ?? 0), 0)
        const segments: SegmentState[] = classes.map((c, i) => (i === index ? 'current' : classIsDone(c, completed) ? 'done' : 'todo'))
        continueCard = {
          courseTitle: course.title,
          courseHref: courseHref(course),
          resumeHref: `${courseHref(course)}/class/${cls.id}`,
          thumbnailUrl: course.thumbnail_url,
          styleName: course.musical_style?.name ?? null,
          classTitle: cls.title,
          classIndex: index,
          totalClasses: classes.length,
          classMinutes: seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : null,
          classPct: items.length > 0 ? Math.round((doneInClass / items.length) * 100) : 0,
          teacherName: course.teacher?.name ?? course.teacher_name ?? null,
          teacherImage: course.teacher?.image_url ?? course.teacher_image_url ?? null,
          nextClassTitle: classes[index + 1]?.title ?? null,
          segments,
        }
      }
    }
  }

  // ── Batch 3: recommendations ─────────────────────────────────────
  const enrolledIds = courses.map((c) => c.id)
  const { data: recommendedRaw } = await supabase
    .from('courses')
    .select(
      `
      id, title, title_es, slug, thumbnail_url, difficulty, instrument, created_at, teacher_id, teacher_name,
      teacher:teachers(id, name, image_url),
      musical_style:musical_styles(name, name_es),
      course_sections(id, order_index, classes(id, title, order_index))
    `
    )
    .eq('is_published', true)
    .eq('is_master_class', false)
    .not('id', 'in', `(${enrolledIds.length ? enrolledIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
    .order('created_at', { ascending: false })
    .limit(8)

  const recContext: RecContext = {
    instruments: [...new Set(courses.map((c) => c.instrument).filter((x): x is string => !!x))],
    teacherIds: [...new Set(courses.map((c) => c.teacher_id ?? c.teacher?.id).filter((x): x is string => !!x))],
    enrolledTitlesByTeacherId: Object.fromEntries(
      courses.flatMap((c) => {
        const id = c.teacher_id ?? c.teacher?.id
        return id ? [[id, c.title]] : []
      })
    ),
    now: nowIso,
  }

  const recommended: RecommendedCourse[] = ((recommendedRaw ?? []) as unknown as CourseRow[]).map((row) => {
    localizeRow(row as unknown as Record<string, unknown>, locale, COURSE_FIELDS)
    if (row.musical_style) localizeRow(row.musical_style as unknown as Record<string, unknown>, locale, ['name'])
    const base = {
      id: row.id,
      instrument: row.instrument,
      teacherId: row.teacher_id ?? row.teacher?.id ?? null,
      teacherName: row.teacher?.name ?? row.teacher_name ?? null,
      createdAt: row.created_at ?? null,
      difficulty: row.difficulty ?? null,
    }
    const lessonCount = (row.course_sections ?? []).reduce((n, s) => n + (s.classes?.length ?? 0), 0)
    return {
      ...base,
      slug: row.slug,
      title: row.title,
      thumbnailUrl: row.thumbnail_url,
      styleName: row.musical_style?.name ?? null,
      lessonCount: lessonCount || null,
      reason: reasonFor(base, recContext),
      isNew: isNew(base.createdAt, nowIso),
      href: courseHref(row),
    }
  })

  // ── Teacher feedback ─────────────────────────────────────────────
  type FeedbackRow = {
    status: string | null
    message: string | null
    response_message: string | null
    response_video_url: string | null
    created_at: string | null
    teachers: { name: string; image_url: string | null } | null
  }
  const fb = (feedbackRows?.[0] ?? null) as unknown as FeedbackRow | null
  const feedback: FeedbackSummary = !fb
    ? { kind: 'none' }
    : fb.status === 'completed' && fb.response_message
      ? {
          kind: 'completed',
          teacherName: fb.teachers?.name ?? null,
          teacherImage: fb.teachers?.image_url ?? null,
          message: fb.response_message,
          hasVideo: !!fb.response_video_url,
          createdAt: fb.created_at,
          status: fb.status,
        }
      : { kind: 'pending', teacherName: fb.teachers?.name ?? null, teacherImage: fb.teachers?.image_url ?? null, createdAt: fb.created_at, status: fb.status }

  // ── Master class ─────────────────────────────────────────────────
  type MasterRow = {
    id: string
    title: string
    slug: string
    thumbnail_url: string | null
    teacher_name: string | null
    teacher: { name: string } | null
    musical_style: StyleRow | null
  }
  const mc = (masterClassRows?.[0] ?? null) as unknown as MasterRow | null
  let masterClass: MasterClassSummary | null = null
  if (mc) {
    localizeRow(mc as unknown as Record<string, unknown>, locale, COURSE_FIELDS)
    if (mc.musical_style) localizeRow(mc.musical_style as unknown as Record<string, unknown>, locale, ['name'])
    masterClass = {
      id: mc.id,
      slug: mc.slug,
      title: mc.title,
      teacherName: mc.teacher?.name ?? mc.teacher_name ?? null,
      thumbnailUrl: mc.thumbnail_url,
      styleName: mc.musical_style?.name ?? null,
      href: `/dashboard/course/${mc.slug || mc.id}`,
    }
  }

  // ── Milestones: next uncompleted achievements ────────────────────
  const totalLessonsCompleted = completed.size
  const completedCourses = courseSummaries.filter((c) => c.totalClasses > 0 && c.doneClasses === c.totalClasses).length
  const unlockedKeys = new Set((recentAchievements ?? []).map((a) => a.achievement_key))
  const currentFor = (key: string) =>
    key.startsWith('lessons_') || key === 'first_lesson' ? totalLessonsCompleted : key.startsWith('streak_') ? streak : key.startsWith('course_') ? completedCourses : 0
  const milestones: MilestoneItem[] = Object.values(ACHIEVEMENTS)
    .filter((a) => ['learning', 'consistency', 'completion'].includes(a.category))
    .filter((a) => currentFor(a.key) < a.requirement && !unlockedKeys.has(a.key))
    .map((a) => {
      const current = currentFor(a.key)
      return {
        key: a.key,
        title: a.title,
        description: a.description,
        iconName: a.iconName,
        category: a.category,
        requirement: a.requirement,
        current,
        progress: Math.min((current / a.requirement) * 100, 100),
      }
    })
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3)

  const data: HomeData = {
    firstName: profile?.full_name?.split(' ')[0] ?? null,
    streak,
    bestStreak,
    weekDone,
    weekGoal: WEEK_GOAL,
    continueCard,
    courses: courseSummaries,
    recommended,
    recContext,
    feedback,
    calendar,
    masterClass,
    milestones,
    hasSubscription: !!subscription,
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-6 lg:space-y-8">
      <GreetingRow firstName={data.firstName} streak={data.streak} weekDone={data.weekDone} weekGoal={data.weekGoal} />
      <ContinueCard card={data.continueCard} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="min-w-0 space-y-8">
          <CourseList courses={data.courses} />
          <RecommendedSection courses={data.recommended} ctx={data.recContext} />
          <FeedbackCard feedback={data.feedback} />
        </div>
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <PracticeCalendar
            cells={data.calendar}
            weekDone={data.weekDone}
            weekGoal={data.weekGoal}
            streak={data.streak}
            bestStreak={data.bestStreak}
          />
          <MasterClassCard masterClass={data.masterClass} />
          <ToolTiles />
          <MilestonesCard milestones={data.milestones} />
          <UpgradeCard hasSubscription={data.hasSubscription} />
        </aside>
      </div>
    </div>
  )
}
