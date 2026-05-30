'use client'

// Redesigned, collapsible course sidebar for the lesson viewer.
// Expanded: 340px module accordion with text-first lesson rows.
// Collapsed: 72px rail with the teacher avatar, an expand button, and
// numbered lesson dots so navigation still works.

import Link from 'next/link'
import { useState } from 'react'
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Play,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import styles from './lesson-viewer.module.css'

export interface LessonSidebarClass {
  id: string
  title: string
  totalItems: number
  completedItems: number
}

export interface LessonSidebarSection {
  id: string
  title: string
  description?: string | null
  totalItems: number
  completedItems: number
  classes: LessonSidebarClass[]
}

interface LessonSidebarProps {
  courseId: string
  currentClassId: string
  sections: LessonSidebarSection[]
  courseTitle: string
  teacherName?: string | null
  collapsed: boolean
  onToggle: () => void
}

function classState(cls: LessonSidebarClass, currentClassId: string) {
  if (cls.id === currentClassId) return 'active' as const
  if (cls.totalItems > 0 && cls.completedItems === cls.totalItems)
    return 'completed' as const
  return 'available' as const
}

function avatarInitials(name?: string | null) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function LessonSidebar({
  courseId,
  currentClassId,
  sections,
  courseTitle,
  teacherName,
  collapsed,
  onToggle,
}: LessonSidebarProps) {
  // Global 1-based lesson numbering across the whole course.
  let counter = 0
  const numbered = sections.map((s) => ({
    ...s,
    classes: s.classes.map((c) => ({ ...c, n: ++counter })),
  }))

  if (collapsed) {
    const flat = numbered.flatMap((s) => s.classes)
    return (
      <aside
        className={cn(
          styles.side,
          'hidden lg:flex flex-shrink-0 flex-col border-r border-border bg-card dark:bg-[hsl(0_0%_5%)] sticky top-0 h-[calc(100vh-3.5rem)] overflow-hidden'
        )}
      >
        <div
          className={cn(
            styles.scrollHide,
            'flex flex-col items-center gap-3.5 px-2 py-3.5 overflow-y-auto h-full'
          )}
        >
          <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[10px] bg-secondary text-sm font-bold font-heading text-foreground">
            {avatarInitials(teacherName)}
          </div>
          <button
            onClick={onToggle}
            aria-label="Expand menu"
            className="grid h-9 w-9 place-items-center rounded-[9px] border border-border bg-muted text-foreground hover:bg-muted/70 dark:bg-[hsl(0_0%_9%)] dark:hover:bg-[hsl(0_0%_13%)]"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
          <div className="h-px w-7 bg-border" />
          <div className="mt-0.5 flex flex-col items-center gap-1.5">
            {flat.map((c) => {
              const state = classState(c, currentClassId)
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/course/${courseId}/class/${c.id}`}
                  title={`Lesson ${c.n} — ${c.title}`}
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-[9px] border text-[13px] font-bold font-heading transition-colors',
                    state === 'active' &&
                      'border-primary bg-primary text-white',
                    state === 'completed' &&
                      'border-green-600/40 text-green-600 dark:text-green-400 hover:bg-muted',
                    state === 'available' &&
                      'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {String(c.n).padStart(2, '0')}
                </Link>
              )
            })}
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className={cn(
        styles.side,
        'hidden lg:flex flex-shrink-0 flex-col border-r border-border bg-card dark:bg-[hsl(0_0%_5%)] sticky top-0 h-[calc(100vh-3.5rem)] overflow-hidden'
      )}
    >
      <div className="flex h-full w-[340px] flex-col">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center gap-3 p-3.5">
          <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[10px] bg-secondary text-sm font-bold font-heading text-foreground">
            {avatarInitials(teacherName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-heading text-base font-bold tracking-tight">
              {courseTitle}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Learning path
            </div>
          </div>
          <button
            onClick={onToggle}
            aria-label="Collapse menu"
            className="grid h-[30px] w-[30px] place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Scroll area */}
        <div className={cn(styles.scrollHide, 'flex-1 overflow-y-auto')}>
          <Link
            href={`/dashboard/course/${courseId}`}
            className="mx-3.5 mb-3.5 mt-1 block rounded-xl border border-border bg-card px-3.5 py-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            Course overview
          </Link>

          {numbered.map((section) => (
            <SidebarModule
              key={section.id}
              courseId={courseId}
              currentClassId={currentClassId}
              section={section}
            />
          ))}

          <div className="h-4" />
        </div>
      </div>
    </aside>
  )
}

function SidebarModule({
  courseId,
  currentClassId,
  section,
}: {
  courseId: string
  currentClassId: string
  section: Omit<LessonSidebarSection, 'classes'> & {
    classes: (LessonSidebarClass & { n: number })[]
  }
}) {
  const containsActive = section.classes.some((c) => c.id === currentClassId)
  const [open, setOpen] = useState(containsActive)

  return (
    <div className="pb-3.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mx-3.5 flex w-[calc(100%-28px)] items-start justify-between gap-3 rounded-xl border border-border px-4 py-3.5 text-left"
      >
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
            {section.title}
          </div>
          <div className="mt-1 font-heading text-base font-bold tracking-tight">
            {section.completedItems}/{section.totalItems} complete
          </div>
        </div>
        <ChevronDown
          className={cn(
            'mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
            !open && '-rotate-90'
          )}
        />
      </button>

      {open && (
        <>
          <div className="mx-3.5 mb-2 mt-3 text-xs font-semibold text-muted-foreground">
            Lessons
          </div>
          {section.classes.map((c) => (
            <LessonRow
              key={c.id}
              courseId={courseId}
              cls={c}
              state={classState(c, currentClassId)}
            />
          ))}
        </>
      )}
    </div>
  )
}

function LessonRow({
  courseId,
  cls,
  state,
}: {
  courseId: string
  cls: LessonSidebarClass & { n: number }
  state: 'active' | 'completed' | 'available'
}) {
  return (
    <Link
      href={`/dashboard/course/${courseId}/class/${cls.id}`}
      className={cn(
        'relative mx-3.5 mb-0.5 flex items-center gap-3 rounded-[10px] py-2.5 pl-3.5 pr-3 transition-colors',
        state === 'active'
          ? 'bg-primary/[0.08]'
          : 'hover:bg-muted'
      )}
    >
      {state === 'active' && <span className={styles.lessonAccent} aria-hidden />}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'text-[10.5px] font-semibold uppercase leading-none tracking-[0.08em]',
            state === 'active' ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          Lesson {String(cls.n).padStart(2, '0')}
        </span>
        <span
          className={cn(
            'text-sm leading-tight tracking-[-0.005em]',
            state === 'active' ? 'font-semibold' : 'font-medium'
          )}
        >
          {cls.title}
        </span>
      </span>
      {state === 'active' && (
        <span className="grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded-full bg-primary">
          <Play className="ml-px h-2.5 w-2.5 text-white" fill="#fff" />
        </span>
      )}
      {state === 'completed' && (
        <span className="grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded-full bg-green-600">
          <Check className="h-3 w-3 text-white" />
        </span>
      )}
    </Link>
  )
}
