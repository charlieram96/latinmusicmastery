import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Award,
  Trophy,
  Star,
  Target,
  Flame,
  Music,
  BookOpen,
  Lock,
  Sparkles,
  Zap,
  Crown,
  Heart,
  Users,
  Video,
  GraduationCap,
  Compass,
  type LucideIcon,
} from 'lucide-react'
import {
  ACHIEVEMENTS as ACHIEVEMENTS_DATA,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
} from '@/lib/achievements'

// Map icon names from shared module to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen, Target, Star, Trophy, Crown, Flame, Zap,
  Award, Sparkles, GraduationCap, Compass, Music, Users, Video, Heart,
}

// Build local ACHIEVEMENTS with icon components for rendering
const ACHIEVEMENTS = Object.fromEntries(
  Object.entries(ACHIEVEMENTS_DATA).map(([key, a]) => [
    key,
    { ...a, icon: ICON_MAP[a.iconName] || Star },
  ])
)

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
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-heading mb-2">Achievements</h1>
        <p className="text-muted-foreground">
          Unlock badges and celebrate your learning milestones
        </p>
      </div>

      {/* Overall Progress Card */}
      <Card className="mb-8 overflow-hidden">
        <div className="bg-card p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="h-20 w-20 rounded-2xl bg-primary/20 flex items-center justify-center">
              <Trophy className="h-10 w-10 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">
                {totalUnlocked} of {totalAchievements} Achievements Unlocked
              </h2>
              <Progress value={(totalUnlocked / totalAchievements) * 100} className="h-3 mb-2" />
              <p className="text-sm text-muted-foreground">
                {Math.round((totalUnlocked / totalAchievements) * 100)}% complete - Keep going!
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-center">
              <div className="bg-secondary rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-primary">{completedLessons}</p>
                <p className="text-xs text-muted-foreground">Lessons</p>
              </div>
              <div className="bg-secondary rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-primary">{streak}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
              <div className="bg-secondary rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-primary">{completedCourses}</p>
                <p className="text-xs text-muted-foreground">Courses</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Achievements by Category */}
      {CATEGORY_ORDER.map(category => {
        const categoryAchievements = achievementsWithProgress.filter(a => a.category === category)
        if (categoryAchievements.length === 0) return null

        const categoryUnlocked = categoryAchievements.filter(a => a.isUnlocked).length

        return (
          <div key={category} className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{CATEGORY_LABELS[category]}</h2>
              <Badge variant="secondary">
                {categoryUnlocked}/{categoryAchievements.length}
              </Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categoryAchievements.map((achievement) => {
                const Icon = achievement.icon

                return (
                  <Card
                    key={achievement.key}
                    className={`relative overflow-hidden transition-all ${
                      achievement.isUnlocked
                        ? 'border-primary/30'
                        : 'opacity-75 grayscale'
                    }`}
                  >
                    {/* Gradient Background for Unlocked */}
                    {achievement.isUnlocked && (
                      <div className={`absolute inset-0 bg-gradient-to-br ${achievement.color} opacity-10`} />
                    )}

                    <CardContent className="relative p-5">
                      <div className="flex items-start gap-4">
                        {/* Badge Icon */}
                        <div
                          className={`relative flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center ${
                            achievement.isUnlocked
                              ? `bg-gradient-to-br ${achievement.color} text-white shadow-lg`
                              : 'bg-secondary text-muted-foreground'
                          }`}
                        >
                          {achievement.isUnlocked ? (
                            <Icon className="h-7 w-7" />
                          ) : (
                            <Lock className="h-6 w-6" />
                          )}
                          {achievement.isUnlocked && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm mb-0.5">{achievement.title}</h3>
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                            {achievement.description}
                          </p>

                          {/* Progress */}
                          {!achievement.isUnlocked && (
                            <div>
                              <Progress value={achievement.progress} className="h-1.5 mb-1" />
                              <p className="text-xs text-muted-foreground">
                                {achievement.current} / {achievement.requirement}
                              </p>
                            </div>
                          )}

                          {achievement.isUnlocked && (
                            <Badge className="bg-primary/20 text-primary border-0 text-xs">
                              Unlocked
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}
    </>
  )
}
