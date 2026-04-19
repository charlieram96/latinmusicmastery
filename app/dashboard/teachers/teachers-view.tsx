'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Music, GraduationCap, BookOpen } from 'lucide-react'
import { TeacherCard } from '@/components/dashboard/teacher-card'
import { useTranslation } from '@/components/language-provider'

interface TeachersViewProps {
  teachersWithCourses: any[]
  totalTeachers: number
  totalCourses: number
  uniqueInstruments: number
}

export function TeachersView({
  teachersWithCourses,
  totalTeachers,
  totalCourses,
  uniqueInstruments,
}: TeachersViewProps) {
  const { t } = useTranslation()

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-heading mb-2">{t('dashboard.pages.teachers.title')}</h1>
        <p className="text-muted-foreground mb-6">
          {t('dashboard.pages.teachers.subtitle')}
        </p>

        {/* Quick Stats */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="font-semibold">{t('dashboard.pages.teachers.stats.experts', { count: totalTeachers })}</span>
          </div>
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-semibold">{t('dashboard.pages.teachers.stats.courses', { count: totalCourses })}</span>
          </div>
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2">
            <Music className="h-5 w-5 text-primary" />
            <span className="font-semibold">{t('dashboard.pages.teachers.stats.instruments', { count: uniqueInstruments })}</span>
          </div>
        </div>
      </div>

      {/* Teachers Grid */}
      {teachersWithCourses.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {teachersWithCourses.map((teacher) => (
            <TeacherCard key={teacher.id} teacher={teacher} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <Card>
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('dashboard.pages.teachers.empty.title')}</h3>
            <p className="text-muted-foreground">
              {t('dashboard.pages.teachers.empty.subtitle')}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
