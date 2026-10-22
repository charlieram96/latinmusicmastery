'use client'

// L2 top bar: crumb + title on the left, the lesson's parts in the middle
// (icon, label, 3px progress underline), streak / About & comments / Close on
// the right. Replaces LessonHeader + LessonPartsNav in lesson mode.

import { StudentFullscreenSlot } from '@/components/dashboard/dashboard-layout-client'
import { useEffect, useRef } from 'react'
import { useLearningMode } from '@/components/learning-mode/store'
import Link, { useLinkStatus } from 'next/link'
import { Loader2, Check, ChevronRight, MessageSquareText, X } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { HeaderStreakClient } from '@/components/dashboard/header-streak'
import { cn } from '@/lib/utils'
import type { CompletionStatus } from '@/lib/courses/lesson-completion'
import { partLabels, partProgress } from '@/lib/courses/lesson-parts'

export interface TopBarPart { id: string; title: string; item_type: string }


function PartNavigationStatus() {
  const { pending } = useLinkStatus()
  const { locale } = useTranslation()
  return pending ? <span role="status" aria-label={locale === 'es' ? 'Abriendo actividad' : 'Opening activity'}><Loader2 aria-hidden className="h-4 w-4 animate-spin text-primary" /></span> : null
}

export function LessonTopBar({ courseTitle, courseHref, moduleTitle, moduleHref, title, parts, activeIndex, completedItemIds,
  activeStatus, courseId, classId, streak, onOpenDrawer }: {
  courseTitle: string
  courseHref: string
  moduleTitle: string
  moduleHref: string
  title: string
  parts: TopBarPart[]
  activeIndex: number
  completedItemIds: string[]
  /** Save state of the active part this visit, for its underline. */
  activeStatus?: CompletionStatus
  courseId: string
  classId: string
  streak: number
  onOpenDrawer: () => void
}) {
  const { t } = useTranslation()
  const kids = useLearningMode() === 'kids'
  const labels = partLabels(parts, t)
  const partsRef = useRef<HTMLElement>(null)
  const activePartId = parts[activeIndex]?.id
  useEffect(() => {
    const nav = partsRef.current
    if (!nav) return
    const reveal = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="step"]')
      if (!active) return
      const bounds = nav.getBoundingClientRect()
      const item = active.getBoundingClientRect()
      if (item.left < bounds.left) nav.scrollLeft += item.left - bounds.left - 4
      else if (item.right > bounds.right) nav.scrollLeft += item.right - bounds.right + 4
    }
    reveal()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(reveal)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [activePartId])
  return <header data-lesson-top-bar className="lx-top">
    <div className="lx-title">
      <nav aria-label={t('dashboard.classViewer.lessonMode.crumbLabel')} className="lx-crumb">
        <Link href={courseHref}>{courseTitle}</Link>
        <ChevronRight aria-hidden className="h-3 w-3 shrink-0 opacity-60" />
        <Link href={moduleHref}>{moduleTitle}</Link>
      </nav>
      <h1 title={title}>{title}</h1>
    </div>

    {parts.length > 0 && <nav ref={partsRef} aria-label={t('dashboard.classViewer.lessonMode.partsLabel')} className="lx-parts">
      {parts.map((part, i) => {
        const done = completedItemIds.includes(part.id)
        const state = done ? 'done' : i === activeIndex ? 'active' : 'todo'
        const pct = partProgress(state, i === activeIndex ? activeStatus : undefined)
        return <Link key={part.id} aria-current={i === activeIndex ? 'step' : undefined} data-part-state={state} data-exercise={part.item_type === 'EXERCISE'} title={part.title}
          href={`/dashboard/course/${courseId}/class/${classId}?itemId=${encodeURIComponent(part.id)}`}
          className={cn('lx-part', i === activeIndex && 'lx-part-on')}>
          <span className="lx-part-heading">
            {kids && <span className="lx-world-icon" aria-hidden>{part.item_type === 'VIDEO' ? '🎬' : part.item_type === 'EXERCISE' ? '🥁' : part.item_type === 'QUIZ' ? '🧩' : '🎵'}</span>}
            {i === activeIndex && <Check data-active-tab-check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={3} />}
            <PartNavigationStatus />
            <span className="lx-part-label">{labels[i]}</span>
          </span>
          {part.item_type === 'EXERCISE' && <span className="lx-part-name">{part.title}</span>}
          {done && <span className="sr-only">{t('dashboard.classViewer.lessonMode.partDone')}</span>}
          <span data-part-progress aria-hidden className="lx-part-track"><i style={{ width: `${pct}%` }} /></span>
        </Link>
      })}
    </nav>}

    <div className="lx-right">
      <StudentFullscreenSlot />
      <span data-streak><HeaderStreakClient streak={streak} /></span>
      <button type="button" data-open-drawer onClick={onOpenDrawer} className="lx-icon-btn"
        aria-label={t('dashboard.classViewer.lessonMode.aboutAndComments')} title={t('dashboard.classViewer.lessonMode.aboutAndComments')}>
        <MessageSquareText aria-hidden className="h-[18px] w-[18px]" />
      </button>
      <Link href={courseHref} data-close-lesson className="lx-icon-btn" aria-label={t('dashboard.classViewer.lessonMode.closeLesson')}
        title={t('dashboard.classViewer.lessonMode.closeLesson')}>
        <X aria-hidden className="h-[18px] w-[18px]" />
      </Link>
    </div>
  </header>
}
