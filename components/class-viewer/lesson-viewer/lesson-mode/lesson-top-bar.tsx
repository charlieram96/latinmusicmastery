'use client'

// L2 top bar: crumb + title on the left, the lesson's parts in the middle
// (icon, label, 3px progress underline), streak / About & comments / Close on
// the right. Replaces LessonHeader + LessonPartsNav in lesson mode.

import Link from 'next/link'
import { BookOpen, Check, ChevronRight, ListChecks, MessageSquareText, Music2, Video, X } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { HeaderStreakClient } from '@/components/dashboard/header-streak'
import { cn } from '@/lib/utils'
import type { CompletionStatus } from '@/lib/courses/lesson-completion'
import { partKind, partLabels, partProgress, type PartKind } from '@/lib/courses/lesson-parts'

export interface TopBarPart { id: string; title: string; item_type: string }

const ICON: Record<PartKind, typeof Video> = { video: Video, play: Music2, quiz: ListChecks, other: BookOpen }

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
  const labels = partLabels(parts, t)
  return <header data-lesson-top-bar className="lx-top">
    <div className="lx-title">
      <nav aria-label={t('dashboard.classViewer.lessonMode.crumbLabel')} className="lx-crumb">
        <Link href={courseHref}>{courseTitle}</Link>
        <ChevronRight aria-hidden className="h-3 w-3 shrink-0 opacity-60" />
        <Link href={moduleHref}>{moduleTitle}</Link>
      </nav>
      <h1 title={title}>{title}</h1>
    </div>

    {parts.length > 0 && <nav aria-label={t('dashboard.classViewer.lessonMode.partsLabel')} className="lx-parts">
      {parts.map((part, i) => {
        const done = completedItemIds.includes(part.id)
        const state = done ? 'done' : i === activeIndex ? 'active' : 'todo'
        const Icon = done ? Check : ICON[partKind(part.item_type)]
        const pct = partProgress(state, i === activeIndex ? activeStatus : undefined)
        return <Link key={part.id} aria-current={i === activeIndex ? 'step' : undefined} data-part-state={state} title={part.title}
          href={`/dashboard/course/${courseId}/class/${classId}?item=${i}`}
          className={cn('lx-part', i === activeIndex && 'lx-part-on')}>
          <Icon aria-hidden className="h-4 w-4 shrink-0" strokeWidth={done ? 3 : 2} />
          <span className="lx-part-label">{labels[i]}</span>
          {done && <span className="sr-only">{t('dashboard.classViewer.lessonMode.partDone')}</span>}
          <span data-part-progress aria-hidden className="lx-part-track"><i style={{ width: `${pct}%` }} /></span>
        </Link>
      })}
    </nav>}

    <div className="lx-right">
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
