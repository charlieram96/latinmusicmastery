'use client'

import { Flame } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import type { CalendarCell } from '@/lib/dashboard/practice-calendar'
import { cn } from '@/lib/utils'
import styles from './streak-card.module.css'

interface StreakCardProps {
  cells: CalendarCell[]
  weekDone: number
  weekGoal: number
  streak: number
  bestStreak: number
}

const BASE = 'dashboard.pages.home.streak'

const LEVEL_CLASS: Record<number, string> = {
  0: 'bg-foreground/[0.06]',
  1: 'bg-primary/35',
  2: 'bg-primary/60',
  3: 'bg-primary/90',
}

/**
 * Where the heatmap axis labels go. "Today" sits under today's column
 * (1-based, Sunday first); "5 weeks ago" takes the columns before it, and is
 * left out when today is Sunday or Monday because it would not fit.
 */
export function heatAxis(cells: CalendarCell[]): { todayColumn: number; showStart: boolean } {
  const index = cells.findIndex((c) => c.isToday)
  const todayColumn = index === -1 ? 7 : (index % 7) + 1
  return { todayColumn, showStart: todayColumn >= 3 }
}

/** Streak, weekly goal and the 5-week practice heatmap in one rail card. */
export function StreakCard({ cells, weekDone, weekGoal, streak, bestStreak }: StreakCardProps) {
  const { t } = useTranslation()
  const dayLetters = t('dashboard.pages.home.dayLetters').split(',')
  const toGo = Math.max(0, weekGoal - weekDone)
  const today = cells.find((c) => c.isToday)
  const live = streak > 0
  const { todayColumn, showStart } = heatAxis(cells)

  return (
    <section aria-labelledby="home-streak" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span
          data-flame
          className={cn(
            'grid h-14 w-14 shrink-0 place-items-center rounded-2xl',
            live ? 'bg-primary/[0.12] text-primary' : 'bg-muted text-muted-foreground'
          )}
        >
          <Flame aria-hidden strokeWidth={1.6} className={cn('h-11 w-11', live ? cn('fill-primary/20', styles.flicker) : 'fill-none')} />
        </span>
        <div className="min-w-0">
          <h2 id="home-streak" className="font-heading text-[30px] font-extrabold leading-none tracking-tight tabular-nums">
            <span className="sr-only">{t(`${BASE}.title`)}: </span>
            {t(streak === 1 ? `${BASE}.daysOne` : `${BASE}.days`, { count: streak })}
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t(bestStreak === 1 ? `${BASE}.bestOne` : `${BASE}.best`, { count: bestStreak })}{' '}
            {today && today.count === 0 && streak > 0 ? t('dashboard.pages.home.calendar.keepStreak') : t('dashboard.pages.home.calendar.tenMinutes')}
          </p>
        </div>
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
          <span>
            <b className="font-semibold text-foreground">{t(`${BASE}.weeklyGoal`)}</b>
            <span aria-hidden> · </span>
            <span className="tabular-nums">{t(`${BASE}.goalProgress`, { done: weekDone, goal: weekGoal })}</span>
          </span>
          <span className={cn('shrink-0 font-semibold', toGo > 0 ? 'text-primary' : 'text-success')}>
            {toGo > 0 ? t(`${BASE}.toGo`, { count: toGo }) : t(`${BASE}.reached`)}
          </span>
        </div>
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: weekGoal }, (_, i) => (
            <span
              key={i}
              data-goal-seg={i < weekDone ? 'done' : 'todo'}
              className={cn('h-1.5 flex-1 rounded-full', i < weekDone ? 'bg-primary' : 'bg-foreground/10')}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-1.5">
        <div className="grid grid-cols-7 gap-1" aria-hidden>
          {dayLetters.map((d, i) => (
            <span key={i} data-day-letter className="text-center text-[10px] font-semibold text-muted-foreground">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1" role="img" aria-label={t(`${BASE}.heatLabel`)}>
          {cells.map((cell) => (
            <span
              key={cell.key}
              data-cell={cell.key}
              data-today={cell.isToday || undefined}
              title={t(cell.count === 1 ? `${BASE}.cellOne` : `${BASE}.cell`, { date: cell.key, count: cell.count })}
              className={cn(
                'aspect-square rounded-[4px]',
                cell.inFuture ? 'bg-transparent ring-1 ring-inset ring-foreground/[0.07]' : LEVEL_CLASS[cell.level],
                cell.isToday && 'outline outline-2 outline-offset-1 outline-primary'
              )}
            />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground" aria-hidden>
          {showStart && (
            <span data-axis-start className="whitespace-nowrap" style={{ gridRow: 1, gridColumnStart: 1, gridColumnEnd: todayColumn }}>
              {t(`${BASE}.fiveWeeksAgo`)}
            </span>
          )}
          <span data-axis-today className="justify-self-center whitespace-nowrap font-semibold text-primary" style={{ gridRow: 1, gridColumnStart: todayColumn }}>
            {t(`${BASE}.today`)}
          </span>
        </div>
      </div>
    </section>
  )
}
