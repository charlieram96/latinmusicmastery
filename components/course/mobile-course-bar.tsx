'use client'

import type { ReactNode } from 'react'
import { ProgressRing } from '@/components/course/progress-ring'
import { cn } from '@/lib/utils'

interface MobileCourseBarProps {
  progressPercentage: number
  /** The summary card's progress line: "Lesson X of Y", "Completed" or "Not started". */
  title: string
  /** The current lesson's title, when there is one. */
  subtitle?: string | null
  /** The main action: a chunky Go into the next lesson, or the subscribe / add-to-plan CTA. */
  action: ReactNode
  /**
   * Put the action on its own full-width row under the progress line. For wide
   * actions (Subscribe / Add to plan) that would otherwise squeeze "Lesson X of Y".
   */
  stacked?: boolean
}

/** Phone and tablet stand-in for the course page's summary card (hidden from lg up). */
export function MobileCourseBar({ progressPercentage, title, subtitle, action, stacked = false }: MobileCourseBarProps) {
  return (
    <div
      data-mobile-bar
      data-stacked={stacked}
      className={cn('fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-lg lg:hidden', stacked && 'grid gap-2.5')}
    >
      <div className="flex items-center gap-3">
        <ProgressRing pct={progressPercentage} size={44} />
        <div className="grid min-w-0 flex-1">
          <b data-bar-title className="truncate text-sm font-semibold">{title}</b>
          {subtitle ? <span data-bar-subtitle className="truncate text-xs text-muted-foreground">{subtitle}</span> : null}
        </div>
        {stacked ? null : <div data-bar-action className="shrink-0">{action}</div>}
      </div>
      {stacked ? <div data-bar-action className="flex w-full [&>*]:flex-1">{action}</div> : null}
    </div>
  )
}
