'use client'

import Link from 'next/link'
import { Play, ArrowRight, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AnimatedSection } from '@/components/dashboard/animated-section'
import type { ContinueLearningHeroProps } from '@/types/dashboard'
import { useTranslation } from '@/components/language-provider'

export function ContinueLearningHero({ continueData }: ContinueLearningHeroProps) {
  const { t } = useTranslation()
  /* ── New user / nothing in progress → quiet "pick a course" bar ── */
  if (!continueData) {
    return (
      <AnimatedSection delay={0.05}>
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-border bg-card p-5 sm:flex-row sm:items-center sm:gap-5">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/12">
            <Compass className="h-5 w-5 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-foreground">
              {t('dashboard.pages.home.pickFirstCourse')}
            </div>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
              {t('dashboard.pages.home.pickFirstCourseBody')}
            </p>
          </div>
          <Button asChild className="flex-shrink-0 rounded-full">
            <Link href="/dashboard/courses">
              {t('dashboard.pages.myCourses.browseCourses')}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </AnimatedSection>
    )
  }

  const resumeHref = continueData.classId
    ? `/dashboard/course/${continueData.courseSlug}/class/${continueData.classId}`
    : `/dashboard/course/${continueData.courseSlug}`

  const meta = [continueData.nextLessonTitle, continueData.teacherName]
    .filter(Boolean)
    .join(' · ')

  /* ── Returning learner → horizontal resume bar ── */
  return (
    <AnimatedSection delay={0.05}>
      <Link href={resumeHref} className="group block">
        <div className="flex flex-col overflow-hidden rounded-[18px] border border-border bg-card transition-colors hover:border-primary/35 sm:flex-row">
          {/* Cover art */}
          <div className="relative h-44 w-full flex-shrink-0 overflow-hidden bg-black sm:h-auto sm:w-[220px]">
            {continueData.courseThumbnail ? (
              <img
                src={continueData.courseThumbnail}
                alt={continueData.courseTitle}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-terracotta/15" />
            )}
            {/* Right-fading scrim blends cover into the card on desktop */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-black/5 sm:bg-gradient-to-r sm:from-transparent sm:via-transparent sm:to-card" />
          </div>

          {/* Body */}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-5 py-5 sm:px-6">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              {t('dashboard.pages.home.continueLearning')}
            </span>
            <h3 className="mt-1 line-clamp-2 font-heading text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl">
              {continueData.courseTitle}
            </h3>
            {meta && (
              <div className="mt-1 truncate text-[13.5px] text-muted-foreground">
                {meta}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button className="w-fit flex-shrink-0 rounded-full" tabIndex={-1}>
                <Play className="h-4 w-4 fill-current" />
                {t('dashboard.pages.home.resumeLesson')}
              </Button>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center justify-between text-[11.5px] tabular-nums text-muted-foreground">
                  <span>{t('dashboard.pages.home.courseProgress')}</span>
                  <span>{continueData.pct}%</span>
                </div>
                <Progress
                  value={continueData.pct}
                  className="h-2 bg-primary/15 [&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-amber-500 [&>[data-slot=progress-indicator]]:to-gold"
                />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </AnimatedSection>
  )
}
