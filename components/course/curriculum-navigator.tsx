'use client'

import Link from 'next/link'
import { Progress } from '@/components/ui/progress'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Check, Play, BookOpen, Clock, Layers } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'

interface CurriculumNavigatorProps {
  sections: any[]
  nextClassId: string | null
  courseId: string
  progressPercentage: number
  totalItems: number
  totalDurationMinutes: number
  hasStarted: boolean
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remaining = mins % 60
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`
}

export function CurriculumNavigator({
  sections,
  nextClassId,
  courseId,
  progressPercentage,
  totalItems,
  totalDurationMinutes,
  hasStarted,
}: CurriculumNavigatorProps) {
  const { t } = useTranslation()
  const totalLessons = sections.reduce((acc: number, s: any) => acc + s.classes.length, 0)

  return (
    <div>
      {/* Header */}
      <h2 className="font-heading text-2xl font-extrabold tracking-[-0.02em] text-foreground">
        {t('dashboard.pages.course.curriculum.title')}
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 opacity-80" />
          {t(
            sections.length === 1
              ? 'dashboard.pages.course.moduleCountOne'
              : 'dashboard.pages.course.moduleCountOther',
            { count: sections.length },
          )}
        </span>
        <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/40" />
        <span className="inline-flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 opacity-80" />
          {t(
            totalLessons === 1
              ? 'dashboard.pages.course.lessonCountOne'
              : 'dashboard.pages.course.lessonCountOther',
            { count: totalLessons },
          )}
        </span>
        <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/40" />
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 opacity-80" />
          {formatDuration(totalDurationMinutes)}
        </span>
      </div>

      {/* Progress */}
      {hasStarted && (
        <div className="mb-5 mt-5">
          <div className="mb-1.5 text-sm font-medium text-foreground">
            {t('dashboard.pages.course.percentComplete', { percent: progressPercentage })}
          </div>
          <Progress value={progressPercentage} className="h-1.5" />
        </div>
      )}

      {/* Modules */}
      <Accordion
        type="multiple"
        defaultValue={sections.map((s: any) => s.id)}
        className="mt-5 flex w-full flex-col gap-3"
      >
        {sections.map((section: any, sectionIndex: number) => {
          const sectionComplete =
            section.completedItems === section.totalItems && section.totalItems > 0

          return (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="overflow-hidden rounded-[16px] border border-border bg-card"
            >
              <AccordionTrigger className="items-center gap-3.5 rounded-none px-4 py-4 hover:bg-muted/40 hover:no-underline">
                <span className="flex flex-1 items-center gap-3.5 text-left">
                  {/* Number badge or checkmark */}
                  <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-primary/15 font-heading text-sm font-bold text-primary">
                    {sectionComplete ? <Check className="h-4 w-4" /> : sectionIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-heading text-[15.5px] font-bold leading-tight tracking-[-0.01em] text-foreground">
                      {section.title}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
                      {t('dashboard.pages.course.curriculum.completed', {
                        completed: section.completedItems,
                        total: section.totalItems,
                      })}
                    </span>
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-2.5 pb-3 pt-0">
                <div className="flex flex-col gap-0.5">
                  {section.classes.map((cls: any) => {
                    const isCompleted =
                      cls.completedItems === cls.totalItems && cls.totalItems > 0
                    const isNext = nextClassId === cls.id

                    return (
                      <Link
                        key={cls.id}
                        href={`/dashboard/course/${courseId}/class/${cls.id}`}
                        className={`flex items-center gap-3 rounded-[11px] px-3 py-2.5 transition-colors ${
                          isNext
                            ? 'border border-primary/30 bg-primary/10'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        {/* Status dot */}
                        <span
                          className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border ${
                            isNext
                              ? 'border-primary bg-primary text-primary-foreground'
                              : isCompleted
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-muted-foreground/30 text-transparent'
                          }`}
                        >
                          {isNext ? (
                            <Play className="h-2.5 w-2.5 fill-current" />
                          ) : isCompleted ? (
                            <Check className="h-3 w-3" />
                          ) : null}
                        </span>

                        {/* Title */}
                        <span
                          className={`min-w-0 flex-1 truncate text-sm ${
                            isNext
                              ? 'font-semibold text-foreground'
                              : isCompleted
                              ? 'text-muted-foreground'
                              : 'font-medium text-foreground/90'
                          }`}
                        >
                          {cls.title}
                        </span>

                        {/* Badge or item count */}
                        {isNext ? (
                          <span className="flex-shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10.5px] font-bold tracking-[0.04em] text-primary-foreground">
                            {t('common.next')}
                          </span>
                        ) : (
                          <span className="flex-shrink-0 text-xs text-muted-foreground">
                            {t(
                              cls.totalItems === 1
                                ? 'dashboard.pages.course.itemCountOne'
                                : 'dashboard.pages.course.itemCountOther',
                              { count: cls.totalItems },
                            )}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </div>
  )
}
