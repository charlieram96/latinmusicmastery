import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
} from 'lucide-react'

// Define achievement types
const achievements = [
  {
    id: 'first_lesson',
    title: 'First Steps',
    description: 'Complete your first lesson',
    icon: BookOpen,
    requirement: 1,
    category: 'learning',
  },
  {
    id: '10_lessons',
    title: 'Dedicated Learner',
    description: 'Complete 10 lessons',
    icon: Target,
    requirement: 10,
    category: 'learning',
  },
  {
    id: '50_lessons',
    title: 'Master Student',
    description: 'Complete 50 lessons',
    icon: Trophy,
    requirement: 50,
    category: 'learning',
  },
  {
    id: 'perfect_score',
    title: 'Perfect Score',
    description: 'Get 100% on 5 exercises',
    icon: Star,
    requirement: 5,
    category: 'performance',
  },
  {
    id: '7_day_streak',
    title: 'Week Warrior',
    description: 'Maintain a 7-day learning streak',
    icon: Flame,
    requirement: 7,
    category: 'consistency',
  },
  {
    id: 'first_course',
    title: 'Course Conqueror',
    description: 'Complete your first full course',
    icon: Award,
    requirement: 1,
    category: 'completion',
  },
  {
    id: 'all_styles',
    title: 'Style Explorer',
    description: 'Try lessons from all musical styles',
    icon: Music,
    requirement: 14,
    category: 'exploration',
  },
]

export default async function AchievementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user progress for calculating achievements
  const { data: userProgress } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', user.id)

  const { data: exerciseAttempts } = await supabase
    .from('exercise_attempts')
    .select('*')
    .eq('user_id', user.id)

  // Calculate progress for each achievement
  const completedLessons = userProgress?.filter(p => p.completed).length || 0
  const perfectExercises = exerciseAttempts?.filter(e => e.is_correct).length || 0
  const currentStreak = 7 // Placeholder

  const achievementProgress = achievements.map(achievement => {
    let current = 0
    let unlocked = false

    switch (achievement.id) {
      case 'first_lesson':
      case '10_lessons':
      case '50_lessons':
        current = completedLessons
        break
      case 'perfect_score':
        current = perfectExercises
        break
      case '7_day_streak':
        current = currentStreak
        break
      case 'first_course':
        current = 0 // Would need course completion tracking
        break
      case 'all_styles':
        current = 0 // Would need style tracking
        break
    }

    unlocked = current >= achievement.requirement

    return {
      ...achievement,
      current,
      unlocked,
      progress: Math.min((current / achievement.requirement) * 100, 100),
    }
  })

  const unlockedCount = achievementProgress.filter(a => a.unlocked).length
  const totalCount = achievements.length

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Achievements</h1>
        <p className="text-muted-foreground">
          Unlock badges and celebrate your milestones
        </p>
      </div>

      {/* Overall Progress */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Achievement Progress
          </CardTitle>
          <CardDescription>
            You've unlocked {unlockedCount} of {totalCount} achievements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={(unlockedCount / totalCount) * 100} className="h-3" />
          <p className="text-sm text-muted-foreground mt-2">
            {Math.round((unlockedCount / totalCount) * 100)}% Complete
          </p>
        </CardContent>
      </Card>

      {/* Achievements by Category */}
      {['learning', 'performance', 'consistency', 'completion', 'exploration'].map(category => {
        const categoryAchievements = achievementProgress.filter(a => a.category === category)
        if (categoryAchievements.length === 0) return null

        return (
          <div key={category} className="mb-8">
            <h2 className="text-xl font-semibold mb-4 capitalize">{category}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {categoryAchievements.map((achievement) => {
                const Icon = achievement.icon

                return (
                  <Card
                    key={achievement.id}
                    className={achievement.unlocked ? 'border-primary' : 'opacity-75'}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div
                          className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                            achievement.unlocked
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-muted-foreground'
                          }`}
                        >
                          {achievement.unlocked ? (
                            <Icon className="h-6 w-6" />
                          ) : (
                            <Lock className="h-6 w-6" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold">{achievement.title}</h3>
                            {achievement.unlocked && (
                              <Badge variant="default" className="ml-2">
                                Unlocked
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {achievement.description}
                          </p>

                          {/* Progress */}
                          {!achievement.unlocked && (
                            <div>
                              <Progress value={achievement.progress} className="h-2 mb-1" />
                              <p className="text-xs text-muted-foreground">
                                {achievement.current} / {achievement.requirement}
                              </p>
                            </div>
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
