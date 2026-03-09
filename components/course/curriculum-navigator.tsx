'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { CheckCircle2, PlayCircle, Circle, Clock, BookOpen } from 'lucide-react'

interface CurriculumNavigatorProps {
  sections: any[]
  nextClassId: string | null
  courseId: string
  progressPercentage: number
  totalItems: number
  totalDurationMinutes: number
  hasStarted: boolean
  formatDuration: (mins: number) => string
}

export function CurriculumNavigator({
  sections,
  nextClassId,
  courseId,
  progressPercentage,
  totalItems,
  totalDurationMinutes,
  hasStarted,
  formatDuration,
}: CurriculumNavigatorProps) {
  const [hoveredLesson, setHoveredLesson] = useState<string | null>(null)

  const totalLessons = sections.reduce((acc: number, s: any) => acc + s.classes.length, 0)

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h3 className="text-lg font-heading font-bold mb-1">Curriculum</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {sections.length} module{sections.length !== 1 ? 's' : ''}
          </span>
          <span>&middot;</span>
          <span>{totalLessons} lesson{totalLessons !== 1 ? 's' : ''}</span>
          <span>&middot;</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(totalDurationMinutes)}
          </span>
        </div>
      </div>

      {/* Progress */}
      {hasStarted && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium">{progressPercentage}% complete</span>
          </div>
          <Progress value={progressPercentage} className="h-1.5" />
        </div>
      )}

      {/* Scrollable sections */}
      <div className="overflow-y-auto max-h-[calc(100vh-3rem)] scrollbar-thin">
        <Accordion
          type="multiple"
          defaultValue={sections.map((s: any) => s.id)}
          className="w-full space-y-1"
        >
          {sections.map((section: any, sectionIndex: number) => {
            const sectionComplete = section.completedItems === section.totalItems && section.totalItems > 0

            return (
              <AccordionItem
                key={section.id}
                value={section.id}
                className="border-none"
              >
                <AccordionTrigger className="hover:no-underline py-3 px-0">
                  <div className="flex items-center gap-3 text-left flex-1">
                    {/* Numbered badge or checkmark */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-muted">
                      {sectionComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <span className="text-muted-foreground">{sectionIndex + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm leading-tight block truncate">
                        {section.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {section.completedItems}/{section.totalItems} completed
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-0.5 ml-2 pb-2">
                    {section.classes.map((cls: any) => {
                      const isCompleted = cls.completedItems === cls.totalItems && cls.totalItems > 0
                      const isNext = nextClassId === cls.id

                      return (
                        <Link
                          key={cls.id}
                          href={`/dashboard/course/${courseId}/class/${cls.id}`}
                          className={`flex items-center gap-3 py-2 px-3 rounded-lg text-sm transition-all duration-150 ${
                            isNext
                              ? 'bg-primary/10 ring-1 ring-primary/20'
                              : isCompleted
                              ? 'text-muted-foreground'
                              : 'hover:bg-muted/50'
                          }`}
                          onMouseEnter={() => setHoveredLesson(cls.id)}
                          onMouseLeave={() => setHoveredLesson(null)}
                        >
                          {/* Status icon */}
                          <div className="flex-shrink-0">
                            {isCompleted ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : isNext ? (
                              <PlayCircle className="h-4 w-4 text-primary" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground/50" />
                            )}
                          </div>

                          {/* Title */}
                          <span className={`flex-1 truncate ${isNext ? 'font-medium text-foreground' : ''}`}>
                            {cls.title}
                          </span>

                          {/* Badge or item count */}
                          {isNext && !isCompleted ? (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5">
                              Next
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {cls.totalItems} item{cls.totalItems !== 1 ? 's' : ''}
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
    </div>
  )
}
