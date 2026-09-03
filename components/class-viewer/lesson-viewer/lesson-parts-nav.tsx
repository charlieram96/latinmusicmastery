'use client'

// Full-width parts stepper — one entry per class item, chevron-separated,
// with a state dot (done / active / upcoming), sublabels, and an underline
// beneath the active item. Switching items uses the existing ?item= query
// param. Replaces the old ClassStepIndicator.

import Link from 'next/link'
import { ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
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

const TYPE_LABEL_KEY: Record<string, string> = {
  VIDEO: 'dashboard.classViewer.itemTypes.lesson',
  QUIZ: 'dashboard.pages.modules.quiz',
  EXERCISE: 'dashboard.pages.modules.exercise',
  JAM_SESSION: 'dashboard.classViewer.itemTypes.jamSession',
}

// Build friendly labels, numbering repeated types (Exercise 1, Exercise 2…).
function buildLabels(items: LessonPart[], t: (key: string) => string) {
  const counts: Record<string, number> = {}
  const totals: Record<string, number> = {}
  for (const it of items) totals[it.item_type] = (totals[it.item_type] ?? 0) + 1
  return items.map((it) => {
    const key = TYPE_LABEL_KEY[it.item_type]
    const base = key ? t(key) : it.item_type
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
  const { t } = useTranslation()
  if (items.length === 0) return null
  const labels = buildLabels(items, t)

  return (
    <nav
      aria-label={t('dashboard.classViewer.partsNav.ariaLabel')}
      className={cn('mt-[10px] flex items-stretch bg-sunken', styles.rise)}
      style={{ animationDelay: '40ms' }}
    >
      <div
        className={cn(
          styles.scrollHide,
          'flex flex-1 items-stretch gap-1 overflow-hidden pl-1 pr-5 md:pl-5'
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
                  'group relative flex flex-shrink-0 flex-col gap-0.5 px-3 py-3.5 leading-[1.2] transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                )}
              >
                <span className="flex items-center gap-1.5 whitespace-nowrap font-heading text-[13.5px] font-bold tracking-[-0.005em]">
                  {labels[i]}
                  {done && (
                    <Check
                      className="h-3 w-3 text-success"
                      aria-label={t('dashboard.pages.modules.completed')}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    'max-w-[200px] truncate whitespace-nowrap text-[11.5px] font-normal',
                    isActive ? 'text-foreground/75' : 'text-muted-foreground/80'
                  )}
                >
                  {item.title}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-3 -bottom-px h-[2.5px] origin-left rounded-full bg-primary transition-transform duration-200',
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
