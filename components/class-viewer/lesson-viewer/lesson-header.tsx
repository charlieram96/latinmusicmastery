'use client'

// Lesson header — module eyebrow, lesson title, subtitle, and a kebab menu.

import { MoreVertical } from 'lucide-react'

interface LessonHeaderProps {
  moduleTitle: string
  title: string
  subtitle?: string | null
}

export function LessonHeader({ moduleTitle, title, subtitle }: LessonHeaderProps) {
  return (
    <div className="flex flex-col gap-3.5 px-8 pb-3 pt-6">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold tracking-[0.05em] text-primary">
            {moduleTitle}
          </div>
          <h1 className="mt-1 font-heading text-[clamp(1.35rem,1.7vw,1.6rem)] font-bold leading-[1.15] tracking-[-0.02em]">
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
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
