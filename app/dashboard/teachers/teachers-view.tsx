'use client'

import { useMemo, useState } from 'react'
import { BookOpen, GraduationCap, Music } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { EmptyState } from '@/components/dashboard/empty-state'
import { FilterChip } from '@/components/dashboard/filter-chip'
import { TeacherCard } from '@/components/dashboard/teacher-card'
import { splitInstruments, type TeacherCardData } from '@/lib/dashboard/teachers'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'

interface TeachersViewProps {
  teachersWithCourses: TeacherCardData[]
  totalTeachers: number
  totalCourses: number
  uniqueInstruments: number
}

export function TeachersView({ teachersWithCourses, totalTeachers, totalCourses, uniqueInstruments }: TeachersViewProps) {
  const { t } = useTranslation()
  const [instrument, setInstrument] = useState<string | null>(null)

  const instruments = useMemo(() => {
    const counts = new Map<string, number>()
    for (const teacher of teachersWithCourses) {
      for (const name of splitInstruments(teacher.instrument)) counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name)
  }, [teachersWithCourses])

  const visible = instrument
    ? teachersWithCourses.filter((teacher) => splitInstruments(teacher.instrument).includes(instrument))
    : teachersWithCourses

  const stats = [
    { icon: GraduationCap, label: t('dashboard.pages.teachers.stats.experts', { count: totalTeachers }) },
    { icon: BookOpen, label: t('dashboard.pages.teachers.stats.courses', { count: totalCourses }) },
    { icon: Music, label: t('dashboard.pages.teachers.stats.instruments', { count: uniqueInstruments }) },
  ]

  return (
    <>
      <PageHeader title={t('dashboard.pages.teachers.title')} description={t('dashboard.pages.teachers.subtitle')}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {stats.map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" aria-hidden />
              <span className="tabular-nums">{label}</span>
            </span>
          ))}
        </div>
      </PageHeader>

      {teachersWithCourses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={t('dashboard.pages.teachers.empty.title')}
          body={t('dashboard.pages.teachers.empty.subtitle')}
        />
      ) : (
        <>
          {instruments.length > 1 ? (
            <div role="group" aria-label={t('dashboard.pages.teachers.filters.label')} className="mb-6 flex flex-wrap gap-2">
              <FilterChip active={instrument === null} onClick={() => setInstrument(null)}>
                {t('dashboard.pages.teachers.filters.all')}
              </FilterChip>
              {instruments.map((name) => (
                <FilterChip key={name} active={instrument === name} onClick={() => setInstrument(name)}>
                  {name}
                </FilterChip>
              ))}
            </div>
          ) : null}

          {visible.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {visible.map((teacher) => (
                <TeacherCard key={teacher.id} teacher={teacher} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Music}
              title={t('dashboard.pages.teachers.noMatch.title', { instrument: instrument ?? '' })}
              body={t('dashboard.pages.teachers.noMatch.body')}
              action={
                <Button variant="outline" onClick={() => setInstrument(null)}>
                  {t('dashboard.pages.teachers.filters.showAll')}
                </Button>
              }
            />
          )}
        </>
      )}
    </>
  )
}
