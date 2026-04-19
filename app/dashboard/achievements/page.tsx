import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { AchievementsView } from './achievements-view'

export default async function AchievementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's unlocked achievements from DB
  const { data: unlockedAchievements } = await supabase
    .from('user_achievements')
    .select('achievement_key, unlocked_at')
    .eq('user_id', user.id)

  const unlockedKeys = new Set(unlockedAchievements?.map(a => a.achievement_key) || [])

  // Get user progress for calculating achievement progress
  const { data: userProgress } = await supabase
    .from('user_progress_legacy')
    .select(`
      *,
      lesson:lessons(
        course:courses(
          id,
          teacher_id,
          musical_style:musical_styles(name)
        )
      )
    `)
    .eq('user_id', user.id)

  const { data: feedbackRequests } = await supabase
    .from('feedback_requests')
    .select('id')
    .eq('user_id', user.id)

  // Calculate metrics
  const completedLessons = userProgress?.filter(p => p.completed).length || 0

  // Calculate streak
  let streak = 0
  if (userProgress && userProgress.length > 0) {
    const uniqueDates = new Set<string>()
    userProgress.forEach((activity) => {
      if (activity.updated_at) {
        const date = new Date(activity.updated_at).toISOString().split('T')[0]
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
        expectedDate.setDate(expectedDate.getDate() - streak)
        if (date.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
          streak++
        } else {
          break
        }
      }
    }
  }

  // Calculate completed courses
  const courseLessonCounts = new Map<string, { total: number; completed: number }>()
  userProgress?.forEach((p: any) => {
    if (p.lesson?.course?.id) {
      const courseId = p.lesson.course.id
      if (!courseLessonCounts.has(courseId)) {
        courseLessonCounts.set(courseId, { total: 0, completed: 0 })
      }
      const course = courseLessonCounts.get(courseId)!
      course.total++
      if (p.completed) {
        course.completed++
      }
    }
  })
  const completedCourses = Array.from(courseLessonCounts.values()).filter(c => c.completed === c.total && c.total > 0).length

  // Calculate unique styles and teachers
  const uniqueStyles = new Set<string>()
  const uniqueTeachers = new Set<string>()
  userProgress?.forEach((p: any) => {
    if (p.lesson?.course?.musical_style?.name) {
      uniqueStyles.add(p.lesson.course.musical_style.name)
    }
    if (p.lesson?.course?.teacher_id) {
      uniqueTeachers.add(p.lesson.course.teacher_id)
    }
  })

  const feedbackCount = feedbackRequests?.length || 0

  // Calculate progress for each achievement
  const getProgress = (key: string): { current: number; requirement: number } => {
    const achievement = ACHIEVEMENTS[key as keyof typeof ACHIEVEMENTS]
    if (!achievement) return { current: 0, requirement: 1 }

    let current = 0
    switch (key) {
      case 'first_lesson':
      case 'lessons_10':
      case 'lessons_25':
      case 'lessons_50':
      case 'lessons_100':
        current = completedLessons
        break
      case 'streak_3':
      case 'streak_7':
      case 'streak_30':
        current = streak
        break
      case 'course_first':
      case 'course_3':
      case 'course_5':
        current = completedCourses
        break
      case 'styles_3':
      case 'styles_5':
        current = uniqueStyles.size
        break
      case 'teachers_3':
        current = uniqueTeachers.size
        break
      case 'feedback_first':
        current = feedbackCount
        break
      case 'community_joined':
        current = unlockedKeys.has('community_joined') ? 1 : 0
        break
    }

    return { current, requirement: achievement.requirement }
  }

  const achievementsWithProgress = Object.values(ACHIEVEMENTS).map(achievement => {
    const { current, requirement } = getProgress(achievement.key)
    const isUnlocked = unlockedKeys.has(achievement.key) || current >= requirement

    return {
      ...achievement,
      current,
      isUnlocked,
      progress: Math.min((current / requirement) * 100, 100),
    }
  })

  const totalUnlocked = achievementsWithProgress.filter(a => a.isUnlocked).length
  const totalAchievements = achievementsWithProgress.length

  return (
    <AchievementsView
      achievementsWithProgress={achievementsWithProgress}
      totalUnlocked={totalUnlocked}
      totalAchievements={totalAchievements}
      completedLessons={completedLessons}
      streak={streak}
      completedCourses={completedCourses}
    />
  )
}
