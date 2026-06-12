'use client'

// Full-width parts stepper — one entry per class item, chevron-separated,
// with a state dot (done / active / upcoming), sublabels, and an underline
// beneath the active item. Switching items uses the existing ?item= query
// param. Replaces the old ClassStepIndicator.

import Link from 'next/link'
import { ChevronRight, Check, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import styles from './lesson-viewer.module.css'

export interface LessonPart {
  id: string
  title: string
  item_type: string
}

interface LessonPartsNavProps {
  items: LessonPart[]
  activeIndex: number
  completedItemIds: string[]
  courseId: string
  classId: string
}

const TYPE_LABEL: Record<string, string> = {
  VIDEO: 'Lesson',
  QUIZ: 'Quiz',
  EXERCISE: 'Exercise',
  JAM_SESSION: 'Jam session',
}

// Build friendly labels, numbering repeated types (Exercise 1, Exercise 2…).
function buildLabels(items: LessonPart[]) {
  const counts: Record<string, number> = {}
  const totals: Record<string, number> = {}
  for (const it of items) totals[it.item_type] = (totals[it.item_type] ?? 0) + 1
  return items.map((it) => {
    const base = TYPE_LABEL[it.item_type] ?? it.item_type
    counts[it.item_type] = (counts[it.item_type] ?? 0) + 1
    const label =
      totals[it.item_type] > 1 ? `${base} ${counts[it.item_type]}` : base
    return label
  })
}

export function LessonPartsNav({
  items,
  activeIndex,
  completedItemIds,
  courseId,
  classId,
}: LessonPartsNavProps) {
  if (items.length === 0) return null
  const labels = buildLabels(items)

  return (
    <nav
      aria-label="Lesson parts"
      className={cn('flex items-stretch border-y border-border bg-sunken', styles.rise)}
      style={{ animationDelay: '40ms' }}
    >
      <div
        className={cn(
          styles.scrollHide,
          styles.snapX,
          'flex flex-1 items-stretch gap-1 overflow-x-auto pl-4 pr-5 md:pl-8'
        )}
        role="tablist"
      >
        {items.map((item, i) => {
          const isActive = i === activeIndex
          const done = completedItemIds.includes(item.id)
          return (
            <div key={item.id} className={cn('flex items-stretch', styles.snapStart)}>
              {i > 0 && (
                <span
                  aria-hidden
                  className="flex flex-shrink-0 items-center px-2 text-border"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              )}
              <Link
                href={`/dashboard/course/${courseId}/class/${classId}?item=${i}`}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  'group relative flex flex-shrink-0 items-center gap-2.5 px-2.5 py-4 transition-colors',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                )}
              >
                {done ? (
                  <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-success">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </span>
                ) : isActive ? (
                  <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-primary ring-4 ring-primary/15">
                    <Play className="ml-px h-2 w-2 text-white" fill="#fff" />
                  </span>
                ) : (
                  <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full border-2 border-border font-heading text-[10px] font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                )}
                <span className="flex min-w-0 flex-col gap-0.5 leading-[1.15]">
                  <span className="whitespace-nowrap font-heading text-[13.5px] font-bold tracking-[-0.005em]">
                    {labels[i]}
                  </span>
                  <span
                    className={cn(
                      'max-w-[180px] truncate whitespace-nowrap text-[11.5px] font-normal',
                      isActive ? 'text-foreground/70' : 'text-muted-foreground'
                    )}
                  >
                    {item.title}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-2 -bottom-px h-[3px] origin-left rounded-t-full bg-primary transition-transform duration-200',
                    isActive
                      ? 'scale-x-100'
                      : 'scale-x-0 bg-primary/40 group-hover:scale-x-100'
                  )}
                />
              </Link>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
