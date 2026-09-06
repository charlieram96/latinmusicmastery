'use client'

// Lesson header — eyebrow breadcrumb (module name on a lesson, course name on
// a module overview; a link when an href is given), display-scale title,
// and an optional subtitle.

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import styles from './lesson-viewer.module.css'

interface LessonHeaderProps {
  eyebrow: string
  eyebrowHref?: string | null
  title: string
  subtitle?: string | null
}

export function LessonHeader({ eyebrow, eyebrowHref, title, subtitle }: LessonHeaderProps) {
  return (
    <div className={`flex flex-col gap-3 px-4 pb-3 pt-5 md:px-8 ${styles.rise}`}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-terracotta">
            {eyebrowHref ? (
              <Link
                href={eyebrowHref}
                className="truncate rounded-sm underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {eyebrow}
              </Link>
            ) : (
              <span className="truncate">{eyebrow}</span>
            )}
            <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-60" aria-hidden />
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
