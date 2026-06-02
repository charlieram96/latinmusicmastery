'use client'

import { Flame, Check } from 'lucide-react'
import { AnimatedSection } from '@/components/dashboard/animated-section'
import type { WeekStripProps } from '@/types/dashboard'

/* ------------------------------------------------------------------ */
/*  "This week" practice strip — 7 day cells, practiced days filled,   */
/*  today ringed. Reinforces the streak for a returning learner.       */
/* ------------------------------------------------------------------ */

export function WeekStrip({ days, streak }: WeekStripProps) {
  return (
    <AnimatedSection delay={0.02}>
      <div className="rounded-2xl border border-border bg-card p-[18px]">
        {/* Header */}
        <div className="mb-3.5 flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/14">
              <Flame className="h-3.5 w-3.5 text-primary" />
            </span>
            This week
          </h3>
          <span className="text-xs text-muted-foreground">
            {streak} day{streak !== 1 ? 's' : ''} streak
          </span>
        </div>

        {/* Day cells */}
        <div className="flex gap-1.5">
          {days.map((d, i) => (
            <div
              key={i}
              className="flex flex-1 flex-col items-center gap-1.5"
            >
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {d.label}
              </span>
              <span
                className={[
                  'flex aspect-square w-full max-w-[30px] items-center justify-center rounded-lg border transition-colors',
                  d.practiced
                    ? 'border-transparent bg-primary/85'
                    : 'border-border bg-secondary',
                  d.today ? 'ring-2 ring-primary/50' : '',
                ].join(' ')}
              >
                {d.practiced && <Check className="h-3.5 w-3.5 text-white" />}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  )
}
