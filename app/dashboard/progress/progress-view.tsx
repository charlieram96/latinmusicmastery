'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp,
  BookOpen,
  CheckCircle,
  Target,
  Flame,
  Calendar,
} from 'lucide-react'
import { useTranslation } from '@/components/language-provider'

interface ProgressViewProps {
  totalItems: number
  completedItems: number
  inProgressItems: number
  totalExercises: number
  correctExercises: number
  accuracyRate: number
  totalMinutes: number
  totalHours: number
  currentStreak: number
  recentActivity: any[]
}

export function ProgressView({
  totalItems,
  completedItems,
  inProgressItems,
  totalExercises,
  correctExercises,
  accuracyRate,
  totalMinutes,
  totalHours,
  currentStreak,
  recentActivity,
}: ProgressViewProps) {
  const { t, locale } = useTranslation()

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('dashboard.pages.progress.title')}</h1>
        <p className="text-muted-foreground">
          {t('dashboard.pages.progress.subtitle')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        {/* Total Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('dashboard.pages.progress.stats.totalItems')}
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.pages.progress.stats.inProgressCount', { count: inProgressItems })}
            </p>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('dashboard.pages.progress.stats.completed')}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedItems}</div>
            <Progress
              value={totalItems > 0 ? (completedItems / totalItems) * 100 : 0}
              className="mt-2 h-1"
            />
          </CardContent>
        </Card>

        {/* Exercise Accuracy */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('dashboard.pages.progress.stats.accuracy')}
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accuracyRate}%</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.pages.progress.stats.accuracyBreakdown', { correct: correctExercises, total: totalExercises })}
            </p>
          </CardContent>
        </Card>

        {/* Current Streak */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('dashboard.pages.progress.stats.currentStreak')}
            </CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t('dashboard.pages.progress.stats.daysValue', { count: currentStreak })}</div>
            <p className="text-xs text-muted-foreground">
              {currentStreak > 0
                ? t('dashboard.pages.progress.stats.keepItGoing')
                : t('dashboard.pages.progress.stats.startStreak')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Learning Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('dashboard.pages.progress.learningTime.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('dashboard.pages.progress.learningTime.totalHours')}</span>
                <span className="font-bold">{t('dashboard.pages.progress.learningTime.hoursValue', { count: totalHours })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('dashboard.pages.progress.learningTime.totalMinutes')}</span>
                <span className="font-bold">{t('dashboard.pages.progress.learningTime.minutesValue', { count: totalMinutes })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t('dashboard.pages.progress.recentActivity.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity: any) => {
                  const item = activity.class_item as any
                  const cls = item?.class
                  return (
                    <div key={activity.id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium line-clamp-1">
                          {item?.title || cls?.title || t('dashboard.pages.progress.recentActivity.classItemFallback')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.updated_at).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US')}
                        </p>
                      </div>
                      {activity.completed && (
                        <Badge variant="secondary" className="ml-2">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {t('dashboard.pages.progress.recentActivity.done')}
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('dashboard.pages.progress.recentActivity.empty')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
