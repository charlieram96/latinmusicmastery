import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerTranslator } from '@/lib/i18n/server'
import { localizeRow, localizeRows, localizeCourse, localizeTeacher, COURSE_FIELDS } from '@/lib/i18n/localize'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { WelcomeSummary } from '@/components/dashboard/welcome-summary'
import { ContinueLearningHero } from '@/components/dashboard/continue-learning-hero'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { MyCoursesSection } from '@/components/dashboard/my-courses-section'
import { LearningMilestones } from '@/components/dashboard/learning-milestones'
import { RecommendedFeatured } from '@/components/dashboard/recommended-featured'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { SubscriptionCta } from '@/components/dashboard/subscription-cta'
import { DailyPracticeTip } from '@/components/dashboard/daily-practice-tip'
import { FeaturedTeacherSpotlight } from '@/components/dashboard/featured-teacher-spotlight'
import { WeekStrip } from '@/components/dashboard/week-strip'
import type {
  ContinueLearningData,
  CourseProgress,
  MilestoneItem,
  RecentActivityItem,
} from '@/types/dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // ── Batch 1: independent queries ─────────────────────────────────
  const [
    { data: profile },
    { data: subscription },
    { data: enrollments },
    { count: achievementsCount },
    { data: recentAchievements },
    { data: featuredTeacher },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single(),
    supabase
      .from('instrument_subscriptions')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('course_enrollments')
      .select(
        `
        *,
        course:courses(
          id,
          title,
          title_es,
          slug,
          thumbnail_url,
          teacher:teachers(name),
          course_sections(
            id,
            order_index,
            classes(
              id,
              title,
              title_es,
              order_index,
              items:class_items(id)
            )
          )
        )
      `
      )
      .eq('user_id', user.id)
      .order('last_accessed_at', { ascending: false }),
    supabase
      .from('user_achievements')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('user_achievements')
      .select('achievement_key, unlocked_at')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })
      .limit(5),
    supabase
      .from('teachers')
      .select('id, name, bio, bio_es, image_url, instrument, instrument_es')
      .limit(1)
      .single(),
  ])

  // Localize enrolled-course titles (+ nested class titles) to the viewer's language.
  const { t, locale } = await getServerTranslator()
  localizeTeacher(featuredTeacher as Record<string, unknown> | null, locale)
  for (const enrollment of enrollments ?? []) {
    const course = (enrollment as any).course as Record<string, unknown> | null
    if (!course) continue
    localizeRow(course, locale, COURSE_FIELDS)
    const sections = course['course_sections'] as Record<string, unknown>[] | undefined
    if (Array.isArray(sections)) {
      for (const s of sections) {
        const classes = s['classes'] as Record<string, unknown>[] | undefined
        if (Array.isArray(classes)) localizeRows(classes, locale, ['title'])
      }
    }
  }

  // ── Build course → item ID map ──────────────────────────────────
  const allItemIds: string[] = []
  const courseItemMap = new Map<string, string[]>()

  for (const enrollment of enrollments || []) {
    const course = enrollment.course as any
    if (!course) continue
    const itemIds: string[] = []
    for (const section of course.course_sections || []) {
      for (const cls of section.classes || []) {
        for (const item of cls.items || []) {
          itemIds.push(item.id)
          allItemIds.push(item.id)
        }
      }
    }
    courseItemMap.set(course.id, itemIds)
  }

  // ── Batch 2: progress data (depends on allItemIds) ──────────────
  let progressData: any[] = []
  if (allItemIds.length > 0) {
    const { data } = await supabase
      .from('class_item_progress')
      .select('*')
      .eq('user_id', user.id)
      .in('class_item_id', allItemIds)
    progressData = data || []
  }

  const completedItemIds = new Set(
    progressData.filter((p) => p.completed).map((p) => p.class_item_id)
  )

  const totalLessonsCompleted = completedItemIds.size

  // ── Streak calculation ──────────────────────────────────────────
  let streak = 0
  if (progressData.length > 0) {
    const uniqueDates = new Set<string>()
    progressData.forEach((p) => {
      if (p.completed_at) {
        const date = new Date(p.completed_at).toISOString().split('T')[0]
        uniqueDates.add(date)
      }
    })
    const sortedDates = Array.from(uniqueDates).sort().reverse()
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split('T')[0]

    if (sortedDates[0] === today || sortedDates[0] === yesterday) {
      const currentDate = new Date(sortedDates[0])
      for (const dateStr of sortedDates) {
        const date = new Date(dateStr)
        const expectedDate = new Date(currentDate)
        expectedDate.setDate(expectedDate.getDate() - streak)
        if (
          date.toISOString().split('T')[0] ===
          expectedDate.toISOString().split('T')[0]
        ) {
          streak++
        } else {
          break
        }
      }
    }
  }

  // ── Items completed this week ───────────────────────────────────
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const startOfWeekISO = startOfWeek.toISOString()

  const itemsCompletedThisWeek = progressData.filter(
    (p) => p.completed && p.completed_at && p.completed_at >= startOfWeekISO
  ).length

  // ── This-week practice strip (Sun→Sat of the current week) ──────
  const practicedDates = new Set<string>()
  progressData.forEach((p) => {
    if (p.completed && p.completed_at) {
      practicedDates.add(new Date(p.completed_at).toISOString().split('T')[0])
    }
  })
  const todayISO = now.toISOString().split('T')[0]
  const dayLetters = t('dashboard.pages.home.dayLetters').split(',')
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    const iso = d.toISOString().split('T')[0]
    return {
      label: dayLetters[i],
      practiced: practicedDates.has(iso),
      today: iso === todayISO,
    }
  })

  // ── My Courses progress ─────────────────────────────────────────
  // Finds the title of the first class with an incomplete item (ordered by
  // section then class), or a "done"/"not started" label.
  function nextClassLabel(course: any, completedCount: number): string {
    if (completedCount === 0) return t('dashboard.pages.home.notStarted')
    const sections = [...(course.course_sections || [])].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    )
    for (const section of sections) {
      const classes = [...(section.classes || [])].sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
      )
      for (const cls of classes) {
        const hasIncomplete = (cls.items || []).some(
          (it: any) => !completedItemIds.has(it.id)
        )
        if (hasIncomplete) return cls.title || t('common.continue')
      }
    }
    return t('dashboard.pages.home.courseCompleted')
  }

  const myCoursesArray: CourseProgress[] = []
  for (const enrollment of enrollments || []) {
    const course = enrollment.course as any
    if (!course) continue
    const itemIds = courseItemMap.get(course.id) || []
    const completedCount = itemIds.filter((id) =>
      completedItemIds.has(id)
    ).length
    const total = itemIds.length
    myCoursesArray.push({
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        thumbnail_url: course.thumbnail_url,
      },
      total,
      completed: completedCount,
      teacherName: course.teacher?.name || null,
      pct: total > 0 ? Math.round((completedCount / total) * 100) : 0,
      nextLabel: nextClassLabel(course, completedCount),
    })
  }

  // ── Continue learning data ──────────────────────────────────────
  let continueData: ContinueLearningData | null = null
  if (progressData.length > 0) {
    const sortedProgress = [...progressData]
      .filter((p) => !p.completed)
      .sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime()
      )

    if (sortedProgress.length > 0) {
      const recentItemId = sortedProgress[0].class_item_id
      for (const enrollment of enrollments || []) {
        const course = enrollment.course as any
        if (!course) continue
        for (const section of course.course_sections || []) {
          for (const cls of section.classes || []) {
            for (const item of cls.items || []) {
              if (item.id === recentItemId) {
                const itemIds = courseItemMap.get(course.id) || []
                const completedCount = itemIds.filter((id) =>
                  completedItemIds.has(id)
                ).length
                continueData = {
                  courseId: course.id,
                  courseSlug: course.slug,
                  courseTitle: course.title,
                  courseThumbnail: course.thumbnail_url,
                  classId: cls.id,
                  teacherName: course.teacher?.name || null,
                  nextLessonTitle: cls.title || null,
                  pct:
                    itemIds.length > 0
                      ? Math.round((completedCount / itemIds.length) * 100)
                      : 0,
                }
              }
            }
          }
        }
      }
    }
  }

  // ── Batch 3: recommended, new courses, all courses ──────────────
  const startedCourseIds = myCoursesArray.map((c) => c.course.id)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const [
    { data: recommendedCourses },
    { data: newCoursesRaw },
    { data: allCourses },
  ] = await Promise.all([
    supabase
      .from('courses')
      .select(
        `
        *,
        musical_style:musical_styles(name, name_es),
        teacher:teachers(name)
      `
      )
      .eq('is_published', true)
      .not(
        'id',
        'in',
        `(${
          startedCourseIds.length > 0
            ? startedCourseIds.join(',')
            : '00000000-0000-0000-0000-000000000000'
        })`
      )
      .limit(4),
    supabase
      .from('courses')
      .select('id')
      .eq('is_published', true)
      .gte('created_at', sevenDaysAgo),
    supabase
      .from('courses')
      .select(
        `
        id,
        title,
        title_es,
        slug,
        description,
        description_es,
        thumbnail_url,
        difficulty,
        musical_style:musical_styles(name, name_es),
        teacher:teachers(name)
      `
      )
      .eq('is_published', true)
      .limit(12),
  ])

  for (const c of recommendedCourses ?? []) localizeCourse(c as Record<string, unknown>, locale)
  for (const c of allCourses ?? []) localizeCourse(c as Record<string, unknown>, locale)

  const newCourseIds = (newCoursesRaw || []).map((c: any) => c.id)

  // ── Milestones: next uncompleted achievements ───────────────────
  const completedCourses = myCoursesArray.filter(
    (c) => c.total > 0 && c.completed === c.total
  ).length

  function getAchievementCurrent(key: string): number {
    if (key.startsWith('lessons_') || key === 'first_lesson')
      return totalLessonsCompleted
    if (key.startsWith('streak_')) return streak
    if (key.startsWith('course_')) return completedCourses
    return 0
  }

  const unlockedKeys = new Set(
    (recentAchievements || []).map((a: any) => a.achievement_key)
  )

  const milestones: MilestoneItem[] = Object.values(ACHIEVEMENTS)
    .filter((a) => {
      // Only show learning, consistency, completion categories (quantifiable)
      if (!['learning', 'consistency', 'completion'].includes(a.category))
        return false
      const current = getAchievementCurrent(a.key)
      return current < a.requirement && !unlockedKeys.has(a.key)
    })
    .map((a) => {
      const current = getAchievementCurrent(a.key)
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
    .slice(0, 4)

  // ── Recent activity feed ────────────────────────────────────────
  // Build item → course name lookup
  const itemToCourse = new Map<string, { title: string; slug: string }>()
  for (const enrollment of enrollments || []) {
    const course = enrollment.course as any
    if (!course) continue
    for (const section of course.course_sections || []) {
      for (const cls of section.classes || []) {
        for (const item of cls.items || []) {
          itemToCourse.set(item.id, {
            title: course.title,
            slug: course.slug,
          })
        }
      }
    }
  }

  const recentCompletions: RecentActivityItem[] = progressData
    .filter((p) => p.completed && p.completed_at)
    .sort(
      (a, b) =>
        new Date(b.completed_at).getTime() -
        new Date(a.completed_at).getTime()
    )
    .slice(0, 6)
    .map((p, i) => {
      const courseInfo = itemToCourse.get(p.class_item_id)
      return {
        id: `completion-${i}`,
        type: 'lesson_completed' as const,
        title: t('dashboard.pages.home.activity.completedLesson'),
        subtitle: courseInfo?.title || null,
        timestamp: p.completed_at,
        iconName: 'CheckCircle',
      }
    })

  const recentAchievementActivities: RecentActivityItem[] = (
    recentAchievements || []
  ).map((a: any, i: number) => {
    const def = ACHIEVEMENTS[a.achievement_key]
    return {
      id: `achievement-${i}`,
      type: 'achievement_earned' as const,
      title: def?.title || a.achievement_key,
      subtitle: def?.description || t('dashboard.pages.home.activity.achievementUnlocked'),
      timestamp: a.unlocked_at,
      iconName: 'Trophy',
    }
  })

  // Merge and sort by timestamp, take 8
  const activities: RecentActivityItem[] = [
    ...recentCompletions,
    ...recentAchievementActivities,
  ]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 8)

  // New user with nothing in progress → empty-state layout.
  const isEmpty = myCoursesArray.length === 0

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6">
      {/* ── Main column ────────────────────────────────────────── */}
      <div className="space-y-6">
        {/* 1. Welcome + Weekly Summary */}
        <WelcomeSummary
          name={profile?.full_name || null}
          streak={streak}
          itemsCompletedThisWeek={itemsCompletedThisWeek}
        />

        {/* 2. Continue Learning — resume bar / empty bar */}
        <ContinueLearningHero continueData={continueData} />

        {/* 3. Quick Actions — mobile only (grid variant) */}
        <div className="lg:hidden">
          <QuickActions variant="grid" />
        </div>

        {/* 4. My Courses (hidden when empty) */}
        <MyCoursesSection courses={myCoursesArray} />

        {/* 5. Learning Milestones — mobile only (cards variant) */}
        {!isEmpty && (
          <div className="lg:hidden">
            <LearningMilestones milestones={milestones} variant="cards" />
          </div>
        )}

        {/* 6. Recommended + Featured */}
        <RecommendedFeatured
          recommendedCourses={(recommendedCourses || []) as any}
          newCourseIds={newCourseIds}
          featuredTeacher={featuredTeacher || null}
          allCourses={(allCourses || []) as any}
        />

        {/* 7. Recent Activity — mobile only */}
        {!isEmpty && (
          <div className="lg:hidden">
            <RecentActivity activities={activities} />
          </div>
        )}

        {/* 8. Subscription CTA — mobile only */}
        <div className="lg:hidden">
          <SubscriptionCta hasSubscription={!!subscription?.status} />
        </div>
      </div>

      {/* ── Sidebar (desktop only) ─────────────────────────────── */}
      <aside className="hidden lg:block">
        <div className="space-y-6">
          {isEmpty ? (
            <>
              {/* New-user rail: orientation over stats */}
              <QuickActions variant="list" />
              <DailyPracticeTip />
              {featuredTeacher && (
                <FeaturedTeacherSpotlight teacher={featuredTeacher} />
              )}
              <SubscriptionCta
                hasSubscription={!!subscription?.status}
                variant="sidebar"
              />
            </>
          ) : (
            <>
              {/* Returning-learner rail: momentum first */}
              <WeekStrip days={weekDays} streak={streak} />
              <QuickActions variant="list" />
              <LearningMilestones milestones={milestones} variant="compact" />
              <RecentActivity activities={activities} maxItems={5} />
              <SubscriptionCta
                hasSubscription={!!subscription?.status}
                variant="sidebar"
              />
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
