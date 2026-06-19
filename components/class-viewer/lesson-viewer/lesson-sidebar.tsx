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
          'hidden lg:flex flex-shrink-0 flex-col border-r border-border bg-sunken sticky top-0 h-[calc(100vh-3.5rem)] overflow-hidden'
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
        'hidden lg:flex flex-shrink-0 flex-col border-r border-border bg-sunken sticky top-0 h-[calc(100vh-3.5rem)] overflow-hidden'
      )}
    >
      <div className="flex h-full w-[360px] flex-col">
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
        <div className={cn(styles.scrollHide, 'flex-1 overflow-y-auto pt-1')}>
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
    <div
      className={cn(
        'mx-2 mb-1 mt-5 rounded-2xl border border-transparent transition-colors',
        containsActive ? 'bg-foreground/[0.02]' : 'border-foreground/[0.05]'
      )}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-terracotta">
            Module {moduleIndex + 1}
          </div>
          <div className="mt-1 font-heading text-[14px] font-bold leading-snug tracking-tight">
            {section.title}
          </div>
          {section.description && open && (
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

      {/* Lessons nest inside the module block so they share its background.
          The grid-rows trick animates the height open/closed. */}
      <div className={styles.collapse} data-open={open}>
        <div className="overflow-hidden">
          <div className="pb-3 pl-3 pr-1.5">
            <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">
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
  const progress =
    cls.totalItems > 0
      ? Math.max(0, Math.min(1, cls.completedItems / cls.totalItems))
      : 0

  return (
    <div className="group relative mb-2.5 flex items-stretch">
      {/* Left accent bar — a separate element beside the button. It has zero
          width by default (button is full-width), then expands on the active
          lesson or on hover, gently shrinking the button to make room. */}
      <span
        aria-hidden
        className={cn(
          'h-8 flex-shrink-0 self-center rounded-full bg-primary transition-all duration-300 ease-out',
          state === 'active'
            ? 'w-[4px] opacity-100 mr-2'
            : 'w-0 opacity-0 group-hover:w-[4px] group-hover:opacity-100 group-hover:mr-2'
        )}
      />

      <Link
        href={`/dashboard/course/${courseId}/class/${cls.id}`}
        className={cn(
          'flex flex-1 items-center gap-3 rounded-xl pr-2 transition-colors duration-150',
          state === 'active'
            ? 'bg-primary/[0.1]'
            : 'bg-foreground/[0.04] hover:bg-foreground/[0.07]',
          state === 'locked' && 'opacity-70',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
        )}
      >
        {/* Number box — flush to the button, sharing its corner radius. */}
        <span
          className={cn(
            'grid h-12 w-14 flex-shrink-0 place-items-center rounded-xl font-heading text-[15px] font-bold tabular-nums transition-colors',
            state === 'active'
              ? 'bg-primary/15 text-primary'
              : 'bg-foreground/[0.06] text-foreground group-hover:bg-foreground/[0.09]',
            state === 'completed' && 'text-success',
            state === 'locked' && 'text-muted-foreground'
          )}
        >
          {state === 'locked' ? (
            <Lock className="h-4 w-4" />
          ) : (
            String(cls.n).padStart(2, '0')
          )}
        </span>

        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[14px] leading-tight tracking-[-0.005em]',
            state === 'active'
              ? 'font-semibold text-foreground'
              : 'font-medium text-foreground/90'
          )}
        >
          {cls.title}
        </span>

        <LessonProgressButton state={state} progress={progress} />
      </Link>
    </div>
  )
}

// Circular play button whose ring fills with the lesson's completion progress.
function LessonProgressButton({
  state,
  progress,
}: {
  state: RowState
  progress: number
}) {
  if (state === 'locked') {
    return (
      <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border border-border text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
      </span>
    )
  }

  const stroke = 2.5
  const r = (32 - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = state === 'completed' ? 1 : progress

  return (
    <span className="relative grid h-8 w-8 flex-shrink-0 place-items-center">
      <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full -rotate-90">
        <circle
          cx="16"
          cy="16"
          r={r}
          fill="none"
          strokeWidth={stroke}
          className={state === 'active' ? 'stroke-primary/25' : 'stroke-foreground/15'}
        />
        {pct > 0 && (
          <circle
            cx="16"
            cy="16"
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circ * pct} ${circ}`}
            className={state === 'completed' ? 'stroke-success' : 'stroke-primary'}
          />
        )}
      </svg>
      <span
        className={cn(
          'grid h-[26px] w-[26px] place-items-center rounded-full transition-colors',
          state === 'active'
            ? 'bg-primary text-white'
            : 'text-primary group-hover:bg-primary/10'
        )}
      >
        {state === 'completed' ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Play className="ml-0.5 h-3 w-3" fill="currentColor" />
        )}
      </span>
    </span>
  )
}
