import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('course_enrollments')
      .select(
        `
        *,
        course:courses(
          id,
          title,
          slug,
          thumbnail_url,
          course_sections(
            id,
            classes(
              id,
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
      .select('id, name, bio, image_url, instrument')
      .limit(1)
      .single(),
  ])

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

  // ── My Courses progress ─────────────────────────────────────────
  const myCoursesArray: CourseProgress[] = []
  for (const enrollment of enrollments || []) {
    const course = enrollment.course as any
    if (!course) continue
    const itemIds = courseItemMap.get(course.id) || []
    const completedCount = itemIds.filter((id) =>
      completedItemIds.has(id)
    ).length
    myCoursesArray.push({
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        thumbnail_url: course.thumbnail_url,
      },
      total: itemIds.length,
      completed: completedCount,
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
                continueData = {
                  courseId: course.id,
                  courseSlug: course.slug,
                  courseTitle: course.title,
                  courseThumbnail: course.thumbnail_url,
                  classId: cls.id,
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
        musical_style:musical_styles(name),
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
        slug,
        description,
        thumbnail_url,
        difficulty,
        musical_style:musical_styles(name),
        teacher:teachers(name)
      `
      )
      .eq('is_published', true)
      .limit(12),
  ])

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
        title: 'Completed a lesson',
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
      subtitle: def?.description || 'Achievement unlocked',
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

        {/* 2. Continue Learning Hero */}
        <ContinueLearningHero continueData={continueData} />

        {/* 3. Quick Actions — mobile only (grid variant) */}
        <div className="lg:hidden">
          <QuickActions variant="grid" />
        </div>

        {/* 4. My Courses */}
        <MyCoursesSection courses={myCoursesArray} />

        {/* 5. Learning Milestones — mobile only (cards variant) */}
        <div className="lg:hidden">
          <LearningMilestones milestones={milestones} variant="cards" />
        </div>

        {/* 6. Recommended + Featured */}
        <RecommendedFeatured
          recommendedCourses={(recommendedCourses || []) as any}
          newCourseIds={newCourseIds}
          featuredTeacher={featuredTeacher || null}
          allCourses={(allCourses || []) as any}
        />

        {/* 7. Recent Activity — mobile only */}
        <div className="lg:hidden">
          <RecentActivity activities={activities} />
        </div>

        {/* 8. Subscription CTA — mobile only */}
        <div className="lg:hidden">
          <SubscriptionCta hasSubscription={!!subscription?.status} />
        </div>
      </div>

      {/* ── Sidebar (desktop only) ─────────────────────────────── */}
      <aside className="hidden lg:block">
        <div className="space-y-6">
          {/* Quick Actions — list variant */}
          <QuickActions variant="list" />

          {/* Daily Practice Tip */}
          <DailyPracticeTip />

          {/* Learning Milestones — compact variant */}
          <LearningMilestones milestones={milestones} variant="compact" />

          {/* Featured Teacher Spotlight */}
          {featuredTeacher && (
            <FeaturedTeacherSpotlight teacher={featuredTeacher} />
          )}

          {/* Recent Activity — 5 items */}
          <RecentActivity activities={activities} maxItems={5} />

          {/* Subscription CTA — sidebar variant */}
          <SubscriptionCta
            hasSubscription={!!subscription?.status}
            variant="sidebar"
          />
        </div>
      </aside>
    </div>
  )
}
