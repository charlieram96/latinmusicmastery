'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useTranslation } from '@/components/language-provider'
import { coverStyle, glyph } from '@/lib/course-covers'
import { initialsFor } from '@/lib/dashboard/initials'
import { instrumentLabel } from '@/lib/i18n/instruments'
import { cn } from '@/lib/utils'

export interface PosterCourse {
  id: string
  slug: string | null
  title: string
  thumbnailUrl: string | null
  instrument: string | null
  styleName: string | null
  countryName: string | null
  difficulty: string | null
  isFundamentals: boolean
  lessons: number
  teacherName: string | null
  teacherImage: string | null
}

const LEVEL_DOT: Record<string, string> = {
  beginner: 'bg-success',
  intermediate: 'bg-warning',
  advanced: 'bg-danger',
}

/** Faint instrument glyph used as a watermark on gradient covers. */
export function InstrumentGlyph({ instrument, className }: { instrument: string | null; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      dangerouslySetInnerHTML={{ __html: glyph(instrument) }}
    />
  )
}

/** Small translucent chip that sits on a photo. */
export function GlassChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/[0.18] bg-black/45 px-2.5 text-[11px] font-semibold text-white backdrop-blur-md',
        className
      )}
    >
      {children}
    </span>
  )
}

export function LevelDot({ difficulty }: { difficulty: string | null }) {
  return <span className={cn('h-[7px] w-[7px] rounded-full', (difficulty && LEVEL_DOT[difficulty]) || 'bg-white/60')} aria-hidden />
}

/**
 * A 3:4 poster card: the cover carries the card. Genre and level on top, the
 * instrument and country as an amber eyebrow, the title, the teacher, and the
 * lesson count at the bottom. Courses without a photo get the genre gradient
 * with a faint instrument glyph, so the grid never has a blank tile.
 */
export function CoursePoster({ course, priority = false, compact = false }: { course: PosterCourse; priority?: boolean; compact?: boolean }) {
  const { t, locale } = useTranslation()
  const href = `/dashboard/course/${course.slug || course.id}`
  const level = course.difficulty
    ? t(`dashboard.pages.courses.difficulty.${course.difficulty}`)
    : t('dashboard.pages.courses.allLevels')
  const eyebrow = [course.instrument ? instrumentLabel(course.instrument, locale) : null, course.countryName]
    .filter(Boolean)
    .join(' · ')
  const tag = course.isFundamentals ? t('dashboard.pages.courses.fundamentals') : course.styleName

  return (
    <Link
      href={href}
      className={`group relative isolate flex ${compact ? 'min-h-[260px] aspect-square' : 'aspect-[3/4]'} flex-col justify-end overflow-hidden rounded-2xl bg-secondary p-4 text-white shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50`}
    >
      {course.thumbnailUrl ? (
        <Image
          src={course.thumbnailUrl}
          alt=""
          fill
          priority={priority}
          sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="-z-10 object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <>
          <span className="absolute inset-0 -z-10" style={{ background: coverStyle(course.styleName) }} aria-hidden />
          <InstrumentGlyph instrument={course.instrument} className="absolute -right-[8%] top-[16%] -z-10 w-[58%] rotate-[-10deg] text-white opacity-10" />
        </>
      )}
      <span
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.06)_0%,rgba(0,0,0,0.06)_34%,rgba(0,0,0,0.56)_66%,rgba(0,0,0,0.88)_100%)]"
        aria-hidden
      />

      <span className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
        {tag ? <GlassChip className="min-w-0"><span className="truncate">{tag}</span></GlassChip> : <span />}
        {course.difficulty ? (
          <GlassChip>
            <LevelDot difficulty={course.difficulty} />
            {level}
          </GlassChip>
        ) : null}
      </span>

      <span className="flex flex-col gap-1.5">
        {eyebrow ? <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">{eyebrow}</span> : null}
        <span className={`font-heading ${compact ? 'text-[19px] leading-tight' : 'text-[21px] leading-[1.1]'} font-bold tracking-tight`}>{course.title}</span>
        {course.teacherName ? (
          <span className="flex items-center gap-2 text-[12.5px] text-white/85">
            <Avatar className="h-[22px] w-[22px] border border-white/30 text-[9px]">
              {course.teacherImage ? <AvatarImage src={course.teacherImage} alt="" /> : null}
              <AvatarFallback className="bg-white/15 text-white">{initialsFor(course.teacherName)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{course.teacherName}</span>
          </span>
        ) : null}
        <span className="mt-1 flex items-center justify-between text-xs text-white/65">
          <span>{course.lessons > 0 ? t('dashboard.pages.courses.lessonCount', { count: course.lessons }) : t('dashboard.pages.courses.comingSoon')}</span>
          <span className="grid h-[30px] w-[30px] place-items-center rounded-full border border-white/[0.28] bg-white/[0.14] text-white backdrop-blur-md transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </span>
      </span>
    </Link>
  )
}
