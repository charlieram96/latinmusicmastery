'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Trophy,
  Lock,
  Star,
  BookOpen,
  Target,
  Crown,
  Flame,
  Zap,
  Award,
  Sparkles,
  GraduationCap,
  Compass,
  Music,
  Users,
  Video,
  Heart,
  type LucideIcon,
} from 'lucide-react'
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@/lib/achievements'
import { useTranslation } from '@/components/language-provider'

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  Target,
  Star,
  Trophy,
  Crown,
  Flame,
  Zap,
  Award,
  Sparkles,
  GraduationCap,
  Compass,
  Music,
  Users,
  Video,
  Heart,
}

interface AchievementItem {
  key: string
  title: string
  description: string
  iconName: string
  category: string
  color: string
  requirement: number
  current: number
  isUnlocked: boolean
  progress: number
}

interface AchievementsViewProps {
  achievementsWithProgress: AchievementItem[]
  totalUnlocked: number
  totalAchievements: number
  completedLessons: number
  streak: number
  completedCourses: number
}

export function AchievementsView({
  achievementsWithProgress,
  totalUnlocked,
  totalAchievements,
  completedLessons,
  streak,
  completedCourses,
}: AchievementsViewProps) {
  const { t } = useTranslation()

  const pct = Math.round((totalUnlocked / totalAchievements) * 100)

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-heading mb-2">{t('dashboard.pages.achievements.title')}</h1>
        <p className="text-muted-foreground">
          {t('dashboard.pages.achievements.subtitle')}
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
                {t('dashboard.pages.achievements.overall.unlockedCount', {
                  unlocked: totalUnlocked,
                  total: totalAchievements,
                })}
              </h2>
              <Progress value={(totalUnlocked / totalAchievements) * 100} className="h-3 mb-2" />
              <p className="text-sm text-muted-foreground">
                {t('dashboard.pages.achievements.overall.percentComplete', { percent: pct })}
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-center">
              <div className="bg-secondary rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-primary">{completedLessons}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.pages.achievements.overall.lessons')}</p>
              </div>
              <div className="bg-secondary rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-primary">{streak}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.pages.achievements.overall.dayStreak')}</p>
              </div>
              <div className="bg-secondary rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-primary">{completedCourses}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.pages.achievements.overall.courses')}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Achievements by Category */}
      {CATEGORY_ORDER.map((category) => {
        const categoryAchievements = achievementsWithProgress.filter((a) => a.category === category)
        if (categoryAchievements.length === 0) return null

        const categoryUnlocked = categoryAchievements.filter((a) => a.isUnlocked).length

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
                const Icon = ICON_MAP[achievement.iconName] || Star

                return (
                  <Card
                    key={achievement.key}
                    className={`relative overflow-hidden transition-all ${
                      achievement.isUnlocked ? 'border-primary/30' : 'opacity-75 grayscale'
                    }`}
                  >
                    {achievement.isUnlocked && (
                      <div className={`absolute inset-0 bg-gradient-to-br ${achievement.color} opacity-10`} />
                    )}

                    <CardContent className="relative p-5">
                      <div className="flex items-start gap-4">
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
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm mb-0.5">{achievement.title}</h3>
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                            {achievement.description}
                          </p>

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
                              {t('dashboard.pages.achievements.unlocked')}
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
