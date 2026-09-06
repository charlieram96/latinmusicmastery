'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronRight, Play, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SectionHeader } from '@/components/dashboard/section-header'
import { useTranslation } from '@/components/language-provider'
import { filterRecommended, type RecContext, type RecFilter, type RecReason } from '@/lib/dashboard/recommendations'
import { coverStyle } from '@/lib/course-covers'
import { cn } from '@/lib/utils'
import type { RecommendedCourse } from '@/types/dashboard'
import { CourseThumb } from './course-list'

type DifficultyVariant = 'success' | 'warning' | 'danger' | 'outline'

export function difficultyVariant(difficulty: string | null): DifficultyVariant {
  switch ((difficulty ?? '').toLowerCase()) {
    case 'beginner':
      return 'success'
    case 'intermediate':
      return 'warning'
    case 'advanced':
      return 'danger'
    default:
      return 'outline'
  }
}

export function difficultyKey(difficulty: string | null): 'beginner' | 'intermediate' | 'advanced' | null {
  const d = (difficulty ?? '').toLowerCase()
  return d === 'beginner' || d === 'intermediate' || d === 'advanced' ? d : null
}

function reasonText(reason: RecReason, t: (key: string, params?: Record<string, string | number>) => string) {
  switch (reason.kind) {
    case 'instrument':
      return t('dashboard.pages.home.recommended.why.instrument', { instrument: reason.instrument })
    case 'teacher':
      return t('dashboard.pages.home.recommended.why.teacher', { teacher: reason.teacher, course: reason.course })
    case 'new':
      return t('dashboard.pages.home.recommended.why.new')
    default:
      return t('dashboard.pages.home.recommended.why.popular')
  }
}

export function RecommendedSection({ courses, ctx }: { courses: RecommendedCourse[]; ctx: RecContext }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<RecFilter>('all')
  if (courses.length === 0) return null

  const filters: { key: RecFilter; label: string }[] = [{ key: 'all', label: t('dashboard.pages.home.recommended.filters.all') }]
  if (ctx.instruments.length > 0)
    filters.push({ key: 'instrument', label: t('dashboard.pages.home.recommended.filters.forInstrument', { instrument: ctx.instruments[0] }) })
  if (ctx.teacherIds.length > 0) filters.push({ key: 'teachers', label: t('dashboard.pages.home.recommended.filters.yourTeachers') })
  if (courses.some((c) => c.isNew)) filters.push({ key: 'new', label: t('dashboard.pages.home.recommended.filters.new') })

  const visible = filterRecommended(courses, filter, ctx)
  const [featured, ...rest] = visible
  const list = rest.slice(0, 3)

  return (
    <section aria-labelledby="home-recommended">
      <SectionHeader
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

      {!featured ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t('dashboard.pages.home.recommended.emptyFilter')}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          {/* Featured pick */}
          <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-shadow hover:shadow-lift">
            <Link href={featured.href} className="relative block aspect-[2/1] overflow-hidden bg-sunken" aria-label={featured.title}>
              {featured.thumbnailUrl ? (
                <Image
                  src={featured.thumbnailUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <span aria-hidden className="absolute inset-0" style={{ background: coverStyle(featured.styleName) }} />
              )}
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <span className="absolute left-3 top-3 flex gap-1.5">
                {difficultyKey(featured.difficulty) && (
                  <Badge variant="onImage" className="text-[11px]">
                    {t(`dashboard.pages.courses.difficulty.${difficultyKey(featured.difficulty)}`)}
                  </Badge>
                )}
                {featured.isNew && <Badge variant="onImage" className="text-[11px] text-gold">{t('dashboard.pages.home.newBadge')}</Badge>}
              </span>
              <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
                <span className="grid h-12 w-12 place-items-center rounded-full border border-white/50 bg-white/20 text-white backdrop-blur-md">
                  <Play className="ml-0.5 h-5 w-5 fill-current" />
                </span>
              </span>
            </Link>
            <div className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-heading text-lg font-bold tracking-tight">
                  <Link href={featured.href} className="hover:text-primary">{featured.title}</Link>
                </h3>
                {featured.lessonCount ? (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {t('dashboard.pages.home.recommended.lessons', { count: featured.lessonCount })}
                  </span>
                ) : null}
              </div>
              {featured.teacherName && <p className="-mt-1 text-sm text-muted-foreground">{featured.teacherName}</p>}
              <p className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/[0.08] p-3 text-sm leading-relaxed">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>{reasonText(featured.reason, t)}</span>
              </p>
              <div className="mt-auto">
                <Button asChild variant="outline" size="sm">
                  <Link href={featured.href}>{t('dashboard.pages.home.recommended.preview')}</Link>
                </Button>
              </div>
            </div>
          </article>

          {/* Compact list */}
          {list.length > 0 && (
            <div className="flex flex-col gap-3">
              {list.map((course) => (
                <Link
                  key={course.id}
                  href={course.href}
                  className="group flex flex-1 items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift"
                >
                  <CourseThumb src={course.thumbnailUrl} styleName={course.styleName} alt="" className="h-[55px] w-[88px]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{course.title}</p>
                    {course.teacherName && <p className="truncate text-xs text-muted-foreground">{course.teacherName}</p>}
                    <div className="mt-1.5 flex items-center gap-2">
                      {difficultyKey(course.difficulty) && (
                        <Badge variant={difficultyVariant(course.difficulty)} className="h-[18px] px-1.5 text-[10px]">
                          {t(`dashboard.pages.courses.difficulty.${difficultyKey(course.difficulty)}`)}
                        </Badge>
                      )}
                      {course.lessonCount ? (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {t('dashboard.pages.home.recommended.lessons', { count: course.lessonCount })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
