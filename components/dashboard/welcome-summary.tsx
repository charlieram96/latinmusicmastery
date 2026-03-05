'use client'

import { Flame, CheckCircle2 } from 'lucide-react'
import { AnimatedSection } from '@/components/dashboard/animated-section'
import type { WelcomeSummaryProps } from '@/types/dashboard'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos dias'
  if (hour < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

export function WelcomeSummary({
  name,
  streak,
  itemsCompletedThisWeek,
}: WelcomeSummaryProps) {
  const firstName = name?.trim().split(/\s+/)[0] || 'musician'
  const greeting = getGreeting()

  return (
    <AnimatedSection delay={0}>
      <div className="relative py-2">
        <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-foreground">
          {greeting},{' '}
          <span className="text-terracotta">{firstName}</span>
        </h2>

        {/* Stat pills */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {/* Streak */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1.5">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-xs font-medium text-orange-600 dark:text-orange-300">
              {streak} day{streak !== 1 ? 's' : ''} streak
            </span>
          </div>

          {/* Items completed this week */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-300">
              {itemsCompletedThisWeek} completed this week
            </span>
          </div>
        </div>
      </div>
    </AnimatedSection>
  )
}
