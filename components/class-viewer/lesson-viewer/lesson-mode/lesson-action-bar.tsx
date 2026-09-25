'use client'

// The lesson's bottom bar (L2): the lesson's own message and main action, or
// whatever the current part put there with <LessonAction>. It also hosts the
// workspace layout switcher when a workspace is on screen.

import Link from 'next/link'
import type { MouseEvent } from 'react'
import { AlertTriangle, ArrowRight, Check, ChevronLeft, Loader2, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'
import { summarizeLessonProgress, type LessonProgressInput } from '@/lib/courses/lesson-progress-summary'
import { useLessonProgress } from '../lesson-progress-context'
import { ActionMessage, type ActionTone } from './lesson-frame'
import './lesson-mode.css'

export function LessonActionBar({ progress, claimed, tone, onActionHost, onToolsHost, onPrimary, primaryLabel }: {
  progress: LessonProgressInput | null
  claimed: boolean
  tone: ActionTone
  onActionHost: (el: HTMLElement | null) => void
  onToolsHost: (el: HTMLElement | null) => void
  /** The shell may turn "next" into the lesson celebration (it calls preventDefault). */
  onPrimary: (event: MouseEvent<HTMLAnchorElement>) => void
  primaryLabel?: string | null
}) {
  const { t } = useTranslation()
  const live = useLessonProgress()
  const summary = progress
    ? summarizeLessonProgress(progress, { completedItemIds: live?.completedItemIds, item: progress.activeItemId ? live?.items[progress.activeItemId] : undefined })
    : null
  const total = progress?.totalItems ?? 0
  const nextText = !summary ? '' : summary.next === 'part' ? t('common.next')
    : summary.next === 'lesson' ? t('dashboard.classViewer.footer.nextLesson') : t('dashboard.classViewer.footer.backToCourse')

  return <footer data-lesson-action-bar data-tone={tone} data-claimed={claimed} className="lx-action">
    {summary && <div role="progressbar" aria-label={t('dashboard.classViewer.footer.lessonProgress')} aria-valuemin={0}
      aria-valuemax={total || 1} aria-valuenow={summary.completedCount} className="lx-action-progress">
      <i style={{ transform: `scaleX(${total ? summary.completedCount / total : 0})` }} />
    </div>}
    <div data-ws-tools ref={onToolsHost} className="lx-action-tools" />
    <div data-action-host ref={onActionHost} className="lx-action-host" hidden={!claimed} />
    {!claimed && summary && progress && <>
      {summary.prevHref && <Link href={summary.prevHref} aria-label={t('dashboard.pages.modules.previous')} className="lx-action-prev">
        <ChevronLeft aria-hidden className="h-4 w-4" />
      </Link>}
      <ActionMessage live
        icon={summary.done ? <Check className="h-5 w-5" strokeWidth={3} /> : summary.saving
          ? <Loader2 className="h-5 w-5 motion-safe:animate-spin" /> : summary.error ? <AlertTriangle className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        title={t(`dashboard.classViewer.footer.${summary.label}`)}
        detail={t(`dashboard.classViewer.footer.${summary.detail.key}`, summary.detail.params)} />
      {summary.error && progress.activeItemId && <Button type="button" variant="ghost" size="sm" onClick={() => live?.retry(progress.activeItemId!)}>
        <RotateCcw className="h-3.5 w-3.5" />{t('dashboard.classViewer.footer.retrySaving')}
      </Button>}
      <Button asChild variant={summary.done ? 'chunky' : 'chunky-ghost'} className="lx-primary">
        <Link href={summary.nextHref} data-lesson-next data-ready={summary.done} onClick={onPrimary}>
          {primaryLabel ?? nextText}<ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </Button>
    </>}
  </footer>
}
