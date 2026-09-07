'use client'

// Body of the student module overview page: module stats + CTA, the full
// module description, and the module's lessons as cards with their own
// descriptions. Rendered inside LessonShell (sidebar + header come from it).

import Link from 'next/link'
import { BookOpen, Check, Clock, Layers, Lock, Play, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { LessonProgressButton } from '@/components/class-viewer/lesson-viewer/lesson-sidebar'
import styles from '@/components/class-viewer/lesson-viewer/lesson-viewer.module.css'
import {
  classHref,
  classState,
  formatDurationFromSeconds,
  type ModuleSummary,
} from '@/lib/courses/structure'

export interface ModuleOverviewLesson {
  id: string
  title: string
  description: string | null
  isFree: boolean
  totalItems: number
  completedItems: number
  durationSeconds: number
}

interface ModuleOverviewBodyProps {
  courseId: string
  moduleIndex: number
  description: string | null
  hasAccess: boolean
  summary: ModuleSummary
  lessons: ModuleOverviewLesson[]
}

/** Blank-line separated paragraphs, same treatment as the lesson description
    block on the lesson page. */
function Paragraphs({
  text,
  className,
  dimAfterFirst = false,
}: {
  text: string
  className: string
  dimAfterFirst?: boolean
}) {
  const paras = text.split(/\n{2,}/).filter((p) => p.trim().length > 0)
  return (
    <div className="space-y-3">
      {paras.map((para, i) => (
        <p
          key={i}
          className={cn('whitespace-pre-wrap', className, dimAfterFirst && i > 0 && 'opacity-75')}
        >
          {para}
        </p>
      ))}
    </div>
  )
}

const pillClass =
  'inline-flex items-center gap-1.5 rounded-full border border-border bg-raised px-3 py-1 text-xs font-medium text-foreground/80'
const sectionHeadingClass =
  'mb-3 font-heading text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground'

export function ModuleOverviewBody({
  courseId,
  moduleIndex,
  description,
  hasAccess,
  summary,
  lessons,
}: ModuleOverviewBodyProps) {
  const { t } = useTranslation()

  const nextLesson = lessons.find((l) => l.id === summary.nextClassId) ?? null
  const nextLocked = nextLesson ? !nextLesson.isFree && !hasAccess : false
  const started = summary.completedItems > 0

  return (
    <div className="px-4 pb-12 md:px-8">
      {/* Stats strip */}
      <div
        className={cn('flex flex-wrap items-center gap-2', styles.rise)}
        style={{ animationDelay: '80ms' }}
      >
        <span className="inline-flex items-center rounded-full bg-terracotta/10 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-terracotta">
          {t('dashboard.classViewer.sidebar.module', { n: moduleIndex + 1 })}
        </span>
        <span className={pillClass}>
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          {t(
            summary.lessonCount === 1
              ? 'dashboard.pages.course.lessonCountOne'
              : 'dashboard.pages.course.lessonCountOther',
            { count: summary.lessonCount }
          )}
        </span>
        <span className={pillClass}>
          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
          {t(
            summary.totalItems === 1
              ? 'dashboard.pages.course.itemCountOne'
              : 'dashboard.pages.course.itemCountOther',
            { count: summary.totalItems }
          )}
        </span>
        {summary.durationSeconds > 0 && (
          <span className={pillClass}>
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {formatDurationFromSeconds(summary.durationSeconds)}
          </span>
        )}
      </div>

      {/* Progress + CTA */}
      {lessons.length > 0 && (
        <div
          className={cn(
            'mt-5 flex flex-wrap items-center gap-x-6 gap-y-4 border-b border-border pb-6',
            styles.rise
          )}
          style={{ animationDelay: '120ms' }}
        >
          {summary.totalItems > 0 && (
            <div className="min-w-[200px] flex-1">
              <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>
                  {t('dashboard.pages.course.curriculum.completed', {
                    completed: summary.completedItems,
                    total: summary.totalItems,
                  })}
                </span>
                <span className="tabular-nums">{summary.pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-500',
                    summary.complete ? 'bg-gold' : 'bg-primary'
                  )}
                  style={{ width: `${summary.pct}%` }}
                />
              </div>
            </div>
          )}

          {summary.complete ? (
            <span className="inline-flex h-[42px] items-center gap-2 rounded-full bg-success/10 px-5 text-sm font-semibold text-success">
              <Check className="h-4 w-4" />
              {t('dashboard.pages.moduleOverview.moduleComplete')}
            </span>
          ) : (
            nextLesson && (
              <Link
                href={classHref(courseId, nextLesson.id)}
                className="inline-flex h-[42px] items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {nextLocked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" fill="currentColor" />
                )}
                {nextLocked
                  ? t('dashboard.pages.course.subscribeToUnlock')
                  : started
                    ? t('dashboard.pages.moduleOverview.continueModule')
                    : t('dashboard.pages.moduleOverview.startModule')}
              </Link>
            )
          )}
        </div>
      )}

      {/* Description column beside the lessons rail at wide widths; stacked
          below xl. With no description the lessons take the full width. */}
      <div
        className={cn(
          'mt-8 grid gap-10',
          description && 'xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] xl:gap-14'
        )}
      >
        {description && (
          <section className={cn('min-w-0', styles.rise)} style={{ animationDelay: '160ms' }}>
            <h2 className={sectionHeadingClass}>
              {t('dashboard.pages.moduleOverview.aboutModule')}
            </h2>
            <Paragraphs
              text={description}
              className="max-w-[80ch] text-[15.5px] leading-[1.75] text-foreground"
              dimAfterFirst
            />
          </section>
        )}

        <section className={cn('min-w-0', styles.rise)} style={{ animationDelay: '200ms' }}>
          <h2 className={sectionHeadingClass}>
            {t('dashboard.pages.moduleOverview.lessonsHeading')}
          </h2>

          {lessons.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              {t('dashboard.pages.moduleOverview.empty')}
            </div>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {lessons.map((lesson, i) => {
                const state = classState(lesson, null, hasAccess)
                const progress =
                  lesson.totalItems > 0
                    ? Math.max(0, Math.min(1, lesson.completedItems / lesson.totalItems))
                    : 0
                return (
                  <li key={lesson.id}>
                    <Link
                      href={classHref(courseId, lesson.id)}
                      className={cn(
                        'group flex items-start gap-3.5 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        state === 'locked' && 'opacity-80'
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-11 w-12 flex-shrink-0 place-items-center rounded-xl bg-foreground/[0.06] font-heading text-[14px] font-bold tabular-nums text-foreground transition-colors group-hover:bg-foreground/[0.09]',
                          state === 'completed' && 'text-success',
                          state === 'locked' && 'text-muted-foreground'
                        )}
                      >
                        {state === 'locked' ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          String(i + 1).padStart(2, '0')
                        )}
                      </span>

                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="font-heading text-[14.5px] font-bold leading-snug tracking-[-0.01em] text-foreground">
                          {lesson.title}
                        </div>
                        {lesson.description && (
                          <div className="mt-1.5">
                            <Paragraphs
                              text={lesson.description}
                              className="text-[13px] leading-relaxed text-muted-foreground"
                            />
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
                          <span>
                            {t(
                              lesson.totalItems === 1
                                ? 'dashboard.pages.course.itemCountOne'
                                : 'dashboard.pages.course.itemCountOther',
                              { count: lesson.totalItems }
                            )}
                          </span>
                          {lesson.durationSeconds > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDurationFromSeconds(lesson.durationSeconds)}
                            </span>
                          )}
                          {lesson.isFree && !hasAccess && (
                            <span className="inline-flex items-center gap-1 font-semibold text-gold">
                              <Unlock className="h-3 w-3" />
                              {t('dashboard.pages.moduleOverview.freePreview')}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="self-center">
                        <LessonProgressButton state={state} progress={progress} />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
