'use client'

// L2 lesson rail: 72px, expanding to 300px over the page on hover or keyboard
// focus (like the dashboard rail). Logo back to the course, the module's
// progress ring, the module's lessons as 3D nodes on a vertical connector, and
// the lesson settings (theme, language) at the bottom. Hidden on phones, where
// the drawer's Lessons tab lists the same nodes.

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Check, Lock, Play } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageToggle } from '@/components/language-toggle'
import { cn } from '@/lib/utils'
import type { RailLesson } from '@/lib/courses/lesson-rail'

export function ProgressRing({ done, total, size = 40 }: { done: number; total: number; size?: number }) {
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = total > 0 ? done / total : 0
  return <span data-module-ring className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
    <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" className="stroke-primary"
        strokeDasharray={`${c * pct} ${c}`} />
    </svg>
    <b className="relative text-[10px] font-extrabold tabular-nums">{done}/{total}</b>
  </span>
}

export function LessonRailList({ lessons, open = false }: { lessons: RailLesson[]; open?: boolean }) {
  const { t } = useTranslation()
  return <ol className={cn('lx-list', open && 'lx-list-open')}>
    {lessons.map(lesson => <li key={lesson.id}>
      <Link href={lesson.href} data-rail-lesson data-state={lesson.state} aria-current={lesson.state === 'current' ? 'page' : undefined}
        className="lx-ls" title={lesson.title}>
        <span className="lx-dot" aria-hidden>
          {lesson.state === 'done' ? <Check className="h-4 w-4" strokeWidth={3} />
            : lesson.state === 'current' ? <Play className="ml-0.5 h-4 w-4" fill="currentColor" /> : lesson.number}
        </span>
        <span className="lx-lt">
          <b>{lesson.title}</b>
          <small>
            {t(`dashboard.classViewer.lessonMode.rail.kind.${lesson.kind}`)}
            {lesson.minutes != null && <> · {t('dashboard.classViewer.lessonMode.rail.minutes', { count: lesson.minutes })}</>}
          </small>
        </span>
        {lesson.paywalled && <Lock data-paywalled aria-label={t('dashboard.classViewer.lessonMode.rail.paywalled')} className="lx-lock h-3.5 w-3.5 shrink-0" />}
      </Link>
    </li>)}
  </ol>
}

export function LessonRail({ courseHref, courseTitle, moduleTitle, moduleIndex, lessons }: {
  courseHref: string
  courseTitle: string
  moduleTitle: string
  moduleIndex: number
  lessons: RailLesson[]
}) {
  const { t } = useTranslation()
  // Keyboard users expand the rail by focusing into it; hover expands it with CSS.
  const [focused, setFocused] = useState(false)
  const done = lessons.filter(l => l.state === 'done').length
  return <div className="lx-rail-slot hidden md:block">
    <aside data-lesson-rail aria-label={t('dashboard.classViewer.lessonMode.rail.label')} data-expanded={focused}
      className="lx-rail group/rail hidden md:flex"
      onFocus={() => setFocused(true)}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false) }}>
      <Link href={courseHref} data-rail-home className="lx-home" aria-label={t('dashboard.classViewer.lessonMode.backToCourse')}>
        <Image src="/logo-solo-color.svg" alt="" width={32} height={24} className="h-6 w-8 object-contain" />
      </Link>
      <div className="lx-mod" title={t('dashboard.classViewer.lessonMode.rail.moduleProgress', { done, total: lessons.length })}>
        <ProgressRing done={done} total={lessons.length} />
        <span className="lx-reveal">
          <b>{moduleTitle}</b>
          <small>{t('dashboard.classViewer.lessonMode.rail.moduleOf', { course: courseTitle, n: moduleIndex + 1 })}</small>
        </span>
      </div>
      <LessonRailList lessons={lessons} />
      <div data-rail-settings className="lx-settings">
        <span className="lx-reveal lx-settings-label">{t('dashboard.classViewer.lessonMode.rail.settings')}</span>
        <ThemeToggle variant="rail" />
        <LanguageToggle variant="rail" />
      </div>
    </aside>
  </div>
}
