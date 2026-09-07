'use client'

import Link from 'next/link'
import { Award, BarChart3, BookOpen, CheckCircle2, Circle, Clock, Flame, History, Target } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { SectionHeader } from '@/components/dashboard/section-header'
import { StatTile } from '@/components/dashboard/stat-tile'
import { EmptyState } from '@/components/dashboard/empty-state'
import { WeeklyActivityChart } from '@/components/dashboard/progress/weekly-activity-chart'
import { PracticeCalendar } from '@/components/dashboard/home/practice-calendar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { splitMinutes, type ProgressData } from '@/lib/dashboard/progress'

export function ProgressView({ data }: { data: ProgressData }) {
  const { t, locale } = useTranslation()
  const base = 'dashboard.pages.progress'

  const duration = (minutes: number) => {
    const { h, m } = splitMinutes(minutes)
    return h > 0 ? t('common.duration.hoursMinutes', { h, m }) : t('common.duration.minutes', { m })
  }
  const dateFmt = new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { day: 'numeric', month: 'short' })
  const hasActivity = data.startedItems > 0

  return (
    <>
      <PageHeader
        title={t(`${base}.title`)}
        description={t(`${base}.subtitle`)}
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/achievements">
              <Award aria-hidden />
              {t(`${base}.viewAchievements`)}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Flame}
          label={t(`${base}.stats.currentStreak`)}
          value={t(data.streak === 1 ? `${base}.stats.dayValue` : `${base}.stats.daysValue`, { count: data.streak })}
          hint={
            data.bestStreak > 0
              ? t(data.bestStreak === 1 ? `${base}.stats.bestOne` : `${base}.stats.best`, { count: data.bestStreak })
              : t(`${base}.stats.startStreak`)
          }
        />
        <StatTile
          icon={CheckCircle2}
          tint="bg-success/[0.14] text-success"
          label={t(`${base}.stats.completedItems`)}
          value={data.completedItems}
          hint={t(`${base}.stats.ofStarted`, { count: data.startedItems })}
        />
        <StatTile
          icon={Clock}
          tint="bg-gold/[0.16] text-gold"
          label={t(`${base}.stats.practiceTime`)}
          value={duration(data.totalMinutes)}
          hint={t(`${base}.stats.thisWeek`, { count: data.weekMinutes })}
        />
        <StatTile
          icon={Target}
          tint="bg-terracotta/[0.16] text-terracotta"
          label={t(`${base}.stats.accuracy`)}
          value={data.accuracy === null ? '—' : `${data.accuracy}%`}
          hint={
            data.attempts > 0
              ? t(`${base}.stats.accuracyBreakdown`, { correct: data.correct, total: data.attempts })
              : t(`${base}.stats.noExercises`)
          }
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="progress-chart" className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="mb-5 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/[0.14] text-primary">
                <BarChart3 className="h-4 w-4" aria-hidden />
              </span>
              <h2 id="progress-chart" className="text-base font-semibold">
                {t(`${base}.chart.title`)}
              </h2>
              <span className="ml-auto text-xs text-muted-foreground">{t(`${base}.chart.range`, { count: data.weeks.length })}</span>
            </div>
            {data.completedItems > 0 ? (
              <WeeklyActivityChart buckets={data.weeks} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">{t(`${base}.chart.empty`)}</p>
            )}
          </section>

          <section aria-labelledby="progress-recent">
            <SectionHeader title={t(`${base}.recentActivity.title`)} />
            {data.recent.length > 0 ? (
              <ul className="divide-y divide-border border-y border-border">
                {data.recent.map((a) => {
                  const Icon = a.completed ? CheckCircle2 : Circle
                  const where = [a.courseTitle, a.lessonTitle].filter(Boolean).join(' · ')
                  const inner = (
                    <>
                      <Icon
                        className={`h-4 w-4 shrink-0 ${a.completed ? 'text-success' : 'text-muted-foreground/60'}`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.title || t(`${base}.recentActivity.classItemFallback`)}</p>
                        {where ? <p className="truncate text-xs text-muted-foreground">{where}</p> : null}
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{dateFmt.format(new Date(a.at))}</span>
                      {a.completed ? (
                        <Badge variant="success" className="hidden shrink-0 sm:inline-flex">
                          {t(`${base}.recentActivity.done`)}
                        </Badge>
                      ) : null}
                    </>
                  )
                  return (
                    <li key={a.id}>
                      {a.href ? (
                        <Link href={a.href} className="-mx-3 flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-accent/40">
                          {inner}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 py-3">{inner}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState icon={History} title={t(`${base}.recentActivity.emptyTitle`)} body={t(`${base}.recentActivity.empty`)} />
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <PracticeCalendar
            cells={data.calendar}
            weekDone={data.weekDone}
            weekGoal={data.weekGoal}
            streak={data.streak}
            bestStreak={data.bestStreak}
          />

          <section aria-labelledby="progress-courses" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/[0.14] text-primary">
                <BookOpen className="h-4 w-4" aria-hidden />
              </span>
              <h2 id="progress-courses" className="text-base font-semibold">
                {t(`${base}.byCourse.title`)}
              </h2>
            </div>
            {data.courses.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {data.courses.map((c) => (
                  <li key={c.id}>
                    <Link href={c.href} className="group block">
                      <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">{c.title}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {t(`${base}.byCourse.summary`, { completed: c.completed, minutes: c.minutes })}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t(`${base}.byCourse.empty`)}</p>
            )}
          </section>

          {!hasActivity ? (
            <Button asChild className="w-full">
              <Link href="/dashboard/my-courses">{t('dashboard.pages.myCourses.title')}</Link>
            </Button>
          ) : null}
        </aside>
      </div>
    </>
  )
}
