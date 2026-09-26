'use client'

// The lesson's bottom bar (L2): the lesson's own message and main action, or
// whatever the current part put there with <LessonAction>. It also hosts the
// workspace layout switcher when a workspace is on screen.

import Link from 'next/link'
import { useEffect, useRef, type MouseEvent } from 'react'
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
  const barRef = useRef<HTMLElement | null>(null)
  const liveRef = useRef<HTMLSpanElement | null>(null)
  useActionBarA11y(barRef, liveRef)
  const nextText = !summary ? '' : summary.next === 'part' ? t('common.next')
    : summary.next === 'lesson' ? t('dashboard.classViewer.footer.nextLesson') : t('dashboard.classViewer.footer.backToCourse')

  return <footer ref={barRef} data-lesson-action-bar data-tone={tone} data-claimed={claimed} className="lx-action">
    {/* One live region for the bar's lifetime: parts swap the content, the region stays and reads the new message. */}
    <span ref={liveRef} data-action-live role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
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
      <ActionMessage
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

/**
 * Parts replace the bar's content as the student moves on (Check → Continue, a take → Part done).
 * Keep the screen reader told (the visible message is mirrored into the bar's own live region) and
 * keep the keyboard in place (when the focused control is swapped out, focus the new main action).
 */
function useActionBarA11y(barRef: { current: HTMLElement | null }, liveRef: { current: HTMLElement | null }) {
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    let focused: Element | null = null
    const sync = () => {
      const message = [...bar.querySelectorAll('.lx-msg')].find(m => !m.closest('[hidden]'))
      const clean = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
      const title = clean(message?.querySelector('b'))
      const detail = clean(message?.querySelector('.lx-msg-detail'))
      const text = [title, detail].filter(Boolean).map(part => /[.!?…]$/.test(part) ? part : `${part}.`).join(' ')
      const live = liveRef.current
      if (live && live.textContent !== text) live.textContent = text
      const lost = focused && !focused.isConnected
      if (!lost) return
      // A removed control is forgotten either way; focus only moves when it had nowhere else to go.
      focused = null
      const active = document.activeElement
      if (!active || active === document.body) {
        const next = bar.querySelector<HTMLElement>('[data-primary]:not(:disabled), [data-lesson-next]')
          ?? bar.querySelector<HTMLElement>('button:not(:disabled), a[href]')
        next?.focus({ preventScroll: true })
      }
    }
    const onFocusIn = (event: FocusEvent) => { focused = event.target as Element }
    // Focus that leaves for somewhere else is no longer the bar's to restore; a removed element keeps it.
    const timers = new Set<number>()
    const onFocusOut = (event: FocusEvent) => {
      const target = event.target as Element
      const id = window.setTimeout(() => {
        timers.delete(id)
        if (focused === target && target.isConnected && !bar.contains(document.activeElement)) focused = null
      }, 0)
      timers.add(id)
    }
    const observer = new MutationObserver(sync)
    observer.observe(bar, { childList: true, subtree: true, characterData: true })
    bar.addEventListener('focusin', onFocusIn)
    bar.addEventListener('focusout', onFocusOut)
    sync()
    return () => {
      observer.disconnect()
      bar.removeEventListener('focusin', onFocusIn)
      bar.removeEventListener('focusout', onFocusOut)
      timers.forEach(id => window.clearTimeout(id))
    }
  }, [barRef, liveRef])
}
