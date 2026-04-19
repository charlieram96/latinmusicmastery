'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { BookOpen, ArrowRight } from 'lucide-react'
import { MyCoursesFilters } from '@/components/dashboard/my-courses-filters'
import { MyCourseCard } from '@/components/dashboard/my-course-card'
import { useTranslation } from '@/components/language-provider'

interface MyCoursesViewProps {
  enrolledCourses: any[]
  counts: {
    all: number
    inProgress: number
    completed: number
  }
  filter: 'all' | 'in-progress' | 'completed'
}

export function MyCoursesView({ enrolledCourses, counts, filter }: MyCoursesViewProps) {
  const { t } = useTranslation()

  const emptyTitle =
    filter === 'completed'
      ? t('dashboard.pages.myCourses.empty.completedTitle')
      : filter === 'in-progress'
        ? t('dashboard.pages.myCourses.empty.inProgressTitle')
        : t('dashboard.pages.myCourses.empty.allTitle')

  const emptyBody =
    filter === 'completed'
      ? t('dashboard.pages.myCourses.empty.completedBody')
      : filter === 'in-progress'
        ? t('dashboard.pages.myCourses.empty.inProgressBody')
        : t('dashboard.pages.myCourses.empty.allBody')

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-heading mb-2">{t('dashboard.pages.myCourses.title')}</h1>
        <p className="text-muted-foreground">
          {t('dashboard.pages.myCourses.subtitle')}
        </p>
      </div>

      {/* Filters & Sort */}
      <MyCoursesFilters counts={counts} />

      {/* Courses */}
      {enrolledCourses.length > 0 ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {enrolledCourses.map((course: any, index: number) => (
            <MyCourseCard key={course.id} course={course} index={index} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <Card className="mt-8">
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{emptyTitle}</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">{emptyBody}</p>
            <Button asChild>
              <Link href="/dashboard/courses">
                {t('dashboard.pages.myCourses.browseCourses')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  )
}
