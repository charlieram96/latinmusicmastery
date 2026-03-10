'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { CheckCircle2, Lock, PlayCircle } from 'lucide-react'

interface CourseTracklistProps {
  sections: any[]
  courseId: string
  nextClassId: string | null
  isStudent: boolean
  hasStarted: boolean
  progressPercentage: number
  totalItems: number
  totalDurationMinutes: number
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remaining = mins % 60
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`
}

export function CourseTracklist({
  sections,
  courseId,
  nextClassId,
  isStudent,
  hasStarted,
  progressPercentage,
  totalItems,
  totalDurationMinutes,
}: CourseTracklistProps) {
  const [hoveredTrack, setHoveredTrack] = useState<string | null>(null)

  let globalTrackNumber = 0

  return (
    <div>
      {/* Tracklist header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Course Content</p>
          <h2 className="text-2xl md:text-3xl font-heading font-bold">Tracklist</h2>
          <div className="w-12 h-0.5 bg-primary/40 rounded-full mt-3" />
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>{sections.length} section{sections.length !== 1 ? 's' : ''}</p>
          <p>{totalItems} track{totalItems !== 1 ? 's' : ''} &middot; {formatDuration(totalDurationMinutes)}</p>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={sections.map((s: any) => s.id)} className="w-full space-y-2">
        {sections.map((section: any, sectionIndex: number) => {
          const sectionProgress = section.totalItems > 0
            ? Math.round((section.completedItems / section.totalItems) * 100)
            : 0
          const sideLabel = sectionIndex < Math.ceil(sections.length / 2) ? 'Side A' : 'Side B'

          return (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="border border-border/50 rounded-xl overflow-hidden bg-card/30"
            >
              <AccordionTrigger className="hover:no-underline px-5 py-4">
                <div className="flex items-center gap-4 text-left flex-1">
                  {/* Progress Ring */}
                  <div className="relative h-10 w-10 flex-shrink-0">
                    <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-muted" strokeWidth="2" />
                      <circle
                        cx="18" cy="18" r="15.5" fill="none"
                        className={sectionProgress === 100 ? 'text-primary' : 'text-primary/60'}
                        strokeWidth="2"
                        strokeDasharray={`${sectionProgress} 100`}
                        strokeLinecap="round"
                        stroke="currentColor"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {sectionProgress === 100 ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <span className="text-[10px] font-bold">{sectionProgress}%</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{sideLabel}</span>
                    </div>
                    <span className="font-semibold text-base">{section.title}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {section.classes.length} track{section.classes.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-0.5 px-3 pb-3">
                  {section.classes.map((cls: any) => {
                    globalTrackNumber++
                    const trackNum = globalTrackNumber
                    const isCompleted = cls.completedItems === cls.totalItems && cls.totalItems > 0
                    const isLocked = !isStudent && !hasStarted
                    const isNext = nextClassId === cls.id
                    const isHovered = hoveredTrack === cls.id

                    return (
                      <div
                        key={cls.id}
                        className={`group flex items-center gap-4 p-3 rounded-lg transition-all duration-200 ${
                          isCompleted
                            ? 'bg-primary/5'
                            : isNext
                            ? 'bg-primary/10 border border-primary/20'
                            : 'hover:bg-warm-surface'
                        }`}
                        onMouseEnter={() => setHoveredTrack(cls.id)}
                        onMouseLeave={() => setHoveredTrack(null)}
                      >
                        {/* Track number / play icon */}
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          ) : isLocked ? (
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          ) : isHovered ? (
                            <PlayCircle className="w-5 h-5 text-primary transition-transform duration-200 scale-110" />
                          ) : (
                            <span className={`text-sm font-mono tabular-nums ${isNext ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                              {String(trackNum).padStart(2, '0')}
                            </span>
                          )}
                        </div>

                        {/* Track info */}
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium text-sm ${isNext ? 'text-primary' : ''}`}>
                            {cls.title}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {cls.totalItems} item{cls.totalItems !== 1 ? 's' : ''}
                            {cls.completedItems > 0 && ` \u00b7 ${cls.completedItems} done`}
                            {isNext && !isCompleted && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0 ml-1">Up Next</Badge>
                            )}
                          </div>
                        </div>

                        {/* Action */}
                        <Button
                          asChild
                          size="sm"
                          variant={isNext ? 'default' : 'ghost'}
                          className={isNext ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'}
                        >
                          <Link href={`/dashboard/course/${courseId}/class/${cls.id}`}>
                            {isCompleted ? 'Review' : isNext ? 'Start' : 'View'}
                          </Link>
                        </Button>
                      </div>
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
