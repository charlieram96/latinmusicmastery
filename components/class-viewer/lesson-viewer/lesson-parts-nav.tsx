'use client'

// Full-width parts navigator — one entry per class item, chevron-separated,
// with sublabels and an underline beneath the active item. Replaces the old
// ClassStepIndicator. Switching items uses the existing ?item= query param.

import Link from 'next/link'
import { ChevronRight, Check } from 'lucide-react'
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
      className="flex items-stretch border-y border-border bg-[hsl(0_0%_4%)]"
    >
      <div
        className={cn(
          styles.scrollHide,
          'flex flex-1 items-stretch gap-1 overflow-x-auto pl-8 pr-5'
        )}
        role="tablist"
      >
        {items.map((item, i) => {
          const isActive = i === activeIndex
          const done = completedItemIds.includes(item.id)
          return (
            <div key={item.id} className="flex items-stretch">
              {i > 0 && (
                <span
                  aria-hidden
                  className="flex flex-shrink-0 items-center px-1 text-muted-foreground opacity-50"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              )}
              <Link
                href={`/dashboard/course/${courseId}/class/${classId}?item=${i}`}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  'relative flex flex-shrink-0 items-center gap-2.5 px-2.5 py-4 transition-colors',
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {done && (
                  <span className="grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded-full bg-green-700">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </span>
                )}
                <span className="flex min-w-0 flex-col gap-0.5 leading-[1.15]">
                  <span className="whitespace-nowrap text-[14.5px] font-semibold tracking-[-0.005em]">
                    {labels[i]}
                  </span>
                  <span
                    className={cn(
                      'whitespace-nowrap text-xs font-normal',
                      isActive ? 'text-[hsl(0_0%_70%)]' : 'text-muted-foreground'
                    )}
                  >
                    {item.title}
                  </span>
                </span>
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-t-sm bg-primary"
                  />
                )}
              </Link>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
