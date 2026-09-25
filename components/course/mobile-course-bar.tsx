'use client'

import type { ReactNode } from 'react'
import { ProgressRing } from '@/components/course/progress-ring'

interface MobileCourseBarProps {
  progressPercentage: number
  /** The summary card's progress line: "Lesson X of Y", "Completed" or "Not started". */
  title: string
  /** The current lesson's title, when there is one. */
  subtitle?: string | null
  /** The main action: a chunky Go into the next lesson, or the subscribe / add-to-plan CTA. */
  action: ReactNode
}

/** Phone and tablet stand-in for the course page's summary card (hidden from lg up). */
export function MobileCourseBar({ progressPercentage, title, subtitle, action }: MobileCourseBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-lg lg:hidden">
      <div className="flex items-center gap-3">
        <ProgressRing pct={progressPercentage} size={44} />
        <div className="grid min-w-0 flex-1">
          <b className="truncate text-sm font-semibold">{title}</b>
          {subtitle ? <span data-bar-subtitle className="truncate text-xs text-muted-foreground">{subtitle}</span> : null}
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  )
}
