'use client'

import Link from 'next/link'
import { ArrowRight, BookOpen } from 'lucide-react'
import {
  AnimatedSection,
  StaggerContainer,
  StaggerItem,
} from '@/components/dashboard/animated-section'
import { CourseCoverCard } from '@/components/dashboard/course-cover-card'
import type { MyCoursesProps } from '@/types/dashboard'
import { useTranslation } from '@/components/language-provider'

export function MyCoursesSection({ courses }: MyCoursesProps) {
  const { t } = useTranslation()
  if (courses.length === 0) return null

  const displayed = courses.slice(0, 3)

  return (
    <AnimatedSection delay={0.15}>
      <div className="space-y-4">
        {/* Section header */}
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="inline-flex items-center gap-2.5 font-heading text-lg font-bold tracking-tight text-foreground">
            <BookOpen className="h-4 w-4 text-primary" />
            {t('dashboard.nav.myCourses')}
          </h2>
          <Link
            href="/dashboard/my-courses"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            {t('common.viewAll')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Cover-card grid */}
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((item) => (
            <StaggerItem key={item.course.id}>
              <CourseCoverCard
                href={`/dashboard/course/${item.course.slug || item.course.id}`}
                title={item.course.title}
                thumbnailUrl={item.course.thumbnail_url}
                teacherName={item.teacherName}
                progress={{ pct: item.pct, label: item.nextLabel }}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </AnimatedSection>
  )
}
