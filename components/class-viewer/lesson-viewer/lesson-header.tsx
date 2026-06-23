'use client'

// Lesson header — module breadcrumb, display-scale lesson title, subtitle,
// and a kebab menu.

import { ChevronRight } from 'lucide-react'
import styles from './lesson-viewer.module.css'

interface LessonHeaderProps {
  moduleTitle: string
  title: string
  subtitle?: string | null
}

export function LessonHeader({ moduleTitle, title, subtitle }: LessonHeaderProps) {
  return (
    <div className={`flex flex-col gap-3 px-4 pb-3 pt-5 md:px-8 ${styles.rise}`}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-terracotta">
            {moduleTitle}
            <ChevronRight className="h-3 w-3 opacity-60" aria-hidden />
          </div>
          <h1 className="mt-1 font-heading text-[clamp(1.35rem,1.8vw,1.7rem)] font-extrabold leading-[1.12] tracking-[-0.02em]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
