'use client'

import { useSyncExternalStore } from 'react'
import { Check, Flame } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { greetingKey, type GreetingKey } from '@/lib/dashboard/greeting'
import { cn } from '@/lib/utils'

interface GreetingRowProps {
  firstName: string | null
  streak: number
  weekDone: number
  weekGoal: number
}

const subscribeNever = () => () => {}
const clientGreeting = (): GreetingKey => greetingKey(new Date().getHours())
const serverGreeting = (): GreetingKey => 'afternoon'

export function GreetingRow({ firstName, streak, weekDone, weekGoal }: GreetingRowProps) {
  const { t } = useTranslation()
  // The time of day is the learner's, so it is resolved on the client only.
  const period = useSyncExternalStore(subscribeNever, clientGreeting, serverGreeting)
  const name = firstName?.trim() || t('dashboard.pages.home.musicianFallback')
  const hasStreak = streak > 0

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h1 suppressHydrationWarning className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
        {t(`dashboard.pages.home.greeting.${period}`, { name })}
      </h1>
      <div className="flex flex-wrap gap-2">
        <span
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium tabular-nums',
            hasStreak ? 'bg-primary/[0.14] text-primary' : 'bg-secondary text-muted-foreground'
          )}
        >
          <Flame className={cn('h-3.5 w-3.5', hasStreak && 'fill-current')} aria-hidden />
          {t(streak === 1 ? 'dashboard.pages.home.streakDaysOne' : 'dashboard.pages.home.streakDaysOther', { count: streak })}
        </span>
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary px-3 text-sm font-medium tabular-nums text-foreground">
          <Check className="h-3.5 w-3.5" aria-hidden />
          {t('dashboard.pages.home.weeklyGoalChip', { done: weekDone, goal: weekGoal })}
        </span>
      </div>
    </div>
  )
}
