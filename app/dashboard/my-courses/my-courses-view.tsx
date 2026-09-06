'use client'

import Link from 'next/link'
import { ArrowRight, BookOpen, Compass } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { EmptyState } from '@/components/dashboard/empty-state'
import { MyCourseRow } from '@/components/dashboard/my-course-row'
import { MyCoursesToolbar, type MyCoursesFilter, type MyCoursesSort } from '@/components/dashboard/my-courses-toolbar'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import type { MyCourseRow as MyCourseRowData } from '@/types/dashboard'

interface MyCoursesViewProps {
  courses: MyCourseRowData[]
  counts: { all: number; inProgress: number; completed: number }
  filter: MyCoursesFilter
  sort: MyCoursesSort
}

export function MyCoursesView({ courses, counts, filter, sort }: MyCoursesViewProps) {
  const { t } = useTranslation()

  const emptyKey = filter === 'completed' ? 'completed' : filter === 'in-progress' ? 'inProgress' : 'all'

  return (
    <>
      <PageHeader
        title={t('dashboard.pages.myCourses.title')}
        description={t('dashboard.pages.myCourses.subtitle')}
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/courses">
              <Compass aria-hidden />
              {t('dashboard.pages.myCourses.browseCourses')}
            </Link>
          </Button>
        }
      >
        {counts.all > 0 ? <MyCoursesToolbar counts={counts} filter={filter} sort={sort} /> : null}
      </PageHeader>

      {courses.length > 0 ? (
        <div className="divide-y divide-border border-y border-border">
          {courses.map((course) => (
            <MyCourseRow key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title={t(`dashboard.pages.myCourses.empty.${emptyKey}Title`)}
          body={t(`dashboard.pages.myCourses.empty.${emptyKey}Body`)}
          action={
            filter === 'all' ? (
              <Button asChild>
                <Link href="/dashboard/courses">
                  {t('dashboard.pages.myCourses.browseCourses')}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/dashboard/my-courses">{t('dashboard.pages.myCourses.filters.showAll')}</Link>
              </Button>
            )
          }
        />
      )}
    </>
  )
}
