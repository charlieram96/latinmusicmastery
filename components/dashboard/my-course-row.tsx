'use client'

import Link from 'next/link'
import { BadgeCheck, CheckCircle2, Lock, Play, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CourseThumb } from '@/components/dashboard/home/course-list'
import { useTranslation } from '@/components/language-provider'
import { instrumentLabel } from '@/lib/i18n/instruments'
import type { MyCourseRow as MyCourseRowData } from '@/types/dashboard'

/**
 * One enrolled course as an editorial row: cover, title, teacher line, where the
 * learner is, progress, and a resume button. The whole row links to the course;
 * the button links straight to the lesson.
 */
export function MyCourseRow({ course }: { course: MyCourseRowData }) {
  const { t, locale } = useTranslation()
  const done = course.status === 'completed'
  // Opened but nothing finished still counts as started for the button and position line.
  const started = course.status === 'in-progress' || (!done && course.currentClassIndex !== null)

  const who = [
    course.teacherName,
    course.instrument ? instrumentLabel(course.instrument, locale) : null,
    course.countryName,
  ]
    .filter(Boolean)
    .join(' · ')

  const where = done
    ? null
    : course.currentClassIndex !== null
      ? [
          course.currentModuleIndex !== null && course.totalModules > 1
            ? t('dashboard.pages.myCourses.row.moduleOfTotal', { n: course.currentModuleIndex, total: course.totalModules })
            : null,
          t('dashboard.pages.myCourses.row.lesson', { n: course.currentClassIndex + 1 }),
          course.currentClassTitle,
        ]
          .filter(Boolean)
          .join(' · ')
      : t('dashboard.pages.myCourses.row.notStarted')

  // A course the current plan no longer covers sends the learner to the course page to add it.
  const blocked = course.inPlan === false
  const cta = blocked
    ? { label: t('dashboard.pages.myCourses.plan.addToPlan'), icon: Plus, href: course.href }
    : done
      ? { label: t('dashboard.pages.myCourses.row.review'), icon: RotateCcw, href: course.resumeHref }
      : started
        ? { label: t('dashboard.pages.myCourses.row.resume'), icon: Play, href: course.resumeHref }
        : { label: t('dashboard.pages.myCourses.row.start'), icon: Play, href: course.resumeHref }

  return (
    <div className="group relative -mx-3 flex items-center gap-4 rounded-lg px-3 py-4 transition-colors hover:bg-accent/40 sm:gap-5">
      <CourseThumb src={course.thumbnailUrl} styleName={course.styleName} alt="" className="h-[60px] w-24" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-heading text-base font-bold tracking-tight">
            <Link
              href={course.href}
              className="transition-colors after:absolute after:inset-0 after:rounded-lg group-hover:text-primary focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
            >
              {course.title}
            </Link>
          </h3>
          {course.inPlan === true ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/[0.12] px-2 py-0.5 text-[11px] font-semibold text-success">
              <BadgeCheck className="h-3 w-3" aria-hidden />
              {t('dashboard.pages.myCourses.plan.inPlan')}
            </span>
          ) : course.inPlan === false ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              <Lock className="h-3 w-3" aria-hidden />
              {t('dashboard.pages.myCourses.plan.notInPlan')}
            </span>
          ) : null}
        </div>
        {who ? <p className="truncate text-sm text-muted-foreground">{who}</p> : null}
        {done ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {t('dashboard.pages.myCourses.row.completed')}
          </p>
        ) : (
          <p className={`mt-1 truncate text-sm ${started ? 'text-foreground' : 'text-muted-foreground'}`}>{where}</p>
        )}
      </div>

      <div className="hidden w-44 shrink-0 md:block">
        <div className="flex items-center gap-2">
          <Progress value={course.pct} className="h-1" indicatorClassName={done ? 'bg-success' : undefined} />
          <span className="w-9 text-right text-xs font-semibold tabular-nums">{course.pct}%</span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t('dashboard.pages.myCourses.row.lessonsDone', { done: course.doneClasses, total: course.totalClasses })}
        </p>
      </div>

      <Button
        asChild
        size="sm"
        variant={done || blocked ? 'outline' : 'default'}
        className="relative z-10 hidden w-[7.5rem] shrink-0 sm:inline-flex"
      >
        <Link href={cta.href}>
          <cta.icon className={cta.icon === Play ? 'fill-current' : ''} aria-hidden />
          {cta.label}
        </Link>
      </Button>
    </div>
  )
}
