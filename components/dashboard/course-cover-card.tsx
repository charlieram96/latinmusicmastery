'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Play, Users, BookOpen } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

/* ------------------------------------------------------------------ */
/*  Shared cover card — used by "My courses" and "Recommended"         */
/*  Cover image (16:10) + hover play affordance + title + teacher,     */
/*  with optional progress block or corner badge.                      */
/* ------------------------------------------------------------------ */

interface CourseCoverCardProps {
  href: string
  title: string
  thumbnailUrl?: string | null
  teacherName?: string | null
  /** Renders a progress bar with the next-lesson label + percent. */
  progress?: { pct: number; label: string }
  /** Top-left corner badge — e.g. a difficulty or "New" pill. */
  badge?: { text: string; className: string }
}

export function CourseCoverCard({
  href,
  title,
  thumbnailUrl,
  teacherName,
  progress,
  badge,
}: CourseCoverCardProps) {
  return (
    <Link href={href} className="group block">
      <div className="overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35">
        {/* Cover */}
        <div className="relative aspect-[16/10] overflow-hidden bg-black">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-500/15 to-terracotta/10">
              <BookOpen className="h-8 w-8 text-amber-400/60" />
            </div>
          )}

          {/* Bottom scrim for legibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/55" />

          {/* Corner badge */}
          {badge && (
            <span
              className={`absolute left-2.5 top-2.5 z-[2] rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold backdrop-blur-sm ${badge.className}`}
            >
              {badge.text}
            </span>
          )}

          {/* Hover play affordance */}
          <span className="absolute inset-0 z-[3] flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-white/55 bg-white/15 backdrop-blur-md">
              <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
            </span>
          </span>
        </div>

        {/* Body */}
        <div className="px-3.5 pb-4 pt-3">
          <h3 className="line-clamp-1 text-sm font-semibold leading-tight text-foreground">
            {title}
          </h3>
          {teacherName && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span className="truncate">{teacherName}</span>
            </div>
          )}

          {progress && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="truncate">{progress.label}</span>
                <span className="tabular-nums">{progress.pct}%</span>
              </div>
              <Progress
                value={progress.pct}
                className="h-1.5 bg-primary/15 [&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-amber-500 [&>[data-slot=progress-indicator]]:to-gold"
              />
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
