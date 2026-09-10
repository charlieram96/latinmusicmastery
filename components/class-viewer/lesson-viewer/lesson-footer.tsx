'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight, Check, Circle, Loader2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { useLessonProgress } from './lesson-progress-context'
import styles from './lesson-viewer.module.css'

export interface LessonFooterProps {
  courseId: string
  classId: string
  currentIndex: number
  totalItems: number
  itemIds: string[]
  completedItemIds: string[]
  nextClassId: string | null
  activeItemId: string | null
  activeItemType: string | null
  isCompleted: boolean
  nextLabel?: string | null
}

const COMPLETED_LABELS: Record<string, string> = {
  VIDEO: 'videoComplete', QUIZ: 'quizComplete', EXERCISE: 'exerciseComplete', JAM_SESSION: 'jamComplete',
}

/** Completion status replaces manual marking; the next destination becomes the CTA. */
export function LessonFooter({ courseId, classId, currentIndex, totalItems, itemIds, completedItemIds,
  nextClassId, activeItemId, activeItemType, isCompleted, nextLabel }: LessonFooterProps) {
  const { t } = useTranslation()
  const progress = useLessonProgress()
  const state = activeItemId ? progress?.items[activeItemId] : undefined
  const completed = (progress?.completedItemIds ?? completedItemIds).filter(id => itemIds.includes(id))
  const done = isCompleted || !!activeItemId && completed.includes(activeItemId)
  const lessonDone = totalItems > 0 && completed.length === totalItems
  const saving = !done && state?.status === 'saving'
  const error = !done && state?.status === 'error'
  const partial = !done && !saving && !error && state?.activities.length
  const hasNext = currentIndex < totalItems - 1
  const prevHref = currentIndex > 0 ? `/dashboard/course/${courseId}/class/${classId}?item=${currentIndex - 1}` : null
  const nextHref = hasNext ? `/dashboard/course/${courseId}/class/${classId}?item=${currentIndex + 1}`
    : nextClassId ? `/dashboard/course/${courseId}/class/${nextClassId}` : `/dashboard/course/${courseId}`
  const nextText = hasNext ? t('common.next') : nextClassId ? t('dashboard.classViewer.footer.nextLesson') : t('dashboard.classViewer.footer.backToCourse')
  const label = lessonDone ? 'lessonComplete' : done ? COMPLETED_LABELS[activeItemType ?? ''] ?? 'partComplete'
    : saving ? 'savingProgress' : error ? 'saveFailed'
      : partial ? state.activities.includes('performance') ? 'practiceComplete' : 'questionsComplete'
        : 'inProgress'
  const detail = partial
    ? t(`dashboard.classViewer.footer.${state.activities.includes('performance') ? 'finishQuestions' : 'finishPractice'}`)
    : done && (hasNext || nextClassId)
      ? nextLabel ? t('dashboard.classViewer.footer.upNext', { title: nextLabel }) : t('dashboard.classViewer.footer.readyToContinue')
      : t('dashboard.classViewer.footer.partsCompleted', { count: completed.length, total: totalItems })

  return <div data-lesson-completion-bar data-completed={done}
    className={cn(styles.footer, 'fixed bottom-0 right-0 z-40 flex h-[68px] items-center gap-3 border-t border-border bg-sunken/95 px-4 backdrop-blur-xl md:gap-5 md:px-8')}>
    <div role="progressbar" aria-label={t('dashboard.classViewer.footer.lessonProgress')} aria-valuemin={0} aria-valuemax={totalItems || 1} aria-valuenow={completed.length}
      className="absolute inset-x-0 top-0 h-[2px] overflow-hidden bg-primary/5">
      <div className="h-full origin-left bg-primary transition-transform duration-500 motion-reduce:transition-none" style={{ transform: `scaleX(${totalItems ? completed.length / totalItems : 0})` }} />
    </div>
    {prevHref && <Link href={prevHref} aria-label={t('dashboard.pages.modules.previous')}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg p-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <ChevronLeft aria-hidden className="h-4 w-4" /><span className="hidden xl:inline">{t('dashboard.pages.modules.previous')}</span>
    </Link>}
    <div className="flex min-w-0 flex-1 items-center gap-3" role="status" aria-live="polite" aria-atomic="true">
      <span aria-hidden className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full border', done ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
        {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : saving ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : <Circle className="h-3 w-3" />}
      </span>
      <div className="min-w-0">
        <p className={cn('truncate text-[13px] font-semibold', done ? 'text-primary' : 'text-foreground')}>{t(`dashboard.classViewer.footer.${label}`)}</p>
        <p className="truncate text-[11px] text-muted-foreground">{detail}</p>
      </div>
    </div>
    {error && activeItemId && <button onClick={() => progress?.retry(activeItemId)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg p-2 text-xs text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring">
      <RotateCcw className="h-3.5 w-3.5" />{t('dashboard.classViewer.footer.retrySaving')}
    </button>}
    <Link href={nextHref} data-lesson-next data-ready={done}
      className={cn('group inline-flex h-[40px] shrink-0 items-center gap-2 rounded-xl border px-4 text-[13px] font-semibold transition-[background-color,color,border-color,box-shadow] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        done ? 'border-primary/70 bg-primary text-primary-foreground shadow-[0_0_22px_hsl(var(--primary)/.22)] hover:bg-primary/90' : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground')}>
      {nextText}<ChevronRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
    </Link>
  </div>
}
