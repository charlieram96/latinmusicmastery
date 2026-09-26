'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Music, Play, Sparkles } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { SectionHeader } from '@/components/dashboard/section-header'
import { GlassChip, InstrumentGlyph } from '@/components/dashboard/course-poster'
import { useTranslation } from '@/components/language-provider'
import { filterRecommended, type RecContext, type RecFilter, type RecReason } from '@/lib/dashboard/recommendations'
import { coverStyle } from '@/lib/course-covers'
import { initialsFor } from '@/lib/dashboard/initials'
import { instrumentLabel } from '@/lib/i18n/instruments'
import type { Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { RecommendedCourse } from '@/types/dashboard'

type T = (key: string, params?: Record<string, string | number>) => string

function reasonText(reason: RecReason, t: T, locale: Locale) {
  switch (reason.kind) {
    case 'instrument':
      return t('dashboard.pages.home.recommended.why.instrument', { instrument: instrumentLabel(reason.instrument, locale) })
    case 'teacher':
      return t('dashboard.pages.home.recommended.why.teacher', { teacher: reason.teacher, course: reason.course })
    case 'new':
      return t('dashboard.pages.home.recommended.why.new')
    default:
      return t('dashboard.pages.home.recommended.why.popular')
  }
}

export function RecommendedSection({ courses, ctx }: { courses: RecommendedCourse[]; ctx: RecContext }) {
  const { t, locale } = useTranslation()
  const [filter, setFilter] = useState<RecFilter>('all')
  if (courses.length === 0) return null

  const filters: { key: RecFilter; label: string }[] = [{ key: 'all', label: t('dashboard.pages.home.recommended.filters.all') }]
  if (ctx.instruments.length > 0)
    filters.push({ key: 'instrument', label: t('dashboard.pages.home.recommended.filters.forInstrument', { instrument: instrumentLabel(ctx.instruments[0], locale) }) })
  if (ctx.teacherIds.length > 0) filters.push({ key: 'teachers', label: t('dashboard.pages.home.recommended.filters.yourTeachers') })
  if (courses.some((c) => c.isNew)) filters.push({ key: 'new', label: t('dashboard.pages.home.recommended.filters.new') })

  const visible = filterRecommended(courses, filter, ctx)

  return (
    <section aria-labelledby="home-recommended">
      <SectionHeader
        id="home-recommended"
        title={t('dashboard.pages.home.recommended.title')}
        count={t('dashboard.pages.home.recommended.subtitle')}
        href="/dashboard/courses"
        linkLabel={t('common.browseAll')}
      >
        {filters.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('dashboard.pages.home.recommended.title')}>
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={cn(
                  'h-7 rounded-full px-2.5 text-xs font-medium transition-colors',
                  filter === f.key ? 'bg-primary/[0.14] text-primary' : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </SectionHeader>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t('dashboard.pages.home.recommended.emptyFilter')}
        </p>
      ) : (
        <div
          data-posters
          className="-mx-6 flex snap-x snap-mandatory scroll-px-6 gap-3.5 overflow-x-auto px-6 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-[repeat(auto-fill,minmax(clamp(calc(25%-11px),calc((800px-100%)*999),calc(50%-7px)),1fr))] md:overflow-visible md:px-0 md:pb-0"
        >
          {visible.slice(0, 4).map((course, i) => (
            <PosterCard key={course.id} course={course} reason={reasonText(course.reason, t, locale)} priority={i === 0} />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * A 4:5 poster: full cover art with the style word as large faint type,
 * glass chips for instrument and lesson count, then the reason, title and
 * teacher. Hover lifts the card, zooms the art, shows a play disc and slides
 * up a chunky Preview (always shown on phones, where there is no hover).
 */
function PosterCard({ course, reason, priority }: { course: RecommendedCourse; reason: string; priority: boolean }) {
  const { t, locale } = useTranslation()
  const instrument = course.instrument ? instrumentLabel(course.instrument, locale) : null
  const lessons = course.lessonCount
    ? t(course.lessonCount === 1 ? 'dashboard.pages.home.recommended.lessonsOne' : 'dashboard.pages.home.recommended.lessons', { count: course.lessonCount })
    : null

  return (
    <Link
      href={course.href}
      data-poster
      className="group relative isolate flex aspect-[4/5] w-[62%] shrink-0 snap-start flex-col justify-end overflow-hidden rounded-2xl text-white shadow-[0_4px_0_hsl(0_0%_0%/0.25)] outline-none transition-[transform,box-shadow] duration-pop ease-smooth hover:shadow-[0_8px_0_hsl(0_0%_0%/0.22)] focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:hover:-translate-y-1 md:w-auto"
    >
      <span data-art aria-hidden className="absolute inset-0 -z-10 transition-transform duration-500 ease-smooth motion-safe:group-hover:scale-[1.06]">
        {course.thumbnailUrl ? (
          <Image src={course.thumbnailUrl} alt="" fill priority={priority} sizes="(min-width: 1280px) 22vw, (min-width: 768px) 45vw, 62vw" className="object-cover" />
        ) : (
          <>
            <span className="absolute inset-0" style={{ background: coverStyle(course.styleName) }} />
            <span className="absolute inset-0 bg-[repeating-linear-gradient(115deg,rgba(255,255,255,0.07)_0_2px,transparent_2px_14px)]" />
            <InstrumentGlyph instrument={course.instrument} className="absolute -right-[10%] top-[12%] w-[60%] rotate-[-10deg] text-white opacity-10" />
          </>
        )}
        {course.styleName && (
          <span data-style-word className="absolute -left-1 top-[34%] whitespace-nowrap font-heading text-[56px] font-black uppercase leading-none tracking-[-0.04em] opacity-20">
            {course.styleName}
          </span>
        )}
        <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(10,6,4,0.35)_55%,rgba(10,6,4,0.88))]" />
      </span>

      <span className="absolute inset-x-2.5 top-2.5 flex items-center justify-between gap-1.5">
        {instrument ? (
          <GlassChip className="min-w-0 bg-black/30">
            <Music className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{instrument}</span>
          </GlassChip>
        ) : (
          <span />
        )}
        {lessons && <GlassChip className="bg-black/30 tabular-nums">{lessons}</GlassChip>}
      </span>

      <span
        data-play-disc
        aria-hidden
        className="absolute left-1/2 top-[38%] grid h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/50 bg-white/[0.22] opacity-0 backdrop-blur-md transition-[opacity,transform] duration-pop ease-spring group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:scale-75 motion-safe:group-hover:scale-100 motion-safe:group-focus-visible:scale-100"
      >
        <Play className="ml-0.5 h-5 w-5 fill-current" />
      </span>

      <span className="grid gap-1.5 p-3.5">
        <span className="flex items-start gap-1.5 text-[11px] font-semibold leading-snug text-[hsl(38_90%_72%)]">
          <Sparkles className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-2">{reason}</span>
        </span>
        <span className="text-balance font-heading text-[17px] font-bold leading-[1.15] tracking-tight">{course.title}</span>
        {course.teacherName && (
          <span className="flex min-w-0 items-center gap-2 text-xs text-white/85">
            <span data-initials aria-hidden className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border border-white/30 bg-white/20 text-[9px] font-extrabold">
              {initialsFor(course.teacherName)}
            </span>
            <span className="truncate">{course.teacherName}</span>
          </span>
        )}
        {/* Rows 0fr→1fr so the hidden button's padding never leaks. */}
        <span
          data-preview-reveal
          aria-hidden
          className="grid grid-rows-[1fr] transition-[grid-template-rows,opacity] duration-pop ease-smooth motion-reduce:transition-none md:grid-rows-[0fr] md:opacity-0 md:group-hover:grid-rows-[1fr] md:group-hover:opacity-100 md:group-focus-visible:grid-rows-[1fr] md:group-focus-visible:opacity-100"
        >
          <span className="min-h-0 overflow-hidden">
            <span data-preview className={cn(buttonVariants({ variant: 'chunky', size: 'sm' }), 'mb-1 mt-1.5 flex w-full')}>
              {t('dashboard.pages.home.recommended.previewCta')}
            </span>
          </span>
        </span>
      </span>
    </Link>
  )
}
