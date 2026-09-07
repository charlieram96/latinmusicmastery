'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { SectionHeader } from '@/components/dashboard/section-header'
import { useTranslation } from '@/components/language-provider'
import { coverStyle } from '@/lib/course-covers'
import type { HomeCourseSummary } from '@/types/dashboard'

export function CourseThumb({
  src,
  styleName,
  alt,
  className,
}: {
  src: string | null
  styleName: string | null
  alt: string
  className: string
}) {
  if (src) {
    return (
      <span className={`relative block shrink-0 overflow-hidden rounded-md bg-sunken ${className}`}>
        <Image src={src} alt={alt} fill sizes="160px" className="object-cover" />
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className={`block shrink-0 rounded-md ${className}`}
      style={{ background: coverStyle(styleName) }}
    />
  )
}

export function CourseList({ courses }: { courses: HomeCourseSummary[] }) {
  const { t } = useTranslation()
  if (courses.length === 0) return null

  const inProgress = courses.filter((c) => c.currentClassIndex !== null).length

  return (
    <section aria-labelledby="home-courses">
      <SectionHeader
        title={t('dashboard.pages.home.courses.title')}
        count={t('dashboard.pages.home.courses.inProgress', { count: inProgress })}
        href="/dashboard/my-courses"
        linkLabel={t('common.viewAll')}
      />
      <div className="divide-y divide-border border-y border-border">
        {courses.map((course) => {
          const meta =
            course.currentClassIndex !== null
              ? t('dashboard.pages.home.courses.lessonOfTotal', {
                  n: course.currentClassIndex + 1,
                  total: course.totalClasses,
                })
              : course.totalClasses > 0 && course.doneClasses >= course.totalClasses
                ? t('dashboard.pages.home.courses.completed')
                : t('dashboard.pages.home.courses.notStarted')
          return (
            <Link
              key={course.id}
              href={course.href}
              className="group flex items-center gap-4 py-3.5 pr-1 transition-colors hover:bg-accent/40 sm:gap-5"
            >
              <CourseThumb src={course.thumbnailUrl} styleName={course.styleName} alt="" className="h-[45px] w-[72px]" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-heading text-base font-bold tracking-tight transition-colors group-hover:text-primary">
                  {course.title}
                </h3>
                <p className="truncate text-sm text-muted-foreground">
                  {[course.teacherName, meta].filter(Boolean).join(', ')}
                </p>
              </div>
              <div className="hidden w-40 items-center gap-2 sm:flex">
                <Progress value={course.pct} className="h-1" indicatorClassName={course.pct >= 100 ? 'bg-success' : undefined} />
                <span className="w-9 text-right text-xs font-semibold tabular-nums">{course.pct}%</span>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
