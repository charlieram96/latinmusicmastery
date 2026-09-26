'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight, Check, Circle, Loader2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { useLessonProgress } from './lesson-progress-context'
import { summarizeLessonProgress, type LessonProgressInput } from '@/lib/courses/lesson-progress-summary'
import styles from './lesson-viewer.module.css'

export type LessonFooterProps = LessonProgressInput

/** Completion status replaces manual marking; the next destination becomes the CTA. */
export function LessonFooter(props: LessonFooterProps) {
  const { totalItems, activeItemId } = props
  const { t } = useTranslation()
  const progress = useLessonProgress()
  const s = summarizeLessonProgress(props, { completedItemIds: progress?.completedItemIds, item: activeItemId ? progress?.items[activeItemId] : undefined })
  const { done, saving, error, prevHref, nextHref } = s
  const nextText = s.next === 'part' ? t('common.next') : s.next === 'lesson' ? t('dashboard.classViewer.footer.nextLesson') : t('dashboard.classViewer.footer.backToCourse')
  const label = s.label
  const detail = t(`dashboard.classViewer.footer.${s.detail.key}`, s.detail.params)

  return <div data-lesson-completion-bar data-completed={done}
    className={cn(styles.footer, 'fixed bottom-0 right-0 z-40 flex h-[68px] items-center gap-3 border-t border-border bg-sunken/95 px-4 backdrop-blur-xl md:gap-5 md:px-8')}>
    <div role="progressbar" aria-label={t('dashboard.classViewer.footer.lessonProgress')} aria-valuemin={0} aria-valuemax={totalItems || 1} aria-valuenow={s.completedCount}
      className="absolute inset-x-0 top-0 h-[2px] overflow-hidden bg-primary/5">
      <div className="h-full origin-left bg-primary transition-transform duration-500 motion-reduce:transition-none" style={{ transform: `scaleX(${totalItems ? s.completedCount / totalItems : 0})` }} />
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
