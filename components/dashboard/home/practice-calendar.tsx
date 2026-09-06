'use client'

import { CalendarDays } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import type { CalendarCell } from '@/lib/dashboard/practice-calendar'
import { cn } from '@/lib/utils'

interface PracticeCalendarProps {
  cells: CalendarCell[]
  weekDone: number
  weekGoal: number
  streak: number
  bestStreak: number
}

const LEVEL_CLASS: Record<number, string> = {
  0: 'bg-foreground/[0.06]',
  1: 'bg-primary/35',
  2: 'bg-primary/60',
  3: 'bg-primary/90',
}

function GoalRing({ done, goal }: { done: number; goal: number }) {
  const size = 44
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(1, goal > 0 ? done / goal : 0)
  return (
    <span className="relative grid h-11 w-11 shrink-0 place-items-center" aria-hidden>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-foreground/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={cn('fill-none transition-[stroke-dashoffset] duration-500', pct >= 1 ? 'stroke-success' : 'stroke-primary')}
        />
      </svg>
      <span className="absolute text-[11px] font-bold tabular-nums">
        {done}/{goal}
      </span>
    </span>
  )
}

export function PracticeCalendar({ cells, weekDone, weekGoal, streak, bestStreak }: PracticeCalendarProps) {
  const { t, locale } = useTranslation()
  const base = 'dashboard.pages.home.calendar'
  const dayLetters = t('dashboard.pages.home.dayLetters').split(',')
  const toGo = Math.max(0, weekGoal - weekDone)
  const today = cells.find((c) => c.isToday)
  const monthLabel = new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { month: 'long' }).format(
    new Date(`${today?.key ?? cells[cells.length - 1]?.key}T12:00:00`)
  )

  return (
    <section aria-labelledby="home-calendar" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/[0.14] text-primary">
          <CalendarDays className="h-4 w-4" aria-hidden />
        </span>
        <h2 id="home-calendar" className="text-base font-semibold">
          {t(`${base}.title`)}
        </h2>
        <span className="ml-auto text-xs capitalize text-muted-foreground">{monthLabel}</span>
      </div>

      <div className="flex items-center gap-3">
        <GoalRing done={weekDone} goal={weekGoal} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {toGo > 0 ? t(`${base}.goalToGo`, { count: toGo }) : t(`${base}.goalReached`)}
          </p>
          <p className="text-xs text-muted-foreground">{t(`${base}.streakBest`, { streak, best: bestStreak })}</p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5" role="img" aria-label={t(`${base}.title`)}>
        {dayLetters.map((d, i) => (
          <span key={`h-${i}`} className="text-center text-[10px] font-semibold text-muted-foreground">
            {d}
          </span>
        ))}
        {cells.map((cell) => (
          <span
            key={cell.key}
            title={`${cell.key}: ${cell.count}`}
            className={cn(
              'aspect-square rounded-[4px]',
              cell.inFuture ? 'bg-transparent ring-1 ring-inset ring-foreground/[0.06]' : LEVEL_CLASS[cell.level],
              cell.isToday && 'ring-2 ring-inset ring-primary/60'
            )}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {today && today.count === 0 && streak > 0 ? t(`${base}.keepStreak`) : t(`${base}.tenMinutes`)}
      </p>
    </section>
  )
}
