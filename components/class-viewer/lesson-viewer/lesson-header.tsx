'use client'

// Lesson header — module breadcrumb, display-scale lesson title, subtitle,
// and a kebab menu.

import { ChevronRight, MoreVertical } from 'lucide-react'
import styles from './lesson-viewer.module.css'

interface LessonHeaderProps {
  moduleTitle: string
  title: string
  subtitle?: string | null
}

export function LessonHeader({ moduleTitle, title, subtitle }: LessonHeaderProps) {
  return (
    <div className={`flex flex-col gap-3.5 px-4 pb-4 pt-6 md:px-8 ${styles.rise}`}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-terracotta">
            {moduleTitle}
            <ChevronRight className="h-3 w-3 opacity-60" aria-hidden />
          </div>
          <h1 className="mt-1.5 font-heading text-[clamp(1.6rem,2.2vw,2.1rem)] font-extrabold leading-[1.1] tracking-[-0.025em]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        <button
          aria-label="More options"
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
