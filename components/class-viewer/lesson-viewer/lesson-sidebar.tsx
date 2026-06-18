'use client'

// Redesigned, collapsible course sidebar for the lesson viewer.
// Expanded: 340px module accordion with chip-labelled lesson rows.
// Collapsed: 72px rail with the teacher avatar, an expand button, and
// numbered lesson dots so navigation still works.

import Link from 'next/link'
import { useState } from 'react'
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Play,
  Check,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import styles from './lesson-viewer.module.css'

export interface LessonSidebarClass {
  id: string
  title: string
  totalItems: number
  completedItems: number
  isFree: boolean
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
  courseImageUrl?: string | null
  teacherName?: string | null
  teacherImageUrl?: string | null
  /** Whether the viewer can access subscription-gated classes. */
  hasAccess: boolean
  collapsed: boolean
  onToggle: () => void
}

type RowState = 'active' | 'completed' | 'locked' | 'available'

function classState(
  cls: LessonSidebarClass,
  currentClassId: string,
  hasAccess: boolean
): RowState {
  if (cls.id === currentClassId) return 'active'
  if (!cls.isFree && !hasAccess) return 'locked'
  if (cls.totalItems > 0 && cls.completedItems === cls.totalItems)
    return 'completed'
  return 'available'
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
  courseImageUrl,
  teacherName,
  teacherImageUrl,
  hasAccess,
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
          'hidden lg:flex flex-shrink-0 flex-col border-r border-border bg-sunken sticky top-14 h-[calc(100vh-3.5rem)] overflow-hidden'
        )}
      >
        <div
          className={cn(
            styles.scrollHide,
            'flex flex-1 flex-col items-center gap-3.5 px-2 py-3.5 overflow-y-auto'
          )}
        >
          {courseImageUrl ? (
            <img
              src={courseImageUrl}
              alt={courseTitle}
              className="h-11 w-11 flex-shrink-0 rounded-[10px] object-cover ring-1 ring-border"
            />
          ) : (
            <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[10px] bg-secondary text-sm font-bold font-heading text-foreground">
              {avatarInitials(courseTitle)}
            </div>
          )}
          <button
            onClick={onToggle}
            aria-label="Expand menu"
            className="grid h-9 w-9 place-items-center rounded-[9px] border border-border bg-raised text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
          <div className="h-px w-7 bg-border" />
          <div className="mt-0.5 flex flex-col items-center gap-1.5">
            {flat.map((c) => {
              const state = classState(c, currentClassId, hasAccess)
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/course/${courseId}/class/${c.id}`}
                  title={`Lesson ${c.n} — ${c.title}`}
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-[9px] border text-[13px] font-bold font-heading transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    state === 'active' &&
                      'border-primary bg-primary text-white',
                    state === 'completed' &&
                      'border-success/40 text-success hover:bg-muted',
                    state === 'locked' &&
                      'border-border text-muted-foreground/60 opacity-70 hover:bg-muted',
                    state === 'available' &&
                      'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {state === 'locked' ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    String(c.n).padStart(2, '0')
                  )}
                </Link>
              )
            })}
          </div>
        </div>
        {teacherName && (
          <div
            className="flex flex-shrink-0 items-center justify-center border-t border-border px-2 py-3.5"
            title={`Taught by ${teacherName}`}
          >
            {teacherImageUrl ? (
              <img
                src={teacherImageUrl}
                alt={teacherName}
                className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold font-heading text-foreground">
                {avatarInitials(teacherName)}
              </div>
            )}
          </div>
        )}
      </aside>
    )
  }

  return (
    <aside
      className={cn(
        styles.side,
        'hidden lg:flex flex-shrink-0 flex-col border-r border-border bg-sunken sticky top-14 h-[calc(100vh-3.5rem)] overflow-hidden'
      )}
    >
      <div className="flex h-full w-[340px] flex-col">
        {/* Course identity */}
        <div className="flex flex-shrink-0 items-center gap-3 p-3.5">
          {courseImageUrl ? (
            <img
              src={courseImageUrl}
              alt={courseTitle}
              className="h-12 w-12 flex-shrink-0 rounded-xl object-cover ring-1 ring-border"
            />
          ) : (
            <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl bg-secondary text-sm font-bold font-heading text-foreground">
              {avatarInitials(courseTitle)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-heading text-[15px] font-extrabold tracking-tight">
              {courseTitle}
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-terracotta">
              Learning pathway
            </div>
          </div>
          <button
            onClick={onToggle}
            aria-label="Collapse menu"
            className="grid h-[30px] w-[30px] place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Scroll area */}
        <div className={cn(styles.scrollHide, 'flex-1 overflow-y-auto')}>
          <Link
            href={`/dashboard/course/${courseId}`}
            className="group mx-2 mb-1 mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">Class overview</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>

          <div className="mx-3 my-1.5 h-px bg-border/60" />

          {numbered.map((section, i) => (
            <SidebarModule
              key={section.id}
              courseId={courseId}
              currentClassId={currentClassId}
              section={section}
              moduleIndex={i}
              hasAccess={hasAccess}
            />
          ))}

          <div className="h-4" />
        </div>

        {/* Taught by */}
        {teacherName && (
          <div className="flex flex-shrink-0 items-center gap-3 border-t border-border p-3.5">
            {teacherImageUrl ? (
              <img
                src={teacherImageUrl}
                alt={teacherName}
                className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold font-heading text-foreground">
                {avatarInitials(teacherName)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                Taught by
              </div>
              <div className="truncate text-sm font-semibold text-foreground">
                {teacherName}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

function SidebarModule({
  courseId,
  currentClassId,
  section,
  moduleIndex,
  hasAccess,
}: {
  courseId: string
  currentClassId: string
  section: Omit<LessonSidebarSection, 'classes'> & {
    classes: (LessonSidebarClass & { n: number })[]
  }
  moduleIndex: number
  hasAccess: boolean
}) {
  const containsActive = section.classes.some((c) => c.id === currentClassId)
  const [open, setOpen] = useState(containsActive)

  const pct =
    section.totalItems > 0
      ? Math.round((section.completedItems / section.totalItems) * 100)
      : 0
  const complete = section.totalItems > 0 && pct === 100

  return (
    <div className="pb-1">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mx-2 flex w-[calc(100%-16px)] items-start justify-between gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-terracotta">
            Module {moduleIndex + 1}
          </div>
          <div className="mt-1 font-heading text-[14px] font-bold leading-snug tracking-tight">
            {section.title}
          </div>
          {section.description && (
            <div className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {section.description}
            </div>
          )}
          <div className="mt-3 flex items-center gap-2.5">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-500',
                  complete ? 'bg-gold' : 'bg-primary'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10.5px] font-semibold tabular-nums text-muted-foreground">
              {section.completedItems}/{section.totalItems}
            </span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300',
            !open && '-rotate-90'
          )}
        />
      </button>

      {/* Lessons nest directly under the module — a hairline guide ties them
          together. The grid-rows trick animates the height open/closed. */}
      <div className={styles.collapse} data-open={open}>
        <div className="overflow-hidden">
          <div className="ml-5 mr-2 mt-2 border-l border-border/60 pl-2">
            <div className="mb-1 pl-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">
              Lessons
            </div>
            {section.classes.map((c) => (
              <LessonRow
                key={c.id}
                courseId={courseId}
                cls={c}
                state={classState(c, currentClassId, hasAccess)}
              />
            ))}
          </div>
        </div>
      </div>
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
  state: RowState
}) {
  return (
    <Link
      href={`/dashboard/course/${courseId}/class/${cls.id}`}
      className={cn(
        'group relative mb-0.5 flex items-center gap-3 rounded-lg py-2 pl-2 pr-2.5 transition-[background-color,transform] duration-150',
        state === 'active' ? 'bg-primary/[0.08]' : 'hover:translate-x-[2px] hover:bg-muted/60',
        state === 'locked' && 'opacity-70',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      )}
    >
      {state === 'active' && <span className={styles.lessonAccent} aria-hidden />}
      <span
        className={cn(
          'grid h-7 w-7 flex-shrink-0 place-items-center rounded-md border font-heading text-[11px] font-bold tabular-nums transition-colors',
          state === 'active' && 'border-primary/50 bg-primary/10 text-primary',
          state === 'completed' && 'border-success/40 text-success',
          (state === 'locked' || state === 'available') &&
            'border-border text-muted-foreground group-hover:border-primary/40'
        )}
      >
        {String(cls.n).padStart(2, '0')}
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm leading-tight tracking-[-0.005em]',
          state === 'active' ? 'font-semibold' : 'font-medium'
        )}
      >
        {cls.title}
      </span>
      {state === 'active' && (
        <span className="grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded-full bg-primary">
          <Play className="ml-px h-2.5 w-2.5 text-white" fill="#fff" />
        </span>
      )}
      {state === 'completed' && (
        <span className="grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded-full bg-success">
          <Check className="h-3 w-3 text-white" />
        </span>
      )}
      {state === 'locked' && (
        <span className="grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded-full border border-border text-muted-foreground">
          <Lock className="h-3 w-3" />
        </span>
      )}
    </Link>
  )
}
