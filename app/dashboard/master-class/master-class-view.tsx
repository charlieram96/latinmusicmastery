'use client'

import { PageHeader } from '@/components/dashboard/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Crown, GraduationCap, Music } from 'lucide-react'
import { MasterClassCard } from '@/components/dashboard/master-class-card'
import { useTranslation } from '@/components/language-provider'

interface MasterClassViewProps {
  masterClasses: any[]
  totalClasses: number
  uniqueTeachers: number
  uniqueInstruments: number
}

export function MasterClassView({
  masterClasses,
  totalClasses,
  uniqueTeachers,
  uniqueInstruments,
}: MasterClassViewProps) {
  const { t } = useTranslation()

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <PageHeader
          title={t('dashboard.pages.masterClass.title')}
          description={t('dashboard.pages.masterClass.subtitle')}
          className="mb-6"
        />

        {/* Quick Stats */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2">
            <Crown className="h-5 w-5 text-primary" />
            <span className="font-semibold">
              {totalClasses === 1
                ? t('dashboard.pages.masterClass.stats.classOne', { count: totalClasses })
                : t('dashboard.pages.masterClass.stats.classOther', { count: totalClasses })}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="font-semibold">
              {uniqueTeachers === 1
                ? t('dashboard.pages.masterClass.stats.teacherOne', { count: uniqueTeachers })
                : t('dashboard.pages.masterClass.stats.teacherOther', { count: uniqueTeachers })}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2">
            <Music className="h-5 w-5 text-primary" />
            <span className="font-semibold">
              {uniqueInstruments === 1
                ? t('dashboard.pages.masterClass.stats.instrumentOne', { count: uniqueInstruments })
                : t('dashboard.pages.masterClass.stats.instrumentOther', { count: uniqueInstruments })}
            </span>
          </div>
        </div>
      </div>

      {/* Master Classes Grid */}
      {masterClasses.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {masterClasses.map((course) => (
            <MasterClassCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <Card>
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Crown className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('dashboard.pages.masterClass.empty.title')}</h3>
            <p className="text-muted-foreground">
              {t('dashboard.pages.masterClass.empty.subtitle')}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
